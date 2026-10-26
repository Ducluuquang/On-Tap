/* Ôn Tập: SCRABBLE trong phần Thi đấu (chốt 24/10/2026 — "như ngoài đời").
   Bàn 15×15 chung cho cả phòng, mỗi bạn 7 chữ; đặt từ xong máy bốc thêm cho đủ 7; bỏ lượt = đổi cả 7 chữ.
   Máy chủ (/api/arena) giữ bàn, túi chữ, giá chữ và chấm điểm; trang này chỉ vẽ bàn và gửi nước đi.
   Cách đặt chữ: chạm một chữ trên giá rồi chạm ô trên bàn — hoặc chạm ô trên bàn trước (hiện mũi tên → / ↓,
   chạm lại để đổi chiều) rồi chạm lần lượt các chữ, chữ tự nối tiếp nhau. Chạm chữ vừa đặt để lấy lại.
   Máy tính: gõ chữ, Backspace, Enter (đặt từ), phím cách (đổi chiều). */
(function () {
  "use strict";
  const N = 15;
  const VAL = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, "?": 0 };
  // ô nhân điểm — giống hệt máy chủ (api/_scrabble/engine.mjs)
  const PREM = (() => {
    const P = new Array(225).fill("");
    const put = (t, list) => { for (const [r, c] of list) P[r * N + c] = t; };
    put("tw", [[0, 0], [0, 7], [0, 14], [7, 0], [7, 14], [14, 0], [14, 7], [14, 14]]);
    put("dw", [[1, 1], [2, 2], [3, 3], [4, 4], [1, 13], [2, 12], [3, 11], [4, 10], [13, 1], [12, 2], [11, 3], [10, 4], [13, 13], [12, 12], [11, 11], [10, 10]]);
    put("tl", [[1, 5], [1, 9], [5, 1], [5, 5], [5, 9], [5, 13], [9, 1], [9, 5], [9, 9], [9, 13], [13, 5], [13, 9]]);
    put("dl", [[0, 3], [0, 11], [2, 6], [2, 8], [3, 0], [3, 7], [3, 14], [6, 2], [6, 6], [6, 8], [6, 12], [7, 3], [7, 11], [8, 2], [8, 6], [8, 8], [8, 12], [11, 0], [11, 7], [11, 14], [12, 6], [12, 8], [14, 3], [14, 11]]);
    P[112] = "st";
    return P;
  })();
  const LBL = { tw: "×3", dw: "×2", tl: "×3", dl: "×2", st: "★" };
  const REASON = { time: "Hết giờ", owner: "Chủ phòng kết thúc ván", passes: "Ai cũng bỏ lượt 2 lần liền", out: "Đã hết chữ" };
  const shuffleArr = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  window.ArenaScrabble = function (api) {
    // api: { st(), call(body), apply(json), snow(), fmtClock(ms), isOwner(), short(name), redraw() }
    const U = { key: "", rack: "", order: [], placed: [], sel: -1, cur: -1, dir: 0, busy: false, msg: "", cls: "", blank: null, confirm: "", sig: "", sec: 0, lastAct: 0, posted: "" };
    const sbOf = (st) => (st && st.round && st.round.game === "scrabble" ? st.round.sb : null);
    const pl = (st, pid) => st.players.find((p) => p.pid === pid);
    const nameOf = (st, pid) => { const p = pl(st, pid); return p ? p.name : "Bạn đã rời phòng"; };
    const started = (st) => api.snow() >= st.round.start;
    const myTurn = (st) => { const sb = sbOf(st); return !!sb && !sb.over && sb.order[sb.turn] === st.me && started(st); };
    const inGame = (st) => { const sb = sbOf(st); return !!sb && sb.rack != null; };
    const active = () => S.view === "arena" && !!document.getElementById("sbp");

    function reset() { Object.assign(U, { key: "", rack: "", order: [], placed: [], sel: -1, cur: -1, dir: 0, busy: false, msg: "", cls: "", blank: null, confirm: "", sig: "" }); }
    // trạng thái mới từ máy chủ: giá chữ đổi (đặt từ xong, bỏ lượt, hết giờ lượt) thì lấy giá mới; chữ đặt thử
    // nằm trên ô vừa có chữ của bạn khác thì trả về giá.
    function syncLocal(st) {
      const sb = sbOf(st);
      if (!sb) return;
      const key = st.code + ":" + st.round.n;
      if (U.key !== key) { reset(); U.key = key; U.sec = 0; U.lastAct = 0; }
      if (sb.rack != null && sb.rack !== U.rack) { U.rack = sb.rack; U.order = [...sb.rack].map((_, k) => k); U.placed = []; U.sel = -1; U.blank = null; }
      U.placed = U.placed.filter((p) => sb.board[p.i] === ".");
      if (U.cur >= 0 && sb.board[U.cur] !== ".") U.cur = -1;
    }
    function study() {   // thời gian học: mỗi lần con chạm/gõ cộng khoảng thời gian từ lần trước, tối đa 60 giây (giống Ôn Tập)
      const n = Date.now();
      if (U.lastAct) U.sec += Math.min(60, Math.max(0, (n - U.lastAct) / 1000));
      U.lastAct = n;
    }
    const setMsg = (m, c) => { U.msg = m || ""; U.cls = c || ""; const el = document.getElementById("sb-msg"); if (el) { el.textContent = U.msg; el.className = "sb-msg " + U.cls; } };

    /* ---------- vẽ ---------- */
    const tileHtml = (ch, cls) => {
      const blank = ch >= "a" && ch <= "z", L = ch.toUpperCase();
      return `<span class="t${blank ? " bl" : ""}${cls ? " " + cls : ""}">${L}${blank ? "" : `<i>${VAL[L]}</i>`}</span>`;
    };
    function boardHtml(sb, mini) {
      const last = new Set(sb.last || []), pend = new Map(U.placed.map((p) => [p.i, p]));
      let out = "";
      for (let i = 0; i < 225; i++) {
        const ch = sb.board[i], pm = PREM[i];
        if (ch !== ".") { out += `<div class="sbc f" ${mini ? "" : `data-sbc="${i}"`}>${tileHtml(ch, !mini && last.has(i) ? "last" : "")}</div>`; continue; }
        const p = !mini && pend.get(i);
        if (p) { out += `<button type="button" class="sbc f" data-sbc="${i}" aria-label="Lấy lại chữ ${p.l}">${tileHtml(p.b ? p.l.toLowerCase() : p.l, "pend")}</button>`; continue; }
        if (mini) { out += `<div class="sbc ${pm}"></div>`; continue; }
        const cur = i === U.cur ? ` cur ${U.dir ? "dn" : "rt"}` : "";
        out += `<button type="button" class="sbc ${pm}${cur}" data-sbc="${i}" aria-label="Ô hàng ${Math.floor(i / N) + 1} cột ${(i % N) + 1}${pm ? " " + ({ tw: "nhân 3 cả từ", dw: "nhân 2 cả từ", tl: "nhân 3 chữ", dl: "nhân 2 chữ", st: "ô giữa, nhân 2 cả từ" }[pm]) : ""}">${cur ? `<span class="arw">${U.dir ? "↓" : "→"}</span>` : pm ? LBL[pm] : ""}</button>`;
      }
      return out;
    }
    function rackHtml() {
      const used = new Set(U.placed.map((p) => p.k));
      return U.order.map((k) => {
        const ch = U.rack[k];
        if (used.has(k)) return '<span class="rk gone" aria-hidden="true"></span>';
        return `<button type="button" class="rk${U.sel === k ? " sel" : ""}${ch === "?" ? " bl" : ""}" data-sbr="${k}" aria-label="${ch === "?" ? "Quân trắng (thay được mọi chữ)" : "Chữ " + ch}">${ch === "?" ? "" : ch}<i>${VAL[ch]}</i></button>`;
      }).join("") || '<span class="muted small">Giá chữ trống</span>';
    }
    function playersHtml(st, sb) {
      const turnPid = sb.order[sb.turn], left = (st.round.turnMs || 120000) - (api.snow() - Math.max(st.round.start, sb.turnStart));
      return sb.order.map((pid) => {
        const p = pl(st, pid), on = !sb.over && pid === turnPid && started(st);
        return `<div class="sb-pl${on ? " turn" : ""}${pid === st.me ? " me" : ""}${p ? "" : " gone"}"><span class="ic" aria-hidden="true">${esc(p ? p.icon : "👋")}</span><span class="nm">${esc(api.short(p ? p.name : "Đã rời"))}${p && p.ai ? '<i class="ai-tag">máy</i>' : ""}</span><b class="pts">${sb.scores[pid] || 0}</b>${on ? `<span class="tm" id="sb-turn">${api.fmtClock(left)}</span>` : ""}</div>`;
      }).join("");
    }
    function statusHtml(st, sb) {
      if (!inGame(st)) return "Con đang xem ván này (con vào phòng sau khi ván đã bắt đầu). Ván sau con sẽ được chơi cùng.";
      const pid = sb.order[sb.turn], p = pl(st, pid);
      if (myTurn(st)) return U.placed.length ? "Tới lượt con! Đặt xong thì bấm “Đặt từ”." : "Tới lượt con! Chạm một chữ trên giá rồi chạm ô trên bàn.";
      if (p && p.ai) return `${esc(p.name)} đang nghĩ…`;
      return `Đang chờ ${esc(p ? p.name : "bạn")} đặt từ… Con cứ xếp thử chữ trên bàn trước.`;
    }
    // các từ chính của một lượt (m.m = số từ chính khi ghép nhiều từ cùng lúc), còn lại là từ phụ
    const mainWords = (m) => (m.w || []).slice(0, m.m || 1), sideWords = (m) => (m.w || []).slice(m.m || 1);
    function logHtml(st, sb) {
      const rows = (sb.moves || []).slice(-6).reverse().map((m) => {
        const who = esc(nameOf(st, m.p)), side = sideWords(m);
        if (m.k === "play") return `<li><b>${who}</b> đặt <span class="w">${esc(mainWords(m).join(", "))}</span>${side.length ? ` <span class="muted">(+ ${esc(side.join(", "))})</span>` : ""} <b class="pl">+${m.s}</b>${m.bingo ? ' <span class="bingo">hết 7 chữ +50!</span>' : ""}</li>`;
        const why = m.k === "time" ? "hết giờ lượt" : m.k === "away" ? "vắng mặt" : "bỏ lượt";
        return `<li><b>${who}</b> ${why}${m.x ? `, đổi ${m.x} chữ` : ""}</li>`;
      });
      return rows.length ? `<ol class="sb-log">${rows.join("")}</ol>` : "";
    }
    const legendHtml = () => '<div class="sb-legend"><span><b class="tw"></b>×3 cả từ</span><span><b class="dw"></b>×2 cả từ</span><span><b class="tl"></b>×3 chữ</span><span><b class="dl"></b>×2 chữ</span></div>';
    function html(st) {
      syncLocal(st);
      const sb = sbOf(st), r = st.round, sn = api.snow();
      U.sig = sigOf(st);
      if (sn < r.start) {
        return `<div class="page arena sbp" id="sbp"><div class="ar-count"><div class="lbl">Scrabble · Ván ${r.n}</div><div class="ar-big" id="ar-count">${Math.max(1, Math.ceil((r.start - sn) / 1000))}</div>
          <div class="ar-rinfo">Thứ tự đi: ${sb.order.map((pid, k) => `${k + 1}. ${esc(nameOf(st, pid))}`).join(" · ")}</div>
          <p class="muted small" style="margin:0">Mỗi bạn 7 chữ. Đặt chữ lên bàn ghép thành từ, một lượt ghép được nhiều từ nối liền nhau (lượt đầu qua ô ★), rồi bốc thêm cho đủ 7. Bỏ lượt = đổi cả 7 chữ. Mỗi lượt tối đa ${Math.round((r.turnMs || 120000) / 60000)} phút.</p></div></div>`;
      }
      const mine = myTurn(st), me = inGame(st);
      const acts = !me ? "" : `<div class="sb-acts">
          <button class="btn primary" type="button" data-sb="play" ${mine && U.placed.length && !U.busy ? "" : "disabled"}>${U.busy ? "Đang kiểm tra…" : "✔ Đặt từ"}</button>
          <button class="btn" type="button" data-sb="recall" ${U.placed.length ? "" : "disabled"}>↩ Thu lại</button>
          <button class="btn" type="button" data-sb="shuffle">🔀 Xáo</button>
          <button class="btn ghost" type="button" data-sb="pass" ${mine && !U.busy ? "" : "disabled"}>Bỏ lượt (đổi chữ)</button></div>`;
      const confirm = U.confirm === "pass" ? `<div class="confirm"><span style="flex:1;min-width:200px">Bỏ lượt này và đổi cả ${U.rack.length} chữ trên giá?</span><button class="btn sm danger" type="button" data-sb="passyes">Bỏ lượt, đổi chữ</button><button class="btn sm" type="button" data-sb="no">Thôi</button></div>`
        : U.confirm === "end" ? '<div class="confirm"><span style="flex:1;min-width:200px">Kết thúc ván Scrabble bây giờ? Máy tính điểm và trao vương miện ngay.</span><button class="btn sm danger" type="button" data-sb="endyes">Kết thúc ván</button><button class="btn sm" type="button" data-sb="no">Chơi tiếp</button></div>' : "";
      const blank = U.blank ? `<div class="sb-blankpick"><div class="lbl">Quân trắng này làm chữ gì?</div><div class="sb-blank">${"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => `<button type="button" data-sbl="${L}">${L}</button>`).join("")}</div><button class="btn sm ghost" type="button" data-sb="noblank">Thôi</button></div>` : "";
      return `<div class="page arena sbp" id="sbp">
        <div class="sb-top"><button class="iconbtn" type="button" data-arena="away" aria-label="Ra trang chính, vẫn giữ phòng">${ICON.back}</button><span class="sb-t">Scrabble</span><span class="sb-chip" id="sb-clock" title="Thời gian còn lại của ván">⏱ ${api.fmtClock(r.end - sn)}</span><span class="sb-chip" title="Số chữ còn trong túi" aria-label="Còn ${sb.bag} chữ trong túi">🎒 ${sb.bag}</span></div>
        <div class="sb-pls" id="sb-pls">${playersHtml(st, sb)}</div>
        <div class="sb-st${mine ? " mine" : ""}" id="sb-st">${statusHtml(st, sb)}</div>
        <div class="sb-board" id="sb-board" role="grid" aria-label="Bàn Scrabble 15 x 15">${boardHtml(sb, false)}</div>
        <div class="sb-msg ${U.cls}" id="sb-msg" aria-live="polite">${esc(U.msg)}</div>
        ${blank}
        ${me ? `<div class="sb-rack" id="sb-rack" aria-label="Giá chữ của con">${rackHtml()}</div>` : ""}
        ${acts}${confirm}
        ${api.isOwner() && U.confirm !== "end" ? '<div class="row" style="justify-content:center"><button class="btn sm ghost" type="button" data-sb="end">🏁 Kết thúc ván</button></div>' : ""}
        ${logHtml(st, sb)}
        ${legendHtml()}
        ${api.leaveHtml()}
      </div>`;
    }
    function draw() { const st = api.st(); const v = $("#view"); if (!st || !v || !active()) return; v.innerHTML = html(st); }
    function sigOf(st) {
      const sb = sbOf(st);
      return sb ? [sb.v, sb.turn, sb.over, sb.bag, st.players.map((p) => p.pid).join(","), api.snow() < st.round.start ? "count" : "go", api.isOwner() ? 1 : 0].join("|") : "";
    }
    // trạng thái mới: chỉ vẽ lại khi bàn/lượt đổi (không làm mất chữ con đang đặt thử)
    function update(st) {
      if (!active()) return;
      syncLocal(st);
      if (sigOf(st) !== U.sig) draw(); else tick(st);
    }
    function tick(st) {
      const sb = sbOf(st);
      if (!sb || !active()) return;
      const sn = api.snow(), r = st.round;
      const c = document.getElementById("ar-count");
      if (c) { if (sn >= r.start) { draw(); return; } c.textContent = String(Math.max(1, Math.ceil((r.start - sn) / 1000))); return; }
      const ck = document.getElementById("sb-clock");
      if (ck) { ck.textContent = "⏱ " + api.fmtClock(r.end - sn); ck.classList.toggle("hot", r.end - sn < 60000); }
      const tm = document.getElementById("sb-turn");
      if (tm) { const left = (r.turnMs || 120000) - (sn - Math.max(r.start, sb.turnStart)); tm.textContent = api.fmtClock(left); tm.classList.toggle("hot", left < 20000); }
    }

    /* ---------- đặt chữ ---------- */
    function advance(i) {
      const sb = sbOf(api.st());
      let j = i;
      for (;;) {
        if (U.dir === 0) { if (j % N === N - 1) { U.cur = -1; return; } j += 1; } else { j += N; if (j >= 225) { U.cur = -1; return; } }
        if (sb.board[j] === "." && !U.placed.some((p) => p.i === j)) { U.cur = j; return; }
      }
    }
    // Hai cách đặt: (1) chạm chữ trên giá rồi chạm ô; (2) chạm ô trống trước (hiện mũi tên), rồi chạm/gõ lần lượt các chữ —
    // chữ đặt tại mũi tên và mũi tên tự đi tiếp (bỏ qua ô đã có chữ).
    function placeAt(i, k, letter) {
      const ch = U.rack[k];
      if (ch === "?" && !letter) { U.blank = { i, k, cur: U.cur === i }; U.sel = -1; draw(); return; }
      const viaCursor = U.blank ? U.blank.cur : U.cur === i;
      U.placed.push({ i, k, l: ch === "?" ? letter : ch, b: ch === "?" ? 1 : 0 });
      U.sel = -1; U.blank = null;
      if (viaCursor) advance(i); else U.cur = -1;
      setMsg("", "");
      SFX.play("tap");
      draw();
    }
    function tapCell(i) {
      const sb = sbOf(api.st());
      const k = U.placed.findIndex((p) => p.i === i);
      if (k >= 0) { U.placed.splice(k, 1); draw(); return; }   // chạm chữ vừa đặt: trả về giá
      if (sb.board[i] !== ".") return;
      if (U.sel >= 0) { U.cur = -1; placeAt(i, U.sel); return; }
      if (U.cur === i) U.dir = 1 - U.dir; else U.cur = i;
      draw();
    }
    function tapRack(k) {
      if (U.placed.some((p) => p.k === k)) return;
      const sb = sbOf(api.st());
      if (U.cur >= 0 && sb.board[U.cur] === "." && !U.placed.some((p) => p.i === U.cur)) { placeAt(U.cur, k); return; }
      U.sel = U.sel === k ? -1 : k;
      draw();
    }
    async function send(body) {
      const st = api.st(), g = api.gen();
      const req = () => api.call(Object.assign({ code: st.code, n: st.round.n }, body));
      let j = await req();
      if (j && j.error === "busy" && api.gen() === g) { await new Promise((r) => setTimeout(r, 700)); if (api.gen() === g) j = await req(); }
      if (api.gen() !== g) return { error: "gone" };   // con đã rời phòng trong lúc chờ máy chủ: bỏ qua câu trả lời
      return j || { error: "network" };
    }
    async function play() {
      const st = api.st();
      if (!st || !U.placed.length || U.busy) return;
      if (!myTurn(st)) { setMsg("Chưa tới lượt của con.", "bad"); return; }
      U.busy = true; setMsg("", ""); draw();
      const j = await send({ action: "sb_move", tiles: U.placed.map((p) => ({ i: p.i, l: p.l, b: p.b })) });
      U.busy = false;
      if (j.error === "gone") return;
      if (!j.error) {
        const sb = j.round && j.round.sb, m = sb && sb.moves && sb.moves[sb.moves.length - 1];
        U.placed = []; U.cur = -1;
        if (m && m.p === st.me && m.k === "play") setMsg(`${mainWords(m).join(", ")} +${m.s} điểm!${m.bingo ? " Đặt hết 7 chữ, thưởng 50!" : ""}`, "good");
        SFX.play("ok");
        api.apply(j); draw();
        return;
      }
      SFX.play("bad");
      setMsg(j.msg || (j.error === "network" ? "Mất kết nối mạng. Thử lại nhé." : "Chưa đặt được. Thử lại nhé."), "bad");
      if (j.ok && j.code) api.apply(j);
      draw();
    }
    async function pass() {
      U.confirm = ""; U.busy = true; draw();
      const j = await send({ action: "sb_pass" });
      U.busy = false;
      if (j.error === "gone") return;
      if (!j.error) { setMsg("Con đã bỏ lượt và đổi chữ mới.", ""); api.apply(j); draw(); return; }
      setMsg(j.msg || "Chưa bỏ lượt được. Thử lại nhé.", "bad");
      if (j.ok && j.code) api.apply(j);
      draw();
    }
    async function end() {
      U.confirm = ""; U.busy = true; draw();
      const j = await send({ action: "sb_end" });
      U.busy = false;
      if (j.error === "gone") return;
      if (j.ok && j.code) api.apply(j);
      else { setMsg("Chưa kết thúc được. Thử lại nhé.", "bad"); draw(); }
    }
    document.addEventListener("click", (e) => {
      if (!active()) return;
      const t = e.target;
      if (!t || !t.closest) return;
      const cell = t.closest("[data-sbc]"), rk = t.closest("[data-sbr]"), bl = t.closest("[data-sbl]"), b = t.closest("[data-sb]");
      if (!cell && !rk && !bl && !b) return;
      study();
      if (cell) return tapCell(+cell.dataset.sbc);
      if (rk) return tapRack(+rk.dataset.sbr);
      if (bl && U.blank) { const { i, k } = U.blank; return placeAt(i, k, bl.dataset.sbl); }
      const a = b.dataset.sb;
      if (a === "play") play();
      else if (a === "recall") { U.placed = []; U.sel = -1; draw(); }
      else if (a === "shuffle") { U.order = shuffleArr(U.order); draw(); }
      else if (a === "pass") { U.confirm = "pass"; draw(); }
      else if (a === "passyes") pass();
      else if (a === "end") { U.confirm = "end"; draw(); }
      else if (a === "endyes") end();
      else if (a === "no") { U.confirm = ""; draw(); }
      else if (a === "noblank") { U.blank = null; draw(); }
    });
    document.addEventListener("keydown", (e) => {
      if (!active() || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const st = api.st();
      if (!inGame(st)) return;
      const k = e.key;
      study();
      if (/^[a-zA-Z]$/.test(k)) {
        if (U.cur < 0) return;
        const L = k.toUpperCase(), free = (r) => !U.placed.some((p) => p.k === r);
        let r = U.order.find((x) => U.rack[x] === L && free(x));
        e.preventDefault();
        if (r != null) placeAt(U.cur, r);
        else { r = U.order.find((x) => U.rack[x] === "?" && free(x)); if (r != null) placeAt(U.cur, r, L); }
      } else if (k === "Backspace") { const p = U.placed.pop(); if (p) { e.preventDefault(); U.cur = p.i; draw(); } }
      else if (k === "Enter") { e.preventDefault(); play(); }
      else if (k === " ") { e.preventDefault(); U.dir = 1 - U.dir; draw(); }
      else if (k === "Escape") { U.placed = []; U.blank = null; U.confirm = ""; draw(); }
    });

    /* ---------- hết ván: kết quả + vương miện; ghi buổi chơi vào báo cáo Ôn Tập ---------- */
    // vương miện: bạn thật nhiều điểm nhất (người chơi máy "Bạn ONTAP" không nhận vương miện); bằng điểm thì cùng nhận
    const crownOf = (rank) => { const hs = rank.filter((x) => !x.ai), top = hs.length ? Math.max(...hs.map((x) => x.p)) : 0; return top > 0 ? hs.filter((x) => x.p === top) : []; };
    function finish(prev, cur) {
      const key = prev.code + ":" + (prev.round && prev.round.n);
      if (U.posted === key) return;
      U.posted = key;
      const words = ((cur.last && cur.last.sb && cur.last.sb.words) || {})[cur.me] || [];
      const sec = Math.round(U.sec);
      if (words.length || sec) ontapPost({ action: "session", game: "scrabble", total: words.length, correct: words.length, seconds: sec });
      const rank = (cur.last && cur.last.rank) || [];
      const winners = crownOf(rank);
      SFX.play(winners.some((x) => x.pid === cur.me) ? "win" : "tap");
      reset();
    }
    // con rời phòng giữa ván: vẫn ghi các từ đã đặt và thời gian đã chơi vào báo cáo Ôn Tập (giống các trò khác)
    function quit(st) {
      const sb = sbOf(st);
      if (!sb) return;
      const key = st.code + ":" + st.round.n;
      if (U.posted === key) return;
      U.posted = key;
      const words = (sb.words || {})[st.me] || [];
      const sec = U.key === key ? Math.round(U.sec) : 0;
      if (words.length || sec) ontapPost({ action: "session", game: "scrabble", total: words.length, correct: words.length, seconds: sec });
      reset();
    }
    function resultsTop(st) {
      const last = st.last || {}, rank = last.rank || [], sbl = last.sb || {};
      const winners = crownOf(rank);
      const meWin = winners.some((x) => x.pid === st.me);
      const rows = rank.map((x) => {
        const adj = x.adj ? (x.adj > 0 ? ` <span class="muted small">(${x.base} + ${x.adj} chữ của bạn)</span>` : ` <span class="muted small">(${x.base} − ${-x.adj} chữ còn lại)</span>`) : "";
        return `<div class="ar-row${x.pid === st.me ? " me" : ""}"><span class="pos">${x.p > 0 && x.place <= 3 ? ["🥇", "🥈", "🥉"][x.place - 1] : x.place}</span><span class="ar-ava" aria-hidden="true">${esc(x.i)}</span><span class="ar-nm">${esc(x.n)}${x.ai ? '<i class="ai-tag">máy</i>' : ""}</span><span class="pts">${x.p} điểm${adj}</span></div>`;
      }).join("");
      const words = rank.map((x) => { const w = (sbl.words || {})[x.pid] || []; return w.length ? `<div><b>${esc(x.n)}:</b> ${w.map((s) => `<span class="w">${esc(s)}</span>`).join(", ")}</div>` : ""; }).join("");
      return `<section class="sheet ar-champ sb-res">${winners.length ? `<div class="ar-crown" aria-hidden="true">👑</div><div class="ar-winner">${winners.map((w) => esc(w.i + " " + w.n)).join(" &amp; ")}</div><p style="margin:0">${meWin ? "Con thắng ván Scrabble! 🎉" : "thắng ván Scrabble! 🎉"}</p>` : "<b>Ván này chưa ai ghi điểm.</b>"}
        <div class="muted small">Ván ${last.n} · ${esc(REASON[sbl.reason] || "Hết ván")}</div></section>
        <section class="sheet"><div class="lbl">Điểm ván Scrabble</div><div class="ar-board" style="margin-top:8px">${rows}</div></section>
        ${sbl.board ? `<section class="sheet"><div class="lbl">Bàn cờ cuối ván</div><div class="sb-board mini">${boardHtml({ board: sbl.board, last: [] }, true)}</div>${words ? `<div class="sb-words">${words}</div>` : ""}</section>` : ""}`;
    }
    return { html, update, tick, finish, quit, resultsTop, reset, study };
  };
})();
