import { useEffect, useState } from 'react'
import { BackHeader } from '../components.jsx'
import { vocabGroupsOf, collectWords, loadVStats, troubleWords, VOCAB_GAMES, gameAllowed, groupLabel } from '../lib/vocab.js'

// TRÒ CHƠI TỪ VỰNG (chốt 6/10/2026): 6 trò dùng SỔ TỪ VỰNG — tra mỗi từ một lần, sau đó chơi ngay không gọi AI.
// Con chọn chủ đề, kiểu từ muốn ôn, số từ rồi bấm một trò.
const PICKS = [
  { k: 'weak', l: 'Cần ôn nhất', icon: '🎯' },
  { k: 'wrong', l: 'Từ hay sai', icon: '🔁' },
  { k: 'new', l: 'Từ mới', icon: '🆕' },
  { k: 'all', l: 'Trộn đều', icon: '🎲' },
]
const COUNTS = [10, 15, 20]

export default function VocabHub({ mem, grade = 0, allowChoice = true, onStart, onBack, onCapture, onPrefetch }) {
  const groups = vocabGroupsOf(mem)
  const [topic, setTopic] = useState('all')
  const [level, setLevel] = useState('weak')
  const [count, setCount] = useState(10)
  const vstats = loadVStats()

  const allWords = collectWords(groups)
  const selGroups = topic === 'all' ? groups : groups.filter((g) => g.name === topic)
  const words = collectWords(selGroups)
  const wordKeys = new Set(words.map((w) => w.key))
  const trouble = troubleWords(vstats, 100).filter((t) => wordKeys.has(t.key))
  const games = VOCAB_GAMES.filter((g) => gameAllowed(g, { grade, allowChoice }))

  // Chuẩn bị SỔ TỪ trong nền (tra trước các từ chưa có) -> bấm trò là chơi ngay.
  useEffect(() => {
    if (onPrefetch && allWords.length) onPrefetch(allWords)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Từ hay sai" mà chưa có từ nào sai -> về "Cần ôn nhất".
  const lv = level === 'wrong' && !trouble.length ? 'weak' : level

  if (!groups.length || !allWords.length) {
    return (
      <div className="screen">
        <BackHeader title="Trò chơi từ vựng" onBack={onBack} />
        <div className="vh-empty">
          <div className="vh-empty-ic">🔤</div>
          <h2>Chưa có từ vựng tiếng Anh</h2>
          <p>Con thêm bài tiếng Anh có <b>từ vựng</b> (chụp trang từ mới, hoặc gõ vd “Tiếng Anh 5: từ vựng nghề nghiệp doctor, nurse, teacher”). App sẽ tra nghĩa, cách đọc và câu ví dụ cho từng từ để con chơi.</p>
          {onCapture && <button className="cta" onClick={onCapture}>📸 Thêm bài học</button>}
        </div>
      </div>
    )
  }

  function play(g) {
    onStart({ game: g.k, groupNames: selGroups.map((x) => x.name), level: lv, count })
  }

  return (
    <div className="screen vh">
      <BackHeader title="Trò chơi từ vựng" onBack={onBack} />

      <div className="vh-sum">
        <span className="vh-sum-big">📚 {words.length} từ</span>
        <span className="vh-sum-sub">{selGroups.length} chủ đề{trouble.length ? ` · 🔁 ${trouble.length} từ con hay sai` : ''}</span>
      </div>

      {groups.length > 1 && (
        <div className="cr-sec">
          <h3>Chủ đề</h3>
          <div className="chips">
            <button className={'chip' + (topic === 'all' ? ' on' : '')} onClick={() => setTopic('all')}>Tất cả <em>· {allWords.length}</em></button>
            {groups.map((g) => (
              <button key={g.id || g.name} className={'chip' + (topic === g.name ? ' on' : '')} onClick={() => setTopic(g.name)}>
                {groupLabel(g.name)} <em>· {collectWords([g]).length}</em>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cr-sec">
        <h3>Ôn từ nào?</h3>
        <div className="chips">
          {PICKS.map((p) => (
            <button key={p.k} className={'chip' + (lv === p.k ? ' on' : '')} disabled={p.k === 'wrong' && !trouble.length}
              onClick={() => setLevel(p.k)}>{p.icon} {p.l}</button>
          ))}
        </div>
      </div>

      <div className="cr-sec">
        <h3>Số từ mỗi lượt</h3>
        <div className="chips">
          {COUNTS.map((n) => (
            <button key={n} className={'chip' + (count === n ? ' on' : '')} onClick={() => setCount(n)}>{n} từ</button>
          ))}
        </div>
        <p className="cr-hint">Trò “Đúng hay sai” luôn chơi 60 giây.</p>
      </div>

      <div className="cr-sec">
        <h3>Chọn trò chơi</h3>
        <div className="vh-games">
          {games.map((g) => (
            <button key={g.k} className="vh-game" onClick={() => play(g)}>
              <span className="vh-game-ic">{g.icon}</span>
              <b>{g.name}</b>
              <em>{g.desc}</em>
            </button>
          ))}
        </div>
        {!allowChoice && <p className="cr-hint">Phụ huynh đã tắt trắc nghiệm — trò “Đúng hay sai” tạm ẩn.</p>}
      </div>
    </div>
  )
}
