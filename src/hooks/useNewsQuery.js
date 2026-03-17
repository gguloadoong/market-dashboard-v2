// 뉴스 React Query 훅 — 전역 캐시 + 즉시 표시 패턴
// initialData: 로컬스토리지 캐시를 즉시 표시 → "불러오는중" 제거
// initialDataUpdatedAt: React Query가 staleTime 기준으로 백그라운드 갱신 여부 판단
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  fetchAllNews, fetchNewsByCategory, invalidateNewsCache,
  getInitialNewsData, getInitialNewsTimestamp,
} from '../api/news';

export const newsKeys = {
  all:      ['news', 'all'],
  category: (cat) => ['news', cat],
};

const NEWS_OPTIONS = {
  // news.js CACHE_TTL(3분)과 동기화 — staleTime > CACHE_TTL이면 React Query가 갱신 요청을 안 보냄
  staleTime:            3 * 60 * 1000,  // 3분 신선
  gcTime:               15 * 60 * 1000, // 15분 후 메모리 정리
  retry:                1,
  retryDelay:           2000,
  refetchOnWindowFocus: false,
};

// 전체 뉴스 — 로컬스토리지 캐시가 있으면 즉시 표시
export function useAllNewsQuery() {
  return useQuery({
    queryKey:             newsKeys.all,
    queryFn:              fetchAllNews,
    initialData:          () => getInitialNewsData('all'),
    initialDataUpdatedAt: () => getInitialNewsTimestamp('all'),
    ...NEWS_OPTIONS,
  });
}

// 카테고리별 뉴스
export function useCategoryNewsQuery(category) {
  return useQuery({
    queryKey:             newsKeys.category(category),
    queryFn:              () => fetchNewsByCategory(category),
    initialData:          () => getInitialNewsData(category),
    initialDataUpdatedAt: () => getInitialNewsTimestamp(category),
    ...NEWS_OPTIONS,
    enabled: !!category,
  });
}

// 자동 갱신 포함 (BreakingNewsPanel용)
export function useNewsAutoRefetch() {
  return useQuery({
    queryKey:             newsKeys.all,
    queryFn:              fetchAllNews,
    initialData:          () => getInitialNewsData('all'),
    initialDataUpdatedAt: () => getInitialNewsTimestamp('all'),
    ...NEWS_OPTIONS,
    refetchInterval: 5 * 60 * 1000,
  });
}

// 수동 새로고침
export function useNewsRefresh() {
  const qc = useQueryClient();
  return () => {
    invalidateNewsCache();
    qc.invalidateQueries({ queryKey: ['news'] });
  };
}

import { buildStockKeywords, matchesKeywords } from '../utils/newsAlias';

// 종목 키워드 기반 뉴스 필터 훅 — ChartSidePanel에서 사용
// market prop 없으면 symbol/name 패턴으로 자동 추정
export function useStockNews(symbol, name, market) {
  const { data: allNews = [], isLoading } = useAllNewsQuery();

  const news = useMemo(() => {
    if (!symbol || !allNews.length) return [];

    // market 자동 추정: 6자리 숫자 = KR, id 있으면 COIN, 그 외 US
    const detectedMarket = market
      || (/^\d{6}$/.test(symbol) ? 'KR' : 'US');

    const keywords = buildStockKeywords(symbol, name, detectedMarket);
    if (!keywords.length) return [];

    return allNews
      .filter(item => {
        const text = item.title + ' ' + (item.summary || item.description || '');
        return matchesKeywords(text, keywords);
      })
      .slice(0, 8);
  }, [symbol, name, market, allNews]);

  return { news, isLoading };
}
