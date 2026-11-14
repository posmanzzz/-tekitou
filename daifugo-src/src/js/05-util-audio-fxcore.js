// =====================================================================
// ユーティリティ
// =====================================================================
const esc = t => String(t).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function hash(str){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<str.length;i++){const ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return (h2>>>0).toString(16).padStart(8,"0")+(h1>>>0).toString(16).padStart(8,"0");}
const normPass = p => p.normalize("NFKC").trim().toLowerCase();
const rid = () => Math.random().toString(36).slice(2,10);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let toastT; function toast(m){const t=document.getElementById("toast");t.textContent=m;t.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("on"),2400);}
const store = {get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const sstore = {get(k){try{return sessionStorage.getItem(k)}catch(e){return null}}, set(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}};
const clone = o => JSON.parse(JSON.stringify(o));

window.__dfg={bActive,bNext,bDraw,bPeek,kFlip,babaBot,shinkeiBot,parse,uCanPlay,uPlay,uDraw,uPass,uSeven,uCallUno,unoBot,unoStartRound,pU,nextRank,analyze,canPlay,doPlay,doPass,startRound,botMove,blankRoom,applyAction,viewFor,activeOf,effRev,DEFAULT_RULES,PRESETS,normState,cleanName,safeText,botStep,autoTurn,ID_OK,engineErrors:()=>engErr,engineLast:()=>engLast};
if(window.__DFG_TEST__) return;

// =====================================================================
// 演出
// =====================================================================
const app=document.getElementById("app");
const fxLayer=document.getElementById("fx");
const VOLS=[0,.45,1,1.7];       // 設定の「効果音」: オフ / 小 / 中（これまでの音量） / 大
let volLv = (()=>{ const v=store.get("dfg_vol"); if(v!==null && /^[0-3]$/.test(v)) return +v; return store.get("dfg_snd")==="0"?0:2; })();
let actx=null, soundOn = volLv>0, vibOn = store.get("dfg_vib")!=="0";
function ensureAudio(){
  if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ actx=null; } }
  if(actx && actx.state==="suspended") actx.resume().catch(()=>{});
}
document.addEventListener("pointerdown", ensureAudio);
function tone(f,dur,type="sine",vol=.12,when=0,to){
  if(!soundOn||!actx) return;
  const t=actx.currentTime+when, o=actx.createOscillator(), g=actx.createGain();
  o.type=type; o.frequency.setValueAtTime(f,t); if(to) o.frequency.exponentialRampToValueAtTime(to,t+dur);
  g.gain.setValueAtTime(vol*VOLS[volLv],t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t+dur+.02);
}
function noise(dur,vol=.15,when=0,hp=800){
  if(!soundOn||!actx) return;
  const t=actx.currentTime+when, len=Math.floor(actx.sampleRate*dur), b=actx.createBuffer(1,len,actx.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
  const src=actx.createBufferSource(), g=actx.createGain(), f=actx.createBiquadFilter();
  f.type="highpass"; f.frequency.value=hp; src.buffer=b; g.gain.value=vol*VOLS[volLv];
  src.connect(f).connect(g).connect(actx.destination); src.start(t);
}
function sfx(k){
  switch(k){
    case "tap": tone(900,.04,"triangle",.05); break;
    case "play": noise(.08,.2,0,1500); tone(180,.12,"sine",.12); break;
    case "pass": tone(330,.1,"triangle",.07); tone(250,.12,"triangle",.06,.08); break;
    case "clear": noise(.3,.08,0,3000); break;
    case "rev": tone(110,.7,"sawtooth",.1,0,55); tone(880,.5,"square",.04,.05,220); noise(.4,.12,0,200); break;
    case "eight": noise(.18,.25,0,4000); tone(1400,.18,"sawtooth",.05,0,300); break;
    case "eb": tone(600,.25,"square",.05,0,300); break;
    case "lock": tone(200,.06,"square",.1); tone(200,.06,"square",.1,.09); break;
    case "skip": tone(500,.06,"triangle",.07); tone(750,.06,"triangle",.07,.07); tone(1000,.08,"triangle",.07,.14); break;
    case "finish": [523,659,784,1047].forEach((f,i)=>tone(f,.25,"triangle",.09,i*.09)); break;
    case "foul": tone(220,.4,"sawtooth",.08,0,110); break;
    case "miyako": [392,330,262,196].forEach((f,i)=>tone(f,.3,"square",.05,i*.12)); break;
    case "turn": tone(1047,.12,"sine",.1); tone(1568,.18,"sine",.08,.1); break;
    case "deal": for(let i=0;i<6;i++) noise(.04,.1,i*.05,2500); break;
    case "chat": tone(1200,.06,"sine",.06); tone(1600,.08,"sine",.05,.06); break;
    case "seven": [700,900].forEach((f,i)=>tone(f,.12,"triangle",.08,i*.08)); break;
    case "bomb": noise(.6,.3,0,80); tone(90,.6,"sawtooth",.12,0,40); break;
    case "fanfare": [[523,0],[659,.12],[784,.24],[1047,.36],[784,.52],[1047,.62],[1319,.74]].forEach(([f,t])=>{ tone(f,.32,"square",.05,t); tone(f/2,.32,"triangle",.06,t); }); break;
    case "kyuin": tone(600,.7,"sawtooth",.07,0,3800); tone(1200,.7,"square",.035,.05,5200); tone(2400,.5,"sine",.05,.25,4800); break;
    case "alarm": for(let i=0;i<4;i++){ tone(i%2?660:990,.13,"square",.06,i*.15); } break;
    case "don": tone(110,.25,"square",.12,0,55); tone(220,.18,"sawtooth",.06); noise(.12,.18,0,300); break;
    case "thud": tone(70,.35,"sine",.25,0,40); noise(.15,.25,0,600); break;
    case "pop": noise(.12,.12,0,2000); tone(900+Math.random()*600,.15,"sine",.05); break;
    case "tick": tone(1500,.05,"square",.05); break;
    case "win": [523,659,784,1047,784,1047,1319].forEach((f,i)=>tone(f,.3,"triangle",.09,i*.1)); break;
  }
}
// ---- バナー（溜まりすぎたら古いのは捨てる） ----
let bannerQ=Promise.resolve(), bannerPending=0;
function banner(text, cls, small, prio){
  if(bannerPending>=2 && !prio) return;
  bannerPending++;
  bannerQ = bannerQ.then(()=>new Promise(res=>{
    const b=document.createElement("div"); b.className=`banner ${cls||""} ${small?"small":""}`; b.textContent=text;
    fxLayer.appendChild(b); setTimeout(()=>b.remove(),1450); setTimeout(()=>{ bannerPending--; res(); }, bannerPending>2?300:600);
  }));
}
function flash(color){ if(fxLevel===0) return; const f=document.createElement("div"); f.className="flash"; if(color) f.style.background=color; fxLayer.appendChild(f); setTimeout(()=>f.remove(),500); }
function shake(strong){ if(fxLevel===0) return; const a=document.getElementById("app"); a.classList.remove("shake","shake2"); void a.offsetWidth; a.classList.add(strong?"shake2":"shake"); }
// =====================================================================
// 軽量化：パーティクルは1枚のcanvasで描く（DOM要素を大量に作らない）
// =====================================================================
const PFX=(()=>{
  const cv=document.createElement("canvas"); cv.id="pfx";
  document.body.appendChild(cv);
  const ctx=cv.getContext("2d");
  let W=0,H=0,DPR=1; const parts=[]; let running=false, last=0;
  const MAX=700;
  let quality=1, ftAvg=16;            // 重い端末では自動で粒を減らす
  let onAdd=null;                       // 品質ガバナーの測定開始フック
  let tierDpr=1.25;                   // 品質ガバナーが重いと判断したら 1 に下げる
  // 粒が無い間は canvas を畳む（全画面レイヤー1枚＋バッキングストア分のGPUメモリを待機中ずっと握らない）
  let sized=true, freeT=0;
  function resize(){ if(!sized) return; DPR=Math.min(window.devicePixelRatio||1,tierDpr); W=innerWidth; H=innerHeight; cv.width=Math.round(W*DPR); cv.height=Math.round(H*DPR); cv.style.width=W+"px"; cv.style.height=H+"px"; }
  function ensure(){ clearTimeout(freeT); if(!sized){ sized=true; cv.style.display=""; resize(); } }
  function release(){ clearTimeout(freeT); freeT=setTimeout(()=>{ if(!running && !parts.length){ sized=false; cv.width=cv.height=1; cv.style.display="none"; } },2500); }
  resize(); addEventListener("resize",resize); release();
  const sprites={};
  function sprite(e){
    if(sprites[e]) return sprites[e];
    const s=document.createElement("canvas"), N=48; s.width=s.height=N;
    const g=s.getContext("2d"); g.font=`${N*.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign="center"; g.textBaseline="middle"; g.fillText(e,N/2,N/2+N*.04);
    return sprites[e]=s;
  }
  function add(p){
    if(parts.length>=MAX) return;
    p.t=0; p.rot=p.rot||0; p.vr=p.vr||0; p.g=p.g??600; p.drag=p.drag??0.995;
    if(p.kind==="ring"){ p.vx=p.vy=0; p.g=0; p.fadeFrom=0; }
    if(p.emoji) p.img=sprite(p.emoji);
    ensure(); parts.push(p); if(onAdd) onAdd();
    if(!running){ running=true; last=performance.now(); requestAnimationFrame(loop); }
  }
  let lastFrameAt=0;
  function loop(now){
    lastFrameAt=performance.now();
    try{ step(now); }
    catch(e){ parts.length=0; ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height); running=false; release(); return; }   // 何があっても固まらない
  }
  // 万一ループが止まっていたら再開する（裏タブ明けなど）
  setInterval(()=>{ if(running && !document.hidden && performance.now()-lastFrameAt>600){ last=performance.now(); requestAnimationFrame(loop); } },700);
  function step(now){
    // rAFの時刻は追加した瞬間より前のことがある → 経過時間は0以上に丸める（マイナスだと輪の半径が負になってエラー）
    const dtMs=Math.max(0, Math.min(50, now-last)); last=Math.max(last, now); const dt=dtMs/1000;
    ftAvg=ftAvg*.9+dtMs*.1;
    if(ftAvg>26) quality=Math.max(.3,quality*.97); else if(ftAvg<19) quality=Math.min(1,quality*1.01);
    ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height);
    let n=0;
    for(let i=0;i<parts.length;i++){
      const p=parts[i];
      if(p.delay>0){ p.delay-=dt; parts[n++]=p; continue; }
      p.t+=dt;
      if(p.t>=p.life || p.y>H+80) continue;
      parts[n++]=p;
      p.vx*=p.drag; p.vy=p.vy*p.drag+p.g*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt;
      const k=p.t/p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, k>p.fadeFrom ? (1-k)/(1-p.fadeFrom) : 1));
      const sz=p.size*(p.shrink?(1-k*.7):1);
      if(p.kind==="ring"){
        const r=Math.max(0.1, p.r0+(p.r1-p.r0)*(1-Math.pow(1-Math.max(0,k),3)));
        ctx.globalAlpha=Math.max(0,Math.min(1,1-k)); ctx.setTransform(DPR,0,0,DPR,0,0);
        ctx.strokeStyle=p.color; ctx.lineWidth=p.w*(1-k*.6); ctx.beginPath(); ctx.arc(p.x,p.y,r,0,6.283); ctx.stroke();
        continue;
      }
      if(p.img){
        const c=Math.cos(p.rot)*DPR, s2=Math.sin(p.rot)*DPR;
        ctx.setTransform(c,s2,-s2,c,p.x*DPR,p.y*DPR); ctx.drawImage(p.img,-sz/2,-sz/2,sz,sz);
      } else if(p.kind==="rect"){
        const c=Math.cos(p.rot)*DPR, s2=Math.sin(p.rot)*DPR;
        ctx.setTransform(c,s2,-s2,c,p.x*DPR,p.y*DPR); ctx.fillStyle=p.color;
        const h=sz*1.4*Math.abs(Math.cos(p.t*p.flip)); ctx.fillRect(-sz/2,-h/2,sz,h);
      } else {
        ctx.setTransform(DPR,0,0,DPR,p.x*DPR,p.y*DPR); ctx.fillStyle=p.color; ctx.fillRect(-sz/2,-sz/2,sz,sz);
      }
    }
    parts.length=n;
    ctx.globalAlpha=1; ctx.setTransform(1,0,0,1,0,0);
    if(n) requestAnimationFrame(loop); else { running=false; ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height); release(); }
  }
  return {add, count:()=>parts.length, q:()=>quality, setDpr(d){ if(d!==tierDpr){ tierDpr=d; resize(); } }, hook(f){ onAdd=f; }};
})();

// =====================================================================
// 品質ガバナー：演出中の実フレーム時間を測り、ずっと重い端末だけ装飾を自動で軽くする。
//   tier0 = 何も減らさない（60fpsを保てる端末はここのまま） / tier1 = 粒数×.6・canvas等倍・光彩を軽く / tier2 = 粒数×.35・光線やスモーク等の装飾を省く
//   演出レベル(fxLevel)はユーザー設定のまま。漢字・カットイン・上がり演出などは必ず再生される（body.q1 / body.q2 のCSSで装飾だけを軽くする）。
//   測るのは演出が動いている間だけ（#fx に要素があるか粒がある間）。何も動いていない時は rAF を回さない。
//   45fps未満が約1.5秒続いたら1段階下げ、55fps以上が約6秒続いたら1段階戻す。localStorage dfg_qg = off / 1 / 2 で固定できる（テスト用）。
// =====================================================================
const QG=(()=>{
  const forced=store.get("dfg_qg");
  let tier=forced==="1"?1:forced==="2"?2:0; const off=forced==="off"||forced==="1"||forced==="2";
  let run=false, last=0, buf=[], sum=0, slowMs=0, fastMs=0, idleSince=0, changes=[];
  const F=[1,.6,.35];
  function apply(){
    document.body.classList.toggle("q1",tier>=1); document.body.classList.toggle("q2",tier>=2);
    PFX.setDpr(tier>=1?1:1.25);
  }
  function busy(){ return fxLayer.childElementCount>0 || PFX.count()>0; }
  function frame(t){
    if(!run) return;
    const dt=t-last; last=t;
    if(dt>0 && dt<250 && !document.hidden){
      buf.push(dt); sum+=dt; if(buf.length>40) sum-=buf.shift();
      if(buf.length>=30){
        const avg=sum/buf.length;
        if(avg>22.2){ slowMs+=dt; fastMs=0; } else if(avg<18.2){ fastMs+=dt; slowMs=Math.max(0,slowMs-dt); } else slowMs=Math.max(0,slowMs-dt);
        if(slowMs>1500 && tier<2){ tier++; slowMs=0; fastMs=0; buf.length=0; sum=0; changes.push([Math.round(t),tier]); apply(); }
        else if(fastMs>6000 && tier>0){ tier--; slowMs=0; fastMs=0; buf.length=0; sum=0; changes.push([Math.round(t),tier]); apply(); }
      }
    } else { buf.length=0; sum=0; }                    // タブが裏に回った等の長い間隔は捨てる
    if(busy()) idleSince=0; else if(!idleSince) idleSince=t;
    if(idleSince && t-idleSince>1500){ run=false; buf.length=0; sum=0; return; }
    requestAnimationFrame(frame);
  }
  // 演出が始まった合図（anim / PFX.add から呼ぶ）。動いていなければ測定を始める
  function kick(){ if(off||run) return; run=true; last=performance.now(); idleSince=0; requestAnimationFrame(frame); }
  if(tier) apply();
  PFX.hook(kick);
  return {kick, running:()=>run, tier:()=>tier, f:()=>F[tier], changes:()=>changes.slice(), set(t){ tier=t; apply(); }};
})();
const Q = n => Math.max(1, Math.round(n*PFX.q()*QG.f()));

function confetti(n=60){
  if(fxLevel===0) n=Math.min(n,20); else if(dopa()) n=Math.round(n*1.5);
  const cols=["#f2c14e","#ff5c8a","#7fd6ff","#7ff0b0","#d48bff","#fff"];
  n=Q(n); for(let i=0;i<n;i++) PFX.add({kind:"rect",x:Math.random()*innerWidth,y:-20-Math.random()*60,vx:(Math.random()*2-1)*60,vy:80+Math.random()*120,g:140,drag:.99,size:8+Math.random()*5,color:cols[i%cols.length],rot:Math.random()*6,vr:(Math.random()*2-1)*8,flip:4+Math.random()*6,life:2.2+Math.random()*1.4,fadeFrom:.8,delay:Math.random()*.4});
}
function burst(x,y,opt={}){
  const n=Q(opt.n||18), cols=opt.colors||["#ffd54a","#fff","#ff8a3d"], dist=opt.dist||90, size=opt.size||8;
  const life=(opt.dur||700)/1000;
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2, sp=dist*(.6+Math.random()*.9)/life*1.6;
    PFX.add({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:(opt.gravity??30)*3,drag:.93,size:opt.emoji?size*2.6:size*(.6+Math.random()*.8),color:cols[i%cols.length],emoji:opt.emoji,rot:Math.random()*6,vr:(Math.random()*2-1)*6,life:life*(.7+Math.random()*.6),fadeFrom:.4,shrink:!opt.emoji});
  }
}
function fireworks(times=5){
  if(fxLevel===0) return; if(dopa()) times=Math.round(times*1.6);
  for(let i=0;i<times;i++) setTimeout(()=>{
    const x=innerWidth*(.15+Math.random()*.7), y=innerHeight*(.15+Math.random()*.35);
    const pal=[["#ffd54a","#fff3b0"],["#ff5c8a","#ffc2d4"],["#7fd6ff","#d4f2ff"],["#7ff0b0","#d8ffe9"]][i%4];
    burst(x,y,{n:26,colors:pal,dist:130,size:5,gravity:40,dur:1000}); ring(x,y,pal[0],200); sfx("pop");
  }, i*260);
}
function rain(emojis, n=40, dur=2800){
  n=Q(n); for(let i=0;i<n;i++) PFX.add({emoji:emojis[i%emojis.length],x:Math.random()*innerWidth,y:-40,vx:(Math.random()*2-1)*30,vy:120+Math.random()*160,g:260,drag:.995,size:22+Math.random()*24,rot:Math.random()*6,vr:(Math.random()*2-1)*5,life:dur/1000*1.4,fadeFrom:.9,delay:Math.random()*.8});
}
function coinFountain(x,y,n=24){
  if(!dopa()) return;
  n=Q(n); for(let i=0;i<n;i++) PFX.add({emoji:i%5?"🪙":"💎",x,y,vx:(Math.random()*2-1)*260,vy:-(420+Math.random()*420),g:1100,drag:.995,size:18+Math.random()*16,rot:Math.random()*6,vr:(Math.random()*2-1)*10,life:1.8,fadeFrom:.75});
}
// 画面全体の効果は transform / opacity だけで作る（フィルターは使わない）
function overlay(cls, kf, ms){
  const o=document.createElement("div"); o.className="ov "+cls; fxLayer.appendChild(o);
  anim(o,kf,{duration:ms,fill:"forwards",easing:"ease-out"}); setTimeout(()=>o.remove(),ms+30); return o;
}
function hitStop(k=1){
  if(!dopa()) return;
  anim(document.getElementById("app"),[{transform:"scale(1)"},{transform:`scale(${1+.035*k})`,offset:.25},{transform:`scale(${1+.035*k})`,offset:.55},{transform:"scale(1)"}],{duration:260});
  overlay("ov-white",[{opacity:0},{opacity:.35,offset:.25},{opacity:0}],260);
}
function rgbSplit(ms=380){
  if(!dopa()) return;
  overlay("ov-rgb",[{opacity:0,transform:"translateX(0)"},{opacity:.3,transform:"translateX(8px)",offset:.25},{opacity:.22,transform:"translateX(-6px)",offset:.6},{opacity:0,transform:"translateX(0)"}],ms);
}
function rainbowStrobe(ms=1400){
  if(!dopa()) return;
  const steps=[]; const n=Math.max(4,Math.round(ms/120));
  for(let i=0;i<=n;i++) steps.push({opacity:i===0||i===n?0:(i%2?.32:.12)});
  overlay("ov-rainbow",steps,ms);
}
function revFlip(){
  anim(document.getElementById("app"),[{transform:"perspective(900px) rotateX(0)"},{transform:"perspective(900px) rotateX(180deg) scale(.9)",offset:.5},{transform:"perspective(900px) rotateX(360deg)"}],{duration:900,easing:"cubic-bezier(.6,0,.4,1)"});
  overlay("ov-mag",[{opacity:0},{opacity:.5,offset:.45},{opacity:0}],900);
}
function darkPulse(){ overlay("ov-dark",[{opacity:0},{opacity:.65,offset:.2},{opacity:.65,offset:.75},{opacity:0}],1600); }
function rays(color="rgba(255,214,90,.55)", dur=2600){
  const r=document.createElement("div"); r.className="rays"; r.style.setProperty("--rc",color); fxLayer.appendChild(r);
  anim(r,[{opacity:0,transform:"rotate(0) scale(.8)"},{opacity:1,offset:.15},{opacity:1,offset:.75},{opacity:0,transform:"rotate(25deg) scale(1.1)"}],{duration:dur,easing:"linear",fill:"forwards"});
  setTimeout(()=>r.remove(),dur+50);
}
function ring(x,y,color="#fff",size=160){
  PFX.add({kind:"ring",x,y,r0:4,r1:size/2,w:4,color,life:.55});
}
function shockwave(color="#fff"){
  const p=fieldPoint();
  PFX.add({kind:"ring",x:p.x,y:p.y,r0:6,r1:Math.hypot(innerWidth,innerHeight),w:14,color,life:.8});
}

function vib(p){ if(!vibOn) return; try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} }
const anim = (el,kf,opt) => { QG.kick(); try{ return el.animate(kf,opt); }catch(e){ return null; } };

// 位置ヘルパ
function centerOf(el){ const r=el.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }
function seatPoint(pid){
  const el = pid===myId ? document.getElementById("hand") || document.getElementById("mebar") : document.querySelector(`[data-seat="${CSS.escape(pid)}"] .ava`);
  if(el) return centerOf(el);
  return {x:innerWidth/2, y:pid===myId?innerHeight-80:80};
}
function fieldPoint(){ const f=document.querySelector(".field"); return f?centerOf(f):{x:innerWidth/2,y:innerHeight*.48}; }

// パーティクル
function floatText(pid,text,cls=""){
  const p=seatPoint(pid), t=document.createElement("div"); t.className="floattxt "+cls; t.textContent=text;
  t.style.left=p.x+"px"; t.style.top=(p.y-20)+"px"; fxLayer.appendChild(t);
  anim(t,[{transform:"translate(-50%,0) scale(.6)",opacity:0},{transform:"translate(-50%,-14px) scale(1.1)",opacity:1,offset:.2},{transform:"translate(-50%,-40px) scale(1)",opacity:0}],{duration:1200,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>t.remove(),1250);
}
// 場にカードが飛んでくる（場が残っていれば実物、流れていればゴースト）
function flyCardsToField(by, cards, thenFn){
  const from=seatPoint(by), to=fieldPoint();
  const real=[...document.querySelectorAll(".fieldcards .card")];
  if(real.length && S.field && S.field.by===by){
    real.forEach((c,i)=>{ const cc=centerOf(c);
      anim(c,[{transform:`translate(${from.x-cc.x}px,${from.y-cc.y}px) scale(.35) rotate(${-40+i*15}deg)`,opacity:.4},{transform:"none",opacity:1}],{duration:380,delay:i*45,easing:"cubic-bezier(.2,1.25,.4,1)",fill:"backwards"});
    });
    setTimeout(()=>thenFn&&thenFn(to), 380+real.length*45);
    return;
  }
  // ゴースト（8切りなどで場が即流れた時）
  const g=document.createElement("div"); g.className="fxghost"; g.innerHTML=cards.map(c=>cardEl(c)).join("");
  g.style.left=to.x+"px"; g.style.top=to.y+"px"; fxLayer.appendChild(g);
  const gc=centerOf(g);
  anim(g,[{transform:`translate(calc(-50% + ${from.x-gc.x}px),calc(-50% + ${from.y-gc.y}px)) scale(.35) rotate(-30deg)`,opacity:.4},{transform:"translate(-50%,-50%)",opacity:1}],{duration:380,easing:"cubic-bezier(.2,1.25,.4,1)",fill:"forwards"});
  setTimeout(()=>{ thenFn&&thenFn(to,g); }, 400);
  setTimeout(()=>g.remove(), 1600);
}
// 流れた場のカードを掃き出す
let prevField=null;   // {html, rect}
function sweepField(dir=1){
  if(!prevField) return;
  const g=document.createElement("div"); g.className="fxghost"; g.innerHTML=prevField.html;
  g.style.left=(prevField.rect.left+prevField.rect.width/2)+"px"; g.style.top=(prevField.rect.top+prevField.rect.height/2)+"px";
  fxLayer.appendChild(g);
  anim(g,[{transform:"translate(-50%,-50%)",opacity:1},{transform:`translate(calc(-50% + ${dir*innerWidth*.8}px),-80%) rotate(${dir*35}deg) scale(.7)`,opacity:0}],{duration:520,easing:"cubic-bezier(.5,0,.9,.5)",fill:"forwards"});
  setTimeout(()=>g.remove(),560);
  prevField=null;
}
function slashGhost(g){
  const fld=document.querySelector(".field"); const s=document.createElement("div"); s.className="slash";
  (fld||fxLayer).appendChild(s); setTimeout(()=>s.remove(),500);
  if(g) setTimeout(()=>{ [...g.children].forEach((c,i)=>{ anim(c,[{transform:"none",opacity:1},{transform:`translate(${i%2?60:-60}px,${i%2?-40:40}px) rotate(${i%2?25:-25}deg)`,opacity:0}],{duration:450,easing:"ease-out",fill:"forwards"}); }); },180);
}
function boom(){
  const p=fieldPoint();
  const b=document.createElement("div"); b.className="boom"; b.textContent="💥"; b.style.left=p.x+"px"; b.style.top=p.y+"px"; fxLayer.appendChild(b);
  anim(b,[{transform:"translate(-50%,-50%) scale(.2)",opacity:1},{transform:"translate(-50%,-50%) scale(3.2)",opacity:1,offset:.35},{transform:"translate(-50%,-50%) scale(4)",opacity:0}],{duration:900,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>b.remove(),950);
  burst(p.x,p.y,{n:30,colors:["#ff6a3d","#ffd54a","#444","#fff"],dist:180,size:10,gravity:60,dur:900});
  ring(p.x,p.y,"#ff6a3d",320);
}
function passFlyBacks(from,to,n){
  const a=seatPoint(from), b=seatPoint(to);
  for(let i=0;i<Math.min(n,4);i++){
    const c=document.createElement("div"); c.className="flyback"; c.style.left=a.x+"px"; c.style.top=a.y+"px"; fxLayer.appendChild(c);
    anim(c,[{transform:"translate(-50%,-50%) rotate(0)",opacity:1},{transform:`translate(calc(-50% + ${(b.x-a.x)/2}px),calc(-50% + ${(b.y-a.y)/2-60}px)) rotate(180deg) scale(1.3)`,offset:.5},{transform:`translate(calc(-50% + ${b.x-a.x}px),calc(-50% + ${b.y-a.y}px)) rotate(360deg)`,opacity:1}],{duration:700,delay:i*110,easing:"ease-in-out",fill:"both"});
    setTimeout(()=>c.remove(),800+i*110);
  }
}
// 自分の番の演出
function myTurnFx(){
  sfx("turn"); vib([30,40,30]);
  banner("あなたの番！","myturn",false,true);
  if(dopa() && S){ const hs=(S.hands[myId]||[]).map(c=>parse(c).r), strong=hs.filter(r=>r>=14).length; if(strong>=3) kanji("好機","gold",100,.32); }
  if(dopa()){ const h=document.getElementById("hand"); if(h){ const r=h.getBoundingClientRect(); burst(r.left+r.width/2,r.top+20,{n:16,emoji:"✨",size:6,dist:120,gravity:-10}); } }
  const cards=[...document.querySelectorAll("#hand .card:not(.dim)")];
  cards.forEach((c,i)=>anim(c,[{translate:"0 0"},{translate:"0 -16px"},{translate:"0 0"}],{duration:380,delay:i*35,easing:"ease-out"}));
}

