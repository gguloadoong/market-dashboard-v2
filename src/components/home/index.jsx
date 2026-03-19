import { useState, useMemo } from 'react';
import SectorRotation from '../SectorRotation';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct, findRelatedNews, findRelatedNewsMulti } from './utils';
import SurgeSection from './SurgeSection';
import HotListSection from './HotListSection';
import { WatchlistSection, WatchlistNewsSection } from './InsightsSection';
import MarketIndexSection, { CoinSummarySection } from './MarketIndexSection';
import SignalSection from './SignalSection';
import TopNewsSection from './TopNewsSection';
import EventCalendar from './EventCalendar';
import MarketInvestorSection from './MarketInvestorSection';
import DexHotSection from './DexHotSection';
import CoinListingSection from './CoinListingSection';

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [], etfs = [],
  krwRate = 1466, onItemClick,
}) {
  const { data: allNews = [] } = useAllNewsQuery();
  const { watchlist, toggle, isWatched } = useWatchlist();
  const [surgeMarket, setSurgeMarket] = useState('all');

  // 마켓 태그 추가된 종목 리스트 (ETF 포함)
  const krItems   = useMemo(() => [
    ...krStocks.map(s => ({ ...s, _market: 'KR' })),
    ...etfs.filter(e => e.market === 'kr').map(e => ({ ...e, _market: 'KR', _isEtf: true })),
  ], [krStocks, etfs]);
  const usItems   = useMemo(() => [
    ...usStocks.map(s => ({ ...s, _market: 'US' })),
    ...etfs.filter(e => e.market === 'us').map(e => ({ ...e, _market: 'US', _isEtf: true })),
  ], [usStocks, etfs]);
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

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0 || etfs.length > 0;

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

      {/* ─── 1. 시장 현황 ─────────────────────────────────── */}
      <MarketIndexSection
        indices={indices}
        krwRate={krwRate}
      />

      {/* ─── 2. 핵심 뉴스 — 지수 바로 뒤 ───────────────── */}
      <TopNewsSection allNews={allNews} />

      {/* ─── 3. 내 관심종목 ───────────────────────────────── */}
      <WatchlistSection
        watchedItems={watchedItems}
        toggle={toggle}
        onItemClick={onItemClick}
      />

      <WatchlistNewsSection
        watchlistInsights={watchlistInsights}
        onItemClick={onItemClick}
      />

      {/* ─── 4. 핵심 시그널 ───────────────────────────────── */}
      {hasData && (
        <SignalSection
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── 5. 급등/급락 TOP5 ────────────────────────────── */}
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

      {/* ─── 6. 시장 투자자 동향 ────────────────────────────── */}
      <MarketInvestorSection />

      {/* ─── 7. 섹터 로테이션 ─────────────────────────────── */}
      {(krStocks.length > 0 || usStocks.length > 0 || coins.length > 0) && (
        <SectorRotation krStocks={krStocks} usStocks={usStocks} coins={coins} />
      )}

      {/* ─── 8. 경제 이벤트 캘린더 ──────────────────────── */}
      <EventCalendar />

      {/* ─── 9. DEX 핫 프로토콜 / 코인 공지 / 코인 요약 ── */}
      <DexHotSection />
      <CoinSummarySection coins={coins} krwRate={krwRate} />
      <CoinListingSection />
    </div>
  );
}
