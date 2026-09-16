import { useState } from 'react'
import { BackHeader } from '../components.jsx'

// Các môn tiểu học thường gặp — để phụ huynh CHỌN/SỬA nếu AI đoán sai môn.
const COMMON_SUBJECTS = ['Toán', 'Tiếng Việt', 'Tiếng Anh', 'Khoa học', 'Lịch sử', 'Địa lý', 'Tự nhiên và Xã hội', 'Đạo đức', 'Tin học']

export default function ParentApprove({ pending, onSave, onBack }) {
  const [checked, setChecked] = useState(() =>
    Object.fromEntries(pending.concepts.map((c) => [c.id, true]))
  )
  // Môn: mặc định lấy môn AI đoán, nhưng CHO SỬA (tránh Toán lẫn vào Tiếng Anh…).
  const [subject, setSubject] = useState(pending.subject || 'Toán')
  const subjectOptions = [...new Set([pending.subject, ...COMMON_SUBJECTS].filter(Boolean))]
  const toggle = (id) => setChecked((s) => ({ ...s, [id]: !s[id] }))
  const count = Object.values(checked).filter(Boolean).length

  return (
    <div className="screen">
      <BackHeader title="Nội dung đã đọc được" onBack={onBack} />
      <p className="para">
        Kiểm tra nhanh xem đã hiểu đúng chưa, rồi lưu vào bộ nhớ của con. Bạn có thể bỏ chọn phần không đúng.
      </p>

      <div className="understood">
        <div className="u-row">
          <span>Môn</span>
          <select className="u-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="u-row"><span>Chủ đề</span><b>{pending.topic}</b></div>
      </div>
      {pending.subject && subject !== pending.subject && (
        <p className="cr-hint">Đã đổi môn từ "{pending.subject}" (AI đoán) sang "{subject}".</p>
      )}
      <p className="cr-hint">💡 Kiểm tra <b>Môn</b> cho đúng trước khi lưu — để báo cáo từng môn không bị lẫn.</p>

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

      <button className="cta" disabled={count === 0} onClick={() => onSave(checked, subject)}>
        Lưu {count} khái niệm vào bộ nhớ của con
      </button>
    </div>
  )
}
