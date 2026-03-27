// KRX ETF 전체 목록 — 앱 로드 시 1회 fetch, 6시간 캐싱
import { useQuery } from '@tanstack/react-query';
import { fetchKrxEtf as gwKrxEtf } from '../api/_gateway.js';

async function fetchKrxEtf() {
  const data = await gwKrxEtf();
  return data.etfs ?? [];
}

export function useKrxEtf() {
  return useQuery({
    queryKey:  ['krx-etf'],
    queryFn:   fetchKrxEtf,
    staleTime: 6 * 60 * 60 * 1000, // 6시간
    retry:     1,
  });
}
