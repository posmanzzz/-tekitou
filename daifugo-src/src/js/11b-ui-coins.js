// =====================================================================
// コイン・ベット・順位表・表彰式の画面（エンジンは 04b。状態は S.coins / S.sea / S.bet / S.bl / S.rb / S.rl）
//  ・betPanelHtml: 上がった人／観戦者が手札の代わりに見るベットパネル（#betpanel）
//  ・standingsHtml / coinBreakdownHtml / seasonPanel: ロビー・結果・メニューに出す順位表など
//  ・playCoinFx: bet / bset / prize / bopen / cer のイベント演出（演出レベル 0 は小さい文字だけ）
//  ・startCeremony: 全員の画面で出る表彰式（タップでスキップ可）
//  ・driveCpuBets: CPUの賭け（ホストだけ。ゲーム進行は止めない）
// 常時アニメーションは無し（動かすのは一度きりの演出だけ）。
// =====================================================================
const cfmt = n => String(Math.round(Number(n)||0)).replace(/\B(?=(\d{3})+(?!\d))/g,",");
const coinOf = id => (S && S.coins && Number.isInteger(S.coins[id])) ? S.coins[id] : COIN_START;
const betMode = () => !!S && S.phase==="play" && betGame(S) && S.players.some(p=>p.id===myId) && !playingIds(S).includes(myId);
let betStake=50;
function seasonTxt(){
  const E=S&&S.sea; if(!E) return "";
  const sn=Math.max(1, S.phase==="lobby" ? (E.fin?1:E.n+1) : E.n);
  return E.len ? `第${sn}回戦 / 全${E.len}回戦` : `第${sn}回戦（表彰なし）`;
}
const mecoinHtml = () => S && S.coins ? `<span class="mecoin" data-coin="${coinOf(myId)}">🪙 ${esc(cfmt(coinOf(myId)))}</span>` : "";
const scoinHtml = id => S && S.coins ? `<span class="scoin" data-coin="${coinOf(id)}">${esc(cfmt(coinOf(id)))}</span>` : "";

// ---- 順位表 ----
function standingsHtml(){
  if(!S || !S.coins) return "";
  const ids=standingsOf(S), E=S.sea;
  let prev=null, rk=0;
  const rows=ids.map((id,i)=>{
    const p=S.players.find(x=>x.id===id); if(!p) return "";
    const c=S.coins[id]; if(c!==prev){ rk=i+1; prev=c; }
    const d=(S.rl||{})[id]||0;
    return `<li class="srow ${id===myId?"me":""} ${p.wait?"wt":""}" data-sid="${esc(id)}" data-c="${c}" data-d="${d}"><span class="sr r${rk}">${rk}</span>${miniAva(p,26)}<b class="sn">${esc(p.name)}</b><span class="sc">${esc(cfmt(c))}</span><span class="sd ${d>0?"up":d<0?"dn":""}">${d?(d>0?"+":"−")+esc(cfmt(Math.abs(d))):"–"}</span></li>`;
  }).join("");
  const left = E.len && !E.fin ? Math.max(0,E.len-E.n) : 0;
  return `<div class="panel standings" id="standings"><div class="row"><b class="grow">🪙 コイン順位</b><span class="note seasonline">${esc(seasonTxt())}</span></div>
    <div class="sthead"><span>順位</span><span class="grow"></span><span>コイン</span><span>前回戦</span></div>
    <ol class="slist">${rows}</ol>
    ${E.fin&&S.phase==="result"?`<div class="note sfin">🏆 全${E.len}回戦おわり！ 総合優勝は <b>${esc(nameOf(S,(E.cer||ids)[0]))}</b></div>`:E.len?`<div class="note">${S.phase==="play"?(left?`この回戦のあと ${left}回戦で表彰式`:"🏆 この回戦が最終回戦！"):`あと${left}回戦で表彰式`}</div>`:`<div class="note">表彰なし（コインはずっとたまるよ）</div>`}</div>`;
}
// 今回のコインの内訳（結果画面）
function coinBreakdownHtml(){
  if(!S || !S.rb) return "";
  const rk=S.ranking||[], extra=S.players.map(p=>p.id).filter(id=>!rk.includes(id) && S.rb[id] && (S.rb[id].b||S.rb[id].p));
  const rows=rk.concat(extra).map(id=>{
    const p=S.players.find(x=>x.id===id), r=S.rb[id]||{p:0,b:0}; if(!p) return "";
    const t=r.p+r.b, sg=n=>(n>0?"+":n<0?"−":"±")+cfmt(Math.abs(n));
    return `<li class="cbrow ${id===myId?"me":""}"><b class="sn">${esc(p.name)}</b><span class="cb1">順位賞金 <i>${esc(sg(r.p))}</i></span>${S.game==="daifugo"||S.game==="baba"?`<span class="cb2">ベット <i class="${r.b>0?"up":r.b<0?"dn":""}">${esc(sg(r.b))}</i></span>`:""}<span class="cbt ${t>0?"up":t<0?"dn":""}">${esc(sg(t))}</span></li>`;
  }).join("");
  return `<div class="panel cbreak"><b>🪙 今回のコイン</b><ul class="cblist">${rows}</ul></div>`;
}
function seasonPanel(){
  const host=isHost() && S.phase!=="play", E=S.sea||{len:5};
  return `<div class="panel seapanel">
    <div class="row" style="margin-bottom:6px"><b class="grow">🏆 表彰まで</b>${isHost()?"":'<span class="note">ホストが設定</span>'}</div>
    <div class="seg big" id="seaseg" role="group" aria-label="表彰までの回戦数">${[[0,"なし"],[3,"3回戦"],[5,"5回戦"],[10,"10回戦"]].map(([n,l])=>`<button class="${E.len===n?"on":""}" data-slen="${n}" aria-pressed="${E.len===n}" ${host?"":"disabled"}>${l}</button>`).join("")}</div>
    <div class="note">${esc(seasonTxt())}。決めた回戦が終わると表彰式。そのあとの「次へ」で新シーズン（コインは${COIN_START}に戻る）。「なし」ならコインがずっとたまるだけ。</div>
  </div>`;
}

// ---- ベットパネル（手札があった場所） ----
function lastBetTxt(l){
  if(!l) return "";
  const nm=esc(nameOf(S,l.on)), m=(l.m/10).toFixed(1);
  if(l.r==="w") return `<span class="w">🎯 的中 +${esc(cfmt(l.pay))}</span> <small>${nm} ×${m}</small>`;
  if(l.r==="l") return `<span class="l">ハズレ −${esc(cfmt(l.stake))}</span> <small>${nm}</small>`;
  return `<span class="x">↩ 返金 ${esc(cfmt(l.stake))}</span> <small>${nm}</small>`;
}
function betPanelHtml(){
  const bal=coinOf(myId), M=S.bet, mine=M?myBetOf(S,myId):null, last=(S.bl||{})[myId];
  const afford=STAKES.filter(x=>x<=bal);
  if(bal<betStake) betStake=afford.length?afford[afford.length-1]:STAKES[0];
  const od=M?betOddsView(S):{};
  let mid="";
  if(M){
    const canBet=!mine && bal>=STAKES[0];
    if(mine) mid=`<div class="bpconf" role="status"><span class="ok">✅</span> <b>${esc(nameOf(S,mine.on))}</b> に <b>${esc(mine.stake)}コイン</b>（×${(mine.m/10).toFixed(1)}）<small>当たれば ${esc(cfmt(betPay(mine.stake,mine.m)))}</small></div>`;
    else if(!canBet) mid=`<div class="bpnote">コインが${STAKES[0]}未満だから、賭けられないよ</div>`;
    else mid=`<div class="bpstakes" role="group" aria-label="賭け金"><span class="bpl">賭け金</span>${STAKES.map(x=>`<button type="button" class="${x===betStake?"on":""}" data-stake="${x}" aria-pressed="${x===betStake}" ${x>bal?"disabled":""}>${x}</button>`).join("")}<span class="bpt">タップで賭ける（変更できないよ）</span></div>`;
    const tiles=M.cand.filter(id=>od[id]).map(id=>{
      const p=S.players.find(x=>x.id===id)||{id,name:"?"}, o=od[id], chosen=mine&&mine.on===id;
      return `<button type="button" class="bt ${chosen?"on":""}" data-bet="${esc(id)}" ${canBet?"":"disabled"} aria-label="${esc(p.name)} に賭ける ×${(o.m/10).toFixed(1)}"><span class="bta">${miniAva(p,24)}</span><b>${esc(p.name)}</b><small>${esc(o.n)}枚 <i>×${(o.m/10).toFixed(1)}</i></small></button>`;
    }).join("");
    mid+=`<div class="bptiles">${tiles}</div>`;
  } else {
    const wait = S.phase==="play" ? (playingIds(S).length>=2 ? "次の賭けを準備中…" : "最後の勝負！賭けはなし") : "";
    mid=`<div class="bpnote">${last?`前回: ${lastBetTxt(last)}`:"まだ賭けていないよ"}${wait?` · ${wait}`:""}</div>`;
  }
  return `<div class="betpanel ${M?"open":""} ${mine?"placed":""}" id="betpanel" data-k="${M?M.k:0}"><div class="bphd"><b>🎯 次に上がるのは誰？</b><span class="bpbal">🪙 <b id="bpbal" data-v="${bal}">${esc(cfmt(bal))}</b></span></div>${mid}</div>`;
}
function bindBetPanel(){
  const P=document.getElementById("betpanel"); if(!P) return;
  P.querySelectorAll("[data-stake]").forEach(b=>b.onclick=()=>{
    betStake=+b.dataset.stake; sfx("tap");
    P.querySelectorAll("[data-stake]").forEach(x=>{ const on=x===b; x.classList.toggle("on",on); x.setAttribute("aria-pressed",on); });
  });
  P.querySelectorAll("[data-bet]").forEach(b=>b.onclick=()=>{
    if(b.disabled) return;
    P.querySelectorAll("[data-bet]").forEach(x=>x.disabled=true);
    sfx("tap"); vib(15);
    Promise.resolve(act({t:"bet",on:b.dataset.bet,stake:betStake})).then(r=>{ if(r!==true) P.querySelectorAll("[data-bet]").forEach(x=>x.disabled=false); }).catch(()=>{});
    setTimeout(()=>{ if(S && S.bet && !myBetOf(S,myId)) P.querySelectorAll("[data-bet]").forEach(x=>x.disabled=false); },1800);
  });
}

// ---- 演出 ----
function betPoint(id){
  const el = id===myId ? (document.getElementById("betpanel")||document.getElementById("hand")||document.getElementById("mebar")) : document.querySelector(`[data-seat="${CSS.escape(String(id))}"] .ava`);
  if(el){ const r=el.getBoundingClientRect(); if(r.width) return {x:r.left+r.width/2, y:r.top+r.height/2}; }
  return {x:innerWidth/2, y:Math.max(60,SAFE.t+34)};      // 席のない観戦者
}
function cfloat(id,text,cls=""){
  const p=betPoint(id), t=document.createElement("div"); t.className="floattxt cft "+cls; t.textContent=text;
  t.style.left=p.x+"px"; t.style.top=(p.y-14)+"px"; fxLayer.appendChild(t);
  anim(t,[{transform:"translate(-50%,0) scale(.6)",opacity:0},{transform:"translate(-50%,-14px) scale(1.05)",opacity:1,offset:.2},{transform:"translate(-50%,-44px) scale(1)",opacity:1,offset:.7},{transform:"translate(-50%,-56px) scale(1)",opacity:0}],{duration:1500,easing:"ease-out",fill:"forwards"});
  setTimeout(()=>t.remove(),1550);
}
function countUp(el,from,to,ms=900){
  if(!el) return; const t0=performance.now();
  const f=now=>{ const k=Math.min(1,(now-t0)/ms); el.textContent=cfmt(from+(to-from)*(1-Math.pow(1-k,3))); if(k<1 && el.isConnected) requestAnimationFrame(f); else el.textContent=cfmt(to); };
  requestAnimationFrame(f);
}
function coinFly(a,b,ms=650){
  const c=document.createElement("div"); c.className="cflyc"; c.textContent="🪙"; fxLayer.appendChild(c);
  const mx=(a.x+b.x)/2, my=Math.min(a.y,b.y)-60;
  anim(c,[{transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) scale(.6) rotate(0)`,opacity:0},
          {transform:`translate(${a.x}px,${a.y}px) translate(-50%,-50%) scale(1.2) rotate(90deg)`,opacity:1,offset:.12},
          {transform:`translate(${mx}px,${my}px) translate(-50%,-50%) scale(1.3) rotate(360deg)`,opacity:1,offset:.55},
          {transform:`translate(${b.x}px,${b.y}px) translate(-50%,-50%) scale(.8) rotate(720deg)`,opacity:1,offset:.92},
          {transform:`translate(${b.x}px,${b.y}px) translate(-50%,-50%) scale(.5) rotate(760deg)`,opacity:0}],{duration:ms,easing:"ease-in-out",fill:"forwards"});
  setTimeout(()=>c.remove(),ms+60);
}
const bigBet = (m,pay) => m>=4 || pay>=600;
function playCoinFx(e){
  const nm = id => nameOf(S||{players:[]},id);
  switch(e.k){
    case "bopen":
      if(S && betMode() && !myBetOf(S,myId) && coinOf(myId)>=STAKES[0] && fxLevel>=1) sfx("turn");
      break;
    case "bet": {
      const a=betPoint(e.id), b=betPoint(e.on);
      cfloat(e.id,`🪙 ${e.stake} → ${nm(e.on)}`,"bet");
      if(fxLevel>=1){ sfx("tap"); coinFly(a,b); setTimeout(()=>{ ring(b.x,b.y,"#ffd54a",90); if(dopa()) burst(b.x,b.y,{n:8,emoji:"🪙",size:6,dist:46,gravity:0}); sfx("pop"); },620); }
      break; }
    case "bset": {
      const ids=e.bi||[];
      let big=null;
      ids.forEach((id,i)=>{
        const pay=e.bp[i], st=e.bs[i], m=e.bm[i], me=id===myId;
        setTimeout(()=>{
          if(pay>0){
            cfloat(id,`🎯 的中 +${cfmt(pay)}`,"win");
            if(me){
              const el=document.getElementById("bpbal"), now=coinOf(myId);
              if(el) countUp(el,Math.max(0,now-pay),now);
              if(fxLevel>=1){ sfx(bigBet(m,pay)?"fanfare":"win"); vib([40,30,80]); flash("#ffe36a"); }
              if(dopa()){ kanji("的中","gold",undefined,.28); coinFountain(innerWidth/2,innerHeight*.9,Math.max(12,Math.min(90,Math.round(10+pay/12)))); confetti(Math.min(120,20+Math.round(pay/10))); }
              else if(fxLevel>=1) banner("的中！ +"+cfmt(pay),"finish",true);
            }
            if(bigBet(m,pay) && fxLevel>=1){
              sfx("fanfare"); cutin("win","🎯 大的中！",`${nm(id)} が ${cfmt(pay)}コイン（×${m.toFixed(1)}）`,1700);
              if(dopa()){ if(!me){ const p=betPoint(id); coinFountain(p.x,p.y,30); } fireworks(me?6:3); rainbowStrobe(1500); kanji("大的中","rainbow",undefined,.24,300); }
            }
          } else if(pay===0){
            cfloat(id,`ハズレ −${cfmt(st)}`,"lose");
            if(me){
              if(dopa()){ kanji("ハズレ","dark",120,.3); darkPulse(); }
              else if(fxLevel>=1) banner(`ハズレ −${cfmt(st)}`,"round",true);
              if(fxLevel>=1){ sfx("foul"); vib([60,40,60]); }
            }
          } else {
            cfloat(id,`↩ 返金 +${cfmt(st)}`,"pass");
            if(me){ const el=document.getElementById("bpbal"), now=coinOf(myId); if(el) countUp(el,Math.max(0,now-st),now,500); }
          }
        }, 650+Math.min(i,6)*140);
      });
      break; }
    case "prize": animateStandings(e); break;
    case "cer": {
      const d=Math.max(3800, slamUntil-Date.now()+1100);      // いつもの結果演出（王様・最下位のアイコン）のあとで始める
      setTimeout(()=>startCeremony(e.ids||[]), d);
      break; }
  }
}
// 結果画面の順位表: コインの数字を前回の値から数え上げて、増えた分の「+n」をポンと出す
let prizeAnimRound=-1;
function animateStandings(e){
  const rows=[...document.querySelectorAll("#standings .srow")];
  if(!rows.length || prizeAnimRound===S.round*1000+S.sea.no) return;
  prizeAnimRound=S.round*1000+S.sea.no;
  if(fxLevel>=1) sfx("finish");
  rows.forEach((r,i)=>{
    const c=+r.dataset.c, d=+r.dataset.d, sc=r.querySelector(".sc"), sd=r.querySelector(".sd");
    if(!d) return;
    if(fxLevel>=1) setTimeout(()=>{
      countUp(sc,c-d,c,1000);
      if(sd) anim(sd,[{transform:"scale(.4)",opacity:0},{transform:"scale(1.5)",opacity:1,offset:.3},{transform:"scale(1)",opacity:1}],{duration:520,easing:"ease-out"});
      if(d>0 && dopa()){ const q=sd.getBoundingClientRect(); burst(q.left+q.width/2,q.top+q.height/2,{n:6,emoji:"🪙",size:6,dist:50,gravity:30}); }
    }, 250+i*110);
    else sc.textContent=cfmt(c);
  });
  const mine=rows.find(r=>r.classList.contains("me"));
  if(mine && dopa() && +mine.dataset.d>0){ const q=mine.getBoundingClientRect(); setTimeout(()=>coinFountain(q.left+q.width/2,q.top+q.height/2,Math.min(50,10+Math.round(+mine.dataset.d/25))),400); }
}

// ---- 表彰式 ----
let cer=null;
const cerAlive = () => !!S && screen==="room" && S.phase!=="play";
function cerKill(){
  if(!cer) return;
  cer.timers.forEach(clearTimeout); document.removeEventListener("keydown",cer.key,true);
  const el=cer.el; cer=null; el.remove();
}
function startCeremony(ids){
  cerKill();
  if(!cerAlive() || document.hidden) return;
  const rows=(Array.isArray(ids)?ids:[]).map(id=>S.players.find(p=>p.id===id)).filter(Boolean);      // 途中で抜けた人は飛ばす（固まらない）
  if(rows.length<2) return;
  const N=rows.length, lvl=fxLevel, E=S.sea||{};
  const el=document.createElement("div"); el.className="cer"; el.id="cer"; el.setAttribute("role","dialog"); el.setAttribute("aria-label","表彰式");
  el.style.setProperty("--n",N); el.style.setProperty("--h",Math.ceil(N/2));
  const medal=r=>r===1?"🥇":r===2?"🥈":r===3?"🥉":"";
  el.innerHTML=`<div class="cerhd"><b>🏆 表彰式</b><small>${E.len?`全${E.len}回戦 総合順位`:"総合順位"}</small></div>
    <ol class="cerlist">${rows.map((p,i)=>`<li class="cr k${Math.min(i+1,4)}" data-r="${i+1}"><span class="crr">${medal(i+1)||(i+1)}</span>${miniAva(p,34)}<b class="crn">${esc(p.name)}${p.id===myId?" ←":""}</b><span class="crc">${esc(cfmt(S.coins[p.id]||0))}</span></li>`).join("")}</ol>
    <div class="cerhint">タップでスキップ</div>`;
  document.body.appendChild(el);
  const tok={};
  cer={el, timers:[], tok, key:null};
  const at=(ms,fn)=>{ const t=setTimeout(()=>{ if(!cer||cer.el!==el) return; if(!cerAlive()){ cerKill(); return; } try{ fn(); }catch(err){ pushErr("ceremony",err); } },ms); cer.timers.push(t); };
  el.onclick=()=>cerKill();
  cer.key=ev=>{ if(["Escape","Enter"," "].includes(ev.key)){ ev.preventDefault(); ev.stopPropagation(); cerKill(); } };
  document.addEventListener("keydown",cer.key,true);
  requestAnimationFrame(()=>{ if(cer&&cer.el===el) el.classList.add("on"); });
  const show=r=>{ const li=el.querySelector(`.cr[data-r="${r}"]`); if(li) li.classList.add("show"); };
  const beat = lvl>=1 ? 1 : .5;
  let t=900*beat+300;
  if(lvl>=1){ at(80,()=>{ sfx("deal"); if(dopa()) kanji("表彰式","gold",110,.2); }); }
  // 最下位から3位まで: ひとりずつ短い間をあけて
  for(let r=N;r>=3;r--){
    const last=r===N, rr=r;
    at(t,()=>{ show(rr); sfx(last?"foul":"tick"); if(last && lvl>=1) avaSlam(rows[N-1].id,"bad","最下位…",rows[N-1].name); });
    t += last && lvl>=1 ? 3000 : (r>3 ? 650 : 900)*beat;
  }
  if(N>=2){   // 2位
    at(t,()=>{ show(2); sfx("thud"); if(lvl>=1){ flash("#e8f0ff"); shake(); } if(N===2 && lvl>=1) avaSlam(rows[1].id,"bad","最下位…",rows[1].name); });
    t += (N===2 && lvl>=1) ? 3000 : 1500*beat;
  }
  at(t,()=>{   // 優勝
    show(1); const c=rows[0];
    sfx("fanfare");
    if(lvl>=1){ avaSlam(c.id,"king","総合優勝",c.name); flash("#fff4b0"); rays(); fireworks(12); confetti(180); vib([80,40,200]);
      coinFountain(innerWidth*.2,innerHeight*.95,60); coinFountain(innerWidth*.5,innerHeight*.95,90); coinFountain(innerWidth*.8,innerHeight*.95,60); }
    if(dopa()){ kanji("総合優勝","rainbow",undefined,.2,300); setTimeout(()=>kanji("優勝","gold",150,.34),1100); rainbowStrobe(2600); rgbSplit(500); hitStop(2); rain(["👑","🪙","💰","✨","🌈"],80,3200); }
    el.classList.add("fin");
  });
  at(t+(lvl>=1?9000:3500),()=>cerKill());
  at(60000,()=>cerKill());
}
function replayCeremony(){ if(S && S.sea && S.sea.cer) startCeremony(S.sea.cer); }

// ---- CPUの賭け（ホストだけ）。ゲームの進行は待たない（別タイマー） ----
const cpuBetT=new Set();
function driveCpuBets(){
  if(!S || S.phase!=="play" || !S.bet || !isHost()) return;
  for(const p of S.players){
    if(!p.bot || p.away || !betEligible(S,p.id) || S.bet.bets.some(b=>b.id===p.id)) continue;
    const key=S.round+"|"+S.bet.k+"|"+p.id; if(cpuBetT.has(key)) continue;
    cpuBetT.add(key); if(cpuBetT.size>150){ cpuBetT.clear(); cpuBetT.add(key); }
    if(Math.random()<.3) continue;                                  // 全員が毎回賭けるわけではない
    const k=S.bet.k, rd=S.round, id=p.id;
    setTimeout(()=>cpuBetNow(id,k,rd), 1500+Math.random()*6500);
  }
}
function cpuBetNow(id,k,rd){
  try{
    if(!S || !isHost() || S.phase!=="play" || !S.bet || S.bet.k!==k || S.round!==rd) return;
    const pick=cpuBetPick(S,id); if(!pick) return;
    const a={t:"cbet",id,on:pick.on,stake:pick.stake};
    if(mode==="solo"){ const s=clone(S); if(applyAction(s,myId,a)===true) setState(s); }
    else if(net==="db") mutateDb(a,myId);
    else hostApply(myId,a);
  }catch(err){ pushErr("cpubet",err); }
}
