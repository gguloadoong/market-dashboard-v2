// ─── 시장 지표 API ──────────────────────────────────────────
// Fear & Greed: alternative.me (CORS-free, 무료)
// BTC Dominance: CoinGecko global (CORS-free, 무료)
// 김치프리미엄: coins 데이터에서 계산 (별도 API 불필요)

// ─── Fear & Greed Index ────────────────────────────────────
let _fgCache = null;
let _fgTs    = 0;
const FG_TTL = 10 * 60 * 1000; // 10분

export async function fetchFearGreed() {
  if (_fgCache && Date.now() - _fgTs < FG_TTL) return _fgCache;
  try {
    const res  = await fetch('https://api.alternative.me/fng/?limit=1', { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    const item = json.data?.[0];
    if (!item) throw new Error('no data');
    const KO_LABEL = {
      'Extreme Fear':  '극도 공포',
      'Fear':          '공포',
      'Neutral':       '중립',
      'Greed':         '탐욕',
      'Extreme Greed': '극도 탐욕',
    };
    _fgCache = {
      value:   parseInt(item.value, 10),
      labelEn: item.value_classification,
      labelKo: KO_LABEL[item.value_classification] ?? item.value_classification,
    };
    _fgTs = Date.now();
    return _fgCache;
  } catch {
    return _fgCache ?? { value: 50, labelEn: 'Neutral', labelKo: '중립' };
  }
}

// ─── BTC 도미넌스 ──────────────────────────────────────────
let _domCache = null;
let _domTs    = 0;
const DOM_TTL = 5 * 60 * 1000;

export async function fetchBtcDominance() {
  if (_domCache !== null && Date.now() - _domTs < DOM_TTL) return _domCache;
  try {
    const res  = await fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    _domCache  = json.data?.market_cap_percentage?.btc ?? null;
    _domTs     = Date.now();
    return _domCache;
  } catch {
    return _domCache;
  }
}

// ─── 김치프리미엄 계산 ────────────────────────────────────
// 업비트 BTC KRW vs CoinGecko BTC USD × 환율
export function calcKimchiPremium(btcKrw, btcUsd, krwRate) {
  if (!btcKrw || !btcUsd || !krwRate) return null;
  const theoretical = btcUsd * krwRate;
  if (theoretical <= 0) return null;
  return ((btcKrw / theoretical) - 1) * 100;
}
