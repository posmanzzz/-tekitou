
// =====================================================================
// コイン経済（順位賞金 / 「次に上がるのは誰？」ベット / シーズンと表彰式）
// 状態（すべて部屋の状態に載る。公開情報）:
//   s.coins {id:n}      残高。全員1000スタート、シーズン開始でリセット
//   s.sea   {len,n,fin,no,cer}  len=表彰までの回戦数(0=なし/3/5/10) n=このシーズンで始まった回戦数 fin=表彰済み no=シーズン番号 cer=最終順位(id配列)
//   s.bet   {k,f,cand:[id],bets:[{id,on,stake,m}]}  いま開いているマーケット。k=通し番号 f=開いた時の finished 人数 m=倍率の10倍(整数)。賭け金は置いた時点で残高から引く（預かり）
//   s.bk    マーケットの通し番号カウンタ
//   s.bl    {id:{on,stake,m,r:"w"|"l"|"x",pay}}  各自の直近のベット結果（x=返金）
//   s.rb    {id:{p,b}}  今ラウンドの内訳（p=順位賞金 b=ベット収支）
//   s.rl    {id:n}      直近に終わったラウンドの増減（順位表の「前回戦」）
//   s.bv    ベット操作の回数（gv を進めない＝制限時間やCPUの手を止めないための番号）
// すべての変更は applyAction の最後の coinSync を通る（1か所で不変条件を保つ）。
// =====================================================================
const COIN_START=1000, STAKES=[50,100,200], SEASON_CHOICES=[0,3,5,10], PRIZE_TOP=500;
const BET_GAMES=["daifugo","baba"];
const betGame = s => BET_GAMES.includes(s.game);
const playingIds = s => (!s.order||!s.finished||!s.losers) ? [] : s.game==="baba" ? bActive(s) : s.game==="daifugo" ? activeOf(s) : [];
// 順位 r(1始まり)/N人 の賞金
const prizeOf = (r,N) => N>=2 && r>=1 && r<=N ? Math.round(PRIZE_TOP*(N-r)/(N-1)) : 0;
// 倍率(10倍の整数)。weight=1/手札枚数 → 確率 → clamp(0.9/p, 1.1, 12) を小数1桁に
function betOdds(s, nOf){
  const m=s.bet; if(!m) return {};
  nOf = nOf || (id => (s.hands[id]||[]).length);
  const w={}; let tot=0;
  for(const id of m.cand){ w[id]=1/Math.max(1,nOf(id)); tot+=w[id]; }
  const o={};
  for(const id of m.cand){ const p=w[id]/tot, mult=Math.min(12,Math.max(1.1,0.9/p)); o[id]={n:Math.max(0,nOf(id)), p, m:Math.round(mult*10)}; }
  return o;
}
// UI用: クライアントは手札を持っていないので counts から作る
const betOddsView = s => betOdds(s, id => (s.counts&&s.counts[id]!==undefined) ? s.counts[id] : (s.hands[id]||[]).length);
const betPay = (stake,m10) => Math.floor(stake*m10/10);
const myBetOf = (s,id) => s.bet ? s.bet.bets.find(b=>b.id===id)||null : null;

function coinEnsure(s){
  if(!isObj(s.coins)) s.coins={};
  if(!isObj(s.sea)) s.sea={len:5,n:0,fin:false,no:1,cer:null};
  if(!isObj(s.bl)) s.bl={};
  if(!isObj(s.rb)) s.rb={};
  if(!isObj(s.rl)) s.rl={};
  if(!Number.isInteger(s.bk)) s.bk=0;
  if(!Number.isInteger(s.bv)) s.bv=0;
  if(s.bet===undefined) s.bet=null;
  const ids=new Set(s.players.map(p=>p.id));
  for(const p of s.players) if(!Number.isInteger(s.coins[p.id]) || s.coins[p.id]<0) s.coins[p.id]=COIN_START;
  for(const m of [s.coins,s.bl,s.rb,s.rl]) for(const k of Object.keys(m)) if(!ids.has(k)) delete m[k];
  if(s.bet){
    // 抜けた人の賭けは消える（本人には返さない）。抜けた候補への賭けは返金して候補から外す
    s.bet.bets=s.bet.bets.filter(b=>ids.has(b.id));
    const gone=s.bet.cand.filter(id=>!ids.has(id));
    if(gone.length){
      for(const b of s.bet.bets.filter(b=>gone.includes(b.on))) betRefund(s,b);
      s.bet.bets=s.bet.bets.filter(b=>!gone.includes(b.on));
      s.bet.cand=s.bet.cand.filter(id=>ids.has(id));
    }
  }
}
function betRefund(s,b){
  s.coins[b.id]=(s.coins[b.id]||0)+b.stake;
  s.bl[b.id]={on:b.on,stake:b.stake,m:b.m,r:"x",pay:b.stake};
}
function coinRb(s,id){ return s.rb[id]||(s.rb[id]={p:0,b:0}); }
const betPlaying = s => new Set(s.phase==="play" ? playingIds(s) : []);
// 賭けられる人: 手札を持っていない（上がった／観戦）・残高50以上
function betEligible(s,id){
  if(!s.players.some(p=>p.id===id)) return false;
  return !betPlaying(s).has(id) && (s.coins[id]||0)>=STAKES[0];
}
// マーケットを今の状態に合わせる（上がった人が出たら精算 → 条件が揃えば次を開く）
function betStep(s){
  const act=s.phase==="play" ? playingIds(s) : [];
  const A=new Set(s.phase==="play" ? act : playingIds(s).concat(s.game==="baba"?s.losers:[]));      // 勝負の最中（または今終わった勝負）に残っている人。ババ抜きの最後の負け役も含む
  let m=s.bet;
  if(m){
    const w=s.finished[m.f];
    if(w!==undefined){ betSettle(s,m,w,A); s.bet=null; }
    else {
      // 反則上がり・都落ちなど「上がれずに」抜けた候補: その人への賭けは返金し、候補から外す
      const gone=m.cand.filter(id=>!A.has(id));
      if(gone.length){
        for(const b of m.bets.filter(b=>gone.includes(b.on))) betRefund(s,b);
        m.bets=m.bets.filter(b=>!gone.includes(b.on)); m.cand=m.cand.filter(id=>A.has(id));
      }
      if(m.cand.length<2){ for(const b of m.bets) betRefund(s,b); s.bet=null; }
    }
  }
  if(!s.bet && s.phase==="play" && act.length>=2 && s.players.some(p=>betEligible(s,p.id))){
    s.bet={k:(s.bk=(s.bk||0)+1), f:s.finished.length, cand:act.slice(), bets:[]};
    fx(s,"bopen",{q:s.bk, n:act.length});
  }
}
function betSettle(s,m,w,A){
  const bi=[],bo=[],bs=[],bp=[],bm=[];
  for(const b of m.bets){
    let pay, r;
    if(b.on===w){ pay=betPay(b.stake,b.m); r="w"; s.coins[b.id]=(s.coins[b.id]||0)+pay; coinRb(s,b.id).b+=pay-b.stake; }
    else if(A.has(b.on)){ pay=0; r="l"; coinRb(s,b.id).b-=b.stake; }
    else { pay=b.stake; r="x"; s.coins[b.id]=(s.coins[b.id]||0)+b.stake; }
    s.bl[b.id]={on:b.on,stake:b.stake,m:b.m,r,pay};
    if(bi.length<12){ bi.push(b.id); bo.push(b.on); bs.push(b.stake); bp.push(r==="x"?-1:pay); bm.push(b.m/10); }
  }
  log(s,`🎯 次に上がったのは ${nameOf(s,w)}${m.bets.length?`（賭け ${m.bets.length}件）`:""}`);
  fx(s,"bset",{w, bi, bo, bs, bp, bm});
}
// 最終順位（コイン多い順。同点は直近ラウンドの順位→席順）
function standingsOf(s){
  const rk=s.ranking||[];
  const ix=id=>{ const i=rk.indexOf(id); return i<0?99:i; };
  const pos=id=>s.players.findIndex(p=>p.id===id);
  return s.players.map(p=>p.id).sort((a,b)=>(s.coins[b]||0)-(s.coins[a]||0) || ix(a)-ix(b) || pos(a)-pos(b));
}
function roundPrize(s){
  const R=(s.ranking||[]).filter(id=>s.coins[id]!==undefined), N=R.length;
  const ids=[], ps=[];
  R.forEach((id,i)=>{ const pz=prizeOf(i+1,N); s.coins[id]+=pz; coinRb(s,id).p=pz; if(ids.length<12){ ids.push(id); ps.push(pz); } });
  s.rl={}; for(const p of s.players){ const r=s.rb[p.id]; s.rl[p.id]=r?r.p+r.b:0; }
  fx(s,"prize",{ids, ps});
  const S=s.sea;
  if(S.len>0 && S.n>=S.len){
    S.fin=true; S.cer=standingsOf(s).slice(0,12);
    log(s,`🏆 ${S.len}回戦おわり！ 総合優勝は ${nameOf(s,S.cer[0])}`);
    fx(s,"cer",{ids:S.cer.slice(), no:S.no});
  }
}
// ラウンド開始の前: シーズンの切り替え・カウンタ
function coinPreRound(s){
  coinEnsure(s);
  const S=s.sea;
  if(S.fin){ S.fin=false; S.cer=null; S.n=0; S.no=Math.min(9999,(S.no||1)+1); for(const p of s.players) s.coins[p.id]=COIN_START; s.rl={}; log(s,`🆕 新シーズン開始（コインは${COIN_START}にリセット）`); }
  S.n=Math.min(9999,S.n+1);
  s.rb={}; s.bl={}; s.bet=null;
}
// 中止（ホストが落ちた等）: 開いている賭けは返金、回戦は数えない
function coinAbort(s){
  coinEnsure(s);
  if(s.bet){ for(const b of s.bet.bets) betRefund(s,b); s.bet=null; }
  if(s.phase==="play") s.sea.n=Math.max(0,s.sea.n-1);
  s.rb={}; s.bl={};
}
// applyAction の最後に必ず通る。ph0=アクション前の phase
function coinSync(s, ph0){
  coinEnsure(s);
  if(betGame(s) && s.phase==="play") betStep(s);
  else if(s.bet){
    if(ph0==="play" && s.phase==="result" && betGame(s)) betStep(s);     // 最後の上がりの精算
    if(s.bet){ for(const b of s.bet.bets) betRefund(s,b); s.bet=null; }   // 決着しなかった賭けは返金
  }
  if(ph0==="play" && s.phase==="result") roundPrize(s);
}
// ---- アクション ----
function betPlace(s, bettor, on, stake){
  const m=s.bet;
  if(s.phase!=="play" || !betGame(s) || !m) return "いまは賭けられない";
  if(typeof on!=="string" || !ID_OK(on) || !m.cand.includes(on)) return "その人には賭けられない";
  if(!STAKES.includes(stake)) return "賭け金は50/100/200だけ";
  if(!s.players.some(p=>p.id===bettor) || betPlaying(s).has(bettor)) return "手札があるうちは賭けられない";
  if(m.bets.some(b=>b.id===bettor)) return "この回はもう賭けた";
  if((s.coins[bettor]||0)<stake) return "コインが足りない";
  const o=betOdds(s)[on]; if(!o) return "その人には賭けられない";
  s.coins[bettor]-=stake;
  m.bets.push({id:bettor,on,stake,m:o.m});
  s.bv=(s.bv||0)+1;
  fx(s,"bet",{id:bettor, on, stake, m:o.m/10});
  return true;
}
// CPUの賭け（人気寄りにランダム・少額）。賭けない時は null
function cpuBetPick(s,id){
  if(!s.bet || s.bet.bets.some(b=>b.id===id) || !betEligible(s,id)) return null;
  const bal=s.coins[id]||0, od=betOdds(s), cand=s.bet.cand.filter(c=>od[c]);
  if(!cand.length) return null;
  let stake=Math.random()<.6?50:Math.random()<.75?100:200;
  const cap=Math.max(50,bal*.4); while(stake>cap && stake>50) stake=stake===200?100:50;
  if(stake>bal) return null;
  let r=Math.random()*cand.reduce((a,c)=>a+od[c].p,0), on=cand[cand.length-1];
  for(const c of cand){ r-=od[c].p; if(r<=0){ on=c; break; } }
  return {on, stake};
}
