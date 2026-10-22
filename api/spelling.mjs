// Ôn Tập: máy chủ AI cho "Vở Spelling" — trò chơi từ vựng chạy bên trong Ôn Tập (chốt 22/10/2026).
// Chép từ api/ai.js của app Vở Spelling (thư mục On tap\Vocab), GIỮ NGUYÊN lời dặn AI và cách trả lời;
// chỉ khác: viết kiểu ES module như các file khác của Ôn Tập, và BỎ phần tài khoản (Upstash) vì trong
// Ôn Tập con không đăng nhập riêng. Khoá ANTHROPIC_API_KEY nằm ở máy chủ, trình duyệt không bao giờ thấy.
// GET  /api/spelling -> { ok, ai }  (trang kiểm tra máy chủ có khoá AI chưa)
// POST /api/spelling -> trả lời của AI, gửi dần từng đoạn chữ (mỗi dòng một JSON)
// (LEVELS, promptTopic, API_URL, DEFAULT_MODEL cũng được api/arena.mjs — phần Thi đấu — dùng chung.)
"use strict";
/* ---------- Prompts (shared by the page and the server) ---------- */
/* Levels: Vietnam's school stages, then the CEFR / IELTS bands, up to SAT/GRE.
   The school stages follow the 2018 curriculum targets (end of primary A1, lower secondary A2, upper secondary B1).
   kids: the list is for a child, so "advanced" words must stay child-friendly and sentences stay short. */
export const LEVELS = [
  { id: "k12", group: "school", label: "Lớp 1–2 · mới bắt đầu", kids: true, who: "child",
    desc: "young beginners aged 6–8 (pre-A1): very common, concrete, short words (mostly 3–6 letters)" },
  { id: "k35", group: "school", label: "Lớp 3–5 · tiểu học (A1)", kids: true, who: "child",
    desc: "primary pupils aged 8–11 (CEFR A1): common everyday words, mostly 4–9 letters" },
  { id: "k69", group: "school", label: "Lớp 6–9 · THCS (A2)", kids: true, who: "student",
    desc: "lower-secondary students aged 11–15 (CEFR A2): everyday and school words, up to about 12 letters" },
  { id: "k1012", group: "school", label: "Lớp 10–12 · THPT (B1)", who: "student",
    desc: "upper-secondary students aged 15–18 (CEFR B1, the level of Vietnam's national graduation exam): useful topic words for reading, discussion and writing, beyond basic everyday words" },
  { id: "b2", group: "intl", label: "B2 · IELTS 5.5–6.5", who: "learner",
    desc: "upper-intermediate learners (CEFR B2, IELTS 5.5–6.5): topic vocabulary for discussing ideas, news and opinions; skip basic words they already know" },
  { id: "c1", group: "intl", label: "C1 · IELTS 7.0–8.0", who: "learner",
    desc: "advanced learners (CEFR C1, IELTS 7.0–8.0): precise, less common words used in academic and professional English; skip everyday words" },
  { id: "c2", group: "intl", label: "C2 · IELTS 8.5–9.0", who: "learner",
    desc: "proficient learners (CEFR C2, IELTS 8.5–9.0): sophisticated, nuanced, low-frequency words that educated native speakers use in quality writing; skip anything a B2 learner would already know" },
  { id: "top", group: "intl", label: "Cao nhất · SAT, GRE", who: "learner",
    desc: "the most advanced learners, preparing for the SAT or GRE or reading literature and academic journals: rare, sophisticated words of the kind found on GRE word lists; skip anything a C1 learner would already know" },
];
const LEVEL_GROUPS = [["school", "Theo lớp ở trường"], ["intl", "Nâng cao · chuẩn quốc tế"]];
const LINE_FMT = '{"w":"elephant","vi":"con voi","ex":"The elephant has a long trunk.","e":"🐘"}';

/* kind: "common" (the most common words, easiest first), "advanced" (harder words) or "idioms".
   avoid: words the list already has, so a follow-up batch only brings new ones. */
const KIND_ASK = {
  common: "different English words for this topic at these learners' level, choosing the most common and useful ones first",
  advanced: "more advanced English words for this topic: less common, richer vocabulary that a strong learner at this level could learn next",
  idioms: "English idioms or fixed expressions related to this topic that these learners can understand and use",
};
export function promptTopic(topic, level, count, kind, avoid) {
  kind = KIND_ASK[kind] ? kind : "common";
  const idioms = kind === "idioms", kids = !!level.kids;
  const ask = KIND_ASK[kind] + (kids && kind === "advanced" ? ", still suitable for children" : "") + (kids && idioms ? " (common ones)" : "");
  const lines = [
    kids ? "You are helping a Vietnamese parent build an English spelling list for a " + level.who + "."
      : "You are helping a Vietnamese " + level.who + " build an English vocabulary and spelling list.",
    "Topic (may be written in Vietnamese or English): " + JSON.stringify(topic),
    "Learners: " + level.desc + ".",
    (idioms ? "List up to " : "List exactly ") + count + " " + ask + ".",
    idioms
      ? '- "w" is the idiom exactly as native speakers say it, e.g. "a piece of cake" or "sour grapes": lowercase, no ending punctuation, and no added "a" or "the" unless it is part of the idiom. Only real, well-known idioms; if this topic has fewer good ones, list fewer.'
      : "- Use correct standard spelling (American English) with plain letters a-z (cafe, naive, not café, naïve). Single words are best; use a two-word phrase only when it is the normal name of the thing.",
    "- Lowercase, except words that are always capitalized (days, months, countries).",
    idioms ? '- "vi" is a short, natural Vietnamese meaning of the idiom.'
      : kids ? '- "vi" is a short, natural Vietnamese meaning (1-4 words).'
      : '- "vi" is a short, natural Vietnamese meaning (1-6 words) for the sense used in this topic.',
    kids ? '- "ex" is one short, simple English sentence that uses it (at most 12 words).'
      : '- "ex" is one natural English sentence that uses it the way it is typically used (at most 18 words).',
    '- "e" is one emoji that pictures it, or "" if none fits.',
  ];
  if (avoid && avoid.length) lines.push("- The list already has these, so do not repeat any of them: " + avoid.join(", "));
  lines.push(
    "Write one JSON object per line and nothing else: no numbering, no code fences, no comments.",
    'First line: {"name":"<short name for this list, 1-4 words, in the language the topic was written in>"}',
    "Then one line per item, like:",
    idioms ? '{"w":"a piece of cake","vi":"dễ như ăn bánh","ex":"The spelling test was a piece of cake.","e":"🍰"}' : LINE_FMT,
  );
  return lines.join("\n");
}
function promptEnrich(items) {
  return [
    "A Vietnamese learner (or a parent, for a child) typed this English spelling list. For every item below, in the same order, write one JSON object per line and nothing else (no numbering, no code fences):",
    '{"orig":"<the item exactly as typed>","w":"<the word with correct standard English spelling>","vi":"<short Vietnamese meaning, 1-4 words>","ex":"<one short simple English sentence using the word, max 12 words>","e":"<one emoji picturing the word, or empty>"}',
    "Rules:",
    '- If an item is a clear misspelling of an English word, put the correct spelling in "w". Otherwise copy it unchanged into "w" (keep capital letters of proper nouns). Use plain letters a-z (naive, not naïve).',
    '- If a Vietnamese meaning is given after "|", use it as "vi".',
    '- Start with one extra line: {"name":"<short name for this list, 1-4 words>"}',
    "Items:",
    ...items.map((it, i) => (i + 1) + ". " + it.w + (it.vi ? " | " + it.vi : "")),
  ].join("\n");
}
function promptPhoto() {
  return [
    "This photo shows a page from a Vietnamese learner's English notebook, worksheet or textbook (often a child's). Find the English vocabulary being learned on this page: word lists, vocabulary boxes, words written with Vietnamese meanings. Skip instructions, page numbers, people's names and full sentences.",
    "Write one JSON object per line and nothing else (no numbering, no code fences).",
    'First line: {"name":"<short name for this list, e.g. the unit or lesson title, max 5 words>"}',
    "Then one line per word (at most 30), like:",
    LINE_FMT,
    "- Use the Vietnamese meaning printed on the page when there is one; otherwise write a short natural one.",
    "- Fix obvious handwriting or OCR mistakes so every word has its correct standard spelling.",
    '- "ex" is one short simple English sentence using the word (max 10 words); "e" is one emoji or "".',
    'If the photo has no English words to learn, write only: {"error":"no_words"}',
  ].join("\n");
}
/* "Từ theo ngữ cảnh": a fresh sentence per word, written so the word can be hidden and still guessed. */
function promptContext(items, level) {
  const kids = !!level.kids;
  return [
    "You are writing fill-in-the-blank sentences for an English vocabulary game for a Vietnamese learner. The game hides the item and the learner must guess it from the sentence and type it.",
    "Learners: " + level.desc + ".",
    "For every item below, in the same order, write one JSON object per line and nothing else (no numbering, no code fences):",
    '{"w":"<the item exactly as given>","ex":"<one English sentence>"}',
    "Rules for each sentence:",
    "- Use the item exactly once, written exactly as given: same spelling and same form (do not add -s, -ed or -ing, do not change the words of an idiom).",
    "- Give strong context clues, so that a learner who knows the item can tell it is the only natural fit for the gap: what it does, where it is found, what it looks or feels like, or when people use it.",
    "- Do not define it word for word, and do not put a synonym or a translation right next to it.",
    "- Use the sense given by the Vietnamese meaning, when there is one.",
    kids ? "- Short, simple and concrete, at most 12 words." : "- Natural English at these learners' level, at most 22 words.",
    "Items:",
    ...items.map((it, i) => (i + 1) + ". " + it.w + (it.vi ? "  (meaning: " + it.vi + ")" : "")),
  ].join("\n");
}
/* "Trang trọng hay thân mật": pairs with the same meaning, one informal and one formal. */
function promptRegister(topic, words, count, level) {
  const kids = !!level.kids;
  return [
    'You are making a "formal or informal?" game for a Vietnamese learner of English.',
    "Topic of the learner's word list: " + JSON.stringify(topic),
    "Learners: " + level.desc + ".",
    words.length ? "Words in the list (use one when it has a natural formal or informal partner): " + words.join(", ") : "",
    "Write " + count + " pairs of English expressions that mean the same thing: one informal (what friends and family say) and one formal (what you write in an essay, an exam or an official letter).",
    kids
      ? "These are young learners: use simple, clear pairs such as mom / mother, kids / children, thanks / thank you, TV / television, a lot of / many."
      : "Good pairs are like buy / purchase, find out / discover, a lot of / a great deal of, cut down on / reduce. Choose pairs that are useful for this topic and level.",
    "Write one JSON object per line and nothing else (no numbering, no code fences):",
    '{"inf":"<informal expression>","fml":"<formal expression>","vi":"<short Vietnamese meaning>","exi":"<casual sentence>","exf":"<formal sentence>"}',
    "Rules:",
    "- Each expression is a word or a short phrase (at most 4 words) in plain letters a-z, lowercase unless it is always capitalized.",
    "- The difference in register must be clear and the two must really mean the same in these sentences.",
    '- "exi" is a natural, casual sentence using the informal expression exactly as written; "exf" is a formal sentence using the formal expression exactly as written.',
    kids ? "- Short, simple sentences, at most 10 words." : "- Sentences of at most 18 words.",
    "- No rude slang, nothing unsuitable for children, and no expression used twice.",
  ].filter(Boolean).join("\n");
}

/* ---------- Shared server helpers ---------- */
const MAX_BODY = 4400000;

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  let b = req.body;
  if (Buffer.isBuffer(b)) b = b.toString("utf8");
  if (typeof b === "string") return JSON.parse(b || "{}");
  if (b && typeof b === "object") return b;
  const chunks = [];
  let size = 0;
  for await (const ch of req) {
    size += ch.length;
    if (size > MAX_BODY) { const e = new Error("too_large"); e.code = "too_large"; throw e; }
    chunks.push(ch);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const clean = (v, n) => String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, n);

/* ---------- Server ---------- */
export const API_URL = "https://api.anthropic.com/v1/messages";
export const DEFAULT_MODEL = "claude-sonnet-5-5";

/* The page sends what it needs ("topic", "enrich", "photo"); the prompt is always built here,
   so the endpoint cannot be used as a general chat proxy for the API key. */
function buildRequest(b) {
  const mode = String((b && b.mode) || "");
  if (mode === "topic") {
    const topic = clean(b.topic, 80);
    if (!topic) return { error: "bad_request" };
    const level = LEVELS.find(l => l.id === b.level) || LEVELS[1];
    const n = Math.round(Number(b.count));
    const count = n >= 1 && n <= 25 ? n : 15;
    const kind = KIND_ASK[b.kind] ? b.kind : "common";
    let avoid = (Array.isArray(b.avoid) ? b.avoid : []).slice(0, 400).map(x => clean(x, 40)).filter(Boolean);
    while (avoid.join(", ").length > 8000) avoid = avoid.slice(1);
    return { maxTokens: 5000, content: promptTopic(topic, level, count, kind, avoid) };
  }
  if (mode === "enrich") {
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 80)
      .map(it => ({ w: clean(it && it.w, 40), vi: clean(it && it.vi, 60) }))
      .filter(it => it.w);
    if (!items.length) return { error: "bad_request" };
    return { maxTokens: 10000, content: promptEnrich(items) };
  }
  if (mode === "context") {
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 20)
      .map(it => ({ w: clean(it && it.w, 40), vi: clean(it && it.vi, 80) }))
      .filter(it => it.w);
    if (!items.length) return { error: "bad_request" };
    const level = LEVELS.find(l => l.id === b.level) || LEVELS[1];
    return { maxTokens: 3000, content: promptContext(items, level) };
  }
  if (mode === "register") {
    const level = LEVELS.find(l => l.id === b.level) || LEVELS[1];
    const n = Math.round(Number(b.count));
    const count = n >= 1 && n <= 12 ? n : 8;
    const words = (Array.isArray(b.words) ? b.words : []).slice(0, 40).map(x => clean(x, 40)).filter(Boolean);
    return { maxTokens: 3000, content: promptRegister(clean(b.topic, 80) || "everyday English", words, count, level) };
  }
  if (mode === "photo") {
    const img = (b && b.image) || {};
    const type = String(img.media_type || "");
    const data = String(img.data || "");
    if (!/^image\/(jpeg|png|webp|gif)$/.test(type) || !data || data.length > MAX_BODY || !/^[A-Za-z0-9+/]+=*$/.test(data.slice(0, 400))) {
      return { error: "bad_image" };
    }
    return {
      maxTokens: 5000,
      content: [
        { type: "image", source: { type: "base64", media_type: type, data } },
        { type: "text", text: promptPhoto() },
      ],
    };
  }
  return { error: "bad_request" };
}

function mapError(e) {
  const s = e.status || 0, t = String(e.type || ""), m = String(e.message || "");
  if (/credit balance|billing/i.test(m)) return [402, "no_credit"];
  if (s === 401 || s === 403 || t === "authentication_error" || t === "permission_error") return [502, "bad_key"];
  if (s === 404 || t === "not_found_error") return [502, "model"];
  if (s === 429 || t === "rate_limit_error") return [429, "rate_limited"];
  if (s === 529 || t === "overloaded_error") return [503, "overloaded"];
  if (s === 413 || t === "request_too_large") return [413, "too_large"];
  if (s === 400 || t === "invalid_request_error") return [400, "bad_request"];
  return [502, "upstream"];
}

async function callClaude(content, maxTokens, signal) {
  const models = [...new Set([process.env.ANTHROPIC_MODEL, DEFAULT_MODEL].map(x => String(x || "").trim()).filter(Boolean))];
  let last = null;
  for (const model of models) {
    const r = await fetch(API_URL, {
      method: "POST",
      signal,
      headers: {
        "x-api-key": String(process.env.ANTHROPIC_API_KEY).trim(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, messages: [{ role: "user", content }] }),
    });
    if (r.ok) return { r };
    let j = null;
    try { j = await r.json(); } catch {}
    last = { status: r.status, type: j && j.error && j.error.type, message: (j && j.error && j.error.message) || "" };
    const modelProblem = r.status === 404 || (r.status === 400 && /model/i.test(last.message));
    if (!modelProblem) break; // only a bad model name is worth retrying with the default model
  }
  return { err: last };
}

export default async function handler(req, res) {
  if (req.method === "GET") return send(res, 200, { ok: true, ai: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { error: "method" }); }
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 500, { error: "no_key" });

  let body;
  try { body = await readBody(req); } catch (e) {
    const big = e && e.code === "too_large";
    return send(res, big ? 413 : 400, { error: big ? "too_large" : "bad_request" });
  }
  const built = buildRequest(body);
  if (built.error) return send(res, 400, { error: built.error });

  const ctl = new AbortController();
  res.on("close", () => { if (!res.writableFinished) ctl.abort(); });

  let up;
  try { up = await callClaude(built.content, built.maxTokens, ctl.signal); } catch (e) {
    if (ctl.signal.aborted) return;
    console.error("Anthropic request failed:", e && e.message);
    return send(res, 502, { error: "upstream" });
  }
  if (up.err) {
    const [status, code] = mapError(up.err);
    console.error("Anthropic error:", up.err.status, up.err.type, up.err.message);
    return send(res, status, { error: code });
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  const reader = up.r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", stop = "";
  const meta = o => res.write("\n" + JSON.stringify(o) + "\n");
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta" && ev.delta.text) res.write(ev.delta.text);
        else if (ev.type === "message_delta" && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === "error") meta({ __error: mapError({ type: ev.error && ev.error.type, message: ev.error && ev.error.message })[1] });
      }
    }
    if (stop === "max_tokens") meta({ __meta: "truncated" });
  } catch (e) {
    if (!ctl.signal.aborted) { console.error("Stream interrupted:", e && e.message); try { meta({ __error: "upstream" }); } catch {} }
  }
  res.end();
}
