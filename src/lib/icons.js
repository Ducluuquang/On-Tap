// Bộ icon con thú cho tài khoản con (phụ huynh chọn khi đăng ký).
export const CHILD_ICONS = ['🦊', '🐼', '🐧', '🐨', '🦁', '🐯', '🐸', '🦉', '🐵', '🐰', '🐶', '🐱', '🦄', '🐢', '🐝', '🦋']

// Icon hiển thị cho một con: ưu tiên icon con đã chọn; nếu chưa chọn thì suy ra ổn định theo id.
export function iconFor(child) {
  if (child && child.icon) return child.icon
  let h = 0
  const s = (child && child.id) || ''
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return CHILD_ICONS[Math.abs(h) % CHILD_ICONS.length]
}
