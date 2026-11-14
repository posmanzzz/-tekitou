// ---- 12ボンバー：自分の手札が爆ぜて消える ----
let handSnap=null;
function snapHand(){
  const h=document.getElementById("hand"); if(!h){ handSnap=null; return; }
  const r=h.getBoundingClientRect(); if(!r.width){ handSnap=null; return; }
  handSnap={rect:{left:r.left,top:r.top,width:r.width,height:r.height}, cards:[...h.querySelectorAll(".card")].map(c=>({id:c.dataset.c, html:c.outerHTML.replace(/\b(sel|deal|dim)\b/g,""), rc:c.getBoundingClientRect()}))};
}
const QUAD=["0 0,52% 0,46% 55%,0 48%","52% 0,100% 0,100% 44%,46% 55%","0 48%,46% 55%,55% 100%,0 100%","46% 55%,100% 44%,100% 100%,55% 100%"];
function explodeHand(ranks, snap0){
  const snap=snap0||handSnap; if(!snap || !ranks) return;
  const gone=snap.cards.filter(c=>c.id && ranks.includes(parse(c.id).r)); if(!gone.length) return;
  const wrap=document.createElement("div"); wrap.className="hand xhand";
  Object.assign(wrap.style,{left:snap.rect.left+"px",top:snap.rect.top+"px",width:snap.rect.width+"px",height:snap.rect.height+"px"});
  wrap.innerHTML=gone.map(c=>c.html).join(""); fxLayer.appendChild(wrap);
  const els=[...wrap.children];
  els.forEach((el,i)=>{
    const d=i*90, base=el.style.transform||"";
    el.classList.add("xfuse");
    anim(el,[{transform:base},{transform:base+" translate(-3px,0)",offset:.25},{transform:base+" translate(3px,-2px)",offset:.5},{transform:base+" translate(-3px,1px) scale(1.06)",offset:.75},{transform:base+" scale(1.15)"}],{duration:520,delay:d,fill:"forwards"});
    setTimeout(()=>{
      const rc=gone[i].rc, x=rc.left+rc.width/2, y=rc.top+rc.height/2;
      // 4つの破片に割る
      for(let q=0;q<4;q++){
        const f=el.cloneNode(true); f.classList.remove("xfuse"); f.classList.add("xfrag");
        f.style.clipPath=`polygon(${QUAD[q]})`; wrap.appendChild(f);
        const vx=(q%2?1:-1)*(60+Math.random()*90), vy=(q<2?-1:1)*(40+Math.random()*60)-80;
        anim(f,[{transform:base,opacity:1},{transform:`${base} translate(${vx}px,${vy}px) rotate(${(Math.random()*2-1)*200}deg) scale(.8)`,opacity:1,offset:.6},{transform:`${base} translate(${vx*1.3}px,${vy+220}px) rotate(${(Math.random()*2-1)*300}deg) scale(.6)`,opacity:0}],{duration:900,easing:"cubic-bezier(.2,.7,.4,1)",fill:"forwards"});
      }
      el.style.opacity=0;
      burst(x,y,{n:22,dist:110,size:9,colors:["#fff","#ffd54a","#ff8a3d","#ff3b2f"]});
      ring(x,y,"#ffb35a",150);
      PFX.add({emoji:"💥",x,y,vx:0,vy:-20,g:0,drag:1,size:Math.round(rc.width*1.3),rot:0,vr:0,life:.45,fadeFrom:.3});
      noise(.18,.22,0,300); tone(120,.2,"sawtooth",.08,0,50);
      if(i===els.length-1){ shake(true); vib([60,30,120]); }
    }, d+520);
  });
  setTimeout(()=>wrap.remove(), els.length*90+520+1000);
}

function playFx(e){
  if(e.id && (e.k==="play"||e.k==="uplay")){ seatHop(e.id); setTimeout(fieldPunch,380); }
  if(e.id && (e.k==="pass"||e.k==="upass")) seatHop(e.id,true);
  if(e.k==="bdraw"||e.k==="bshuf") return playBabaFx(e);
  if(e.k==="kflip"||e.k==="kmatch"||e.k==="kmiss") return playShinkeiFx(e);
  if(/^(u|game$)/.test(e.k)) return playUnoFx(e);
  const strongCard = cs => cs && (cs.length>=3 || cs.some(c=>{const r=parse(c).r; return r===16||r===15;}));
  switch(e.k){
    case "play":
      sfx(strongCard(e.cards)?"thud":"play");
      if(e.cards) flyCardsToField(e.id, e.cards, (p,g)=>{
        if(strongCard(e.cards)){ burst(p.x,p.y,{n:22,dist:110}); ring(p.x,p.y,"#ffd54a"); shake(); }
        else burst(p.x,p.y,{n:8,dist:50,size:6,colors:["#fff","#ffe08a"]});
        if(g) lastGhost=g;
      });
      playDopa(e);
      break;
    case "pass": sfx("pass"); if(e.id) floatText(e.id,"パス","pass"); break;
    case "clear": sfx("clear"); sweepField(1); comboN=0; break;
    case "rev": setTimeout(()=>{
        sfx("rev"); revFlip(); flash("#ff2a6a"); vib([60,40,60]);
        const l=document.createElement("div"); l.className="lightning"; fxLayer.appendChild(l); setTimeout(()=>l.remove(),900);
        rainbowStrobe(1600); rgbSplit(600); if(dopa()){ kanji(e.on?"確変突入":"確変終了", e.on?"rainbow":"dark", undefined, .27, 200); setTimeout(()=>stamp(e.on?"革命":"返し","#ff2a6a"),1100); }
        cutin("rev", e.on?"⚡ 革命 ⚡":"革命返し！", e.on?`${e.who||""}　強さが逆転！`:`${e.who||""}　強さが元通り`, 1500);
      },380); break;
    case "eight": sweepField(-1); setTimeout(()=>{ sfx("eight"); slashGhost(lastGhost); bigSlash(); comboN=0; if(dopa()){ kanji("斬","blue",180,.27); hitStop(1.5); rgbSplit(); } cutin("eight","✂ 8切り", e.who?`${e.who}　場を斬った！`:"", 1100); },420); break;
    case "eb": setTimeout(()=>{ sfx("eb"); flash("#6a7bff"); kanji("逆","blue",180,.27); cutin("eb", e.on===false?"11バック解除":"↩ 11バック", e.on===false?"強さが元通り":"場が流れるまで強さ逆転", 1200); },380); break;
    case "lock": setTimeout(()=>{ chainSlam(); kanji("封","green",180,.27); cutin(e.red?"lockr":"lock", `🔒 縛り ${e.suits}`, `${e.suits} しか出せない！`, 1200); },380); break;
    case "stair": setTimeout(()=>{ chainSlam(); kanji("段","gold",180,.27); cutin("lock","🪜 階段縛り","数字が1つずつしか上げられない！",1200); },380); break;
    case "skip": setTimeout(()=>{ sfx("skip"); speedSwipe(); kanji("飛","gold",180,.27); cutin("skip", `⏩ ${e.n}人スキップ`, e.who||"", 1000); },380); break;
    case "finish": setTimeout(()=> e.place===1 ? winFx(e) : placeFx(e), 350); break;
    case "foul": sfx("foul"); darkPulse(); shake(true); kanji("罰","dark",180,.27); cutin("dark", "🚫 反則上がり", `${e.who}は最下位…`, 1300); if(e.id) avaSlam(e.id,"bad","反則負け",e.who); break;
    case "miyako": sfx("miyako"); darkPulse(); shake(true); rain(["💀","🏚"],16,2200); kanji("堕","dark",180,.27); cutin("dark", "🏚 都落ち", `${e.who}が大貧民に転落…`, 1500); if(e.id) avaSlam(e.id,"bad","都落ち",e.who); break;
    case "seven": sfx("seven"); passFlyBacks(e.from,e.to,e.n);
      if(e.to===myId){ kanji("贈","gold",170,.27); } if(e.to===myId) cutin("seven", `🎁 ${e.n}枚もらった`, "7渡し", 1000); else floatText(e.to,`🎁+${e.n}`); break;
    case "bomb": sfx("bomb"); boom(); explodeHand(e.rs, e._snap); shockwave("#ffb35a"); flash("#ff8a3d"); shake(true); vib([80,40,160]);
      if(dopa()){ kanji("爆","red",190,.27); hitStop(2); rgbSplit(700); setTimeout(()=>shockwave("#fff"),250); setTimeout(()=>shake(true),500); rain(["💥","🔥","💨"],30,2000); }
      setTimeout(()=>{ const sm=document.createElement("div"); sm.className="smoke"; fxLayer.appendChild(sm); setTimeout(()=>sm.remove(),1600); },200);
      cutin("bomb", "💣 12ボンバー", `${e.ranks} が全員の手札から消滅！`, 1400); break;
    case "pending": if(S && ((S.pending && S.pending.pid===myId) || (S.u && S.u.pending && S.u.pending.pid===myId))){ sfx("turn"); vib(25); } break;
    case "join": sfx("chat"); if(e.who) toast(`${e.who} が入ってきた！`); break;
    case "round": sfx("deal"); cutin("round", e.game==="uno"?`🎴 UNO 第${e.n}回戦`:e.game==="baba"?`🤡 ババ抜き 第${e.n}回戦`:e.game==="shinkei"?`🧠 神経衰弱 第${e.n}回戦`:`第${e.n}ラウンド`, e.game==="shinkei"?"カードを並べたよ":"カードを配るよ", 1000); break;
    case "end":
      if(e.game==="baba"){
        sfx("foul"); darkPulse(); if(e.loser===myId){ shake(true); vib([120,60,200]); }
        cutin("dark", e.loser===myId?"🤡 あなたがババ持ち…":"🤡 ババ持ち決定", e.loser?nameOf(S,e.loser)+" の負け":"", 1500);
        if(dopa()){ kanji("敗北","dark",undefined,.25,150); rain(["🤡","💀","🃏"],30,2400); }
        if(e.loser) setTimeout(()=>avaSlam(e.loser,"bad","ババ持ち…",nameOf(S,e.loser)),400);
        break;
      }
      if(e.game==="shinkei"){
        const me=e.king===myId, p=seatPoint(e.king);
        sfx("fanfare"); flash("#bff6ff"); rays(); fireworks(me?8:4); confetti(me?120:50); coinFountain(p.x,p.y,me?50:24);
        cutin("win", me?"🧠 あなたの勝ち！":"🧠 記憶王", nameOf(S,e.king)+" が一番取った", 1500);
        if(dopa()){ rainbowStrobe(1800); kanji("記憶王","rainbow",undefined,.25,150); }
        avaSlam(e.king,"king","記憶王",nameOf(S,e.king)); if(e.loser) avaSlam(e.loser,"bad","ビリ…",nameOf(S,e.loser));
        break;
      }
      if(e.game==="uno"){
        const me=e.king===myId, p=seatPoint(e.king);
        sfx("fanfare"); flash("#ffe36a"); rays(); fireworks(me?9:5); confetti(me?140:60); coinFountain(p.x,p.y,me?60:30);
        cutin("win", me?"🏆 あなたの勝ち！":"🏆 UNO王", me?"UNO王に決定！":nameOf(S,e.king)+" が上がり", 1600);
        if(dopa()){ rainbowStrobe(2200); kanji("大当り","rainbow",undefined,.25,150); setTimeout(()=>stamp(me?"UNO王":"上がり","#e8102a"),900); if(me) rain(["🎴","🏆","✨","🌈"],70,3000); }
        avaSlam(e.king,"king","UNO王",nameOf(S,e.king)); if(e.loser) avaSlam(e.loser,"bad","ビリ…",nameOf(S,e.loser));
        break;
      }
      if(e.king===myId){ sfx("win"); rays("rgba(255,214,90,.6)",3500); fireworks(10); confetti(160); rain(["👑","🪙","💰","✨"],60,3200); cutin("win","👑 大富豪！","あなたがこのラウンドの王様",2000);
        if(dopa()){ rainbowStrobe(3000); kanji("大富豪確定","rainbow",undefined,.24,200); setTimeout(()=>stamp("全回転","#e8102a"),1300); setTimeout(()=>{ coinFountain(innerWidth/2,innerHeight*.7,80); fireworks(8); },1500); } }
      else { sfx("pass"); confetti(30); }
      if(e.loser) setTimeout(()=>avaSlam(e.loser,"bad",(e.ltitle||"大貧民")+"…",nameOf(S,e.loser)),500);
      break;
  }
}
let lastGhost=null;


