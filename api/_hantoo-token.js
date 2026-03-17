// 한투 Open API 토큰 관리 — Vercel serverless 내부 공유 모듈
// 파일명 _ prefix → Vercel이 HTTP 엔드포인트로 노출하지 않음
//
// 토큰 캐시: 모듈 레벨 변수 (동일 인스턴스 내 재사용)
// 만료 1분 전 자동 갱신 → 24h 마다 1회 발급

export const HANTOO_BASE = 'https://openapi.koreainvestment.com:9443';

let cachedToken = null;
let tokenExpiry = 0;

/**
 * 한투 OAuth 토큰 반환
 * - 유효한 캐시가 있으면 즉시 반환 (API 호출 없음)
 * - 만료/미보유 시 POST /oauth2/tokenP 로 신규 발급
 */
export async function getHantooToken() {
  const now = Date.now();
  // 만료 1분 전까지 캐시 유효
  if (cachedToken && now < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const res = await fetch(`${HANTOO_BASE}/oauth2/tokenP`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      grant_type: 'client_credentials',
      appkey:     process.env.HANTOO_APP_KEY,
      appsecret:  process.env.HANTOO_APP_SECRET,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`한투 토큰 발급 실패 ${res.status}: ${text.slice(0, 120)}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`한투 토큰 없음: ${JSON.stringify(data).slice(0, 200)}`);
  }

  cachedToken  = data.access_token;
  tokenExpiry  = now + (data.expires_in ?? 86400) * 1000;
  return cachedToken;
}
