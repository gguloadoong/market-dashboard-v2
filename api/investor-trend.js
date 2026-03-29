// api/investor-trend.js — 국장 투자자 동향 추이 Serverless
// Naver Finance 모바일 API → 외인/기관/개인 N일 순매수 반환
//
// GET /api/investor-trend?symbol=005930&days=30
// 응답: { data: [ { date, foreign, institution, individual, foreignFmt, institutionFmt, individualFmt } ] }

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseInt(String(val).replace(/,/g, ''), 10) || 0;
}

function formatNetAmt(won) {
  const abs = Math.abs(won);
  if (abs >= 1_000_000_000_000) return `${(won / 1_000_000_000_000).toFixed(1)}조`;
  if (abs >= 100_000_000)       return `${(won / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000)            return `${(won / 10_000).toFixed(0)}만`;
  return String(won);
}

export default async function handler(req, res) {
  const symbol = (req.query.symbol || '').trim();
  const days   = Math.min(parseInt(req.query.days || '30', 10) || 30, 60);

  if (!/^\d{6}$/.test(symbol)) {
    return res.status(400).json({ error: 'symbol must be 6-digit KR stock code' });
  }

  // Naver Finance 모바일 — 투자자 일별 순매수 추이
  const url = `https://m.stock.naver.com/api/stock/${symbol}/investors?periodType=DAILY&count=${days}`;

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://m.stock.naver.com/',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`Naver HTTP ${resp.status}`);
    const json = await resp.json();

    const list = Array.isArray(json) ? json : (json.list ?? json.investorList ?? json.investors ?? []);

    const data = list.slice(0, days).map(row => {
      const foreign     = toNum(row.frgnNetAmt ?? row.frgNetAmt ?? row.foreignNetAmt ?? 0);
      const institution = toNum(row.instNetAmt ?? row.institutionNetAmt ?? 0);
      const individual  = toNum(row.indvNetAmt ?? row.individualNetAmt ?? 0);
      return {
        date:           row.stcTrdDd ?? row.bizday ?? row.date ?? '',
        foreign,
        institution,
        individual,
        foreignFmt:     formatNetAmt(foreign),
        institutionFmt: formatNetAmt(institution),
        individualFmt:  formatNetAmt(individual),
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({ data });
  } catch (err) {
    console.error('[investor-trend]', symbol, err.message);
    return res.status(500).json({ error: '투자자 동향 데이터를 가져오지 못했습니다.' });
  }
}
