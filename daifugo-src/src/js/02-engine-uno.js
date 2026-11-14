// =====================================================================
// UNO エンジン
// カードID: 色(R/Y/G/B, ワイルドはK) + 値(0-9, S=スキップ, R=リバース, D=ドロー2, W=ワイルド, F=ワイルドドロー4) + "." + 通し番号
// =====================================================================
const UNO_COLORS=["R","Y","G","B"];
const UNO_COLOR_NAME={R:"赤",Y:"黄",G:"緑",B:"青"};
const UNO_RULE_DEFS=[
  {k:"stack",     name:"ドロー重ね",   desc:"+2に+2、+4を重ねて次の人へ回せる"},
  {k:"drawPlay",  name:"引いて即出し", desc:"引いたカードが出せればそのまま出せる"},
  {k:"drawUntil", name:"出せるまで引く", desc:"出せるカードが来るまで引き続ける"},
  {k:"unoPenalty",name:"UNO宣言",     desc:"残り1枚で宣言を忘れると2枚ペナルティ"},
  {k:"sevenZero", name:"7・0ルール",  desc:"7で誰かと手札交換、0で全員の手札が回る"},
  {k:"wild4Any",  name:"+4いつでも",  desc:"同じ色を持っていても+4を出せる"},
];
const UNO_DEFAULT={stack:true,drawPlay:true,drawUntil:false,unoPenalty:true,sevenZero:false,wild4Any:true};
const UNO_PRESETS={
  "定番":{...UNO_DEFAULT},
  "全部盛り":{stack:true,drawPlay:true,drawUntil:true,unoPenalty:true,sevenZero:true,wild4Any:true},
  "公式":{stack:false,drawPlay:true,drawUntil:false,unoPenalty:true,sevenZero:false,wild4Any:false},
};
const pU = id => { const s=String(id); return {c:s[0], v:s[1]}; };
const isWild = id => pU(id).c==="K";
const U_LABEL = v => ({S:"⊘",R:"⇄",D:"+2",W:"W",F:"+4"})[v] ?? v;
const U_NAME  = v => ({S:"スキップ",R:"リバース",D:"ドロー2",W:"ワイルド",F:"ワイルドドロー4"})[v] ?? v;
const uPoints = id => { const {v}=pU(id); return /\d/.test(v) ? +v : (v==="W"||v==="F") ? 50 : 20; };
function unoDeck(){
  const d=[]; let n=0;
  for(const c of UNO_COLORS){
    d.push(`${c}0.${n++}`);
    for(const v of ["1","2","3","4","5","6","7","8","9","S","R","D"]){ d.push(`${c}${v}.${n++}`); d.push(`${c}${v}.${n++}`); }
  }
  for(let i=0;i<4;i++){ d.push(`KW.${n++}`); d.push(`KF.${n++}`); }
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  return d;   // 108枚
}
const uActive = s => s.order.filter(p=>!s.finished.includes(p));
function uNext(s, from, k=1){
  const act=uActive(s), o=s.order; let i=o.indexOf(from);
  for(let step=0; step<k; ){
    i=(i+s.u.dir+o.length)%o.length;
    if(act.includes(o[i])) step++;
    if(act.length===0) break;
  }
  return o[i];
}
function uRefill(s){
  if(s.u.deck.length) return;
  const top=s.u.discard.pop();
  const d=s.u.discard; s.u.discard=[top];
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  s.u.deck=d;
  if(d.length) log(s,"♻ 山札を切り直した");
}
function uDrawCards(s,pid,n){
  const got=[];
  for(let i=0;i<n;i++){ uRefill(s); const c=s.u.deck.pop(); if(!c) break; s.hands[pid].push(c); got.push(c); }
  delete s.u.called[pid];
  return got;
}
const uTop = s => s.u.discard[s.u.discard.length-1];

function unoStartRound(s){
  const ids=s.players.map(p=>p.id);
  s.order=ids.slice(); s.hands={}; ids.forEach(id=>s.hands[id]=[]);
  s.finished=[]; s.losers=[]; s.passed=[]; s.ranking=[]; s.field=null; s.rev=false; s.eb=false; s.lock=null; s.stair=false; s.pending=null; s.after=null;
  s.players.forEach(p=>{ p.ready=false; delete p.wait; if(p.offline){ p.bot=true; p.away=true; delete p.offline; delete p.offAt; } });
  s.u={deck:unoDeck(), discard:[], color:"R", dir:1, stack:0, stackType:null, drew:null, pending:null, called:{}, scores:{}};
  for(let k=0;k<7;k++) for(const id of ids) s.hands[id].push(s.u.deck.pop());
  // 最初の1枚は数字カードになるまでめくる
  let first; do{ first=s.u.deck.pop(); if(!/\d/.test(pU(first).v)){ s.u.deck.unshift(first); first=null; } }while(!first);
  s.u.discard.push(first); s.u.color=pU(first).c;
  s.round=(s.round||0)+1; s.log=[];
  log(s,`UNO 第${s.round}回戦 開始（最初のカード: ${UNO_COLOR_NAME[s.u.color]}の${pU(first).v}）`);
  fx(s,"round",{n:s.round, game:"uno"});
  s.turn=ids[Math.floor(Math.random()*ids.length)];
  log(s,`${nameOf(s,s.turn)} から`);
  s.phase="play";
}
// 出せるなら ""、だめなら理由
function uCanPlay(s,pid,card){
  if(s.phase!=="play" || s.turn!==pid) return "あなたの番じゃない";
  if(s.u.pending) return "選択中";
  const hand=s.hands[pid]||[];
  if(!hand.includes(card)) return "手札にないカード";
  if(s.u.drew && s.u.drew.pid===pid && s.u.drew.card!==card) return "引いたカードしか出せない";
  const R=s.urules, c=pU(card), top=pU(uTop(s));
  if(s.u.stack>0){
    if(s.u.stackType==="F") return c.v==="F" ? "" : "+4を重ねるか、引いてね";
    return (c.v==="D"||c.v==="F") ? "" : "+2/+4を重ねるか、引いてね";
  }
  if(c.v==="F"){
    if(!R.wild4Any && hand.some(x=>x!==card && pU(x).c===s.u.color)) return `${UNO_COLOR_NAME[s.u.color]}を持ってる時は+4を出せない`;
    return "";
  }
  if(c.v==="W") return "";
  if(c.c===s.u.color || c.v===top.v) return "";
  return `${UNO_COLOR_NAME[s.u.color]}か「${U_LABEL(top.v)}」を出してね`;
}
function uEndRound(s, winner){
  const others=uActive(s).filter(id=>id!==winner);
  s.u.scores={};
  for(const id of s.order) s.u.scores[id]=(s.hands[id]||[]).reduce((a,c)=>a+uPoints(c),0);
  others.sort((a,b)=>s.u.scores[a]-s.u.scores[b]);
  s.finished=[winner];
  s.ranking=[winner,...others];
  s.titles={}; s.ranking.forEach((id,i)=>s.titles[id]= i===0 ? "UNO王" : `${i+1}位`);
  s.prevFinish=[]; s.phase="result"; s.u.drew=null; s.u.pending=null;
  log(s,`🏆 ${nameOf(s,winner)} の勝ち！`);
  fx(s,"end",{king:winner, game:"uno", loser:others.length?others[others.length-1]:null});
}
function uAdvance(s,pid,k=1){ s.u.drew=null; s.turn=uNext(s,pid,k); }

function uPlay(s,pid,card,color){
  const err=uCanPlay(s,pid,card); if(err) return err;
  const c=pU(card), R=s.urules;
  if(isWild(card) && !UNO_COLORS.includes(color)) return "色を選んでね";
  s.hands[pid]=s.hands[pid].filter(x=>x!==card);
  s.u.discard.push(card); s.u.drew=null; s.u.dead=0;
  s.u.color = isWild(card) ? color : c.c;
  const who=nameOf(s,pid);
  log(s,`${who}: ${isWild(card)?U_NAME(c.v)+"→"+UNO_COLOR_NAME[color]:UNO_COLOR_NAME[c.c]+"の"+U_NAME(c.v)}`);
  fx(s,"uplay",{id:pid, card, color:s.u.color});
  // UNO宣言チェック
  const left=s.hands[pid].length;
  if(left===1){
    if(s.u.called[pid]){ fx(s,"uno",{id:pid, who}); log(s,`📣 ${who}「UNO!」`); }
    else if(R.unoPenalty){ uDrawCards(s,pid,2); log(s,`😱 ${who} UNO言い忘れ！2枚ペナルティ`); fx(s,"unofail",{id:pid, who}); }
  }
  delete s.u.called[pid];
  if(left===0){ uEndRound(s,pid); return true; }
  if(isWild(card)) fx(s,"ucolor",{color, who});
  const twoP = uActive(s).length===2;
  switch(c.v){
    case "S": { const sk=uNext(s,pid,1); log(s,`⊘ ${nameOf(s,sk)} はスキップ`); fx(s,"uskip",{id:sk}); uAdvance(s,pid,2); break; }
    case "R": {
      s.u.dir*=-1; fx(s,"urev",{dir:s.u.dir});
      if(twoP){ log(s,"⇄ リバース（2人なのでもう一度）"); uAdvance(s,pid,2); } else { log(s,"⇄ リバース"); uAdvance(s,pid,1); }
      break;
    }
    case "D": case "F": {
      const n=c.v==="D"?2:4;
      if(R.stack){
        s.u.stack+=n; s.u.stackType = (c.v==="F"||s.u.stackType==="F") ? "F" : "D";
        const nx=uNext(s,pid,1); fx(s,"udraw",{n, total:s.u.stack, to:nx, stack:true}); log(s,`💥 ${nameOf(s,nx)} に+${s.u.stack}が迫る`);
        uAdvance(s,pid,1);
      } else {
        const nx=uNext(s,pid,1); uDrawCards(s,nx,n); fx(s,"udraw",{n, total:n, to:nx}); log(s,`💥 ${nameOf(s,nx)} が${n}枚引いてスキップ`);
        uAdvance(s,pid,2);
      }
      break;
    }
    case "7": if(R.sevenZero && uActive(s).length>=2){ s.u.pending={type:"seven", pid}; s.turn=pid; fx(s,"pending",{type:"seven"}); break; } uAdvance(s,pid,1); break;
    case "0": if(R.sevenZero){
        const act=uActive(s); const ordered=[]; let x=pid; for(let i=0;i<act.length;i++){ ordered.push(x); x=uNext(s,x,1); }
        const hs=ordered.map(id=>s.hands[id]);
        ordered.forEach((id,i)=>{ s.hands[id]=hs[(i-1+hs.length)%hs.length]; });
        s.u.called={}; log(s,"🔄 0: 全員の手札が回った"); fx(s,"uzero",{});
      }
      uAdvance(s,pid,1); break;
    default: uAdvance(s,pid,1);
  }
  return true;
}
function uSeven(s,pid,target){
  if(s.phase!=="play" || !s.u) return "今は選べない";
  const P=s.u.pending;
  if(!P || P.type!=="seven" || P.pid!==pid) return "今は選べない";
  if(!uActive(s).includes(target) || target===pid) return "交換する相手を選んでね";
  [s.hands[pid],s.hands[target]]=[s.hands[target],s.hands[pid]];
  delete s.u.called[pid]; delete s.u.called[target];
  log(s,`🔁 ${nameOf(s,pid)} と ${nameOf(s,target)} が手札交換`); fx(s,"useven",{from:pid,to:target});
  s.u.pending=null; uAdvance(s,pid,1);
  return true;
}
function uDraw(s,pid){
  if(s.phase!=="play" || s.turn!==pid) return "あなたの番じゃない";
  if(s.u.pending) return "選択中";
  if(s.u.drew && s.u.drew.pid===pid) return "引いたカードを出すか、パスしてね";
  const R=s.urules, who=nameOf(s,pid);
  if(s.u.stack>0){
    const n=s.u.stack; uDrawCards(s,pid,n); s.u.stack=0; s.u.stackType=null;
    log(s,`😵 ${who} が${n}枚引いた`); fx(s,"udrawn",{id:pid,n,big:n>=4});
    uAdvance(s,pid,1); return true;
  }
  let got=[], playable=null;
  const limit = R.drawUntil ? 108 : 1;
  for(let i=0;i<limit;i++){
    const g=uDrawCards(s,pid,1); if(!g.length) break; got.push(g[0]);
    if(!uCanPlay(s,pid,g[0])){ playable=g[0]; break; }
  }
  if(!got.length){
    // 山札も捨て札も尽きて引けない。誰も出せない状態が一周以上続いたら点数で決着
    s.u.dead=(s.u.dead||0)+1; log(s,`${who}: 引けるカードがない`);
    if(s.u.dead >= uActive(s).length*2){
      const best=uActive(s).slice().sort((a,b)=>s.hands[a].reduce((x,c)=>x+uPoints(c),0)-s.hands[b].reduce((x,c)=>x+uPoints(c),0))[0];
      log(s,"🛑 山札切れで決着（手札の点数が一番少ない人の勝ち）"); uEndRound(s,best); return true;
    }
    uAdvance(s,pid,1); return true;
  }
  s.u.dead=0;
  log(s,`${who} が${got.length}枚引いた`); fx(s,"udrawn",{id:pid,n:got.length});
  if(playable && R.drawPlay){ s.u.drew={pid, card:playable}; return true; }
  uAdvance(s,pid,1); return true;
}
function uPass(s,pid){
  if(s.phase!=="play" || s.turn!==pid) return "あなたの番じゃない";
  if(!(s.u.drew && s.u.drew.pid===pid)) return "先に山札から引いてね";
  log(s,`${nameOf(s,pid)}: パス`); fx(s,"pass",{id:pid});
  uAdvance(s,pid,1); return true;
}
function uCallUno(s,pid){
  if(s.phase!=="play" || !s.u) return false;
  const h=s.hands[pid]||[];
  if(h.length>2 || h.length===0) return "UNOは残り2枚の時に宣言してね";
  if(s.u.called[pid]) return false;
  s.u.called[pid]=true; fx(s,"unocall",{id:pid}); return true;
}
// ---------- UNO の CPU ----------
function uBestColor(hand, exclude){
  const cnt={R:0,Y:0,G:0,B:0};
  hand.forEach(c=>{ if(c!==exclude && !isWild(c)) cnt[pU(c).c]++; });
  return UNO_COLORS.slice().sort((a,b)=>cnt[b]-cnt[a] || Math.random()-.5)[0];
}
function unoBot(s,pid){
  const P=s.u.pending;
  if(P && P.pid===pid){
    const t=uActive(s).filter(x=>x!==pid).sort((a,b)=>s.hands[a].length-s.hands[b].length)[0];
    return uSeven(s,pid,t);
  }
  const hand=s.hands[pid];
  if(s.u.drew && s.u.drew.pid===pid){
    const c=s.u.drew.card;
    if(!uCanPlay(s,pid,c)){ if(hand.length===2 && Math.random()<.92) uCallUno(s,pid); return uPlay(s,pid,c,uBestColor(hand,c)); }
    return uPass(s,pid);
  }
  const ok=hand.filter(c=>!uCanPlay(s,pid,c));
  if(!ok.length) return uDraw(s,pid);
  const nx=uNext(s,pid,1), nxLow=(s.hands[nx]||[]).length<=2;
  const score=c=>{ const {v}=pU(c);
    let sc=0;
    if(v==="F") sc=s.u.stack>0?-50:60; else if(v==="W") sc=50;
    else if("SRD".includes(v)) sc = nxLow ? -40 : 10 - (v==="D"?5:0);
    else sc = 20 - (+v);                        // 大きい数字から捨てたい
    if(s.u.stack>0 && v==="D") sc=-60;
    return sc + Math.random()*3;
  };
  ok.sort((a,b)=>score(a)-score(b));
  const card=ok[0];
  if(hand.length===2 && Math.random()<.92) uCallUno(s,pid);
  return uPlay(s,pid,card,uBestColor(hand,card));
}

