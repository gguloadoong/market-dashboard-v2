// 관심종목 뉴스 알림 훅
// React Query 캐시 구독 → 새 기사 감지 → 관심종목 매칭 → 브라우저 알림
// - 앱 첫 로드 시 기존 기사는 "이미 본" 것으로 등록 (시작 스팸 방지)
// - 종목당 5분 쿨다운 (같은 종목 반복 알림 차단)

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { buildStockKeywords, matchesKeywords } from '../utils/newsAlias';
import { newsKeys } from './useNewsQuery';

const COOLDOWN_MS = 5 * 60 * 1000;
// 모듈 레벨 쿨다운 Map — 훅 재마운트 시에도 유지
const alertCooldowns = new Map();

function sendNewsAlert(item, news) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const alertKey = `news:${item.symbol}:${news.category || 'all'}`;
  const now = Date.now();
  if ((now - (alertCooldowns.get(alertKey) ?? 0)) < COOLDOWN_MS) return;
  alertCooldowns.set(alertKey, now);

  const name = item.name || item.symbol;
  try {
    const n = new Notification(`📰 ${name} 뉴스`, {
      body: news.title || '',
      tag: alertKey,
      icon: '/favicon.ico',
      silent: false,
    });
    // 알림 클릭 → 뉴스 상세 패널 오픈 (App.jsx의 alert-open-news 핸들러)
    n.onclick = () => {
      window.focus();
      window.dispatchEvent(new CustomEvent('alert-open-news', { detail: news }));
      n.close();
    };
    setTimeout(() => n.close(), 8000);
  } catch {}
}

// watchedItems: [{ symbol, name, _market: 'KR'|'US'|'COIN', ...시세 }]
// App.jsx에서 관심종목 필터링 후 주입
export function useNewsAlerts(watchedItems) {
  const seenLinks = useRef(new Set());
  const initialized = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!watchedItems?.length) return;

    const unsub = qc.getQueryCache().subscribe(event => {
      // 뉴스 전체 쿼리 업데이트만 처리
      if (event.type !== 'updated') return;
      const query = event.query;
      if (JSON.stringify(query.queryKey) !== JSON.stringify(newsKeys.all)) return;

      const allNews = query.state.data ?? [];
      if (!allNews.length) return;

      // 첫 로드: 현재 기사 전체를 "이미 본" 것으로 등록 → 알림 스팸 방지
      if (!initialized.current) {
        allNews.forEach(n => { if (n.link) seenLinks.current.add(n.link); });
        initialized.current = true;
        return;
      }

      // 이전 폴링 이후 새로 추가된 기사만 추출
      const newArticles = allNews.filter(n => n.link && !seenLinks.current.has(n.link));
      newArticles.forEach(n => seenLinks.current.add(n.link));
      if (!newArticles.length) return;

      // 새 기사 × 관심종목 매칭
      for (const article of newArticles) {
        const text = `${article.title || ''} ${article.description || article.summary || ''}`;
        for (const item of watchedItems) {
          const market = item._market === 'KR' ? 'KR'
            : item._market === 'COIN' ? 'COIN' : 'US';
          const keywords = buildStockKeywords(item.symbol, item.name, market);
          if (keywords.length && matchesKeywords(text, keywords)) {
            sendNewsAlert(item, article);
            break; // 기사당 첫 매칭 종목만 알림 (중복 방지)
          }
        }
      }
    });

    return unsub;
  }, [watchedItems, qc]);
}
