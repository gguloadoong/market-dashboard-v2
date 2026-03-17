// ─── 가격 알림 유틸 ──────────────────────────────────────────
// 브라우저 Notification API 활용
// - 등락률 임계값 초과 시 1회 알림 (스팸 방지: 종목당 5분 쿨다운)
// - 권한 미부여 시 조용히 무시

const SURGE_THRESHOLD  = 3;   // +3% 이상 → 급등 알림
const DROP_THRESHOLD   = -3;  // -3% 이하 → 급락 알림 (선택적)
const COOLDOWN_MS      = 5 * 60 * 1000; // 5분 쿨다운

// 종목별 마지막 알림 시각 캐시
const lastAlertTime = new Map();

// 관심종목 ID Set (App.jsx에서 주입) — 빈 Set이면 알림 없음
let _watchlistIds = new Set();
export function setAlertWatchlistIds(ids) {
  _watchlistIds = ids instanceof Set ? ids : new Set(ids);
}

// ─── 권한 요청 ─────────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

// ─── 단일 알림 발송 ─────────────────────────────────────────
function sendAlert(title, body, { tag, icon } = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      tag:  tag  ?? 'price-alert',
      icon: icon ?? '/favicon.ico',
      silent: false,
    });
    // 5초 후 자동 닫기
    setTimeout(() => n.close(), 5000);
  } catch {}
}

// ─── 종목 알림 체크 ─────────────────────────────────────────
// item: { symbol, name, changePct, price, priceKrw? }
// type: 'kr' | 'us' | 'coin'
export function checkAndAlert(item, type) {
  if (Notification.permission !== 'granted') return;

  const key  = `${type}:${item.symbol}`;
  const now  = Date.now();
  const last = lastAlertTime.get(key) ?? 0;
  if (now - last < COOLDOWN_MS) return; // 쿨다운 중

  const pct = item.changePct ?? item.change24h ?? 0;
  if (Math.abs(pct) < SURGE_THRESHOLD) return; // 임계값 미달

  const dir  = pct > 0 ? '🔴 급등' : '🔵 급락';
  const sign = pct > 0 ? '+' : '';
  const name = item.name ?? item.symbol;

  let priceStr = '';
  if (type === 'kr') {
    priceStr = `₩${(item.price ?? 0).toLocaleString()}`;
  } else if (type === 'coin' && item.priceKrw) {
    priceStr = `₩${Math.round(item.priceKrw).toLocaleString()}`;
  } else {
    priceStr = `$${(item.price ?? 0).toLocaleString()}`;
  }

  sendAlert(
    `${dir} ${name}  ${sign}${pct.toFixed(2)}%`,
    `현재가 ${priceStr}`,
    { tag: key },
  );
  lastAlertTime.set(key, now);
}

// ─── 배치 체크 ───────────────────────────────────────────────
// items 배열에서 관심종목만 체크 (폴링 갱신 후 호출)
// 관심종목 미등록 시 알림 없음 (스팸 방지)
export function checkAndAlertBatch(items, type) {
  if (Notification.permission !== 'granted') return;
  if (_watchlistIds.size === 0) return; // 관심종목 없으면 알림 없음
  const watched = items.filter(i => _watchlistIds.has(i.id) || _watchlistIds.has(i.symbol));
  watched.forEach(item => checkAndAlert(item, type));
}

// ─── 쿨다운 초기화 (테스트용) ────────────────────────────────
export function clearAlertCooldowns() {
  lastAlertTime.clear();
}
