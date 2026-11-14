// ---- 全画面カットイン（漫画の集中線＋斜めの帯） ----
// ===== ドパガキ演出（演出レベル2で全開） =====
// 演出レベル：一度も選んだことがなければ、OSが「視差効果を減らす」設定なら 0（控えめ）、そうでなければ 2（ドパガキ）
const fxDefault = (()=>{ try{ return matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 2; }catch(e){ return 2; } })();
let fxLevel = +(store.get("dfg_fxlv") ?? fxDefault); if(![0,1,2].includes(fxLevel)) fxLevel=fxDefault;
const FX_NAMES=["控えめ","ふつう","ドパガキ"];
const dopa = () => fxLevel>=2;
let comboN=0;
// マンガの擬音
function onoma(text, x, y, color="#fff", size=54, rot){
  return;   // 擬音は無し
  const t=document.createElement("div"); t.className="onoma"; t.textContent=text;
  t.style.cssText=`left:${x}px;top:${y}px;color:${color};font-size:${size}px`;
  const r=rot ?? (Math.random()*30-15);
  fxLayer.appendChild(t);
  anim(t,[{transform:`translate(-50%,-50%) rotate(${r}deg) scale(3)`,opacity:0},{transform:`translate(-50%,-50%) rotate(${r}deg) scale(.9)`,opacity:1,offset:.18},{transform:`translate(-50%,-50%) rotate(${r}deg) scale(1.05)`,offset:.3},{transform:`translate(-50%,-60%) rotate(${r}deg) scale(1)`,opacity:1,offset:.75},{transform:`translate(-50%,-80%) rotate(${r}deg) scale(1.2)`,opacity:0}],{duration:1000,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>t.remove(),1050);
}
// ヒットストップ（一瞬ズームして止まる）
// RGBずれ
// 虹色ストロボ
// 「確定」スタンプ
function stamp(text="確定", color="#e8102a"){
  if(!dopa()) return;
  const s=document.createElement("div"); s.className="stamp"; s.textContent=text; s.style.color=color; s.style.borderColor=color;
  s.style.fontSize=Math.min(92, Math.floor(Math.min(innerWidth,560)*.62/[...text].length))+"px";
  fxLayer.appendChild(s);
  anim(s,[{transform:"translate(-50%,-50%) rotate(-18deg) scale(4)",opacity:0},{transform:"translate(-50%,-50%) rotate(-18deg) scale(.92)",opacity:1,offset:.22},{transform:"translate(-50%,-50%) rotate(-18deg) scale(1)",opacity:1,offset:.3},{transform:"translate(-50%,-50%) rotate(-18deg) scale(1)",opacity:1,offset:.8},{transform:"translate(-50%,-50%) rotate(-18deg) scale(1.1)",opacity:0}],{duration:1600,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>{ sfx("kyuin"); shake(true); vib([30,20,30,20,30]); },300);
  setTimeout(()=>s.remove(),1650);
}
// 褒めテキスト
function praise(text, big){
  if(!dopa()) return;
  const p=fieldPoint(), t=document.createElement("div"); t.className="praise"+(big?" big":""); t.textContent=text;
  t.style.left=p.x+"px"; t.style.top=(p.y-70)+"px"; fxLayer.appendChild(t);
  anim(t,[{transform:"translate(-50%,-50%) scale(.2) rotate(-8deg)",opacity:0},{transform:"translate(-50%,-50%) scale(1.25) rotate(4deg)",opacity:1,offset:.2},{transform:"translate(-50%,-50%) scale(1) rotate(-2deg)",offset:.35},{transform:"translate(-50%,-70%) scale(1)",opacity:1,offset:.8},{transform:"translate(-50%,-100%) scale(.9)",opacity:0}],{duration:1200,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>t.remove(),1250);
}
// 赤い警告枠（リーチ）
function alarmFrame(ms=1800){
  if(fxLevel<1) return;
  const f=document.createElement("div"); f.className="alarm"; fxLayer.appendChild(f); setTimeout(()=>f.remove(),ms);
}
// コイン噴水
function playDopa(e){
  if(!e.cards) return;
  const p=fieldPoint(), rs=e.cards.map(c=>parse(c).r), n=e.cards.length;
  const joker=rs.includes(16), two=rs.includes(15) && !effRev(S||{}), mine=e.id===myId;
  comboN++;
  setTimeout(()=>{
    // 擬音
    if(joker) kanji("超激熱","rainbow");
    else if(n>=4) kanji("激熱","red");
    else if(two || n>=3) kanji("熱","red",130,.28);
    if(joker){ hitStop(2); rgbSplit(); rainbowStrobe(1100); cutin("joker","🃏 JOKER降臨","最強のカードが出た！",1100); coinFountain(p.x,p.y,30); }
    else if(two || n>=3){ hitStop(1.4); rgbSplit(300); coinFountain(p.x,p.y,n>=3?20:14); }
    if(mine){
      if(joker||n>=4) praise("EXCELLENT!!",true);
      else if(n>=2||two) praise("GREAT!");
      else if(rs[0]>=13) praise("NICE!");
    }
    if(comboN>=3 && dopa()) kanji(`${comboN}連`,"gold",comboN>=5?110:84,.66);
    // リーチ（残り1枚）
    const left = S && S.counts ? S.counts[e.id] : undefined;
    if(left===1 && S && !S.finished.includes(e.id)){
      sfx("alarm"); alarmFrame(); kanji("激アツ","red",undefined,.28,300); cutin("reach", mine?"🔥 リーチ！":"⚠ リーチ！", mine?"あと1枚で上がり！":`${nameOf(S,e.id)} があと1枚！`, 1100);
    }
  }, 380);
}

// パチンコ風の漢字演出（演出レベル2のみ）。tone: red / gold / rainbow / blue / green / dark
let kanjiBusyUntil=0;
function kanji(text, tone="red", size, yRatio=.3, delay=0){
  if(!dopa()) return;
  const now=Date.now(); const start=Math.max(now+delay, kanjiBusyUntil); kanjiBusyUntil=start+650;
  setTimeout(()=>{
    const len=[...text].length;
    const fs=size || Math.min(len===1?170:len<=2?120:len<=3?96:78, Math.floor(Math.min(innerWidth,560)*.86/len));
    const w=document.createElement("div"); w.className="kanji k-"+tone;
    w.style.cssText=`left:50%;top:${innerHeight*yRatio}px;font-size:${fs}px`;
    w.innerHTML=`<i class="kback"></i><span data-t="${esc(text)}">${esc(text)}</span>`;
    fxLayer.appendChild(w);
    anim(w,[{transform:"translate(-50%,-50%) scale(4) rotate(-6deg)",opacity:0},
            {transform:"translate(-50%,-50%) scale(.9) rotate(2deg)",opacity:1,offset:.14},
            {transform:"translate(-50%,-50%) scale(1.08)",offset:.22},
            {transform:"translate(-49%,-51%) scale(1)",offset:.3},{transform:"translate(-51%,-49%) scale(1.02)",offset:.38},
            {transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.8},
            {transform:"translate(-50%,-50%) scale(1.25)",opacity:0}],{duration:1500,easing:"ease-out",fill:"forwards"});
    sfx(tone==="rainbow"?"kyuin":"don");
    const r=w.getBoundingClientRect(); burst(r.left+r.width/2, r.top+r.height/2, {n:18,emoji:tone==="rainbow"?"🌈":"✨",size:6,dist:140,gravity:0});
    setTimeout(()=>w.remove(),1550);
  }, start-now);
}
function floatCombo(k){
  const p=fieldPoint(), t=document.createElement("div"); t.className="combo"; t.innerHTML=`<b>${k}</b> COMBO`;
  t.style.left=(p.x+90)+"px"; t.style.top=(p.y+40)+"px"; fxLayer.appendChild(t);
  anim(t,[{transform:"translate(-50%,-50%) scale(2)",opacity:0},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.2},{transform:"translate(-50%,-80%) scale(1)",opacity:0}],{duration:900,fill:"forwards"});
  setTimeout(()=>t.remove(),950);
}

function cutin(kind, title, sub, dur=1300){
  if(bannerPending>=4 && !["win","round","reach"].includes(kind)) return;
  if(fxLevel===0){ banner(title.replace(/^\S+\s/,""),"round",true,true); return; }
  bannerPending++;
  bannerQ = bannerQ.then(()=>new Promise(res=>{
    const el=document.createElement("div"); el.className="cutin k-"+kind; el.style.setProperty("--d",dur+"ms");
    const long=[...title].length>=6 ? " long" : "";
    el.innerHTML=`<div class="cdim"></div><div class="lines"></div><div class="band"><div class="ttl${long}">${esc(title)}</div>${sub?`<div class="sub">${esc(sub)}</div>`:""}</div>`;
    fxLayer.appendChild(el);
    setTimeout(()=>el.remove(), dur+80);
    setTimeout(()=>{ bannerPending--; res(); }, dur*.72);
  }));
}
// 画面全体を走る斬撃
function bigSlash(){
  for(let i=0;i<2;i++) setTimeout(()=>{
    const s=document.createElement("div"); s.className="bigslash"+(i?" b":""); fxLayer.appendChild(s); setTimeout(()=>s.remove(),600);
  }, i*140);
  const a=document.getElementById("app");
  anim(a,[{clipPath:"none",transform:"none"},{transform:"translate(6px,-4px)",offset:.3},{transform:"none"}],{duration:380,delay:200});
}
// ぐるぐる回る後光
// 上から降ってくるもの
// 王冠が降ってきて席に乗る
function crownDrop(pid){
  const p=seatPoint(pid), c=document.createElement("div"); c.className="crown"; c.textContent="👑";
  c.style.left=p.x+"px"; c.style.top=(p.y-46)+"px"; fxLayer.appendChild(c);
  anim(c,[{transform:"translate(-50%,-50%) translateY(-500px) scale(2.5) rotate(-30deg)"},{transform:"translate(-50%,-50%) translateY(0) scale(1.2) rotate(8deg)",offset:.55},{transform:"translate(-50%,-50%) translateY(-24px) scale(1.05)",offset:.75},{transform:"translate(-50%,-50%) translateY(0) scale(1)"}],{duration:900,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>{ burst(p.x,p.y-46,{n:24,emoji:"✨",size:7,dist:90}); ring(p.x,p.y-46,"#ffd54a",220); }, 520);
  anim(c,[{opacity:1},{opacity:0}],{duration:600,delay:2600,fill:"forwards"});
  setTimeout(()=>c.remove(),3300);
}
// 画面全体の衝撃波
function speedSwipe(){
  const s=document.createElement("div"); s.className="swipe"; fxLayer.appendChild(s);
  anim(s,[{transform:"translateX(-100%)"},{transform:"translateX(100%)"}],{duration:700,easing:"cubic-bezier(.6,0,.4,1)",fill:"forwards"});
  setTimeout(()=>s.remove(),750);
}
function chainSlam(){
  for(const side of ["l","r"]){
    const c=document.createElement("div"); c.className="chainbar "+side; c.textContent="🔗".repeat(14); fxLayer.appendChild(c);
    anim(c,[{transform:`translateX(${side==="l"?"-110%":"110%"}) rotate(${side==="l"?-20:20}deg)`},{transform:`translateX(0) rotate(${side==="l"?-20:20}deg)`,offset:.4},{transform:`translateX(0) rotate(${side==="l"?-20:20}deg)`,opacity:1,offset:.8},{opacity:0}],{duration:1200,easing:"cubic-bezier(.3,1.4,.5,1)",fill:"forwards"});
    setTimeout(()=>c.remove(),1250);
  }
  setTimeout(()=>{ sfx("lock"); shake(); },450);
}

// 1位上がり（他人でも派手に、自分ならもっと派手に）
function winFx(e){
  const me=e.id===myId;
  avaSlam(e.id,"king",e.title||"大富豪",e.who);
  sfx("fanfare"); flash("#ffe36a"); rays(); crownDrop(e.id);
  rain(me?["🪙","✨","👑","🎉","💰"]:["🪙","✨","🎉"], me?70:35);
  fireworks(me?9:5);
  cutin("win", me?"あなたが1位！":"👑 1位上がり！", me?(e.game==="baba"?"一抜け！ババとはおさらば":"大富豪確定！おめでとう！"):e.who, me?1800:1500);
  if(me){ confetti(120); vib([60,40,60,40,200]); }
  if(dopa()){ rainbowStrobe(2200); rgbSplit(600); hitStop(2); const p=seatPoint(e.id); coinFountain(p.x,p.y,me?60:35); kanji("大当り","rainbow",undefined,.25,150); setTimeout(()=>stamp(me?"1位確定":"1位","#e8102a"),900); if(me) setTimeout(()=>{ rain(["💰","💎","🪙","👑","🌈"],80,3000); fireworks(6); },1200); }
}
function placeFx(e){
  const me=e.id===myId;
  { const t=e.game==="baba" ? (e.place<=2?"good":"mid") : slamTier(e.place,e.n||4); avaSlam(e.id,t,(e.title&&e.title!=="平民"?e.title:`${e.place}位`)+(t==="bad"?"…":"！"),e.who); }
  sfx("finish");
  const p=seatPoint(e.id); burst(p.x,p.y,{n:20,emoji:"⭐",size:7,dist:110});
  floatText(e.id, `${e.place}位 上がり`, "win");
  if(e.place===2){ cutin("silver", "🥈 2位上がり", e.who, 1100); rain(["✨","⭐"],18,2000); }
  else if(e.place===3){ cutin("bronze", "🥉 3位上がり", e.who, 1000); }
  else banner(`${e.who} ${e.place}位`,"finish",true);
  if(me){ fireworks(4); confetti(70); vib([40,30,40,30,120]); }
}

// ---- 上がり：アイコン全面ドーン（上位は祝福、下位はゴミ箱） ----
let slamUntil=0;
function slamTier(place,n){ if(place===1) return "king"; if(place<=Math.floor(n/2)) return "good"; if(n%2 && place===(n+1)/2) return "mid"; return "bad"; }
function avaSlam(pid, tier, title, sub){
  const p=(S&&S.players.find(x=>x.id===pid)) || {id:pid,name:sub||"?",bot:false};
  const v = tier==="bad" ? pickVar(Object.keys(BAD_VARS),"b") : pickVar(Object.keys(GOOD_VARS),"g");
  const dur = tier==="bad" ? BAD_VARS[v] : GOOD_VARS[v]+(tier==="king"?300:0);
  const now=Date.now(), start=Math.max(now, slamUntil); slamUntil=start+dur-500;
  setTimeout(()=>tier==="bad" ? slamBad(p,title,dur,v) : slamGood(p,tier,title,dur,v), start-now);
}
function slamBase(p,cls,title){
  const sz=Math.round(Math.min(innerWidth*.62, innerHeight*.42, 360));
  const o=document.createElement("div"); o.className="aslam "+cls; o.style.setProperty("--S",sz+"px");
  o.innerHTML=`<div class="bg"></div><div class="rays"></div><div class="big"><div class="col">${avatar(p)}</div><div class="gray">${avatar(p)}</div><i class="crack"></i></div><div class="ttl"><b>${esc(title||"")}</b><small>${esc(p.name||"")}</small></div>`;
  fxLayer.appendChild(o);
  const cy=innerHeight*.42;
  return {o, sz, cx:innerWidth/2, cy, big:o.querySelector(".big"), ttl:o.querySelector(".ttl"), bg:o.querySelector(".bg"), rays:o.querySelector(".rays"), gray:o.querySelector(".gray")};
}
function goodSlamV(p,tier,title,dur){
  const me=p.id===myId, k=tier==="king", E=slamBase(p,"good "+tier,title);
  anim(E.bg,[{opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.8},{opacity:0}],{duration:dur,fill:"forwards"});
  anim(E.rays,[{opacity:0,transform:"rotate(0deg) scale(.6)"},{opacity:1,transform:"rotate(40deg) scale(1)",offset:.15},{opacity:1,transform:"rotate(140deg) scale(1)",offset:.8},{opacity:0,transform:"rotate(170deg) scale(1.2)"}],{duration:dur,fill:"forwards"});
  const sp=seatPoint(p.id), dx=sp.x-E.cx, dy=sp.y-E.cy;
  anim(E.big,[
    {transform:"translate(-50%,-50%) scale(4) rotate(-14deg)",opacity:0},
    {transform:"translate(-50%,-50%) scale(.86) rotate(3deg)",opacity:1,offset:.1},
    {transform:"translate(-50%,-50%) scale(1.06) rotate(-1deg)",opacity:1,offset:.16},
    {transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.22},
    {transform:"translate(-50%,-50%) scale(1.04)",opacity:1,offset:.78},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.15)`,opacity:.2}],{duration:dur,easing:"ease-out",fill:"forwards"});
  anim(E.ttl,[{transform:"translate(-50%,40px) scale(.6)",opacity:0},{transform:"translate(-50%,40px) scale(.6)",opacity:0,offset:.14},{transform:"translate(-50%,0) scale(1.15)",opacity:1,offset:.24},{transform:"translate(-50%,0) scale(1)",opacity:1,offset:.3},{transform:"translate(-50%,0) scale(1)",opacity:1,offset:.78},{transform:"translate(-50%,0) scale(1.3)",opacity:0}],{duration:dur,fill:"forwards"});
  setTimeout(()=>{
    sfx("thud"); sfx(k?"fanfare":"finish"); shake(true); vib(k?[80,40,200]:[50,30,90]);
    flash(k?"#fff4b0":"#ffe6a0"); ring(E.cx,E.cy,"#ffe36a",E.sz*2.2); ring(E.cx,E.cy,"#fff",E.sz*1.4);
    burst(E.cx,E.cy,{n:k?46:28,dist:E.sz*.9,size:9,colors:["#ffd54a","#fff","#ff8a3d","#7cf0ff"]});
    coinFountain(E.cx,innerHeight*.95,k?70:tier==="good"?36:18); confetti(k?(me?160:90):tier==="good"?60:25);
    if(k||tier==="good") fireworks(k?7:3);
    if(dopa()){ hitStop(k?2:1); if(k){ rainbowStrobe(1800); rgbSplit(500); setTimeout(()=>stamp(title||"祝","#e8102a"),600); rain(["👑","💰","🪙","✨","🌈"],me?70:40,2600); } else if(tier==="good"){ kanji("祝","gold",170,.16,250); rain(["✨","🪙","⭐"],24,2000); } }
  }, dur*.1);
  if(k) setTimeout(()=>{ const c=document.createElement("div"); c.className="slcrown"; c.textContent="👑"; c.style.left=E.cx+"px"; c.style.top=(E.cy-E.sz*.5)+"px"; c.style.fontSize=Math.round(E.sz*.42)+"px"; fxLayer.appendChild(c);
    anim(c,[{transform:"translate(-50%,-260%) rotate(-30deg)",opacity:0},{transform:"translate(-50%,-62%) rotate(8deg)",opacity:1,offset:.25},{transform:"translate(-50%,-70%) rotate(-4deg)",opacity:1,offset:.35},{transform:"translate(-50%,-66%)",opacity:1,offset:.85},{transform:"translate(-50%,-66%) scale(1.3)",opacity:0}],{duration:dur*.62,easing:"ease-out",fill:"forwards"});
    setTimeout(()=>c.remove(),dur*.62+50); }, dur*.24);
  setTimeout(()=>E.o.remove(), dur+60);
}
function badTrashV(p,title,dur){
  const E=slamBase(p,"bad",title);
  anim(E.bg,[{opacity:0},{opacity:1,offset:.12},{opacity:1,offset:.85},{opacity:0}],{duration:dur,fill:"forwards"});
  // 上から落ちてきて、ヒビ→灰色→ゴミ箱へポイ
  anim(E.big,[
    {transform:"translate(-50%,-260%) rotate(-25deg)",opacity:1},
    {transform:"translate(-50%,-50%) rotate(6deg) scaleY(.82)",opacity:1,offset:.13},
    {transform:"translate(-50%,-52%) rotate(-3deg) scaleY(1.04)",opacity:1,offset:.18},
    {transform:"translate(-50%,-50%) rotate(-4deg)",opacity:1,offset:.22},
    {transform:"translate(-50%,-50%) rotate(-7deg)",opacity:1,offset:.6},
    {transform:"translate(-50%,-80%) rotate(30deg) scale(.7)",opacity:1,offset:.7},
    {transform:`translate(-50%,${innerHeight*.36}px) rotate(220deg) scale(.22)`,opacity:1,offset:.86},
    {transform:`translate(-50%,${innerHeight*.4}px) rotate(240deg) scale(.15)`,opacity:0}],{duration:dur,easing:"ease-in-out",fill:"forwards"});
  anim(E.gray,[{opacity:0},{opacity:0,offset:.24},{opacity:1,offset:.34},{opacity:1}],{duration:dur,fill:"forwards"});
  const cr=E.o.querySelector(".crack"); anim(cr,[{opacity:0,transform:"scale(.4)"},{opacity:0,transform:"scale(.4)",offset:.17},{opacity:1,transform:"scale(1)",offset:.2},{opacity:1}],{duration:dur,fill:"forwards"});
  anim(E.ttl,[{transform:"translate(-50%,0) rotate(0)",opacity:0},{transform:"translate(-50%,0) rotate(0)",opacity:0,offset:.2},{transform:"translate(-50%,0) rotate(-4deg)",opacity:1,offset:.26},{transform:"translate(-50%,6px) rotate(3deg)",opacity:1,offset:.55},{transform:"translate(-50%,60px) rotate(12deg)",opacity:0,offset:.75},{opacity:0}],{duration:dur,fill:"forwards"});
  // ゴミ箱
  const can=document.createElement("div"); can.className="slcan"; can.textContent="🗑"; can.style.fontSize=Math.round(Math.min(E.sz*.55,170))+"px"; fxLayer.appendChild(can);
  anim(can,[{transform:"translate(-50%,120%)"},{transform:"translate(-50%,120%)",offset:.5},{transform:"translate(-50%,0)",offset:.62},{transform:"translate(-50%,0)",offset:.84},{transform:"translate(-50%,6%) scaleY(.85) rotate(-6deg)",offset:.87},{transform:"translate(-50%,0) rotate(5deg)",offset:.91},{transform:"translate(-50%,0)",offset:.95},{transform:"translate(-50%,120%)"}],{duration:dur,easing:"ease-out",fill:"forwards"});
  // ハエ
  const flies=[]; for(let i=0;i<Q(5);i++){ const f=document.createElement("div"); f.className="slfly"; f.textContent="🪰"; f.style.left=E.cx+"px"; f.style.top=E.cy+"px"; fxLayer.appendChild(f); flies.push(f);
    const r=E.sz*(.42+Math.random()*.25), ph=Math.random()*6.28, kf=[]; for(let j=0;j<=12;j++){ const a=ph+j*(i%2?.9:-.9); kf.push({transform:`translate(${Math.cos(a)*r}px,${Math.sin(a)*r*.7}px) rotate(${a*57}deg)`,opacity: j===0||j===12?0:1}); }
    anim(f,kf,{duration:dur*.62,delay:dur*.2,fill:"forwards"}); }
  setTimeout(()=>{ sfx("thud"); shake(true); vib([120,60,60]); darkPulse(); tone(392,.35,"sawtooth",.06,.15); tone(370,.35,"sawtooth",.06,.5); tone(349,.35,"sawtooth",.06,.85); tone(330,.9,"sawtooth",.07,1.2,300);
    burst(E.cx,E.cy+E.sz*.4,{n:16,dist:E.sz*.6,size:7,colors:["#777","#555","#9a9a8a"]});
    if(dopa()){ kanji("無念","dark",130,.14,250); rain(["🗑","🪰","🍌","🥫","💨"],26,2400); setTimeout(()=>stamp("ゴミ","#7a7a7a"),500); }
  }, dur*.13);
  setTimeout(()=>{ noise(.25,.2,0,400); burst(innerWidth/2,innerHeight*.85,{n:14,dist:90,size:6,colors:["#888","#666","#aaa"]}); }, dur*.86);
  setTimeout(()=>{ E.o.remove(); can.remove(); flies.forEach(f=>f.remove()); }, dur+60);
}

// ---- 演出のバリエーション（前回と同じのは避けてランダム） ----
const lastVar={};
function pickVar(list,key){ let v; do{ v=list[Math.floor(Math.random()*list.length)]; }while(list.length>1 && v===lastVar[key]); lastVar[key]=v; return v; }
const GOOD_VARS={slam:2200,rocket:2500,statue:2600,slot:3200,gate:2600};
const BAD_VARS={trash:2700,toilet:2600,soul:2800,kick:2400,dust:2700,rain:2700};
function slamGood(p,tier,title,dur,v){ (GOODF[v]||goodSlamV)(p,tier,title,dur); }
function slamBad(p,title,dur,v){ (BADF[v]||badTrashV)(p,title,dur); }
function bgIn(E,dur){ anim(E.bg,[{opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.82},{opacity:0}],{duration:dur,fill:"forwards"}); }
function raysIn(E,dur,at=.15){ anim(E.rays,[{opacity:0,transform:"rotate(0deg) scale(.6)"},{opacity:0,transform:"rotate(0deg) scale(.6)",offset:Math.max(0,at-.12)},{opacity:1,transform:"rotate(40deg) scale(1)",offset:at},{opacity:1,transform:"rotate(140deg) scale(1)",offset:.8},{opacity:0,transform:"rotate(170deg) scale(1.2)"}],{duration:dur,fill:"forwards"}); }
function titleIn(E,dur,at=.22,end=.8){ anim(E.ttl,[{transform:"translate(-50%,40px) scale(.6)",opacity:0},{transform:"translate(-50%,40px) scale(.6)",opacity:0,offset:Math.max(0,at-.08)},{transform:"translate(-50%,0) scale(1.15)",opacity:1,offset:at},{transform:"translate(-50%,0) scale(1)",opacity:1,offset:Math.min(end,at+.06)},{transform:"translate(-50%,0) scale(1)",opacity:1,offset:end},{transform:"translate(-50%,0) scale(1.3)",opacity:0}],{duration:dur,fill:"forwards"}); }
function bigOut(E,p,dur,from){   // 最後は自分の席へ吸い込まれる
  const sp=seatPoint(p.id), dx=sp.x-E.cx, dy=sp.y-E.cy;
  return {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.15)`,opacity:.2};
}
function celebrate(E,tier,title,me){
  const k=tier==="king";
  sfx("thud"); sfx(k?"fanfare":"finish"); shake(true); vib(k?[80,40,200]:[50,30,90]);
  flash(k?"#fff4b0":"#ffe6a0"); ring(E.cx,E.cy,"#ffe36a",E.sz*2.2); ring(E.cx,E.cy,"#fff",E.sz*1.4);
  burst(E.cx,E.cy,{n:k?46:28,dist:E.sz*.9,size:9,colors:["#ffd54a","#fff","#ff8a3d","#7cf0ff"]});
  coinFountain(E.cx,innerHeight*.95,k?70:tier==="good"?36:18); confetti(k?(me?160:90):tier==="good"?60:25);
  if(k||tier==="good") fireworks(k?7:3);
  if(dopa()){ hitStop(k?2:1); if(k){ rainbowStrobe(1800); rgbSplit(500); setTimeout(()=>stamp(title||"祝","#e8102a"),600); rain(["👑","💰","🪙","✨","🌈"],me?70:40,2600); } else if(tier==="good"){ kanji("祝","gold",170,.16,250); rain(["✨","🪙","⭐"],24,2000); } }
}
function crownOn(E,dur,at){
  setTimeout(()=>{ const c=document.createElement("div"); c.className="slcrown"; c.textContent="👑"; c.style.left=E.cx+"px"; c.style.top=(E.cy-E.sz*.5)+"px"; c.style.fontSize=Math.round(E.sz*.42)+"px"; fxLayer.appendChild(c);
    anim(c,[{transform:"translate(-50%,-260%) rotate(-30deg)",opacity:0},{transform:"translate(-50%,-62%) rotate(8deg)",opacity:1,offset:.25},{transform:"translate(-50%,-70%) rotate(-4deg)",opacity:1,offset:.35},{transform:"translate(-50%,-66%)",opacity:1,offset:.85},{transform:"translate(-50%,-66%) scale(1.3)",opacity:0}],{duration:dur*.6,easing:"ease-out",fill:"forwards"});
    setTimeout(()=>c.remove(),dur*.6+50); }, dur*at);
}
function addFx(cls,text,style){ const d=document.createElement("div"); d.className=cls; if(text) d.textContent=text; if(style) Object.assign(d.style,style); fxLayer.appendChild(d); return d; }

// ===== 上がり：ロケット（下から火を噴いて上がってくる）
function goodRocketV(p,tier,title,dur){
  const me=p.id===myId, E=slamBase(p,"good "+tier,title), X=[];
  bgIn(E,dur); raysIn(E,dur,.3); titleIn(E,dur,.34);
  const fl=addFx("slflame"); fl.style.left=E.cx+"px"; fl.style.setProperty("--S",E.sz+"px"); X.push(fl);
  const startY=innerHeight*.75;
  const kf=[{transform:`translate(-50%,calc(-50% + ${startY}px)) scale(.55)`,opacity:1},{transform:`translate(-50%,calc(-50% + ${startY*.5}px)) scale(.6) rotate(-3deg)`,offset:.12},{transform:"translate(-50%,calc(-50% - 30px)) scale(.95) rotate(2deg)",offset:.26},{transform:"translate(-50%,-50%) scale(1.06)",offset:.31},{transform:"translate(-50%,-50%) scale(1)",offset:.36},{transform:"translate(-50%,-50%) scale(1.03)",offset:.8},bigOut(E,p,dur)];
  anim(E.big,kf,{duration:dur,easing:"ease-out",fill:"forwards"});
  anim(fl,[{transform:`translate(-50%,${E.cy+startY}px) scale(.6)`,opacity:1},{transform:`translate(-50%,${E.cy+startY*.5}px) scale(.7)`,offset:.12},{transform:`translate(-50%,${E.cy-30}px) scale(1)`,opacity:1,offset:.26},{transform:`translate(-50%,${E.cy}px) scale(1.4)`,opacity:0,offset:.34},{opacity:0}],{duration:dur,easing:"ease-out",fill:"forwards"});
  sfx("kyuin"); vib(30);
  // 噴射の粒
  const t0=Date.now(); const iv=setInterval(()=>{ const t=(Date.now()-t0)/dur; if(t>.27){ clearInterval(iv); return; }
    const y=E.cy+startY*(1-t/.27); for(let i=0;i<Q(3);i++) PFX.add({x:E.cx+(Math.random()*2-1)*E.sz*.15,y:y+E.sz*.5,vx:(Math.random()*2-1)*60,vy:220+Math.random()*200,g:0,drag:.97,size:6+Math.random()*8,color:["#ffd54a","#ff8a3d","#ff3b2f","#fff"][i%4],life:.5}); },40);
  setTimeout(()=>celebrate(E,tier,title,me), dur*.3);
  if(tier==="king") crownOn(E,dur,.38);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); clearInterval(iv); }, dur+60);
}
// ===== 上がり：黄金の像（スポットライト＋台座＋光が走る）
function goodStatueV(p,tier,title,dur){
  const me=p.id===myId, E=slamBase(p,"good statue "+tier,title), X=[];
  E.ttl.style.top="calc(42% + var(--S)*.5 + var(--S)*.2 + 14px)";
  bgIn(E,dur); raysIn(E,dur,.45); titleIn(E,dur,.4);
  const spot=addFx("slspot"); X.push(spot); anim(spot,[{opacity:0},{opacity:1,offset:.12},{opacity:1,offset:.8},{opacity:0}],{duration:dur,fill:"forwards"});
  const ped=addFx("slped"); ped.style.left=E.cx+"px"; ped.style.top=(E.cy+E.sz*.5)+"px"; ped.style.width=(E.sz*1.15)+"px"; X.push(ped);
  anim(ped,[{transform:"translate(-50%,60px)",opacity:0},{transform:"translate(-50%,0)",opacity:1,offset:.12},{transform:"translate(-50%,0)",opacity:1,offset:.8},{opacity:0}],{duration:dur,fill:"forwards"});
  E.big.classList.add("goldify");
  anim(E.big,[{transform:"translate(-50%,-50%) scale(.9)",opacity:0,filter:"brightness(3)"},{transform:"translate(-50%,-50%) scale(.9)",opacity:0,offset:.12},{transform:"translate(-50%,-50%) scale(1)",opacity:1,filter:"brightness(2)",offset:.22},{transform:"translate(-50%,-50%) scale(1)",opacity:1,filter:"brightness(1)",offset:.32},{transform:"translate(-50%,-50%) scale(1.02)",opacity:1,offset:.8},bigOut(E,p,dur)],{duration:dur,easing:"ease-out",fill:"forwards"});
  const sh=document.createElement("i"); sh.className="shine"; E.big.appendChild(sh);
  anim(sh,[{transform:"translateX(-160%) skewX(-20deg)"},{transform:"translateX(-160%) skewX(-20deg)",offset:.34},{transform:"translateX(260%) skewX(-20deg)",offset:.5},{transform:"translateX(260%) skewX(-20deg)"}],{duration:dur,fill:"forwards"});
  setTimeout(()=>{ sfx("kyuin"); }, dur*.12);
  setTimeout(()=>{ celebrate(E,tier,title,me); burst(E.cx,E.cy,{n:24,emoji:"✨",size:9,dist:E.sz}); }, dur*.24);
  if(tier==="king") crownOn(E,dur,.34);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); }, dur+60);
}
// ===== 上がり：スロット（リールが揃ってアイコンが出る）
function goodSlotV(p,tier,title,dur){
  const me=p.id===myId, E=slamBase(p,"good "+tier,title), X=[];
  bgIn(E,dur); raysIn(E,dur,.48); titleIn(E,dur,.5,.84);
  const cell=Math.round(Math.min(E.sz*.42,120)), N=14;
  const sy=["🍒","🔔","💎","7️⃣","🍋","⭐","🍇"];
  const box=addFx("slslot"); box.style.left=E.cx+"px"; box.style.top=E.cy+"px"; box.style.setProperty("--cell",cell+"px"); X.push(box);
  box.innerHTML=[0,1,2].map(r=>`<div class="reel"><div class="strip">${Array.from({length:N},(_,i)=>i===N-1?`<div class="cl av">${avatar(p)}</div>`:`<div class="cl">${sy[(i*3+r*2)%sy.length]}</div>`).join("")}</div></div>`).join("");
  const stops=[.16,.25,.36];
  [...box.querySelectorAll(".strip")].forEach((s,i)=>{
    anim(s,[{transform:"translateY(0)"},{transform:`translateY(${-(N-1)*cell-cell*.25}px)`,offset:.93},{transform:`translateY(${-(N-1)*cell}px)`}],{duration:dur*stops[i],easing:"cubic-bezier(.3,.1,.3,1)",fill:"forwards"});
    setTimeout(()=>{ sfx("lock"); vib(20); if(i===2){ sfx("kyuin"); } else if(i===1){ alarmFrame&&alarmFrame(); } }, dur*stops[i]);
  });
  anim(box,[{transform:"translate(-50%,-50%) scale(.6)",opacity:0},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.05},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.42},{transform:"translate(-50%,-50%) scale(1.25)",opacity:0,offset:.48},{opacity:0}],{duration:dur,fill:"forwards"});
  anim(E.big,[{transform:"translate(-50%,-50%) scale(.3)",opacity:0},{transform:"translate(-50%,-50%) scale(.3)",opacity:0,offset:.44},{transform:"translate(-50%,-50%) scale(1.12)",opacity:1,offset:.5},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.55},{transform:"translate(-50%,-50%) scale(1.03)",opacity:1,offset:.84},bigOut(E,p,dur)],{duration:dur,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>{ celebrate(E,tier,title,me); if(dopa()) kanji("揃","rainbow",160,.14,100); }, dur*.46);
  if(tier==="king") crownOn(E,dur,.52);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); }, dur+60);
}
// ===== 上がり：役物の扉がガバッと開く
function goodGateV(p,tier,title,dur){
  const me=p.id===myId, E=slamBase(p,"good "+tier,title), X=[];
  bgIn(E,dur); raysIn(E,dur,.25); titleIn(E,dur,.3);
  const L=addFx("slgate l"), Rr=addFx("slgate r"); X.push(L,Rr);
  [L,Rr].forEach((g,i)=>anim(g,[{transform:`translateX(${i?100:-100}%)`},{transform:"translateX(0)",offset:.08},{transform:"translateX(0)",offset:.14},{transform:`translateX(${i?3:-3}%)`,offset:.16},{transform:"translateX(0)",offset:.18},{transform:`translateX(${i?105:-105}%)`,offset:.26},{transform:`translateX(${i?105:-105}%)`}],{duration:dur,easing:"ease-in-out",fill:"forwards"}));
  setTimeout(()=>{ sfx("lock"); shake(); }, dur*.08);
  setTimeout(()=>{ sfx("alarm"); }, dur*.14);
  anim(E.big,[{transform:"translate(-50%,-50%) scale(.8)",opacity:0},{transform:"translate(-50%,-50%) scale(.8)",opacity:0,offset:.17},{transform:"translate(-50%,-50%) scale(1.15)",opacity:1,offset:.25},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.3},{transform:"translate(-50%,-50%) scale(1.03)",opacity:1,offset:.8},bigOut(E,p,dur)],{duration:dur,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>{ celebrate(E,tier,title,me); if(dopa()) rainbowStrobe(1200); }, dur*.22);
  if(tier==="king") crownOn(E,dur,.32);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); }, dur+60);
}

// ---- 負け演出 共通 ----
function sadTune(){ tone(392,.35,"sawtooth",.06,.15); tone(370,.35,"sawtooth",.06,.5); tone(349,.35,"sawtooth",.06,.85); tone(330,.9,"sawtooth",.07,1.2,300); }
function badBase(p,title,dur,grayAt){
  const E=slamBase(p,"bad",title);
  anim(E.bg,[{opacity:0},{opacity:1,offset:.12},{opacity:1,offset:.85},{opacity:0}],{duration:dur,fill:"forwards"});
  anim(E.gray,[{opacity:0},{opacity:0,offset:grayAt},{opacity:1,offset:grayAt+.1},{opacity:1}],{duration:dur,fill:"forwards"});
  anim(E.ttl,[{transform:"translate(-50%,0) rotate(0)",opacity:0},{transform:"translate(-50%,0) rotate(0)",opacity:0,offset:.2},{transform:"translate(-50%,0) rotate(-4deg)",opacity:1,offset:.26},{transform:"translate(-50%,6px) rotate(3deg)",opacity:1,offset:.6},{transform:"translate(-50%,60px) rotate(12deg)",opacity:0,offset:.8},{opacity:0}],{duration:dur,fill:"forwards"});
  return E;
}
function badHit(word, items, stampTxt){
  sfx("thud"); vib([120,60,60]); darkPulse(); sadTune();
  if(dopa()){ kanji(word,"dark",130,.14,250); if(items) rain(items,22,2400); if(stampTxt) setTimeout(()=>stamp(stampTxt,"#7a7a7a"),500); }
}
// ===== 負け：トイレに流される
function badToiletV(p,title,dur){
  const E=badBase(p,title,dur,.3), X=[];
  const sw=addFx("slswirl"); sw.style.left=E.cx+"px"; sw.style.top=(E.cy+E.sz*.15)+"px"; sw.style.setProperty("--S",E.sz+"px"); X.push(sw);
  anim(sw,[{opacity:0,transform:"translate(-50%,-50%) scale(.3) rotate(0)"},{opacity:0,offset:.38},{opacity:1,transform:"translate(-50%,-50%) scale(1.2) rotate(360deg)",offset:.55},{opacity:1,transform:"translate(-50%,-50%) scale(.6) rotate(1080deg)",offset:.85},{opacity:0,transform:"translate(-50%,-50%) scale(.1) rotate(1440deg)"}],{duration:dur,fill:"forwards"});
  const t=addFx("slcan","🚽"); t.style.fontSize=Math.round(Math.min(E.sz*.6,180))+"px"; X.push(t);
  anim(t,[{transform:"translate(-50%,130%)"},{transform:"translate(-50%,130%)",offset:.3},{transform:"translate(-50%,0)",offset:.4},{transform:"translate(-50%,0) rotate(-4deg)",offset:.86},{transform:"translate(-50%,0) rotate(4deg)",offset:.9},{transform:"translate(-50%,130%)"}],{duration:dur,easing:"ease-out",fill:"forwards"});
  anim(E.big,[{transform:"translate(-50%,-50%) scale(1.4)",opacity:0},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.1},{transform:"translate(-50%,-50%) rotate(-6deg)",offset:.4},{transform:"translate(-50%,-30%) rotate(360deg) scale(.7)",offset:.6},{transform:`translate(-50%,${innerHeight*.25}px) rotate(1080deg) scale(.25)`,offset:.82},{transform:`translate(-50%,${innerHeight*.32}px) rotate(1440deg) scale(0)`,opacity:0}],{duration:dur,easing:"ease-in",fill:"forwards"});
  setTimeout(()=>badHit("撃沈",["💧","🧻","🫧"],"流された"), dur*.12);
  setTimeout(()=>{ noise(.9,.18,0,500); tone(600,.9,"sine",.05,0,120); }, dur*.45);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); }, dur+60);
}
// ===== 負け：魂が抜ける
function badSoulV(p,title,dur){
  const E=badBase(p,title,dur,.18), X=[];
  anim(E.big,[{transform:"translate(-50%,-50%) scale(1.3)",opacity:0},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.12},{transform:"translate(-50%,-50%) rotate(0)",opacity:1,offset:.4},{transform:"translate(-50%,-38%) rotate(-12deg) scaleY(.9)",opacity:1,offset:.55},{transform:"translate(-50%,-30%) rotate(-90deg) scale(.9)",opacity:1,offset:.7},{transform:"translate(-50%,-30%) rotate(-90deg) scale(.9)",opacity:1,offset:.88},{transform:"translate(-50%,-30%) rotate(-90deg) scale(.9)",opacity:0}],{duration:dur,easing:"ease-in-out",fill:"forwards"});
  const g=addFx("slghost","👻"); g.style.left=E.cx+"px"; g.style.top=E.cy+"px"; g.style.fontSize=Math.round(E.sz*.5)+"px"; X.push(g);
  anim(g,[{transform:"translate(-50%,-50%) scale(.3)",opacity:0},{transform:"translate(-50%,-50%) scale(.3)",opacity:0,offset:.3},{transform:"translate(-50%,-90%) scale(1)",opacity:.9,offset:.42},{transform:`translate(-30%,-${E.sz*.9}px) scale(1) rotate(-10deg)`,opacity:.8,offset:.6},{transform:`translate(-70%,-${E.sz*1.3}px) scale(1.1) rotate(10deg)`,opacity:.6,offset:.75},{transform:`translate(-50%,-${innerHeight*.6}px) scale(1.3)`,opacity:0}],{duration:dur,easing:"ease-in-out",fill:"forwards"});
  [-1,1].forEach(s=>{ const c=addFx("slcandle","🕯"); c.style.left=(E.cx+s*E.sz*.75)+"px"; c.style.top=(E.cy+E.sz*.35)+"px"; c.style.fontSize=Math.round(E.sz*.28)+"px"; X.push(c);
    anim(c,[{opacity:0},{opacity:0,offset:.45},{opacity:1,offset:.55},{opacity:1,offset:.88},{opacity:0}],{duration:dur,fill:"forwards"}); });
  setTimeout(()=>{ sfx("foul"); vib(60); }, dur*.12);
  setTimeout(()=>badHit("成仏",["🕯","👻","🪦"],"昇天"), dur*.4);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); }, dur+60);
}
// ===== 負け：蹴っ飛ばされて星になる
function badKickV(p,title,dur){
  const E=badBase(p,title,dur,.14), X=[];
  const ft=addFx("slfoot","🦶"); ft.style.top=(E.cy+E.sz*.1)+"px"; ft.style.fontSize=Math.round(E.sz*.6)+"px"; X.push(ft);
  anim(ft,[{transform:`translate(-120%,-50%) rotate(-30deg)`},{transform:`translate(-120%,-50%) rotate(-30deg)`,offset:.28},{transform:`translate(${E.cx-E.sz*.75}px,-50%) rotate(20deg)`,offset:.36},{transform:`translate(${E.cx-E.sz*.9}px,-50%) rotate(10deg)`,offset:.45},{transform:`translate(-120%,-50%)`}],{duration:dur,easing:"ease-out",fill:"forwards"});
  const ex=innerWidth*.42, ey=-innerHeight*.45;
  anim(E.big,[{transform:"translate(-50%,-260%) rotate(-20deg)",opacity:1},{transform:"translate(-50%,-50%) rotate(4deg) scaleY(.85)",offset:.12},{transform:"translate(-50%,-50%)",offset:.18},{transform:"translate(-50%,-50%) rotate(-3deg)",offset:.35},{transform:`translate(calc(-50% + ${ex*.5}px),calc(-50% + ${ey*.5}px)) rotate(400deg) scale(.6)`,offset:.48},{transform:`translate(calc(-50% + ${ex}px),calc(-50% + ${ey}px)) rotate(900deg) scale(.08)`,opacity:1,offset:.62},{transform:`translate(calc(-50% + ${ex}px),calc(-50% + ${ey}px)) scale(0)`,opacity:0}],{duration:dur,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>{ sfx("thud"); vib(40); }, dur*.12);
  setTimeout(()=>{ sfx("bomb"); shake(true); burst(E.cx,E.cy,{n:18,emoji:"⭐",size:9,dist:E.sz*.7}); }, dur*.36);
  setTimeout(()=>{ const st=addFx("sltwinkle","✦"); st.style.left=(E.cx+ex)+"px"; st.style.top=(E.cy+ey)+"px"; X.push(st);
    anim(st,[{transform:"translate(-50%,-50%) scale(0) rotate(0)",opacity:0},{transform:"translate(-50%,-50%) scale(1.6) rotate(45deg)",opacity:1,offset:.3},{transform:"translate(-50%,-50%) scale(.6) rotate(90deg)",opacity:1,offset:.6},{transform:"translate(-50%,-50%) scale(0) rotate(180deg)",opacity:0}],{duration:dur*.35,fill:"forwards"}); tone(2400,.25,"sine",.06); badHit("退場",null,"星になった"); }, dur*.62);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); }, dur+60);
}
// ===== 負け：塵になって消える
function badDustV(p,title,dur){
  const E=badBase(p,title,dur,.2), X=[];
  anim(E.big,[{transform:"translate(-50%,-50%) scale(1.3)",opacity:0},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.12},{transform:"translate(-50%,-50%)",opacity:1,offset:.4},{transform:"translate(-50%,-50%)",opacity:0,offset:.42},{opacity:0}],{duration:dur,fill:"forwards"});
  const n=5, sz=E.sz, html=E.big.querySelector(".gray").innerHTML;
  setTimeout(()=>{
    const wrap=addFx("sldust"); wrap.style.left=(E.cx-sz/2)+"px"; wrap.style.top=(E.cy-sz/2)+"px"; wrap.style.width=sz+"px"; wrap.style.height=sz+"px"; X.push(wrap);
    for(let r=0;r<n;r++) for(let c=0;c<n;c++){
      const f=document.createElement("div"); f.className="piece"; f.innerHTML=html; f.style.setProperty("--S",sz+"px");
      f.style.clipPath=`inset(${r*100/n}% ${100-(c+1)*100/n}% ${100-(r+1)*100/n}% ${c*100/n}%)`; wrap.appendChild(f);
      const d=(c*.12+(n-r)*.05+Math.random()*.15)*dur*.4;
      anim(f,[{transform:"translate(0,0)",opacity:1},{transform:"translate(0,0)",opacity:1,offset:.01},{transform:`translate(${60+Math.random()*120}px,${-40-Math.random()*90}px) rotate(${Math.random()*90}deg) scale(.6)`,opacity:0}],{duration:dur*.35,delay:d,easing:"ease-in",fill:"forwards"});
    }
    noise(1.2,.1,0,3000);
  }, dur*.4);
  setTimeout(()=>{ sfx("foul"); vib(60); }, dur*.12);
  setTimeout(()=>badHit("消滅",["💨"],"跡形もない"), dur*.5);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); }, dur+60);
}
// ===== 負け：雨雲に降られてしょんぼり
function badRainV(p,title,dur){
  const E=badBase(p,title,dur,.3), X=[];
  const cl=addFx("slcloud","☁️"); cl.style.left=E.cx+"px"; cl.style.top=(E.cy-E.sz*.62)+"px"; cl.style.fontSize=Math.round(E.sz*.75)+"px"; X.push(cl);
  anim(cl,[{transform:"translate(-50%,-260%)",opacity:0},{transform:"translate(-50%,-260%)",opacity:0,offset:.15},{transform:"translate(-50%,-50%)",opacity:1,offset:.28},{transform:"translate(-52%,-50%)",offset:.5},{transform:"translate(-48%,-50%)",offset:.7},{transform:"translate(-50%,-50%)",opacity:1,offset:.88},{opacity:0}],{duration:dur,easing:"ease-out",fill:"forwards"});
  anim(E.big,[{transform:"translate(-50%,-50%) scale(1.3)",opacity:0},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.12},{transform:"translate(-50%,-50%)",opacity:1,offset:.3},{transform:"translate(-50%,-44%) rotate(-6deg) scaleY(.92)",opacity:1,offset:.5},{transform:"translate(-50%,-40%) rotate(-9deg) scaleY(.88)",opacity:1,offset:.88},{transform:"translate(-50%,-30%) rotate(-9deg) scaleY(.88)",opacity:0}],{duration:dur,easing:"ease-in-out",fill:"forwards"});
  let iv; setTimeout(()=>{ sfx("foul"); const t0=Date.now(); iv=setInterval(()=>{ if(Date.now()-t0>dur*.55){ clearInterval(iv); return; }
    for(let i=0;i<Q(4);i++) PFX.add({x:E.cx+(Math.random()*2-1)*E.sz*.55,y:E.cy-E.sz*.5,vx:-20,vy:520+Math.random()*200,g:0,drag:1,size:3,color:"#8fb8ff",life:.45}); },45); X.push({remove:()=>clearInterval(iv)}); }, dur*.28);
  setTimeout(()=>badHit("涙",["☔","💧"],"どんまい"), dur*.32);
  setTimeout(()=>{ E.o.remove(); X.forEach(x=>x.remove()); }, dur+60);
}
const GOODF={slam:(p,t,ti,d)=>goodSlamV(p,t,ti,d), rocket:goodRocketV, statue:goodStatueV, slot:goodSlotV, gate:goodGateV};
const BADF={trash:(p,t,d)=>badTrashV(p,t,d), toilet:badToiletV, soul:badSoulV, kick:badKickV, dust:badDustV, rain:badRainV};

