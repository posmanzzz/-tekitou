// =====================================================================
// UNO の画面
// =====================================================================
const U_HEX={R:"#e8202a",Y:"#f5c400",G:"#19a94b",B:"#1f6fd6",K:"#151515"};
function unoCardEl(id, cls="", style=""){
  const {c,v}=pU(id), lab=U_LABEL(v), wild=c==="K";
  const big = v==="F" ? "+4" : v==="D" ? "+2" : lab;
  return `<div class="ucard c-${esc(c)} ${wild?"wild":""} ${cls}" data-c="${esc(id)}" style="${style}">
    <i class="uc-tl">${lab}</i><div class="uc-oval">${wild?`<b class="q"><i></i><i></i><i></i><i></i></b>`:""}<span>${big}</span></div><i class="uc-br">${lab}</i></div>`;
}
const unoBack = (cls="",style="") => `<div class="ucard back ${cls}" style="${style}"><div class="uc-oval"><span>UNO</span></div></div>`;
let wildPick=null, unoSel=null;

function unoSeatHtml(p,x,y,small){
  const cnt = S.counts && S.counts[p.id]!==undefined ? S.counts[p.id] : (S.hands[p.id]||[]).length;
  const k=Math.min(cnt,13), spread=Math.min(110,k*9);
  const backs = Array.from({length:k},(_,i)=>{ const a = k>1 ? -spread/2 + spread*i/(k-1) : 0; return `<i class="bk ubk" style="transform:rotate(${a}deg)"></i>`; }).join("");
  let stat;
  if(S.u.pending && S.u.pending.pid===p.id) stat=`<span class="sstat think">🔁 選択中</span>`;
  else if(cnt===1) stat=`<span class="sstat unoleft">UNO! 1枚</span>`;
  else stat=`<span class="sstat">${esc(cnt)}枚</span>`;
  const tobot = isHost() && mode==="online" && !p.bot ? `<button class="small ghost" data-bot="${esc(p.id)}" style="margin-top:3px;padding:3px 6px;font-size:10px">CPU交代</button>` : "";
  const talk = bubbles[p.id] && Date.now()-bubbles[p.id].at<4500;
  return `<div data-seat="${esc(p.id)}" class="seat ${small?(S.order.length>=9?"xs":"sm"):""} ${talk?"talk":""} ${S.turn===p.id?"turn":""} ${cnt===1?"unoone":""}" style="left:${x}%;top:${y}%">
    ${bubbleHtml(p.id)}
    <div class="plate">${p.away?"💤":""}${esc(p.name)}</div>
    <div class="avawrap"><div class="fan">${backs}</div>${avatar(p)}</div>
    ${stat}${tobot}</div>`;
}
// 自分の操作の状態
function unoControls(){
  const myTurn=S.turn===myId, U=S.u, hand=S.hands[myId]||[];
  const c={hint:"", play:false, label:"出す", draw:false, pass:false, uno:false, dim:null, kind:"play"};
  c.uno = hand.length===2 && !(U.called||{})[myId];
  if(U.pending && U.pending.pid===myId){ c.kind="seven"; c.hint="7: 手札を交換する相手を選んで"; return c; }
  if(U.pending){ c.hint=`${esc(nameOf(S,U.pending.pid))} が交換相手を選んでる…`; return c; }
  if(!myTurn){ c.hint=`${esc(nameOf(S,S.turn))} の番…`; return c; }
  const ok=new Set(hand.filter(x=>!uCanPlay(S,myId,x)));
  c.dim=ok;
  if(U.drew && U.drew.pid===myId){
    c.pass=true; c.hint="引いたカードを出す？出さないならパス";
  } else {
    c.draw=true;
    c.hint = U.stack>0 ? (ok.size?`+${U.stack} が来てる！重ねるか、引く`:`+${U.stack}…引くしかない`) : (ok.size?"光ってるカードが出せるよ":"出せるカードがない…山札から引こう");
  }
  if(unoSel && ok.has(unoSel)){ c.play=true; c.label = isWild(unoSel) ? "色を選んで出す" : "出す"; c.hint = c.hint; }
  return c;
}
function renderUno(){
  const U=S.u, myTurn=S.turn===myId;
  const hand=(S.hands[myId]||[]).slice().sort((a,b)=>{ const A=pU(a),B=pU(b); const ci=x=>"RYGBK".indexOf(x); return ci(A.c)-ci(B.c) || ("0123456789SRDWF".indexOf(A.v)-"0123456789SRDWF".indexOf(B.v)); });
  const meP=S.players.find(p=>p.id===myId), amIn=meP && !meP.away && S.order.includes(myId);
  if(unoSel && !hand.includes(unoSel)) unoSel=null;
  if(U.drew && U.drew.pid===myId && !unoSel) unoSel=U.drew.card;
  const C=unoControls();
  const newRound=S.round!==lastRound; lastRound=S.round;
  const myMoment = myTurn && (!U.pending || U.pending.pid===myId);
  const turnStart = myTurn && !U.pending && lastTurn!==myId; lastTurn=S.turn;
  const top=U.discard[U.discard.length-1];
  const topSig=top+"|"+U.discard.length, newTop=topSig!==lastFieldSig; lastFieldSig=topSig;
  const ord=S.order, mi=ord.indexOf(myId);
  const others = mi>=0 ? ord.slice(mi+1).concat(ord.slice(0,mi)) : ord.slice();
  // 逆回りのときは並べ方も逆にする（左回り/右回りが目で分かる）
  const pos=seatPos(others.length), small=others.length>5;
  const seats=others.map((id,i)=>{ const p=S.players.find(x=>x.id===id); return p?unoSeatHtml(p,pos[i][0],pos[i][1],small):""; }).join("");
  const HG=handGeom(hand.length, tableW());
  const deckN = U.deckN ?? U.deck.length;
  const sevenPick = C.kind==="seven" ? `<div class="sevenpick">${uActive(S).filter(id=>id!==myId).map(id=>`<button data-swap="${esc(id)}">${esc(nameOf(S,id))}<small>${(S.counts||{})[id]??"?"}枚</small></button>`).join("")}</div>` : "";
  app.innerHTML=`
  <div class="table uno ${myMoment?"myturn":""}">
    <div class="led ${myMoment?"rb":""}"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i></div>
    <div class="wm udir">${U.dir>0?"↻":"↺"}</div>
    <div class="tbar">
      <div class="ticker"><div class="rd">UNO 第${esc(S.round)}回戦 · ${esc(roomKey)}</div>${S.log.slice(-2).map(l=>`<div>${esc(l)}</div>`).join("")}</div>
      ${mode==="online"?chatBtn():""}${soundBtn("round")}<button class="round" id="menu" title="メニュー" aria-label="メニュー">≡</button>
    </div>
    ${seats}
    <div class="field ufield" style="top:${isLand()?(SAFE.t+118)/innerHeight*100:isWide()?38:others.length>5?47:others.length>=4?44:40}%">
      <div class="urow">
        <button class="udeck ${C.draw?"can":""}" id="udeck" ${C.draw?"":"disabled"}>${unoBack("big")}<span class="dn">${esc(deckN)}</span>${C.draw?`<em>引く</em>`:""}</button>
        <div class="udiscard c-${esc(U.color)}">
          <div class="udirring ${U.dir>0?"cw":"ccw"}"></div>
          ${unoCardEl(top,"big"+(newTop?" utop":""))}
        </div>
      </div>
      <div class="ucolor">今の色 <b class="c-${esc(U.color)}">${esc(UNO_COLOR_NAME[U.color])}</b>${U.stack>0?` <span class="ustack">+${esc(U.stack)} たまってる！</span>`:""}</div>
    </div>
    ${amIn?`
    <div class="mebar" id="mebar">
      ${bubbleHtml(myId)}${firstHint("uno")}
      <div class="meinfo">
        <div class="row" style="gap:5px;flex-wrap:nowrap">${miniAva(meP,34)}<div class="plate" style="${myMoment?"background:linear-gradient(#ffe08a,#f5b52e);color:#3a2600":""}">${esc(meP.name)}</div></div>
        <span class="sstat ${hand.length===1?"unoleft":""}">${hand.length}枚${(U.called||{})[myId]?" · UNO宣言済":""}</span>
      </div>
      <div class="mebtns">
        ${sevenPick}
        <div class="hint" id="hint" aria-live="polite">${C.hint}</div>
        <div class="bb">
          ${C.uno?`<button class="unobtn" id="unobtn">UNO!</button>`:""}
          ${C.pass?`<button class="passbtn" id="upass">パス</button>`:""}
          ${C.kind==="play"?`<button id="play" ${C.play?"":"disabled"}>${C.label}</button>`:""}
        </div>
      </div>
    </div>
    ${myMoment?`<div class="ribbon" id="ribbon">${U.pending?"▶ 選んでね":"▶ あなたの番"}</div>`:""}
    <div class="hand ${myMoment?"myturn":""}" id="hand" style="height:${HG.height}px">${hand.map((c,i)=>unoCardEl(c,(unoSel===c?"sel ":"")+(C.dim&&!C.dim.has(c)?"dim ":"")+(newRound?"deal":""),`--cw:${HG.cw}px;z-index:${HG.pos[i].z};transform:${handTf(HG.pos[i],unoSel===c?24:0)};${newRound?`animation-delay:${i*40}ms`:""}`)).join("")}</div>`
    :`<div class="mebar" style="bottom:30px;justify-content:center"><div class="sstat" style="font-size:13px;padding:6px 14px">👀 観戦中${meP&&meP.wait?"（次の回戦から参加）":""}</div></div>`}
  </div>
  ${wildPick?`<div class="wildpick" id="wildpick"><div class="inner"><b>色を選んでね</b><div class="wg">${UNO_COLORS.map(c=>`<button class="c-${c}" data-wc="${c}">${UNO_COLOR_NAME[c]}</button>`).join("")}</div><button class="ghost small" id="wcancel">やめる</button></div></div>`:""}
  ${menuOpen?menuHtml():""}`;
  layoutHand(); placeBar();
  if(turnStart) setTimeout(myTurnFx, 60);
  bindChips(); bindSound(); bindMenu(); bindChatBtn();
  if(!amIn) return;
  const doPlay=(card)=>{ if(isWild(card)){ wildPick=card; renderUno(); return; } unoSel=null; act({t:"uplay",card}); };
  document.getElementById("hand").onclick=e=>{
    const el=topCardAt(e,".ucard"); if(!el) return;
    const c=el.dataset.c, K=unoControls();
    if(!myTurn || K.kind!=="play"){ sfx("tap"); return; }
    const err=uCanPlay(S,myId,c);
    if(err){ toast(err); anim(el,[{translate:"0 0"},{translate:"-6px 0"},{translate:"6px 0"},{translate:"0 0"}],{duration:220}); return; }
    if(unoSel===c){ doPlay(c); return; }          // 2回タップで出す
    unoSel=c; sfx("tap"); renderUno();
  };
  const pb=document.getElementById("play"); if(pb) pb.onclick=()=>{ if(unoSel){ pb.disabled=true; doPlay(unoSel); } };
  const dk=document.getElementById("udeck"); if(dk) dk.onclick=()=>{ dk.disabled=true; unoSel=null; act({t:"udraw"}); };
  const ps=document.getElementById("upass"); if(ps) ps.onclick=()=>{ ps.disabled=true; unoSel=null; act({t:"upass"}); };
  const ub=document.getElementById("unobtn"); if(ub) ub.onclick=()=>{ ub.disabled=true; act({t:"uno"}); };
  app.querySelectorAll("[data-swap]").forEach(b=>b.onclick=()=>act({t:"useven",target:b.dataset.swap}));
  app.querySelectorAll("[data-wc]").forEach(b=>b.onclick=()=>{ const card=wildPick; wildPick=null; unoSel=null; act({t:"uplay",card,color:b.dataset.wc}); });
  const wc=document.getElementById("wcancel"); if(wc) wc.onclick=()=>{ wildPick=null; renderUno(); };
}
// ---- UNO の演出 ----
function uFly(e){
  const el=document.querySelector(".udiscard .ucard"); if(!el) return;
  const from=seatPoint(e.id), cc=centerOf(el);
  anim(el,[{transform:`translate(${from.x-cc.x}px,${from.y-cc.y}px) scale(.4) rotate(-40deg)`,opacity:.5},{transform:"none",opacity:1}],{duration:380,easing:"cubic-bezier(.2,1.25,.4,1)",fill:"backwards"});
  setTimeout(()=>{ const p=centerOf(el); burst(p.x,p.y,{n:12,dist:70,size:6,colors:[U_HEX[e.color]||"#fff","#fff"]}); },380);
}
function colorWash(c){
  const o=overlay("ov-color",[{opacity:0},{opacity:.55,offset:.2},{opacity:0}],900);
  o.style.background=`radial-gradient(circle at 50% 45%, ${U_HEX[c]} 0%, ${U_HEX[c]}aa 35%, transparent 75%)`;
}
function playUnoFx(e){
  const K={R:"red",Y:"gold",G:"green",B:"blue"};
  switch(e.k){
    case "uplay": sfx("play"); uFly(e); break;
    case "ucolor": setTimeout(()=>{ sfx("kyuin"); colorWash(e.color); kanji(UNO_COLOR_NAME[e.color],K[e.color],170,.27); cutin("u"+e.color, `🎨 ${UNO_COLOR_NAME[e.color]}に変更`, e.who||"", 1000); },380); break;
    case "uskip": setTimeout(()=>{ sfx("skip"); speedSwipe(); floatText(e.id,"⊘ スキップ"); kanji("飛","gold",170,.27); cutin("skip","⊘ スキップ",`${nameOf(S,e.id)} の番が飛ばされた`,1000); },380); break;
    case "urev": setTimeout(()=>{ sfx("eb"); speedSwipe(); kanji("逆","blue",170,.27); cutin("eb","⇄ リバース", e.dir>0?"右回り ↻":"左回り ↺", 1000); },380); break;
    case "udraw": setTimeout(()=>{
        sfx(e.total>=4?"bomb":"thud"); shake(e.total>=4); hitStop(e.total>=4?2:1);
        if(e.total>=4){ flash("#ff2a3a"); rgbSplit(500); }
        kanji(`+${e.total}`, e.total>=6?"rainbow":"red", undefined, .27);
        cutin(e.total>=4?"bomb":"rev", e.stack?`💥 +${e.total} 重なった！`:`💥 +${e.n}`, `${nameOf(S,e.to)} ${e.stack?"に迫る…":"が引いてスキップ"}`, 1100);
        floatText(e.to, `+${e.stack?e.total:e.n}`);
      },380); break;
    case "udrawn": if(e.big){ sfx("bomb"); shake(true); darkPulse(); floatText(e.id,`😵 +${e.n}`); kanji("撃沈","dark",undefined,.3); if(e.id===myId) rain(["🃏","😵"],24,2000); } else { sfx("tap"); floatText(e.id,`+${e.n}`); } break;
    case "unocall": sfx("chat"); floatText(e.id,"📣 UNO宣言"); break;
    case "uno": setTimeout(()=>{ sfx("alarm"); alarmFrame(); kanji("UNO!","rainbow",undefined,.27); cutin("reach","📣 UNO!", e.id===myId?"あと1枚！":`${e.who} があと1枚！`,1100); },380); break;
    case "unofail": setTimeout(()=>{ sfx("foul"); darkPulse(); shake(true); kanji("罰","dark",180,.27); cutin("dark","😱 UNO言い忘れ",`${e.who} は2枚ペナルティ`,1200); },380); break;
    case "useven": sfx("seven"); passFlyBacks(e.from,e.to,4); passFlyBacks(e.to,e.from,4); kanji("換","gold",170,.27); cutin("seven","🔁 手札交換",`${nameOf(S,e.from)} ⇄ ${nameOf(S,e.to)}`,1100); break;
    case "uzero": sfx("skip"); speedSwipe(); kanji("廻","blue",170,.27); cutin("eb","🔄 0：全員の手札が回る","",1100); break;
    case "game": sfx("kyuin"); cutin(e.g==="daifugo"?"win":"joker", ({daifugo:"🃏 大富豪",uno:"🎴 UNO",baba:"🤡 ババ抜き",shinkei:"🧠 神経衰弱"})[e.g]||"", "ゲームを切り替えたよ", 1100); break;
  }
}

