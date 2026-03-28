// api/kr-fear-greed.js — 국장 공포탐욕지수
// VKOSPI (네이버 API, 한투 fallback) + 외국인 순매수 (한투 API) 합성 지수
// VKOSPI: 낮을수록 탐욕, 높을수록 공포 (VIX 동일 방향)
// 외국인 순매수: 양수(순매수) = 탐욕, 음수(순매도) = 공포

import { getHantooToken, HANTOO_BASE } from './_hantoo-token.js';

// ─── VKOSPI 조회 ────────────────────────────────────────────────
async function fetchVkospiNaver() {
  const res = await fetch('https://m.stock.naver.com/api/index/VKOSPI/basic', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible)',
      'Accept':     'application/json',
      'Referer':    'https://m.stock.naver.com/',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Naver VKOSPI ${res.status}`);
  const data = await res.json();
  // Naver 지수 API 응답 필드 (KOSPI 동일 구조)
  const raw = data.closePrice ?? data.nowVal ?? data.indexValue;
  const val = parseFloat(String(raw || '').replace(/,/g, ''));
  if (!val || val <= 0) throw new Error('VKOSPI 값 없음');
  return val;
}

// ─── 외국인 순매수 조회 ─────────────────────────────────────────
function todayStr() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// 백만원 단위 문자열 → 원
function toWon(pbmnStr) {
  const m = parseInt((pbmnStr || '0').replace(/,/g, ''), 10) || 0;
  return m * 1_000_000;
}

async function fetchForeignNet(token, iscd, today) {
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor`);
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'U');
  url.searchParams.set('FID_INPUT_ISCD',   iscd);
  url.searchParams.set('FID_INPUT_DATE_1', today);
  url.searchParams.set('FID_INPUT_DATE_2', today);

  const r = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      appkey:        process.env.HANTOO_APP_KEY,
      appsecret:     process.env.HANTOO_APP_SECRET,
      tr_id:         'FHKST01010900',
      custtype:      'P',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  if (data.rt_cd !== '0') throw new Error(data.msg1 || data.rt_cd);
  const latest = (Array.isArray(data.output) ? data.output : [])[0];
  if (!latest) return 0;
  return toWon(latest.frgn_ntby_tr_pbmn);
}

// ─── 점수 산출 ──────────────────────────────────────────────────
// VKOSPI → 0-100 (보통 범위 12~37, 낮을수록 탐욕)
function vkospiToScore(v) {
  return Math.max(0, Math.min(100, Math.round(100 - ((v - 12) / 25) * 100)));
}

// 외국인 순매수 → 0-100 (±3조 원 기준, 0 = 중립 50점)
function foreignToScore(net) {
  return Math.max(0, Math.min(100, Math.round(50 + (net / 3e12) * 50)));
}

// ─── Handler ────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!process.env.HANTOO_APP_KEY || !process.env.HANTOO_APP_SECRET) {
    return res.status(503).json({ error: 'HANTOO not configured' });
  }

  try {
    const today = todayStr();
    const token = await getHantooToken();

    const [vkospiRes, kospiRes, kosdaqRes] = await Promise.allSettled([
      fetchVkospiNaver(),
      fetchForeignNet(token, '0001', today),  // KOSPI
      fetchForeignNet(token, '1001', today),  // KOSDAQ
    ]);

    const vkospi    = vkospiRes.status === 'fulfilled' ? vkospiRes.value : null;
    const foreignNet = (kospiRes.status  === 'fulfilled' ? kospiRes.value  : 0)
                     + (kosdaqRes.status === 'fulfilled' ? kosdaqRes.value : 0);

    if (vkospi == null && foreignNet === 0) {
      throw new Error('VKOSPI + 외국인 순매수 모두 조회 실패');
    }

    const vs = vkospi != null ? vkospiToScore(vkospi) : null;
    const fs = foreignToScore(foreignNet);

    // 합성: VKOSPI 60% + 외국인 40% (VKOSPI 실패 시 외국인 100%)
    const score = vs != null
      ? Math.round(vs * 0.6 + fs * 0.4)
      : fs;

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=30');
    res.json({
      score,
      vkospi,
      vkospiScore:  vs,
      foreignNet,
      foreignScore: fs,
    });
  } catch (e) {
    console.error('[kr-fear-greed]', e.message);
    res.status(500).json({ error: e.message });
  }
}
