// Vercel Serverless Function — Whale Alert API 프록시 (CORS 해결)
// 브라우저에서 직접 호출 불가한 Whale Alert API를 서버 사이드에서 중계
export default async function handler(req, res) {
  const apiKey = process.env.WHALE_ALERT_KEY;
  if (!apiKey) {
    // 키 미설정 시 빈 결과 반환 — Upbit WS + Blockchain.com WS로 대체 운영
    return res.status(200).json({ transactions: [], result: 'no_key' });
  }
  try {
    const cursor = req.query.cursor || '';
    const url = `https://api.whale-alert.io/v1/transactions?api_key=${apiKey}&min_value=500000&limit=10${cursor ? `&cursor=${cursor}` : ''}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await response.json();
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
