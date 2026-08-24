import { STATUS_LABEL } from './lib/memory.js'

export function Brand({ sub }) {
  return (
    <div className="brand">
      <span className="brand-mark">OT</span>
      <span className="brand-name">ON&nbsp;TAP{sub && <em> {sub}</em>}</span>
    </div>
  )
}

export function StatusPill({ status }) {
  return <span className={'pill pill-' + status}>{STATUS_LABEL[status]}</span>
}

export function MasteryBar({ value, status }) {
  return (
    <div className="mbar" aria-label={value + '%'}>
      <span className={'mbar-fill fill-' + status} style={{ width: value + '%' }} />
    </div>
  )
}

export function BackHeader({ title, onBack }) {
  return (
    <div className="backhead">
      <button className="back" onClick={onBack} aria-label="Quay lại">←</button>
      <h2>{title}</h2>
    </div>
  )
}
