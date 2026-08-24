import { useState } from 'react'
import { BackHeader } from '../components.jsx'

export default function ParentApprove({ pending, onSave, onBack }) {
  const [checked, setChecked] = useState(() =>
    Object.fromEntries(pending.concepts.map((c) => [c.id, true]))
  )
  const toggle = (id) => setChecked((s) => ({ ...s, [id]: !s[id] }))
  const count = Object.values(checked).filter(Boolean).length

  return (
    <div className="screen">
      <BackHeader title="AI hiểu được gì" onBack={onBack} />
      <p className="para">
        Kiểm tra nhanh xem AI hiểu đúng chưa, rồi lưu vào bộ nhớ của con. Bạn có thể bỏ chọn phần không đúng.
      </p>

      <div className="understood">
        <div className="u-row"><span>Môn</span><b>{pending.subject}</b></div>
        <div className="u-row"><span>Chủ đề</span><b>{pending.topic}</b></div>
      </div>

      <h3 className="u-head">Các khái niệm tìm thấy</h3>
      <div className="concept-list">
        {pending.concepts.map((c) => (
          <label key={c.id} className={'concept' + (checked[c.id] ? ' on' : '')}>
            <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)} />
            <span className="concept-txt">
              <b>{c.name}</b>
              <em>{c.difficulty} · {c.importance}</em>
            </span>
            <span className="check">{checked[c.id] ? '✓' : ''}</span>
          </label>
        ))}
      </div>

      <button className="cta" disabled={count === 0} onClick={() => onSave(checked)}>
        Lưu {count} khái niệm vào bộ nhớ của con
      </button>
    </div>
  )
}
