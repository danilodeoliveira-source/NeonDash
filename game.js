'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const TAU = Math.PI * 2;
  const SAVE_KEY = 'neon_rush_save_v1';
  const SETTINGS_KEY = 'neon_rush_settings_v1';

  const LEVELS = [
    {name:'PULSO ZERO',difficulty:'FÁCIL',speed:6.0,length:5200,theme:0,seed:17},
    {name:'FLUXO ELÉTRICO',difficulty:'NORMAL',speed:6.7,length:6400,theme:1,seed:41},
    {name:'VÉRTICE',difficulty:'NORMAL',speed:7.2,length:7200,theme:2,seed:73},
    {name:'GRAVIDADE ROTA',difficulty:'DIFÍCIL',speed:7.7,length:8200,theme:3,seed:109},
    {name:'SOBRECARGA',difficulty:'DIFÍCIL',speed:8.3,length:9300,theme:4,seed:131},
    {name:'NÚCLEO FINAL',difficulty:'PESADelo'.toUpperCase(),speed:9.0,length:10500,theme:5,seed:211}
  ];
  const THEMES = [
    {bg:'#050714',ground:'#11182e',grid:'#1b2c58',a:'#29e6ff',b:'#ff2dd1'},
    {bg:'#07110d',ground:'#11271e',grid:'#1f4e35',a:'#67ff6a',b:'#2de0ff'},
    {bg:'#120714',ground:'#281233',grid:'#5e205a',a:'#ff40d8',b:'#8a5cff'},
    {bg:'#0d0b05',ground:'#2b1d0f',grid:'#5a3c1a',a:'#ffd74a',b:'#ff6b2d'},
    {bg:'#070710',ground:'#17152a',grid:'#4b3a75',a:'#b36cff',b:'#2de0ff'},
    {bg:'#120505',ground:'#27100f',grid:'#632020',a:'#ff4545',b:'#ffd44a'}
  ];

  const defaultSave = {unlocked:1,best:Array(LEVELS.length).fill(0),coins:Array(LEVELS.length).fill(0),wins:Array(LEVELS.length).fill(false),stars:0};
  const defaultSettings = {volume:.35,sfx:true,particles:true,shake:true};
  const loadJSON = (key, fallback) => { try { return {...fallback, ...JSON.parse(localStorage.getItem(key)||'{}')}; } catch { return {...fallback}; } };
  const save = loadJSON(SAVE_KEY, defaultSave);
  save.best = Array.isArray(save.best)?save.best:Array(LEVELS.length).fill(0);
  save.coins = Array.isArray(save.coins)?save.coins:Array(LEVELS.length).fill(0);
  save.wins = Array.isArray(save.wins)?save.wins:Array(LEVELS.length).fill(false);
  const settings = loadJSON(SETTINGS_KEY, defaultSettings);

  let audioCtx = null;
  const ensureAudio = () => { if(!audioCtx){try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();}catch{}} if(audioCtx?.state==='suspended') audioCtx.resume().catch(()=>{}); };
  function beep(freq=440,dur=.07,type='square',gain=.04){ if(!settings.sfx||!audioCtx)return; try{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(gain,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+dur);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur);}catch{} }

  let W=1280,H=720,dpr=1;
  function resize(){ dpr=Math.min(2,devicePixelRatio||1); const r=canvas.getBoundingClientRect(); W=Math.max(640,Math.floor(r.width));H=Math.max(360,Math.floor(r.height));canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0); }
  addEventListener('resize',resize); resize();

  const input={jump:false,jumpPressed:false,dash:false,dashPressed:false};
  const setJump=()=>{input.jump=true;input.jumpPressed=true;ensureAudio();};
  const setDash=()=>{input.dash=true;input.dashPressed=true;ensureAudio();};
  addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k===' '||k==='arrowup'||k==='w'){e.preventDefault();setJump();}
    if(k==='shift'||k==='x'){e.preventDefault();setDash();}
    if(k==='r'&&game.running){e.preventDefault();restartLevel();}
    if(k==='escape'&&game.running){e.preventDefault();togglePause();}
  });
  addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k===' '||k==='arrowup'||k==='w')input.jump=false;if(k==='shift'||k==='x')input.dash=false;});
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();setJump();},{passive:false});
  canvas.addEventListener('contextmenu',e=>e.preventDefault());

  const game={running:false,paused:false,level:0,x:0,velY:0,grav:1,groundY:0,playerY:0,coyote:0,jumpBuffer:0,canDash:true,dashT:0,worldSpeed:0,coins:0,score:0,shake:0,particles:[],obstacles:[],collectibles:[],portals:[],last:0,deathTimer:0};

  function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
  function buildLevel(index){
    const L=LEVELS[index],r=rng(L.seed);game.obstacles=[];game.collectibles=[];game.portals=[];
    let x=620;
    while(x<L.length-350){
      const span=120+Math.floor(r()*160); const type=r();
      if(type<.24){game.obstacles.push({x:x,y:0,w:46,h:46,kind:'spike'});}
      else if(type<.42){game.obstacles.push({x:x,y:0,w:90,h:46,kind:'double'});}
      else if(type<.55){game.obstacles.push({x:x,y:0,w:42,h:105,kind:'tower'});}
      else if(type<.67){game.obstacles.push({x:x,y:0,w:120,h:24,kind:'block'});}
      else if(type<.79){game.portals.push({x:x+30,type:'gravity'});}
      else if(type<.88){game.portals.push({x:x+30,type:'speed'});}
      if(r()<.76){for(let i=0;i<3+(r()*5|0);i++)game.collectibles.push({x:x+20+i*24,y:90+Math.sin(i)*20+(r()*20),taken:false});}
      if(r()<.22)game.collectibles.push({x:x+80,y:120,taken:false,big:true});
      x+=span;
    }
    game.collectibles.push({x:L.length-160,y:100,taken:false,big:true});
    game.worldSpeed=L.speed;game.x=0;game.velY=0;game.grav=1;game.groundY=H*.78;game.playerY=game.groundY-28;game.coyote=.12;game.jumpBuffer=0;game.canDash=true;game.dashT=0;game.coins=0;game.score=0;game.deathTimer=0;
    $('#levelLabel').textContent=`FASE ${index+1} — ${L.name}`;
    $('#coinHud').textContent='0';$('#scoreHud').textContent='0';updateHud();
  }

  function playerRect(){return {x:140,y:game.playerY,w:28,h:28};}
  function obstacleRect(o){if(o.kind==='spike')return {x:o.x,y:game.groundY-46,w:o.w,h:o.h};if(o.kind==='tower')return{x:o.x,y:game.groundY-o.h,w:o.w,h:o.h};if(o.kind==='block')return{x:o.x,y:game.groundY-o.h,w:o.w,h:o.h};return{x:o.x,y:game.groundY-o.h,w:o.w,h:o.h};}
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

  function update(dt){
    if(game.paused||!game.running)return;
    if(game.deathTimer>0){game.deathTimer-=dt;if(game.deathTimer<=0)restartLevel();return;}
    const L=LEVELS[game.level]; game.x += game.worldSpeed*dt*60/60;
    if(input.jumpPressed)game.jumpBuffer=.14;else game.jumpBuffer=Math.max(0,game.jumpBuffer-dt);
    if(game.playerY>=game.groundY-28-.5)game.coyote=.12;else game.coyote=Math.max(0,game.coyote-dt);
    if(game.jumpBuffer>0&&game.coyote>0){game.velY=-620*game.grav;game.jumpBuffer=0;game.coyote=0;beep(620,.06,'square',.045);spawnBurst(140,game.playerY+14,6);}
    if(input.dashPressed&&game.canDash){game.canDash=false;game.dashT=.15;game.worldSpeed=L.speed+5;beep(160,.08,'sawtooth',.055);spawnBurst(140,game.playerY+14,10);}
    if(game.dashT>0){game.dashT-=dt;if(game.dashT<=0)game.worldSpeed=L.speed;}
    game.velY += 1900*game.grav*dt; game.playerY += game.velY*dt;
    const ceiling=70, floor=game.groundY-28;
    if(game.playerY>floor){game.playerY=floor;game.velY=0;game.canDash=true;}
    if(game.playerY<ceiling){game.playerY=ceiling;game.velY=0;}
    for(const p of game.portals){if(!p.hit && p.x-game.x<170&&p.x-game.x>110){p.hit=true;if(p.type==='gravity'){game.grav*=-1;game.velY=0;beep(340,.08,'triangle',.05);spawnBurst(170,game.playerY+14,18)}else{game.worldSpeed=L.speed*1.15;setTimeout(()=>{if(game.running&&!game.deathTimer)game.worldSpeed=L.speed;},700);beep(760,.08,'square',.045);}}}
    const pr=playerRect();
    for(const o of game.obstacles){const rr=obstacleRect(o);if(rr.x-game.x<180&&rr.x-game.x+rr.w>110){const local={x:rr.x-game.x,y:rr.y,w:rr.w,h:rr.h};if(overlap(pr,local)){die();return;}}}
    for(const c of game.collectibles){if(c.taken)continue;const cx=c.x-game.x,cy=(game.grav>0?game.groundY-110:110)+(c.big?0:Math.sin((c.x+game.x)*.02)*12);if(Math.abs(cx-154)<26&&Math.abs(cy-(game.playerY+14))<34){c.taken=true;game.coins+=c.big?5:1;game.score+=c.big?500:100;$('#coinHud').textContent=game.coins;$('#scoreHud').textContent=game.score;beep(c.big?880:720,.045,'square',.035);spawnBurst(154,cy,8);}}
    if(game.x>=L.length){winLevel();return;}
    if(game.playerY<10||game.playerY>H+50){die();return;}
    if(settings.particles)updateParticles(dt);else game.particles.length=0;
    updateHud(); input.jumpPressed=false;input.dashPressed=false;
  }

  function die(){if(game.deathTimer>0)return;game.deathTimer=.42;game.running=true;game.shake=settings.shake?12:0;beep(110,.12,'sawtooth',.06);spawnBurst(154,game.playerY+14,22);}
  function winLevel(){game.running=false;save.best[game.level]=Math.max(save.best[game.level],Math.round((game.x/LEVELS[game.level].length)*100));save.coins[game.level]=Math.max(save.coins[game.level],game.coins);save.wins[game.level]=true;save.unlocked=Math.max(save.unlocked,Math.min(LEVELS.length,game.level+2));save.stars+=1;persist();showMessage(`FASE ${game.level+1} CONCLUÍDA • +${game.coins} ◆`,2600);beep(660,.12,'square',.05);setTimeout(()=>{show('levels');renderLevels();},900);}
  function restartLevel(){hideMessage();game.running=true;game.paused=false;$('#pauseOverlay').classList.add('hidden');buildLevel(game.level);}
  function updateHud(){const p=Math.max(0,Math.min(100,Math.floor(game.x/LEVELS[game.level].length*100)));$('#progressBar').style.width=p+'%';$('#progressText').textContent=p+'%';}
  function persist(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch{}}
  function spawnBurst(x,y,n){if(!settings.particles)return;for(let i=0;i<n;i++){const a=Math.random()*TAU,s=80+Math.random()*260;game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+.25*Math.random(),max:.6,size:2+Math.random()*5});}}
  function updateParticles(dt){for(const q of game.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=500*dt;q.life-=dt;}game.particles=game.particles.filter(q=>q.life>0);}

  function draw(){
    const L=LEVELS[game.level]||LEVELS[0],T=THEMES[L.theme]; ctx.save(); if(game.shake>0){game.shake*=.82;ctx.translate((Math.random()-.5)*game.shake,(Math.random()-.5)*game.shake);}
    ctx.fillStyle=T.bg;ctx.fillRect(0,0,W,H);drawBackground(T);
    const gy=game.groundY||H*.78;
    ctx.fillStyle=T.ground;ctx.fillRect(0,gy,W,H-gy);ctx.strokeStyle=T.a;ctx.globalAlpha=.28;ctx.lineWidth=2;for(let y=gy+12;y<H;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}for(let x=-(game.x%48);x<W;x+=48){ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x+28,H);ctx.stroke();}ctx.globalAlpha=1;
    for(const p of game.portals){const x=p.x-game.x+140;if(x<-80||x>W+80)continue;ctx.strokeStyle=p.type==='gravity'?T.b:T.a;ctx.lineWidth=8;ctx.beginPath();ctx.arc(x,gy-140,38,0,TAU);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,gy-140,24,0,TAU);ctx.stroke();}
    for(const c of game.collectibles){if(c.taken)continue;const x=c.x-game.x+140;if(x<-40||x>W+40)continue;const y=(game.grav>0?gy-110:110)+(c.big?0:Math.sin((c.x+game.x)*.02)*12);ctx.strokeStyle=c.big?T.b:T.a;ctx.lineWidth=c.big?5:3;ctx.beginPath();ctx.arc(x,y,c.big?12:8,0,TAU);ctx.stroke();if(c.big){ctx.fillStyle=T.b;ctx.fillRect(x-3,y-3,6,6);}}
    for(const o of game.obstacles){const x=o.x-game.x+140;if(x<-120||x>W+120)continue;drawObstacle(o,x,gy,T);}
    const pr=playerRect();drawPlayer(pr.x,pr.y,T);
    for(const q of game.particles){ctx.globalAlpha=Math.max(0,q.life/q.max);ctx.fillStyle=T.a;ctx.fillRect(q.x,q.y,q.size,q.size);}ctx.globalAlpha=1;ctx.restore();
  }
  function drawBackground(T){ctx.fillStyle=T.grid;ctx.globalAlpha=.2;for(let i=0;i<14;i++){const y=70+i*34+Math.sin((game.x+i*90)*.003)*8;ctx.fillRect(0,y,W,1);}for(let x=-(game.x*.25%90);x<W;x+=90){ctx.fillRect(x,0,1,H*.75);}ctx.globalAlpha=1;for(let i=0;i<5;i++){const x=((i*280-game.x*.18)% (W+260))-120;ctx.fillStyle=i%2?T.a:T.b;ctx.globalAlpha=.07;ctx.beginPath();ctx.arc(x,100+i*70,70,0,TAU);ctx.fill();}ctx.globalAlpha=1;}
  function drawObstacle(o,x,gy,T){ctx.fillStyle='#f5f7ff';ctx.strokeStyle=T.b;ctx.lineWidth=2;if(o.kind==='spike'){ctx.beginPath();ctx.moveTo(x,gy);ctx.lineTo(x+23,gy-46);ctx.lineTo(x+46,gy);ctx.closePath();ctx.fill();ctx.stroke();}else{ctx.fillRect(x,gy-o.h,o.w,o.h);ctx.strokeRect(x,gy-o.h,o.w,o.h);for(let xx=x+8;xx<x+o.w-4;xx+=12)ctx.fillRect(xx,gy-o.h+7,5,5);}}
  function drawPlayer(x,y,T){ctx.save();ctx.translate(x+14,y+14);ctx.rotate((game.x*.04)%TAU);ctx.fillStyle='#ffffff';ctx.strokeStyle=T.a;ctx.lineWidth=3;ctx.fillRect(-14,-14,28,28);ctx.strokeRect(-14,-14,28,28);ctx.fillStyle=T.b;ctx.fillRect(-5,-5,10,10);ctx.restore();}

  function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));const el=$('#'+id);el.classList.remove('hidden');el.classList.add('active');}
  function hideMessage(){const m=$('#gameMessage');m.classList.add('hidden');m.textContent='';}
  function showMessage(text,duration=2000){const m=$('#gameMessage');m.textContent=text;m.classList.remove('hidden');setTimeout(()=>m.classList.add('hidden'),duration);}
  function renderLevels(){const grid=$('#levelGrid');grid.innerHTML='';LEVELS.forEach((L,i)=>{const unlocked=i<save.unlocked;const card=document.createElement('div');card.className='level-card'+(unlocked?'':' locked');card.innerHTML=`<div><div class="n">${String(i+1).padStart(2,'0')}</div><h3>${L.name}</h3><p>${L.difficulty} • velocidade ${L.speed.toFixed(1)}</p></div><div class="small">MELHOR: ${save.best[i]||0}% • MOEDAS: ${save.coins[i]||0}</div><button class="menu-btn ${unlocked?'primary':''}" ${unlocked?'':'disabled'} data-level="${i}">${unlocked?'JOGAR':'BLOQUEADA'}</button>`;const btn=card.querySelector('button');if(unlocked)btn.addEventListener('click',()=>startLevel(i));grid.appendChild(card);});$('#bestSummary').textContent=`${save.wins.filter(Boolean).length}/${LEVELS.length} concluídas • ★ ${save.stars}`;}
  function startLevel(i){ensureAudio();game.level=i;buildLevel(i);game.running=true;game.paused=false;hideMessage();$('#pauseOverlay').classList.add('hidden');show('game');}
  function togglePause(){if(!game.running)return;game.paused=!game.paused;$('#pauseOverlay').classList.toggle('hidden',!game.paused);if(game.paused)beep(220,.05,'square',.025);else beep(440,.05,'square',.025);}
  function renderSettings(){
    $('#volumeSlider').value=settings.volume;$('#sfxToggle').checked=settings.sfx;$('#particlesToggle').checked=settings.particles;$('#shakeToggle').checked=settings.shake;
  }
  document.addEventListener('click',e=>{const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;ensureAudio();if(a==='play')startLevel(Math.min(Math.max(save.unlocked-1,0),LEVELS.length-1));else if(a==='levels'){game.running=false;show('levels');renderLevels();}else if(a==='settings'){renderSettings();show('settings');}else if(a==='menu'){game.running=false;show('menu');}else if(a==='pause')togglePause();else if(a==='resume')togglePause();else if(a==='restart')restartLevel();else if(a==='resetSave'){localStorage.removeItem(SAVE_KEY);Object.assign(save,defaultSave);renderLevels();showMessage('PROGRESSO RESETADO',1300);}});
  $('#volumeSlider').addEventListener('input',e=>{settings.volume=Number(e.target.value);try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}});
  $('#sfxToggle').addEventListener('change',e=>{settings.sfx=e.target.checked;try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}});
  $('#particlesToggle').addEventListener('change',e=>{settings.particles=e.target.checked;try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}});
  $('#shakeToggle').addEventListener('change',e=>{settings.shake=e.target.checked;try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}});

  function loop(t){const dt=Math.min(.033,(t-game.last||t)/1000);game.last=t;update(dt);draw();requestAnimationFrame(loop);} requestAnimationFrame(loop);
  renderLevels();renderSettings();show('menu');
})();
