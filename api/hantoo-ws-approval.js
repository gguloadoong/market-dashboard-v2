// KIS WebSocket Approval Key 발급 엔드포인트
// POST https://openapi.koreainvestment.com:9443/oauth2/Approval
// approval_key는 access_token과 별개로 발급 (WebSocket 전용)

import { HANTOO_BASE } from './_hantoo-token.js';

// 5분 서버 캐시 (모듈 변수 — 동일 인스턴스 내 재사용)
let cachedApprovalKey = null;
let approvalKeyExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

export default async function handler(req, res) {
  // GET / POST 모두 허용 (클라이언트에서 POST로 호출)
  const appKey    = process.env.HANTOO_APP_KEY;
  const appSecret = process.env.HANTOO_APP_SECRET;

  // 환경변수 미설정 시 503 반환
  if (!appKey || !appSecret) {
    return res.status(503).json({ error: 'KIS API 키 미설정' });
  }

  // 캐시 유효 여부 확인 (5분 이내)
  const now = Date.now();
  if (cachedApprovalKey && now < approvalKeyExpiry) {
    return res.status(200).json({ approval_key: cachedApprovalKey });
  }

  try {
    const response = await fetch(`${HANTOO_BASE}/oauth2/Approval`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body:    JSON.stringify({
        grant_type: 'client_credentials',
        appkey:     appKey,
        appsecret:  appSecret,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[KIS WS Approval] 발급 실패 ${response.status}: ${text.slice(0, 120)}`);
      return res.status(502).json({ error: `KIS Approval 실패: ${response.status}` });
    }

    const data = await response.json();
    if (!data.approval_key) {
      console.error('[KIS WS Approval] 응답에 approval_key 없음:', JSON.stringify(data).slice(0, 200));
      return res.status(502).json({ error: 'approval_key 없음' });
    }

    // 캐시 갱신
    cachedApprovalKey = data.approval_key;
    approvalKeyExpiry = now + CACHE_TTL_MS;

    return res.status(200).json({ approval_key: data.approval_key });
  } catch (e) {
    console.error('[KIS WS Approval] 예외:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
