// ---- P2P（自前ホスティング時） ----
// 合言葉 → peer ID。まずホストを試し（成否が即返る）、部屋があればクライアントとして入る。
// ・クライアントは4秒ごとにping、ホストは25秒無音の接続を切る（端末スリープ明けは猶予）
// ・クライアントは切れたら自動で再接続（最大40秒）
// ・ホストは「バックアップ役」1人に完全な状態を送り続け、ホストが急に落ちたらその人が引き継ぐ
// ・ロビー/結果画面でホストが落ちた時は、残った誰かが部屋を引き継ぐ
// ・IDの取り合いで部屋が割れたら、ゲームが進んでいる方に合流する
const ICE_SERVERS = [
  {urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302","stun:stun2.l.google.com:19302"]},
  {urls:"stun:stun.cloudflare.com:3478"},
  {urls:["turn:eu-0.turn.peerjs.com:3478","turn:us-0.turn.peerjs.com:3478"], username:"peerjs", credential:"peerjsp"},
  // ↓ 無料TURN（Metered / ExpressTURN など）の認証情報をここに足すと、モバイル回線どうしでもつながりやすくなる
  // {urls:["turn:example.com:80","turn:example.com:443?transport=tcp"], username:"xxxx", credential:"xxxx"},
];
// アプリのバージョンと通信プロトコル番号。PROTO はホストとクライアントで一致しないと入れない（PWAのキャッシュで古い版が混ざる対策）。
// 通信の形（メッセージ名・状態の項目）を変えたら PROTO を1つ上げること。APP_VERSION は表示・不具合報告用。
const APP_VERSION = "2026.11.14-sec1";
const PROTO = 2;
// 「IPを隠す（リレー接続）」: オンにすると iceTransportPolicy:"relay" で、相手には中継サーバー（TURN）の住所だけが見える
const relayOn = () => store.get("dfg_relay")==="1";
function peerCfg(){ const cfg={iceServers:ICE_SERVERS}; if(relayOn()) cfg.iceTransportPolicy="relay"; return cfg; }
const PEER_OPTS = () => ({debug:0, config:peerCfg(), ...(window.__DFG_PEER_OPTS__||{})});
let connStatus="", myName="", roomPeerId="", joinGen=0, clientTries=0;
let rejoinUntil=0, rejoinStart=0, kicked=false, lastHostMsg=0, hbTimer=null, backupState=null, lastHostId=null, takeoverTried=false;
function setStatus(m){ connStatus=m; if(!S && screen==="room") render(); }
let netRetryT=0, netSince=0;
function netBar(msg){
  const b=document.getElementById("netbar"); if(!b) return;
  if(!msg){ clearTimeout(netRetryT); netSince=0; b.hidden=true; return; }
  const was=!b.hidden, rb0=b.querySelector("button"), shown=rb0 && !rb0.hidden;
  b.innerHTML=`<span>🔄 ${esc(msg)}</span><button class="small" id="netretry" ${shown?"":"hidden"}>再接続</button>`; b.hidden=false;
  b.querySelector("button").onclick=()=>{ if(!p2pHost && screen==="room"){ netSince=Date.now(); netBar("つなぎ直してるよ…"); startRejoin(joinGen); } };
  if(!was){ netSince=Date.now(); }
  clearTimeout(netRetryT);       // 何度呼ばれても、最初に出した時刻から数える。しばらく直らないときだけ手動ボタンを出す
  netRetryT=setTimeout(()=>{ if(!b.hidden && !p2pHost && mode==="online" && screen==="room"){ const r=document.getElementById("netretry"); if(r) r.hidden=false; } }, Math.max(0,7000-(Date.now()-netSince)));
}
function hostApply(actor,a){
  try{
    const s=clone(S); const r=applyAction(s,actor,a);
    if(r===true && a.t==="kick"){ const c=conns.get(a.id); if(c){ conns.delete(a.id); try{ c.send({kicked:2}); }catch(e){} setTimeout(()=>{ try{c.close()}catch(e){} },300); } }
    if(r===true){ applyState(s); broadcast(); driveBots(); }
    else if(typeof r==="string" && actor===myId) toast(r);
    return r;
  }catch(e){ pushErr("hostApply",e); return false; }     // 1通の不正なメッセージでホストのループを止めない
}
function stateMsg(c){ const ti=timerInfo(); return {state:viewFor(S,c.pid), proto:PROTO, tr:ti.tr, tp:ti.tp}; }
function sendState(c){ if(c.open){ try{ c.send(stateMsg(c)); }catch(e){} } }
const liveConn = id => { const c=conns.get(id); return !!(c && c.open && Date.now()-(c.lastSeen||0) < 12000); };
function backupPid(){ const p=S && S.players.find(x=>!x.bot && !x.offline && x.id!==myId && liveConn(x.id)); return p ? p.id : null; }
// 公平モード：ゲーム中はバックアップ役にも手札を渡さない（ホストが落ちたらそのラウンドは中止してロビーへ）
function lobbyBackup(s){
  const b=clone(s);
  Object.assign(b,{phase:"lobby", aborted:true, hands:{}, counts:{}, order:[], turn:null, field:null, passed:[], finished:[], losers:[], ranking:[], titles:{},
    pending:null, pendingQ:[], after:null, u:null, b:null, k:null, rev:false, eb:false, lock:null, stair:false, lastPlayer:null});
  b.players=b.players.filter(p=>!(p.bot && p.away)); b.players.forEach(p=>{ p.ready=false; delete p.wait; });
  b.log=["⚠ ホストが落ちたので、このラウンドは中止になった"]; b.fx={n:(s.fx&&s.fx.n)||0,k:[]};
  return b;
}
function broadcast(){
  const bk=backupPid();
  const backup = bk ? (S.fair!==false && S.phase==="play" ? lobbyBackup(S) : S) : null;
  for(const c of conns.values()){
    if(!c.open) continue;
    try{ const m=stateMsg(c); if(c.pid===bk) m.backup=backup; c.send(m); }catch(e){ pushErr("broadcast",e); }
  }
}

// まだ join していない接続（名乗ってない・鍵を示してない）。上限と期限を設けて、接続を大量に張られても捌けるようにする
const pend=new Set();
const MAX_PEND=12, MAX_CONNS=24, PEND_MS=10000;
// 切る前にPeerJSのメッセージ受信を外す（溜まったメッセージが閉じた後のPeerJS内部で例外になるのを防ぐ）
function killConn(c){ try{ if(c.dataChannel) c.dataChannel.onmessage=null; }catch(e){} try{ c.close(); }catch(e){} }
function refuse(c,err,fatal=true){ try{ c.send({err,fatal}); }catch(e){} c.__dead=true; setTimeout(()=>killConn(c),300); }
function setupHostConn(c){
  c.lastSeen=Date.now(); c.born=Date.now();
  // 未joinの接続が多すぎる時は、いちばん古い「まだ何も名乗ってない」接続から切る
  pend.add(c);
  if(pend.size>MAX_PEND){ for(const o of pend){ if(!o.__joining && o!==c){ pend.delete(o); killConn(o); break; } } }
  c.__pt=setTimeout(()=>{ if(!c.pid){ pend.delete(c); killConn(c); } },PEND_MS);
  c.on("open", ()=>{ const pc=c.peerConnection; if(pc) pc.addEventListener("iceconnectionstatechange", ()=>{
    const st=pc.iceConnectionState;
    if(st==="failed"||st==="closed"){ try{c.close()}catch(e){} dropConn(c); }
    else if(st==="disconnected") setTimeout(()=>{ if(["disconnected","failed"].includes(pc.iceConnectionState)){ try{c.close()}catch(e){} dropConn(c); } },8000);
  }); });
  c.on("data", m=>{ try{ hostOnData(c,m); }catch(e){ pushErr("hostData",e); } });
  c.on("close", ()=>{ clearTimeout(c.__pt); pend.delete(c); dropConn(c); });
  c.on("error", ()=>{});
}
function hostOnData(c,m){
  if(c.__dead || !m || typeof m!=="object" || Array.isArray(m) || !S) return;
  const now=Date.now();
  // 連打・巨大メッセージ対策（未joinの接続はもっと厳しく）
  if(!c.rl || now-c.rl.t>5000) c.rl={t:now,n:0};
  const lim=c.pid?60:25;
  if(++c.rl.n>lim){ if(c.rl.n>(c.pid?300:120) && !c.__dead){ c.__dead=true; setTimeout(()=>killConn(c),0); } return; }
  try{ if(JSON.stringify(m).length>(c.pid?60000:6000)) return; }catch(e){ return; }
  c.lastSeen=now;
  if(m.t==="ping"){ try{ c.send({pong:1}); }catch(e){} return; }
  if(m.t==="merge"){ handleMerge(c,m); return; }
  if(m.t==="join"){
    if(c.pid || c.__joining) return;                          // 1つの接続に席は1つだけ（joinの二重送信で席を増やさせない）
    if(m.proto!==PROTO){ refuse(c, protoMsg(!(typeof m.proto==='number' && m.proto>PROTO))); return; }
    const pid=typeof m.id==="string" ? m.id : "";
    if(!ID_OK(pid) || pid===myId){ if(pid===myId) return; refuse(c,"ID が不正です"); return; }
    const key=typeof m.key==="string" ? m.key : "";
    if(!/^[0-9a-f]{64}$/.test(key)){ refuse(c,"本人確認の鍵がありません（アプリを再読み込みしてね）"); return; }
    if(conns.size>=MAX_CONNS && !conns.has(pid)){ refuse(c,"この部屋は人が多すぎて入れません"); return; }
    c.__joining=true;
    sha256hex("h|"+key).then(kh=>{
      c.__joining=false;
      if(!S || !c.open || !p2pHost) return;
      const pl=S.players.find(p=>p.id===pid);
      if(pl && pl.kh && pl.kh!==kh){ refuse(c,"本人確認に失敗した（同じ人として入れない）"); return; }
      if((S.banned||[]).includes(kh)){ refuse(c,"この部屋には入れません"); return; }
      // 同じ端末の鍵で、別IDの席がすでに接続中なら入れない（席の水増し防止）
      const dup=S.players.find(p=>p.kh===kh && p.id!==pid && !p.bot && liveConn(p.id));
      if(dup){ refuse(c,"同じ端末から複数の席には入れないよ"); return; }
      pend.delete(c); clearTimeout(c.__pt);
      c.pid=pid; c.kh=kh;
      const old=conns.get(pid); conns.set(pid,c);
      if(old && old!==c){ old.__replaced=true; try{ old.send({kicked:1}); }catch(e){} setTimeout(()=>{ try{ old.close(); }catch(e){} },150); }
      // 同じ人（同じ鍵）が別IDで残した「幽霊」だけ片付ける。名前が同じだけの他人は消さない
      const ghost=S.players.find(p=>p.kh===kh && p.id!==pid && p.id!==myId && !p.bot && !liveConn(p.id));
      if(ghost){ const gc=conns.get(ghost.id); if(gc){ conns.delete(ghost.id); try{gc.close()}catch(e){} } hostApply(myId,{t:"drop",id:ghost.id}); }
      try{ c.send({avatars:{...avatars}}); }catch(e){}
      const r=hostApply(pid,{t:"join",name:typeof m.name==="string"?m.name:"",kh});
      if(typeof r==="string"){ refuse(c,r); }
      else if(r===false) sendState(c);
    }).catch(e=>{ c.__joining=false; pushErr("join",e); });
    return;
  }
  if(!c.pid) return;                                           // join していない接続の操作は全部無視
  if(m.t==="avatar"){
    if(now-(c.avAt||0)<4000) return; c.avAt=now;               // アイコンは4秒に1回まで（全員に配るので重い）
    const d=okAvatar(m.data)?m.data:"";
    if(d) avatars[c.pid]=d; else delete avatars[c.pid];
    for(const x of conns.values()) if(x.open) try{ x.send({avatars:{[c.pid]:d}}); }catch(e){}
    render(); return;
  }
  if(["disc","drop","prune","bot","auto","timer","join","merge","migrate"].includes(m.t)) return;   // ホスト専用の操作は受け付けない
  const {kh:_drop, at:_at, ...am}=m;          // 時刻はホストの時計を使う（連投制限をすり抜けさせない）
  const r=hostApply(c.pid,am);
  if(typeof r==="string"){ try{ c.send({err:r, fatal:false}); }catch(e){} }
}
// バージョン不一致のメッセージ（hostIsNewer: 相手＝ホストのほうが新しい → 自分が再読み込みすればいい）
function protoMsg(hostIsNewer){
  return hostIsNewer
    ? "アプリが古いみたい。ページを再読み込みして最新版にしてから入り直してね（ホーム画面に追加してる場合は、アプリを一度閉じて開き直してね）"
    : "ホストのアプリが古いみたい。ホストの人にページを再読み込みしてもらってね";
}
function dropConn(c){
  if(c.pid && conns.get(c.pid)===c){ conns.delete(c.pid); if(S && p2pHost) hostApply(myId,{t:"disc",id:c.pid,at:Date.now()}); }
}
// 引き継ぎ・合流のあと20秒たっても戻ってこない人は「接続切れ」扱い（ゲーム中ならCPUが代打ち）
function scheduleAbsentCheck(gen){
  setTimeout(()=>{
    if(gen!==joinGen || !p2pHost || !S) return;
    for(const p of S.players) if(!p.bot && !p.offline && p.id!==myId && !liveConn(p.id)) hostApply(myId,{t:"disc",id:p.id,at:Date.now()});
  },20000);
}
function hostWatchdog(gen){
  clearInterval(hbTimer);
  let lastTick=Date.now();
  hbTimer=setInterval(()=>{
    if(gen!==joinGen || !p2pHost){ clearInterval(hbTimer); return; }
    const now=Date.now();
    if(now-lastTick>9000){ for(const c of conns.values()) c.lastSeen=now; }   // 自分がスリープしてた→みんなに猶予
    lastTick=now;
    for(const c of [...conns.values()]) if(now-(c.lastSeen||0) > 25000){ try{ c.close(); }catch(e){} dropConn(c); }
    if(S && S.phase!=="play" && S.players.some(p=>p.offline && now-(p.offAt||0)>60000)) hostApply(myId,{t:"prune",at:now});
    if(peer && peer.disconnected && !peer.destroyed){ try{ peer.reconnect(); }catch(e){} }
  },4000);
}

// state があればその状態のホストになる（引き継ぎ・復旧）。null なら新しい部屋。
function becomeHost(state, gen, claimOnly){
  setStatus(state ? "ホストを引き継ぎ中…" : "部屋を作成中…");
  let tries=0;
  const attempt=()=>{
    if(gen!==joinGen) return;
    const p=new window.Peer(roomPeerId, PEER_OPTS()); peer=p;
    p.on("open", ()=>{
      if(gen!==joinGen){ try{p.destroy()}catch(e){} return; }
      if(p2pHost){ netBar(""); return; }                       // シグナリング再接続
      p2pHost=true; rejoinUntil=0; clearTimeout(loadTimer); netBar(""); hostWatchdog(gen); conn=null;
      if(state){ S=state; lastBotV=-1; render(); driveBots(); broadcast(); toast("ホストを引き継いだよ"); scheduleAbsentCheck(gen); }
      else { S=blankRoom(myId); hostApply(myId,{t:"join",name:myName,kh:myKh}); }
    });
    p.on("connection", setupHostConn);
    p.on("disconnected", ()=>{ if(gen!==joinGen) return; setTimeout(()=>{ try{ if(!p.destroyed && p.disconnected) p.reconnect(); }catch(e){} },1000); });
    p.on("error", e=>{
      if(gen!==joinGen) return;
      if(e.type==="unavailable-id"){
        if(p2pHost && S){ recoverLostId(gen); return; }        // ホスト中にIDを取られた
        try{p.destroy()}catch(_){}
        if(claimOnly) startClient(gen);                          // ホストは生きていた→普通に再接続
        else if(state){ if(++tries<4) setTimeout(attempt,900); else mergeInto(state,gen); }   // 誰かが先にホストになった→合流
        else startClient(gen);                                   // 部屋がある→そこに入る
      } else if(!p2pHost){
        try{p.destroy()}catch(_){}
        if(++tries<4) setTimeout(attempt,900); else failP2P(netErrMsg(e));
      } else if(["network","server-error","socket-error","socket-closed"].includes(e.type)){
        setTimeout(()=>{ try{ if(!p.destroyed) p.reconnect(); }catch(_){} },2000);
      }
    });
  };
  attempt();
}
function netErrMsg(e){
  const t=e&&e.type;
  if(["network","server-error","socket-error","socket-closed"].includes(t)) return "接続サーバーにつながらなかった（電波を確認してもう一度）";
  if(t==="browser-incompatible") return "このブラウザは非対応みたい";
  return "接続できませんでした（"+t+"）";
}

function startClient(gen){
  if(gen!==joinGen) return;
  setStatus(rejoinUntil ? "再接続中…" : "部屋を探してる…");
  const p=new window.Peer(PEER_OPTS()); peer=p;
  p.on("open", ()=>connectHost(p,gen));
  p.on("disconnected", ()=>{ try{ if(!p.destroyed && p.disconnected) p.reconnect(); }catch(e){} });
  p.on("error", e=>{
    if(gen!==joinGen) return;
    try{p.destroy()}catch(_){}
    if(e.type==="peer-unavailable"){
      if(rejoinUntil && tryTakeover(gen)) return;               // ホストが消えた→引き継げるなら引き継ぐ
      if(Date.now()<rejoinUntil){ netBar("ホストを探してる…"); setTimeout(()=>startClient(gen),1500); }
      else if(S && rejoinUntil){ failP2P("ホストが見つからなくなりました（ホストが閉じたかも）"); }
      else becomeHost(null, gen);                               // 部屋がまだ無い→自分がホスト
    } else if(Date.now()<rejoinUntil){ setTimeout(()=>startClient(gen),1500); }
    else if(!S && ++clientTries<4){ setTimeout(()=>startClient(gen),900); }
    else failP2P(netErrMsg(e));
  });
}
// ホストが消えた時の引き継ぎ判断
function tryTakeover(gen){
  if(takeoverTried) return false;
  const waited=Date.now()-rejoinStart;
  // ゲーム中：バックアップ役だけが完全な状態を持っているので引き継ぐ
  if(backupState && (backupState.phase==="play" || backupState.aborted) && (!S || backupState.v>=S.v-1)){
    takeoverTried=true;
    const st=clone(backupState), oldHost=st.host; st.host=myId;
    applyAction(st,myId,{t:"drop",id:oldHost});
    netBar("ホストが落ちたので引き継ぎ中…");
    becomeHost(st,gen); return true;
  }
  // ロビー/結果画面：手札が要らないので、少し待ってから誰でも引き継げる
  if(S && S.phase!=="play" && waited>(backupState?1500:6000)){
    takeoverTried=true;
    const st=clone(backupState && backupState.v>=S.v ? backupState : S), oldHost=st.host; st.host=myId;
    applyAction(st,myId,{t:"drop",id:oldHost});
    st.players.forEach(p=>{ if(!p.bot && p.id!==myId){ p.offline=true; p.offAt=Date.now(); } });   // 戻ってきたら解除
    netBar("ホストがいなくなったので引き継ぎ中…");
    becomeHost(st,gen); return true;
  }
  return false;
}
function connectHost(p,gen){
  setStatus(rejoinUntil ? "再接続中…" : "部屋に接続中…");
  const c=p.connect(roomPeerId,{reliable:true}); conn=c;
  const to=setTimeout(()=>{
    if(gen!==joinGen || c.open || c!==conn) return;
    try{c.close()}catch(e){} try{p.destroy()}catch(e){}
    if(Date.now()<rejoinUntil || ++clientTries<4) startClient(gen);
    else failP2P("ホストに直接つながらなかった（回線の相性かも。Wi-Fi⇔モバイル回線を切り替えて試してみて）");
  }, 9000);
  c.on("open", ()=>{
    if(c!==conn) return;
    clearTimeout(to); clientTries=0; rejoinUntil=0; takeoverTried=false; lastHostMsg=Date.now(); netBar("");
    c.send({t:"join",name:myName,id:myId,key:roomSecret,proto:PROTO,ver:APP_VERSION}); if(myAvatar) c.send({t:"avatar",data:myAvatar});
    clientHeartbeat(gen,c);
    // 回線レベルで切れたらすぐ気づく（突然死の検知を速く）
    const pc=c.peerConnection;
    if(pc) pc.addEventListener("iceconnectionstatechange", ()=>{
      const st=pc.iceConnectionState;
      if(st==="failed" || st==="closed"){ if(c===conn) startRejoin(gen); }
      else if(st==="disconnected") setTimeout(()=>{ if(c===conn && ["disconnected","failed"].includes(pc.iceConnectionState)) startRejoin(gen); },1500);
    });
  });
  c.on("data", m=>{ try{ clientOnData(c,p,gen,m); }catch(e){ pushErr("clientData",e); } });
  c.on("close", ()=>{
    clearTimeout(to);
    if(gen!==joinGen || mode!=="online" || p2pHost || c.__handoff || kicked || c!==conn) return;
    startRejoin(gen);
  });
  c.on("error", ()=>{});
}
// ホストから届いたメッセージの処理。ホストを信用しすぎない：
// 状態は normState（許可リスト方式の検証）を通ったものだけ採用し、壊れていたら捨てる。
let badStates=0;
function clientOnData(c,p,gen,m){
  if(gen!==joinGen || !m || typeof m!=="object" || c!==conn) return;               // 古い接続からのメッセージは無視
  lastHostMsg=Date.now();
  if(m.pong) return;
  if(m.kicked){ kicked=true; failP2P(m.kicked===2?"ホストに部屋から退出させられた":"別の画面で入り直したので、こっちは切断したよ"); return; }
  if(m.avatars){ if(isObj(m.avatars)) mergeAvatars(m.avatars); return; }
  if(m.state!==undefined){
    if(m.proto!==PROTO){ kicked=true; failP2P(protoMsg(typeof m.proto==="number" && m.proto>PROTO)); return; }
    const ns=normState(cleanIn(m.state));
    if(!ns){ if(++badStates===3) toast("ホストから変なデータが届いてる…"); return; }
    badStates=0;
    if(m.backup){ const b=normState(cleanIn(m.backup)); backupState=b; } else backupState=null;
    timerRecv(m.tr, m.tp);
    applyState(ns); lastHostId=S.host; clearTimeout(loadTimer);
  }
  else if(m.err){ const e=String(m.err).slice(0,200); if(m.fatal) failP2P(e); else toast(e); }
  else if(m.migrate!==undefined){
    rejoinUntil=Date.now()+40000; rejoinStart=Date.now();
    const full = m.full!==undefined ? normState(cleanIn(m.full)) : null;
    if(m.migrate===myId && full && full.players.some(x=>x.id===myId)){ c.__handoff=true; conn=null; try{c.close()}catch(e){} try{p.destroy()}catch(e){} becomeHost(full,gen); }
    else { backupState=null; takeoverTried=true; netBar("ホストが交代中…"); }   // 次のホストは決まってるので、自分は引き継がない
  }
}
function startRejoin(gen){
  if(gen!==joinGen || p2pHost || kicked) return;
  if(!rejoinUntil || Date.now()>rejoinUntil){ rejoinUntil=Date.now()+40000; rejoinStart=Date.now(); takeoverTried=false; }
  netBar("再接続中…");
  const old=conn; conn=null; if(old){ old.__handoff=true; try{old.close()}catch(e){} }
  try{ peer && peer.destroy(); }catch(e){}
  // バックアップ役は、まず部屋IDを取りにいく（ホストが生きていれば即失敗して普通に再接続）
  if(backupState && (backupState.phase==="play" || backupState.aborted) && !takeoverTried){
    takeoverTried=true;
    const st=clone(backupState), oldHost=st.host; st.host=myId;
    applyAction(st,myId,{t:"drop",id:oldHost});
    setTimeout(()=>becomeHost(st,gen,true), 300);
    return;
  }
  setTimeout(()=>startClient(gen), 600);
}
function clientHeartbeat(gen,c){
  clearInterval(hbTimer);
  let lastTick=Date.now();
  hbTimer=setInterval(()=>{
    if(gen!==joinGen || p2pHost || c!==conn){ clearInterval(hbTimer); return; }
    const now=Date.now();
    if(now-lastTick>6000) lastHostMsg=now-4000;   // スリープ明け：pingを打って数秒だけ様子を見る
    lastTick=now;
    if(c.open) try{ c.send({t:"ping"}); }catch(e){}
    if(now-lastHostMsg > 7000){ clearInterval(hbTimer); startRejoin(gen); }
  },2000);
}
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState!=="visible" || mode!=="online" || net!=="p2p" || p2pHost || kicked) return;
  if(!conn || !conn.open){ if(!rejoinUntil) startRejoin(joinGen); }
  else { try{ conn.send({t:"ping"}); }catch(e){} }
});

// ホストがIDを失った時：IDを取った部屋に、今のゲーム状態ごと合流する
function recoverLostId(gen){
  netBar("部屋を復旧中…");
  const st=clone(S);
  for(const x of conns.values()) try{ x.send({migrate:"_"}); }catch(e){}   // 自分のクライアントには再接続してもらう
  setTimeout(()=>{
    for(const x of conns.values()) try{ x.close(); }catch(e){}
    conns.clear(); try{ peer.destroy(); }catch(e){}
    p2pHost=false; clearInterval(hbTimer);
    mergeInto(st,gen);
  },300);
}
// 既存の部屋に、自分が持っている状態を合流させる。ダメなら普通に入る。
function mergeInto(st, gen){
  netBar("部屋を合流中…");
  const tmp=new window.Peer(PEER_OPTS()); peer=tmp;
  let done=false;
  const fallback=()=>{ if(done) return; done=true; try{tmp.destroy()}catch(e){} rejoinUntil=Date.now()+40000; rejoinStart=Date.now(); takeoverTried=true; startClient(gen); };
  tmp.on("open", ()=>{
    const c=tmp.connect(roomPeerId,{reliable:true});
    const to=setTimeout(fallback,10000);
    c.on("open", ()=>c.send({t:"merge", full:st}));
    c.on("data", m=>{ if(m && (m.mergeOk||m.mergeNo)){ clearTimeout(to); if(m.mergeOk) toast("部屋を合流したよ"); fallback(); } });
  });
  tmp.on("error", e=>{
    if(e.type==="peer-unavailable"){ done=true; try{tmp.destroy()}catch(_){} becomeHost(st,gen); }   // IDが空いた→自分がホスト
    else fallback();
  });
}
// 合流を受ける側。以前は「自分の部屋が空っぽ同然なら、相手が送ってきた状態を丸ごと採用」していたが、
// 部屋に入るだけで誰でも偽のゲーム状態（手札・ルール・BAN解除など）を流し込めるので、採用はやめた。
// 常に断る → 送ってきた側は普通のクライアントとして入り直す（進行中のゲームの引き継ぎは、バックアップ役の仕組みが受け持つ）。
function handleMerge(c,m){ try{ c.send({mergeNo:1}); }catch(e){} }

async function joinP2P(name, pass){
  myName=name; clientTries=0; rejoinUntil=0; kicked=false; backupState=null; takeoverTried=false;
  const gen=++joinGen;
  // 部屋ID＝合言葉のSHA-256（合言葉そのものは外に出ない）
  roomPeerId="pdfg2-"+(await sha256hex("room|"+normPass(pass))).slice(0,40);
  await prepRoomKey(roomPeerId);
  if(gen!==joinGen) return;
  becomeHost(null, gen);
  clearTimeout(loadTimer);
  loadTimer=setTimeout(()=>{ if(!S && gen===joinGen) failP2P("接続がタイムアウトしました（電波を確認してもう一度）"); },30000);
}
let lastJoin=null, retryHint=false;     // 接続の失敗のあと入口に「再接続する」を出すため
// 通信まわりの失敗（つながらない・見つからない・時間切れ）だけ、もう一度つなぐ価値がある。追い出し・鍵・古いアプリは出さない
function failP2P(m){ retryHint = /つながら|接続|見つか|タイムアウト|電波|ネット|通信/.test(String(m)) && !/退出|入れません|古い|鍵|別の画面/.test(String(m)); backToEntry(m); }
function cleanupP2P(){
  joinGen++; clearTimeout(loadTimer); clearInterval(hbTimer); netBar("");
  const c0=conn; conn=null;
  try{ c0 && c0.close(); }catch(e){}
  for(const c of conns.values()) try{ c.close(); }catch(e){}
  conns.clear();
  try{ peer && peer.destroy(); }catch(e){}
  peer=null; p2pHost=false; rejoinUntil=0; backupState=null;
}
// ホストが抜けるときは、つながっている人にホストを引き継ぐ
async function handoffHost(){
  const s=clone(S);
  if(applyAction(s,myId,{t:"leave"})!==true) return;
  const cand=s.players.find(p=>!p.bot && !p.offline && p.id!==myId && liveConn(p.id));
  if(!cand) return;
  s.host=cand.id;
  for(const [pid,c] of conns){ try{ c.send(pid===cand.id ? {migrate:cand.id, full:s} : {migrate:cand.id}); }catch(e){} }
  await sleep(500);
}

