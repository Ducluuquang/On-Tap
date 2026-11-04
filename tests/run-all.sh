#!/usr/bin/env bash
# Chạy toàn bộ phép thử của Ôn Tập: bản build (dist) + máy chủ thử (tests/server.mjs: hàm /api thật, AI giả MOCK=1)
# + Redis thật qua lớp giả Upstash (tests/upstash_shim.mjs). Dùng:
#   bash tests/run-all.sh                 # tất cả các bộ thử
#   bash tests/run-all.sh t_ui28 t_engine # chỉ vài bộ
# Kết quả từng bộ: tests/out/<tên>.log (ảnh chụp cũng nằm trong tests/out).
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT=$(pwd); T="$ROOT/tests"; OUT="$T/out"; mkdir -p "$OUT"
PIDS=()
cleanup() { for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done; redis-cli -p 6390 shutdown nosave >/dev/null 2>&1; }
trap cleanup EXIT

# 1) phông thật cho trình duyệt thử (Be Vietnam Pro…) — cài một lần vào tests/.deps
if [ ! -d "$T/.deps/node_modules/@fontsource/be-vietnam-pro" ]; then
  echo "Cài phông cho phép thử…"
  npm install --prefix "$T/.deps" --no-audit --no-fund --silent @fontsource/be-vietnam-pro @fontsource/andika @fontsource/patrick-hand || exit 1
fi
# 2) bản build
[ -d node_modules ] || npm install --no-audit --no-fund --silent || exit 1
npm run build --silent >/dev/null || { echo "Build lỗi"; exit 1; }
# 3) Redis + lớp giả Upstash + 3 máy chủ thử (4192: đủ; 4193: chưa gắn kho; 4194: Scrabble rút ngắn giờ lượt)
command -v redis-server >/dev/null || { echo "Thiếu redis-server (Ubuntu: sudo apt-get install -y redis-server)"; exit 1; }
redis-cli -p 6390 ping >/dev/null 2>&1 || redis-server --port 6390 --save '' --appendonly no --daemonize yes >/dev/null
node "$T/upstash_shim.mjs" > "$OUT/shim.log" 2>&1 & PIDS+=($!)
MOCK=1 PORT=4192 node "$T/server.mjs" > "$OUT/s4192.log" 2>&1 & PIDS+=($!)
MOCK=1 ARENA=0 PORT=4193 node "$T/server.mjs" > "$OUT/s4193.log" 2>&1 & PIDS+=($!)
MOCK=1 PORT=4194 ARENA_SB_TURN_MS=7000 ARENA_SB_AWAY_MS=5000 node "$T/server.mjs" > "$OUT/s4194.log" 2>&1 & PIDS+=($!)
sleep 3

SUITES=${*:-"t_acct_merge t_api_account t_ui_account t_engine t_engine_many t_engine_multi t_api_arena t_api_limit t_api_scrabble t_api_more t_api_multi t_ui26 t_ui24 t_arena_regress t_solo_games t_leave_race t_ui_more t_ui_multi t_ui28 t_ui_pick"}
pass=0; fail=0
for t in $SUITES; do
  # mỗi bộ thử tạo nhiều người chơi/tài khoản từ cùng một địa chỉ: xoá bộ đếm chống spam của kho THỬ trước mỗi bộ
  redis-cli -p 6390 --scan --pattern 'arena:rl:hello*' | xargs -r redis-cli -p 6390 del >/dev/null
  redis-cli -p 6390 --scan --pattern 'acct:rl:*' | xargs -r redis-cli -p 6390 del >/dev/null
  printf '=== %s: ' "$t"
  if timeout 900 node "$T/$t.mjs" > "$OUT/$t.log" 2>&1 && grep -q "ALL PASS" "$OUT/$t.log"; then
    pass=$((pass+1)); tail -1 "$OUT/$t.log"
  else
    fail=$((fail+1)); echo "HỎNG — xem tests/out/$t.log"; grep -E "✗|Error" "$OUT/$t.log" | head -5
  fi
done
echo "Kết quả: $pass bộ đạt, $fail bộ hỏng"
[ "$fail" -eq 0 ]
