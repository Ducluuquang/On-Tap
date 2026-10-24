/* Ôn Tập: THI ĐẤU TỪ VỰNG — phần chạy trong trang Vở Spelling (chốt 22/10/2026, file "sua 22 Oct 2026").
   - Phòng thi với bạn: mã 6 số (giữ nguyên tới khi chủ phòng rời phòng); chủ phòng chọn trò, trình độ,
     phạm vi từ, số phút; chơi nhiều ván; cuối buổi trao vương miện.
   - Thách đấu ngẫu nhiên theo trình độ: chờ 1 phút chưa có bạn thì Bạn AI vào thi (luôn ghi rõ chữ AI).
   - Scrabble (24/10/2026): bàn cờ chung, đi theo lượt (scrabble.js vẽ bàn cờ); "Scrabble với Bạn AI" bắt đầu ngay.
   Dùng chung bộ máy trò chơi của Vở Spelling (startGame, GAMES…). Máy chủ: /api/arena.
   Chưa gắn kho dữ liệu trên Vercel thì phần này tự ẩn. Không có ô trò chuyện. */
(function () {
  "use strict";
  const API = "/api/arena";
  // Hỏi máy chủ 2,5 giây/lần (cả lúc chờ lẫn lúc chơi): kho Upstash tính tiền theo lệnh, hỏi thưa vậy là đủ để thấy điểm các bạn.
  const SYNC_PLAY = 2500, SYNC_IDLE = 2500, WAIT_AI = 60000;
  const LIMIT_MSG = "Thi đấu đang tạm nghỉ: máy chủ thi đấu đã dùng hết lượt miễn phí của tháng này. Con chơi các trò khác nhé!";
  const SUGGEST = ["10 từ mới nhất", "20 từ dài nhất", "15 từ hay sai nhất", "Từ học 6 tháng trước", "Từ vựng sách lớp 7", "Động vật", "Để AI chọn chủ đề"];
  const MEDAL = ["🥇", "🥈", "🥉"];
  const A = {
    avail: false, me: null, helloOk: false, helloErr: "", code: "", st: null, screen: "menu", err: "", busy: "",
    offset: 0, rtt: 1e9, lastSync: 0, syncing: false, timer: 0, play: null, words: {}, wn: 0,
    draft: null, cfgT: 0, lastSearch: 0, searchGap: 5000, aiAsked: 0, sig: "", confirmLeave: false, net: false, lastCount: 0,
  };
  const HOOKS = {};
  // Scrabble: phần vẽ bàn cờ nằm ở scrabble.js (nạp trước arena.js)
  let SBUI = null;
  const sbui = () => SBUI || (SBUI = window.ArenaScrabble ? window.ArenaScrabble({ st: () => A.st, call: (b) => call(b), apply: (j) => apply(j), snow: () => snow(), fmtClock: (ms) => fmtClock(ms), isOwner: () => isOwner(), short: (s) => short(s), leaveHtml: () => leaveHtml() }) : null);
  const isSb = (st) => !!(st && st.status === "playing" && st.round && st.round.game === "scrabble" && st.round.sb);
  const SB_MINUTES = [5, 10, 15, 20, 30, 45, 60, 90];

  /* ---------- tiện ích ---------- */
  const keyOf = () => "ontap.arena.v1" + (ONTAP_CHILD ? "::" + ONTAP_CHILD : "");
  const load = () => { try { return JSON.parse(localStorage.getItem(keyOf()) || "null") || {}; } catch { return {}; } };
  const save = () => { try { localStorage.setItem(keyOf(), JSON.stringify({ pid: A.me ? A.me.pid : "", token: A.me ? A.me.token : "", room: A.code || "" })); } catch {} };
  const snow = () => Date.now() + A.offset;
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const gameName = (id) => (id === "scrabble" ? "Scrabble" : (GAMES[id] && GAMES[id].name) || id);
  const levelLabel = (id) => { const l = LEVELS.find((x) => x.id === id); return l ? l.label : id; };
  const meInfo = () => ({ name: (ONTAP_INFO.name || "Bạn nhỏ").slice(0, 20), icon: ONTAP_INFO.icon || "🙂", grade: ONTAP_INFO.grade || "" });
  const short = (s) => { const a = Array.from(String(s || "")); return a.length > 12 ? a.slice(0, 11).join("") + "…" : a.join(""); };
  const isOwner = () => !!(A.st && A.st.owner === A.st.me);
  const onlyLetters = (w) => String(w || "").replace(/[^a-z]/gi, "");
  function defaultLevel() {
    const g = Number((String(ONTAP_INFO.grade || "").match(/\d+/) || [])[0]);
    return !g ? "k35" : g <= 2 ? "k12" : g <= 5 ? "k35" : g <= 9 ? "k69" : "k1012";
  }
  function levelOptions(sel) {
    return LEVEL_GROUPS.map(([g, label]) => `<optgroup label="${esc(label)}">${LEVELS.filter((l) => l.group === g).map((l) => `<option value="${l.id}" ${l.id === sel ? "selected" : ""}>${esc(l.label)}</option>`).join("")}</optgroup>`).join("");
  }
  const gameOptions = (sel) => GAME_LIST.concat([{ id: "scrabble", name: "Scrabble (bàn cờ chung, theo lượt)" }]).map((g) => `<option value="${g.id}" ${g.id === sel ? "selected" : ""}>${esc(g.name)}</option>`).join("");
  const minuteOptions = (sel, game) => (game === "scrabble" ? SB_MINUTES : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).map((n) => `<option value="${n}" ${n === Number(sel) ? "selected" : ""}>${n} phút</option>`).join("");

  /* ---------- gọi máy chủ ---------- */
  async function call(body) {
    const headers = { "Content-Type": "application/json" };
    if (A.me && A.me.token) headers.Authorization = "Bearer " + A.me.token;
    const t0 = Date.now();
    let r, j;
    try {
      // kèm tên, biểu tượng, lớp của con (máy chủ không lưu hồ sơ riêng, chỉ dùng để hiện cho các bạn trong phòng)
      r = await fetch(API, { method: "POST", headers, body: JSON.stringify(Object.assign({ pid: A.me ? A.me.pid : "" }, meInfo(), body)) });
      j = await r.json().catch(() => null);
    } catch { A.net = true; return { error: "network" }; }
    const t1 = Date.now();
    A.net = false;
    if (j && j.now && t1 - t0 < A.rtt + 150) { A.offset = j.now - (t0 + t1) / 2; A.rtt = t1 - t0; }
    if (!r.ok && j && j.error === "auth") { A.helloOk = false; }
    return j || { error: "http_" + r.status };
  }
  async function ensureMe() {
    if (A.me && A.helloOk) return true;
    const saved = load();
    if (!A.me && saved.pid && saved.token) A.me = { pid: saved.pid, token: saved.token };
    const j = await call(Object.assign({ action: "hello" }, meInfo()));
    A.helloErr = (j && j.error) || "";
    if (!j || !j.ok) return false;
    if (j.token) A.me = { pid: j.pid, token: j.token };
    A.helloOk = true; save();
    return true;
  }
  const connErr = () => (A.helloErr === "store_limit" ? LIMIT_MSG : "Chưa kết nối được máy chủ thi đấu. Kiểm tra mạng rồi bấm lại nhé.");

  /* ---------- vào phần Thi đấu ---------- */
  async function init() {
    const saved = load();
    A.code = saved.room || "";
    try {
      const r = await fetch(API, { cache: "no-store" });
      const j = r.ok ? await r.json().catch(() => null) : null;
      A.avail = !!(j && j.arena);
    } catch { A.avail = false; }
    if (A.avail && S.view === "home" && typeof window.render === "function") window.render();   // vẽ lại trang chính của Vở Spelling để hiện thẻ Thi đấu
  }
  function entryHtml() {
    if (!A.avail) return "";
    return `<button class="arena-entry" type="button" data-arena="open"><span class="ae-ic" aria-hidden="true">🏆</span><span class="ae-body"><b>Thi đấu với bạn</b><em>${A.code ? `Đang ở phòng ${esc(A.code)} · bấm để vào lại` : "Tạo phòng, vào bằng mã, hoặc thách đấu ngẫu nhiên"}</em></span><span class="ae-go" aria-hidden="true">›</span></button>`
      + `<button class="arena-entry sbe" type="button" data-arena="sbhome"><span class="ae-ic" aria-hidden="true">🔠</span><span class="ae-body"><b>Scrabble</b><em>Bàn cờ thật 15×15, mỗi bạn 7 chữ · chơi với Bạn AI hoặc với bạn</em></span><span class="ae-go" aria-hidden="true">›</span></button>`;
  }
  async function open(screen) {
    A.err = ""; A.confirmLeave = false;
    A.screen = A.code ? "room" : (screen || "menu");
    go("arena");
    if (!(await ensureMe())) { A.err = connErr(); A.screen = "menu"; draw(true); return; }
    if (A.code) { A.st = null; draw(true); await sync(); }
    startTimer(); draw(true);
  }

  /* ---------- trạng thái từ máy chủ ---------- */
  function apply(j) {
    if (!j || !j.ok || !j.code) return;
    const prev = A.st;
    if (j.round) {
      if (Array.isArray(j.round.words)) { A.words[j.round.n] = j.round.words; A.wn = j.round.n; }
      else if (j.round.words === null) { A.words[j.round.n] = null; A.wn = j.round.n; }
    }
    if (A.code && A.code !== j.code) { A.play = null; A.draft = null; }
    A.st = j; A.code = j.code; A.screen = "room"; save();
    if (j.owner === j.me && !A.cfgT && (!A.draft || ["lobby", "results"].indexOf(j.status) < 0 || !prev || prev.status !== j.status))
      A.draft = { game: j.cfg.game, level: j.level, req: j.cfg.req || "", minutes: j.cfg.minutes };
    if (prev && prev.status === "playing" && j.status !== "playing" && A.play && !A.play.f) endPlay(j.status === "closed" ? "Chủ phòng đã đóng phòng." : "Hết giờ!", true);
    if (isSb(prev) && prev.code === j.code && !isSb(j) && sbui()) sbui().finish(prev, j);   // hết ván Scrabble: ghi báo cáo + âm thanh
    if (j.status === "final" && (!prev || prev.status !== "final")) SFX.play("win");
    show();
  }
  function forget(msg) {
    if (A.play && A.play.started && !A.play.f) endPlay("", true);   // đang chơi dở: vẫn ghi phần đã chơi vào báo cáo Ôn Tập
    if (G && G.arena === HOOKS) leaveGame();
    A.code = ""; A.st = null; A.play = null; A.draft = null; A.words = {}; A.wn = 0; A.confirmLeave = false;
    A.screen = "menu"; A.err = msg || ""; save();
    if (S.view === "game" || S.view === "arena") { if (S.view !== "arena") go("arena"); else draw(true); }
  }
  async function sync() {
    if (!A.code || A.syncing) return;
    A.syncing = true; A.lastSync = Date.now();
    const st = A.st, p = A.play && st && st.round && A.play.n === st.round.n ? A.play : null;
    const body = { action: "sync", code: A.code, wn: A.wn || 0 };
    if (p && (p.started || p.f)) Object.assign(body, { n: p.n, p: p.pts, d: p.d, c: p.c, f: p.f ? 1 : 0 });
    const j = await call(body);
    A.syncing = false;
    if (j.error) return handleErr(j);
    apply(j);
  }
  function handleErr(j) {
    if (j.error === "no_room" || j.error === "not_member") return forget("Phòng không còn nữa (chủ phòng đã rời hoặc phòng đã đóng).");
    if (j.error === "store_limit") return forget(LIMIT_MSG);
    if (j.error === "auth") { ensureMe(); return; }
    show();
  }

  /* ---------- vẽ màn hình ---------- */
  function renderArena(v) { draw(true, v); }
  function inArena() { return S.view === "arena" || (S.view === "game" && ((G && G.arena === HOOKS) || !!(A.play && A.play.started && !A.play.f))); }
  function sigOf() {
    const st = A.st;
    if (A.screen !== "room" || !st) return A.screen + "|" + A.err + "|" + A.busy + "|" + A.net;
    const own = st.owner === st.me;
    return [A.screen, st.code, st.status, st.n, st.prep ? 1 : 0, st.owner, st.players.map((p) => p.pid + (p.online ? 1 : 0)).join(","),
      own ? "" : JSON.stringify(st.cfg) + st.level, (st.status === "results" || st.status === "final") ? JSON.stringify(st.totals) + (st.last ? st.last.n : "") : "",
      A.play ? A.play.n + ":" + A.play.f + ":" + (A.play.started ? 1 : 0) : "", st.status === "playing" && st.round && snow() < st.round.start ? "count" : "go",
      A.err, A.busy, A.confirmLeave ? 1 : 0, A.net ? 1 : 0].join("|");
  }
  function show() {
    if (S.view === "game" && G && G.arena === HOOKS) { updateBar(); return; }
    if (S.view !== "arena") return;
    const sig = sigOf();
    if (A.screen === "room" && isSb(A.st) && sig === A.sig && sbui()) { sbui().update(A.st); return; }   // Scrabble tự vẽ lại bàn cờ khi cần
    const focused = document.activeElement && document.activeElement.closest && document.activeElement.closest("#view") && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (sig !== A.sig && !focused) draw(true); else refresh();
  }
  function draw(full, v) {
    v = v || $("#view");
    if (!v || S.view !== "arena") return;
    A.sig = sigOf();
    v.innerHTML = A.screen === "join" ? joinHtml() : A.screen === "random" ? randomHtml() : A.screen === "sbmenu" ? sbMenuHtml() : A.screen === "room" ? roomHtml() : menuHtml();
    if (A.screen === "join") { const c = $("#ar-code"); if (c) try { c.focus({ preventScroll: true }); } catch {} }
    refresh();
  }
  function refresh() {
    const st = A.st;
    const rule = $("#ar-rule"); if (rule && st) rule.textContent = st.cfg.ruleText || "";
    const pl = $("#ar-players"); if (pl && st) pl.innerHTML = playersHtml(st);
    const bd = $("#ar-board"); if (bd && st) bd.innerHTML = boardHtml(st);
    const nb = $("#ar-net"); if (nb) nb.hidden = !A.net;
    tickUi();
  }
  const errHtml = () => (A.err ? `<div class="err" role="alert">${esc(A.err)}</div>` : "") + `<div class="note ar-net" id="ar-net" ${A.net ? "" : "hidden"}>Mất kết nối mạng, đang thử lại…</div>`;
  const head = (title, backAttr, backLabel) => `<div class="page-h"><button class="iconbtn" type="button" ${backAttr} aria-label="${esc(backLabel || "Quay lại")}">${ICON.back}</button><h1>${esc(title)}</h1></div>`;

  function menuHtml() {
    const m = meInfo();
    return `<div class="page arena">${head("Thi đấu", 'data-act="home"')}
      <p class="ar-who">Con thi với tên <b>${esc(m.icon)} ${esc(m.name)}</b>${m.grade ? " · " + esc(m.grade) : ""}</p>
      <div class="ar-cards">
        <button class="ar-card" type="button" data-arena="create" ${A.busy ? "disabled" : ""}><span class="ar-ic" aria-hidden="true">👫</span><b>${A.busy === "create" ? "Đang tạo phòng…" : "Tạo phòng thi với bạn"}</b><em>Con nhận mã 6 số để gửi cho bạn, rồi chọn trò, phạm vi từ và số phút.</em></button>
        <button class="ar-card" type="button" data-arena="joinform"><span class="ar-ic" aria-hidden="true">🔑</span><b>Vào phòng bằng mã</b><em>Bạn gửi cho con mã 6 số thì nhập vào đây.</em></button>
        <button class="ar-card" type="button" data-arena="randomform"><span class="ar-ic" aria-hidden="true">🎲</span><b>Thách đấu ngẫu nhiên</b><em>Chọn trình độ rồi chờ bạn cùng trình độ vào thi. Chờ 1 phút chưa có ai thì Bạn AI vào thi cùng.</em></button>
        <button class="ar-card" type="button" data-arena="sbmenu"><span class="ar-ic" aria-hidden="true">🔠</span><b>Scrabble</b><em>Bàn cờ thật 15×15, mỗi bạn 7 chữ, đi theo lượt. Chơi với Bạn AI ngay, hoặc mời bạn vào phòng.</em></button>
      </div>
      <p class="note">Không có ô trò chuyện: các bạn chỉ thấy tên và biểu tượng của nhau.</p>
      ${errHtml()}</div>`;
  }
  function sbMenuHtml() {
    const mins = A.sbMin || 20;
    return `<div class="page arena sb-menu">${head("Scrabble", 'data-arena="menu"')}
      <div class="ar-cards">
        <button class="ar-card" type="button" data-arena="solo" ${A.busy ? "disabled" : ""}><span class="ar-ic" aria-hidden="true">🤖</span><b>${A.busy === "solo" ? "Đang bày bàn cờ…" : "Chơi với Bạn AI"}</b><em>Bắt đầu ngay, con đi trước. Bạn AI luôn ghi rõ chữ AI và luôn để con thắng sát nút.</em></button>
        <button class="ar-card" type="button" data-arena="sbroom" ${A.busy ? "disabled" : ""}><span class="ar-ic" aria-hidden="true">👫</span><b>${A.busy === "sbroom" ? "Đang tạo phòng…" : "Tạo phòng Scrabble, mời bạn"}</b><em>Con nhận mã 6 số gửi cho bạn. 2–4 người, thêm được Bạn AI.</em></button>
        <button class="ar-card" type="button" data-arena="joinform"><span class="ar-ic" aria-hidden="true">🔑</span><b>Vào phòng bằng mã</b><em>Bạn gửi cho con mã 6 số thì nhập vào đây.</em></button>
      </div>
      <div class="sheet ar-set"><div class="field"><label for="sb-min">Thời gian cả ván</label><select id="sb-min" class="inp">${minuteOptions(mins, "scrabble")}</select></div></div>
      <section class="sheet"><div class="lbl">Luật chơi (như ngoài đời)</div>
        <ul class="sb-rules">
          <li>Bộ 100 quân: 98 chữ cái và 2 quân trắng (thay được mọi chữ, 0 điểm). Mỗi bạn có 7 chữ trên giá.</li>
          <li>Lần lượt đặt một từ tiếng Anh lên bàn 15×15. Lượt đầu đi qua ô ★ giữa bàn, các từ sau phải nối vào chữ đã có.</li>
          <li>Đặt xong, máy bốc thêm cho đủ 7 chữ. Bỏ lượt thì đổi cả 7 chữ.</li>
          <li>Điểm = điểm từng chữ × ô nhân điểm; đặt hết 7 chữ trong một lượt được thêm 50 điểm. Mỗi lượt tối đa 2 phút.</li>
          <li>Hết ván khi hết giờ, hết chữ, hoặc chủ phòng bấm kết thúc. Máy tính điểm và trao vương miện 👑.</li>
        </ul></section>
      ${errHtml()}</div>`;
  }
  function joinHtml() {
    return `<div class="page arena">${head("Vào phòng bằng mã", 'data-arena="menu"')}
      <div class="sheet"><div class="field"><label for="ar-code">Mã phòng (6 số)</label>
        <input id="ar-code" class="inp ar-codein" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••••"></div>
        <div class="row" style="margin-top:14px"><button class="btn primary" type="button" data-arena="join" ${A.busy ? "disabled" : ""}>${A.busy === "join" ? "Đang vào…" : "Vào phòng"}</button></div></div>
      ${errHtml()}</div>`;
  }
  function randomHtml() {
    const d = A.rnd || (A.rnd = { level: defaultLevel(), game: "bee", minutes: 2 });
    return `<div class="page arena">${head("Thách đấu ngẫu nhiên", 'data-arena="menu"')}
      <div class="sheet ar-set">
        <div class="field"><label for="ar-rlevel">Trình độ</label><select id="ar-rlevel" class="inp">${levelOptions(d.level)}</select></div>
        <div class="field"><label for="ar-rgame">Trò chơi</label><select id="ar-rgame" class="inp">${gameOptions(d.game)}</select></div>
        <div class="field"><label for="ar-rmin">Số phút</label><select id="ar-rmin" class="inp">${minuteOptions(d.minutes, d.game)}</select></div>
        <p class="muted small" style="margin:10px 0 0">Gặp bạn đang chờ sẵn thì chơi theo cách bạn ấy đã chọn. Từ do AI tạo theo trình độ, cả hai bạn chung một bộ từ.</p>
        <div class="row" style="margin-top:14px"><button class="btn primary" type="button" data-arena="random" ${A.busy ? "disabled" : ""}>${A.busy === "random" ? "Đang tìm…" : "🎲 Tìm bạn thi"}</button></div>
      </div>${errHtml()}</div>`;
  }
  function playersHtml(st) {
    const canEdit = isOwner() && ["lobby", "results"].includes(st.status);
    return st.players.map((p) => `<div class="ar-pl${p.online ? "" : " off"}${p.pid === st.me ? " me" : ""}"><span class="ar-ava" aria-hidden="true">${esc(p.icon)}</span><span class="ar-nm">${esc(p.name)}${p.pid === st.me ? " (con)" : ""}</span>${p.ai ? '<i class="ai-tag" title="Người chơi máy (AI)">AI</i>' : ""}${p.owner ? '<span class="ar-tag">Chủ phòng</span>' : ""}${p.online ? "" : '<span class="ar-tag off">mất kết nối</span>'}${p.ai && canEdit ? `<button class="btn sm ghost" type="button" data-arena="airm" data-ai="${esc(p.pid)}" aria-label="Bớt ${esc(p.name)}">Bớt</button>` : ""}</div>`).join("");
  }
  const aiAddHtml = (st) => (isOwner() && st.mode === "friends" && ["lobby", "results"].includes(st.status) && st.players.length < 8
    ? `<div class="row" style="margin-top:8px"><button class="btn sm" type="button" data-arena="aiadd" ${A.busy ? "disabled" : ""}>＋ Thêm Bạn AI</button><span class="muted small">Bạn AI luôn ghi rõ chữ AI và luôn để các bạn thắng.</span></div>` : "");
  const SB_NOTE = '<p class="muted small" style="margin:8px 0 0">Scrabble: bàn cờ chung 15×15, 2–4 người (tính cả Bạn AI), mỗi bạn 7 chữ, đi lần lượt. Từ là mọi từ tiếng Anh có trong từ điển. Mỗi lượt tối đa 2 phút.</p>';
  function settingsHtml(st) {
    if (!isOwner()) {
      if (st.cfg.game === "scrabble") {
        return `<section class="sheet ar-set"><div class="lbl">Cách chơi ván tới</div>
          <div class="ar-kv"><span>Trò chơi</span><b>Scrabble</b></div>
          <div class="ar-kv"><span>Thời gian cả ván</span><b>${st.cfg.minutes} phút</b></div>${SB_NOTE}</section>`;
      }
      return `<section class="sheet ar-set"><div class="lbl">Cách chơi ván tới</div>
        <div class="ar-kv"><span>Trò chơi</span><b>${esc(gameName(st.cfg.game))}</b></div>
        <div class="ar-kv"><span>Trình độ</span><b>${esc(levelLabel(st.level))}</b></div>
        <div class="ar-kv"><span>Phạm vi từ</span><b id="ar-rule">${esc(st.cfg.ruleText || "")}</b></div>
        <div class="ar-kv"><span>Thời gian</span><b>${st.cfg.minutes} phút</b></div></section>`;
    }
    const d = A.draft || { game: st.cfg.game, level: st.level, req: st.cfg.req || "", minutes: st.cfg.minutes };
    const sc = d.game === "scrabble";
    return `<section class="sheet ar-set"><div class="lbl">Cách chơi · con là chủ phòng</div>
      <div class="field"><label for="ar-game">Trò chơi</label><select id="ar-game" class="inp">${gameOptions(d.game)}</select></div>
      ${sc ? SB_NOTE : `<div class="field"><label for="ar-level">Trình độ</label><select id="ar-level" class="inp">${levelOptions(d.level)}</select></div>
      <div class="field"><label for="ar-req">Phạm vi từ (gõ yêu cầu)</label>
        <input id="ar-req" class="inp" maxlength="120" value="${esc(d.req)}" placeholder="Ví dụ: 10 từ mới nhất · Từ vựng sách lớp 7 · Động vật" autocomplete="off">
        <div class="ar-chips">${SUGGEST.map((s) => `<button type="button" class="ar-sug" data-arena-sug="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        <div class="ar-rule" id="ar-rule">${esc(st.cfg.ruleText || "")}</div></div>`}
      <div class="field"><label for="ar-min">${sc ? "Thời gian cả ván" : "Số phút mỗi ván"}</label><select id="ar-min" class="inp">${minuteOptions(d.minutes, d.game)}</select></div>
    </section>`;
  }
  function leaveHtml() {
    if (A.confirmLeave) return `<div class="confirm"><span style="flex:1;min-width:200px">${isOwner() ? "Con là chủ phòng: rời phòng thì phòng đóng lại, mã này không dùng được nữa." : "Rời phòng này?"}</span><button class="btn sm danger" type="button" data-arena="leaveyes">Rời phòng</button><button class="btn sm" type="button" data-arena="leaveno">Ở lại</button></div>`;
    return `<div class="row"><button class="btn ghost" type="button" data-arena="leave">${isOwner() ? "Rời phòng (đóng phòng)" : "Rời phòng"}</button></div>`;
  }
  function roomHtml() {
    const st = A.st;
    if (!st) return `<div class="page arena">${head("Thi đấu", 'data-arena="away"', "Ra trang chính, vẫn giữ phòng")}<div class="working" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>Đang vào phòng…</div>${errHtml()}</div>`;
    if (st.status === "waiting") return waitingHtml(st);
    if (isSb(st) && sbui()) return sbui().html(st);   // Scrabble: bàn cờ chung
    if (st.status === "playing") return playingHtml(st);
    if (st.status === "results") return resultsHtml(st);
    if (st.status === "final") return finalHtml(st);
    if (st.status === "closed") return `<div class="page arena">${head("Thi đấu", 'data-arena="menu"')}<div class="sheet"><b>Phòng ${esc(st.code)} đã đóng.</b><p class="muted">${st.closedBy ? esc(st.closedBy) + " (chủ phòng) đã rời phòng." : ""}</p><button class="btn primary" type="button" data-arena="menu">Về Thi đấu</button></div></div>`;
    return lobbyHtml(st);
  }
  function codeHtml(st) {
    return st.mode === "random" ? "" : `<div class="ar-code"><span class="lbl">Mã phòng</span><b class="ar-digits">${esc(st.code.slice(0, 3) + " " + st.code.slice(3))}</b><button class="btn sm" type="button" data-arena="copy">Sao chép mã</button></div>`;
  }
  function startHtml(st, again) {
    if (!isOwner()) return `<div class="note">${st.prep ? "Chủ phòng đang nhờ AI chuẩn bị bộ từ…" : again ? "Chờ chủ phòng chọn ván tiếp theo…" : "Chờ chủ phòng bắt đầu…"}</div>`;
    const sc = st.cfg.game === "scrabble", two = st.players.length >= 2, many = sc && st.players.length > 4;
    const label = A.busy === "start" ? (!sc && st.cfg.rule && st.cfg.rule.scope === "common" ? "AI đang chuẩn bị bộ từ…" : "Đang bắt đầu…") : again ? "▶ Ván tiếp theo" : "▶ Bắt đầu";
    return `<div class="row"><button class="btn primary" type="button" data-arena="start" ${two && !many && !A.busy ? "" : "disabled"}>${label}</button>${again ? `<button class="btn" type="button" data-arena="finish" ${A.busy ? "disabled" : ""}>🏁 Kết thúc &amp; trao vương miện</button>` : ""}</div>
      ${!two ? `<p class="muted small" style="margin:0">Cần ít nhất 2 người. Gửi mã phòng cho bạn${st.mode === "friends" ? " hoặc thêm Bạn AI" : ""} nhé!</p>` : many ? '<p class="muted small" style="margin:0">Scrabble chơi tối đa 4 người (tính cả Bạn AI). Bớt Bạn AI hoặc chọn trò khác nhé.</p>' : ""}`;
  }
  function lobbyHtml(st) {
    return `<div class="page arena">${head(st.mode === "random" ? "Thách đấu" : "Phòng thi", 'data-arena="away"', "Ra trang chính, vẫn giữ phòng")}
      ${codeHtml(st)}
      ${st.mode === "random" ? "" : `<p class="muted small" style="margin:0">Gửi mã cho bạn để vào phòng. Mã giữ nguyên tới khi ${isOwner() ? "con" : "chủ phòng"} rời phòng.</p>`}
      <section class="sheet"><div class="lbl">Người chơi · ${st.players.length}/8</div><div id="ar-players" class="ar-players">${playersHtml(st)}</div>${aiAddHtml(st)}</section>
      ${settingsHtml(st)}${startHtml(st, false)}${leaveHtml()}${errHtml()}</div>`;
  }
  function waitingHtml(st) {
    return `<div class="page arena">${head("Thách đấu ngẫu nhiên", 'data-arena="leaveyes"', "Huỷ tìm")}
      <div class="sheet ar-wait"><div class="ar-spin" aria-hidden="true">🎲</div>
        <b>Đang tìm bạn · ${esc(levelLabel(st.level))}</b>
        <div class="ar-clock" id="ar-wait">0:00</div>
        <p class="muted small" id="ar-waitnote" style="margin:0"></p>
        <p class="muted small" style="margin:0">Trò ${esc(gameName(st.cfg.game))} · ${st.cfg.minutes} phút. Bạn AI luôn có ghi chữ <i class="ai-tag">AI</i> bên tên.</p>
        <button class="btn" type="button" data-arena="leaveyes">Huỷ tìm</button></div>${errHtml()}</div>`;
  }
  function boardRows(st) {
    const sc = st.scores || {};
    return st.players.map((p) => {
      const mine = p.pid === st.me && A.play && st.round && A.play.n === st.round.n;
      const s = sc[p.pid] || {};
      return { pid: p.pid, name: p.name, icon: p.icon, ai: p.ai, me: p.pid === st.me, online: p.online, p: mine ? A.play.pts : Number(s.p) || 0, f: mine ? A.play.f : s.f };
    }).sort((a, b) => b.p - a.p || (a.ai - b.ai));
  }
  function boardHtml(st) {
    return boardRows(st).map((r, i) => `<div class="ar-row${r.me ? " me" : ""}"><span class="pos">${i + 1}</span><span class="ar-ava" aria-hidden="true">${esc(r.icon)}</span><span class="ar-nm">${esc(r.name)}${r.ai ? '<i class="ai-tag">AI</i>' : ""}</span>${r.f ? '<span class="ar-tag">xong</span>' : ""}<span class="pts">${r.p} điểm</span></div>`).join("");
  }
  function playingHtml(st) {
    const r = st.round, p = A.play, sn = snow();
    const info = `<div class="ar-rinfo">Ván ${r.n} · <b>${esc(gameName(r.game))}</b> · ${r.minutes} phút</div><div class="muted small">${esc(r.ruleText || "")}</div>`;
    if (sn < r.start) return `<div class="page arena"><div class="ar-count"><div class="lbl">Chuẩn bị</div><div class="ar-big" id="ar-count">${Math.max(1, Math.ceil((r.start - sn) / 1000))}</div>${info}</div><section class="ar-board" id="ar-board">${boardHtml(st)}</section>${errHtml()}</div>`;
    if (p && p.f) return `<div class="page arena"><div class="sheet ar-done"><b>${esc(p.msg || "Con đã xong ván này!")}</b><span class="muted small">Còn</span><div class="ar-clock" id="ar-left">${fmtClock(r.end - sn)}</div><p class="muted small" style="margin:0">Chờ các bạn khác xong hoặc hết giờ là có kết quả.</p></div><section class="ar-board" id="ar-board">${boardHtml(st)}</section>${errHtml()}</div>`;
    return `<div class="page arena"><div class="ar-count">${info}<div class="working" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>Vào ván…</div></div>${errHtml()}</div>`;
  }
  function resultsHtml(st) {
    const last = st.last || { rank: [] };
    const rows = last.rank.map((r, i) => `<div class="ar-row${r.pid === st.me ? " me" : ""}"><span class="pos">${r.p > 0 && r.place <= 3 ? MEDAL[r.place - 1] : r.place}</span><span class="ar-ava" aria-hidden="true">${esc(r.i)}</span><span class="ar-nm">${esc(r.n)}${r.ai ? '<i class="ai-tag">AI</i>' : ""}</span><span class="pts">${r.p} điểm</span></div>`).join("");
    const top = last.game === "scrabble" && sbui() ? sbui().resultsTop(st)
      : `<section class="sheet"><div class="lbl">Ván ${last.n || st.n} · ${esc(gameName(last.game || st.cfg.game))}</div><div class="ar-board" style="margin-top:8px">${rows}</div></section>`;
    return `<div class="page arena">${head("Kết quả ván " + (last.n || st.n), 'data-arena="away"', "Ra trang chính, vẫn giữ phòng")}
      ${codeHtml(st)}
      ${top}
      <section class="sheet"><div class="lbl">Tổng điểm cả buổi</div><div class="ar-board" style="margin-top:8px">${totalsHtml(st)}</div></section>
      ${isOwner() ? `<section class="sheet"><div class="lbl">Người chơi · ${st.players.length}/8</div><div id="ar-players" class="ar-players">${playersHtml(st)}</div>${aiAddHtml(st)}</section>` : ""}
      ${isOwner() ? settingsHtml(st) : ""}${startHtml(st, true)}${leaveHtml()}${errHtml()}</div>`;
  }
  function totalRows(st) {
    return st.players.map((p) => ({ ...p, t: Number((st.totals || {})[p.pid]) || 0 })).sort((a, b) => b.t - a.t || (a.ai - b.ai));
  }
  function totalsHtml(st) {
    return totalRows(st).map((r, i) => `<div class="ar-row${r.pid === st.me ? " me" : ""}"><span class="pos">${i + 1}</span><span class="ar-ava" aria-hidden="true">${esc(r.icon)}</span><span class="ar-nm">${esc(r.name)}${r.ai ? '<i class="ai-tag">AI</i>' : ""}</span><span class="pts">${r.t} điểm</span></div>`).join("");
  }
  function finalHtml(st) {
    const rows = totalRows(st), top = rows.length ? rows[0].t : 0;
    const win = top > 0 ? rows.filter((r) => r.t === top && !r.ai) : [];
    const meWin = win.some((r) => r.pid === st.me);
    return `<div class="page arena ar-final">${head("Tổng kết buổi thi", 'data-arena="away"', "Ra trang chính, vẫn giữ phòng")}
      <div class="sheet ar-champ">${win.length ? `<div class="ar-crown" aria-hidden="true">👑</div><div class="ar-winner">${win.map((w) => esc(w.icon + " " + w.name)).join(" &amp; ")}</div><p style="margin:0">${meWin ? "Con là nhà vô địch buổi thi! 🎉" : "Vô địch buổi thi! 🎉"}</p>` : "<b>Chưa bạn nào ghi điểm.</b>"}</div>
      <section class="sheet"><div class="lbl">Bảng tổng điểm</div><div class="ar-board" style="margin-top:8px">${totalsHtml(st)}</div></section>
      ${isOwner() ? `<div class="row"><button class="btn primary" type="button" data-arena="again" ${A.busy ? "disabled" : ""}>Chơi buổi mới</button></div>` : '<div class="note">Chủ phòng có thể mở buổi mới, con cứ ở lại phòng nhé.</div>'}
      ${leaveHtml()}${errHtml()}</div>`;
  }
  function tickUi() {
    const st = A.st;
    if (!st) return;
    const sn = snow();
    if (st.status === "playing" && st.round) {
      const c = $("#ar-count");
      if (c) { const s = Math.max(0, Math.ceil((st.round.start - sn) / 1000)); c.textContent = String(Math.max(1, s)); if (s !== A.lastCount) { A.lastCount = s; if (s > 0 && s <= 3) SFX.play("tap"); } }
      const lf = $("#ar-left"); if (lf) lf.textContent = fmtClock(st.round.end - sn);
    }
    if (st.status === "waiting") {
      const el = sn - Number(st.waitStart || sn), w = $("#ar-wait"), note = $("#ar-waitnote");
      if (w) w.textContent = fmtClock(el);
      if (note) note.textContent = el < WAIT_AI ? `Chưa có bạn thì Bạn AI vào thi sau ${Math.ceil((WAIT_AI - el) / 1000)} giây.` : "Bạn AI đang vào thi…";
    }
  }

  /* ---------- chơi: nhiều lượt nối nhau cho tới hết giờ ---------- */
  function ownWords(rule) {
    const map = new Map(), today = dayNum();
    for (const set of S.sets || []) {
      const st = statsFor(set.id).words, setDay = dayNum(set.createdAt || set.updatedAt || Date.now());
      for (const w of set.words || []) {
        const k = norm(w.w), rec = st[k];
        const learned = rec && rec.f != null ? rec.f : setDay, h = (rec && rec.h) || "";
        const prev = map.get(k);
        if (!prev) map.set(k, { w, learned, h });
        else { prev.h += h; if (learned < prev.learned) prev.learned = learned; }
      }
    }
    let arr = [...map.values()];
    const wrong = (x) => [...x.h].filter((c) => c === "0").length, acc = (x) => x.h ? [...x.h].filter((c) => c === "1").length / x.h.length : 1;
    if (rule.order === "newest") arr.sort((a, b) => b.learned - a.learned);
    else if (rule.order === "oldest") arr.sort((a, b) => a.learned - b.learned);
    else if (rule.order === "longest") arr.sort((a, b) => onlyLetters(b.w.w).length - onlyLetters(a.w.w).length);
    else if (rule.order === "shortest") arr.sort((a, b) => onlyLetters(a.w.w).length - onlyLetters(b.w.w).length);
    else if (rule.order === "weak") arr.sort((a, b) => wrong(b) - wrong(a) || acc(a) - acc(b));
    else if (rule.order === "ago") { const T = today - Number(rule.days || 0); arr.sort((a, b) => Math.abs(a.learned - T) - Math.abs(b.learned - T)); }
    else arr = shuffle(arr);
    return arr.slice(0, Math.max(1, Number(rule.count) || 10)).map((x) => x.w);
  }
  function setupPlay(r) {
    const own = r.rule && r.rule.scope === "own";
    const words = own ? ownWords(r.rule) : (A.words[r.n] || []);
    const seen = new Set(), pool = [];
    for (const w of words) { const k = norm(w.w); if (!k || seen.has(k)) continue; seen.add(k); pool.push(w); }
    A.play = { n: r.n, game: r.game, start: r.start, end: r.end, level: r.level, pool, queue: [], pts: 0, d: 0, c: 0, f: 0, sec: 0, started: false, msg: "",
      setName: r.setName || (own ? "Từ của con" : "Thi đấu"), topic: (r.rule && r.rule.topic) || r.setName || "" };
  }
  function batch(def) {
    const p = A.play, ok = (w) => !def.filter || def.filter(w);
    let pool = p.pool.filter(ok);
    if (pool.length < Math.max(def.min, 1)) {          // kho từ ít quá: thêm từ trong bộ mẫu
      const have = new Set(pool.map((w) => norm(w.w)));
      pool = pool.concat(SAMPLE_SET.words.filter((w) => ok(w) && !have.has(norm(w.w))));
    }
    if (pool.length < Math.max(def.min, 1)) return null;
    const out = [], used = new Set(), want = Math.min(def.count, pool.length);
    let guard = 0;
    while (out.length < want && guard++ < 500) {
      if (!p.queue.length) p.queue = shuffle(pool.slice());
      const w = p.queue.shift(), k = norm(w.w);
      if (used.has(k)) continue;
      used.add(k); out.push(w);
    }
    return out.length >= def.min ? out : null;
  }
  function beginPlay() {
    const p = A.play;
    if (!p || p.f || S.view === "game" && G && G.arena === HOOKS) return;
    const def = GAMES[p.game], words = def && batch(def);
    const fail = () => { p.f = 1; p.started = true; p.msg = "Kho từ của con chưa có từ hợp với trò này nên ván này con được 0 điểm. Ván sau thử trò khác nhé!"; if (S.view === "game") go("arena"); else draw(true); sync(); };
    if (!words) return fail();
    p.started = true;
    const set = { id: "__arena", name: p.setName, words: p.pool.length ? p.pool : words, virtual: true, level: p.level, topic: p.topic };
    startGame(p.game, { words, set, max: def.count, arena: HOOKS });
    if (!G || G.arena !== HOOKS) return fail();
    addBar();
  }
  function addBar() {
    const gm = $("#view .game");
    if (!gm || gm.querySelector(".arena-bar")) return;
    gm.insertAdjacentHTML("afterbegin", '<div class="arena-bar" id="ar-bar"></div>');
    updateBar();
  }
  function updateBar() {
    const el = $("#ar-bar");
    if (!el || !A.st || !A.play) return;
    const left = A.play.end - snow();
    el.innerHTML = `<span class="ab-time${left < 15000 ? " hot" : ""}">⏱ ${fmtClock(left)}</span>` + boardRows(A.st).map((r) => `<span class="ab-p${r.me ? " me" : ""}">${esc(r.icon)} ${esc(short(r.name))}${r.ai ? '<i class="ai-tag">AI</i>' : ""} <b>${r.p}</b></span>`).join("");
  }
  HOOKS.onRecord = function (ctx, w, credit) {
    const p = A.play;
    if (!p || p.f || ctx.arena !== HOOKS) return;
    p.d++;
    if (credit >= 1) { p.c++; p.pts += 10; } else if (credit > 0) p.pts += 5;
    updateBar();
  };
  HOOKS.onPlayDone = function (ctx, extra, sec) {
    const p = A.play;
    if (!p || ctx.arena !== HOOKS) return;
    p.sec += sec || 0;
    if (p.f) return;
    if (snow() < p.end - 2500) setTimeout(beginPlay, 0);
    else endPlay("Hết giờ!");
  };
  HOOKS.quit = function () { endPlay("Con đã dừng ván này."); };
  function endPlay(msg, silent) {
    const p = A.play;
    if (!p || p.f) return;
    if (G && G.arena === HOOKS) { studyStep(); p.sec += Math.round(STUDY.sec); leaveGame(); }
    p.f = 1; p.msg = msg || "";
    if (p.d || p.sec) ontapPost({ action: "session", game: p.game, total: p.d, correct: p.c, seconds: Math.round(p.sec) });
    if (S.view === "game") go("arena");
    if (!silent) sync();
    show();
  }

  /* ---------- đồng hồ: đếm ngược, tự vào ván, hết giờ, hỏi máy chủ định kỳ ---------- */
  function startTimer() { if (!A.timer) A.timer = setInterval(tick, 250); }
  function tick() {
    if (!inArena()) { clearInterval(A.timer); A.timer = 0; return; }
    const st = A.st, now = Date.now();
    if (A.screen !== "room" || !st || !A.code) return;
    if (isSb(st)) {   // Scrabble: không chơi trò riêng — chỉ cập nhật đồng hồ, bàn cờ do máy chủ gửi về
      if (S.view === "arena") { if (A.sig !== sigOf()) show(); else { tickUi(); if (sbui()) sbui().tick(st); } }
    } else if (st.status === "playing" && st.round) {
      const r = st.round, sn = snow();
      if ((!A.play || A.play.n !== r.n) && (A.words[r.n] !== undefined || (r.rule && r.rule.scope === "own"))) { setupPlay(r); show(); }
      const p = A.play;
      if (p && p.n === r.n && !p.f) {
        if (sn >= r.end) endPlay("Hết giờ!");
        else if (sn >= r.start && !p.started && S.view === "arena") beginPlay();
      }
      if (S.view === "arena") { if (A.sig !== sigOf()) show(); else tickUi(); } else updateBar();
    } else if (st.status === "waiting") {
      tickUi();
      const el = snow() - Number(st.waitStart || 0);
      if (el >= WAIT_AI && now - A.aiAsked > 4000) { A.aiAsked = now; askAI(); }
      else if (el < WAIT_AI - 4000 && now - A.lastSearch > A.searchGap) { A.lastSearch = now; A.searchGap = 4000 + Math.random() * 3000; research(); }
    }
    const iv = st.status === "playing" ? SYNC_PLAY : SYNC_IDLE;
    if (!A.syncing && now - A.lastSync >= iv) sync();
  }
  async function research() {
    const st = A.st;
    if (!st || st.status !== "waiting" || A.syncing) return;
    A.syncing = true;
    const j = await call({ action: "random", prev: A.code, level: st.level, game: st.cfg.game, minutes: st.cfg.minutes });
    A.syncing = false; A.lastSync = Date.now();
    if (j.error) return handleErr(j);
    apply(j);
  }
  async function askAI() {
    if (!A.code || A.syncing) return;
    A.syncing = true;
    const j = await call({ action: "ai", code: A.code });
    A.syncing = false; A.lastSync = Date.now();
    if (j.ok) apply(j);
  }

  /* ---------- cài đặt của chủ phòng: gửi sau khi con ngừng sửa 0,5 giây ---------- */
  function scheduleConfig() { clearTimeout(A.cfgT); A.cfgT = setTimeout(sendConfig, 500); }
  async function sendConfig() {
    A.cfgT = 0;
    if (!isOwner() || !A.draft) return;
    const d = A.draft;
    const j = await call({ action: "config", code: A.code, game: d.game, level: d.level, minutes: d.minutes, req: d.req });
    if (j.ok) { A.st = j; refresh(); }
  }
  async function flushConfig() { if (A.cfgT) { clearTimeout(A.cfgT); await sendConfig(); } }

  /* ---------- nút bấm ---------- */
  async function act(a, el) {
    if (a === "open") return open();
    if (a === "sbhome") return open("sbmenu");   // thẻ Scrabble ở trang chính (đang ở phòng thì vào lại phòng)
    if (a === "menu") { if (A.st && A.st.status === "closed") forget(""); A.screen = "menu"; A.err = ""; return draw(true); }
    if (a === "sbmenu") { A.screen = "sbmenu"; A.err = ""; return draw(true); }
    if (a === "solo" || a === "sbroom") {
      // Scrabble với Bạn AI (bắt đầu ngay) / phòng Scrabble mời bạn (tạo phòng rồi chọn sẵn Scrabble)
      if (A.busy) return;
      A.busy = a; A.err = ""; draw(true);
      if (!(await ensureMe())) { A.busy = ""; A.err = connErr(); return draw(true); }
      const mins = A.sbMin || 20;
      let j = await call(a === "solo" ? { action: "solo", minutes: mins } : { action: "create", level: defaultLevel() });
      if (a === "sbroom" && j.ok && j.code) j = await call({ action: "config", code: j.code, game: "scrabble", minutes: mins });
      A.busy = "";
      if (j.ok && j.code) { A.play = null; A.draft = null; apply(j); startTimer(); draw(true); }
      else { A.err = j.error === "slow_down" ? "Con mở nhiều phòng quá, đợi một lúc rồi thử lại nhé." : j.error === "store_limit" ? LIMIT_MSG : "Chưa mở được bàn cờ. Kiểm tra mạng rồi thử lại."; draw(true); }
      return;
    }
    if (a === "aiadd" || a === "airm") {
      if (A.busy || !isOwner()) return;
      A.busy = a; draw(true);
      await flushConfig();
      const j = await call(a === "aiadd" ? { action: "ai_add", code: A.code } : { action: "ai_remove", code: A.code, ai: el && el.dataset.ai });
      A.busy = "";
      if (j.ok && j.code) apply(j); else A.err = j.error === "full" ? "Phòng đã đủ 8 người." : "Chưa làm được. Thử lại nhé.";
      return draw(true);
    }
    if (a === "joinform") { A.screen = "join"; A.err = ""; return draw(true); }
    if (a === "randomform") { A.screen = "random"; A.err = ""; return draw(true); }
    if (a === "away") { go("home"); return; }
    if (a === "copy") {
      const code = A.code;
      try { await navigator.clipboard.writeText(code); toast("Đã sao chép mã phòng " + code); } catch { toast("Mã phòng: " + code); }
      return;
    }
    if (a === "create") {
      if (A.busy) return;
      A.busy = "create"; A.err = ""; draw(true);
      if (!(await ensureMe())) { A.busy = ""; A.err = connErr(); return draw(true); }
      const j = await call({ action: "create", level: defaultLevel() });
      A.busy = "";
      if (j.ok) { A.play = null; A.draft = null; apply(j); startTimer(); draw(true); }
      else { A.err = j.error === "slow_down" ? "Con tạo nhiều phòng quá, đợi một lúc rồi thử lại nhé." : j.error === "store_limit" ? LIMIT_MSG : "Chưa tạo được phòng. Kiểm tra mạng rồi thử lại."; draw(true); }
      return;
    }
    if (a === "join") {
      const code = String(($("#ar-code") || {}).value || "").replace(/\D/g, "");
      if (code.length !== 6) { A.err = "Mã phòng gồm 6 chữ số."; return draw(true); }
      if (A.busy) return;
      A.busy = "join"; A.err = ""; draw(true);
      if (!(await ensureMe())) { A.busy = ""; A.err = connErr(); return draw(true); }
      const j = await call({ action: "join", code });
      A.busy = "";
      if (j.ok) { A.play = null; A.draft = null; apply(j); startTimer(); draw(true); }
      else { A.err = { no_room: "Không thấy phòng này. Con kiểm tra lại mã 6 số nhé.", full: "Phòng đã đủ 8 bạn rồi.", random_room: "Đây là phòng thách đấu ngẫu nhiên, không vào bằng mã được.", network: "Mất kết nối mạng. Thử lại nhé.", store_limit: LIMIT_MSG }[j.error] || "Chưa vào được phòng. Thử lại nhé."; draw(true); const c = $("#ar-code"); if (c) c.value = code; }
      return;
    }
    if (a === "random") {
      if (A.busy) return;
      const d = A.rnd || {};
      A.busy = "random"; A.err = ""; draw(true);
      if (!(await ensureMe())) { A.busy = ""; A.err = connErr(); return draw(true); }
      const j = await call({ action: "random", level: d.level, game: d.game, minutes: d.minutes });
      A.busy = "";
      if (j.ok) { A.play = null; A.draft = null; A.aiAsked = 0; A.lastSearch = Date.now(); apply(j); startTimer(); draw(true); }
      else { A.err = j.error === "slow_down" ? "Con tìm nhiều lần quá, đợi một lúc nhé." : j.error === "store_limit" ? LIMIT_MSG : "Chưa tìm được. Kiểm tra mạng rồi thử lại."; draw(true); }
      return;
    }
    if (a === "start") {
      if (A.busy || !isOwner()) return;
      A.busy = "start"; A.err = ""; draw(true);
      await flushConfig();
      const j = await call({ action: "start", code: A.code });
      A.busy = "";
      if (j.ok) apply(j);
      else A.err = { need_two: "Cần ít nhất 2 bạn trong phòng. Gửi mã phòng cho bạn nhé!", busy: "Ván đang diễn ra.", slow_down: "Bắt đầu nhiều ván quá, đợi một lúc nhé.", store_limit: LIMIT_MSG }[j.error] || "Chưa bắt đầu được. Thử lại nhé.";
      return draw(true);
    }
    if (a === "finish" || a === "again") {
      if (A.busy || !isOwner()) return;
      A.busy = a; draw(true);
      const j = await call({ action: a, code: A.code });
      A.busy = "";
      if (j.ok) apply(j); else A.err = j.error === "store_limit" ? LIMIT_MSG : "Chưa làm được. Thử lại nhé.";
      return draw(true);
    }
    if (a === "leave") { A.confirmLeave = true; return draw(true); }
    if (a === "leaveno") { A.confirmLeave = false; return draw(true); }
    if (a === "leaveyes") {
      const code = A.code;
      if (code) await call({ action: "leave", code });
      forget("");
      draw(true);
    }
  }
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const sug = t.closest("[data-arena-sug]");
    if (sug && A.draft) {
      const v = sug.dataset.arenaSug, req = v === "Để AI chọn chủ đề" ? "" : v;
      A.draft.req = req;
      const inp = $("#ar-req"); if (inp) inp.value = req;
      scheduleConfig();
      return;
    }
    const b = t.closest("[data-arena]");
    if (b) act(b.dataset.arena, b);
  });
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!t || !t.id) return;
    if (t.id === "sb-min") { A.sbMin = Number(t.value) || 20; return; }
    if (A.rnd && (t.id === "ar-rlevel" || t.id === "ar-rgame" || t.id === "ar-rmin")) {
      if (t.id === "ar-rlevel") A.rnd.level = t.value;
      else if (t.id === "ar-rgame") {
        const sw = (t.value === "scrabble") !== (A.rnd.game === "scrabble");
        A.rnd.game = t.value;
        if (sw) { A.rnd.minutes = t.value === "scrabble" ? 20 : 2; draw(true); }   // Scrabble chơi lâu hơn: đổi bảng số phút
      } else A.rnd.minutes = Number(t.value) || 2;
      return;
    }
    if (!A.draft) return;
    if (t.id === "ar-game") {
      const sw = (t.value === "scrabble") !== (A.draft.game === "scrabble");
      A.draft.game = t.value;
      if (sw) { A.draft.minutes = t.value === "scrabble" ? 20 : 3; scheduleConfig(); try { t.blur(); } catch {} draw(true); return; }
    }
    else if (t.id === "ar-level") A.draft.level = t.value;
    else if (t.id === "ar-min") A.draft.minutes = Number(t.value) || 3;
    else return;
    scheduleConfig();
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t && t.id === "ar-req" && A.draft) { A.draft.req = t.value; scheduleConfig(); }
    if (t && t.id === "ar-code") t.value = t.value.replace(/\D/g, "").slice(0, 6);
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key !== "Enter" || !t) return;
    if (t.id === "ar-code") { e.preventDefault(); act("join"); }
    else if (t.id === "ar-req") { e.preventDefault(); flushConfig(); t.blur(); }
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && A.code && inArena()) sync(); });

  window.Arena = { init, entryHtml, render: renderArena, open, quit: () => HOOKS.quit(), _A: A };
})();
