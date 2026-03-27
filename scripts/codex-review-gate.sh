#!/usr/bin/env bash
# codex-review-gate.sh
# Codex 리뷰 결과를 파싱하여 PASS/BLOCK 판정을 내린다.
# CI 게이트 또는 로컬 pre-push hook 에서 호출된다.
#
# 사용법:
#   REVIEW_OUTPUT="<리뷰 텍스트>" ./scripts/codex-review-gate.sh
#   또는
#   ./scripts/codex-review-gate.sh --strict   # strict 모드 (기본값)
#   ./scripts/codex-review-gate.sh --warn     # warn 모드 (BLOCK 시 경고만, 계속 진행)
#
# 환경변수:
#   REVIEW_OUTPUT   — 리뷰 텍스트 (없으면 stdin 에서 읽음)
#   CODEX_GATE_MODE — "strict" | "warn" (기본값: strict)

set -euo pipefail

# ──────────────────────────────────────────
# 모드 결정
# ──────────────────────────────────────────
GATE_MODE="${CODEX_GATE_MODE:-strict}"

for arg in "$@"; do
  case "$arg" in
    --strict) GATE_MODE="strict" ;;
    --warn)   GATE_MODE="warn"   ;;
  esac
done

# ──────────────────────────────────────────
# codex CLI 설치 여부 확인
# (codex login status 체크는 CLI 버전마다 지원 여부가 달라 제거)
# ──────────────────────────────────────────
if ! command -v codex &>/dev/null; then
  if [ "$GATE_MODE" = "strict" ]; then
    echo "[codex-review-gate] ERROR: codex CLI 가 설치되어 있지 않습니다." >&2
    echo "[codex-review-gate] strict 모드에서는 codex 없이 진행할 수 없습니다." >&2
    echo "[codex-review-gate] 설치: npm install -g @openai/codex" >&2
    exit 1
  else
    echo "[codex-review-gate] WARN: codex CLI 미설치 — warn 모드이므로 게이트를 건너뜁니다." >&2
    exit 0
  fi
fi

# ──────────────────────────────────────────
# 리뷰 텍스트 수집
# ──────────────────────────────────────────
if [ -n "${REVIEW_OUTPUT:-}" ]; then
  REVIEW_TEXT="$REVIEW_OUTPUT"
else
  REVIEW_TEXT="$(cat)"
fi

if [ -z "$REVIEW_TEXT" ]; then
  echo "[codex-review-gate] ERROR: 리뷰 텍스트가 비어 있습니다." >&2
  exit 1
fi

# ──────────────────────────────────────────
# DECISION 파싱 (POSIX ERE 호환)
# \s 는 POSIX ERE 미지원 → [[:space:]] 사용
# grep 실패(매칭 없음) 시 set -e 에 의한 종료를 방지하기 위해 || true 추가
# ──────────────────────────────────────────
DECISION_LINE="$(echo "$REVIEW_TEXT" | grep -iE 'DECISION:[[:space:]]*(PASS|BLOCK)' || true)"

if [ -n "$DECISION_LINE" ]; then
  # DECISION 키워드가 명시된 경우
  if echo "$DECISION_LINE" | grep -iE 'DECISION:[[:space:]]*BLOCK' &>/dev/null; then
    VERDICT="BLOCK"
  else
    VERDICT="PASS"
  fi
else
  # ────────────────────────────────────────
  # fallback 파서: DECISION 미매칭 시
  # [P0] 또는 [P1] 태그가 있으면 → BLOCK
  # 그 외 → PASS
  # ────────────────────────────────────────
  echo "[codex-review-gate] WARN: DECISION 키워드를 찾지 못했습니다. fallback 파서를 사용합니다." >&2
  if echo "$REVIEW_TEXT" | grep -E '\[P[01]\]' &>/dev/null; then
    VERDICT="BLOCK"
  else
    VERDICT="PASS"
  fi
fi

# ──────────────────────────────────────────
# 최종 판정
# ──────────────────────────────────────────
if [ "$VERDICT" = "BLOCK" ]; then
  echo "[codex-review-gate] BLOCK — 리뷰에서 차단 판정이 내려졌습니다." >&2
  echo "$REVIEW_TEXT"
  if [ "$GATE_MODE" = "warn" ]; then
    echo "[codex-review-gate] warn 모드이므로 계속 진행합니다." >&2
    exit 0
  fi
  exit 1
fi

echo "[codex-review-gate] PASS — 리뷰 통과."
echo "$REVIEW_TEXT"
exit 0
