// api/snapshot.js — 전종목 가격 스냅샷 반환 (Edge Function)
// Redis 캐시에서 즉시 반환. 캐시 미스 시 빈 배열 (클라이언트가 skeleton 표시)
export const config = { runtime: 'edge' };

import { getAllSnaps } from './_price-cache.js';

export default async function handler(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  try {
    const snaps = await getAllSnaps();
    const fromCache = snaps !== null;

    const payload = {
      kr: snaps?.kr ?? [],
      us: snaps?.us ?? [],
      coins: snaps?.coins ?? [],
      ts: Date.now(),
      _fromCache: fromCache,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=15',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
