// =====================================================================
// 画面
// =====================================================================
let menuOpen=false, chatOpen=false, lastChatSeen=null, bombSel=new Set();
const bubbles={};   // pid -> {text, at}
function render(){
  try{ renderInner(); }catch(e){ pushErr("render",e); showCrash(); }
  guard(uxSync,"uxSync");
}
function renderInner(){
  if(screen==="entry"){ updateChat(); return renderEntry(); }
  if(!S){ app.innerHTML=`<div class="page"><h1>合言葉大富豪</h1><div class="panel"><span role="status">${esc(connStatus||"つないでるよ…")}</span><div class="note" style="margin-top:6px">合言葉: ${esc(roomKey)}</div></div><div class="btnrow"><button class="ghost" id="back">やめる</button>${mode==="online"&&lastJoin?`<button id="retryjoin" hidden>もう一度つなぐ</button>`:""}</div></div>`; document.getElementById("back").onclick=()=>backToEntry();
    const rj=document.getElementById("retryjoin"); if(rj){ rj.onclick=()=>joinOnline(lastJoin.name,lastJoin.pass); setTimeout(()=>{ const r=document.getElementById("retryjoin"); if(r) r.hidden=false; },8000); }
    return; }
  const playing=S.phase==="play";
  document.body.classList.toggle("revmode", playing && !!S.rev);
  document.body.classList.toggle("ebmode", playing && !!S.eb);
  document.body.classList.toggle("lockmode", playing && !!S.lock);
  const uc = playing && S.game==="uno" && S.u ? S.u.color : null;
  for(const c of ["R","Y","G","B"]) document.body.classList.toggle("uc-"+c, uc===c);
  // チャットだけが変わった更新では卓を描き直さない（タップ中のカードや選択を守る）
  const sig=stateSig(S);
  if(S.phase==="play" && sig===lastSig && lastSigWide===layKey() && document.querySelector(".table")){
    collectChat(); placeBubbles(); updateChat(); processThrows(); return;
  }
  snapHand();
  lastSig=sig; lastSigWide=layKey();
  collectChat(); for(const b of Object.values(bubbles)) b.fresh=false;
  if(S.phase==="lobby") renderLobby();
  else if(S.phase==="result") renderResult();
  else if(S.game==="uno" && S.u) renderUno();
  else if(S.game==="baba" && S.b) renderBaba();
  else if(S.game==="shinkei" && S.k) renderShinkei();
  else renderGame();
  if(S.phase!=="play") closeThrowPop();
  updateChat();
  guard(turnOrb,"turnOrb"); guard(processThrows,"throws");
  guard(runFx,"runFx");
}
let lastSig="", lastSigWide="";
function stateSig(s){ return JSON.stringify(s,(k,v)=> (k==="chat"||k==="chatN"||k==="chatAt"||k==="thr"||k==="thrAt"||k==="v"||k==="updatedAt") ? undefined : v); }
function placeBubbles(){          // 吹き出しだけを席に差し込む
  for(const [pid,b] of Object.entries(bubbles)){
    if(!b.fresh) continue; b.fresh=false;
    const el = pid===myId ? document.getElementById("mebar") : document.querySelector(`[data-seat="${CSS.escape(pid)}"]`);
    if(!el) continue;
    el.querySelectorAll(":scope > .bubble").forEach(x=>x.remove());
    el.insertAdjacentHTML("afterbegin", bubbleHtml(pid));
    if(pid!==myId) el.classList.add("talk");
  }
}
function runFx(){
  if(!S || !S.fx) return;
  if(lastFxN===null){ lastFxN=S.fx.n; return; }
  if(S.fx.n===lastFxN) return;
  const jumped = S.fx.n-lastFxN>1;
  lastFxN=S.fx.n;
  if(document.hidden) return;                          // 裏にいる間の演出は捨てる
  if(bannerPending>4) bannerPending=4;
  const list=S.fx.k.filter(e=>!(jumped && bannerPending>=3 && !["finish","end","round"].includes(e.k)));
  list.forEach(e=>{ if(e.k==="bomb") e._snap=handSnap; });
  const d=yokokuFor(list);
  const pf=e=>guard(()=>playFx(e),"playFx"); if(d) setTimeout(()=>list.forEach(pf), d); else list.forEach(pf);
}

// ---------- チャット ----------
const STAMPS=["よろしく！","ナイス！","うわー😱","はやく〜","ドンマイ","つよ…","GG👏"];
function collectChat(){
  const list=(S&&S.chat)||[];
  const last=list.length?list[list.length-1].id:0;
  if(lastChatSeen===null){ lastChatSeen=last; return; }
  for(const m of list) if(m.id>lastChatSeen){
    bubbles[m.by]={text:m.text+(m.n>1?` ×${m.n}`:""), at:Date.now(), fresh:true};
    if(m.by!==myId){ sfx("chat"); if(!chatOpen) unread++; }
  }
  lastChatSeen=Math.max(lastChatSeen,last);
}
let unread=0;
function chatBtn(cls="round"){ return `<button class="${cls}" id="chatBtn" title="チャット" aria-label="チャット">💬${unread?`<span class="dot">${unread>9?"9+":unread}</span>`:""}</button>`; }
function bindChatBtn(){ const b=document.getElementById("chatBtn"); if(b) b.onclick=()=>{ chatOpen=true; unread=0; updateChat(); const i=document.getElementById("chatIn"); if(i) setTimeout(()=>i.focus(),50); const d=b.querySelector(".dot"); if(d) d.remove(); }; }
function updateChat(){
  const box=document.getElementById("chat");
  const show = chatOpen && S && screen==="room";
  box.hidden=!show;
  guard(layerSync,"layers");
  if(!show) return;
  const msgs=document.getElementById("msgs");
  const list=S.chat||[];
  msgs.innerHTML = list.length ? list.map(m=>`<div class="msg ${m.by===myId?"mine":""}"><b>${esc(m.name)}</b><span>${esc(m.text)}${m.n>1?` <em class="cnt">×${m.n}</em>`:""}</span></div>`).join("") : `<div class="note">まだメッセージはないよ</div>`;
  msgs.scrollTop=msgs.scrollHeight;
}
let lastChatSend=0;
function sendChat(text){ text=String(text||"").trim(); if(!text) return; const now=Date.now(); if(now-lastChatSend<700) return; lastChatSend=now; act({t:"chat",text}); }
(function initChat(){
  document.getElementById("stamps").innerHTML=STAMPS.map(t=>`<button class="small ghost" data-stamp="${esc(t)}">${esc(t)}</button>`).join("");
  document.getElementById("stamps").onclick=e=>{ const b=e.target.closest("[data-stamp]"); if(b) sendChat(b.dataset.stamp); };
  document.getElementById("chatForm").onsubmit=e=>{ e.preventDefault(); const i=document.getElementById("chatIn"); sendChat(i.value); i.value=""; };
  document.getElementById("chatClose").onclick=()=>{ chatOpen=false; updateChat(); };
  document.getElementById("chat").onclick=e=>{ if(e.target.id==="chat"){ chatOpen=false; updateChat(); } };
})();
function bubbleHtml(pid){
  const b=bubbles[pid]; if(!b) return "";
  const el=Date.now()-b.at; if(el>4500) return "";
  return `<div class="bubble" data-at="${b.at}" style="animation-delay:-${el}ms">${esc(b.text)}</div>`;
}

function cardEl(c,cls="",style=""){
  const p=parse(c), red=p.s==="H"||p.s==="D";
  if(p.r===16) return `<div class="card joker ${cls}" data-c="${esc(c)}" style="${style}"><div class="pip">🃏<small>JOKER</small></div></div>`;
  const R=RANK_LABEL(p.r), sy=SUIT_SYM[p.s];
  const pip = p.r>=11 && p.r<=13 ? `<div class="pip face">${esc(R)}<span>${esc(sy)}</span></div>` : `<div class="pip">${esc(sy)}</div>`;
  return `<div class="card ${red?"red":""} ${cls}" data-c="${esc(c)}" style="${style}"><div class="ix"><b>${esc(R)}</b><i>${esc(sy)}</i></div>${pip}</div>`;
}
const AVA_COLORS=[["#ff8a8a","#c94040"],["#7fc8ff","#2a6fc9"],["#9be38a","#3c9a2c"],["#ffcf6e","#d08a10"],["#d6a4ff","#8040c0"],["#7ff0e0","#20a090"]];
function avatar(p){
  let h=0; for(const ch of p.id) h=(h*31+ch.charCodeAt(0))>>>0;
  const [a,b]=AVA_COLORS[h%AVA_COLORS.length];
  const img = !p.bot && avatars[p.id];
  if(img && okAvatar(img)) return `<div class="ava img" style="background-image:url('${img}')"></div>`;
  const t = p.bot ? "🤖" : esc([...p.name][0]||"?");
  return `<div class="ava" style="background:linear-gradient(150deg,${a},${b})">${t}</div>`;
}
function miniAva(p, size=28){ return `<span class="miniava" style="width:${size}px;height:${size}px">${avatar(p)}</span>`; }
// 効果音・演出などの切り替えは設定シート（15b）に集約。ここは入口になるボタンだけ
const soundBtn = (cls="small ghost") => `<button class="${cls}" id="setbtn" title="設定" aria-label="設定">⚙${cls.includes("round")?"":" 設定"}</button>`;
const helpBtn = (cls="small ghost") => `<button class="${cls}" id="helpbtn" title="遊び方" aria-label="遊び方">❓${cls.includes("round")?"":" 遊び方"}</button>`;
function bindSound(){
  const b=document.getElementById("setbtn"); if(b) b.onclick=()=>openSettings();
  const h=document.getElementById("helpbtn"); if(h) h.onclick=()=>openHelp();
}

