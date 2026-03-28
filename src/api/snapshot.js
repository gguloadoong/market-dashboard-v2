// src/api/snapshot.js — 서버 가격 스냅샷 조회
// /api/snapshot (Edge → Redis) 캐시된 전체 시세를 한 번에 가져옴

const SNAPSHOT_TTL = 25 * 1000; // 25초 (서버 s-maxage=30보다 짧게)
let _cache = null;
let _cacheTs = 0;

export async function fetchSnapshot() {
  const now = Date.now();
  if (_cache && now - _cacheTs < SNAPSHOT_TTL) return _cache;

  try {
    const res = await fetch('/api/snapshot', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.ts) {
      _cache = data;
      _cacheTs = now;
    }
    return data;
  } catch {
    return null;
  }
}

export function invalidateSnapshot() {
  _cache = null;
  _cacheTs = 0;
}
