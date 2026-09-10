'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const TAU = Math.PI * 2;
  const SAVE_KEY = 'neon_rush_v3_save';

  const LEVELS = [
    {name:'PULSO PRIME', difficulty:'FÁCIL', speed:7.2, length:14000, colors:['#37e8ff','#ff3bc8'], seed:1},
    {name:'VIA CROMA', difficulty:'FÁCIL', speed:7.7, length:15400, colors:['#8cff4d','#39c8ff'], seed:2},
    {name:'NÉON VERTICAL', difficulty:'NORMAL', speed:8.2, length:16800, colors:['#ffcf3d','#ff4e8d'], seed:3},
    {name:'GRAVIDADE ZERO', difficulty:'NORMAL', speed:8.7, length:18300, colors:['#7c7cff','#35f0d0'], seed:4},
    {name:'RITMO BRUTO', difficulty:'DIFÍCIL', speed:9.2, length:20000, colors:['#ff5f45','#ffd44d'], seed:5},
    {name:'PULSO FINAL', difficulty:'EXTREMA', speed:9.8, length:22000, colors:['#ff3fd3','#5c7dff'], seed:6}
  ];
  const defaultSave = {unlocked:1,best:Array(LEVELS.length).fill(0),coins:Array(LEVELS.length).fill(0),wins:Array(LEVELS.length).fill(false),stars:0};
  const save = (()=>{try{return Object.assign({},defaultSave,JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'))}catch{return {...defaultSave}}})();
  if(!Array.isArray(save.best)||save.best.length!==LEVELS.length)save.best=defaultSave.best.slice();
  if(!Array.isArray(save.coins)||save.coins.length!==LEVELS.length)save.coins=defaultSave.coins.slice();
  if(!Array.isArray(save.wins)||save.wins.length!==LEVELS.length)save.wins=defaultSave.wins.slice();
  const persist=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(save))}catch{}};

  let W=1280,H=720,dpr=1;
  function resize(){const r=canvas.getBoundingClientRect();W=Math.max(900,Math.floor(r.width));H=Math.max(520,Math.floor(r.height));dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.floor(W*dpr);canvas.height=Math.floor(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0)}
  addEventListener('resize',resize);resize();

  let audio=null;
  function audioOn(){try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume()}catch{}}
  function beep(f,d=.05,t='square',g=.025){if(!audio)return;try{const o=audio.createOscillator(),a=audio.createGain();o.type=t;o.frequency.value=f;a.gain.setValueAtTime(g,audio.currentTime);a.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+d);o.connect(a).connect(audio.destination);o.start();o.stop(audio.currentTime+d)}catch{}}

  const input={jump:false,held:false};
  const pressJump=()=>{input.jump=true;input.held=true;audioOn()};
  const releaseJump=()=>{input.held=false};
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(k===' '||k==='w'||k==='arrowup'){e.preventDefault();if(!e.repeat)pressJump()}else if(k==='r'&&world.active){e.preventDefault();restart()}else if(k==='escape'&&world.active){e.preventDefault();togglePause()}});
  addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k===' '||k==='w'||k==='arrowup')releaseJump()});
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();pressJump()},{passive:false});
  addEventListener('pointerup',releaseJump);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());

  const world={active:false,paused:false,level:0,camera:0,time:0,player:{y:0,vy:0,rot:0,mode:'cube',grav:1,onGround:false},dead:false,deadTimer:0,ground:0,objects:[],coins:[],portals:[],pads:[],particles:[],collected:0,score:0,beat:0,last:0,flash:0,shipHold:false};
  function rng(seed){let s=(seed|0)+12345;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
  function buildLevel(i){
    const L=LEVELS[i],r=rng(L.seed);
    world.level=i;world.camera=0;world.time=0;world.ground=H*.77;world.player.y=world.ground-34;world.player.vy=0;world.player.rot=0;world.player.mode='cube';world.player.grav=1;world.player.onGround=true;world.active=true;world.paused=false;world.dead=false;world.deadTimer=0;world.objects=[];world.coins=[];world.portals=[];world.pads=[];world.particles=[];world.collected=0;world.score=0;world.beat=0;world.flash=0;world.shipHold=false;
    const spike=(x,n=1)=>{for(let k=0;k<n;k++)world.objects.push({x:x+k*34,w:34,h:42,type:'spike'})};
    const block=(x,y,w,h)=>world.objects.push({x,y,w,h,type:'block'});
    const coin=(x,y,big=false)=>world.coins.push({x,y,big,taken:false});
    const pad=(x,type='jump')=>world.pads.push({x,type,used:false});
    const portal=(x,type)=>world.portals.push({x,type,used:false});
    let x=620;
    while(x<L.length-700){
      const p=Math.floor(r()*12);
      if(p===0){spike(x);spike(x+120);coin(x+58,world.ground-160)}
      if(p===1){spike(x,2);coin(x+70,world.ground-150);}
      if(p===2){block(x,world.ground-88,120,88);spike(x+130);coin(x+45,world.ground-145)}
      if(p===3){block(x,world.ground-140,44,140);block(x+115,world.ground-95,44,95);coin(x+73,world.ground-225,true)}
      if(p===4){pad(x,'jump');spike(x+105,2);coin(x+35,world.ground-170)}
      if(p===5){block(x,world.ground-105,42,105);block(x+88,world.ground-105,42,105);spike(x+42);coin(x+64,world.ground-185)}
      if(p===6){portal(x+20,'gravity');spike(x+80,2);coin(x+35,world.ground+90)}
      if(p===7){portal(x+20,'cube');block(x+95,world.ground-125,44,125);spike(x+140,2);coin(x+110,world.ground-205)}
      if(p===8){portal(x+20,'ship');coin(x+75,world.ground-245);coin(x+140,world.ground-295);}
      if(p===9){if(i<2)spike(x,3);else{block(x,world.ground-60,170,60);spike(x+56);spike(x+112)}coin(x+28,world.ground-145)}
      if(p===10){block(x,world.ground-75,70,75);pad(x+22,'jump');block(x+105,world.ground-135,70,135);coin(x+128,world.ground-210)}
      if(p===11){portal(x+30,'cube');spike(x+96);spike(x+175);coin(x+125,world.ground-145,true)}
      x += 230 + Math.floor(r()*190);
    }
    coin(L.length-400,world.ground-180,true);
    updateHUD();
  }

  function px(){return 155}
  function playerRect(){const s=34;return{x:px()-s/2,y:world.player.y,w:s,h:s}}
  function objectRect(o){return{x:o.x-world.camera+px(),y:o.y??world.ground-o.h,w:o.w,h:o.h}}
  function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
  function burst(x,y,col,n=14){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=90+Math.random()*230;world.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.25+.45*Math.random(),size:2+Math.random()*4,col})}}
  function die(){if(world.dead)return;world.dead=true;world.deadTimer=.7;world.flash=.4;burst(px(),world.player.y+17,LEVELS[world.level].colors[1],42);beep(110,.18,'sawtooth',.055)}
  function restart(){hide('#pause');hide('#result');buildLevel(world.level)}
  function win(){world.active=false;const i=world.level,p=Math.min(100,Math.floor(world.camera/LEVELS[i].length*100));save.best[i]=Math.max(save.best[i],100);save.coins[i]=Math.max(save.coins[i],world.collected);save.wins[i]=true;save.stars+=1;save.unlocked=Math.max(save.unlocked,Math.min(LEVELS.length,i+2));persist();showResult(`100% concluído • ${world.collected}/4 moedas • ${world.score} pontos`);beep(660,.08);setTimeout(()=>beep(880,.12),90);setTimeout(()=>beep(1100,.16),180)}

  function update(dt){
    if(!world.active||world.paused)return;
    if(world.dead){world.deadTimer-=dt;world.flash=Math.max(0,world.flash-dt);updateParticles(dt);if(world.deadTimer<=0)restart();return}
    const L=LEVELS[world.level],p=world.player;
    world.time+=dt;world.beat=Math.sin(world.time*10.0)*0.5+0.5;world.camera+=L.speed*60*dt;world.flash=Math.max(0,world.flash-dt);
    if(input.jump){input.jump=false;if(p.mode==='cube'&&p.onGround){p.vy=-690*p.grav;p.onGround=false;beep(520,.05)}else if(p.mode==='ship'){beep(420,.035)}}
    if(p.mode==='ship'){world.shipHold=input.held;p.vy += (world.shipHold?-900:720)*dt*p.grav}else p.vy += 2100*dt*p.grav;
    p.y += p.vy*dt;
    if(p.grav>0){if(p.y>=world.ground-34){p.y=world.ground-34;p.vy=0;p.onGround=true}else p.onGround=false;if(p.y>H+80)die()}
    else{if(p.y<=60){p.y=60;p.vy=0;p.onGround=true}else p.onGround=false;if(p.y<-70)die()}
    if(p.mode==='cube')p.rot += (p.onGround?0:8.2)*dt*(p.grav>0?1:-1);
    else p.rot += 4*dt;

    for(const pd of world.pads){const sx=pd.x-world.camera+px();if(!pd.used&&sx>110&&sx<210&&Math.abs(p.y-(world.ground-36))<40){pd.used=true;p.vy=-930*p.grav;p.onGround=false;burst(px(),p.y+18,L.colors[0],12);beep(780,.07,'square',.04)}}
    for(const po of world.portals){if(po.used)continue;const sx=po.x-world.camera+px();if(sx>115&&sx<200){po.used=true;if(po.type==='gravity'){p.grav*=-1;p.vy=0;beep(340,.09,'triangle',.04)}else if(po.type==='ship'){p.mode='ship';p.grav=1;beep(580,.1,'sawtooth',.04)}else if(po.type==='cube'){p.mode='cube';p.grav=1;p.vy=0;beep(500,.05,'square',.03)}burst(px(),p.y+17,L.colors[1],20)}}
    const pr=playerRect();
    for(const o of world.objects){const rr=objectRect(o);if(rr.x<210&&rr.x+rr.w>95&&hit(pr,rr)){die();return}}
    for(const c of world.coins){if(c.taken)continue;const sx=c.x-world.camera+px();const sy=c.y;if(Math.abs(sx-px())<30&&Math.abs(sy-(p.y+17))<36){c.taken=true;world.collected++;world.score+=c.big?500:250;burst(sx,sy,L.colors[1],12);beep(c.big?990:820,.05)}}
    if(world.camera>L.length-50){win();return}
    updateParticles(dt);updateHUD();
  }
  function updateParticles(dt){for(const p of world.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=500*dt;p.life-=dt}world.particles=world.particles.filter(p=>p.life>0)}

  function draw(){
    const L=LEVELS[world.level]||LEVELS[0];
    ctx.save();drawBackground(L);drawDecor(L);drawObjects(L);drawCoins(L);drawPlayer(L);drawParticles();ctx.restore();
    if(world.flash>0){ctx.fillStyle=`rgba(255,255,255,${world.flash*.45})`;ctx.fillRect(0,0,W,H)}
  }
  function drawBackground(L){
    const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#07091b');g.addColorStop(.62,'#080c2a');g.addColorStop(1,'#111a38');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.1;ctx.strokeStyle=L.colors[0];ctx.lineWidth=1;const ox=-((world.camera*.35)%80),oy=90;for(let x=ox;x<W+80;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,oy);ctx.stroke()}for(let y=oy;y<H;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.globalAlpha=1;
    for(let i=0;i<12;i++){const x=((i*170-world.camera*.08)% (W+260))-130;const h=80+(i%5)*24;ctx.fillStyle=i%2?'#0c1330':'#0e1738';ctx.fillRect(x,world.ground-100-h,90,h);ctx.fillRect(x+26,world.ground-100-h-22,30,22)}
    const glow=.04+world.beat*.035;ctx.globalAlpha=glow;ctx.fillStyle=L.colors[0];ctx.beginPath();ctx.arc(W*.52,H*.32,260,0,TAU);ctx.fill();ctx.globalAlpha=1;
  }
  function drawDecor(L){
    ctx.fillStyle='#111a35';ctx.fillRect(0,world.ground,W,H-world.ground);
    ctx.strokeStyle=L.colors[0];ctx.lineWidth=2;ctx.globalAlpha=.45;for(let x=-((world.camera*.7)%56);x<W;x+=56){ctx.beginPath();ctx.moveTo(x,world.ground);ctx.lineTo(x-60,H);ctx.stroke()}ctx.globalAlpha=1;
    ctx.fillStyle='#fff';ctx.font='bold 11px ui-monospace,monospace';ctx.fillText(`FASE ${world.level+1} — ${L.name}`,20,34);
  }
  function drawObjects(L){
    for(const o of world.objects){const r=objectRect(o);if(r.x<-80||r.x>W+80)continue;if(o.type==='spike'){ctx.fillStyle=L.colors[1];ctx.shadowColor=L.colors[1];ctx.shadowBlur=10;ctx.beginPath();ctx.moveTo(r.x,r.y+r.h);ctx.lineTo(r.x+r.w/2,r.y);ctx.lineTo(r.x+r.w,r.y+r.h);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.globalAlpha=.25;ctx.fillRect(r.x+5,r.y+r.h-6,r.w-10,4);ctx.globalAlpha=1}else{ctx.fillStyle='#101632';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle=L.colors[0];ctx.lineWidth=3;ctx.strokeRect(r.x+1.5,r.y+1.5,r.w-3,r.h-3);ctx.globalAlpha=.25;ctx.fillStyle=L.colors[0];ctx.fillRect(r.x+8,r.y+8,r.w-16,6);ctx.globalAlpha=1}}
    for(const pd of world.pads){const sx=pd.x-world.camera+px();if(sx<-50||sx>W+50)continue;ctx.strokeStyle=L.colors[0];ctx.lineWidth=3;ctx.strokeRect(sx-18,world.ground-16,36,12);ctx.beginPath();ctx.moveTo(sx-12,world.ground-10);ctx.lineTo(sx,world.ground-2);ctx.lineTo(sx+12,world.ground-10);ctx.stroke()}
    for(const po of world.portals){const sx=po.x-world.camera+px();if(sx<-60||sx>W+60)continue;ctx.strokeStyle=po.type==='gravity'?L.colors[1]:L.colors[0];ctx.lineWidth=5;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=18;ctx.beginPath();ctx.arc(sx,world.ground-125,28+world.beat*3,0,TAU);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='bold 10px ui-monospace,monospace';ctx.textAlign='center';ctx.fillText(po.type==='ship'?'SHIP':po.type==='gravity'?'GRAV':'CUBE',sx,world.ground-120);ctx.textAlign='left'}
  }
  function drawCoins(L){for(const c of world.coins){if(c.taken)continue;const sx=c.x-world.camera+px();if(sx<-40||sx>W+40)continue;const y=c.y;const r=c.big?13:9;ctx.save();ctx.translate(sx,y);ctx.rotate(world.time*2);ctx.strokeStyle=L.colors[1];ctx.lineWidth=4;ctx.shadowColor=L.colors[1];ctx.shadowBlur=15;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();ctx.shadowBlur=0;ctx.restore()}}
  function drawPlayer(L){const p=world.player,s=34,x=px();ctx.save();ctx.translate(x,p.y+17);ctx.rotate(p.rot);ctx.shadowColor=L.colors[0];ctx.shadowBlur=18;ctx.fillStyle='#f5f8ff';ctx.fillRect(-s/2,-s/2,s,s);ctx.shadowBlur=0;ctx.fillStyle=L.colors[1];ctx.fillRect(-8,-8,16,16);ctx.strokeStyle=L.colors[0];ctx.lineWidth=3;ctx.strokeRect(-s/2+2,-s/2+2,s-4,s-4);ctx.fillStyle='#071126';ctx.fillRect(-10,-5,5,5);ctx.fillRect(5,-5,5,5);ctx.restore();if(p.mode==='ship'){ctx.strokeStyle=L.colors[0];ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+12,p.y+17);ctx.lineTo(x+46,p.y+17);ctx.stroke()}}
  function drawParticles(){for(const p of world.particles){ctx.globalAlpha=Math.max(0,p.life/.7);ctx.fillStyle=p.col;ctx.fillRect(p.x,p.y,p.size,p.size)}ctx.globalAlpha=1}

  function updateHUD(){const L=LEVELS[world.level];const pct=Math.max(0,Math.min(100,Math.floor(world.camera/L.length*100)));$('#progressFill').style.width=pct+'%';$('#progressText').textContent=pct+'%';$('#coinText').textContent=world.collected;$('#scoreText').textContent=world.score;$('#speedText').textContent=(L.speed).toFixed(1)+'×';}
  function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));$('#screen-'+id).classList.remove('hidden')}
  function showModal(id){$(id).classList.remove('hidden')};function hide(id){$(id).classList.add('hidden')}
  function togglePause(){if(!world.active)return;world.paused=!world.paused;$('#pause').classList.toggle('hidden',!world.paused)}
  function showResult(text){$('#resultText').textContent=text;showModal('#result')}
  function renderLevels(){const g=$('#levelGrid');g.innerHTML='';LEVELS.forEach((L,i)=>{const open=i<save.unlocked;const c=document.createElement('article');c.className='level-card'+(open?'':' locked');c.innerHTML=`<div><div class="level-num">${String(i+1).padStart(2,'0')}</div><h3>${L.name}</h3><p>${L.difficulty} • ${L.speed.toFixed(1)} velocidade</p></div><div><div class="meta">MELHOR ${save.best[i]||0}% • ◆ ${save.coins[i]||0}/4 • ★ ${save.wins[i]?'CONCLUÍDA':'-'}</div><button class="btn ${open?'btn-main':''}" ${open?'':'disabled'}>${open?'JOGAR':'BLOQUEADA'}</button></div>`;if(open)c.querySelector('button').onclick=()=>startLevel(i);g.appendChild(c)});$('#progressSummary').textContent=`${save.wins.filter(Boolean).length}/${LEVELS.length} concluídas • ★ ${save.stars}`}
  function startLevel(i){audioOn();buildLevel(i);show('game');beep(440,.05)}

  document.addEventListener('click',e=>{const a=e.target.closest('[data-action]')?.dataset.action;if(!a)return;audioOn();if(a==='play')startLevel(Math.min(save.unlocked-1,LEVELS.length-1));else if(a==='levels'){world.active=false;show('levels');renderLevels()}else if(a==='settings')show('settings');else if(a==='menu'){world.active=false;hide('#pause');hide('#result');show('menu')}else if(a==='pause')togglePause();else if(a==='resume')togglePause();else if(a==='restart')restart();else if(a==='reset'){localStorage.removeItem(SAVE_KEY);save.unlocked=1;save.best.fill(0);save.coins.fill(0);save.wins.fill(false);save.stars=0;renderLevels()}});
  $('#nextBtn').onclick=()=>{hide('#result');if(world.level+1<LEVELS.length)startLevel(world.level+1);else{show('levels');renderLevels()}};

  function loop(t){const dt=Math.min(.033,(t-(world.last||t))/1000);world.last=t;update(dt);draw();requestAnimationFrame(loop)}
  renderLevels();show('menu');requestAnimationFrame(loop);
})();
