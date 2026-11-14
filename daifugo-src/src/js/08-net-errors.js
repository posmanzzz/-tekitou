
// =====================================================================
// エラーの記録と復帰
// ・直近のエラーを小さなリングバッファに溜める（将来の「不具合報告をコピー」ボタン用に bugReport() で文字列化できる。グローバルには出さない）
// ・error / unhandledrejection を拾って、画面を描き直す。連続して起きる時は、死んだ画面ではなく「入口にもどる」ボタンのあるエラー画面を出す
// =====================================================================
const ERRS=[];
function pushErr(where,e){
  try{
    const m=String((e&&e.message)||e).slice(0,300), st=String((e&&e.stack)||"").split("\n").slice(0,4).join(" | ").slice(0,500);
    ERRS.push({t:Date.now(), where:String(where).slice(0,30), m, st}); if(ERRS.length>20) ERRS.shift();
  }catch(_){}
}
// 合言葉・鍵・他人の手札は含めない
function bugReport(){
  const lines=[`app ${typeof APP_VERSION==="string"?APP_VERSION:"?"} proto ${typeof PROTO==="number"?PROTO:"?"}`, `ua ${navigator.userAgent}`,
    `mode ${mode} net ${net} host ${typeof p2pHost!=="undefined"?p2pHost:"?"} screen ${screen}`, S?`game ${S.game} phase ${S.phase} players ${S.players&&S.players.length} v ${S.v}`:"no state"];
  for(const e of ERRS) lines.push(`${new Date(e.t).toISOString()} [${e.where}] ${e.m} :: ${e.st}`);
  return lines.join("\n");
}
const guard=(f,w)=>{ try{ return f(); }catch(e){ pushErr(w,e); } };
let recovering=false, errBurst=[];
function onGlobalError(kind,e){
  pushErr(kind,e);
  const now=Date.now(); errBurst=errBurst.filter(t=>now-t<4000); errBurst.push(now);
  if(recovering) return; recovering=true;
  setTimeout(()=>{ recovering=false; if(errBurst.length>=6) showCrash(); else render(); },50);
}
// PeerJS自身の内部例外（相手が null を送ると PeerJS が落とす。接続は生きてる）は記録だけして、描き直しや復帰はしない（連打で画面を潰されないように）
window.addEventListener("error", ev=>{ if(/peerjs/i.test(ev.filename||"") || /__peerData/.test(ev.message||"")){ pushErr("peerjs",ev.error||ev.message); return; } onGlobalError("error", ev.error||ev.message); });
window.addEventListener("unhandledrejection", ev=>onGlobalError("promise", ev.reason));
function showCrash(){
  try{
    document.body.classList.remove("revmode","ebmode","lockmode");
    app.innerHTML=`<div class="page"><h1>あれ？うまく表示できなかった</h1><div class="panel">画面を描くときにエラーが起きたよ。入口に戻ればたいてい直るよ。<div class="btnrow" style="margin-top:10px"><button id="crashback">入口にもどる</button><button class="ghost" id="crashreload">再読み込み</button></div></div></div>`;
    document.getElementById("crashback").onclick=()=>{ try{ backToEntry("画面の表示でエラーが起きたので、入口に戻ったよ"); }catch(e){ location.reload(); } };
    document.getElementById("crashreload").onclick=()=>location.reload();
  }catch(e){ pushErr("showCrash",e); }
}
