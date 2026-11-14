(() => {
"use strict";
// =====================================================================
// ルールエンジン（純粋関数。オンライン/ソロ共通）
// =====================================================================
const SUITS = ["S","H","D","C"];
const SUIT_SYM = {S:"♠",H:"♥",D:"♦",C:"♣"};
const RANK_LABEL = r => ({11:"J",12:"Q",13:"K",14:"A",15:"2",16:"JK"})[r] || String(r);
const parse = c => ({s:c[0], r:+c.slice(1)});
const isJoker = c => parse(c).r === 16;
const st = (r, rev) => r === 16 ? 100 : (rev ? 18 - r : r);

const RULE_DEFS = [
  {k:"eight",   name:"8切り",     desc:"8を出すと場が流れる"},
  {k:"rev",     name:"革命",      desc:"同じ数字4枚以上 or 4枚以上の階段で逆転"},
  {k:"seq",     name:"階段",      desc:"同じマーク3枚以上の連番（JOKERで穴埋めOK）"},
  {k:"stair",   name:"階段縛り",  desc:"数字が1つずつ続くと次も+1しか出せない"},
  {k:"spade3",  name:"スペ3返し", desc:"単体ジョーカーに♠3が勝つ"},
  {k:"eb",      name:"11バック",  desc:"Jで場が流れるまで逆転"},
  {k:"shibari", name:"縛り",      desc:"同じマークが続くと固定"},
  {k:"five",    name:"5スキップ", desc:"5の枚数だけ次を飛ばす"},
  {k:"miyako",  name:"都落ち",    desc:"大富豪が1位を逃すと最下位"},
  {k:"foul",    name:"反則上がり",desc:"JK・2・8で上がると最下位"},
  {k:"seven",   name:"7渡し",     desc:"7の枚数だけ次の人に渡す"},
  {k:"bomb",    name:"12ボンバー",desc:"Qの枚数だけ数字を指定→全員捨てる"},
  {k:"exchange",name:"カード交換",desc:"2戦目から。貧民の強いカードは自動で取られ、富豪は好きなカードを選んで渡す"},
];
const MAX_PLAYERS = 10;
const DEFAULT_RULES = {eight:true,rev:true,seq:true,spade3:true,eb:false,shibari:false,five:false,miyako:false,foul:false,seven:false,bomb:false,stair:false,exchange:true,jokers:1};
const PRESETS = {
  "定番": {...DEFAULT_RULES},
  "全部盛り": {eight:true,rev:true,seq:true,spade3:true,eb:true,shibari:true,five:true,miyako:true,foul:true,seven:true,bomb:true,stair:true,exchange:true,jokers:2},
  "シンプル": {eight:false,rev:false,seq:false,spade3:false,eb:false,shibari:false,five:false,miyako:false,foul:false,seven:false,bomb:false,stair:false,exchange:false,jokers:1},
};

function titlesFor(n){
  if(n<=1) return ["大富豪"];
  if(n===2) return ["大富豪","大貧民"];
  if(n===3) return ["大富豪","平民","大貧民"];
  const t = Array(n).fill("平民");
  t[0]="大富豪"; t[1]="富豪"; t[n-2]="貧民"; t[n-1]="大貧民";
  return t;
}
function newDeck(jokers){
  const d=[];
  for(const s of SUITS) for(let r=3;r<=15;r++) d.push(s+r);
  if(jokers>=1) d.push("X16");
  if(jokers>=2) d.push("W16");
  for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
  return d;
}
function sortHand(h, rev){
  return h.slice().sort((a,b)=>{const A=parse(a),B=parse(b);return st(A.r,rev)-st(B.r,rev)||SUITS.indexOf(A.s)-SUITS.indexOf(B.s);});
}
const effRev = s => !!s.rev !== !!s.eb;
const suitsOf = cards => cards.filter(c=>!isJoker(c)).map(c=>c[0]).sort();

function analyze(cards, rules){
  if(!cards.length) return null;
  const ps = cards.map(parse);
  const nonJ = ps.filter(p=>p.r!==16);
  const n = cards.length;
  if(nonJ.every(p=>p.r===(nonJ[0]||{}).r)) return {type:"group", n, rank: nonJ.length? nonJ[0].r : 16};
  if(rules.seq && n>=3 && nonJ.length>=1 && nonJ.every(p=>p.s===nonJ[0].s)){
    const rs = nonJ.map(p=>p.r).sort((a,b)=>a-b);
    for(let i=1;i<rs.length;i++) if(rs[i]===rs[i-1]) return null;          // 同じ数字が2枚あったら階段じゃない
    const jk = n-nonJ.length, gaps = (rs[rs.length-1]-rs[0]+1) - rs.length;
    if(gaps>jk) return null;                                                  // JOKERで埋めきれない
    let min=rs[0], max=rs[rs.length-1], extra=jk-gaps;
    while(extra>0 && max<15){ max++; extra--; }                               // 余ったJOKERは上に伸ばす（強い方に）
    while(extra>0 && min>3){ min--; extra--; }
    if(extra>0) return null;
    return {type:"seq", n, min, max};
  }
  return null;
}

// 出せるなら ""、出せないなら理由
function canPlay(s, pid, cards){
  if(s.phase!=="play" || s.turn!==pid) return "あなたの番じゃない";
  if(xchgOn(s)) return "カード交換が終わるまで待ってね";
  if(s.pending) return "選択中";
  if(!cards.length) return "カードを選んでね";
  const hand = s.hands[pid]||[];
  if(new Set(cards).size!==cards.length || !cards.every(c=>hand.includes(c))) return "手札にないカード";
  const info = analyze(cards, s.rules);
  if(!info) return "その組み合わせは出せない";
  const f = s.field, rev = effRev(s);
  if(f){
    if(info.type!==f.type || info.n!==f.n) return `場と同じ${f.n}枚の${f.type==="seq"?"階段":"組"}で出してね`;
    if(info.type==="group"){
      const sp3 = s.rules.spade3 && f.rank===16 && f.n===1 && cards[0]==="S3";
      if(!sp3 && !(st(info.rank,rev) > st(f.rank,rev))) return "場より強くない";
    } else {
      if(!(rev ? info.min < f.min : info.min > f.min)) return "場より強くない";
    }
    if(s.stair && info.type==="group" && info.rank!==16){
      const need=nextRank(f.rank, rev);
      if(info.rank!==need) return `階段縛り中（次は ${need?RANK_LABEL(need):"なし"} だけ）`;
    }
    if(s.lock){
      const su = suitsOf(cards);
      if(!su.every(x=>s.lock.includes(x))) return `縛り中（${s.lock.map(x=>SUIT_SYM[x]).join("")}のみ）`;
    }
  }
  return "";
}

const outSet = s => new Set([...s.finished, ...s.losers]);
const activeOf = s => { const o=outSet(s); return s.order.filter(p=>!o.has(p)); };
const nameOf = (s,id) => (s.players.find(p=>p.id===id)||{}).name || "?";
function nextFrom(s, pid, skipPassed){
  const o=s.order, i=o.indexOf(pid), out=outSet(s);
  for(let k=1;k<=o.length;k++){
    const q=o[(i+k)%o.length];
    if(out.has(q)) continue;
    if(skipPassed && s.passed.includes(q)) continue;
    return q;
  }
  return null;
}
// 外から来た文字列の無害化。HTMLに効く記号・制御文字・双方向制御文字(RLOなど)・ゼロ幅文字を落とす。
// （表示側は必ず esc() も通す。ここは「入口」での第一段階）
const INVIS_RE = /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\u3164\ufe00-\ufe0e\ufeff\uffa0\ufff9-\ufffb]/g;
const safeText = t => String(t).replace(INVIS_RE," ").replace(/[<>"'`&\\]/g, ch=>({"<":"＜",">":"＞","\"":"”","'":"’","`":"‘","&":"＆","\\":"＼"})[ch]);
const clip = (t,n) => { const a=Array.from(String(t)); return a.length>n ? a.slice(0,n).join("") : String(t); };
const cleanName = t => clip(safeText(String(t)).replace(/\s+/g," ").trim(), 10);
const okKh = k => typeof k==="string" && /^[0-9a-f]{16,64}$/.test(k);
// プレイヤーIDは英数字で始まる最大40文字。Object.prototype のキー名（constructor等）は不可（手札などID索引のオブジェクトを守る）
const ID_OK = id => typeof id==="string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(id) && !(id in Object.prototype);
const isObj = x => !!x && typeof x==="object" && !Array.isArray(x);
const strList = (x,max) => Array.isArray(x) && x.length<=max && x.every(c=>typeof c==="string" && c.length<=12) ? x : null;
function log(s,msg){ s.log.push(msg); if(s.log.length>10) s.log=s.log.slice(-10); }
function fx(s, k, extra){ (s.fxk=s.fxk||[]).push({k, ...(extra||{})}); }
function cardText(c){const p=parse(c); return p.r===16?"🃏":SUIT_SYM[p.s]+RANK_LABEL(p.r);}
function clearField(s){ s.field=null; s.passed=[]; s.eb=false; s.lock=null; s.stair=false; }
// 今の強さの向きで、rank の「1つ上」の数字（3〜2）。なければ null
function nextRank(r, rev){ const t=st(r,rev)+1; for(let x=3;x<=15;x++) if(st(x,rev)===t) return x; return null; }

function blankRoom(hostId){
  return {v:0, host:hostId, players:[], phase:"lobby", order:[], hands:{}, counts:{}, field:null, rev:false, eb:false, lock:null,
          turn:null, passed:[], finished:[], losers:[], ranking:[], lastPlayer:null, log:[], round:0, titles:{}, prevFinish:[],
          rules:{...DEFAULT_RULES}, game:"daifugo", urules:{...UNO_DEFAULT}, u:null, b:null, k:null, fair:true, locked:false, banned:[], tsec:30, fx:{n:0,k:[]}, updatedAt:Date.now(),
          coins:{}, sea:{len:5,n:0,fin:false,no:1,cer:null}, bet:null, bk:0, bv:0, bl:{}, rb:{}, rl:{}};
}

function startRound(s){
  const ids = s.players.map(p=>p.id);
  s.order = ids.slice();
  s.hands = {}; ids.forEach(id=>s.hands[id]=[]);
  const d = newDeck(s.rules.jokers);
  const off = Math.floor(Math.random()*ids.length);
  d.forEach((c,i)=>s.hands[ids[(i+off)%ids.length]].push(c));
  s.rev=false; clearField(s); s.finished=[]; s.losers=[]; s.ranking=[]; s.lastPlayer=null; s.pending=null; s.after=null;
  s.players.forEach(p=>{ p.ready=false; delete p.wait; if(p.offline){ p.bot=true; p.away=true; delete p.offline; delete p.offAt; } });
  s.round=(s.round||0)+1; s.log=[];
  log(s,`第${s.round}ラウンド開始`);
  fx(s,"round",{n:s.round});
  const prev = s.prevFinish||[];
  const same = prev.length===ids.length && prev.every(id=>ids.includes(id));
  s.sameMembers = same && s.round>1;
  s.xchg=null;
  s.turn = s.sameMembers ? prev[prev.length-1] : (ids.find(id=>s.hands[id].includes("D3")) || ids[0]);
  if(s.sameMembers && s.rules.exchange && ids.length>=2){
    // 貧民側の強いカードは自動で取り上げ（ジョーカーが最強）。富豪側は「もらったカードを見てから」好きなカードを選んで返す（xchgGive）
    const N=ids.length;
    const specs=[[prev[0],prev[N-1],N>=3?2:1]];
    if(N>=4) specs.push([prev[1],prev[N-2],1]);
    s.xchg={on:true, pairs:[]};
    for(const [rich,poor,k] of specs){
      if(rich===poor) continue;
      const took = byStrength(s.hands[poor]).slice(-k);
      s.hands[poor]=s.hands[poor].filter(c=>!took.includes(c));
      s.hands[rich]=s.hands[rich].concat(took);
      s.xchg.pairs.push({rich, poor, k, ok:false, took, gave:null});
      log(s,`交換: ${nameOf(s,rich)} が ${nameOf(s,poor)} から${k}枚を召し上げ`);
      fx(s,"xtake",{from:poor, to:rich, n:k, priv:{ids:[poor,rich], cards:took.slice()}});
    }
    if(!s.xchg.pairs.length) s.xchg=null;
  }
  s.phase="play";
  if(s.xchg) xchgAdvance(s);
  else log(s,`${nameOf(s,s.turn)} から開始`);
}

// ---- カード交換（2戦目以降）----
// s.xchg = {on, pairs:[{rich,poor,k,ok,took,gave}]}。on=true の間は誰もカードを出せない。took/gave は当事者2人にだけ見せる（viewFor）。
const xchgOn = s => !!(s && s.xchg && s.xchg.on);
// 強さ順（弱→強）。ジョーカー最強、同じ強さはマーク順→文字列で決める（決定的）
function byStrength(h){
  return h.slice().sort((a,b)=>{const A=parse(a),B=parse(b);return st(A.r,false)-st(B.r,false)||SUITS.indexOf(A.s)-SUITS.indexOf(B.s)||(a<b?-1:a>b?1:0);});
}
function xchgDo(s,P,cards){
  s.hands[P.rich]=s.hands[P.rich].filter(c=>!cards.includes(c));
  s.hands[P.poor]=s.hands[P.poor].concat(cards);
  P.gave=cards.slice(); P.ok=true;
  log(s,`🎁 ${nameOf(s,P.rich)} → ${nameOf(s,P.poor)} にカードを渡した`);
  fx(s,"xgive",{from:P.rich, to:P.poor, n:P.k, priv:{ids:[P.rich,P.poor], cards:cards.slice()}});
  xchgCheckDone(s);
  return true;
}
function xchgGive(s,pid,cards){
  const P = xchgOn(s) && s.phase==="play" ? s.xchg.pairs.find(x=>x.rich===pid && !x.ok) : null;
  if(!P) return "今は渡せない";
  const h=s.hands[pid]||[];
  if(new Set(cards).size!==cards.length || cards.length!==P.k || !cards.every(c=>h.includes(c))) return `${P.k}枚選んでね`;
  return xchgDo(s,P,cards);
}
function xchgCheckDone(s){
  if(!xchgOn(s) || !s.xchg.pairs.every(P=>P.ok)) return;
  s.xchg.on=false;
  log(s,`交換おわり！ ${nameOf(s,s.turn)} から開始`);
  fx(s,"xdone",{who:s.turn});
}
// CPU・離席の人が渡す番なら、いちばん弱いカードをすぐ渡す（人間がCPUに替わった時もここで拾うので、交換が詰まらない）
function xchgAdvance(s){
  if(!xchgOn(s)) return;
  for(const P of s.xchg.pairs){
    if(P.ok) continue;
    const pl=s.players.find(p=>p.id===P.rich);
    if(!pl || pl.bot) xchgDo(s,P,byStrength(s.hands[P.rich]).slice(0,P.k));
  }
  xchgCheckDone(s);
}
function xchgPending(s,pid){ return xchgOn(s) ? s.xchg.pairs.find(x=>x.rich===pid && !x.ok)||null : null; }

function endRound(s){
  const rank = s.finished.concat(activeOf(s), s.losers.slice().reverse());
  s.ranking = rank; s.prevFinish = rank.slice();
  const t = titlesFor(rank.length);
  s.titles = {}; rank.forEach((id,i)=>s.titles[id]=t[i]);
  s.phase="result"; clearField(s); s.rev=false; s.pending=null; s.after=null;
  log(s,"ラウンド終了");
  fx(s,"end",{king:rank[0], loser:rank.length>=2?rank[rank.length-1]:null, ltitle:t[rank.length-1]});
}

function doPlay(s,pid,cards){
  const err = canPlay(s,pid,cards);
  if(err) return err;
  const prev = s.field, R = s.rules;
  const info = analyze(cards, R);
  s.hands[pid]=s.hands[pid].filter(c=>!cards.includes(c));
  s.field={cards, ...info, by:pid};
  s.lastPlayer=pid; s.passed=[];
  log(s,`${nameOf(s,pid)}: ${cards.map(cardText).join(" ")}`);
  fx(s,"play",{id:pid,cards});
  const has = r => cards.some(c=>parse(c).r===r);
  if(R.rev && info.n>=4){ s.rev=!s.rev; log(s, s.rev?"⚡ 革命！":"⚡ 革命返し！"); fx(s,"rev",{on:s.rev, who:nameOf(s,pid)}); }
  if(R.shibari && prev && !s.lock){
    const a=suitsOf(cards), b=suitsOf(prev.cards);
    if(a.length===cards.length && b.length===prev.cards.length && a.join()===b.join()){
      s.lock=a; log(s,`🔒 縛り ${a.map(x=>SUIT_SYM[x]).join("")}`); fx(s,"lock",{suits:a.map(x=>SUIT_SYM[x]).join(""), red:a.some(x=>x==="H"||x==="D"), who:nameOf(s,pid)});
    }
  }
  if(R.stair && prev && !s.stair && info.type==="group" && prev.type==="group" && info.rank!==16 && prev.rank!==16 && nextRank(prev.rank, effRev(s))===info.rank){
    s.stair=true; { const nx=nextRank(info.rank,effRev(s)); log(s,`🪜 階段縛り（次は ${nx?RANK_LABEL(nx):"なし"}）`); } fx(s,"stair",{who:nameOf(s,pid)});
  }
  const eight = R.eight && has(8);
  if(R.eb && !eight && has(11)){ s.eb=!s.eb; log(s,"↩ 11バック"); fx(s,"eb",{on:s.eb, who:nameOf(s,pid)}); }
  if(!s.hands[pid].length){
    const strongest = effRev(s) ? 3 : 15;
    const foul = R.foul && (cards.some(isJoker) || (R.eight && has(8)) || has(strongest));
    if(foul){
      s.losers.push(pid); log(s,`🚫 ${nameOf(s,pid)} 反則上がり`); fx(s,"foul",{who:nameOf(s,pid), id:pid});
    } else {
      s.finished.push(pid); log(s,`🎉 ${nameOf(s,pid)} 上がり（${s.finished.length}位）`);
      fx(s,"finish",{who:nameOf(s,pid), place:s.finished.length, id:pid, n:s.finished.length+s.losers.length+activeOf(s).length, title:titlesFor(s.finished.length+s.losers.length+activeOf(s).length)[s.finished.length-1]});
      const king = (s.prevFinish||[])[0];
      if(R.miyako && s.sameMembers && s.finished.length===1 && king && king!==pid && activeOf(s).includes(king)){
        s.losers.push(king); log(s,`🏚 都落ち: ${nameOf(s,king)}`); fx(s,"miyako",{who:nameOf(s,king), id:king});
      }
    }
  }
  if(activeOf(s).length<=1){ endRound(s); return true; }
  const cnt = r => cards.filter(c=>parse(c).r===r).length;
  s.after = {pid, eight, five: R.five ? cnt(5) : 0};
  const q=[];
  if(R.seven && cnt(7) && s.hands[pid].length) q.push({type:"seven", n:Math.min(cnt(7), s.hands[pid].length)});
  if(R.bomb && cnt(12)) q.push({type:"bomb", n:cnt(12)});
  s.pendingQ=q;
  nextPending(s);
  return true;
}

// 7渡し・12ボンバーの選択待ちを順に処理
function nextPending(s){
  const q=s.pendingQ||[];
  if(q.length){
    s.pending={...q.shift(), pid:s.after.pid}; s.pendingQ=q;
    s.turn=s.after.pid;
    if(s.pending.type==="seven") s.pending.to = nextFrom(s,s.after.pid,false);
    if(s.pending.type==="seven" && (!s.pending.to || s.pending.to===s.after.pid)) return nextPending(s);
    fx(s,"pending",{type:s.pending.type});
    return;
  }
  s.pending=null; s.pendingQ=[];
  resolveAfter(s);
}
function finishIfEmpty(s,pid){
  if(!s.hands[pid].length && !outSet(s).has(pid)){
    s.finished.push(pid); log(s,`🎉 ${nameOf(s,pid)} 上がり（${s.finished.length}位）`);
    fx(s,"finish",{who:nameOf(s,pid), place:s.finished.length, id:pid, n:s.finished.length+s.losers.length+activeOf(s).length, title:titlesFor(s.finished.length+s.losers.length+activeOf(s).length)[s.finished.length-1]});
  }
}
function resolveAfter(s){
  const A=s.after||{}, pid=A.pid; s.after=null;
  if(activeOf(s).length<=1){ endRound(s); return; }
  if(A.eight){
    clearField(s); log(s,"✂ 8切り"); fx(s,"eight",{who:nameOf(s,pid)});
    s.turn = activeOf(s).includes(pid) ? pid : nextFrom(s,pid,false);
    return;
  }
  let nx = nextFrom(s,pid,true);
  if(A.five){
    for(let i=0;i<A.five;i++) nx = nextFrom(s,nx,true);
    log(s,`⏭ ${A.five}人スキップ`); fx(s,"skip",{n:A.five, who:nameOf(s,pid)});
  }
  if(!nx){ // 全員パス済みなどで次がいない→場を流す
    const lp=s.lastPlayer; clearField(s);
    nx = activeOf(s).includes(lp) ? lp : nextFrom(s,lp,false);
  }
  s.turn = nx;
}
function doGive(s,pid,cards){
  const P=s.pending;
  if(!P || P.type!=="seven" || P.pid!==pid) return "今は渡せない";
  if(new Set(cards).size!==cards.length || cards.length!==P.n || !cards.every(c=>s.hands[pid].includes(c))) return `${P.n}枚選んでね`;
  s.hands[pid]=s.hands[pid].filter(c=>!cards.includes(c));
  s.hands[P.to]=s.hands[P.to].concat(cards);
  log(s,`🎁 ${nameOf(s,pid)} → ${nameOf(s,P.to)} に${P.n}枚渡した`);
  fx(s,"seven",{from:pid,to:P.to,n:P.n});
  finishIfEmpty(s,pid);
  nextPending(s);
  return true;
}
function doBomb(s,pid,ranks){
  const P=s.pending;
  if(!P || P.type!=="bomb" || P.pid!==pid) return "今は選べない";
  ranks=[...new Set(ranks.filter(x=>typeof x==="number"))].filter(r=>Number.isInteger(r)&&r>=3&&r<=16);
  if(ranks.length!==P.n) return `数字を${P.n}つ選んでね`;
  let total=0;
  for(const id of activeOf(s)){
    const before=s.hands[id].length;
    s.hands[id]=s.hands[id].filter(c=>!ranks.includes(parse(c).r));
    total+=before-s.hands[id].length;
  }
  log(s,`💣 ${nameOf(s,pid)} の12ボンバー: ${ranks.map(RANK_LABEL).join("・")}（${total}枚消滅）`);
  fx(s,"bomb",{ranks:ranks.map(RANK_LABEL).join("・"),rs:ranks,total, who:nameOf(s,pid)});
  const o=s.order, i=o.indexOf(pid);
  for(let k=0;k<o.length;k++){ const id=o[(i+k)%o.length]; if(activeOf(s).includes(id)) finishIfEmpty(s,id); }
  nextPending(s);
  return true;
}
function botPending(s){
  const P=s.pending, hand=s.hands[P.pid];
  if(P.type==="seven") return doGive(s,P.pid,sortHand(hand,effRev(s)).slice(0,P.n));
  const rev=effRev(s), mine=new Set(hand.map(c=>parse(c).r));
  const all=[16,...Array.from({length:13},(_,i)=>i+3)].sort((a,b)=>st(b,rev)-st(a,rev));
  const pick=all.filter(r=>!mine.has(r)).concat(all.filter(r=>mine.has(r))).slice(0,P.n);
  return doBomb(s,P.pid,pick);
}

function doPass(s,pid){
  if(s.phase!=="play" || s.turn!==pid) return "あなたの番じゃない";
  if(xchgOn(s)) return "カード交換が終わるまで待ってね";
  if(s.pending) return "選択中";
  if(!s.field) return "親はパスできない";
  s.passed.push(pid);
  log(s,`${nameOf(s,pid)}: パス`);
  fx(s,"pass",{id:pid});
  const others = activeOf(s).filter(p=>p!==s.lastPlayer);
  if(others.every(p=>s.passed.includes(p))){
    const lp = s.lastPlayer;
    clearField(s);
    s.turn = activeOf(s).includes(lp) ? lp : nextFrom(s,lp,false);
    log(s,"場が流れた"); fx(s,"clear");
  } else {
    s.turn = nextFrom(s,pid,true);
  }
  return true;
}

// ---------------- CPU ----------------
function combos(arr,k){
  const out=[]; const rec=(i,acc)=>{ if(acc.length===k){out.push(acc.slice());return;} for(let j=i;j<arr.length;j++){acc.push(arr[j]);rec(j+1,acc);acc.pop();} };
  rec(0,[]); return out;
}
function candidates(s,pid){
  if(s.pending || s.turn!==pid || xchgOn(s)) return [];
  const hand=s.hands[pid]||[], R=s.rules;
  const jokers=hand.filter(isJoker);
  const byRank={};
  hand.forEach(c=>{const p=parse(c); if(p.r!==16)(byRank[p.r]=byRank[p.r]||[]).push(c);});
  const f=s.field, cands=[];
  const sizes = f ? (f.type==="group"?[f.n]:[]) : [1,2,3,4,5,6];
  for(const r in byRank){
    const cs=byRank[r];
    for(const n of sizes){
      for(let j=0;j<=Math.min(jokers.length,n-1);j++){
        const k=n-j; if(k>cs.length||k<1) continue;
        for(const cb of combos(cs,k)) cands.push(cb.concat(jokers.slice(0,j)));
      }
    }
  }
  for(let j=1;j<=jokers.length;j++) if(sizes.includes(j)) cands.push(jokers.slice(0,j));
  if(R.seq && (!f || f.type==="seq")){
    for(const su of SUITS){
      const have=new Set(hand.filter(c=>c[0]===su && !isJoker(c)).map(c=>parse(c).r));
      const lens = f ? [f.n] : [3,4,5];
      for(const L of lens) for(let a=3;a+L-1<=15;a++){
        const present=[], missing=[];
        for(let r=a;r<a+L;r++) (have.has(r)?present:missing).push(r);
        if(!present.length || missing.length>jokers.length) continue;
        cands.push(present.map(r=>su+r).concat(jokers.slice(0,missing.length)));
      }
    }
  }
  return cands.filter(c=>!canPlay(s,pid,c));
}
function botMove(s,pid){
  const cands=candidates(s,pid);
  if(!cands.length) return null;
  const rev=effRev(s), hand=s.hands[pid];
  const score = c => {
    const info=analyze(c,s.rules);
    const base = info.type==="seq" ? st(rev?info.max:info.min,rev) : st(info.rank,rev);
    const j=c.filter(isJoker).length;
    let sc = base*10 + j*60;
    if(!s.field) sc -= c.length*6;           // 親なら枚数多めで捨てたい
    if(c.length===hand.length) sc -= 1000;   // 上がれるなら上がる
    if(s.rules.foul && c.length===hand.length && (j || c.some(x=>parse(x).r===(rev?3:15)) || (s.rules.eight&&c.some(x=>parse(x).r===8)))) sc += 3000;
    return sc;
  };
  cands.sort((a,b)=>score(a)-score(b));
  const best=cands[0];
  if(s.field && hand.length>5 && best.some(isJoker) && Math.random()<.6) return null;
  if(s.field && hand.length>6 && st(analyze(best,s.rules).rank||0,rev)>=14 && Math.random()<.35) return null;
  return best;
}

// ---------------- アクション（全操作の入口） ----------------
