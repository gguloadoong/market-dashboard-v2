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
  staleTime:            5 * 60 * 1000,  // 5분 신선
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

// 종목 키워드 기반 뉴스 필터 훅 — ChartSidePanel에서 사용
export function useStockNews(symbol, name) {
  const { data: allNews = [], isLoading } = useAllNewsQuery();

  const news = useMemo(() => {
    if (!symbol || !allNews.length) return [];
    // 영문명이 너무 길면 첫 단어만 사용 (예: "Apple" not "Apple Inc.")
    const shortName = name ? name.split(/[\s\/]/)[0] : null;
    const keywords = [symbol, name, shortName]
      .filter(Boolean)
      .map(k => k.toLowerCase())
      .filter((k, i, arr) => arr.indexOf(k) === i); // 중복 제거
    return allNews
      .filter(item => {
        const text = (item.title + ' ' + (item.summary || item.description || '')).toLowerCase();
        return keywords.some(kw => kw.length >= 2 && text.includes(kw));
      })
      .slice(0, 6);
  }, [symbol, name, allNews]);

  return { news, isLoading };
}
