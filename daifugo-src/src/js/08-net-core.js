// =====================================================================
// 通信
// =====================================================================
const inArtifact = !!(window.claude && typeof window.claude.use==="function");
let net=null, netChecked=false;          // "db" | "p2p" | null
let db=null;
let myId = store.get("dfg_uid") || sstore.get("dfg_id"); if(!myId){ myId="u"+rid()+rid(); } store.set("dfg_uid",myId); sstore.set("dfg_id",myId);
// ---- セキュリティ ----
// 端末ごとの秘密鍵（外には出さない）。部屋ごとに派生させた鍵でホストに本人確認し、
// 状態には鍵のハッシュだけを載せる → 他人がIDをまねても席や手札を乗っ取れない
const hex = buf => [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha256hex(t){
  try{ if(window.crypto && crypto.subtle) return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))); }catch(e){}
  return hash(t)+hash("#"+t);
}
function randHex(n){ const a=new Uint8Array(n); try{ crypto.getRandomValues(a); }catch(e){ for(let i=0;i<n;i++) a[i]=Math.random()*256|0; } return hex(a); }
let myKey=store.get("dfg_key"); if(!/^[0-9a-f]{32}$/.test(myKey||"")){ myKey=randHex(16); store.set("dfg_key",myKey); }
let roomSecret="", myKh="";
async function prepRoomKey(roomId){ roomSecret=await sha256hex("k|"+myKey+"|"+roomId); myKh=await sha256hex("h|"+roomSecret); }
// よそから来た状態を無害化（HTMLに効く記号を潰す・プロトタイプ汚染を防ぐ）
function cleanIn(o, d=0){
  if(d>14) return null;
  if(typeof o==="string") return o.length>5000 ? o.slice(0,5000) : o.replace(/[<>"'`]/g, ch=>({"<":"＜",">":"＞","\"":"”","'":"’","`":"‘"})[ch]);
  if(typeof o==="number") return Number.isFinite(o)?o:0;
  if(typeof o==="boolean" || o===null) return o;
  if(Array.isArray(o)) return o.slice(0,3000).map(x=>cleanIn(x,d+1));
  if(typeof o==="object"){ const r={}; let n=0; for(const k of Object.keys(o)){ if(k==="__proto__"||k==="constructor"||k==="prototype") continue; if(++n>3000) break; r[cleanIn(k,d+1)]=cleanIn(o[k],d+1); } return r; }
  return null;
}
function randomPass(){
  const W=["とら","さくら","くじら","いちご","ほし","かみなり","ねこ","うさぎ","たいやき","ゆきだるま","ぺんぎん","もみじ","すいか","ひまわり","おばけ","ろけっと","らーめん","かっぱ","にんじゃ","どらごん"];
  const pick=()=>W[(crypto.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0]:Math.random()*1e9)%W.length];
  return pick()+"-"+pick()+"-"+(1000+((crypto.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0]:Math.random()*1e9)%9000));
}

let mode=null;       // "online" | "solo"
let S=null, roomKey="", roomPath="", unsub=null, loadTimer=null;
let peer=null, conn=null, conns=new Map(), p2pHost=false;
let busy=false, lastBotV=-1, screen="entry", errMsg="";
let sel=new Set();
let lastFxN=null, lastTurn=null, lastFieldSig="", lastRound=-1;

function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
(async()=>{
  await 0; // 全定義の後に動かす
  if(inArtifact){
    try{ db = await window.claude.use("db"); }catch(e){ db=null; }
    net = db ? "db" : null;
  } else {
    if(!window.Peer) for(const u of ["https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js","https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js"]){
      try{ await loadScript(u); if(window.Peer) break; }catch(e){}
    }
    net = window.Peer ? "p2p" : null;
  }
  netChecked=true; if(screen==="entry") render();
})();
setTimeout(()=>{ if(!netChecked){ netChecked=true; if(screen==="entry") render(); } },10500);

const isHost = () => mode==="solo" || (S && S.host===myId);
const lobbyish = a => ["join","leave","addbot","rm","rules","start","next","ready"].includes(a.t);

function setState(s){ applyState(s); driveBots(); }
// 新しい状態を反映。ゲーム中にチャットしか変わっていなければ、卓は描き直さない（選択やタップを邪魔しない）
function applyState(ns){
  const old=S; S=ns;
  if(old && screen==="room" && old.phase==="play" && ns.phase==="play" && old.gv===ns.gv && old.game===ns.game && document.querySelector(".table")){
    collectChat(); updateChat(); refreshBubbles(); processThrows();
    const cb=document.getElementById("chatBtn"); if(cb) cb.innerHTML="💬"+(unread?`<span class="dot">${unread>9?"9+":unread}</span>`:"");
    return;
  }
  render();
}
function refreshBubbles(){
  for(const id in bubbles){
    const host = id===myId ? document.getElementById("mebar") : document.querySelector(`[data-seat="${CSS.escape(id)}"]`);
    if(!host) continue;
    const old=host.querySelector(":scope > .bubble");
    if(old && old.dataset.at===String(bubbles[id].at)) continue;
    if(old) old.remove();
    const html=bubbleHtml(id);
    if(html){ host.insertAdjacentHTML("afterbegin", html); host.classList.add("talk"); }
  }
}
window.__dfgDebug = () => S; Object.assign(window, window.__DFG_HOOKS__ ? {__dfgSet: s=>setState(s)} : {}); window.__dfgNet = {conn:()=>conn, peer:()=>peer, conns:()=>conns, host:()=>p2pHost, backup:()=>backupState&&backupState.v, errs:()=>ERRS.slice(), report:()=>bugReport(), peerCfg:()=>peerCfg(), tm:()=>({...TM,ht:{...HT}})};

// 自分の操作
async function act(a){
  noteMove(a);
  if(mode==="solo"){
    const s=clone(S); const r=applyAction(s,myId,a);
    if(r===true) setState(s); else if(typeof r==="string") toast(r);
    return r;
  }
  if(net==="db") return mutateDb(a, myId);
  if(p2pHost) return hostApply(myId,a);
  if(conn && conn.open){ conn.send(a); return true; }
  toast("ホストとつながってない"); return false;
}

// ---- db（Claudeのページ内） ----
async function withLease(ref){
  for(let i=0;i<12;i++){
    try{ const r=await ref.acquire({holder:myId, ttlMs:1500}); if(r.acquired) return; }catch(e){ return; }
    await sleep(250+Math.random()*300);
  }
}
let dbQueue=Promise.resolve();
function mutateDb(a, actor){
  const run=dbQueue.then(()=>mutateDbNow(a,actor));
  dbQueue=run.catch(()=>{});
  return run;
}
async function mutateDbNow(a, actor){
  busy=true;
  try{
    const ref=db.doc(roomPath);
    await withLease(ref);
    const snap=await ref.get();
    let s = snap.exists ? clone(snap.data()) : blankRoom(actor);
    if(a.t==="join" && snap.exists && Date.now()-(s.updatedAt||0)>3*3600*1000) s=blankRoom(actor);
    const r=applyAction(s,actor,a);
    if(r===true){ await ref.set(s); }
    else if(typeof r==="string"){ if(a.t==="join") errMsg=r; toast(r); }
    return r;
  }catch(e){
    toast(e && e.code==="invalid_argument" ? "書き込み権限がありません（共有設定を確認）" : "通信エラー: "+(e&&e.message||e));
    return false;
  }finally{ busy=false; }
}
async function joinDb(name, pass){
  roomPath="rooms/r"+hash(normPass(pass));
  const r = await mutateDb({t:"join",name}, myId);
  if(r!==true && r!==false && typeof r==="string"){ backToEntry(r); return; }
  clearTimeout(loadTimer);
  loadTimer=setTimeout(()=>{ if(!S) toast("部屋に接続できません"); },10000);
  unsub = db.doc(roomPath).onSnapshot(snap=>{
    if(!snap.metadata.fromCache) clearTimeout(loadTimer);
    if(!snap.exists) return;
    applyState(snap.data()); driveBots();
  }, e=>{ clearTimeout(loadTimer); toast("接続が切れました: "+e.code); });
  try{
    avUnsub = db.collection(roomPath+"/av").onSnapshot(q=>{ const m={}; q.docs.forEach(d=>{ const v=d.data(); if(v) m[d.id]=v.data||""; }); mergeAvatars(m); }, ()=>{});
  }catch(e){}
  shareAvatar();
}

// ---- アイコン画像（ゲーム状態とは別に配る） ----
const AVA_RE=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
const avatars=Object.create(null);                                   // pid -> dataURL
let myAvatar = store.get("dfg_avatar")||""; if(!AVA_RE.test(myAvatar)) myAvatar="";
let avUnsub=null;
function okAvatar(d){ return typeof d==="string" && d.length<40000 && AVA_RE.test(d); }
async function makeAvatar(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    const N=96, c=document.createElement("canvas"); c.width=c.height=N;
    const g=c.getContext("2d"), m=Math.min(img.naturalWidth,img.naturalHeight);
    g.drawImage(img,(img.naturalWidth-m)/2,(img.naturalHeight-m)/2,m,m,0,0,N,N);
    let q=.82, d=c.toDataURL("image/jpeg",q);
    while(d.length>30000 && q>.4){ q-=.12; d=c.toDataURL("image/jpeg",q); }
    return d;
  } finally { URL.revokeObjectURL(url); }
}
function pickAvatar(){
  const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.onchange=async()=>{
    const f=inp.files&&inp.files[0]; if(!f) return;
    try{ setMyAvatar(await makeAvatar(f)); toast("アイコンを設定した！"); }
    catch(e){ toast("その画像は読み込めなかった…"); }
  };
  inp.click();
}
function setMyAvatar(d){
  myAvatar = okAvatar(d) ? d : "";
  store.set("dfg_avatar", myAvatar);
  if(myAvatar) avatars[myId]=myAvatar; else delete avatars[myId];
  shareAvatar(); render();
}
function shareAvatar(){
  if(mode!=="online") return;
  if(net==="p2p"){
    if(p2pHost){ const d={[myId]:myAvatar||""}; for(const c of conns.values()) if(c.open) try{ c.send({avatars:d}); }catch(e){} }
    else if(conn && conn.open) try{ conn.send({t:"avatar",data:myAvatar||""}); }catch(e){}
  } else if(net==="db" && db && roomPath){
    db.collection(roomPath+"/av").doc(myId).set({data:myAvatar||"", at:Date.now()}).catch(()=>{});
  }
}
function mergeAvatars(m){
  let ch=false;
  for(const [id,d] of Object.entries(isObj(m)?m:{})){ if(!ID_OK(id)) continue; if(okAvatar(d)){ if(avatars[id]!==d){ avatars[id]=d; ch=true; } } else if(d==="" && avatars[id]){ delete avatars[id]; ch=true; } }
  if(ch && S) render();
}
function resetAvatars(){ for(const k in avatars) delete avatars[k]; if(myAvatar) avatars[myId]=myAvatar; if(avUnsub){ avUnsub(); avUnsub=null; } }

