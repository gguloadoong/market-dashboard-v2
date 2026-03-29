// api/kr-fear-greed.js — 국장 공포탐욕지수
// VKOSPI (한투 inquire-index-price, 업종코드='4') + 외국인 순매수 (한투 API) 합성 지수
// VKOSPI: 낮을수록 탐욕, 높을수록 공포 (VIX 동일 방향)
// 외국인 순매수: 양수(순매수) = 탐욕, 음수(순매도) = 공포

import { getHantooToken, HANTOO_BASE } from './_hantoo-token.js';
import { todayStr, toWon } from './_hantoo-utils.js';
import { getSnap, setSnap } from './_price-cache.js';

const CACHE_KEY = 'snap:kr-fear-greed';
const CACHE_TTL = 48 * 60 * 60; // 48시간 — 주말/공휴일 전날 데이터 보존

// ─── VKOSPI 조회 (한투 업종현재가 TR) ──────────────────────────
// FID_INPUT_ISCD='4' = VKOSPI 파생 업종코드 (TR: FHPUP02100000)
// 동일 패턴: hantoo-indices.js (KOSPI=0001, KOSDAQ=1001)
async function fetchVkospiKis(token) {
  const url = new URL(`${HANTOO_BASE}/uapi/domestic-stock/v1/quotations/inquire-index-price`);
  url.searchParams.set('FID_COND_MRKT_DIV_CODE', 'U');
  url.searchParams.set('FID_INPUT_ISCD', '4');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      appkey:        process.env.HANTOO_APP_KEY,
      appsecret:     process.env.HANTOO_APP_SECRET,
      tr_id:         'FHPUP02100000',
      custtype:      'P',
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`KIS VKOSPI HTTP ${res.status}`);
  const data = await res.json();
  if (data.rt_cd !== '0') throw new Error(data.msg1 || `rt_cd ${data.rt_cd}`);

  const val = parseFloat(data.output?.bstp_nmix_prpr || '0');
  if (!val || val <= 0) throw new Error('VKOSPI 값 없음 (장 마감 또는 코드 불일치)');
  return val;
}

// ─── 외국인 순매수 조회 ─────────────────────────────────────────
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
// 합성 가중치
const VKOSPI_WEIGHT  = 0.6;
const FOREIGN_WEIGHT = 0.4;

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
  const hantooReady = !!(process.env.HANTOO_APP_KEY && process.env.HANTOO_APP_SECRET);

  try {
    const today = todayStr();

    // HANTOO 키 없으면 전체 불가 (VKOSPI + 외국인 모두 한투 의존)
    let vkospiRes, kospiRes, kosdaqRes;
    if (hantooReady) {
      const token = await getHantooToken();
      [vkospiRes, kospiRes, kosdaqRes] = await Promise.allSettled([
        fetchVkospiKis(token),
        fetchForeignNet(token, '0001', today),  // KOSPI
        fetchForeignNet(token, '1001', today),  // KOSDAQ
      ]);
    } else {
      vkospiRes = { status: 'rejected', reason: 'HANTOO not configured' };
      kospiRes  = { status: 'rejected', reason: 'HANTOO not configured' };
      kosdaqRes = { status: 'rejected', reason: 'HANTOO not configured' };
    }

    const vkospi = vkospiRes.status === 'fulfilled' ? vkospiRes.value : null;

    // 실제로 성공한 외국인 데이터만 합산 (실패는 0으로 대체하지 않음)
    const foreignAvailable = kospiRes.status === 'fulfilled' || kosdaqRes.status === 'fulfilled';
    const foreignNet = foreignAvailable
      ? (kospiRes.status  === 'fulfilled' ? kospiRes.value  : 0)
      + (kosdaqRes.status === 'fulfilled' ? kosdaqRes.value : 0)
      : null;

    // 모두 실패 = 휴장일(주말/공휴일) 또는 전체 API 장애 → Redis 캐시 반환
    if (vkospi == null && !foreignAvailable) {
      const cached = await getSnap(CACHE_KEY);
      if (cached) {
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
        return res.json({ ...cached, cached: true });
      }
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
      return res.json({ score: null, closed: true });
    }

    const vs = vkospi != null ? vkospiToScore(vkospi) : null;
    const fs = foreignNet != null ? foreignToScore(foreignNet) : null;

    // 합성: VKOSPI 60% + 외국인 40% (한쪽 실패 시 나머지 100%)
    let score;
    if (vs != null && fs != null) {
      score = Math.round(vs * VKOSPI_WEIGHT + fs * FOREIGN_WEIGHT);
    } else if (vs != null) {
      score = vs;
    } else {
      score = fs;
    }

    const payload = { score, vkospi, vkospiScore: vs, foreignNet, foreignScore: fs };
    // 성공 시 Redis에 저장 (48시간 — 주말/공휴일 대비)
    await setSnap(CACHE_KEY, payload, CACHE_TTL);

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=30');
    res.json(payload);
  } catch (e) {
    console.error('[kr-fear-greed]', e.message);
    res.status(500).json({ error: e.message });
  }
}
