// =====================================================================
// 設定シート / 遊び方 / 戻るボタン(履歴) / キーボード / 画面スリープ防止 / 更新のお知らせ
// ・このファイルは 16 の前に置く（16 の末尾で最初の render() が走る）。SAFE は 16 の applyWide() が最初に使う
// ・グローバル(window.__xxx)は増やさない（本番ビルドが __ で始まる代入を拒否する）
// =====================================================================
const SAFE={t:0,r:0,b:0,l:0};
function readSafe(){
  let pr=document.getElementById("saprobe");
  if(!pr){ pr=document.createElement("div"); pr.id="saprobe"; pr.setAttribute("aria-hidden","true"); document.body.appendChild(pr); }
  const cs=getComputedStyle(pr);
  SAFE.t=parseFloat(cs.paddingTop)||0; SAFE.r=parseFloat(cs.paddingRight)||0; SAFE.b=parseFloat(cs.paddingBottom)||0; SAFE.l=parseFloat(cs.paddingLeft)||0;
}
readSafe();

const ux={set:false, help:null, confirm:null};      // 開いているシート（#ov に描く）
const UX_VERSION_TXT = () => { const P=window.__pwa; return `${typeof APP_VERSION==="string"?APP_VERSION:"?"}${P&&P.version?` / build ${P.version}`:""}`; };
const inPlay = () => screen==="room" && !!S && S.phase==="play";

// ---------- 設定の値（すべて store=localStorage 経由） ----------
const SORT_KEY="dfg_sort";
const sortMode = () => store.get(SORT_KEY)==="suit" ? "suit" : "str";
function mySort(hand, rev){
  if(sortMode()!=="suit") return sortHand(hand,rev);
  const key=c=>{ const p=parse(c); return [p.r===16?9:SUITS.indexOf(p.s), st(p.r,rev)]; };
  return hand.slice().sort((a,b)=>{ const A=key(a),B=key(b); return A[0]-B[0]||A[1]-B[1]; });
}
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
const isStandalone = () => { try{ return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone===true; }catch(e){ return false; } };
function setFx(n){ fxLevel=n; store.set("dfg_fxlv",n); }
function setVol(n){ volLv=n; soundOn=n>0; store.set("dfg_vol",String(n)); store.set("dfg_snd",n>0?"1":"0"); if(n>0){ ensureAudio(); sfx("turn"); } }
function setVib(on){ vibOn=on; store.set("dfg_vib",on?"1":"0"); if(on) try{ navigator.vibrate && navigator.vibrate(40); }catch(e){} }

// ---------- シートの描画 ----------
const seg=(id,cur,items)=>`<div class="seg" role="group" aria-label="${esc(id)}">${items.map(([v,l])=>`<button type="button" class="${String(cur)===String(v)?"on":""}" data-set="${id}:${v}" data-fid="${id}${v}" aria-pressed="${String(cur)===String(v)}">${l}</button>`).join("")}</div>`;
function settingsHtml(){
  const P=window.__pwa, p2p=net==="p2p";
  const vibOk = typeof navigator.vibrate==="function";
  let inst="";
  if(!isStandalone() && (P || isIOS())){
    if(P && P.canInstall) inst=`<button type="button" id="setinstall" data-fid="inst">📲 アプリとして追加</button><div class="note">ホーム画面やデスクトップから、アプリみたいに起動できるようになるよ。</div>`;
    else if(isIOS()) inst=`<button type="button" id="setinstall" data-fid="inst">📲 アプリとして追加</button><div class="note ioshow" id="iosnote" ${ux.iosOpen?"":"hidden"}>iPhone / iPad は、Safari の <b>共有ボタン（□に↑）</b> →「<b>ホーム画面に追加</b>」でアプリとして使えるよ。</div>`;
    else inst=`<div class="note">ブラウザのメニューから「アプリをインストール」か「ホーム画面に追加」を選ぶと、アプリとして使えるよ。</div>`;
  }
  const upd = P && P.updateReady ? `<button type="button" id="setupdate" data-fid="upd">🆕 更新する</button><div class="note">新しいバージョンがあるよ。${inPlay()?"ゲームが終わってから押してね。":"押すと読み込み直すよ。"}</div>` : "";
  return `<div class="sheet ovsheet" id="ovset" data-layer="settings"><div class="inner" role="dialog" aria-modal="true" aria-labelledby="settit">
    <div class="row"><b class="grow" id="settit">⚙ 設定</b><button class="small ghost" type="button" data-close="settings" data-fid="x">閉じる</button></div>
    <label>✨ 演出の強さ</label>${seg("fx",fxLevel,FX_NAMES.map((n,i)=>[i,n]))}
    <label>🔊 効果音の大きさ</label>${seg("vol",volLv,[[0,"オフ"],[1,"小"],[2,"中"],[3,"大"]])}
    <label>📳 バイブ</label>${seg("vib",vibOn?1:0,[[1,"オン"],[0,"オフ"]])}${vibOk?"":`<div class="note">この端末はバイブに対応してないよ（iPhone など）</div>`}
    <label>🃏 大富豪の手札の並び</label>${seg("sort",sortMode(),[["str","強さ順"],["suit","マーク順"]])}
    ${p2p?`<label>🌐 通信</label>
    <label class="relayrow"><input type="checkbox" id="relay" ${relayOn()?"checked":""}> IPを隠す（リレー接続）</label>
    <div class="note">オンにすると中継サーバー（TURN）経由でつながるので、相手にIPが見えにくくなる。ただしつながらなかったり遅くなったりすることがあるよ（中継サーバー頼みのため）。${mode==="online"?"今の部屋には効かなくて、次に部屋へ入るときから使われるよ。":""}</div>
    <label class="relayrow"><input type="checkbox" id="nodirchk" ${dirOptOut()?"checked":""}> 部屋の一覧を使わない</label>
    <div class="note">オンにすると、立ってる部屋の一覧（案内所）に接続しないよ。部屋の合言葉は友達に直接伝えてね。</div>`:""}
    ${inst||upd?`<label>📱 アプリ</label>${inst}${upd}`:""}
    <label>🧰 そのほか</label>
    <div class="row"><button class="small ghost" type="button" id="setreport" data-fid="rep">🐞 不具合レポートをコピー</button></div>
    <div class="note">合言葉や鍵は入ってないよ。困ったときに送ってね。</div>
    <div class="note verline">バージョン ${esc(UX_VERSION_TXT())}</div>
  </div></div>`;
}
const HELP={
  daifugo:{t:"🃏 大富豪", basics:["手札を早く出し切った人が勝ち。1位が「大富豪」、最後が「大貧民」だよ。","場に出てるカードより強い、同じ枚数のカードを出していく。出せない・出したくないときは「パス」。","強さは 3 < 4 < … < K < A < 2 < JOKER。みんながパスすると場が流れて、最後に出した人が好きなカードから始められるよ。"]},
  uno:{t:"🎴 UNO", basics:["今の場のカードと同じ色か、同じ数字・記号のカードを出していく。出せなければ山札から引いてね。","手札が残り1枚になったら「UNO!」を押そう。言い忘れると2枚ペナルティ（ルールがオンのとき）。","⊘スキップ・⇄リバース・+2・ワイルド（色を選べる）・+4 の特殊カードがあるよ。手札を先に0にした人の勝ち。"]},
  baba:{t:"🤡 ババ抜き", basics:["配られた時点で同じ数字のペアは自動で捨てる。","自分の番は、前の人の手札（裏向き）から1枚引く。ペアができたら捨てる。","手札がなくなったら上がり。最後にジョーカー（ババ）を持ってた人の負け。引かれそうなときは「シャッフル」で逃げよう。"]},
  shinkei:{t:"🧠 神経衰弱", basics:["裏向きのカードを2枚めくって、同じ数字ならゲットしてもう1回。","外れたら次の人へ。覚えてるカードが勝負だよ。","全部なくなったときに、一番たくさん取った人の勝ち。5人以上だとジョーカー2枚も入る（ジョーカー同士でペア）。"]},
};
function helpHtml(g){
  const H=HELP[g]||HELP.daifugo;
  let rules="";
  if((g==="daifugo"||g==="uno") && S){
    const defs=g==="uno"?UNO_RULE_DEFS:RULE_DEFS, R=g==="uno"?(S.urules||UNO_DEFAULT):(S.rules||DEFAULT_RULES);
    const on=defs.filter(d=>R[d.k]);
    rules=`<h4>いま使ってるルール${g==="daifugo"?`（ジョーカー ${esc(R.jokers)}枚）`:""}</h4>` + (on.length ? `<dl class="rl">${on.map(d=>`<dt>${esc(d.name)}</dt><dd>${esc(d.desc)}</dd>`).join("")}</dl>` : `<div class="note">ハウスルールはなし。基本のルールだけで遊ぶよ。</div>`);
  }
  const touch = {
    daifugo:["カードをタップで選ぶ → 「出す」。もう一度タップで選択を外せる。","カードを素早く2回タップ → 同じ数字で出せるカードをまとめて選ぶ（もう一度2回タップで外す）。","選んだカードを全部外したいときは「選択を解除」。"],
    uno:["光ってるカードをタップで選ぶ → もう一度タップ（か「出す」）で出す。","出せないときは山札をタップで引く。引いたカードを出さないなら「パス」。","残り1枚になる前に「UNO!」ボタン。"],
    baba:["相手のカードを1枚タップ → もう一度タップ（か「引く」）で引く。","狙われたカードは光るよ。「シャッフル」で並べ替えて逃げよう。"],
    shinkei:["裏向きのカードをタップでめくる。2枚めくったら結果が出るよ。"],
  }[g]||[];
  const keys = {
    daifugo:[["← →","手札のカーソルを動かす"],["↑ / Space","カーソルのカードを選ぶ・外す"],["Enter","出す"],["P","パス"],["Esc","選択を解除 / 閉じる"],["C","チャットを開く"]],
    uno:[["← →","手札のカーソルを動かす"],["Enter","カーソルのカードを出す"],["D","山札から引く"],["U","UNO! と言う"],["P","パス"],["Esc","閉じる"],["C","チャットを開く"]],
    baba:[["← →","引くカードを選ぶ"],["Enter","引く"],["S","シャッフル"],["Esc","閉じる"],["C","チャットを開く"]],
    shinkei:[["← → ↑ ↓","カーソルを動かす"],["Enter","めくる"],["Esc","閉じる"],["C","チャットを開く"]],
  }[g]||[];
  return `<div class="sheet ovsheet" id="ovhelp" data-layer="help"><div class="inner" role="dialog" aria-modal="true" aria-labelledby="helptit">
    <div class="row"><b class="grow" id="helptit">❓ 遊び方　${esc(H.t)}</b><button class="small ghost" type="button" data-close="help" data-fid="x">閉じる</button></div>
    <h4>基本</h4><ul class="hl">${H.basics.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
    ${rules}
    <h4>操作（スマホ）</h4><ul class="hl">${touch.map(x=>`<li>${esc(x)}</li>`).join("")}<li>他の人のアイコンをタップすると、スタンプや物を投げてリアクションできるよ。</li></ul>
    <h4>操作（PC のキーボード）</h4><dl class="kl">${keys.map(([k,d])=>`<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(d)}</dd>`).join("")}</dl>
    <div class="note">マウスでも、カードをクリックするだけで同じことができるよ。</div>
    ${S&&S.phase!=="lobby"&&S.phase!=="result"?"":`<div class="row" style="margin-top:8px;flex-wrap:wrap">${["daifugo","uno","baba","shinkei"].filter(x=>x!==g).map(x=>`<button class="small ghost" type="button" data-help="${x}">${esc(HELP[x].t)}</button>`).join("")}</div>`}
  </div></div>`;
}
function confirmHtml(){
  const c=ux.confirm;
  return `<div class="sheet ovsheet cfm" id="ovconfirm" data-layer="confirm"><div class="inner" role="alertdialog" aria-modal="true" aria-labelledby="cfmtit">
    <b id="cfmtit">${esc(c.title)}</b><div class="note" style="margin:8px 0 12px">${esc(c.body||"")}</div>
    <div class="btnrow"><button type="button" class="ghost" data-fid="no" id="cfmno">${esc(c.no||"続ける")}</button><button type="button" id="cfmyes" data-fid="yes">${esc(c.yes||"やめる")}</button></div>
  </div></div>`;
}
let ovEl=null;
function ovRender(){
  if(!ovEl){ ovEl=document.createElement("div"); ovEl.id="ov"; document.body.appendChild(ovEl); ovEl.addEventListener("click",ovClick); }
  const fid=document.activeElement && ovEl.contains(document.activeElement) ? document.activeElement.dataset.fid : null;
  const sc=ovEl.querySelector(".inner") ? ovEl.querySelector(".inner").scrollTop : 0;
  const openK={settings:ux.set, help:!!ux.help, confirm:!!ux.confirm};
  const order=LAYERS.filter(k=>openK[k]); for(const k of Object.keys(openK)) if(openK[k] && !order.includes(k)) order.push(k);   // 一番上のシートが最後
  let h=""; for(const k of order){ if(k==="settings") h+=settingsHtml(); else if(k==="help") h+=helpHtml(ux.help); else if(k==="confirm") h+=confirmHtml(); }
  ovEl.innerHTML=h;
  const inner=ovEl.querySelector(".ovsheet:last-child .inner"); if(inner && sc) inner.scrollTop=sc;
  if(fid){ const b=ovEl.querySelector(`[data-fid="${fid}"]`); if(b) b.focus(); }
}
function ovFocusFirst(){ const b=ovEl && ovEl.querySelector(".ovsheet:last-child [data-fid]"); if(b) b.focus(); }
let ovReturn=null;
function ovOpened(){ ovReturn=document.activeElement; ovRender(); guard(layerSync,"layers"); ovRender(); ovFocusFirst(); }
function openSettings(){ if(ux.set) return; closeThrowPop(); ux.set=true; ovOpened(); }
function openHelp(g){ ux.help = g || (S&&S.game) || "daifugo"; ovOpened(); }
function askConfirm(c){ ux.confirm=c; ovOpened(); }
function closeSettings(){ if(!ux.set) return; ux.set=false; ovClosed(); }
function closeHelp(){ if(!ux.help) return; ux.help=null; ovClosed(); }
function closeConfirm(){ if(!ux.confirm) return; ux.confirm=null; ovClosed(); }
function ovClosed(){ ovRender(); guard(layerSync,"layers"); if(ovEl && !ovEl.firstChild){ const r=ovReturn; ovReturn=null; try{ if(r && r.isConnected && r.focus) r.focus(); }catch(e){} } else ovFocusFirst(); }
function ovClick(e){
  const cl=e.target.closest("[data-close]"); if(cl){ closeLayer(cl.dataset.close); return; }
  if(e.target.classList && e.target.classList.contains("ovsheet")){ closeLayer(e.target.dataset.layer); return; }       // 外側タップで閉じる
  const hp=e.target.closest("[data-help]"); if(hp){ ux.help=hp.dataset.help; ovRender(); ovFocusFirst(); return; }
  const s=e.target.closest("[data-set]");
  if(s){
    const [k,v]=s.dataset.set.split(":");
    if(k==="fx"){ setFx(+v); if(+v===2){ const r=s.getBoundingClientRect(); burst(r.left+r.width/2,r.top+r.height/2,{n:24,emoji:"🌈",size:7,dist:100}); sfx("kyuin"); } }
    else if(k==="vol") setVol(+v);
    else if(k==="vib") setVib(v==="1");
    else if(k==="sort"){ store.set(SORT_KEY,v); if(S&&screen==="room"){ lastSig=""; render(); } }
    ovRender(); return;
  }
  const t=e.target;
  if(t.id==="cfmyes"){ const c=ux.confirm; closeConfirm(); if(c&&c.ok) c.ok(); return; }
  if(t.id==="cfmno"){ const c=ux.confirm; closeConfirm(); if(c&&c.no_) c.no_(); return; }
  if(t.id==="setinstall"){
    const P=window.__pwa;
    if(P && P.canInstall){ Promise.resolve(P.install()).then(()=>ovRender()); }
    else { ux.iosOpen=!ux.iosOpen; ovRender(); }
    return;
  }
  if(t.id==="setupdate"){ applyUpdateSafe(); return; }
  if(t.id==="setreport"){ copyReport(); return; }
}
document.addEventListener("change",e=>{
  const t=e.target; if(!ovEl || !ovEl.contains(t)) return;
  if(t.id==="relay"){ store.set("dfg_relay",t.checked?"1":"0"); dirStop(); dirSync(); toast(t.checked?"IPを隠す: オン":"IPを隠す: オフ"); }
  if(t.id==="nodirchk"){ store.set("dfg_nodir",t.checked?"1":"0"); dirSync(); if(screen==="entry") render(); toast(t.checked?"部屋の一覧: 使わない":"部屋の一覧: 使う"); }
});
async function copyReport(){
  const txt=bugReport();
  try{ await navigator.clipboard.writeText(txt); toast("不具合レポートをコピーしたよ"); return; }catch(e){}
  try{ const ta=document.createElement("textarea"); ta.value=txt; ta.style.cssText="position:fixed;left:-999px;top:0"; document.body.appendChild(ta); ta.select(); const ok=document.execCommand("copy"); ta.remove(); toast(ok?"不具合レポートをコピーしたよ":"コピーできなかった…"); }
  catch(e){ toast("コピーできなかった…"); }
}

// ---------- 更新（pwa.js の通知を引き継ぐ） ----------
let pwaHooked=false;
function pwaInit(){
  const P=window.__pwa; if(!P || pwaHooked) return; pwaHooked=true;
  try{ P.ui=false; }catch(e){}                                  // 内蔵トーストは止めて、こちらで出す（ゲーム中は絶対に出さない）
  window.addEventListener("pwa-change",()=>{ updBar(); if(ux.set) ovRender(); });
}
function applyUpdateSafe(){
  const P=window.__pwa; if(!P || !P.updateReady) return;
  if(inPlay()) return toast("ゲーム中は更新しないよ。終わってからね");
  if(screen==="room") return askConfirm({title:"更新するとこの部屋から出るよ", body:"読み込み直すので、いまの部屋にはいったん戻れなくなるよ。", yes:"更新する", no:"やめとく", ok:()=>P.applyUpdate()});
  P.applyUpdate();
}
function updBar(){
  const P=window.__pwa; let el=document.getElementById("updbar");
  const on = !!(P && P.updateReady) && !inPlay();
  if(!on){ if(el) el.remove(); return; }
  if(!el){ el=document.createElement("div"); el.id="updbar"; el.setAttribute("role","status"); el.innerHTML=`<span>🆕 新しいバージョンがあるよ</span><button class="small" type="button" id="updgo">更新する</button><button class="small ghost" type="button" id="updx" aria-label="あとで">✕</button>`;
    document.body.appendChild(el); el.querySelector("#updgo").onclick=applyUpdateSafe; el.querySelector("#updx").onclick=()=>{ el.dataset.hide="1"; el.remove(); }; }
}
// pwa.js は app.js のあとに読み込まれる。load の時点で必ず揃ってる（その前の render では __pwa がまだ無い）
window.addEventListener("load",()=>{ pwaInit(); updBar(); });
setTimeout(()=>{ pwaInit(); updBar(); },0);

// ---------- 戻るボタン（履歴）: 開いてるシート/ポップアップを1つずつ閉じる。部屋の画面では離れる前に確認 ----------
const LAYERS=[];      // 開いている順（最後が一番上）
let histHave=0, histIgnore=0;
function layerOpenMap(){
  const room=screen==="room" && !!S;
  return { settings:ux.set, help:!!ux.help, confirm:!!ux.confirm,
    thr:!!throwPop, wild:room && typeof wildPick!=="undefined" && !!wildPick,
    chat:room && chatOpen, menu:room && menuOpen };
}
function layerSync(){
  if(histIgnore>0) return;                      // 履歴を戻してる最中。popstate の後でもう一度合わせる
  const open=layerOpenMap();
  for(const k of Object.keys(open)){ const i=LAYERS.indexOf(k); if(open[k] && i<0) LAYERS.push(k); if(!open[k] && i>=0) LAYERS.splice(i,1); }
  const want=(screen==="room"?1:0)+LAYERS.length;
  while(histHave<want){ try{ history.pushState({dfg:histHave+1},"",location.href); }catch(e){} histHave++; }
  if(histHave>want){
    const d=histHave-want; histHave=want; histIgnore++;
    try{ history.go(-d); }catch(e){ histIgnore--; }
    setTimeout(()=>{ if(histIgnore>0){ histIgnore=0; guard(layerSync,"layers"); } },700);
  }
}
function closeLayer(k){
  if(k==="settings") closeSettings();
  else if(k==="help") closeHelp();
  else if(k==="confirm") closeConfirm();
  else if(k==="thr") closeThrowPop();
  else if(k==="wild"){ wildPick=null; lastSig=""; render(); }
  else if(k==="chat"){ chatOpen=false; updateChat(); }
  else if(k==="menu"){ menuOpen=false; lastSig=""; render(); }
  guard(layerSync,"layers");
}
function askLeave(){
  const playing=inPlay();
  askConfirm({ title: playing?"ゲームから抜ける？":"この部屋から出る？",
    body: playing ? (mode==="solo"?"ひとりモードを終わって、入口に戻るよ。":"抜けるとCPUが代わりに打つよ。") : "入口に戻るよ。",
    yes:"抜ける", no:"続ける", ok:()=>{ leave(); } });
}
window.addEventListener("popstate",()=>{
  if(histIgnore>0){ histIgnore--; guard(layerSync,"layers"); return; }
  histHave=Math.max(0,histHave-1);
  if(LAYERS.length){ closeLayer(LAYERS[LAYERS.length-1]); return; }
  if(screen==="room") askLeave();
  guard(layerSync,"layers");
});
window.addEventListener("beforeunload",e=>{ if(mode==="online" && inPlay()){ e.preventDefault(); e.returnValue=""; return ""; } });

// ---------- 画面を消さない（Wake Lock） ----------
let wlSent=null, wlBusy=false;
async function wakeSync(){
  if(!navigator.wakeLock || wlBusy) return;
  const want = screen==="room" && !!S && !document.hidden;
  try{
    if(want && !wlSent){ wlBusy=true; const s=await navigator.wakeLock.request("screen"); wlSent=s; s.addEventListener("release",()=>{ if(wlSent===s) wlSent=null; }); wlBusy=false; if(!(screen==="room" && S && !document.hidden)) return wakeSync(); }
    else if(!want && wlSent){ wlBusy=true; const s=wlSent; wlSent=null; await s.release(); wlBusy=false; }
  }catch(e){ wlBusy=false; wlSent=null; }
}
document.addEventListener("visibilitychange",()=>guard(wakeSync,"wake"));

// ---------- 最初の1手のヒント ----------
const HINT_TXT={daifugo:"カードをタップで選んで「出す」。出せないときは「パス」だよ",uno:"光ってるカードを2回タップで出せるよ。出せなければ山札を引いてね",baba:"相手のカードを1枚タップ → もう一度タップか「引く」で引けるよ",shinkei:"カードを2枚めくって、同じ数字ならゲット！"};
const firstHint = g => (S && S.phase==="play" && store.get("dfg_hint_"+g)!=="1" && HINT_TXT[g]) ? `<div class="firsthint" role="note">💡 ${HINT_TXT[g]}</div>` : "";
const MOVE_ACTS=["play","pass","give","bomb","uplay","udraw","upass","useven","bdraw","bpeek","bshuf","kflip"];
function noteMove(a){
  if(!a || !MOVE_ACTS.includes(a.t) || !S || S.phase!=="play") return;
  if(store.get("dfg_hint_"+S.game)!=="1") store.set("dfg_hint_"+S.game,"1");
  document.querySelectorAll(".firsthint").forEach(x=>x.remove());
}

// ---------- 手札で見た目いちばん上のカードを拾う ----------
let tapMemo={c:"",t:0,pre:null,x:0,y:0};
function topCardAt(e,q){
  if(!(e.detail===0 && e.clientX===0 && e.clientY===0)){        // キーボード由来の click は座標がない
    for(const x of document.elementsFromPoint(e.clientX,e.clientY)){ const c=x.closest && x.closest(q); if(c && c.parentElement && c.parentElement.id==="hand") return c; }
  }
  return e.target.closest(q);
}

// ---------- キーボード ----------
const kb={on:false,i:-1,k:-1};
const typing = t => !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
function kbCards(){ return [...document.querySelectorAll("#hand .card,#hand .ucard")]; }
function applyKbFocus(){
  document.querySelectorAll(".kf").forEach(x=>x.classList.remove("kf"));
  document.body.classList.toggle("kbon",kb.on);
  if(!kb.on || !S || screen!=="room" || S.phase!=="play") return;
  if(S.game==="shinkei"){ const el=document.querySelector(`.kslot[data-k="${kb.k}"]`); if(el) el.classList.add("kf"); return; }
  const cs=kbCards(); if(!cs.length) return;
  kb.i=Math.max(0,Math.min(cs.length-1,kb.i)); cs[kb.i].classList.add("kf");
}
function kbFirstPlayable(cs){ const i=cs.findIndex(c=>!c.classList.contains("dim")); return i<0?0:i; }
function kbMove(d){
  const cs=kbCards(); if(!cs.length) return;
  if(!kb.on || kb.i<0){ kb.on=true; if(kb.i<0) kb.i=kbFirstPlayable(cs); else kb.i=Math.max(0,Math.min(cs.length-1,kb.i+d)); }
  else kb.i=Math.max(0,Math.min(cs.length-1,kb.i+d));
  applyKbFocus();
}
function clickBtn(id){ const b=document.getElementById(id); if(b && !b.disabled && !b.hidden){ b.click(); return true; } return false; }
function kbShinkei(key){
  const kbd=document.getElementById("kboard"); if(!kbd) return false;
  const cols=getComputedStyle(kbd).gridTemplateColumns.split(" ").length, n=S.k.board.length;
  const gone=i=>S.k.taken[i]!==undefined;
  if(!kb.on||kb.k<0){ kb.on=true; if(kb.k<0||gone(kb.k)){ kb.k=0; while(kb.k<n-1 && gone(kb.k)) kb.k++; } applyKbFocus(); if(key.startsWith("Arrow")) return true; }
  const d={ArrowLeft:-1,ArrowRight:1,ArrowUp:-cols,ArrowDown:cols}[key];
  if(d){ let i=kb.k+d; while(i>=0 && i<n && gone(i) && Math.abs(d)===1) i+=d; if(i>=0&&i<n){ kb.k=i; } applyKbFocus(); return true; }
  if(key==="Enter"||key===" "){ const b=document.querySelector(`[data-ki="${kb.k}"]`); if(b){ b.click(); } else toast("そこはめくれないよ"); return true; }
  return false;
}
document.addEventListener("pointerdown",()=>{ if(kb.on){ kb.on=false; applyKbFocus(); } },true);
document.addEventListener("keydown",e=>{
  if(e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const t=e.target, key=e.key;
  if(key==="Escape"){
    if(typing(t) && t.id!=="chatIn") return;
    if(LAYERS.length){ e.preventDefault(); closeLayer(LAYERS[LAYERS.length-1]); return; }
    if(sel.size && inPlay()){ sel.clear(); renderGame(); }
    return;
  }
  if(typing(t)) return;
  if(key==="Tab" && ovEl && ovEl.firstChild){                       // シートの中でフォーカスを回す
    const fs=[...ovEl.querySelectorAll(".ovsheet:last-child button, .ovsheet:last-child input")].filter(x=>!x.disabled && !x.hidden && x.offsetParent!==null);
    if(fs.length){ const i=fs.indexOf(document.activeElement); const n=e.shiftKey ? (i<=0?fs.length-1:i-1) : (i<0||i===fs.length-1?0:i+1); fs[n].focus(); e.preventDefault(); }
    return;
  }
  if(LAYERS[LAYERS.length-1]==="wild"){                             // UNO の色えらび
    const m={r:"R",y:"Y",g:"G",b:"B","1":"R","2":"Y","3":"G","4":"B"}[key.toLowerCase()];
    if(m){ const b=document.querySelector(`[data-wc="${m}"]`); if(b){ e.preventDefault(); b.click(); } return; }
    if(key==="ArrowLeft"||key==="ArrowRight"){ const bs=[...document.querySelectorAll("[data-wc]")]; const i=bs.indexOf(document.activeElement); const n=(i+(key==="ArrowRight"?1:-1)+bs.length)%bs.length; bs[n].focus(); e.preventDefault(); }
    return;
  }
  if(LAYERS.length) return;
  const ae=document.activeElement, onBtn=ae && /^(BUTTON|A|SUMMARY)$/.test(ae.tagName);
  if(!S || screen!=="room") return;
  if((key==="c"||key==="C") && S.phase==="play"){
    if(mode!=="online") { return toast("チャットはオンラインの部屋で使えるよ"); }
    e.preventDefault(); chatOpen=true; unread=0; updateChat(); setTimeout(()=>{ const i=document.getElementById("chatIn"); if(i) i.focus(); },30); return;
  }
  if(S.phase!=="play") return;
  const g=S.game;
  if(g==="daifugo" && S.order.includes(myId)){
    if(key==="ArrowLeft"||key==="ArrowRight"){ e.preventDefault(); kbMove(key==="ArrowRight"?1:-1); return; }
    if(key==="ArrowUp"||key===" "){ if(key===" " && onBtn) return; e.preventDefault(); const cs=kbCards(); if(!kb.on||kb.i<0){ kbMove(0); } const c=kbCards()[kb.i]; if(c){ tapMemo={c:"",t:0,pre:null}; c.click(); } return; }
    if(key==="Enter"){ if(onBtn) return; e.preventDefault(); if(!clickBtn("play")) toast("まだ出せないよ"); return; }
    if(key==="p"||key==="P"){ e.preventDefault(); if(!clickBtn("pass")) toast("いまはパスできないよ"); return; }
  } else if(g==="uno" && S.order.includes(myId)){
    if(key==="ArrowLeft"||key==="ArrowRight"){ e.preventDefault(); kbMove(key==="ArrowRight"?1:-1); return; }
    if(key==="ArrowUp"||key===" "){ if(key===" " && onBtn) return; e.preventDefault(); if(!kb.on||kb.i<0) kbMove(0); const c=kbCards()[kb.i]; if(c && unoSel!==c.dataset.c) c.click(); return; }
    if(key==="Enter"){
      if(onBtn) return; e.preventDefault();
      if(S.u && S.u.pending && S.u.pending.pid===myId){ return; }
      if(!kb.on||kb.i<0) kbMove(0);
      const c=kbCards()[kb.i]; if(!c) return;
      if(unoSel!==c.dataset.c) c.click();                           // 選ぶ（描き直される）
      const c2=kbCards()[kb.i]; if(c2 && unoSel===c2.dataset.c) c2.click();   // もう一度で出す
      return;
    }
    if(key==="d"||key==="D"){ e.preventDefault(); if(!clickBtn("udeck")) toast("いまは引けないよ"); return; }
    if(key==="u"||key==="U"){ e.preventDefault(); if(!clickBtn("unobtn")) toast("まだUNO!は言えないよ"); return; }
    if(key==="p"||key==="P"){ e.preventDefault(); clickBtn("upass"); return; }
    if(/^[1-9]$/.test(key)){ const b=document.querySelectorAll("[data-swap]")[+key-1]; if(b){ e.preventDefault(); b.click(); } return; }
  } else if(g==="baba" && S.order.includes(myId)){
    const B=S.b, fan=[...document.querySelectorAll("#bfan [data-bi]")];
    if(key==="ArrowLeft"||key==="ArrowRight"){
      if(S.turn!==myId || !fan.length) return; e.preventDefault();
      const cur = B.hover && B.hover.by===myId ? B.hover.i : -1;
      const n = cur<0 ? 0 : Math.max(0,Math.min(fan.length-1,cur+(key==="ArrowRight"?1:-1)));
      kb.on=true; act({t:"bpeek",i:n}); return;
    }
    if(key==="Enter"){ if(onBtn) return; e.preventDefault(); if(!clickBtn("bdraw")) toast("先に引くカードを ← → で選んでね"); return; }
    if(key==="s"||key==="S"){ e.preventDefault(); clickBtn("bshuf"); return; }
  } else if(g==="shinkei" && S.order.includes(myId) && S.turn===myId){
    if(key==="Enter"&&onBtn) return;
    if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter"].includes(key)){ e.preventDefault(); kbShinkei(key); return; }
  }
});

// ---------- 画面が描かれるたびに ----------
function focusWild(){
  if(layerOpenMap().wild){ const a=document.activeElement; if(!(a && a.closest && a.closest("#wildpick"))){ const b=document.querySelector("[data-wc]"); if(b) b.focus(); } }
}
function uxSync(){
  pwaInit(); layerSync(); wakeSync(); updBar(); applyKbFocus(); focusWild();
  if(ux.set && ovEl) { /* 設定の中身は状態に依存しない部分が多いが、更新や遊び中の注意書きのために描き直す */ }
}
