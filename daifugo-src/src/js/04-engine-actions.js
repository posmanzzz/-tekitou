let botSeq=0;
const BOT_NAMES=["タロウ","ハナコ","ジロウ","サクラ","ケンタ","ミドリ","ゴロウ","モモ","リク","ユイ"];
function addBot(s){
  if(s.players.length>=MAX_PLAYERS) return `最大${MAX_PLAYERS}人`;
  const used=s.players.map(p=>p.name);
  const nm=BOT_NAMES.find(b=>!used.includes("CPU "+b))||"X";
  s.players.push({id:"b"+Date.now().toString(36)+(botSeq++)+Math.random().toString(36).slice(2,5),name:"CPU "+nm,bot:true});
  return true;
}

// ---- 1手ぶんのCPU思考（CPUの手番と、人間の時間切れ代打ちで共用） ----
function botStep(s,pid){
  if(s.game==="uno") return unoBot(s,pid);
  if(s.game==="baba") return babaBot(s,pid);
  if(s.game==="shinkei") return shinkeiBot(s,pid);
  if(xchgOn(s)) return "カード交換中";
  if(s.pending) return botPending(s);
  const mv=botMove(s,pid);
  const h0=sortHand(s.hands[pid]||[],effRev(s));
  return mv ? doPlay(s,pid,mv) : (s.field ? doPass(s,pid) : (h0.length ? doPlay(s,pid,[h0[0]]) : "手札なし"));
}
// 人間の手番が時間切れになった時の「1手ぶん」の自動操作（選択待ち・引いた後の出し直しなど、同じ手番の続きまで）
function autoTurn(s,pid){
  if(s.game==="baba"){ const t=bNext(s,pid); if(!t) return "相手がいない"; return bDraw(s,pid,Math.floor(Math.random()*s.hands[t].length)); }
  const r=botStep(s,pid); if(r!==true) return r;
  for(let n=0; n<3 && s.phase==="play" && s.turn===pid; n++){
    if(s.game==="daifugo"){ if(!(s.pending && s.pending.pid===pid)) break; }
    else if(s.game==="uno"){ if(!((s.u.drew && s.u.drew.pid===pid) || (s.u.pending && s.u.pending.pid===pid))) break; }
    else if(s.game==="shinkei"){ if(s.k.up.length!==1) break; }
    else break;
    if(botStep(s,pid)!==true) break;
  }
  return true;
}
const TIMER_CHOICES=[0,15,30,60];
function afkClear(s,p){ if(p.afk){ delete p.afk; p.bot=false; p.away=false; log(s,`${p.name} が戻ってきた`); } if(p.to) delete p.to; }
// 本人の操作ではない（ホスト運営・CPU・退出）アクション。これらでは「離席」を解除しない
const NOT_SELF_ACTS=["cbet","season","bot","auto","tobot","disc","drop","prune","kick","rm","addbot","timer","leave","rules","urules","game","lock","fair","pub","start","next"];

// エンジンが内部で捕まえた例外の数と最後の例外（テスト用。通常は0のはず）
let engErr=0, engLast=null;
// applyAction は「全操作の入口」。返り値 true=適用 / 文字列=本人へのエラー / false=無視。
// ・不正な引数でも絶対に投げない。内部で例外が起きたら状態を元に戻して false を返す（トランザクション）
// ・拒否した操作（true以外）は状態を一切変えない
function applyAction(s, actor, a){
  if(!ID_OK(actor) || !isObj(a) || typeof a.t!=="string" || !isObj(s)) return false;
  const bak=JSON.stringify(s);
  try{ return applyActionInner(s,actor,a); }
  catch(e){
    engErr++; engLast=e;
    const o=JSON.parse(bak); for(const k of Object.keys(s)) delete s[k]; Object.assign(s,o);
    return false;
  }
}
function applyActionInner(s, actor, a){
  s.fxk=[];
  const host = actor===s.host;
  const ph0=s.phase;
  let r=false;
  const me0=s.players.find(p=>p.id===actor);
  switch(a.t){
    case "join": {
      if(a.name!==undefined && typeof a.name!=="string") break;
      const name=cleanName(a.name||"")||"名無し";
      const kh=okKh(a.kh)?a.kh:null;
      const me=s.players.find(p=>p.id===actor);
      if(me && me.kh && kh!==me.kh){ r="本人確認に失敗した（別の端末・ブラウザからは同じ人として入れないよ）"; break; }
      if(kh && (s.banned||[]).includes(kh)){ r="この部屋には入れません"; break; }
      if(me){
        if(!me.kh && kh){ me.kh=kh; r=true; }       // 鍵をまだ持たない席には、最初に示された鍵を結びつける
        if(me.away || me.offline){ me.away=false; me.bot=false; delete me.offline; delete me.offAt; delete me.afk; delete me.to; log(s,`${me.name} が復帰`); r=true; }
        break;
      }
      const same=s.players.find(p=>p.name===name);
      if(s.locked && !(same && same.kh && same.kh===kh)){ r="🔒 この部屋は鍵がかかってる（ホストに開けてもらってね）"; break; }
      if(same && (same.away || same.offline) && (!same.kh || same.kh===kh)){ replaceId(s,same.id,actor); same.bot=false; same.away=false; delete same.offline; delete same.offAt; delete same.afk; delete same.to; log(s,`${name} が復帰`); r=true; break; }
      if(same){ r="同じ名前の人がいるよ（別の名前にしてね）"; break; }
      if(s.phase==="play"){
        // 途中参加: 抜けた人の席→まだ残ってるCPUの席→観戦（次ラウンドから）
        const out=outSet(s);
        const seat = s.players.find(p=>p.bot && !p.away && s.order.includes(p.id) && !out.has(p.id))
                  || s.players.find(p=>p.away && s.order.includes(p.id) && !out.has(p.id));
        if(seat){
          const old=seat.name; replaceId(s,seat.id,actor);
          seat.bot=false; seat.away=false; delete seat.afk; delete seat.to; seat.name=name; if(kh) seat.kh=kh; else delete seat.kh;
          log(s,`${name} が途中参加（${old}の席）`); fx(s,"join",{who:name}); r=true; break;
        }
      }
      if(s.players.length>=MAX_PLAYERS){ r=`満員（${MAX_PLAYERS}人）です`; break; }
      if(!s.players.some(p=>!p.bot)) s.host=actor;
      s.players.push({id:actor,name,bot:false,ready:false, ...(kh?{kh}:{}), ...(s.phase==="play"?{wait:true}:{})});
      log(s, s.phase==="play" ? `${name} が観戦中（次のラウンドから参加）` : `${name} が入室`); fx(s,"join",{who:name}); r=true; break;
    }
    case "leave": {
      const p=s.players.find(x=>x.id===actor); if(!p) break;
      if(s.phase==="play" && s.order.includes(p.id)){ p.bot=true; p.away=true; delete p.afk; log(s,`${p.name} が抜けた（CPUが代打ち）`); }
      else { s.players=s.players.filter(x=>x.id!==actor); s.ranking=s.ranking.filter(x=>x!==actor); log(s,`${p.name} が退出`); }
      if(s.host===actor){ const h=s.players.find(x=>!x.bot); if(h) s.host=h.id; }
      r=true; break;
    }
    case "disc": {   // ホスト専用: 接続が切れた（本人の退出ではない）。ロビーでは席を残して待つ
      if(!host || a.id===s.host) break;
      const p=s.players.find(x=>x.id===a.id); if(!p || p.bot) break;
      if(s.phase==="play" && s.order.includes(p.id)){ p.bot=true; p.away=true; log(s,`${p.name} の接続が切れた（CPUが代打ち）`); }
      else { p.offline=true; p.offAt=Number.isFinite(a.at)?a.at:Date.now(); p.ready=false; log(s,`${p.name} の接続が切れた（待機中）`); }
      r=true; break;
    }
    case "prune": {  // ホスト専用: 長く戻らないオフライン勢をロビーから外す
      if(!host || s.phase==="play") break;
      const now=Number.isFinite(a.at)?a.at:Date.now(), n=s.players.length;
      s.players=s.players.filter(p=>!(p.offline && now-(p.offAt||0)>60000));
      s.ranking=(s.ranking||[]).filter(id=>s.players.some(p=>p.id===id));
      r=s.players.length!==n; break;
    }
    case "drop": {   // ホスト専用: 接続が死んでる人を片付ける
      if(!host || a.id===s.host) break;
      const p=s.players.find(x=>x.id===a.id); if(!p) break;
      if(s.phase==="play" && s.order.includes(p.id)){ if(!p.away){ p.bot=true; p.away=true; log(s,`${p.name} の接続が切れた（CPUが代打ち）`); r=true; } }
      else { s.players=s.players.filter(x=>x.id!==p.id); s.ranking=(s.ranking||[]).filter(x=>x!==p.id); r=true; }
      break;
    }
    case "pub": if(host){ s.pub=!!a.v; if(typeof a.title==="string") s.title=clip(safeText(a.title).trim(),20); r=true; } break;
    case "lock": if(host){ s.locked=!!a.v; log(s, s.locked?"🔒 ホストが部屋に鍵をかけた":"🔓 部屋の鍵を開けた"); r=true; } break;
    case "fair": if(host && s.phase!=="play"){ s.fair=!!a.v; r=true; } break;
    case "timer": if(host && s.phase!=="play" && typeof a.sec==="number" && TIMER_CHOICES.includes(a.sec)){ s.tsec=a.sec; log(s, a.sec ? `⏱ 1手の制限時間: ${a.sec}秒` : "⏱ 制限時間なし"); r=true; } break;
    case "kick": {
      if(!host || a.id===actor) break;
      const p=s.players.find(x=>x.id===a.id); if(!p || p.bot) break;
      const kname=p.name;
      if(p.kh) s.banned=(s.banned||[]).concat(p.kh).slice(-30);
      if(s.phase==="play" && s.order.includes(p.id)){ p.bot=true; p.away=true; p.name="CPU 代打ち"; delete p.kh; delete p.afk; replaceId(s,p.id,"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)); }
      else { s.players=s.players.filter(x=>x.id!==p.id); s.ranking=(s.ranking||[]).filter(x=>x!==p.id); }
      log(s,`🚪 ${kname} を退出させた`);
      r=true; break;
    }
    case "addbot": if(host && s.phase!=="play") r=addBot(s); break;
    case "rm": if(host && s.phase!=="play" && a.id!==actor){ const n=s.players.length; s.players=s.players.filter(p=>p.id!==a.id); s.ranking=s.ranking.filter(x=>x!==a.id); r=s.players.length!==n; } break;
    case "tobot": if(host && s.phase==="play" && a.id!==s.host){ const p=s.players.find(x=>x.id===a.id); if(p&&!p.bot){ p.bot=true; p.away=true; log(s,`${p.name} をCPUに交代`); r=true; } } break;
    case "game": if(host && s.phase!=="play" && typeof a.g==="string" && Object.prototype.hasOwnProperty.call(GAME_NAMES,a.g) && s.game!==a.g){
      s.game=a.g; s.ranking=[]; s.titles={}; s.prevFinish=[]; s.round=0; s.u=null; s.b=null; s.k=null; s.xchg=null;
      log(s,`🎮 ゲームを「${GAME_NAMES[a.g]}」に変更`); fx(s,"game",{g:a.g}); r=true; } break;
    case "urules": if(host && s.phase!=="play" && isObj(a.rules)){
      const nr={...(s.urules||UNO_DEFAULT)};
      for(const d of UNO_RULE_DEFS) if(typeof a.rules[d.k]==="boolean") nr[d.k]=a.rules[d.k];
      s.urules=nr; r=true; } break;
    case "bpeek": if(s.game==="baba") r=bPeek(s,actor,a.i); break;
    case "bdraw": if(s.game==="baba") r=bDraw(s,actor,a.i); break;
    case "bshuf": if(s.game==="baba") r=bShuffle(s,actor); break;
    case "kflip": if(s.game==="shinkei") r=kFlip(s,actor,a.i); break;
    case "uplay": if(s.game==="uno" && typeof a.card==="string") r=uPlay(s,actor,a.card,a.color); break;
    case "udraw": if(s.game==="uno") r=uDraw(s,actor); break;
    case "upass": if(s.game==="uno") r=uPass(s,actor); break;
    case "uno":   if(s.game==="uno") r=uCallUno(s,actor); break;
    case "useven":if(s.game==="uno" && typeof a.target==="string") r=uSeven(s,actor,a.target); break;
    case "rules": if(host && s.phase!=="play" && isObj(a.rules)){
      const nr={...s.rules};
      for(const d of RULE_DEFS) if(typeof a.rules[d.k]==="boolean") nr[d.k]=a.rules[d.k];
      if(typeof a.rules.jokers==="number" && [0,1,2].includes(a.rules.jokers)) nr.jokers=a.rules.jokers;
      s.rules=nr; r=true; } break;
    case "start": case "next": {
      if(!host || s.phase==="play" || s.players.length<2) break;
      const notReady=s.players.filter(p=>!p.bot && !p.offline && p.id!==s.host && !p.ready);
      if(notReady.length && !a.force){ r=`${notReady.map(p=>p.name).join("、")} の準備待ち`; break; }
      coinPreRound(s);
      if(s.game==="uno"){ if(!s.urules) s.urules={...UNO_DEFAULT}; unoStartRound(s); } else if(s.game==="baba") babaStart(s); else if(s.game==="shinkei") shinkeiStart(s); else startRound(s);
      r=true; break;
    }
    case "throw": {
      const p=s.players.find(x=>x.id===actor), item=THROW_ITEMS_E.includes(a.item)?a.item:null;
      if(!p || !item || typeof a.to!=="string" || a.to===actor || !s.players.some(x=>x.id===a.to)) break;
      const to=a.to;
      const now=Date.now(); s.thrAt=s.thrAt||{};          // 時刻はエンジンの時計（送信者の申告は信用しない）
      if(now-(s.thrAt[actor]||0) < 450) break;
      s.thrAt[actor]=now;
      const T=s.thr||{n:0,k:[]}; s.thr={n:T.n+1, k:T.k.concat({n:T.n+1,from:actor,to,item}).slice(-6)};
      r=true; break;
    }
    case "ready": { const p=s.players.find(x=>x.id===actor); if(p && s.phase!=="play"){ p.ready=!!a.v; r=true; } break; }
    case "chat": {
      const p=s.players.find(x=>x.id===actor);
      if(!p || typeof a.text!=="string") break;
      const text=clip(safeText(a.text.slice(0,200)).trim(),80);
      if(!text) break;
      const now=Date.now(); s.chatAt=s.chatAt||{};
      if(now-(s.chatAt[actor]||0) < 700) break;                       // 連投は無視
      s.chatAt[actor]=now;
      const list=s.chat||[], last=list[list.length-1];
      if(last && last.by===actor && last.text===text && now-(last.at||0)<15000){   // 同じ発言の連続はまとめる
        s.chat=list.slice(0,-1).concat({...last, id:(s.chatN=(s.chatN||0)+1), n:(last.n||1)+1, at:now});
      } else s.chat=list.concat({id:(s.chatN=(s.chatN||0)+1), by:actor, name:p.name, text, at:now}).slice(-40);
      r=true; break;
    }
    case "give": { const c=s.game==="daifugo" ? strList(a.cards,60) : null; if(c) r=doGive(s,actor,c); break; }
    case "xgive": { const c=s.game==="daifugo" ? strList(a.cards,60) : null; if(c) r=xchgGive(s,actor,c); break; }
    case "bomb": if(s.game==="daifugo" && Array.isArray(a.ranks) && a.ranks.length<=20) r=doBomb(s,actor,a.ranks); break;
    case "play": { const c=s.game==="daifugo" ? strList(a.cards,60) : null; if(c) r=doPlay(s,actor,c); break; }
    case "pass": if(s.game==="uno"){ r=uPass(s,actor); break; } if(s.game!=="daifugo") break; r=doPass(s,actor); break;
    case "bot": {
      if(!host || s.phase!=="play") break;
      const p=s.players.find(x=>x.id===s.turn); if(!p||!p.bot) break;
      r=botStep(s,p.id);
      break;
    }
    case "auto": {   // ホスト専用: 制限時間切れの人間に代わって1手打つ。2回続けて切れたら離席扱い（CPUが代打ち）
      if(!host || s.phase!=="play" || typeof a.id!=="string") break;
      const p=s.players.find(x=>x.id===a.id); if(!p || p.bot || !s.order.includes(p.id)) break;
      if(s.game==="daifugo" && xchgOn(s)){           // カード交換中の時間切れ: 渡す側の人が、いちばん弱いカードを自動で渡す
        const P=xchgPending(s,p.id); if(!P) break;
        r=xchgDo(s,P,byStrength(s.hands[p.id]).slice(0,P.k));
      } else { if(s.turn!==p.id) break; r=autoTurn(s,p.id); }
      if(r===true){
        p.to=(p.to||0)+1; log(s,`⏰ ${p.name} の時間切れ（かわりに出したよ）`);
        if(p.to>=2){ p.afk=true; p.bot=true; p.away=true; log(s,`💤 ${p.name} は離席扱い（動くまでCPUが代打ち）`); fx(s,"afk",{who:p.name,id:p.id}); }
      }
      break;
    }
    case "bet": r=betPlace(s,actor,a.on,a.stake); break;
    case "cbet": {   // ホスト専用: CPUの賭け（人間の代わりをしている離席CPUは賭けない）
      if(!host || typeof a.id!=="string") break;
      const p=s.players.find(x=>x.id===a.id); if(!p || !p.bot || p.away) break;
      r=betPlace(s,p.id,a.on,a.stake); break;
    }
    case "season": if(host && s.phase!=="play" && SEASON_CHOICES.includes(a.len)){ coinEnsure(s); s.sea.len=a.len; log(s, a.len?`🏆 ${a.len}回戦で表彰`:"🏆 表彰なし"); r=true; } break;
    case "back": { const p=s.players.find(x=>x.id===actor); if(p && p.afk){ afkClear(s,p); r=true; } break; }
  }
  if(r===true && me0 && !NOT_SELF_ACTS.includes(a.t)){ const p=s.players.find(x=>x.id===actor); if(p && (p.afk || p.to)) afkClear(s,p); }
  if(r===true && s.game==="daifugo" && xchgOn(s)) xchgAdvance(s);      // CPU/離席になった人の分を渡す・全員済んだら開始
  if(r===true) coinSync(s,ph0);
  if(r===true){
    s.v=(s.v||0)+1; s.updatedAt=Date.now();
    if(a.t!=="chat" && a.t!=="throw" && a.t!=="bet" && a.t!=="cbet") s.gv=(s.gv||0)+1;       // 賭けは gv を進めない（制限時間・CPUの手を巻き込まない）          // ゲームに関わる変化の番号（チャットだけなら増えない）
    s.counts={}; for(const id in s.hands) s.counts[id]=s.hands[id].length;
    if(s.fxk.length) s.fx={n:((s.fx&&s.fx.n)||0)+1, k:s.fxk};
  }
  delete s.fxk;
  return r;
}
// 他人に送るときは手札を隠す
function viewFor(s,pid){
  const v=JSON.parse(JSON.stringify(s)); v.hands={[pid]:s.hands[pid]||[]};
  if(v.u){ v.u.deckN=v.u.deck.length; v.u.deck=[]; if(v.u.drew && v.u.drew.pid!==pid) v.u.drew={pid:v.u.drew.pid}; }      // 山札の並びと「引いたカード」は本人以外に送らない
  if(v.k){ const K=v.k; v.k.board=K.board.map((c,i)=> K.taken[i]!==undefined || K.up.includes(i) || (K.miss&&K.miss.includes(i)) ? c : null); delete v.k.mem; }
  if(v.xchg) v.xchg.pairs=v.xchg.pairs.map(P=> P.rich===pid||P.poor===pid ? P : {rich:P.rich,poor:P.poor,k:P.k,ok:P.ok});     // 交換したカードは当事者2人だけ
  if(v.fx && v.fx.k) v.fx.k=v.fx.k.map(e=>{ if(!e.priv) return e; const x={...e}; if(!e.priv.ids.includes(pid)) delete x.priv; return x; });
  return v;
}


// ---------------------------------------------------------------------
// 受け取った状態の検証＆作り直し（クライアントがホストから、ホストがバックアップ/引き継ぎから受け取る時に必ず通す）
// 許可リスト方式：知ってるフィールドだけを、型・長さ・文字種を確かめて新しいオブジェクトに写す。
// 壊れてたら null。→ 悪意あるホストが送れるのは「おかしなゲーム」までで、描画側が型違いで落ちたり、HTMLが混ざったりしない。
// 新しいフィールドを状態に足したら、ここにも足すこと（足さないと受信側で消える）。
// ---------------------------------------------------------------------
const DCARD_RE=/^(?:[SHDC](?:[3-9]|1[0-5])|[XW]16)$/, UCARD_RE=/^[RYGBK][0-9SRDWF]\.\d{1,3}$/;
const okCard = c => typeof c==="string" && (DCARD_RE.test(c) || UCARD_RE.test(c));
function normState(r){
  if(!isObj(r)) return null;
  const int=(x,d=0,lo=0,hi=1e9)=>{ x=typeof x==="number" && Number.isFinite(x) ? Math.trunc(x) : d; return Math.min(hi,Math.max(lo,x)); };
  const str=(x,n)=>typeof x==="string" ? clip(safeText(x),n) : "";
  const idv=x=>ID_OK(x)?x:null;
  const ids=(x,n=12)=>Array.isArray(x) ? x.filter(ID_OK).slice(0,n) : [];
  const cards=(x,n=110)=>Array.isArray(x) ? x.filter(okCard).slice(0,n) : [];
  const idMap=(x,f)=>{ const o={}; if(isObj(x)) for(const k of Object.keys(x).slice(0,24)) if(ID_OK(k)) o[k]=f(x[k]); return o; };
  const S={};
  if(!Array.isArray(r.players) || r.players.length>40) return null;
  const seen=new Set(); S.players=[];
  for(const p of r.players){
    if(!isObj(p) || !ID_OK(p.id) || seen.has(p.id)) continue; seen.add(p.id);
    const q={id:p.id, name:cleanName(typeof p.name==="string"?p.name:"")||"名無し", bot:p.bot===true, ready:p.ready===true};
    for(const k of ["away","offline","wait","afk"]) if(p[k]===true) q[k]=true;
    if(okKh(p.kh)) q.kh=p.kh;
    if(typeof p.offAt==="number" && Number.isFinite(p.offAt)) q.offAt=p.offAt;
    if(typeof p.to==="number") q.to=int(p.to,0,0,9);
    S.players.push(q);
    if(S.players.length>=12) break;
  }
  S.phase=["lobby","play","result"].includes(r.phase)?r.phase:"lobby";
  S.game=(typeof r.game==="string" && Object.prototype.hasOwnProperty.call(GAME_NAMES,r.game))?r.game:"daifugo";
  S.host=idv(r.host)||"";
  S.v=int(r.v); S.gv=int(r.gv); S.round=int(r.round,0,0,99999); S.chatN=int(r.chatN); S.updatedAt=int(r.updatedAt,0,0,1e15);
  S.tsec=TIMER_CHOICES.includes(r.tsec)?r.tsec:0;
  for(const k of ["rev","eb","stair","sameMembers","aborted","locked","pub"]) S[k]=r[k]===true;
  S.fair=r.fair!==false;
  S.title=str(r.title,20);
  S.banned=Array.isArray(r.banned)?r.banned.filter(okKh).slice(-30):[];
  for(const k of ["order","passed","finished","losers","ranking","prevFinish"]) S[k]=ids(r[k]);
  S.turn=idv(r.turn); S.lastPlayer=idv(r.lastPlayer);
  S.hands=idMap(r.hands,x=>cards(x,60));
  S.counts=idMap(r.counts,x=>int(x,0,0,110));
  S.titles=idMap(r.titles,x=>str(x,12));
  S.lock=Array.isArray(r.lock) ? r.lock.filter(x=>typeof x==="string" && "SHDC".includes(x) && x.length===1).slice(0,4) : null;
  if(isObj(r.field)){
    const f=r.field; S.field={cards:cards(f.cards,60), type:f.type==="seq"?"seq":"group", n:int(f.n,0,0,60), rank:int(f.rank,0,0,16), min:int(f.min,0,0,16), max:int(f.max,0,0,16), by:idv(f.by)};
  } else S.field=null;
  S.pending=isObj(r.pending) ? {type:r.pending.type==="bomb"?"bomb":"seven", n:int(r.pending.n,0,0,20), pid:idv(r.pending.pid)||"", to:idv(r.pending.to)} : null;
  S.pendingQ=Array.isArray(r.pendingQ) ? r.pendingQ.filter(isObj).slice(0,6).map(q=>({type:q.type==="bomb"?"bomb":"seven", n:int(q.n,0,0,20)})) : [];
  S.xchg=isObj(r.xchg) && Array.isArray(r.xchg.pairs) ? {on:r.xchg.on===true, pairs:r.xchg.pairs.filter(isObj).slice(0,4).map(P=>({rich:idv(P.rich), poor:idv(P.poor), k:int(P.k,1,1,2), ok:P.ok===true,
      ...(Array.isArray(P.took)?{took:cards(P.took,2)}:{}), ...(Array.isArray(P.gave)?{gave:cards(P.gave,2)}:P.gave===null?{gave:null}:{})})).filter(P=>P.rich&&P.poor)} : null;
  S.after=isObj(r.after) ? {pid:idv(r.after.pid)||"", eight:r.after.eight===true, five:int(r.after.five,0,0,9)} : null;
  S.log=Array.isArray(r.log) ? r.log.slice(-12).map(x=>str(x,140)) : [];
  S.rules={}; for(const k of Object.keys(DEFAULT_RULES)) S.rules[k]= k==="jokers" ? ([0,1,2].includes(isObj(r.rules)&&r.rules.jokers)?r.rules.jokers:DEFAULT_RULES.jokers) : (isObj(r.rules)?r.rules[k]===true:DEFAULT_RULES[k]);
  S.urules={}; for(const k of Object.keys(UNO_DEFAULT)) S.urules[k]= isObj(r.urules) ? r.urules[k]===true : UNO_DEFAULT[k];
  if(isObj(r.u)){
    const u=r.u;
    S.u={deck:cards(u.deck), discard:cards(u.discard), color:UNO_COLORS.includes(u.color)?u.color:"R", dir:u.dir===-1?-1:1, stack:int(u.stack,0,0,300),
      stackType:u.stackType==="F"?"F":u.stackType==="D"?"D":null, deckN:int(u.deckN,0,0,110), dead:int(u.dead,0,0,999),
      drew: isObj(u.drew)&&idv(u.drew.pid) ? {pid:u.drew.pid, ...(okCard(u.drew.card)?{card:u.drew.card}:{})} : null,
      pending: isObj(u.pending)&&idv(u.pending.pid) ? {type:"seven", pid:u.pending.pid} : null,
      called:idMap(u.called,x=>x===true), scores:idMap(u.scores,x=>int(x,0,0,9999))};
  } else S.u=null;
  if(isObj(r.b)){
    const b=r.b;
    S.b={hover: isObj(b.hover)&&idv(b.hover.by)&&idv(b.hover.to) ? {by:b.hover.by,to:b.hover.to,i:int(b.hover.i,0,0,60)} : null,
      last: isObj(b.last)&&idv(b.last.from)&&idv(b.last.to) ? {from:b.last.from,to:b.last.to,pair:b.last.pair===true} : null,
      pairs:idMap(b.pairs,x=>int(x,0,0,60))};
  } else S.b=null;
  if(isObj(r.k)){
    const k=r.k, tk={}, mem={};
    if(isObj(k.taken)) for(const i of Object.keys(k.taken).slice(0,60)) if(/^\d{1,2}$/.test(i) && ID_OK(k.taken[i])) tk[i]=k.taken[i];
    if(isObj(k.mem)) for(const i of Object.keys(k.mem).slice(0,60)) if(/^\d{1,2}$/.test(i) && okCard(k.mem[i])) mem[i]=k.mem[i];
    S.k={board:Array.isArray(k.board)?k.board.slice(0,54).map(c=>okCard(c)?c:null):[], up:Array.isArray(k.up)?k.up.filter(i=>Number.isInteger(i)&&i>=0&&i<54).slice(0,2):[],
      miss:Array.isArray(k.miss)&&k.miss.length===2&&k.miss.every(i=>Number.isInteger(i)&&i>=0&&i<54)?k.miss.slice():null,
      taken:tk, scores:idMap(k.scores,x=>int(x,0,0,60)), combo:int(k.combo,0,0,99), mem};
  } else S.k=null;
  { // コイン経済
    const sgn=(x,d=0,lo=-1e9,hi=1e9)=>{ x=typeof x==="number" && Number.isFinite(x) ? Math.trunc(x) : d; return Math.min(hi,Math.max(lo,x)); };
    S.coins=idMap(r.coins,x=>int(x,COIN_START,0,1e9));
    for(const p of S.players) if(S.coins[p.id]===undefined) S.coins[p.id]=COIN_START;
    const sea=isObj(r.sea)?r.sea:{};
    S.sea={len:SEASON_CHOICES.includes(sea.len)?sea.len:5, n:int(sea.n,0,0,9999), fin:sea.fin===true, no:int(sea.no,1,1,9999), cer:Array.isArray(sea.cer)?ids(sea.cer,12):null};
    S.bk=int(r.bk); S.bv=int(r.bv);
    S.bet = isObj(r.bet) && Array.isArray(r.bet.cand) ? {k:int(r.bet.k), f:int(r.bet.f,0,0,99), cand:ids(r.bet.cand,12),
      bets:(Array.isArray(r.bet.bets)?r.bet.bets:[]).filter(b=>isObj(b)&&idv(b.id)&&idv(b.on)&&STAKES.includes(b.stake)).slice(0,12).map(b=>({id:b.id,on:b.on,stake:b.stake,m:int(b.m,11,11,120)}))} : null;
    S.bl=idMap(r.bl,x=>isObj(x)?{on:idv(x.on)||"",stake:int(x.stake,0,0,1000),m:int(x.m,11,11,120),r:["w","l","x"].includes(x.r)?x.r:"l",pay:int(x.pay,0,0,1e6)}:null);
    for(const k of Object.keys(S.bl)) if(!S.bl[k]) delete S.bl[k];
    S.rb=idMap(r.rb,x=>({p:sgn(isObj(x)?x.p:0),b:sgn(isObj(x)?x.b:0)}));
    S.rl=idMap(r.rl,x=>sgn(x));
    for(const m of [S.coins,S.bl,S.rb,S.rl]) for(const k of Object.keys(m)) if(!seen.has(k)) delete m[k];       // 席のない人のデータは持たない
  }
  S.chat=Array.isArray(r.chat) ? r.chat.filter(isObj).slice(-40).map(m=>({id:int(m.id), by:idv(m.by)||"", name:cleanName(typeof m.name==="string"?m.name:""), text:str(m.text,80), at:int(m.at,0,0,1e15), ...(m.n>1?{n:int(m.n,1,1,999)}:{})})) : [];
  S.thr = isObj(r.thr) ? {n:int(r.thr.n), k:Array.isArray(r.thr.k)?r.thr.k.filter(x=>isObj(x)&&THROW_ITEMS_E.includes(x.item)&&idv(x.from)&&idv(x.to)).slice(-6).map(x=>({n:int(x.n),from:x.from,to:x.to,item:x.item})):[]} : {n:0,k:[]};
  // 演出イベント: 1段のプリミティブ/短い配列/priv{ids,card}だけ通す
  const prim=x=>typeof x==="number" ? (Number.isFinite(x)?x:0) : typeof x==="boolean" ? x : typeof x==="string" ? clip(safeText(x),60) : null;
  const fxe=e=>{ if(!isObj(e) || typeof e.k!=="string") return null; const o={k:clip(safeText(e.k),16)}; let n=0;
    for(const key of Object.keys(e)){ if(key==="k"||++n>14||!/^[A-Za-z_][A-Za-z0-9_]{0,15}$/.test(key)) continue; const v=e[key];
      if(Array.isArray(v)) o[key]=v.slice(0,14).map(prim).filter(x=>x!==null);
      else if(isObj(v)){ const w={}; for(const kk of Object.keys(v).slice(0,6)) if(/^[A-Za-z_][A-Za-z0-9_]{0,15}$/.test(kk)){ const vv=v[kk]; w[kk]=Array.isArray(vv)?vv.slice(0,14).map(prim).filter(x=>x!==null):prim(vv); } o[key]=w; }
      else { const p=prim(v); if(p!==null) o[key]=p; } }
    return o; };
  S.fx={n:int(isObj(r.fx)?r.fx.n:0), k:isObj(r.fx)&&Array.isArray(r.fx.k) ? r.fx.k.slice(0,24).map(fxe).filter(Boolean) : []};
  // 整合性: ゲーム中は選んだゲームの状態が揃っていること
  if(S.phase==="play"){
    if(S.game==="uno" && !S.u) return null;
    if(S.game==="baba" && !S.b) return null;
    if(S.game==="shinkei" && !S.k) return null;
    if(!S.order.length) return null;
  }
  return S;
}
