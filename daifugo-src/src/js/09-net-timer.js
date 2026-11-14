
// =====================================================================
// 1手の制限時間（オンライン専用・ホストが数える）
// ・ホストだけが期限を持つ（HT）。状態が変わる(gv)・手番が変わるたびに作り直す。ホストが交代しても、新ホストが次の更新で作り直す
//   → 引き継ぎ直後の手番は満額の時間から数え直し（短くなることはない）
// ・クライアントには「期限そのもの」ではなく「期限までの残りミリ秒(tr)」と対象(tp)を、状態と一緒に毎回送る。
//   クライアントは受け取った時刻 + tr を自分の時計の期限にする → 端末ごとの時計のずれが効かない（通信の遅れ分だけ表示が少し長いだけ）
// ・時間切れ: ホストが {t:"auto"} を自分で打つ（CPUと同じ思考で1手。2回続けたら離席扱い＝動くまでCPUが代打ち）
// ・演出の重い場面（上がり・革命・ボンバーなど）の直後は猶予を足し、ホスト画面で大きな演出が出てる間は期限を一度だけ延ばす
// =====================================================================
const TM={pid:null, deadline:0};          // 表示用（この端末の時計）
let HT={gv:-1, round:-1, actor:null, deadline:0, ext:false};   // ホスト専用
const XT="*x";     // カード交換中の期限の持ち主（個人ではなく「交換ステップ」）
function xchgPendingHumans(){ return S.xchg.pairs.filter(P=>!P.ok).map(P=>P.rich).filter(id=>{ const p=S.players.find(x=>x.id===id); return p && !p.bot && S.order.includes(id); }); }
const HEAVY_FX=["finish","end","round","rev","bomb","eight","miyako","foul","kmatch","kmiss","ucolor","udraw","uzero","useven","afk","seven"];
function timerActive(){ return mode==="online" && net==="p2p" && p2pHost && !!S && S.phase==="play" && S.tsec>0; }
function timerGrace(){
  let g=0;
  if(S.fx && S.fx.k && S.fx.k.some(e=>HEAVY_FX.includes(e.k))) g+=2500;
  if(S.k && S.k.miss) g+=1500;
  return g;
}
function timerSync(){
  if(!timerActive()){ HT.actor=null; if(mode==="online" && p2pHost) TM.pid=null; return; }
  if(xchgOn(S)){   // カード交換: 渡す人（人間）全員が同じ期限。誰かが渡しても期限は延びない（時間切れは残りの人だけ弱いカードを自動で渡す）
    const pend=xchgPendingHumans();
    if(!pend.length){ HT={gv:S.gv, round:S.round, actor:null, deadline:0, ext:false}; TM.pid=null; return; }
    if(HT.actor!==XT || HT.round!==S.round) HT={gv:-2, round:S.round, actor:XT, deadline:Date.now()+S.tsec*1000+timerGrace(), ext:false};
    TM.pid=pend[0]; TM.deadline=HT.deadline; return;
  }
  const p=S.players.find(x=>x.id===S.turn);
  if(!p || p.bot || p.away || !S.order.includes(p.id)){ HT={gv:S.gv, round:S.round, actor:null, deadline:0, ext:false}; TM.pid=null; return; }   // CPUの手番に期限はない
  if(HT.gv!==S.gv || HT.round!==S.round || HT.actor!==p.id) HT={gv:S.gv, round:S.round, actor:p.id, deadline:Date.now()+S.tsec*1000+timerGrace(), ext:false};
  TM.pid=HT.actor; TM.deadline=HT.deadline;
}
function timerInfo(){
  timerSync();
  if(!timerActive() || !HT.actor) return {tr:null, tp:null};
  return {tr:Math.max(0,HT.deadline-Date.now()), tp:HT.actor===XT?TM.pid:HT.actor};
}
function timerRecv(tr,tp){
  if(typeof tr==="number" && Number.isFinite(tr) && tr>=0 && ID_OK(tp)){ TM.pid=tp; TM.deadline=Date.now()+Math.min(tr,125000); }
  else TM.pid=null;
}
const fxBusy = () => !!(fxLayer && fxLayer.querySelector(".aslam,.cutin,.kanji"));
setInterval(()=>{
  try{
    if(!timerActive()) return;
    timerSync();
    if(!HT.actor) return;
    const now=Date.now();
    if(now<HT.deadline) return;
    if(fxBusy() && !HT.ext){ HT.ext=true; HT.deadline=now+2500; TM.deadline=HT.deadline; return; }
    const id=HT.actor; HT.actor=null;           // 二重に撃たない（状態が変われば作り直される）
    if(id===XT){ for(const pid of xchgPendingHumans()) hostApply(myId,{t:"auto",id:pid}); return; }
    hostApply(myId,{t:"auto",id});
  }catch(e){ pushErr("timer",e); }
},400);

// ---- 表示（席のカウントダウン / 自分の最後5秒の警告 / 離席表示） ----
let tmLastSec=-1, tmTotal=30000, tmTotalPid=null, tmLastMs=0;
function timerUi(){
  if(TM.pid && S && xchgOn(S) && xchgPending(S,myId)) TM.pid=myId;      // 交換中は、渡す側の自分には自分のタイマーを見せる（期限は全員共通）
  const play = !!S && screen==="room" && mode==="online" && S.phase==="play" && TM.pid;
  document.querySelectorAll(".tmr,.tring").forEach(e=>{ if(!play || e.dataset.pid!==TM.pid) e.remove(); });
  const warn=document.getElementById("tmwarn");
  if(!play){ if(warn) warn.remove(); tmLastSec=-1; document.body.classList.remove("tmlow"); return afkUi(); }
  const rem=Math.max(0,Math.ceil((TM.deadline-Date.now())/1000));
  const mine=TM.pid===myId, low=rem<=5;
  const host = mine ? document.getElementById("mebar") : document.querySelector(`[data-seat="${CSS.escape(TM.pid)}"]`);
  let b=document.querySelector(".tmr");
  if(host){
    let moved=false;
    if(!b){ b=document.createElement("span"); b.className="tmr"; b.dataset.pid=TM.pid; host.appendChild(b); moved=true; }
    else if(b.parentElement!==host){ host.appendChild(b); moved=true; }
    b.textContent="⏱"+rem; b.classList.toggle("low",low); b.classList.toggle("mine",mine);
    if(moved && mine && document.querySelector(".firsthint")) placeBar();   // 初回ヒントの幅がバッジぶん変わる → リボンの位置を合わせ直す
    // アバターのまわりの枠が時間とともに減っていく（誰の番か・あと何秒かが一目で分かる）
    const av = mine ? host.querySelector(".miniava") : host.querySelector(".avawrap");
    if(av){
      let r=av.querySelector(".tring");
      if(!r){ r=document.createElement("i"); r.className="tring"; r.dataset.pid=TM.pid; r.setAttribute("aria-hidden","true"); av.appendChild(r); }
      const ms=Math.max(0,TM.deadline-Date.now());
      if(tmTotalPid!==TM.pid || ms>tmLastMs+1500){ tmTotal=Math.max(1000,(S.tsec||30)*1000,ms); tmTotalPid=TM.pid; }
      tmLastMs=ms;
      r.style.setProperty("--p",Math.max(0,Math.min(1,ms/tmTotal)).toFixed(3)); r.classList.toggle("low",low); r.classList.toggle("mine",mine);
    }
  }
  document.body.classList.toggle("tmlow", !!(mine && low));
  if(mine && low){
    let w=warn; if(!w){ w=document.createElement("div"); w.id="tmwarn"; w.innerHTML=`<b></b><small>はやく出して！</small>`; document.body.appendChild(w); }
    w.firstChild.textContent=String(rem);
    if(tmLastSec!==rem){ sfx("tick"); vib(rem===0?200:60); }
  } else if(warn) warn.remove();
  tmLastSec=rem;
  afkUi();
}
setInterval(()=>guard(timerUi,"timerUi"),250);
// 離席扱いになった自分に「戻る」を出す。画面のどこかを触っても戻れる
function afkUi(){
  const me = S && S.players ? S.players.find(p=>p.id===myId) : null;
  const on = !!(me && me.afk) && screen==="room" && mode==="online";
  let el=document.getElementById("afkbar");
  if(!on){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement("div"); el.id="afkbar"; el.innerHTML=`<span>💤 離席扱い（CPUが代打ち中）</span><button id="afkback">戻る</button>`; document.body.appendChild(el); el.querySelector("button").onclick=()=>act({t:"back"}); }
}
document.addEventListener("pointerdown",e=>{
  const me = S && S.players ? S.players.find(p=>p.id===myId) : null;
  if(me && me.afk && mode==="online" && screen==="room" && !e.target.closest("#afkbar")) act({t:"back"});
},true);
