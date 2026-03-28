// api/_price-cache.js — 가격 스냅샷 Redis 캐시 (Edge/Serverless 공용)
// Vercel '_' prefix → HTTP 엔드포인트로 노출되지 않음
import { Redis } from '@upstash/redis';

let redis = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
} catch (e) {
  console.error('[price-cache] Redis 연결 실패:', e);
  // graceful degradation — redis = null 유지
}

// Redis 키 — 마켓별 스냅샷
export const SNAP_KEYS = {
  KR: 'snap:kr',
  US: 'snap:us',
  COINS: 'snap:coins',
  ETF: 'snap:etf',
};

// TTL (초) — 각 마켓 데이터 갱신 주기 기반
export const SNAP_TTL = {
  KR: 300,    // 5분 (KRX 갱신주기)
  US: 120,    // 2분 (Yahoo 갱신주기)
  COINS: 90,  // 1.5분 (Upbit REST 갱신주기)
  ETF: 300,   // 5분
};

// 단일 키 조회
export async function getSnap(key) {
  if (!redis) return null;
  try {
    return await redis.get(key);
  } catch (e) {
    console.error(`[price-cache] getSnap 실패 (${key}):`, e);
    return null;
  }
}

// 단일 키 저장 (TTL 포함)
export async function setSnap(key, data, ex) {
  if (!redis) return false;
  try {
    await redis.set(key, data, { ex });
    return true;
  } catch (e) {
    console.error(`[price-cache] setSnap 실패 (${key}):`, e);
    return false;
  }
}

// 전체 마켓 스냅샷 일괄 조회 (ETF는 cron 없음 — 클라이언트 직접 폴링)
export async function getAllSnaps() {
  if (!redis) return null;
  try {
    const [kr, us, coins] = await Promise.all([
      redis.get(SNAP_KEYS.KR),
      redis.get(SNAP_KEYS.US),
      redis.get(SNAP_KEYS.COINS),
    ]);
    return { kr, us, coins };
  } catch (e) {
    console.error('[price-cache] getAllSnaps 실패:', e);
    return null;
  }
}

export { redis };
