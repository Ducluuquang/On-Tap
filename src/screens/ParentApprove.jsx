import { useState } from 'react'
import { BackHeader } from '../components.jsx'
import { isVocabGroup } from '../lib/topics.js'

// Các môn tiểu học thường gặp (tên CHUẨN) — dùng khi nội dung nhập vào KHÔNG ghi rõ môn.
const COMMON_SUBJECTS = ['Toán', 'Tiếng Việt', 'Tiếng Anh', 'Khoa học', 'Lịch sử', 'Địa lý', 'Lịch sử và Địa lí', 'Tự nhiên và Xã hội', 'Đạo đức', 'Tin học']

export default function ParentApprove({ pending, onSave, onBack }) {
  const [checked, setChecked] = useState(() =>
    Object.fromEntries(pending.concepts.map((c) => [c.id, true]))
  )
  // Môn: mặc định lấy môn AI đoán. Nếu AI KHÔNG chắc -> để trống, BẮT phụ huynh chọn
  // (không mặc định 'Toán' nữa -> tránh môn khác bị gán nhầm vào Toán, gây lẫn môn trong báo cáo).
  const [subject, setSubject] = useState(pending.subject || '')
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
            <option value="">— Chọn môn —</option>
            {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="u-row"><span>Chủ đề</span><b>{pending.topic}</b></div>
      </div>
      {pending.subjectFrom === 'label' && subject === pending.subject && (
        <p className="cr-hint">✓ Môn <b>{pending.subject}</b> lấy đúng từ nội dung nhập vào{pending.grade ? ` (${pending.grade})` : ''}.</p>
      )}
      {pending.subject && subject !== pending.subject && (
        <p className="cr-hint">Đã đổi môn từ "{pending.subject}" sang "{subject}".</p>
      )}
      {!pending.subject && (
        <p className="cr-hint">💡 Nội dung chưa ghi rõ môn — chọn <b>Môn</b> trước khi lưu. Mẹo: ghi tên môn ở đầu, vd “Tiếng Anh 7: Thì quá khứ đơn”, app sẽ tự nhận đúng môn.</p>
      )}

      <h3 className="u-head">Các chủ đề tìm thấy</h3>
      <div className="concept-list">
        {pending.concepts.map((c) => (
          <label key={c.id} className={'concept' + (checked[c.id] ? ' on' : '')}>
            <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggle(c.id)} />
            <span className="concept-txt">
              <b>{c.name}</b>
              {/* Ý nhỏ thuộc chủ đề (câu mẫu, từ vựng…) — gộp trong MỘT mục để bản đồ kiến thức gọn */}
              {c.details && c.details.length > 0 && (
                <span className="concept-det">{c.details.length} {isVocabGroup(c.name) ? 'từ' : 'ý'}: {c.details.join(' · ')}</span>
              )}
              <em>{c.difficulty} · {c.importance}</em>
            </span>
            <span className="check">{checked[c.id] ? '✓' : ''}</span>
          </label>
        ))}
      </div>

      {!subject && <p className="cr-hint">⚠️ Hãy chọn <b>Môn</b> trước khi lưu (để báo cáo từng môn không bị lẫn).</p>}
      <button className="cta" disabled={count === 0 || !subject} onClick={() => onSave(checked, subject)}>
        Lưu {count} chủ đề vào bộ nhớ của con
      </button>
    </div>
  )
}
