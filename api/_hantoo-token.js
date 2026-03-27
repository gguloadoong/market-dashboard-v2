// 한투 Open API 토큰 관리 — Vercel serverless 내부 공유 모듈
// 파일명 _ prefix → Vercel이 HTTP 엔드포인트로 노출하지 않음
//
// 캐시 3단계:
//   1) 메모리 캐시 — 동일 함수 인스턴스 내 즉시 재사용
//   2) Upstash Redis — 모든 인스턴스 간 공유 (하루 1회 토큰 발급 보장)
//   3) /tmp 파일 캐시 — Redis 장애 시 fallback
// 동시 요청 중복 방지(request coalescing): 발급 중인 요청이 있으면 그 Promise를 공유

import { readFileSync, writeFileSync } from 'fs';
import { Redis } from '@upstash/redis';

export const HANTOO_BASE = 'https://openapi.koreainvestment.com:9443';
const CACHE_FILE = '/tmp/hantoo-token-cache.json';
const REDIS_KEY = 'hantoo:token';
const REDIS_TTL = 23 * 60 * 60; // 23시간 (토큰 유효기간 24시간보다 1시간 여유)

// Upstash Redis 클라이언트 (환경변수 없으면 null → /tmp fallback)
let redis = null;
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
} catch {}

// 메모리 캐시 (동일 함수 인스턴스)
let memToken  = null;
let memExpiry = 0;

// 진행 중인 토큰 발급 요청 (중복 방지)
let pendingRequest = null;

// ─── /tmp 파일 캐시 (Redis 장애 시 fallback) ───
function readFileCache() {
  try {
    const raw  = readFileSync(CACHE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return (data?.token && data?.expiry) ? data : null;
  } catch { return null; }
}

function writeFileCache(token, expiry) {
  try {
    writeFileSync(CACHE_FILE, JSON.stringify({ token, expiry }), 'utf8');
  } catch {}
}

// ─── Redis 캐시 ───
async function readRedisCache() {
  if (!redis) return null;
  try {
    const data = await redis.get(REDIS_KEY);
    if (data?.token && data?.expiry && Date.now() < data.expiry - 60_000) {
      return data;
    }
    return null;
  } catch { return null; }
}

async function writeRedisCache(token, expiry) {
  if (!redis) return;
  try {
    await redis.set(REDIS_KEY, { token, expiry }, { ex: REDIS_TTL });
  } catch {}
}

/**
 * 한투 OAuth 토큰 반환
 * - 메모리 캐시 유효 → 즉시 반환
 * - Redis 캐시 유효 → 메모리에 로드 후 반환 (모든 인스턴스 공유)
 * - /tmp 파일 캐시 유효 → 메모리에 로드 후 반환 (같은 컨테이너)
 * - 전부 만료 → POST /oauth2/tokenP 신규 발급 (하루 최대 1회)
 */
export async function getHantooToken() {
  const now = Date.now();

  // 1) 메모리 캐시
  if (memToken && now < memExpiry - 60_000) return memToken;

  // 2) Redis 캐시 (모든 인스턴스 공유 — 핵심)
  const redisData = await readRedisCache();
  if (redisData) {
    memToken  = redisData.token;
    memExpiry = redisData.expiry;
    return memToken;
  }

  // 3) /tmp 파일 캐시 (Redis 장애 시 fallback)
  const file = readFileCache();
  if (file && now < file.expiry - 60_000) {
    memToken  = file.token;
    memExpiry = file.expiry;
    // Redis에 복원 (다른 인스턴스도 사용 가능하게)
    writeRedisCache(file.token, file.expiry).catch(() => {});
    return memToken;
  }

  // 4) 신규 발급 — 동시 요청 중복 방지
  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
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

    memToken  = data.access_token;
    memExpiry = now + (data.expires_in ?? 86400) * 1000;

    // Redis + /tmp 동시 저장
    await Promise.allSettled([
      writeRedisCache(memToken, memExpiry),
      Promise.resolve(writeFileCache(memToken, memExpiry)),
    ]);

    return memToken;
  })().finally(() => { pendingRequest = null; });

  return pendingRequest;
}
