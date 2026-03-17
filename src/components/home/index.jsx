import { useState, useMemo } from 'react';
import SectorRotation from '../SectorRotation';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { findRelatedItems, MARKET_FLAG, RELATION_TYPES } from '../../data/relatedAssets';
import { extractNewsSignals } from '../../utils/newsSignal';
import { getPct, buildKeywords, findRelatedNews, findRelatedNewsMulti, fmt } from './utils';
import SurgeSection from './SurgeSection';
import HotListSection from './HotListSection';
import InsightsSection, { WatchlistSection, WatchlistNewsSection } from './InsightsSection';
import MarketIndexSection, { CoinSummarySection } from './MarketIndexSection';
import SignalSection from './SignalSection';
import TopNewsSection from './TopNewsSection';
import EarlySignalSection from './EarlySignalSection';
import EventCalendar from './EventCalendar';
import MarketInvestorSection from './MarketInvestorSection';
import DexHotSection from './DexHotSection';
import CoinListingSection from './CoinListingSection';

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [],
  krwRate = 1466, onItemClick,
}) {
  const { data: allNews = [], isLoading: newsLoading } = useAllNewsQuery();
  const { watchlist, toggle, isWatched } = useWatchlist();
  const [surgeMarket, setSurgeMarket] = useState('all');

  // 마켓 태그 추가된 종목 리스트
  const krItems   = useMemo(() => krStocks.map(s => ({ ...s, _market: 'KR'   })), [krStocks]);
  const usItems   = useMemo(() => usStocks.map(s => ({ ...s, _market: 'US'   })), [usStocks]);
  const coinItems = useMemo(() => coins.map(c   => ({ ...c, _market: 'COIN' })), [coins]);
  const allItems  = useMemo(() => [...krItems, ...usItems, ...coinItems], [krItems, usItems, coinItems]);

  // ─── 7일 이내 뉴스 (모든 섹션 공통 — surgeNewsMap보다 먼저 선언해야 TDZ 방지) ──
  const recentNews = useMemo(() => {
    if (!allNews.length) return [];
    const cutoff = 7 * 24 * 60 * 60 * 1000;
    return allNews.filter(n => {
      if (!n.pubDate) return false;
      try { return Date.now() - new Date(n.pubDate).getTime() < cutoff; }
      catch { return false; }
    });
  }, [allNews]);

  // ─── SECTION 1: 급등 스포트라이트 계산 ─────────────────────
  const surgeItems = useMemo(() => {
    let list = allItems;
    if (surgeMarket === 'KR')   list = krItems;
    else if (surgeMarket === 'US')   list = usItems;
    else if (surgeMarket === 'COIN') list = coinItems;

    const hot = list.filter(i => getPct(i) >= 2).sort((a, b) => getPct(b) - getPct(a));
    return (hot.length >= 3 ? hot : [...list].sort((a, b) => getPct(b) - getPct(a))).slice(0, 5);
  }, [allItems, krItems, usItems, coinItems, surgeMarket]);

  // 급등 종목 존재 여부 (3% 이상)
  const hasHotItems = useMemo(() => allItems.some(i => getPct(i) >= 3), [allItems]);

  // 급등 카드용 뉴스 컨텍스트 맵 (symbol → 관련 뉴스 1건, 7일 이내만)
  const surgeNewsMap = useMemo(() => {
    if (!recentNews.length || !surgeItems.length) return {};
    return surgeItems.reduce((acc, item) => {
      const news = findRelatedNews(item, recentNews);
      if (news) acc[item.symbol] = news;
      return acc;
    }, {});
  }, [surgeItems, recentNews]);

  // ─── SECTION 3: 각 시장별 HOT TOP5 (급등/급락) ─────────────
  const krHot = useMemo(
    () => [...krItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5),
    [krItems]
  );
  const usHot = useMemo(
    () => [...usItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5),
    [usItems]
  );
  const coinHot = useMemo(
    () => [...coinItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5),
    [coinItems]
  );
  // 급락 TOP5 (낙폭 큰 순)
  const krDrop = useMemo(
    () => [...krItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5),
    [krItems]
  );
  const usDrop = useMemo(
    () => [...usItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5),
    [usItems]
  );
  const coinDrop = useMemo(
    () => [...coinItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5),
    [coinItems]
  );

  // ─── SECTION 4: 인사이트 (뉴스 × 무버 매칭) ────────────────
  const topMovers = useMemo(() => {
    return [...allItems].sort((a, b) => Math.abs(getPct(b)) - Math.abs(getPct(a))).slice(0, 20);
  }, [allItems]);

  const insights = useMemo(() => {
    if (!recentNews.length || !topMovers.length) return [];
    return topMovers
      .map(mover => ({ mover, news: findRelatedNews(mover, recentNews) }))
      .filter(({ news }) => news !== null)
      .slice(0, 6);
  }, [topMovers, recentNews]);

  // ─── 관심종목 필터링 ────────────────────────────────────────
  const watchedItems = useMemo(
    () => allItems.filter(i => isWatched(i.id || i.symbol)),
    [allItems, watchlist] // watchlist dep: Set 변경 시 재계산
  );

  // ─── 관심종목 기반 인사이트 (Job 3 — 포트폴리오 × 뉴스 매칭) ─
  // 종목당 최대 3건, 전체 최대 12건
  const watchlistInsights = useMemo(() => {
    if (!recentNews.length || !watchedItems.length) return [];
    const cards = [];
    for (const item of watchedItems) {
      const newsItems = findRelatedNewsMulti(item, recentNews, 3);
      for (const news of newsItems) {
        cards.push({ mover: item, news });
        if (cards.length >= 12) return cards;
      }
    }
    return cards;
  }, [watchedItems, recentNews]);

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0;

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <div className="space-y-4">

      {/* ─── 상단 헤더 ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#191F28] leading-tight">지금 뭐가 움직이고 있어?</h2>
          <p className="text-[12px] text-[#8B95A1] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-[#F2F4F6] shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
          <span className="text-[11px] text-[#6B7684] font-medium">실시간</span>
        </div>
      </div>

      {/* ─── 1. 핵심 시그널 — "이유 있는 움직임" ─────────── */}
      {hasData && (
        <SignalSection
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── 2. 내 관심종목 현황 ───────────────────────────── */}
      <WatchlistSection
        watchedItems={watchedItems}
        toggle={toggle}
        onItemClick={onItemClick}
      />

      <WatchlistNewsSection
        watchlistInsights={watchlistInsights}
        onItemClick={onItemClick}
      />

      {/* ─── 2.5 시장 투자자 동향 ────────────────────────────── */}
      <MarketInvestorSection />

      {/* ─── 3. 시장 지수 ─────────────────────────────────── */}
      <MarketIndexSection
        indices={indices}
        krwRate={krwRate}
      />

      {/* ─── 4. 급등/급락 통합 탭 ────────────────────────── */}
      <HotListSection
        hasData={hasData}
        krHot={krHot}
        usHot={usHot}
        coinHot={coinHot}
        krDrop={krDrop}
        usDrop={usDrop}
        coinDrop={coinDrop}
        krwRate={krwRate}
        onItemClick={onItemClick}
      />

      {/* ─── 5. 오늘의 핵심 뉴스 ─────────────────────────── */}
      <TopNewsSection allNews={allNews} />

      {/* ─── 5.5 선행 신호 — 뉴스 나왔지만 주가 미반응 ─── */}
      {hasData && (
        <EarlySignalSection
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── DEX 핫 프로토콜 ─────────────────────────────── */}
      <DexHotSection />

      {/* ─── 코인 거래소 공지 ───────────────────────────── */}
      <CoinListingSection />

      {/* ─── 5.7 경제 이벤트 캘린더 ──────────────────────── */}
      <EventCalendar />

      {/* ─── 6. 인사이트 (뉴스 × 무버) ───────────────────── */}
      <InsightsSection
        newsLoading={newsLoading}
        hasData={hasData}
        insights={insights}
        onItemClick={onItemClick}
      />

      {/* ─── 7. 섹터 로테이션 + 코인 요약 (접기 가능) ──── */}
      {(krStocks.length > 0 || usStocks.length > 0 || coins.length > 0) && (
        <SectorRotation krStocks={krStocks} usStocks={usStocks} coins={coins} />
      )}

      <CoinSummarySection coins={coins} krwRate={krwRate} />
    </div>
  );
}
