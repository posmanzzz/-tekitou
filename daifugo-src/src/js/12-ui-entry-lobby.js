let hashKeep="";
function renderEntry(){
  document.body.classList.remove("revmode","ebmode","lockmode");
  const nm=store.get("dfg_name")||"";
  let hashPass=hashKeep||""; try{ if(!hashPass) hashPass = !inArtifact && location.hash.length>1 ? decodeURIComponent(location.hash.slice(1)) : ""; }catch(e){}
  const netMsg = !netChecked ? "接続確認中…" : !net ? "オンライン機能が使えない環境です（ひとりモードは遊べる）" : "";
  const howto = net==="p2p"
    ? `このページのURLと合言葉を送るだけで友達が入れる（最大${MAX_PLAYERS}人・ゲーム中でも途中参加OK）。最初に入った人がホストになって、ホストが「退出」すると他の人に自動で引き継がれるよ。`
    : inArtifact ? "Claude上で遊ぶ場合、友達はこのページに編集者として招待されている必要があるよ。" : "";
  app.innerHTML=`<div class="page">
    <div class="row" style="justify-content:flex-end">${soundBtn()}</div>
    <div class="logo"><small>合言葉で集まれ</small><b>大富豪</b><i class="logo-uno">& <span>U</span><span>N</span><span>O</span></i><em>CARD PARLOR · ババ抜き · 神経衰弱</em></div>
    <div class="sub" style="text-align:center">同じ合言葉を入れた人と同じ部屋で遊べる</div>
    <div class="panel">
      <label>アイコン・なまえ</label>
      <div class="row" style="flex-wrap:nowrap">
        <button class="avpick" id="avpick" title="アイコン画像を選ぶ" aria-label="アイコン画像を選ぶ">${okAvatar(myAvatar)?`<span style="background-image:url('${myAvatar}')"></span>`:"📷"}</button>
        <input id="nm" class="grow" maxlength="10" value="${esc(nm)}" placeholder="ぽすまん" style="width:auto;min-width:0">
      </div>
      ${myAvatar?`<div style="margin-top:4px"><button class="small ghost" id="avdel">アイコンを外す</button></div>`:`<div class="note" style="margin-top:4px">📷 をタップで写真をアイコンにできるよ</div>`}
      <label>合言葉</label>
      <div class="row" style="flex-wrap:nowrap"><input id="pw" class="grow" maxlength="40" value="${esc(hashPass)}" placeholder="例: いがりんご" autocomplete="off" style="width:auto;min-width:0"><button class="small ghost" id="pwgen" title="ランダムな合言葉を作る" aria-label="ランダムな合言葉を作る">🎲</button></div>
      <div class="note pwnote" id="pwnote"></div>
      ${net==="p2p"&&store.get("dfg_ipnote")!=="1"?`<div class="note ipnote" id="ipnote">オンラインは参加者どうしが直接つながるよ。ホストには接続情報（IPアドレス）が見える。気になる人は ⚙設定 の「IPを隠す」をオンにしてね。 <button class="small ghost" id="ipnoteset">設定を開く</button></div>`:""}
      <div class="btnrow"><button id="go" ${net?"":"disabled"}>部屋に入る</button></div>
      <div class="err" id="err" role="alert">${esc(errMsg||netMsg)}</div>
      ${retryHint&&lastJoin&&net?`<div class="btnrow" style="margin-top:4px"><button id="reconnect">再接続する</button></div>`:""}
      <div class="btnrow" style="margin-top:4px"><button class="ghost" id="solo">CPUとひとりで遊ぶ</button></div>
      ${howto?`<div class="note" style="margin-top:10px">${howto}</div>`:""}
    </div>
    ${net==="p2p"?`<div class="panel roomsp"><div class="row"><b class="grow">🏠 立ってる部屋</b><button class="small ghost" id="rref">更新</button></div><div id="rooms">${dirListHtml()}</div></div>`:""}
    </div>`;
  errMsg="";
  bindSound();
  const ins=document.getElementById("ipnoteset"); if(ins) ins.onclick=()=>{ store.set("dfg_ipnote","1"); openSettings(); };
  const rcn=document.getElementById("reconnect"); if(rcn) rcn.onclick=()=>{ ensureAudio(); joinOnline(lastJoin.name,lastJoin.pass); };
  const nmI=document.getElementById("nm"), pwI=document.getElementById("pw"), er=document.getElementById("err");
  const keep=()=>{ store.set("dfg_name",nmI.value.trim()); hashKeep=pwI.value; };
  document.getElementById("avpick").onclick=()=>{ keep(); pickAvatar(); };
  const ad=document.getElementById("avdel"); if(ad) ad.onclick=()=>{ keep(); setMyAvatar(""); };
  document.getElementById("go").onclick=()=>{
    ensureAudio(); store.set("dfg_ipnote","1");
    const n=nmI.value.trim(), p=pwI.value.trim();
    if(!n||!p){ er.textContent="なまえと合言葉を入れてね"; return; }
    store.set("dfg_name",n); joinOnline(n,p);
  };
  pwI.onkeydown=e=>{ if(e.key==="Enter") document.getElementById("go").click(); };
  const pn=document.getElementById("pwnote");
  const pwCheck=()=>{ const v=normPass(pwI.value); const weak=v.length>0 && ([...v].length<6 || /^(\d+|[a-z]+|あいうえお|test|てすと)$/.test(v));
    pn.innerHTML = !v ? "ネッ友と遊ぶなら 🎲 で作った合言葉がおすすめ（知らない人と部屋がかぶらない）" : weak ? "⚠ 短い合言葉は知らない人と部屋がかぶるかも。6文字以上か 🎲 がおすすめ" : "🔐 いい感じ。この合言葉を知ってる人だけが入れるよ";
    pn.classList.toggle("warn",weak); };
  pwI.addEventListener("input",()=>{ hashKeep=pwI.value; pwCheck(); }); pwCheck();
  document.getElementById("pwgen").onclick=()=>{ pwI.value=randomPass(); hashKeep=pwI.value; pwCheck(); sfx("tap"); };
  bindDirList();
  dirSync();
  const rr=document.getElementById("rref"); if(rr) rr.onclick=()=>{ sfx("tap"); dirTick(true); };
  document.getElementById("solo").onclick=()=>{ ensureAudio(); const n=nmI.value.trim()||"あなた"; store.set("dfg_name",n); startSolo(n); };
}

function readySummary(){
  const hs=S.players.filter(p=>!p.bot && p.id!==S.host);
  return hs.length ? ` ・ 準備OK ${hs.filter(p=>p.ready).length}/${hs.length}人（ホストは 👑）` : "";
}
function playerChips(){
  const host=isHost();
  return `<div class="players">${S.players.map(p=>{
    const title=S.titles&&S.titles[p.id];
    let meta;
    if(p.bot) meta = p.away?"不在（CPU）":"CPU";
    else if(p.offline) meta = "📴 再接続待ち…";
    else if(p.id===S.host) meta = `<span class="hostb">👑 ホスト</span>`;
    else meta = p.ready ? `<span class="ok">✅ 準備OK</span>` : `<span class="wait">⏳ 準備中…</span>`;
    const rm = host && mode==="online" && !p.bot && p.id!==myId ? `<button class="small ghost danger" data-kick="${esc(p.id)}" style="margin-top:4px">追い出す</button>`
             : host && S.phase!=="play" && p.id!==myId ? `<button class="small ghost" data-rm="${esc(p.id)}" style="margin-top:4px">外す</button>`
             : p.id===myId ? `<button class="small ghost" data-avchg="1" style="margin-top:4px">📷 アイコン変更</button>` : "";
    return `<div class="pl ${p.id===myId?"me":""} ${p.ready?"ready":""} ${p.id===S.host?"host":""}">
      ${bubbleHtml(p.id)}
      <div class="nm">${miniAva(p)}${esc(p.name)}${title?`<span class="badge ${title==="大富豪"?"gold":title==="大貧民"?"bad":""}">${esc(title)}</span>`:""}</div>
      <div class="meta">${meta}</div>${rm}</div>`;
  }).join("")}</div>`;
}
// 2回タップで確定（誤タップ防止）
function bindKick(root){
  (root||document).querySelectorAll("[data-kick]").forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    if(!b.dataset.sure){ b.dataset.sure="1"; b.textContent="本当に？"; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.sure; b.textContent="追い出す"; } },2500); return; }
    act({t:"kick",id:b.dataset.kick});
  });
}
function securityPanel(){
  if(mode!=="online" || net!=="p2p") return "";
  const host=isHost();
  return `<div class="panel secpanel">
    <div class="row" style="margin-bottom:6px"><b class="grow">🛡 セキュリティ</b>${host?"":'<span class="note">ホストが設定</span>'}</div>
    <div class="rules">
      <button class="rule ${S.pub?"on":""}" id="pubbtn" ${host?"":"disabled"}><b>${S.pub?"🌐 公開部屋":"🔐 非公開部屋"}</b><small>${S.pub?"入口の一覧から誰でも入れる（合言葉も公開）":"合言葉を知ってる人だけ。一覧には人数だけ出る"}</small></button>
      <button class="rule ${S.locked?"on":""}" id="lockbtn" ${host?"":"disabled"}><b>🔒 部屋に鍵</b><small>新しい人が入れなくなる（今いる人は再接続OK）</small></button>
      <button class="rule ${S.fair!==false?"on":""}" id="fairbtn" ${host&&S.phase!=="play"?"":"disabled"}><b>⚖ 公平モード</b><small>ホスト以外に手札を一切預けない（ホストが落ちたらそのラウンドは中止）</small></button>
    </div>
    ${S.pub?`<label>部屋の名前（一覧に出る）</label><input id="rtitle" maxlength="20" value="${esc(S.title||"")}" placeholder="${esc(((S.players.find(p=>p.id===S.host)||{}).name||"")+"の部屋")}" ${host?"":"disabled"}>`:""}
    <div class="note" style="margin-top:6px">通信は暗号化（WebRTC/DTLS）。同じ人かどうかは端末の鍵で確認してるから、名前をまねても席は乗っ取れない。追い出した人はこの部屋に戻れないよ。</div>
  </div>`;
}
// 制限時間は部屋の遊びやすさに直結するので、セキュリティとは別に、人の一覧のすぐ下に大きく出す
function timerPanel(){
  if(mode!=="online" || net!=="p2p") return "";
  const host=isHost() && S.phase!=="play";
  return `<div class="panel tmpanel">
    <div class="row" style="margin-bottom:6px"><b class="grow">⏱ 1手の制限時間</b>${isHost()?"":'<span class="note">ホストが設定</span>'}</div>
    <div class="seg big" id="tmseg" role="group" aria-label="1手の制限時間">${[[0,"なし"],[15,"15秒"],[30,"30秒"],[60,"60秒"]].map(([n,l])=>`<button class="${(S.tsec||0)===n?"on":""}" data-tsec="${n}" aria-pressed="${(S.tsec||0)===n}" ${host?"":"disabled"}>${l}</button>`).join("")}</div>
    <div class="note">ダラダラ防止。時間切れはCPUが代わりに出して、2回続くと離席扱い（動くまでCPUが代打ち）。${S.phase==="play"?"ゲーム中は変えられないよ。":""}</div>
  </div>`;
}
function bindChips(){
  app.querySelectorAll("[data-bot]").forEach(b=>b.onclick=()=>act({t:"tobot",id:b.dataset.bot}));
  app.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>act({t:"rm",id:b.dataset.rm}));
  bindKick(app);
  const lk=document.getElementById("lockbtn"); if(lk) lk.onclick=()=>{ act({t:"lock",v:!S.locked}); sfx("tap"); };
  const fr=document.getElementById("fairbtn"); if(fr) fr.onclick=()=>{ act({t:"fair",v:S.fair===false}); sfx("tap"); };
  const pb=document.getElementById("pubbtn"); if(pb) pb.onclick=()=>{ act({t:"pub",v:!S.pub}); sfx("tap"); setTimeout(()=>dirTick(true),50); };
  const rt=document.getElementById("rtitle"); if(rt && isHost()) rt.onchange=()=>{ act({t:"pub",v:true,title:rt.value}); setTimeout(()=>dirTick(true),50); };
  app.querySelectorAll("[data-tsec]").forEach(b=>b.onclick=()=>{ if(isHost()){ act({t:"timer",sec:+b.dataset.tsec}); sfx("tap"); } });
  app.querySelectorAll("[data-avchg]").forEach(b=>b.onclick=()=>pickAvatar());
}
function rulesPanel(){
  if(S.game==="baba") return `<div class="panel"><b>ババ抜きのルール</b><div class="note" style="margin-top:6px">配られた時点で同じ数字のペアは自動で捨てる。自分の番は隣の人の手札から1枚引いて、ペアになったら捨てる。手札がなくなったら上がり、最後にジョーカー（ババ）を持ってた人の負け。<br>相手がどのカードに指をかけてるかは引かれる側にも見える。自分の手札はシャッフルできるよ。</div></div>`;
  if(S.game==="shinkei") return `<div class="panel"><b>神経衰弱のルール</b><div class="note" style="margin-top:6px">裏向きのカードを2枚めくって、同じ数字ならゲットしてもう1回。外れたら次の人へ。全部なくなった時に一番多く取った人の勝ち。5人以上だとジョーカー2枚も入る（ジョーカー同士でペア）。CPUはたまに忘れるよ。</div></div>`;
  const host=isHost() && S.phase!=="play";
  const uno=S.game==="uno";
  const defs= uno ? UNO_RULE_DEFS : RULE_DEFS, R = uno ? (S.urules||UNO_DEFAULT) : S.rules, presets = uno ? UNO_PRESETS : PRESETS;
  return `<div class="panel">
    <div class="row" style="margin-bottom:8px"><b class="grow">${uno?"UNOの":"大富豪の"}ルール</b>
      ${host?Object.keys(presets).map(k=>`<button class="small ghost" data-preset="${k}">${k}</button>`).join(""):'<span class="note">ホストが設定</span>'}</div>
    <div class="rules">${defs.map(d=>`<button class="rule ${R[d.k]?"on":""}" data-rule="${d.k}" ${host?"":"disabled"}><b>${d.name}</b><small>${d.desc}</small></button>`).join("")}</div>
    ${uno?"":`<label>ジョーカー</label>
    <div class="seg">${[0,1,2].map(n=>`<button class="${R.jokers===n?"on":""}" data-jk="${n}" ${host?"":"disabled"}>${n}枚</button>`).join("")}</div>`}
  </div>`;
}
function gamePanel(){
  const host=isHost() && S.phase!=="play";
  return `<div class="panel gamesel">
    <div class="row" style="margin-bottom:8px"><b class="grow">ゲーム</b>${host?"":'<span class="note">ホストが選ぶ</span>'}</div>
    <div class="gtiles">
      <button class="gtile ${S.game==="daifugo"?"on":""}" data-game="daifugo" ${host?"":"disabled"}><span class="gi">🃏</span><b>大富豪</b><small>革命・8切り・縛り…</small></button>
      <button class="gtile uno ${S.game==="uno"?"on":""}" data-game="uno" ${host?"":"disabled"}><span class="gi">🎴</span><b>UNO</b><small>+4・リバース・UNO!</small></button>
      <button class="gtile baba ${S.game==="baba"?"on":""}" data-game="baba" ${host?"":"disabled"}><span class="gi">🤡</span><b>ババ抜き</b><small>ババを押しつけろ</small></button>
      <button class="gtile shinkei ${S.game==="shinkei"?"on":""}" data-game="shinkei" ${host?"":"disabled"}><span class="gi">🧠</span><b>神経衰弱</b><small>めくって覚えて揃えろ</small></button>
    </div></div>`;
}
function bindRules(){
  app.querySelectorAll("[data-game]").forEach(b=>b.onclick=()=>{ if(isHost()) act({t:"game",g:b.dataset.game}); });
  if(!isHost() || S.phase==="play") return;
  const uno=S.game==="uno";
  const send = nr => { store.set(uno?"dfg_urules":"dfg_rules",JSON.stringify(nr)); act(uno?{t:"urules",rules:nr}:{t:"rules",rules:nr}); sfx("tap"); };
  const cur = () => uno ? (S.urules||UNO_DEFAULT) : S.rules;
  app.querySelectorAll("[data-rule]").forEach(b=>b.onclick=()=>{ const k=b.dataset.rule; send({...cur(),[k]:!cur()[k]}); });
  app.querySelectorAll("[data-jk]").forEach(b=>b.onclick=()=>send({...S.rules,jokers:+b.dataset.jk}));
  app.querySelectorAll("[data-preset]").forEach(b=>b.onclick=()=>send({...(uno?UNO_PRESETS:PRESETS)[b.dataset.preset]}));
}
function inviteBtn(){ return mode==="online" && net==="p2p" ? `<button class="small" id="invite">📨 招待</button>` : ""; }
function bindInvite(){
  const b=document.getElementById("invite"); if(!b) return;
  b.onclick=async()=>{
    const url=location.origin+location.pathname+"#"+encodeURIComponent(roomKey);
    const text=`大富豪やろう！合言葉は「${roomKey}」\n${url}`;
    try{ if(navigator.share){ await navigator.share({text}); return; } }catch(e){ if(e&&e.name==="AbortError") return; }
    try{ await navigator.clipboard.writeText(text); toast("コピーした！"); }catch(e){ toast(url); }
  };
}
function chatPreview(){
  const list=(S.chat||[]).slice(-3);
  return `<div class="panel chatprev" id="chatPrev"><div class="row"><b class="grow">💬 チャット</b><span class="note">タップで開く</span></div>
    ${list.length?list.map(m=>`<div class="note"><b>${esc(m.name)}</b>: ${esc(m.text)}</div>`).join(""):`<div class="note">「よろしく！」って送ってみよう</div>`}</div>`;
}
// 準備OK / 開始ボタン
function startControls(isNext){
  const host=isHost(), n=S.players.length, me=S.players.find(p=>p.id===myId);
  const humans=S.players.filter(p=>!p.bot && p.id!==S.host);
  const readyN=humans.filter(p=>p.ready).length, allReady=readyN===humans.length;
  if(host){
    const label = isNext ? "次のラウンドへ" : `ゲーム開始（${n}人）`;
    return `<div class="btnrow"><button class="ghost" id="addbot" ${n>=MAX_PLAYERS?"disabled":""}>＋ CPU</button>
      <button id="start" ${n<2||!allReady?"disabled":""}>${allReady?label:`準備待ち ${readyN}/${humans.length}`}</button></div>
      ${!allReady&&n>=2?`<div style="text-align:right;margin-top:6px"><button class="small ghost" id="force">待たずに開始</button></div>`:""}`;
  }
  if(!me) return `<div class="hint" style="margin-top:12px">入室できませんでした</div>`;
  return `<div class="btnrow"><button id="ready" class="${me.ready?"ghost":""}">${me.ready?"✅ 準備OK（取り消す）":"準備OK！"}</button></div>
    <div class="hint" style="margin-top:6px">${me.ready?"ホストの開始を待ってます…":"準備できたら押してね"}</div>`;
}
function bindStart(isNext){
  const t=isNext?"next":"start";
  const g=id=>document.getElementById(id);
  if(g("addbot")) g("addbot").onclick=()=>act({t:"addbot"});
  if(g("start")) g("start").onclick=()=>act({t});
  if(g("force")) g("force").onclick=()=>act({t,force:true});
  if(g("ready")) g("ready").onclick=()=>{ const me=S.players.find(p=>p.id===myId); act({t:"ready",v:!(me&&me.ready)}); sfx("tap"); };
  const cp=g("chatPrev"); if(cp) cp.onclick=()=>{ chatOpen=true; unread=0; updateChat(); };
}

function renderLobby(){
  app.innerHTML=`<div class="page">
    <div class="row"><h1 class="grow">ロビー <small class="gname">${({daifugo:"🃏",uno:"🎴",baba:"🤡",shinkei:"🧠"})[S.game]||""} ${GAME_NAMES[S.game]||""}</small></h1>${chatBtn("small ghost")}${helpBtn()}${soundBtn()}</div>
    <div class="sub">合言葉 <span class="code">${esc(roomKey)}</span> ${inviteBtn()}</div>
    <div class="panel"><div class="note" style="margin-bottom:6px">${S.players.length}/${MAX_PLAYERS}人${readySummary()}</div>${playerChips()}${startControls(false)}</div>
    ${timerPanel()}
    ${gamePanel()}
    ${mode==="online"?chatPreview():""}
    ${rulesPanel()}
    ${securityPanel()}
    <div class="panel"><div class="note">${S.log.slice(-5).map(esc).join("<br>")}</div></div>
    <button class="ghost" id="leave">退出</button></div>`;
  bindChips(); bindRules(); bindSound(); bindInvite(); bindStart(false); bindChatBtn();
  document.getElementById("leave").onclick=leave;
}

