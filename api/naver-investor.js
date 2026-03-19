// api/naver-investor.js — Naver 투자자 동향 서버사이드 프록시
// allorigins 없이 서버사이드에서 직접 Naver 모바일 API 호출
//
// 요청:
//   GET /api/naver-investor?symbol=005930         → 당일 투자자 동향
//   GET /api/naver-investor?symbol=005930&trend=5 → 5일치 추이

export default async function handler(req, res) {
  const { symbol, trend } = req.query;

  if (!symbol || !/^\d{6}$/.test(symbol)) {
    return res.status(400).json({ error: 'symbol required (6-digit KRX code)' });
  }

  try {
    const count = trend ? (parseInt(trend) || 5) : null;
    const url = count
      ? `https://m.stock.naver.com/api/stock/${symbol}/investors?periodType=DAILY&count=${count}`
      : `https://m.stock.naver.com/api/stock/${symbol}/investor`;

    const naverRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible)',
        'Accept': 'application/json',
        'Referer': 'https://m.stock.naver.com/',
      },
      signal: AbortSignal.timeout(7000),
    });

    if (!naverRes.ok) throw new Error(`Naver ${naverRes.status}`);
    const data = await naverRes.json();

    res.setHeader('Cache-Control', 's-maxage=55, stale-while-revalidate=10');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
