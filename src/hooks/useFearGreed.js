// 공포탐욕지수 훅 — 코인(Alternative.me) + 미장(CNN Money 프록시)
// Alternative.me: CORS 지원, 직접 호출 가능
// CNN Money: CORS 차단 → 통합 게이트웨이 /api/d 프록시 경유
import { useQuery } from '@tanstack/react-query';
import { fetchFearGreed as gwFearGreed } from '../api/_gateway.js';

// 점수 → 레이블 매핑
export function getFgLabel(score) {
  if (score == null) return '';
  if (score <= 24)  return '극단적 공포';
  if (score <= 44)  return '공포';
  if (score <= 55)  return '중립';
  if (score <= 74)  return '탐욕';
  return '극단적 탐욕';
}

// 점수 → 색상
export function getFgColor(score) {
  if (score == null) return '#8B95A1';
  if (score <= 24)  return '#F04452';  // 극단적 공포 — 빨강
  if (score <= 44)  return '#FF6B35';  // 공포 — 주황
  if (score <= 55)  return '#8B95A1';  // 중립 — 회색
  if (score <= 74)  return '#2AC769';  // 탐욕 — 녹색
  return '#00B894';                    // 극단적 탐욕 — 진녹색
}

async function fetchCryptoFG() {
  const res = await fetch('https://api.alternative.me/fng/', {
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Alternative.me ${res.status}`);
  const data = await res.json();
  const entry = data?.data?.[0];
  return {
    score: Number(entry?.value ?? 0),
    rating: entry?.value_classification ?? '',
  };
}

async function fetchUsFG() {
  return gwFearGreed(8000);
}

export function useFearGreed() {
  const crypto = useQuery({
    queryKey: ['fearGreed', 'crypto'],
    queryFn: fetchCryptoFG,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });

  const us = useQuery({
    queryKey: ['fearGreed', 'us'],
    queryFn: fetchUsFG,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });

  return { crypto, us };
}
