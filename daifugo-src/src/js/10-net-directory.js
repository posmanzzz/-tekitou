// =====================================================================
// 部屋一覧（ロビー案内所）
// 決まったID「案内所」を最初に取った人が一覧係になる。部屋のホストは自分の部屋を登録し、
// 入口画面の人は一覧を取りにいく。一覧係がいなくなったら、残ってる誰かが自動で引き継ぐ。
// 非公開部屋は「ゲーム・人数・状態」だけ載せる（合言葉や部屋IDは載せない）
// =====================================================================
const DIR_ID="pdfg2-annai-v1";
const Dir={peer:null, conn:null, serving:false, rooms:new Map(), list:null, lastList:0, regKey:randHex(8), starting:false, retryT:0, subs:new Set()};
// 案内所への接続は必要な時だけ：入口画面でオンライン欄を見せている間（オプトアウトしてない人）か、オンラインでホストをしている間（部屋の登録）。
// ひとりモードや、他人の部屋に入ってる間は繋がない（相手に接続情報＝IPが見えるため）。
const dirOptOut = () => store.get("dfg_nodir")==="1";
function dirWanted(){
  if(net!=="p2p" || !window.Peer || dirOptOut()) return false;
  if(mode==="solo") return false;
  if(mode==="online") return p2pHost && !!S;
  return screen==="entry";
}
function dirSync(){
  if(dirWanted()){ if(!Dir.peer && !Dir.starting) dirStart(); }
  else if(Dir.peer || Dir.starting || Dir.retryT){ clearTimeout(Dir.retryT); Dir.retryT=0; dirStop(); Dir.list=null; }
}
function dirStart(){
  if(net!=="p2p" || !window.Peer || Dir.peer || Dir.starting) return;
  Dir.starting=true;
  const p=new window.Peer(DIR_ID, PEER_OPTS());
  p.on("open", ()=>{ Dir.starting=false; Dir.peer=p; Dir.serving=true; dirServe(); });
  p.on("connection", c=>dirServeConn(c));
  p.on("error", e=>{
    if(e.type==="unavailable-id"){ try{p.destroy()}catch(_){} Dir.starting=false; dirClient(); }
    else if(!Dir.serving){ try{p.destroy()}catch(_){} Dir.starting=false; dirRetry(); }
  });
  p.on("disconnected", ()=>{ setTimeout(()=>{ try{ if(!p.destroyed && p.disconnected) p.reconnect(); }catch(_){} },1500); });
}
function dirRetry(){ clearTimeout(Dir.retryT); Dir.retryT=setTimeout(()=>{ dirStop(); dirStart(); }, 800+Math.random()*2200); }
function dirStop(){ try{ Dir.peer && Dir.peer.destroy(); }catch(e){} Dir.peer=null; Dir.conn=null; Dir.serving=false; Dir.starting=false; }
function dirClient(){
  const p=new window.Peer(PEER_OPTS()); Dir.peer=p; Dir.serving=false;
  p.on("open", ()=>{
    const c=p.connect(DIR_ID,{reliable:true}); 
    const to=setTimeout(()=>{ if(!c.open){ dirRetry(); } },8000);
    c.on("open", ()=>{ clearTimeout(to); Dir.conn=c; dirTick(true); });
    c.on("data", m=>{ if(m && Array.isArray(m.rooms)){ Dir.list=m.rooms.slice(0,120).map(dirNorm).filter(Boolean).slice(0,80); Dir.lastList=Date.now(); dirRender(); } });
    c.on("close", ()=>{ if(Dir.conn===c){ Dir.conn=null; dirRetry(); } });
    c.on("error", ()=>{});
  });
  p.on("error", e=>{ if(e.type==="peer-unavailable" || !Dir.conn) dirRetry(); });
  p.on("disconnected", ()=>{ setTimeout(()=>{ try{ if(!p.destroyed && p.disconnected) p.reconnect(); }catch(_){} },1500); });
}
const dirOkRoom = r => r && typeof r==="object" && typeof r.k==="string" && ["daifugo","uno","baba","shinkei"].includes(r.game) && Number.isFinite(r.n);
// 一覧の1件を、型・長さ・文字種を確かめて作り直す（案内所は他人なので信用しない）
function dirNorm(r){
  if(!dirOkRoom(r)) return null;
  const o={k:clip(safeText(r.k),24), pub:r.pub===true, game:r.game, n:Math.max(0,Math.min(10,Math.trunc(r.n))), max:10, phase:r.phase==="play"?"play":"lobby", locked:r.locked===true};
  if(o.pub){ o.title=clip(safeText(String(r.title||"")),20); o.pass=clip(safeText(String(r.pass||"")),40); o.host=clip(safeText(String(r.host||"")),10); if(!o.pass) return null; }
  return o;
}
// --- 一覧係の仕事 ---
function dirServe(){ dirTick(true); }
function dirServeConn(c){
  c.on("data", m=>{
    if(!m || typeof m!=="object") return;
    const now=Date.now();
    if(!c.rl || now-c.rl.t>10000) c.rl={t:now,n:0};
    if(++c.rl.n>40) return;
    if(m.t==="reg") dirRegister(m.room, c);
    else if(m.t==="unreg" && typeof m.k==="string"){ const r=Dir.rooms.get(m.k); if(r && r.__c===c) Dir.rooms.delete(m.k); }
    if(m.t==="list"||m.t==="reg"){ try{ c.send({rooms:dirSnapshot()}); }catch(e){} }
  });
  c.on("close", ()=>{ for(const [k,r] of Dir.rooms) if(r.__c===c) Dir.rooms.delete(k); });
  c.on("error", ()=>{});
}
function dirRegister(room, c){
  room=cleanIn(room); if(!dirOkRoom(room)) return;
  const mine=[...Dir.rooms.values()].filter(r=>r.__c===c && r.k!==room.k).length;
  if(mine>=2 || (Dir.rooms.size>=80 && !Dir.rooms.has(room.k))) return;
  const r={k:String(room.k).slice(0,24), pub:!!room.pub, game:room.game, n:Math.max(0,Math.min(10,room.n|0)), max:10, phase:room.phase==="play"?"play":"lobby", locked:!!room.locked, at:Date.now(), __c:c};
  if(r.pub){ r.title=String(room.title||"").slice(0,20); r.pass=String(room.pass||"").slice(0,40); r.host=String(room.host||"").slice(0,10); if(!r.pass) return; }
  Dir.rooms.set(r.k, r);
}
function dirSnapshot(){
  const now=Date.now(), out=[];
  for(const [k,r] of Dir.rooms){ if(now-r.at>25000){ Dir.rooms.delete(k); continue; } const {__c,at,...x}=r; out.push(x); }
  return out;
}
// --- 定期処理：自分の部屋を登録＋一覧を取る ---
function myRoomEntry(){
  if(!(mode==="online" && net==="p2p" && p2pHost && S)) return null;
  const pub=!!S.pub;
  const e={k:Dir.regKey, pub, game:S.game, n:S.players.length, phase:S.phase, locked:!!S.locked};
  if(pub){ e.title=S.title||((S.players.find(p=>p.id===myId)||{}).name||"")+"の部屋"; e.pass=roomKey; e.host=(S.players.find(p=>p.id===myId)||{}).name||""; }
  return e;
}
let dirLastReg=0;
function dirTick(force){ guard(()=>dirTickInner(force),"dirTick"); }
function dirTickInner(force){
  if(net!=="p2p") return;
  dirSync();
  if(!Dir.peer && !Dir.starting) return;
  const wantList = screen==="entry";
  const e=myRoomEntry(), now=Date.now();
  if(Dir.serving){
    if(e) dirRegister(e, "self"); 
    if(wantList){ Dir.list=dirSnapshot(); Dir.lastList=now; dirRender(); }
    return;
  }
  const c=Dir.conn; if(!c || !c.open) return;
  try{
    if(e && (force || now-dirLastReg>8000)){ c.send({t:"reg",room:e}); dirLastReg=now; }
    else if(wantList) c.send({t:"list"});
  }catch(err){}
}
function dirUnreg(){
  if(Dir.serving){ Dir.rooms.delete(Dir.regKey); return; }
  if(Dir.conn && Dir.conn.open) try{ Dir.conn.send({t:"unreg",k:Dir.regKey}); }catch(e){}
}
setInterval(()=>dirTick(false), 4000);
// --- 入口画面の一覧 ---
const GAME_ICON={daifugo:"🃏",uno:"🎴",baba:"🤡",shinkei:"🧠"};
function dirListHtml(){
  if(net!=="p2p") return "";
  if(dirOptOut()) return `<div class="note">部屋一覧はオフ（案内所に接続しない）にしてあるよ。⚙設定 から変えられる</div>`;
  const L=Dir.list;
  if(!L) return `<div class="note">部屋を探してる…</div>`;
  const pubs=L.filter(r=>r.pub).sort((a,b)=>(a.phase==="lobby"?0:1)-(b.phase==="lobby"?0:1) || b.n-a.n);
  const privs=L.filter(r=>!r.pub && r.k!==Dir.regKey);
  const ph=r=>r.phase==="play"?`<span class="rph play">プレイ中</span>`:`<span class="rph">募集中</span>`;
  return `
    <div class="rsec">🌐 公開部屋 <small>${pubs.length}</small></div>
    ${pubs.length?pubs.map(r=>`<button class="rrow ${r.locked||r.n>=r.max?"full":""}" data-rpass="${esc(r.pass)}" ${r.locked||r.n>=r.max?"disabled":""}>
      <span class="ri">${GAME_ICON[r.game]||"🃏"}</span><span class="rt"><b>${esc(r.title||"部屋")}</b><small>${esc(GAME_NAMES[r.game]||"")} · ホスト ${esc(r.host||"?")}</small></span>
      <span class="rn">${esc(r.n)}/${esc(r.max)}${r.locked?" 🔒":""}</span>${ph(r)}</button>`).join(""):`<div class="note">今は公開部屋がないよ。部屋を作ってロビーで「公開」にすると、ここに出る</div>`}
    <div class="rsec">🔐 非公開部屋 <small>${privs.length}</small></div>
    ${privs.length?`<div class="rpriv">${privs.slice(0,12).map(r=>`<span class="rchip">${GAME_ICON[r.game]||"🃏"} ${esc(r.n)}人 · ${r.phase==="play"?"プレイ中":"待機中"}${r.locked?" 🔒":""}</span>`).join("")}</div><div class="note">合言葉を知ってる人だけ入れる</div>`:`<div class="note">なし</div>`}`;
}
function dirRender(){
  const el=document.getElementById("rooms"); if(!el || screen!=="entry") return;
  el.innerHTML=dirListHtml(); bindDirList();
}
function bindDirList(){
  document.querySelectorAll("[data-rpass]").forEach(b=>b.onclick=()=>{
    const pw=document.getElementById("pw"), nm=document.getElementById("nm"), er=document.getElementById("err");
    if(pw) pw.value=b.dataset.rpass; hashKeep=b.dataset.rpass;
    const n=nm?nm.value.trim():""; if(!n){ if(er) er.textContent="先になまえを入れてね"; nm&&nm.focus(); return; }
    ensureAudio(); store.set("dfg_name",n); joinOnline(n,b.dataset.rpass);
  });
}

// ---- 入退室 ----
function resetRoomLocals(){
  lastFxN=null; lastBotV=-1; lastTurn=null; lastFieldSig=""; lastRound=-1; comboN=0; lastGhost=null; prevField=null;
  lastChatSeen=null; unread=0; for(const k in bubbles) delete bubbles[k];
  sel.clear(); bombSel.clear(); menuOpen=false; chatOpen=false; backupState=null; kicked=false;
}
function joinOnline(name, pass){
  lastJoin={name,pass}; retryHint=false;
  resetAvatars(); resetRoomLocals();
  roomKey=pass; mode="online"; screen="room"; S=null; errMsg=""; lastFxN=null; render(); dirSync();
  try{ if(!inArtifact) history.replaceState(null,"","#"+encodeURIComponent(pass)); }catch(e){}
  if(net==="db") joinDb(name,pass); else joinP2P(name,pass);
}
function startSolo(name){
  resetAvatars(); resetRoomLocals();
  mode="solo"; screen="room"; roomKey="ひとりモード"; lastFxN=null;
  const s=blankRoom(myId);
  applyAction(s,myId,{t:"join",name});
  for(let i=0;i<3;i++) applyAction(s,myId,{t:"addbot"});
  applyAction(s,myId,{t:"timer",sec:0});      // ひとりモードに制限時間はない
  const saved=store.get("dfg_rules"); if(saved) try{ applyAction(s,myId,{t:"rules",rules:JSON.parse(saved)}); }catch(e){}
  const usaved=store.get("dfg_urules"); if(usaved) try{ applyAction(s,myId,{t:"urules",rules:JSON.parse(usaved)}); }catch(e){}
  S=s; render(); dirSync();
}
function backToEntry(msg){
  if(unsub){unsub();unsub=null;}
  resetAvatars();
  cleanupP2P();
  mode=null; S=null; screen="entry"; sel.clear(); errMsg=msg||""; document.body.classList.remove("revmode","ebmode","lockmode"); render(); dirSync();
}
async function leave(){
  retryHint=false;
  if(p2pHost) dirUnreg();
  if(mode==="online"){
    if(net==="db") await act({t:"leave"});
    else if(p2pHost) await handoffHost();
    else if(conn && conn.open){ try{ conn.send({t:"leave"}); }catch(e){} await sleep(150); }
  }
  backToEntry();
}

// ---- CPU進行（ホストだけが動かす） ----
let botKick=0;
setInterval(()=>{   // CPUの手番なのに4秒以上動いていなければ再駆動
  if(!S || S.phase!=="play" || !isHost()) return;
  const cur=S.players.find(p=>p.id===S.turn);
  if(cur && cur.bot && !xchgOn(S) && lastBotV===botVer(S) && Date.now()-botKick>4000){ lastBotV=-1; driveBots(); }
},2000);
// ベット（bv）は CPU の手を待たせない・やり直させないので、CPU 用の版番号からは引く
const botVer = s => (s.v||0)-(s.bv||0);
function driveBots(){
  if(!S || S.phase!=="play" || !isHost()) return;
  driveCpuBets();
  const cur=S.players.find(p=>p.id===S.turn);
  if(!cur || !cur.bot || lastBotV===botVer(S) || xchgOn(S)) return;       // カード交換中のCPUは、エンジンが渡し終えている（人間の選択待ちだけ）
  lastBotV=botVer(S); botKick=Date.now(); const v=botVer(S);
  setTimeout(()=>{
    if(!S || botVer(S)!==v) return;
    if(mode==="solo"){ const s=clone(S); if(applyAction(s,myId,{t:"bot"})===true) setState(s); }
    else if(net==="db") mutateDb({t:"bot"}, myId);
    else hostApply(myId,{t:"bot"});
  }, (S.game==="shinkei" ? (S.k&&S.k.miss?1500:S.k&&S.k.up.length?900:750) : S.game==="baba" ? 650 : S.order.length>6?450:700)+Math.random()*400);
}

