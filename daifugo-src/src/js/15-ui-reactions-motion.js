// =====================================================================
// リアクション投げ
// =====================================================================
const THROW_ITEMS=["🍅","🥚","💩","🩴","👏","💐","❤️","🪙"];
let lastThrN=null, throwPop=null;
function processThrows(){
  const T=S&&S.thr; if(!T) return;
  if(lastThrN===null){ lastThrN=T.n; return; }
  if(T.n===lastThrN) return;
  const news=T.k.filter(x=>x.n>lastThrN); lastThrN=T.n;
  if(document.hidden) return;
  news.slice(-4).forEach((x,i)=>setTimeout(()=>throwFx(x),i*120));
}
function throwFx(x){
  const a=seatPoint(x.from), b=x.to===myId ? {x:innerWidth/2+(Math.random()*2-1)*60, y:innerHeight*.55} : seatPoint(x.to);
  const el=document.createElement("div"); el.className="thrown"; el.textContent=x.item; fxLayer.appendChild(el);
  const kf=[]; const dx=b.x-a.x, dy=b.y-a.y, hgt=Math.min(220,80+Math.hypot(dx,dy)*.35);
  for(let i=0;i<=8;i++){ const t=i/8; kf.push({transform:`translate(${a.x+dx*t}px,${a.y+dy*t-4*hgt*t*(1-t)}px) translate(-50%,-50%) rotate(${t*720}deg) scale(${x.to===myId?1+t*1.6:1})`}); }
  sfx("pop");
  anim(el,kf,{duration:560,easing:"linear",fill:"forwards"});
  setTimeout(()=>{ el.remove(); throwHit(x,b); },560);
}
function throwHit(x,b){
  const it=x.item, me=x.to===myId, seat=document.querySelector(`[data-seat="${CSS.escape(String(x.to))}"]`);
  const good=["👏","💐","❤️","🪙"].includes(it);
  if(good){
    sfx(it==="🪙"?"pop":"chat");
    burst(b.x,b.y,{n:14,emoji:it,size:me?11:8,dist:me?140:80,gravity:-20});
    if(it==="🪙") coinFountain(b.x,b.y,me?24:10);
    if(seat) anim(seat,[{scale:"1"},{scale:"1.15"},{scale:"1"}],{duration:320,easing:"ease-out"});
    return;
  }
  // 汚い系
  noise(.12,.2,0,900); vib(me?[40,20,60]:0);
  const col={"🍅":"#e3241b","🥚":"#ffd84a","💩":"#7a4a1e","🩴":"#ffffff"}[it]||"#fff";
  if(it==="🩴"){ if(seat) anim(seat,[{translate:"0 0",rotate:"0deg"},{translate:"14px 0",rotate:"12deg"},{translate:"-8px 0",rotate:"-6deg"},{translate:"0 0",rotate:"0deg"}],{duration:380}); burst(b.x,b.y,{n:12,emoji:"⭐",size:8,dist:70}); if(me) shake(true); return; }
  burst(b.x,b.y,{n:16,dist:me?130:60,size:me?10:6,colors:[col,col,"#fff"]});
  const sp=document.createElement("div"); sp.className="splat"+(me?" big":""); sp.style.setProperty("--c",col);
  sp.style.left=b.x+"px"; sp.style.top=b.y+"px"; fxLayer.appendChild(sp);
  anim(sp,[{transform:"translate(-50%,-50%) scale(.2) rotate(0deg)",opacity:1},{transform:"translate(-50%,-50%) scale(1.1) rotate(20deg)",opacity:1,offset:.08},{transform:"translate(-50%,-50%) scale(1) rotate(20deg)",opacity:1,offset:.15},{transform:"translate(-50%,-44%) scale(1) rotate(20deg)",opacity:1,offset:.75},{transform:"translate(-50%,-36%) scale(1) rotate(20deg)",opacity:0}],{duration:me?2200:1500,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>sp.remove(),me?2300:1600);
  if(it==="💩"){ for(let i=0;i<3;i++){ const f=document.createElement("div"); f.className="slfly"; f.textContent="🪰"; f.style.left=b.x+"px"; f.style.top=b.y+"px"; fxLayer.appendChild(f);
    const kf=[]; for(let j=0;j<=10;j++){ const a=j*(i%2?1:-1)*.9+i*2; kf.push({transform:`translate(${Math.cos(a)*36}px,${Math.sin(a)*24-10}px)`,opacity:j===10?0:1}); }
    anim(f,kf,{duration:1500,fill:"forwards"}); setTimeout(()=>f.remove(),1550); } }
  if(seat) anim(seat,[{translate:"0 0"},{translate:"0 6px"},{translate:"0 0"}],{duration:260});
}
function closeThrowPop(){ if(throwPop){ throwPop.remove(); throwPop=null; guard(layerSync,"layers"); } }
function openThrowPop(pid, el){
  closeThrowPop();
  const r=el.getBoundingClientRect(), x=Math.min(innerWidth-130,Math.max(130,r.left+r.width/2)), y=Math.min(innerHeight-140,r.bottom+6);
  const p=document.createElement("div"); p.className="throwpop"; p.style.left=x+"px"; p.style.top=y+"px";
  p.innerHTML=`<div class="tt">${esc(nameOf(S,pid))} に投げる</div>`+THROW_ITEMS.map(t=>`<button data-thr="${t}">${t}</button>`).join("");
  document.body.appendChild(p); throwPop=p; guard(layerSync,"layers");
  p.onclick=e=>{ const b=e.target.closest("[data-thr]"); if(!b) return; e.stopPropagation(); closeThrowPop(); act({t:"throw",to:pid,item:b.dataset.thr}); };
}
document.addEventListener("click",e=>{
  if(throwPop && !e.target.closest(".throwpop")){ if(!e.target.closest("[data-seat]")){ closeThrowPop(); return; } }
  if(!S || screen!=="room" || S.phase!=="play" || mode==="solo" && false) return;
  if(e.target.closest("button")) return;
  const seat=e.target.closest("[data-seat]"); if(!seat || !app.contains(seat)) return;
  const pid=seat.dataset.seat; if(!pid || pid===myId) return;
  if(!S.players.some(p=>p.id===myId)) return;
  openThrowPop(pid, seat.querySelector(".ava")||seat);
},true);

// =====================================================================
// 激アツ予告（保留変化 → 帯）
// =====================================================================
const YK=[{n:"青",c:"#2f8cff"},{n:"緑",c:"#2bd46a"},{n:"赤",c:"#ff2a3a"},{n:"金",c:"#ffd23a"},{n:"虹",c:"rainbow"}];
let yokokuBusy=0;
function yokoku(level, word, gase){
  const now=Date.now(); if(now<yokokuBusy) return 0; const dur=level>=3?1100:850; yokokuBusy=now+dur;
  const w=document.createElement("div"); w.className="yokoku lv"+level+(gase?" gase":"");
  const steps=Array.from({length:level+1},(_,i)=>i);
  w.innerHTML=`<div class="ybar"><div class="ytxt">${esc(word||(level>=4?"超激アツ":level>=3?"激アツ":level>=2?"チャンス":"予告"))}</div></div><div class="horyu"></div>`;
  fxLayer.appendChild(w);
  const hr=w.querySelector(".horyu"), bar=w.querySelector(".ybar");
  steps.forEach((s,i)=>setTimeout(()=>{ const y=YK[s]; hr.style.background = y.c==="rainbow" ? "conic-gradient(#ff2a3a,#ffd23a,#2bd46a,#2f8cff,#c04dff,#ff2a3a)" : `radial-gradient(circle at 35% 30%,#fff,${y.c} 45%,#000 120%)`; hr.style.boxShadow=`0 0 30px ${y.c==="rainbow"?"#fff":y.c}`;
    anim(hr,[{transform:"translate(-50%,-50%) scale(1.5)"},{transform:"translate(-50%,-50%) scale(1)"}],{duration:160}); tone(500+s*180,.12,"square",.05); },i*Math.min(160,dur*.5/steps.length)));
  anim(hr,[{opacity:0},{opacity:1,offset:.08},{opacity:1,offset:.5},{opacity:0,offset:.62},{opacity:0}],{duration:dur,fill:"forwards"});
  setTimeout(()=>{ if(!gase){ sfx(level>=3?"kyuin":"alarm"); vib(level>=3?[60,30,60]:20); if(level>=3) flash(level>=4?"#fff":"#ffd23a"); } },dur*.5);
  anim(bar,[{transform:"translateX(-120%) skewX(-12deg)",opacity:0},{transform:"translateX(-120%) skewX(-12deg)",opacity:0,offset:.5},{transform:"translateX(0) skewX(-12deg)",opacity:1,offset:.62},{transform:"translateX(0) skewX(-12deg)",opacity:1,offset:.9},{transform:"translateX(120%) skewX(-12deg)",opacity:0}],{duration:dur,easing:"ease-out",fill:"forwards"});
  if(gase){ setTimeout(()=>{ const t=w.querySelector(".ytxt"); if(t){ t.textContent="……"; } },dur*.72); }
  setTimeout(()=>w.remove(),dur+50);
  return gase ? 0 : dur;
}
// fxの束を見て、予告するか決める（戻り値: 本編を遅らせるms）
function yokokuFor(list){
  if(fxLevel===0) return 0;
  let lv=-1;
  for(const e of list){
    if(e.k==="rev"||e.k==="bomb") lv=Math.max(lv,3);
    else if(e.k==="finish" && e.place===1 && e.game!=="baba") lv=Math.max(lv,4);
    else if(e.k==="end") lv=Math.max(lv,e.king===myId?4:3);
    else if(e.k==="miyako"||e.k==="foul") lv=Math.max(lv,2);
    else if(e.k==="eight"||e.k==="lock"||e.k==="stair") lv=Math.max(lv,1);
    else if(e.k==="udraw" && e.total>=4) lv=Math.max(lv,e.total>=8?4:2);
    else if(e.k==="uno") lv=Math.max(lv,1);
    else if(e.k==="kmatch" && e.combo>=2) lv=Math.max(lv,e.combo>=3?3:1);
    else if(e.k==="bdraw" && e.priv && parse(e.priv.card).r===16) lv=Math.max(lv,3);
  }
  if(lv<0){
    // たまにガセ予告
    if(list.some(e=>["play","uplay","kflip","bdraw"].includes(e.k)) && Math.random()<(fxLevel===2?.07:.03)){ yokoku(Math.random()<.7?0:1,null,true); }
    return 0;
  }
  if(lv<=1 && fxLevel<2) return 0;
  return yokoku(lv) * .55;
}

// =====================================================================
// 動きを足す：手番の玉移動・席のジャンプ・スポットライト
// =====================================================================
let orbTurn=null;
function turnOrb(){
  if(!S || S.phase!=="play"){ orbTurn=null; return; }
  if(S.turn===orbTurn) return;
  const prev=orbTurn; orbTurn=S.turn;
  if(!prev || fxLevel===0 || document.hidden) return;
  const a=seatPoint(prev), b=seatPoint(S.turn);
  if(Math.hypot(b.x-a.x,b.y-a.y)<20) return;
  const o=document.createElement("div"); o.className="torb"+(S.turn===myId?" me":""); fxLayer.appendChild(o);
  const kf=[]; for(let i=0;i<=6;i++){ const t=i/6; kf.push({transform:`translate(${a.x+(b.x-a.x)*t}px,${a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*60}px) translate(-50%,-50%) scale(${1+Math.sin(t*Math.PI)*.6})`}); }
  anim(o,kf,{duration:420,easing:"ease-in-out",fill:"forwards"});
  setTimeout(()=>{ o.remove(); ring(b.x,b.y,S&&S.turn===myId?"#ffd23a":"#7cf0ff",S&&S.turn===myId?220:120); },420);
}
function seatHop(pid, sag){
  const el = pid===myId ? document.getElementById("mebar") : document.querySelector(`[data-seat="${CSS.escape(String(pid))}"] .avawrap`);
  if(!el) return;
  anim(el, sag ? [{translate:"0 0"},{translate:"0 7px",scale:"1 .93"},{translate:"0 0"}] : [{translate:"0 0"},{translate:"0 -16px",scale:"1.08"},{translate:"0 2px",scale:"1.02 .96"},{translate:"0 0"}],{duration:sag?420:380,easing:"ease-out"});
}
function fieldPunch(){
  const f=document.querySelector(".field"); if(!f || fxLevel===0) return;
  anim(f,[{scale:"1"},{scale:"1.05"},{scale:"1"}],{duration:260,easing:"ease-out"});
}

