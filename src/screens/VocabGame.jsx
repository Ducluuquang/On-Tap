import { useEffect, useRef, useState } from 'react'
import { BackHeader, WrongWhy } from '../components.jsx'
import { nowTs, isStaleEnter } from '../lib/keys.js'
import { recordAnswer } from '../lib/memory.js'
import { createActiveTimer } from '../lib/stats.js'
import { judgeAnswer } from '../lib/aiClient.js'
import { compareSpelling, spellWhy, matchMeaning, hintPattern, nextTileLevel, vocabGame, wordKey } from '../lib/vocab.js'
import { speak, warmSpeech, hasEnglishVoice, stopSpeech } from '../lib/speech.js'
import { playDing, playMiss } from '../lib/sound.js'

// TRÒ CHƠI TỪ VỰNG (chốt 6/10/2026) — dùng chung cho 5 trò lần lượt từng câu:
//  spell (Nghe – viết) · tiles (Xếp chữ cái, 3 mức) · meaning (Gõ nghĩa 2 chiều) · cloze (Điền từ vào câu) · wordform (Biến đổi từ).
// Chấm NGAY trên máy (không tốn token). Chỉ khi con gõ NGHĨA khác chữ trong sổ mới nhờ AI chấm.
// SAI là phải biết VÌ SAO: chỉ đúng chữ viết sai, mẹo nhớ, loại từ cần điền…

const LV_NAME = { 1: 'Xếp cả từ', 2: 'Điền chữ còn thiếu', 3: 'Tự gõ cả từ' }

function letterInfo(w) {
  const parts = String(w).trim().split(/\s+/)
  const n = String(w).replace(/[^A-Za-z]/g, '').length
  return parts.length > 1 ? `${parts.length} từ · ${n} chữ cái` : `${n} chữ cái`
}
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase()

// Thẻ từ hiện sau mỗi câu: từ + phiên âm + loại từ + nghĩa + câu ví dụ (bấm 🔊 để nghe).
function WordCard({ e, sentence = '' }) {
  if (!e) return null
  const ex = sentence || e.ex
  return (
    <div className="vg-wc">
      <div className="vg-wc-top">
        <b>{e.w}</b>
        {e.ipa && <span className="vg-ipa">{e.ipa}</span>}
        <button type="button" className="vg-speak mini" onClick={() => speak(e.w)} aria-label="Nghe từ">🔊</button>
      </div>
      <div className="vg-wc-mean">{e.pos && <i>{e.pos}</i>} {e.mean.join(', ')}</div>
      {ex && (
        <div className="vg-wc-ex">
          <span>“{ex}”</span>
          <button type="button" className="vg-speak mini" onClick={() => speak(ex, { rate: 0.9 })} aria-label="Nghe câu">🔊</button>
          {e.exVi && (!sentence || clean(sentence) === clean(e.ex)) && <em>{e.exVi}</em>}
        </div>
      )}
    </div>
  )
}

// Bảng ô chữ (trò Xếp chữ, mức 1–2): bấm chữ ở dưới để đặt vào ô trống; bấm ô đã đặt để gỡ ra.
function TileBoard({ board, placed, onTile, onSlot, result }) {
  const byId = new Map(board.tiles.map((t) => [t.id, t]))
  const used = new Set(Object.values(placed))
  return (
    <div className="tb">
      {/* --n: số ô -> ô tự thu nhỏ để cả từ nằm trên MỘT hàng (không bị cắt đôi như "Wednesd / ay") */}
      <div className="tb-slots" style={{ '--n': board.slots.length, '--gap': board.slots.length >= 12 ? '3px' : '5px' }}>
        {board.slots.map((s) => {
          if (!s.open) return <span key={s.i} className={'tb-fixed' + (s.ch === ' ' ? ' gap' : '')}>{s.ch === ' ' ? '' : s.ch}</span>
          const t = placed[s.i] != null ? byId.get(placed[s.i]) : null
          const mark = result ? (t && t.ch.toLowerCase() === s.ch.toLowerCase() ? ' good' : ' bad') : ''
          return (
            <button key={s.i} type="button" className={'tb-slot' + (t ? ' full' : '') + mark} disabled={!!result || !t}
              onClick={() => onSlot(s.i)} aria-label={t ? `Gỡ chữ ${t.ch}` : 'Ô trống'}>{t ? t.ch : ''}</button>
          )
        })}
      </div>
      {!result && (
        <div className="tb-tray">
          {board.tiles.map((t) => (
            <button key={t.id} type="button" className={'tb-tile' + (used.has(t.id) ? ' used' : '')}
              disabled={used.has(t.id)} onClick={() => onTile(t)}>{t.ch}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// Câu có chỗ trống "___" -> [trước, sau].
function splitBlank(s) {
  const i = String(s).indexOf('___')
  return i < 0 ? [String(s), ''] : [s.slice(0, i), s.slice(i + 3)]
}

export default function VocabGame({ game, items, onFinish, onExit }) {
  const g = vocabGame(game) || { name: 'Trò chơi từ vựng' }
  const [index, setIndex] = useState(0)
  const [val, setVal] = useState('')
  const [phase, setPhase] = useState('ask') // ask | checking | done
  const [res, setRes] = useState(null)      // { ok, note, lines, typed, ungraded }
  const [placed, setPlaced] = useState({})  // Xếp chữ: vị trí ô -> id chữ
  const [showVi, setShowVi] = useState(false)
  const [voiceOk, setVoiceOk] = useState(() => hasEnglishVoice())
  const resultsRef = useRef({})   // kết quả theo CHỦ ĐỀ (bản đồ kiến thức)
  const wordRes = useRef([])      // kết quả theo TỪNG TỪ (từ con hay sai)
  const graded = useRef(0)
  const solved = useRef(0)
  const timer = useRef(createActiveTimer())
  const doneAt = useRef(0) // lúc có kết quả -> cú Enter vừa nộp bài KHÔNG được nhảy luôn sang câu sau

  const it = items && items[index]
  const isLast = items && index + 1 >= items.length
  const typedMode = it && (game !== 'tiles' || it.lv >= 3)
  const viEn = game === 'meaning' && it && it.dir === 'vi-en'
  const enVi = game === 'meaning' && it && it.dir === 'en-vi'

  useEffect(() => {
    warmSpeech((ok) => setVoiceOk(ok))
    return () => stopSpeech()
  }, [])

  // Nghe – viết & Gõ nghĩa (Anh→Việt): tự đọc từ khi sang câu mới.
  useEffect(() => {
    if (!it) return undefined
    if (game === 'spell' || enVi) {
      const t = setTimeout(() => speak(it.w), 300)
      return () => clearTimeout(t)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Phím: Enter = câu tiếp theo (khi đã có kết quả). Xếp chữ: gõ chữ cái để đặt ô, Backspace để gỡ.
  useEffect(() => {
    function onKey(e) {
      if (phase === 'done') {
        if (e.key === 'Enter' && !isStaleEnter(e, doneAt.current)) { e.preventDefault(); next() }
        return
      }
      if (game === 'tiles' && it && it.lv < 3 && phase === 'ask') {
        if (e.key === 'Backspace') {
          const keys = Object.keys(placed).map(Number)
          if (keys.length) { e.preventDefault(); removeSlot(Math.max(...keys)) }
        } else if (/^[a-z]$/i.test(e.key)) {
          const used = new Set(Object.values(placed))
          const t = it.board.tiles.find((x) => !used.has(x.id) && x.ch.toLowerCase() === e.key.toLowerCase())
          if (t) { e.preventDefault(); placeTile(t) }
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!items || !items.length) {
    return (
      <div className="screen center">
        <p className="para">Chưa có từ để chơi.</p>
        <button className="cta small" onClick={onExit}>Quay lại</button>
      </div>
    )
  }

  // Đáp án đúng của câu hiện tại (để so & hiện ra).
  const target = game === 'cloze' || game === 'wordform' ? it.a : it.w
  const correctShown = enVi ? it.e.mean.join(' / ') : target

  function spellResult(typed, tgt) {
    const c = compareSpelling(typed, tgt)
    if (c.ok) return { ok: true, note: c.note || '' }
    const lines = spellWhy(typed, tgt)
    if (it.e.split && wordKey(tgt) === wordKey(it.e.w)) lines.push(`💡 Tách từ cho dễ nhớ: ${it.e.split}`)
    return { ok: false, lines }
  }

  function settle(r, typed) {
    doneAt.current = nowTs()
    if (r.ungraded) { setRes({ ...r, typed }); setPhase('done'); return }
    const ok = !!r.ok
    graded.current += 1
    if (ok) solved.current += 1
    resultsRef.current = recordAnswer(resultsRef.current, it.group, ok, it.group)
    const wr = { key: it.key, ok, typed, game }
    if (game === 'tiles') wr.lv = nextTileLevel(it.lv, ok)
    wordRes.current.push(wr)
    if (ok) playDing(); else playMiss()
    setRes({ ...r, ok, typed })
    setPhase('done')
  }

  async function check() {
    if (phase !== 'ask') return
    const typed = val.trim()
    if (!typed) return
    timer.current.step()
    if (game === 'wordform') {
      const c = compareSpelling(typed, it.a)
      if (c.ok) { settle({ ok: true, note: c.note || '', lines: [it.why] }, typed); return }
      const lines = []
      const sp = spellWhy(typed, it.a)
      if (wordKey(typed) === wordKey(it.root)) lines.push(`Con giữ nguyên từ gốc “${it.root.toLowerCase()}” — chỗ trống cần một DẠNG KHÁC của từ.`)
      else if (!/khác khá nhiều/.test(sp[0])) lines.push(...sp) // gần đúng (vd thiếu/thừa chữ, sai đuôi) -> chỉ đúng chỗ sai
      if (it.why) lines.push(it.why)                            // vì sao cần dạng từ này (loại từ)
      lines.push(`Câu đúng: ${it.s.replace('___', it.a)}`)
      settle({ ok: false, lines }, typed)
      return
    }
    if (enVi) {
      const m = matchMeaning(typed, it.e.mean)
      if (m.ok) { settle({ ok: true, note: m.note || '' }, typed); return }
      if (m.sure) { settle({ ok: false, lines: [`“${it.w}” nghĩa là “${it.e.mean.join('”, “')}”.`] }, typed); return }
      // Con gõ nghĩa KHÁC chữ trong sổ -> nhờ AI chấm xem có cùng nghĩa không (chỉ trường hợp này mới tốn token).
      setPhase('checking')
      try {
        const j = await judgeAnswer({
          // Chấm NGHĨA: chấp nhận mọi cách nói tiếng Việt chỉ CÙNG sự vật/việc (đồng nghĩa, cách gọi thông dụng/vùng miền).
          question: `Nghĩa tiếng Việt của từ tiếng Anh “${it.w}”${it.e.pos ? ` (${it.e.pos})` : ''} là gì? (Chấm theo NGHĨA: chấp nhận mọi cách nói tiếng Việt mà người Việt vẫn dùng để chỉ CÙNG sự vật/hành động/tính chất này — từ đồng nghĩa, cách gọi thông dụng hoặc theo vùng miền, có hay không có chữ chỉ loại. Chỉ chấm sai khi nghĩa sai hoặc chỉ một thứ khác.)`,
          correct: it.e.mean.join(' / '),
          answer: typed,
        })
        if (j && j.correct) settle({ ok: true, note: j.note || '' }, typed)
        else settle({ ok: false, lines: [j && j.note ? j.note : '', `“${it.w}” nghĩa là “${it.e.mean.join('”, “')}”.`] }, typed)
      } catch {
        settle({ ungraded: true, lines: ['Chưa chấm được vì mạng chậm — câu này không tính điểm.', `“${it.w}” nghĩa là “${it.e.mean.join('”, “')}”.`] }, typed)
      }
      return
    }
    // Chính tả: Nghe – viết, Gõ nghĩa (Việt→Anh), Xếp chữ mức 3, Điền từ vào câu.
    const r = spellResult(typed, target)
    if (!r.ok && game === 'cloze') r.lines.push(`Câu đúng: ${it.s.replace('___', it.a)}`)
    if (!r.ok && viEn) r.lines.unshift(`Từ cần tìm: “${it.w}” = ${it.e.mean[0]}.`)
    settle(r, typed)
  }

  // ---- Xếp chữ (mức 1–2) ----
  function assembled(pl) {
    const byId = new Map(it.board.tiles.map((t) => [t.id, t]))
    return it.board.slots.map((s) => (s.open ? (pl[s.i] != null ? byId.get(pl[s.i]).ch : '') : s.ch)).join('')
  }
  function placeTile(t) {
    if (phase !== 'ask') return
    const open = it.board.slots.filter((s) => s.open && placed[s.i] == null)
    if (!open.length) return
    const nextPl = { ...placed, [open[0].i]: t.id }
    setPlaced(nextPl)
    if (open.length === 1) { // vừa đặt chữ cuối -> chấm ngay
      timer.current.step()
      const word = assembled(nextPl)
      settle(spellResult(word, it.w), word)
    }
  }
  function removeSlot(i) {
    if (phase !== 'ask') return
    const nextPl = { ...placed }
    delete nextPl[i]
    setPlaced(nextPl)
  }

  function next() {
    if (isLast) {
      onFinish({ total: graded.current, correct: solved.current, activeSeconds: timer.current.get() }, resultsRef.current, wordRes.current)
      return
    }
    timer.current.reset()
    setIndex(index + 1); setVal(''); setRes(null); setPhase('ask'); setPlaced({}); setShowVi(false)
  }

  // ---- Đề bài theo từng trò ----
  let prompt = null
  if (game === 'spell') {
    prompt = (
      <div className="vg-card">
        <div className="vg-say">
          <button type="button" className="vg-speak" onClick={() => speak(it.w)}>🔊 Nghe</button>
          <button type="button" className="vg-speak slow" onClick={() => speak(it.w, { rate: 0.5 })}>🐢 Đọc chậm</button>
        </div>
        <div className="vg-mean">{it.e.mean[0]}</div>
        <div className="vg-sub">{it.e.pos ? `${it.e.pos} · ` : ''}{letterInfo(it.w)}</div>
        {!voiceOk && (
          <>
            <p className="vg-novoice">Máy này chưa đọc được tiếng Anh — con nhìn nghĩa và chữ cái đầu để viết nhé.</p>
            <div className="vg-hint">{hintPattern(it.w)}</div>
          </>
        )}
      </div>
    )
  } else if (game === 'tiles') {
    prompt = (
      <div className="vg-card">
        <div className="vg-mean">{it.e.mean[0]}</div>
        <div className="vg-sub">
          {it.e.pos}
          <button type="button" className="vg-speak mini" onClick={() => speak(it.w)} aria-label="Nghe từ">🔊</button>
        </div>
        <div className="vg-lv">Mức {it.lv}/3 · {LV_NAME[it.lv]}</div>
        {it.lv >= 3 && <div className="vg-hint">{hintPattern(it.w)}</div>}
      </div>
    )
  } else if (game === 'meaning') {
    prompt = enVi ? (
      <div className="vg-card">
        <div className="vg-word">
          {it.w}
          <button type="button" className="vg-speak mini" onClick={() => speak(it.w)} aria-label="Nghe từ">🔊</button>
        </div>
        <div className="vg-sub">{[it.e.ipa, it.e.pos].filter(Boolean).join(' · ')}</div>
        <div className="vg-ask">Nghĩa tiếng Việt là gì?</div>
      </div>
    ) : (
      <div className="vg-card">
        <div className="vg-mean">{it.e.mean[0]}</div>
        <div className="vg-sub">{it.e.pos}</div>
        <div className="vg-hint">{hintPattern(it.w)}</div>
        <div className="vg-ask">Từ tiếng Anh là gì?</div>
      </div>
    )
  } else if (game === 'cloze') {
    const [a, b] = splitBlank(it.s)
    const viOk = it.e.exVi && clean(it.s.replace('___', it.a)) === clean(it.e.ex)
    prompt = (
      <div className="vg-card">
        <p className="vg-sent">{a}<span className="vg-blank">{hintPattern(it.a)}</span>{b}</p>
        {viOk && (
          <button type="button" className="linkbtn" onClick={() => setShowVi((v) => !v)}>💡 {showVi ? 'Ẩn nghĩa của câu' : 'Xem nghĩa của câu'}</button>
        )}
        {viOk && showVi && <p className="vg-vi">{it.e.exVi}</p>}
      </div>
    )
  } else if (game === 'wordform') {
    const [a, b] = splitBlank(it.s)
    prompt = (
      <div className="vg-card">
        <p className="vg-sent">{a}<span className="vg-blank wide">{' '.repeat(10)}</span>{b}</p>
        <div className="vg-root">{it.root}</div>
        <div className="vg-ask">Viết DẠNG ĐÚNG của từ in hoa để điền vào chỗ trống</div>
      </div>
    )
  }

  const placeholder = enVi ? 'Gõ nghĩa tiếng Việt…' : game === 'wordform' ? 'Gõ dạng đúng của từ…' : 'Gõ từ tiếng Anh…'
  const fbClass = res ? (res.ungraded ? 'fb fb-warn' : res.ok ? 'fb fb-ok' : 'fb fb-no') : 'fb'
  const sentenceDone = (game === 'cloze' || game === 'wordform') ? it.s.replace('___', it.a) : ''

  return (
    <div className={'screen vg vg-' + game}>
      <BackHeader title={g.name} onBack={onExit} />
      <div className="qprogress">
        <div className="qbar"><span style={{ width: (index / items.length) * 100 + '%' }} /></div>
        <span className="qcount">{index + 1}/{items.length}</span>
      </div>

      {prompt}

      {typedMode ? (
        <>
          <input
            key={index}
            className={'typed-in vg-in' + (res && !res.ungraded ? (res.ok ? ' ok' : ' no') : '')}
            value={val}
            placeholder={placeholder}
            disabled={phase !== 'ask'}
            autoFocus
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
            lang={enVi ? 'vi' : 'en'}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && phase === 'ask') { e.preventDefault(); check() } }}
          />
          {phase === 'ask' && <button className="cta" disabled={!val.trim()} onClick={check}>Kiểm tra</button>}
          {phase === 'checking' && <button className="cta" disabled>🤔 Đang kiểm tra…</button>}
        </>
      ) : (
        <>
          <TileBoard board={it.board} placed={placed} onTile={placeTile} onSlot={removeSlot} result={phase === 'done' ? res : null} />
          {phase === 'ask' && Object.keys(placed).length > 0 && (
            <button className="ghost small vg-reset" onClick={() => setPlaced({})}>↺ Xếp lại</button>
          )}
        </>
      )}

      {phase === 'done' && res && (
        <div className={fbClass}>
          <b>{res.ungraded ? '⚠️ Chưa chấm được' : res.ok ? 'Chính xác! 🎉' : 'Chưa đúng.'}</b>
          {res.ok && res.note && <p>{res.note}</p>}
          {res.ok && res.lines && res.lines.filter(Boolean).map((t, i) => <p key={i}>{t}</p>)}
          {res.ungraded && res.lines.map((t, i) => <p key={i}>{t}</p>)}
          {!res.ok && !res.ungraded && (
            <WrongWhy pickedLabel={typedMode ? 'Con viết' : 'Con xếp'} picked={res.typed} correct={correctShown} lines={res.lines} />
          )}
          <WordCard e={it.e} sentence={sentenceDone} />
          <button className="cta" onClick={next}>{isLast ? 'Xem kết quả' : 'Câu tiếp theo'}</button>
        </div>
      )}

      {phase !== 'done' && (
        <p className="qf-note">
          {game === 'tiles' && it.lv < 3 ? 'Bấm chữ cái để xếp — bấm ô đã xếp để gỡ ra 🔤' : 'Viết hoa hay thường đều được ✍️'}
        </p>
      )}
    </div>
  )
}
