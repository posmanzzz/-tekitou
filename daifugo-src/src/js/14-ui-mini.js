// =====================================================================
// ババ抜き / 神経衰弱 の画面
// =====================================================================
function genSeatHtml(p,x,y,small,stat,cls="",backs=true){
  const cnt = S.counts && S.counts[p.id]!==undefined ? S.counts[p.id] : (S.hands[p.id]||[]).length;
  const k=backs?Math.min(cnt,13):0, spread=Math.min(110,k*9);
  const fan = Array.from({length:k},(_,i)=>{ const a = k>1 ? -spread/2 + spread*i/(k-1) : 0; return `<i class="bk" style="transform:rotate(${a}deg)"></i>`; }).join("");
  const title=S.titles&&S.titles[p.id];
  const tobot = isHost() && mode==="online" && !p.bot && !cls.includes("out") ? `<button class="small ghost" data-bot="${esc(p.id)}" style="margin-top:3px;padding:3px 6px;font-size:10px">CPU交代</button>` : "";
  const talk = bubbles[p.id] && Date.now()-bubbles[p.id].at<4500;
  return `<div data-seat="${esc(p.id)}" class="seat ${small?(S.order.length>=9?"xs":"sm"):""} ${talk?"talk":""} ${S.turn===p.id?"turn":""} ${cls}" style="left:${x}%;top:${y}%">
    ${bubbleHtml(p.id)}
    <div class="plate">${p.away?"💤":""}${esc(p.name)}</div>
    <div class="avawrap"><div class="fan">${fan}</div>${avatar(p)}${title?`<span class="title ${["一抜け","記憶王"].includes(title)?"gold":""}">${esc(title)}</span>`:""}${scoinHtml(p.id)}</div>
    ${stat}${tobot}</div>`;
}
function othersOf(){ const ord=S.order, mi=ord.indexOf(myId); return mi>=0 ? ord.slice(mi+1).concat(ord.slice(0,mi)) : ord.slice(); }
function tableTop(extraCls, myMoment, label){
  return `<div class="led ${myMoment?"rb":""}"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i></div>
    <div class="tbar">
      <div class="ticker"><div class="rd">${label} · ${esc(roomKey)}</div>${S.log.slice(-2).map(l=>`<div>${esc(l)}</div>`).join("")}</div>
      ${mode==="online"?chatBtn():""}${soundBtn("round")}<button class="round" id="menu" title="メニュー" aria-label="メニュー">≡</button>
    </div>`;
}
const tback = (cls="",style="",attr="") => `<div class="tback ${cls}" style="${style}" ${attr}></div>`;

// ---- ババ抜き ----
let lastHoverSig="", babaPrevTurn=null;
function renderBaba(){
  const B=S.b, myTurn=S.turn===myId, actv=bActive(S);
  const meP=S.players.find(p=>p.id===myId), amIn=meP && S.order.includes(myId);
  const hand=S.hands[myId]||[];
  const target = S.turn ? bNext(S,S.turn) : null;
  const meOut = S.finished.includes(myId)||S.losers.includes(myId);
  const others=othersOf(), pos=seatPos(others.length), small=others.length>5;
  const newRound=S.round!==lastRound; lastRound=S.round;
  const turnStart = myTurn && lastTurn!==myId; lastTurn=S.turn;
  const seats=others.map((id,i)=>{ const p=S.players.find(x=>x.id===id); if(!p) return "";
    const fin=S.finished.indexOf(id), cnt=(S.counts||{})[id]??0;
    let stat, cls="";
    if(fin>=0){ stat=`<span class="sstat win">${fin+1}位 上がり</span>`; cls="out"; }
    else if(S.losers.includes(id)){ stat=`<span class="sstat lose">🤡 ババ持ち</span>`; cls="out"; }
    else if(id===S.turn) stat=`<span class="sstat think">引く番 · ${esc(cnt)}枚</span>`;
    else if(id===target) stat=`<span class="sstat aim">狙われ中 · ${esc(cnt)}枚</span>`;
    else stat=`<span class="sstat">${esc(cnt)}枚</span>`;
    return genSeatHtml(p,pos[i][0],pos[i][1],small,stat,cls+(id===target?" aimed":""));
  }).join("");
  // 真ん中：引かれる側の手札（裏）
  const tn = target ? ((S.counts||{})[target] ?? 0) : 0;
  const W = Math.min(isWide()?760:tableW()-30, 760);
  const cw = Math.round(Math.max(30, Math.min(isWide()?84:isLand()?40:62, (W-20)/(tn*0.55+0.6)))), ch=Math.round(cw*1.42);
  const step = tn>1 ? Math.min(cw*0.86,(W-cw-10)/(tn-1)) : 0, span=step*(tn-1)+cw;
  const hov = B.hover && B.hover.to===target ? B.hover.i : -1;
  const fanHtml = Array.from({length:tn},(_,i)=>{ const t=tn>1?i/(tn-1)-.5:0, rot=t*Math.min(30,tn*3), y=t*t*4*10;
    return tback((i===hov?"hov ":"")+(myTurn?"can":""), `--cw:${cw}px;left:${(W-span)/2+i*step}px;top:${y+(i===hov?-20:0)}px;transform:rotate(${rot}deg)${i===hov?" scale(1.12)":""};z-index:${i===hov?99:i+1}`, `data-bi="${i}"`); }).join("");
  const head = !target ? "" : myTurn ? `<b>${esc(nameOf(S,target))}</b> から1枚引いてね` : target===myId ? `<b class="hot">${esc(nameOf(S,S.turn))}</b> があなたのカードを狙ってる！` : `<b>${esc(nameOf(S,S.turn))}</b> → <b>${esc(nameOf(S,target))}</b>`;
  const pairs = Object.values(B.pairs||{}).reduce((a,b)=>a+b,0);
  const HG=handGeom(hand.length, tableW());
  const aimedI = B.hover && B.hover.to===myId ? B.hover.i : -1;
  const myMoment = myTurn;
  const bm = betMode();
  app.innerHTML=`
  <div class="table baba ${myMoment?"myturn":""}">
    ${tableTop("",myMoment,`ババ抜き 第${esc(S.round)}回戦`)}
    ${seats}
    <div class="field bfield" style="top:${isLand()?(SAFE.t+118)/innerHeight*100:isWide()?40:others.length>=4?44:40}%">
      <div class="bhead">${head}</div>
      <div class="bfan ${myTurn?"mine":""}" id="bfan" style="width:${W}px;height:${ch+34}px">${fanHtml}</div>
      <div class="bpile">🗑 捨てたペア <b>${esc(pairs)}</b>組</div>
    </div>
    ${amIn?`
    <div class="mebar ${bm?"bmode":""}" id="mebar">
      ${bubbleHtml(myId)}${bm?"":firstHint("baba")}
      <div class="meinfo">
        <div class="row" style="gap:5px;flex-wrap:nowrap">${miniAva(meP,34)}<div class="plate" style="${myMoment?"background:linear-gradient(#ffe08a,#f5b52e);color:#3a2600":""}">${esc(meP.name)}</div></div>
        <span class="sstat">${meOut?(S.finished.includes(myId)?`${S.finished.indexOf(myId)+1}位 上がり`:"ババ持ち"):`${hand.length}枚`}</span>${mecoinHtml()}
      </div>
      <div class="mebtns">
        <div class="hint" id="hint" aria-live="polite">${meOut?"上がり！観戦中":myTurn?(B.hover&&B.hover.by===myId?"もう1回タップか「引く」で決定":"カードをタップして選ぶ（相手にも見えるよ）"):aimedI>=0?"👆 光ってるカードが狙われてる…シャッフルで逃げろ":`${esc(nameOf(S,S.turn))} の番…`}</div>
        <div class="bb">
          ${!meOut && hand.length>=2?`<button class="passbtn" id="bshuf">🔀 シャッフル</button>`:""}
          ${myTurn?`<button id="bdraw" ${B.hover&&B.hover.by===myId?"":"disabled"}>引く</button>`:""}
        </div>
      </div>
    </div>
    ${myMoment?`<div class="ribbon" id="ribbon">▶ あなたの番</div>`:""}
    ${bm?betPanelHtml():`<div class="hand ${myMoment?"myturn":""}" id="hand" style="height:${HG.height}px">${hand.map((c,i)=>cardEl(c,(i===aimedI?"aimed ":"")+(newRound?"deal":""),`--cw:${HG.cw}px;z-index:${HG.pos[i].z};transform:${handTf(HG.pos[i],i===aimedI?20:0)};${newRound?`animation-delay:${i*40}ms`:""}`)).join("")}</div>`}`
    :`<div class="mebar ${bm?"specbar":""}" ${bm?'id="mebar"':""} style="bottom:30px;justify-content:center"><div class="sstat" style="font-size:13px;padding:6px 14px">👀 観戦中${meP&&meP.wait?"（次の回戦から参加）":""} ${S.coins?`<span class="cn">🪙 ${esc(cfmt(coinOf(myId)))}</span>`:""}</div></div>${bm?betPanelHtml():""}`}
  </div>
  ${menuOpen?menuHtml():""}`;
  layoutHand(); placeBar();
  // 狙われてるカードが変わったら知らせる
  const hs = aimedI>=0 ? S.v+":"+aimedI : ""; if(aimedI>=0 && hs.split(":")[1]!==lastHoverSig.split(":")[1]){ sfx("tap"); vib(15); } lastHoverSig=hs;
  if(turnStart) setTimeout(myTurnFx, 60);
  bindChips(); bindSound(); bindMenu(); bindChatBtn();
  if(bm) bindBetPanel();
  if(!amIn) return;
  const fan=document.getElementById("bfan");
  if(fan && myTurn) fan.onclick=e=>{
    const el=e.target.closest("[data-bi]"); if(!el) return;
    const i=+el.dataset.bi;
    if(B.hover && B.hover.by===myId && B.hover.i===i){ fan.onclick=null; act({t:"bdraw",i}); return; }
    sfx("tap"); act({t:"bpeek",i});
  };
  const db=document.getElementById("bdraw"); if(db) db.onclick=()=>{ if(B.hover&&B.hover.by===myId){ db.disabled=true; act({t:"bdraw",i:B.hover.i}); } };
  const sb=document.getElementById("bshuf"); if(sb) sb.onclick=()=>{ sb.disabled=true; act({t:"bshuf"}); };
}
function bigReveal(card, cls, txt){
  const w=document.createElement("div"); w.className="breveal "+(cls||"");
  w.innerHTML=cardEl(card,"","--cw:"+Math.round(Math.min(130,innerWidth*.3))+"px")+(txt?`<b>${esc(txt)}</b>`:"");
  fxLayer.appendChild(w);
  anim(w,[{transform:"translate(-50%,-50%) rotateY(90deg) scale(.6)",opacity:0},{transform:"translate(-50%,-50%) rotateY(0) scale(1.1)",opacity:1,offset:.2},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.3},{transform:"translate(-50%,-50%) scale(1)",opacity:1,offset:.82},{transform:"translate(-50%,-80%) scale(.7)",opacity:0}],{duration:1500,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>w.remove(),1550);
}
function playBabaFx(e){
  switch(e.k){
    case "bdraw": {
      passFlyBacks(e.from,e.to,1); sfx("tap");
      const card=e.priv&&e.priv.card, joker=card&&parse(card).r===16;
      setTimeout(()=>{
        if(e.pair){
          sfx("finish"); const p=seatPoint(e.to); burst(p.x,p.y,{n:20,dist:90,colors:["#fff","#ffd54a","#7cf0ff"]});
          floatText(e.to,"ペア！","win");
          const w=document.createElement("div"); w.className="bpair"; w.innerHTML=e.pair.map(c=>cardEl(c,"","--cw:58px")).join(""); w.style.left=p.x+"px"; w.style.top=p.y+"px"; fxLayer.appendChild(w);
          const f=fieldPoint();
          anim(w,[{transform:"translate(-50%,-50%) scale(.4)",opacity:0},{transform:"translate(-50%,-90%) scale(1.15)",opacity:1,offset:.3},{transform:"translate(-50%,-90%) scale(1)",opacity:1,offset:.6},{transform:`translate(calc(-50% + ${f.x-p.x}px),calc(-50% + ${f.y-p.y+40}px)) scale(.3) rotate(160deg)`,opacity:0}],{duration:1100,easing:"ease-in-out",fill:"forwards"});
          setTimeout(()=>w.remove(),1150);
        }
        if(card && e.to===myId && !e.pair){
          if(joker){ sfx("foul"); darkPulse(); shake(true); vib([100,50,200]); bigReveal(card,"bad","ババを引いた…"); if(dopa()){ kanji("鬼","dark",190,.24,200); rain(["🤡","💀"],18,2000); rgbSplit(500); } cutin("dark","🤡 ババを引いた…","顔に出すなよ",1200); }
          else bigReveal(card,"","");
        }
        if(card && e.from===myId && joker){ sfx("win"); flash("#ffe36a"); confetti(70); if(dopa()){ kanji("脱出","gold",130,.24,150); rain(["✨","🎉"],24,1800); } cutin("win","🤡 ババが出ていった！","ばれないように喜べ",1200); }
      },650);
      break;
    }
    case "bshuf": { sfx("deal"); floatText(e.id,"🔀 シャッフル");
      const el = e.id===myId ? document.getElementById("hand") : document.querySelector(`[data-seat="${CSS.escape(String(e.id))}"] .fan`);
      if(el) [...el.children].forEach((c,i)=>anim(c,[{translate:"0 0"},{translate:`${(Math.random()*2-1)*30}px -${10+Math.random()*16}px`},{translate:"0 0"}],{duration:420,delay:i*12,easing:"ease-in-out"}));
      break; }
  }
}

// ---- 神経衰弱 ----
let kPrevVis=new Set(), kPrevRound=-1;
function kGrid(N, W, H){
  let best=null;
  for(let cols=4; cols<=18; cols++){
    const rows=Math.ceil(N/cols), gap=Math.max(3,Math.round(W*.008));
    const cw=Math.min((W-gap*(cols-1))/cols, (H-gap*(rows-1))/rows/1.42);
    if(!best || cw>best.cw) best={cols,rows,cw:Math.floor(cw),gap};
  }
  return best;
}
function renderShinkei(){
  const K=S.k, myTurn=S.turn===myId;
  const meP=S.players.find(p=>p.id===myId), amIn=meP && S.order.includes(myId);
  const turnStart = myTurn && lastTurn!==myId; lastTurn=S.turn;
  if(kPrevRound!==S.round){ kPrevVis=new Set(); kPrevRound=S.round; }
  const strip = S.order.map(id=>{ const p=S.players.find(x=>x.id===id); if(!p) return "";
    const talk = bubbles[id] && Date.now()-bubbles[id].at<4500;
    return `<div data-seat="${esc(id)}" class="kchip ${S.turn===id?"turn":""} ${id===myId?"me":""} ${talk?"talk":""}">${bubbleHtml(id)}${avatar(p)}<div class="kn">${p.away?"💤":""}${esc(p.name)}</div><div class="ks"><b>${esc(K.scores[id]||0)}</b>組</div>${S.coins?`<div class="kc">🪙${esc(cfmt(coinOf(id)))}</div>`:""}</div>`; }).join("");
  const W=Math.min(isLand()?tableW():(app.clientWidth||innerWidth), isWide()?1500:600)-20;
  const hintX = !isLand() && amIn && firstHint("shinkei") ? 36 : 0;   // 初回ヒント行ぶん、盤の下端と「あなたの番」リボンを上げる
  const top = SAFE.t + (isLand()?112:isWide()?178:162), bottom = SAFE.b + (isLand()?8:isWide()?110:96) + hintX;
  const H=innerHeight-top-bottom;
  const G=kGrid(K.board.length, W, H);
  const vis=new Set();
  const slots=K.board.map((c,i)=>{
    const taken=K.taken[i]!==undefined;
    if(taken) return `<div class="kslot gone" data-k="${i}"></div>`;
    if(c && (K.up.includes(i) || (K.miss&&K.miss.includes(i)))){ vis.add(i); const fresh=!kPrevVis.has(i);
      return `<div class="kslot" data-k="${i}">${cardEl(c,(K.miss&&K.miss.includes(i)?"kmiss ":"kup ")+(fresh?"flipin":""),`--cw:${G.cw}px`)}</div>`; }
    return `<div class="kslot" data-k="${i}">${tback(myTurn?"can":"",`--cw:${G.cw}px`,`data-ki="${i}"`)}</div>`;
  }).join("");
  kPrevVis=vis;
  const left=Object.keys(K.taken).length, total=K.board.length;
  const myMoment=myTurn;
  app.innerHTML=`
  <div class="table shinkei ${myMoment?"myturn":""}">
    ${tableTop("",myMoment,`神経衰弱 第${esc(S.round)}回戦`)}
    <div class="kstrip">${strip}</div>
    <div class="kboard" id="kboard" style="top:${top}px;width:${G.cols*G.cw+(G.cols-1)*G.gap}px;grid-template-columns:repeat(${G.cols},${G.cw}px);gap:${G.gap}px">${slots}</div>
    ${amIn?`
    <div class="mebar kbar" id="mebar" style="bottom:12px">
      ${bubbleHtml(myId)}${firstHint("shinkei")}
      <div class="meinfo">
        <div class="row" style="gap:5px;flex-wrap:nowrap">${miniAva(meP,34)}<div class="plate" style="${myMoment?"background:linear-gradient(#ffe08a,#f5b52e);color:#3a2600":""}">${esc(meP.name)}</div></div>
        <span class="sstat">${esc(K.scores[myId]||0)}組 · 残り${(total-left)/2}組</span>${mecoinHtml()}
      </div>
      <div class="mebtns"><div class="hint" id="hint" aria-live="polite">${myTurn?(K.up.length?"もう1枚めくって！":(K.combo?`🔥 ${K.combo}連続！もう1回`:"2枚めくってね")):`${esc(nameOf(S,S.turn))} の番…`}</div></div>
    </div>
    ${myMoment&&!isLand()?`<div class="ribbon" id="ribbon" style="bottom:${bottom-14}px">▶ あなたの番</div>`:""}`
    :`<div class="mebar" style="bottom:20px;justify-content:center"><div class="sstat" style="font-size:13px;padding:6px 14px">👀 観戦中 ${S.coins?`<span class="cn">🪙 ${esc(cfmt(coinOf(myId)))}</span>`:""}</div></div>`}
  </div>
  ${menuOpen?menuHtml():""}`;
  if(turnStart){ sfx("turn"); vib([30,40,30]); banner("あなたの番！","myturn",false,true); }
  bindChips(); bindSound(); bindMenu(); bindChatBtn();
  if(!amIn || !myTurn) return;
  const kb=document.getElementById("kboard");
  kb.onclick=e=>{ const el=e.target.closest("[data-ki]"); if(!el) return; kb.onclick=null; el.classList.add("pressed"); sfx("tap"); act({t:"kflip",i:+el.dataset.ki}); };
}
function slotCenter(i){ const el=document.querySelector(`[data-k="${CSS.escape(String(i))}"]`); return el?centerOf(el):fieldPoint(); }
function playShinkeiFx(e){
  switch(e.k){
    case "kflip": sfx("tap"); break;
    case "kmatch": {
      const me=e.id===myId, sp=seatPoint(e.id);
      sfx(e.combo>=3?"fanfare":"finish"); vib(me?[40,30,80]:20);
      [e.a,e.b].forEach((i,j)=>{ const c=slotCenter(i), card=(S.k&&S.k.board[i])||e.card;
        const w=document.createElement("div"); w.className="kfly"; w.innerHTML=cardEl(card,"","--cw:60px"); w.style.left=c.x+"px"; w.style.top=c.y+"px"; fxLayer.appendChild(w);
        anim(w,[{transform:"translate(-50%,-50%) scale(1)",opacity:1},{transform:"translate(-50%,-50%) scale(1.35)",opacity:1,offset:.3},{transform:`translate(calc(-50% + ${sp.x-c.x}px),calc(-50% + ${sp.y-c.y}px)) scale(.3) rotate(${j?200:-200}deg)`,opacity:.3}],{duration:900,delay:j*80,easing:"ease-in-out",fill:"forwards"});
        setTimeout(()=>w.remove(),1000);
        burst(c.x,c.y,{n:16,dist:70,colors:["#fff","#7cf0ff","#ffd54a"]}); ring(c.x,c.y,"#7cf0ff",120);
      });
      floatText(e.id,`+1組`,"win");
      if(e.combo>=2){ kanji(e.combo>=4?"神":e.combo>=3?"激":"連", e.combo>=3?"rainbow":"gold", 160, .3, 200); cutin(e.combo>=3?"win":"silver",`🔥 ${e.combo}連続ゲット！`,e.who,1000); if(e.combo>=3){ confetti(60); fireworks(3); } }
      setTimeout(()=>{ burst(sp.x,sp.y,{n:14,dist:60,emoji:"✨",size:6}); }, 900);
      break;
    }
    case "kmiss": sfx("pass"); setTimeout(()=>{ document.querySelectorAll(".kmiss").forEach(el=>anim(el,[{translate:"0 0"},{translate:"-6px 0"},{translate:"6px 0"},{translate:"-4px 0"},{translate:"0 0"}],{duration:360})); },80); floatText(e.id,"ハズレ","pass"); break;
  }
}

