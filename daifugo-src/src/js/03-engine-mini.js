// =====================================================================
// ババ抜き / 神経衰弱
// =====================================================================
const THROW_ITEMS_E=["🍅","🥚","💩","🩴","👏","💐","❤️","🪙"];
const GAME_NAMES={daifugo:"大富豪", uno:"UNO", baba:"ババ抜き", shinkei:"神経衰弱"};
function plainDeck(jokers){ const d=[]; for(const s of SUITS) for(let r=3;r<=15;r++) d.push(s+r); if(jokers>=1) d.push("X16"); if(jokers>=2) d.push("W16"); 
  for(let i=d.length-1;i>0;i--){ const k=Math.floor(Math.random()*(i+1)); [d[i],d[k]]=[d[k],d[i]]; } return d; }
const shuffleArr = a => { for(let i=a.length-1;i>0;i--){ const k=Math.floor(Math.random()*(i+1)); [a[i],a[k]]=[a[k],a[i]]; } return a; };
function miniStart(s){
  const ids=s.players.map(p=>p.id);
  s.order=ids.slice(); s.hands={}; ids.forEach(id=>s.hands[id]=[]);
  s.finished=[]; s.losers=[]; s.passed=[]; s.ranking=[]; s.field=null; s.rev=false; s.eb=false; s.lock=null; s.stair=false; s.pending=null; s.after=null; s.u=null;
  s.players.forEach(p=>{ p.ready=false; delete p.wait; if(p.offline){ p.bot=true; p.away=true; delete p.offline; delete p.offAt; } });
  s.round=(s.round||0)+1; s.log=[]; s.phase="play";
  return ids;
}
// ---- ババ抜き ----
const bActive = s => s.order.filter(id=>!s.finished.includes(id) && !s.losers.includes(id));
function bNext(s,pid){ const o=s.order, act=bActive(s); let i=o.indexOf(pid); for(let k=0;k<o.length;k++){ i=(i+1)%o.length; if(act.includes(o[i]) && o[i]!==pid) return o[i]; } return null; }
function bDropPairs(hand){            // 同じ数字2枚ずつ捨てる。捨てた数を返す
  const by={}; hand.forEach(c=>{ const r=parse(c).r; if(r!==16) (by[r]=by[r]||[]).push(c); });
  const out=[]; for(const r in by){ const cs=by[r]; while(cs.length>=2){ out.push(cs.pop(),cs.pop()); } }
  return out;
}
function babaStart(s){
  const ids=miniStart(s);
  const d=plainDeck(1), off=Math.floor(Math.random()*ids.length);
  d.forEach((c,i)=>s.hands[ids[(i+off)%ids.length]].push(c));
  s.b={hover:null, last:null, pairs:{}};
  for(const id of ids){ const drop=bDropPairs(s.hands[id]); s.hands[id]=s.hands[id].filter(c=>!drop.includes(c)); s.b.pairs[id]=drop.length/2; shuffleArr(s.hands[id]); }
  log(s,`ババ抜き 第${s.round}回戦 開始（ペアは自動で捨てたよ）`);
  fx(s,"round",{n:s.round, game:"baba"});
  for(const id of ids) bCheckOut(s,id);
  s.turn=bActive(s)[Math.floor(Math.random()*bActive(s).length)]||ids[0];
  log(s,`${nameOf(s,s.turn)} から`);
  bEndIfDone(s);
}
function bCheckOut(s,id){
  if(!s.hands[id].length && !s.finished.includes(id)){
    s.finished.push(id); log(s,`🎉 ${nameOf(s,id)} 上がり（${s.finished.length}位）`);
    fx(s,"finish",{who:nameOf(s,id), place:s.finished.length, id, n:s.order.length, title:s.finished.length===1?"一抜け":`${s.finished.length}位`, game:"baba"});
  }
}
function bEndIfDone(s){
  const act=bActive(s);
  if(act.length>1) return false;
  if(act.length===1) s.losers.push(act[0]);
  s.ranking=s.finished.concat(s.losers);
  s.titles={}; s.ranking.forEach((id,i)=>s.titles[id]= i===0?"一抜け": id===act[0]?"ババ持ち":`${i+1}位`);
  s.prevFinish=[]; s.phase="result"; s.b.hover=null;
  log(s, act[0]?`🃏 ${nameOf(s,act[0])} がババを持って負け！`:"ラウンド終了");
  fx(s,"end",{king:s.ranking[0], loser:act[0]||null, ltitle:"ババ持ち", game:"baba"});
  return true;
}
function bPeek(s,pid,i){
  if(s.phase!=="play" || s.turn!==pid) return "あなたの番じゃない";
  const t=bNext(s,pid); if(!t) return "相手がいない";
  if(!Number.isInteger(i) || !(i>=0 && i<s.hands[t].length)) return "そのカードはない";
  if(s.b.hover && s.b.hover.i===i && s.b.hover.by===pid) return false;
  s.b.hover={by:pid, to:t, i}; return true;
}
function bDraw(s,pid,i){
  if(s.phase!=="play" || s.turn!==pid) return "あなたの番じゃない";
  const t=bNext(s,pid); if(!t) return "相手がいない";
  const th=s.hands[t];
  if(!Number.isInteger(i) || !(i>=0 && i<th.length)) return "そのカードはない";
  const card=th.splice(i,1)[0];
  const r=parse(card).r, mate = r===16 ? -1 : s.hands[pid].findIndex(c=>parse(c).r===r);
  let pair=null;
  if(mate>=0){ pair=[card, s.hands[pid].splice(mate,1)[0]]; s.b.pairs[pid]=(s.b.pairs[pid]||0)+1; }
  else { s.hands[pid].splice(Math.floor(Math.random()*(s.hands[pid].length+1)),0,card); }
  s.b.hover=null;
  s.b.last={from:t, to:pid, pair:!!pair};
  fx(s,"bdraw",{from:t, to:pid, pair, priv:{ids:[t,pid], card}});
  log(s, pair ? `${nameOf(s,pid)} が ${nameOf(s,t)} から引いてペア！ ${cardText(pair[0])}${cardText(pair[1])}` : `${nameOf(s,pid)} が ${nameOf(s,t)} から1枚引いた`);
  bCheckOut(s,t); bCheckOut(s,pid);
  if(bEndIfDone(s)) return true;
  s.turn = bActive(s).includes(t) ? t : bNext(s,t);
  return true;
}
function bShuffle(s,pid){
  if(s.phase!=="play" || !bActive(s).includes(pid) || (s.hands[pid]||[]).length<2) return false;
  shuffleArr(s.hands[pid]);
  if(s.b.hover && s.b.hover.to===pid) s.b.hover=null;
  fx(s,"bshuf",{id:pid}); return true;
}
// 公開情報から作った「誰がババを持ってるっぽいか」は使わず、ただのランダム＋ちょっと人間っぽく
function babaBot(s,pid){
  const t=bNext(s,pid); if(!t) return "相手なし";
  const n=s.hands[t].length, hv=s.b.hover;
  if(!hv || hv.by!==pid || hv.to!==t || hv.i>=n){ return bPeek(s,pid,Math.floor(Math.random()*n)); }
  if(n>1 && Math.random()<.35){ let j=Math.floor(Math.random()*(n-1)); if(j>=hv.i) j++; return bPeek(s,pid,j); }   // 迷う
  return bDraw(s,pid,hv.i);
}

// ---- 神経衰弱 ----
function shinkeiStart(s){
  const ids=miniStart(s);
  const big = ids.length>=5;
  // 少人数は 13ペア×2(=52枚)、多人数はジョーカー2枚も入れて全部
  const d=plainDeck(big?2:0);
  s.k={board:d, up:[], miss:null, taken:{}, scores:{}, mem:{}, combo:0};
  ids.forEach(id=>s.k.scores[id]=0);
  log(s,`神経衰弱 第${s.round}回戦 開始（${d.length}枚）`);
  fx(s,"round",{n:s.round, game:"shinkei"});
  s.turn=ids[Math.floor(Math.random()*ids.length)];
  log(s,`${nameOf(s,s.turn)} から`);
}
const kPair = (a,b) => parse(a).r===parse(b).r;
function kFlip(s,pid,i){
  if(s.phase!=="play" || s.turn!==pid) return "あなたの番じゃない";
  const K=s.k;
  if(!Number.isInteger(i) || !(i>=0 && i<K.board.length) || K.taken[i]!==undefined || K.up.includes(i)) return "そこはめくれない";
  K.miss=null;
  K.up.push(i); K.mem[i]=K.board[i];
  if(K.up.length<2){ fx(s,"kflip",{id:pid,i,card:K.board[i]}); return true; }
  const [a,b]=K.up, ca=K.board[a], cb=K.board[b];
  if(kPair(ca,cb)){
    K.taken[a]=pid; K.taken[b]=pid; K.scores[pid]=(K.scores[pid]||0)+1; K.up=[]; K.combo=(K.combo||0)+1;
    delete K.mem[a]; delete K.mem[b];
    log(s,`✨ ${nameOf(s,pid)} が ${cardText(ca)}${cardText(cb)} をゲット（${K.scores[pid]}組）`);
    fx(s,"kmatch",{id:pid,i,card:K.board[i],a,b,combo:K.combo,who:nameOf(s,pid)});
    if(Object.keys(K.taken).length>=K.board.length){ kEnd(s); }
    return true;
  }
  K.miss=[a,b]; K.up=[]; K.combo=0;
  fx(s,"kmiss",{id:pid,i,card:K.board[i],a,b});
  const o=s.order; s.turn=o[(o.indexOf(pid)+1)%o.length];
  return true;
}
function kEnd(s){
  const K=s.k;
  s.ranking=s.order.slice().sort((a,b)=>K.scores[b]-K.scores[a]);
  s.titles={}; s.ranking.forEach((id,i)=>s.titles[id]= i===0?"記憶王":`${i+1}位`);
  s.finished=s.ranking.slice(); s.prevFinish=[]; s.phase="result";
  const loser=s.ranking[s.ranking.length-1];
  log(s,`🏆 ${nameOf(s,s.ranking[0])} の勝ち！（${K.scores[s.ranking[0]]}組）`);
  fx(s,"end",{king:s.ranking[0], loser: s.ranking.length>1 && K.scores[loser]<K.scores[s.ranking[0]] ? loser : null, ltitle:"ビリ", game:"shinkei"});
}
function shinkeiBot(s,pid){
  const K=s.k, free=K.board.map((c,i)=>i).filter(i=>K.taken[i]===undefined && !K.up.includes(i));
  const mem=Object.entries(K.mem).map(([i,c])=>[+i,c]).filter(([i])=>free.includes(i) && Math.random()<.72);   // ちょっと忘れる
  if(K.up.length===1){
    const u=K.up[0], m=mem.find(([i,c])=>i!==u && kPair(c,K.board[u]));
    if(m) return kFlip(s,pid,m[0]);
    const unknown=free.filter(i=>K.mem[i]===undefined);
    const pool=unknown.length?unknown:free;
    return kFlip(s,pid,pool[Math.floor(Math.random()*pool.length)]);
  }
  for(let x=0;x<mem.length;x++) for(let y=x+1;y<mem.length;y++) if(kPair(mem[x][1],mem[y][1])) return kFlip(s,pid,mem[x][0]);
  const unknown=free.filter(i=>K.mem[i]===undefined);
  const pool=unknown.length?unknown:free;
  return kFlip(s,pid,pool[Math.floor(Math.random()*pool.length)]);
}

function replaceId(s, oldId, newId){
  s.players.forEach(p=>{ if(p.id===oldId) p.id=newId; });
  const rep = a => (a||[]).map(x=>x===oldId?newId:x);
  ["order","passed","finished","losers","ranking","prevFinish"].forEach(k=>s[k]=rep(s[k]));
  for(const k of ["hands","titles","counts"]) if(s[k] && s[k][oldId]!==undefined){ s[k][newId]=s[k][oldId]; delete s[k][oldId]; }
  ["turn","lastPlayer","host"].forEach(k=>{ if(s[k]===oldId) s[k]=newId; });
  if(s.field && s.field.by===oldId) s.field.by=newId;
  if(s.pending){ if(s.pending.pid===oldId) s.pending.pid=newId; if(s.pending.to===oldId) s.pending.to=newId; }
  if(s.after && s.after.pid===oldId) s.after.pid=newId;
  if(s.u){
    if(s.u.drew && s.u.drew.pid===oldId) s.u.drew.pid=newId;
    if(s.u.pending && s.u.pending.pid===oldId) s.u.pending.pid=newId;
    if(s.u.called && s.u.called[oldId]!==undefined){ s.u.called[newId]=s.u.called[oldId]; delete s.u.called[oldId]; }
    if(s.u.scores && s.u.scores[oldId]!==undefined){ s.u.scores[newId]=s.u.scores[oldId]; delete s.u.scores[oldId]; }
  }
  if(s.b){
    if(s.b.hover){ if(s.b.hover.by===oldId) s.b.hover.by=newId; if(s.b.hover.to===oldId) s.b.hover.to=newId; }
    if(s.b.last){ if(s.b.last.from===oldId) s.b.last.from=newId; if(s.b.last.to===oldId) s.b.last.to=newId; }
    if(s.b.pairs && s.b.pairs[oldId]!==undefined){ s.b.pairs[newId]=s.b.pairs[oldId]; delete s.b.pairs[oldId]; }
  }
  if(s.k){
    if(s.k.scores && s.k.scores[oldId]!==undefined){ s.k.scores[newId]=s.k.scores[oldId]; delete s.k.scores[oldId]; }
    for(const i in s.k.taken) if(s.k.taken[i]===oldId) s.k.taken[i]=newId;
  }
}
