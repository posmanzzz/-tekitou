// ---------- 卓 ----------
const SEAT_POS={
  1:[[50,13]],
  2:[[25,18],[75,18]],
  3:[[15,27],[50,13],[85,27]],
  4:[[13,31],[34,14],[66,14],[87,31]],
  5:[[13,35],[27,16],[50,12.5],[73,16],[87,35]],
};
// 画面の形は3種類: 縦（スマホ・タブレット縦）/ 横長PC（wide）/ 低い横画面（land: 横向きスマホ。操作ボタンを右の列に出す）
const LAND_RC=196;      // land の右列（操作ボタン）の幅
const isLand = () => innerHeight<=520 && innerWidth>innerHeight*1.3;
const isWide = () => !isLand() && innerWidth>=900 && innerWidth/innerHeight>=1.15;
const layKey = () => isLand()?"l":isWide()?"w":"p";
const tableW = () => isLand() ? Math.max(200,innerWidth-LAND_RC-SAFE.l-SAFE.r) : isWide() ? (app.clientWidth||innerWidth) : Math.min(app.clientWidth||innerWidth,560);
function seatPos(k){
  if(isLand()){      // 上に1列で並べる（扇のカード裏は出さない）
    const y=(SAFE.t+46)/innerHeight*100, l=(SAFE.l+8)/innerWidth*100, r=100-(SAFE.r+8)/innerWidth*100, out=[];
    for(let i=0;i<k;i++) out.push([l+(r-l)*(i+.5)/k, y]);
    return out;
  }
  if(isWide()){   // 横長：楕円の上半分に並べる
    const out=[]; for(let i=0;i<k;i++){ const a=Math.PI*(1-(i+1)/(k+1)); out.push([50+41*Math.cos(a), 46-34*Math.sin(a)]); } return out;
  }
  const minY=(SAFE.t+10+(innerHeight<=700?50:68)+6)/innerHeight*100;     // 上の帯の下から並べる
  if(SEAT_POS[k]) return SEAT_POS[k].map(([x,y])=>[x,Math.max(y,minY)]);
  const out=[];
  for(let i=0;i<k;i++){ const t=i/(k-1), ang=Math.PI*(1-t); out.push([50+39*Math.cos(ang), Math.max(minY,40-28*Math.sin(ang))]); }
  return out;
}
// ---- カード交換（2戦目〜）の表示用 ----
const xcText = c => { const q=parse(c); return q.r===16 ? "JOKER" : SUIT_SYM[q.s]+RANK_LABEL(q.r); };
const xcList = cs => cs.map(xcText).join(" と ");
const xTitle = id => (S.titles&&S.titles[id]) || nameOf(S,id);
// 自分が交換の当事者なら {P, rich}（took/gave は当事者にしか届かない）
function xMine(){ const X=S&&S.xchg; if(!X) return null; const P=X.pairs.find(q=>q.rich===myId||q.poor===myId); return P?{P, rich:P.rich===myId}:null; }
function xchgBox(){
  const X=S.xchg, m=xMine(), mini=cs=>`<div class="xcards">${cs.map(c=>cardEl(c,"xc")).join("")}</div>`;
  let h=`<div class="xhead">🎁 カード交換</div>`;
  if(m && !m.rich){
    const P=m.P;
    h+=`<div class="xline">${esc(xTitle(P.rich))}に <b>${esc(xcList(P.took||[]))}</b> を取られた…</div>${mini(P.took||[])}`;
    h+= P.ok && P.gave ? `<div class="xline ok">${esc(xTitle(P.rich))}から <b>${esc(xcList(P.gave))}</b> をもらった</div>${mini(P.gave)}`
                       : `<div class="xline wait">${esc(xTitle(P.rich))}が渡すカードを選んでる…</div>`;
  } else if(m && m.rich){
    const P=m.P;
    h+=`<div class="xline">${esc(xTitle(P.poor))}から <b>${esc(xcList(P.took||[]))}</b> をもらった</div>${mini(P.took||[])}`;
    h+= P.ok && P.gave ? `<div class="xline ok">${esc(xTitle(P.poor))}に <b>${esc(xcList(P.gave))}</b> を渡した${S.xchg.on?"（みんなを待ってるよ）":""}</div>${mini(P.gave)}`
                       : `<div class="xline wait">手札に緑のふちで光ってるのが、もらったカード</div>`;
  } else {
    h+=`<div class="xline">${X.pairs.map(P=>`<span class="xst ${P.ok?"ok":""}">${esc(xTitle(P.rich))} ${esc(nameOf(S,P.rich))}：${P.ok?"渡した":"選んでる…"}</span>`).join("")}</div>`;
  }
  return `<div class="xbox">${h}</div>`;
}
function seatHtml(p,x,y,small){
  const fin=S.finished.indexOf(p.id), lost=S.losers.includes(p.id);
  const cnt = S.counts && S.counts[p.id]!==undefined ? S.counts[p.id] : (S.hands[p.id]||[]).length;
  const k=Math.min(cnt,13), spread=Math.min(110,k*9);
  const backs = Array.from({length:k},(_,i)=>{ const a = k>1 ? -spread/2 + spread*i/(k-1) : 0; return `<i class="bk" style="transform:rotate(${a}deg)"></i>`; }).join("");
  let stat;
  if(fin>=0) stat=`<span class="sstat win">${fin+1}位 上がり</span>`;
  else if(lost) stat=`<span class="sstat lose">最下位</span>`;
  else if(xchgPending(S,p.id)) stat=`<span class="sstat think">🎁 選択中</span>`;
  else if(S.pending && S.pending.pid===p.id) stat=`<span class="sstat think">${S.pending.type==="seven"?"🎁 選択中":"💣 選択中"}</span>`;
  else if(S.passed.includes(p.id)) stat=`<span class="sstat pass">パス · ${esc(cnt)}枚</span>`;
  else stat=`<span class="sstat">${esc(cnt)}枚</span>`;
  const title=S.titles&&S.titles[p.id];
  const tobot = isHost() && mode==="online" && !p.bot && fin<0 && !lost ? `<button class="small ghost" data-bot="${esc(p.id)}" style="margin-top:3px;padding:3px 6px;font-size:10px">CPU交代</button>` : "";
  const talk = bubbles[p.id] && Date.now()-bubbles[p.id].at<4500;
  return `<div data-seat="${esc(p.id)}" class="seat ${small?(S.order.length>=9?"xs":"sm"):""} ${talk?"talk":""} ${S.turn===p.id&&!xchgOn(S)?"turn":""} ${fin>=0||lost?"out":""}" style="left:${x}%;top:${y}%">
    ${bubbleHtml(p.id)}
    <div class="plate">${p.away?"💤":""}${esc(p.name)}</div>
    <div class="avawrap"><div class="fan">${backs}</div>${avatar(p)}${title?`<span class="title ${title==="大富豪"?"gold":""}">${esc(title)}</span>`:""}${scoinHtml(p.id)}</div>
    ${stat}${tobot}</div>`;
}

// 手札の扇配置（純関数）。描画時に最初から正しい位置に置くので、再描画でカードが飛ばない
function handGeom(n, W){
  const land=isLand(), wide=isWide();
  const cap = land ? Math.min(58, innerHeight*.15) : wide ? Math.min(108, innerHeight*(n>24?.095:.14)) : Math.min(72, Math.max(46, innerHeight*.11));
  let cw=Math.round(Math.min(cap, Math.max(land?34:46, W/5.6))), ch=cw*1.42;
  const two0 = !land && !wide && n>8;
  const geom1=m=>{ const spread=Math.min(28,m*2.4), half=spread/2*Math.PI/180, margin=6+ch*Math.sin(half); return {spread, margin, step:m>1?Math.min(cw*.7,(W-2*margin-cw)/(m-1)):0}; };
  // 1段だと重なりすぎてタップしづらい（1枚あたり26px未満）ときは2段にする。横画面（land）は高さがないので1段のまま
  const lim = wide ? 24 : land ? 40 : 15;
  const split = (n>lim || (!land && !wide && n>8 && geom1(n).step<26)) ? Math.ceil(n/2) : n;
  const rows = split<n ? [split, n-split] : [n];
  if(rows.length===2 && !wide && !land){ cw=Math.round(cw*(innerHeight<700?.88:.95)); ch=cw*1.42; }       // 2段のときは少し小さくして縦を節約
  const rowGap=Math.round(ch*.5), pos=[]; let maxBottom=0;
  rows.forEach((m,ri)=>{
    const base=(land?8:rows.length===2?20:26)+ri*rowGap, g=geom1(m), spread=g.spread, step=g.step, drop=(land?12:22)*(spread/28);
    for(let i=0;i<m;i++){
      const t=m>1?i/(m-1)-.5:0, x=W/2+(i-(m-1)/2)*step-cw/2, y=base+t*t*4*drop;
      pos.push({x,y,rot:t*spread,z:ri*100+i+1}); maxBottom=Math.max(maxBottom,y+ch);
    }
  });
  // 傾けたカードの角が下にはみ出す分＋下のLED枠ぶん余白をとる
  const tilt=Math.ceil(cw/2*Math.sin(Math.min(28,Math.max(...rows)*2.4)/2*Math.PI/180));
  return {cw, pos, height:maxBottom+(land?10:18)+tilt, rows:rows.length};
}
const handTf = (p,lift) => `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) rotate(${p.rot.toFixed(2)}deg) translateY(${-lift}px)`;
function layoutHand(){
  const el=document.getElementById("hand"); if(!el) return;
  const cards=[...el.querySelectorAll(".card,.ucard")], G=handGeom(cards.length, el.clientWidth);
  cards.forEach((c,i)=>{ c.style.setProperty("--cw",G.cw+"px"); c.style.setProperty("--i",i); c.style.zIndex=G.pos[i].z; c.style.transform=handTf(G.pos[i], c.classList.contains("sel")||c.classList.contains("aimed")?22:0); });
  el.style.height=G.height+"px";
}
let wasWide=null;
function applyWide(){ readSafe(); const k=layKey(); document.body.classList.toggle("wide",k==="w"); document.body.classList.toggle("land",k==="l"); if(wasWide!==null && k!==wasWide && S){ lastSig=""; render(); } wasWide=k; }
applyWide();
window.addEventListener("resize", ()=>{ applyWide(); layoutHand(); placeBar(); });
window.addEventListener("orientationchange", ()=>setTimeout(()=>{ applyWide(); layoutHand(); placeBar(); },120));
// 操作バーと「あなたの番」リボンを手札の上に置く。読み(offsetHeight)を先にまとめてから書く＝強制レイアウトを1回で済ませる
function placeBar(){
  const hand=document.getElementById("hand")||document.getElementById("betpanel"), bar=document.getElementById("mebar"), rb=document.getElementById("ribbon");
  if(!bar || !hand) return;                    // 神経衰弱の操作バーは別配置（手札なし）
  if(isLand()){                                // 横画面: 操作バーは右の列（CSS）。リボンはその真上
    bar.style.bottom=""; if(rb) rb.style.bottom=(bar.offsetHeight+SAFE.b+12)+"px"; return;
  }
  const hh=hand.offsetHeight, bh=rb?bar.offsetHeight:0;
  bar.style.bottom=(hand.id==="betpanel" ? (parseFloat(getComputedStyle(hand).bottom)||0)+hh+6 : hh+SAFE.b+4)+"px";
  if(rb) rb.style.bottom=(hh+SAFE.b+4+bh+4)+"px";
  fitField();
  // 登場アニメ中は席やリボンの矩形が動いているので、落ち着いてからもう一度だけ合わせ直す
  clearTimeout(placeBar.t); placeBar.t=setTimeout(()=>{ if(!isLand()) fitField(); },750);
}
// 場（中央）を「席の下〜操作バーの上」のすき間の真ん中に置き、入りきらないときは縮める（縦に短い画面や10人卓で重ならないように）
function fitField(){
  const f=document.querySelector(".table .field"), bar=document.getElementById("mebar"), T=document.querySelector(".table");
  if(!f||!bar||!T) return;
  f.style.scale=""; if(isLand()) return;
  const wide=isWide();
  const tr=T.getBoundingClientRect(), rb=document.getElementById("ribbon");
  const nat=f.offsetHeight, cw0=[...f.children].reduce((m,c)=>Math.max(m,c.offsetWidth),0)||200;
  const barTop=Math.min(bar.getBoundingClientRect().top, rb?rb.getBoundingClientRect().top:1e9)-tr.top;
  const seats=[...document.querySelectorAll(".table .seat")].map(s=>s.getBoundingClientRect());
  let k=1, top0=0, avail=0; const cx=tr.left+tr.width/2;
  for(let it=0;it<3;it++){
    const basis = wide ? Math.max(cw0, Math.min(f.offsetWidth, tr.width*.42)) : cw0;   // 横長PCは場の枠（パネル）の幅で席との重なりを見る
    const w=basis*k/2+6; let sb=0;
    seats.forEach(r=>{ if(r.right>cx-w && r.left<cx+w) sb=Math.max(sb,r.bottom-tr.top); });
    if(!sb) sb=(parseFloat(f.style.top)||0)/100*tr.height*0;   // 席が上に無ければ上の帯の下
    top0=Math.max(sb,SAFE.t+(wide?78:60))+4; avail=barTop-4-top0;
    k=Math.max(.42,Math.min(1,avail/nat));
  }
  if(avail<=0){ k=.42; avail=Math.max(avail,nat*k); }
  const cy=top0+Math.max(avail,nat*k)/2;
  f.style.top=(cy-nat/2)+"px"; if(k<.995) f.style.scale=k.toFixed(3);
}

// 自分の操作ボタンの状態
function controls(){
  const myTurn=S.turn===myId, P=S.pending, cs=[...sel];
  const c={hint:"", label:"出す", enabled:false, pass:false, kind:"play", dim:null};
  if(xchgOn(S)){
    const m=xMine(), XP=xchgPending(S,myId);
    if(XP){ c.kind="xgive"; c.label=`🎁 渡す（${cs.length}/${XP.k}）`; c.enabled=cs.length===XP.k;
      c.hint= cs.length>XP.k ? `${esc(XP.k)}枚だけ選んでね（いま${esc(cs.length)}枚）` : `${esc(xTitle(XP.poor))}に渡すカードを${esc(XP.k)}枚選んでね`; return c; }
    if(m && m.rich) c.hint="渡した！ ほかの人が選ぶのを待ってるよ";
    else if(m) c.hint= m.P.ok ? "もらったカードは緑のふちで光ってるよ" : `${esc(xTitle(m.P.rich))}が渡すカードを選んでる…`;
    else c.hint=`カード交換中…（${esc(S.xchg.pairs.filter(q=>!q.ok).map(q=>nameOf(S,q.rich)).join("、"))} が選んでる）`;
    return c;
  }
  if(P && P.pid===myId){
    if(P.type==="seven"){
      c.kind="give"; c.label=`🎁 渡す（${cs.length}/${P.n}）`; c.enabled=cs.length===P.n;
      c.hint=`7渡し: ${esc(nameOf(S,P.to))} に渡すカードを${esc(P.n)}枚選んで`;
    } else {
      c.kind="bomb"; c.label=`💣 爆破（${bombSel.size}/${P.n}）`; c.enabled=bombSel.size===P.n;
      c.hint=`12ボンバー: 全員から消す数字を${esc(P.n)}つ選んで`;
    }
    return c;
  }
  if(P){ c.hint=`${esc(nameOf(S,P.pid))} が${P.type==="seven"?"7渡し":"12ボンバー"}を選んでる…`; return c; }
  if(!myTurn){ c.hint=`${esc(nameOf(S,S.turn))} の番…`; return c; }
  const playable=new Set(); candidates(S,myId).forEach(cb=>cb.forEach(x=>playable.add(x)));
  c.dim=playable; c.pass=!!S.field;
  if(cs.length){ const e=canPlay(S,myId,cs); c.enabled=!e; c.hint=e||"これで出せる！"; c.label=`出す（${cs.length}）`; }
  else c.hint = S.field ? (playable.size?"明るいカードが出せるよ":"出せるカードがない…パスしよう") : "親！好きなカードを出そう";
  return c;
}

function renderGame(){
  const rev=effRev(S);
  const myHand = mySort(S.hands[myId]||[], rev);
  const xon = xchgOn(S), XP = xon ? xchgPending(S,myId) : null, XM = xMine();
  const gotSet = new Set(XM ? (XM.rich ? (XM.P.took||[]) : (XM.P.gave||[])) : []);       // もらったカード（手札にあるぶん）
  const xshow = xon || !!(XM && S.lastPlayer===null);      // 交換中と、交換が終わってから最初の1枚が出るまでは、交換の記録を場に出す
  const myTurn = S.turn===myId && !xon;
  const meP = S.players.find(p=>p.id===myId);
  const amIn = meP && !meP.away && S.order.includes(myId);
  [...sel].forEach(c=>{ if(!myHand.includes(c)) sel.delete(c); });
  if(!(S.pending && S.pending.pid===myId && S.pending.type==="bomb")) bombSel.clear();
  const C=controls();
  const f=S.field;
  const fsig = f ? f.cards.join()+f.by : "";
  const newField = fsig && fsig!==lastFieldSig; lastFieldSig=fsig;
  const newRound = S.round!==lastRound; lastRound=S.round;
  if(newRound) sel.clear();
  const myMoment = xon ? !!XP : myTurn && (!S.pending || S.pending.pid===myId);
  const turnStart = myTurn && !S.pending && lastTurn!==myId;
  lastTurn = xon ? null : S.turn;
  const oldF=document.querySelector(".fieldcards");
  if(oldF && oldF.children.length) prevField={html:oldF.innerHTML, rect:oldF.getBoundingClientRect()};

  const ord=S.order;
  const mi=ord.indexOf(myId);
  const others = mi>=0 ? ord.slice(mi+1).concat(ord.slice(0,mi)) : ord.slice();
  const pos = seatPos(others.length), small = others.length>5;
  const seats = others.map((id,i)=>{ const p=S.players.find(x=>x.id===id); return p?seatHtml(p,pos[i][0],pos[i][1],small):""; }).join("");

  const fin=S.finished.indexOf(myId), lost=S.losers.includes(myId);
  const tags = [rev?`<span class="tag">${S.rev?"革命中":"逆転中"}</span>`:"", S.eb?`<span class="tag eb">11バック</span>`:"", S.lock?`<span class="tag lock">縛り ${S.lock.map(x=>SUIT_SYM[x]).join("")}</span>`:"", S.stair&&S.field?`<span class="tag lock">🪜階段縛り 次は${nextRank(S.field.rank,rev)?RANK_LABEL(nextRank(S.field.rank,rev)):"なし"}</span>`:""].join("");
  const lastLogs = S.log.slice(-2);
  const myTitle = S.titles && S.titles[myId];
  const fieldTop = isLand() ? (SAFE.t+118)/innerHeight*100 : isWide() ? 40 : others.length>5 ? 50 : others.length>=4 ? 47 : 42;
  const watchers = S.players.filter(p=>!S.order.includes(p.id));
  const HG = handGeom(myHand.length, tableW());
  const bm = betMode();
  const bombPicker = C.kind==="bomb" ? `<div class="bombpick">${[3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(r=>`<button class="${bombSel.has(r)?"on":""}" data-rank="${r}">${r===16?"🃏":RANK_LABEL(r)}</button>`).join("")}</div>` : "";
  app.innerHTML=`
  <div class="table ${myMoment?"myturn":""}">
    <div class="led ${myMoment?"rb":""}"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i></div>
    ${S.rev?`<div class="wm rev">革命</div>`:""}${S.eb?`<div class="wm eb">11<br>BACK</div>`:""}${S.lock?`<div class="wm lock ${S.lock.some(x=>x==="H"||x==="D")?"red":""}">🔒${S.lock.map(x=>SUIT_SYM[x]).join("")}</div>`:""}
    <div class="tbar">
      <div class="ticker"><div class="rd">第${esc(S.round)}ラウンド · ${esc(roomKey)}${watchers.length?` · 観戦${watchers.length}`:""}</div>${lastLogs.map(l=>`<div>${esc(l)}</div>`).join("")}</div>
      ${mode==="online"?chatBtn():""}${soundBtn("round")}<button class="round" id="menu" title="メニュー" aria-label="メニュー">≡</button>
    </div>
    ${seats}
    <div class="field ${xshow?"xf":""}" style="top:${fieldTop}%">
      ${tags?`<div class="tags">${tags}</div>`:""}
      ${xshow?xchgBox():f?`<div class="fieldcards">${f.cards.map(c=>cardEl(c)).join("")}</div><div class="fieldby">${esc(nameOf(S,f.by))}</div>`
         :`<div class="fieldby" style="opacity:.6">場は空っぽ</div>`}
    </div>
    ${amIn?`
    <div class="mebar ${bm?"bmode":""}" id="mebar">
      ${bubbleHtml(myId)}${bm?"":firstHint("daifugo")}
      <div class="meinfo">
        <div class="row" style="gap:5px;flex-wrap:nowrap">${miniAva(meP,34)}<div class="plate" style="${myMoment?"background:linear-gradient(#ffe08a,#f5b52e);color:#3a2600":""}">${esc(meP.name)}${myTitle?` · ${esc(myTitle)}`:""}</div></div>
        <span class="sstat ${fin>=0?"win":lost?"lose":""}">${fin>=0?`${fin+1}位 上がり！`:lost?"最下位…":`${myHand.length}枚`}</span>${mecoinHtml()}
      </div>
      <div class="mebtns">
        ${bombPicker}
        <div class="hintrow"><div class="hint" id="hint" aria-live="polite">${C.hint}</div><button class="small ghost" id="unsel" ${sel.size&&C.kind!=="bomb"?"":"hidden"}>選択を解除</button></div>
        <div class="bb">${C.kind==="play"?`<button class="passbtn" id="pass" ${C.pass?"":"disabled"}>パス</button>`:""}<button id="play" ${C.enabled?"":"disabled"}>${C.label}</button></div>
      </div>
    </div>
    ${myMoment?`<div class="ribbon" id="ribbon">${xon?"▶ 渡すカードを選んでね":S.pending?"▶ 選んでね":"▶ あなたの番"}</div>`:""}
    ${bm?betPanelHtml():`<div class="hand ${myMoment?"myturn":""}" id="hand" style="height:${HG.height}px">${myHand.map((c,i)=>cardEl(c,(sel.has(c)?"sel ":"")+(C.dim&&!C.dim.has(c)?"dim ":"")+(gotSet.has(c)?"got ":"")+(newRound?"deal":""),`--cw:${HG.cw}px;z-index:${HG.pos[i].z};transform:${handTf(HG.pos[i],sel.has(c)?24:0)};${newRound?`animation-delay:${i*40}ms`:""}`)).join("")}</div>`}`
    :`<div class="mebar ${bm?"specbar":""}" ${bm?'id="mebar"':""} style="bottom:30px;justify-content:center"><div class="sstat" style="font-size:13px;padding:6px 14px">👀 観戦中${meP&&meP.wait?"（次のラウンドから参加）":""} ${scoinHtml(myId)?`<span class="cn">🪙 ${esc(cfmt(coinOf(myId)))}</span>`:""}</div></div>${bm?betPanelHtml():""}`}
  </div>
  ${menuOpen?menuHtml():""}`;
  layoutHand(); placeBar();
  if(turnStart) setTimeout(myTurnFx, 60);
  bindChips(); bindSound(); bindMenu(); bindChatBtn();
  if(bm) bindBetPanel();
  if(!amIn || bm) return;
  const hand=document.getElementById("hand");
  // 選択まわり。1回タップ=その1枚、素早く2回タップ=同じ数字で出せるカードをまとめて選ぶ（もう1回2連打で解除）、見た目で一番上のカードを拾う
  const syncSel=()=>{
    hand.querySelectorAll(".card").forEach(x=>x.classList.toggle("sel",sel.has(x.dataset.c)));
    layoutHand(); applyKbFocus();
    const K=controls(), pb=document.getElementById("play");
    pb.disabled=!K.enabled; pb.textContent=K.label; document.getElementById("hint").innerHTML=K.hint;
    const us=document.getElementById("unsel"); if(us) us.hidden=!(sel.size && K.kind!=="bomb");
    placeBar();   // 「選択を解除」や文言で操作バーの高さが変わるので、リボンとバーの位置を合わせ直す
  };
  hand.onclick=e=>{
    const el=topCardAt(e,".card"); if(!el) return;
    const P=S.pending;
    if(P && P.pid===myId && P.type==="bomb") return;
    let c=el.dataset.c; const now=Date.now(), kbd=e.detail===0&&e.clientX===0&&e.clientY===0;
    // 2回タップ: 同じカード、または1回目と同じ場所（選んだカードが浮き沈みして、指の下が別のカードになることがある）
    if(!kbd && tapMemo.pre && now-tapMemo.t<380 && (tapMemo.c===c || Math.hypot(e.clientX-tapMemo.x,e.clientY-tapMemo.y)<28)){
      c=tapMemo.c; sel.clear(); tapMemo.pre.forEach(x=>sel.add(x)); tapMemo.c=""; tapMemo.pre=null;
      const r=parse(c).r;
      let grp=[...hand.querySelectorAll(".card:not(.dim)")].map(x=>x.dataset.c).filter(x=>parse(x).r===r);
      grp=[c,...grp.filter(x=>x!==c)];
      if(S.field && !S.pending && S.field.type==="group" && grp.length>S.field.cards.length) grp=grp.slice(0,S.field.cards.length);   // 場の枚数に合わせる
      if(P && P.type==="seven" && P.pid===myId) grp=grp.slice(0,P.n);
      { const xp=xchgPending(S,myId); if(xp) grp=grp.slice(0,xp.k); }
      if(grp.every(x=>sel.has(x))) grp.forEach(x=>sel.delete(x)); else { grp.forEach(x=>sel.add(x)); if(grp.length>1) vib(12); }
      sfx("tap"); syncSel(); return;
    }
    tapMemo={c,t:now,pre:new Set(sel),x:e.clientX,y:e.clientY};
    if(sel.has(c)) sel.delete(c);
    else { if(P && P.type==="seven" && P.pid===myId && sel.size>=P.n) return toast(`${P.n}枚まで`); sel.add(c); }
    el.classList.remove("deal"); sfx("tap"); syncSel();
  };
  const us=document.getElementById("unsel"); if(us) us.onclick=()=>{ sel.clear(); sfx("tap"); syncSel(); };
  app.querySelectorAll("[data-rank]").forEach(b=>b.onclick=()=>{
    const r=+b.dataset.rank, P=S.pending;
    if(bombSel.has(r)) bombSel.delete(r); else { if(bombSel.size>=P.n) return toast(`${P.n}つまで`); bombSel.add(r); }
    sfx("tap"); renderGame();
  });
  document.getElementById("play").onclick=(ev)=>{
    ev.currentTarget.disabled=true; const pz=document.getElementById("pass"); if(pz) pz.disabled=true;
    const K=controls();
    if(K.kind==="give"){ const cards=[...sel]; sel.clear(); act({t:"give",cards}); }
    else if(K.kind==="xgive"){ const cards=[...sel]; sel.clear(); act({t:"xgive",cards}); }
    else if(K.kind==="bomb"){ const ranks=[...bombSel]; bombSel.clear(); act({t:"bomb",ranks}); }
    else { const cards=[...sel]; sel.clear(); act({t:"play",cards}); }
  };
  const ps=document.getElementById("pass"); if(ps) ps.onclick=()=>{ ps.disabled=true; document.getElementById("play").disabled=true; sel.clear(); act({t:"pass"}); };
}
function menuHtml(){
  const on = S.game==="baba"||S.game==="shinkei" ? [GAME_NAMES[S.game]] : S.game==="uno" ? UNO_RULE_DEFS.filter(d=>(S.urules||{})[d.k]).map(d=>d.name) : RULE_DEFS.filter(d=>S.rules[d.k]).map(d=>d.name).concat([`ジョーカー${esc(S.rules.jokers)}枚`]);
  const watchers = S.players.filter(p=>!S.order.includes(p.id));
  return `<div class="sheet" id="sheet"><div class="inner">
    <div class="row"><b class="grow">メニュー</b><button class="small ghost" id="closeMenu">閉じる</button></div>
    <div class="note" style="margin:10px 0">合言葉: <b>${esc(roomKey)}</b> ${inviteBtn()}</div>
    <div class="row" style="margin:8px 0"><button class="small" id="menuset">⚙ 設定</button><button class="small" id="menuhelp">❓ 遊び方</button></div>
    <div class="note"><b>このルール:</b> ${on.join(" / ")}</div>
    ${standingsHtml()}
    ${isHost() && mode==="online" ? `<div class="note" style="margin-top:8px"><b>ホスト操作</b></div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:4px"><button class="small ${S.locked?"":"ghost"}" id="lockbtn">${S.locked?"🔒 鍵かかってる（開ける）":"🔓 部屋に鍵をかける"}</button></div>
      ${S.players.filter(p=>!p.bot && p.id!==myId).map(p=>`<div class="row" style="margin-top:4px"><span class="grow note">${esc(p.name)}</span><button class="small ghost danger" data-kick="${esc(p.id)}">追い出す</button></div>`).join("")}` : ""}
    ${watchers.length?`<div class="note" style="margin-top:6px"><b>観戦中:</b> ${watchers.map(p=>esc(p.name)).join("、")}（次のラウンドから参加）</div>`:""}
    <div class="note" style="margin-top:10px"><b>ログ</b><br>${S.log.map(esc).join("<br>")}</div>
    <div class="btnrow"><button class="ghost" id="leave">退出する（CPUが代わりに打つ）</button></div>
  </div></div>`;
}
function bindMenu(){
  const m=document.getElementById("menu"); if(m) m.onclick=()=>{ menuOpen=true; lastSig=""; render(); };
  const sh=document.getElementById("sheet"); if(!sh) return;
  sh.onclick=e=>{ if(e.target===sh){ menuOpen=false; lastSig=""; render(); } };
  document.getElementById("closeMenu").onclick=()=>{ menuOpen=false; lastSig=""; render(); };
  document.getElementById("leave").onclick=()=>{ menuOpen=false; leave(); };
  bindInvite(); bindKick(sh);
  document.getElementById("menuset").onclick=()=>openSettings(); document.getElementById("menuhelp").onclick=()=>openHelp();
  const lk=document.getElementById("lockbtn"); if(lk) lk.onclick=()=>{ act({t:"lock",v:!S.locked}); sfx("tap"); };
}

function renderResult(){
  menuOpen=false;
  app.innerHTML=`<div class="page">
    <div class="row"><h1 class="grow">第${esc(S.round)}回戦 結果</h1>${chatBtn("small ghost")}${helpBtn()}${soundBtn()}</div>
    <div class="sub">合言葉 <span class="code" style="font-size:15px">${esc(roomKey)}</span> ${inviteBtn()}</div>
    <div class="panel"><ol class="rank">${S.ranking.map(id=>`<li>${miniAva(S.players.find(p=>p.id===id)||{id,name:"?"},30)}<b>${esc(nameOf(S,id))}</b> <span class="badge ${["大富豪","UNO王","一抜け","記憶王"].includes(S.titles[id])?"gold":["大貧民","ババ持ち"].includes(S.titles[id])?"bad":""}">${esc(S.titles[id]||"")}</span>${S.game==="uno"&&S.u&&S.u.scores?`<span class="pts">${S.u.scores[id]??0}点</span>`:""}${S.game==="shinkei"&&S.k?`<span class="pts">${S.k.scores[id]??0}組</span>`:""}${id===myId?" ← あなた":""}</li>`).join("")}</ol>
      ${S.game==="uno"?`<div class="note">残った手札の点数が少ない順（数字=その数、記号=20、ワイルド=50）</div>`:""}</div>
    ${coinBreakdownHtml()}
    ${standingsHtml()}
    ${S.sea&&S.sea.fin&&S.sea.cer?`<div class="btnrow"><button class="ghost" id="cerreplay">🏆 表彰式をもう一度見る</button></div>`:""}
    <div class="panel">${playerChips()}${startControls(true)}</div>
    ${timerPanel()}
    ${seasonPanel()}
    ${gamePanel()}
    ${mode==="online"?chatPreview():""}
    ${rulesPanel()}
    ${securityPanel()}
    <button class="ghost" id="leave">退出</button></div>`;
  bindChips(); bindRules(); bindSound(); bindInvite(); bindStart(true); bindChatBtn();
  document.getElementById("leave").onclick=leave;
  const cr=document.getElementById("cerreplay"); if(cr) cr.onclick=()=>replayCeremony();
}

render();
})();
