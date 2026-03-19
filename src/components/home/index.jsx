import { useState, useMemo } from 'react';
import SectorRotation from '../SectorRotation';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct } from './utils';
import MarketPulseWidget from './widgets/MarketPulseWidget';
import WatchlistWidget from './widgets/WatchlistWidget';
import TopMoversWidget from './widgets/TopMoversWidget';
import NewsFeedWidget from './widgets/NewsFeedWidget';
import NotableMoversSection from './NotableMoversSection';
import MarketInvestorSection from './MarketInvestorSection';
import EventTicker from './EventTicker';
import CoinListingSection from './CoinListingSection';

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [], etfs = [],
  krwRate = 1466, onItemClick, onNewsClick,
}) {
  const { data: allNews = [] } = useAllNewsQuery();
  const { watchlist, toggle, isWatched } = useWatchlist();
  const [collapsed, setCollapsed] = useState(true);

  // 마켓 태그
  const krItems   = useMemo(() => [
    ...krStocks.map(s => ({ ...s, _market: 'KR' })),
    ...etfs.filter(e => e.market === 'kr').map(e => ({ ...e, _market: 'KR', _isEtf: true })),
  ], [krStocks, etfs]);
  const usItems   = useMemo(() => [
    ...usStocks.map(s => ({ ...s, _market: 'US' })),
    ...etfs.filter(e => e.market === 'us').map(e => ({ ...e, _market: 'US', _isEtf: true })),
  ], [usStocks, etfs]);
  const coinItems = useMemo(() => coins.map(c => ({ ...c, _market: 'COIN' })), [coins]);
  const allItems  = useMemo(() => [...krItems, ...usItems, ...coinItems], [krItems, usItems, coinItems]);

  // 7일 이내 뉴스
  const recentNews = useMemo(() => {
    if (!allNews.length) return [];
    const cutoff = 7 * 24 * 60 * 60 * 1000;
    return allNews.filter(n => {
      if (!n.pubDate) return false;
      try { return Date.now() - new Date(n.pubDate).getTime() < cutoff; } catch { return false; }
    });
  }, [allNews]);

  // 관심종목
  const watchedItems = useMemo(
    () => allItems.filter(i => isWatched(i.id || i.symbol)),
    [allItems, watchlist] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 관심종목 빈 상태 시 인기 종목 추천 (거래량 기준 마켓 혼합 TOP5)
  const popularItems = useMemo(() => {
    if (watchedItems.length > 0) return [];
    const getVol = i => i._market === 'COIN' ? (i.volume24h ?? 0) : (i.volume ?? 0);
    const sorted = [...allItems].sort((a, b) => getVol(b) - getVol(a));
    const result = [];
    const mktCount = { KR: 0, US: 0, COIN: 0 };
    for (const item of sorted) {
      if (mktCount[item._market] >= 2) continue;
      result.push(item);
      mktCount[item._market]++;
      if (result.length >= 5) break;
    }
    return result;
  }, [watchedItems.length, allItems]);

  // 급등/급락 TOP5
  const krHot   = useMemo(() => [...krItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [krItems]);
  const usHot   = useMemo(() => [...usItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [usItems]);
  const coinHot = useMemo(() => [...coinItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5), [coinItems]);
  const krDrop  = useMemo(() => [...krItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [krItems]);
  const usDrop  = useMemo(() => [...usItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [usItems]);
  const coinDrop= useMemo(() => [...coinItems].sort((a, b) => getPct(a) - getPct(b)).slice(0, 5), [coinItems]);

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0 || etfs.length > 0;

  return (
    <div className="space-y-4">

      {/* ─── WIDGET 1: Market Pulse ───────────────────────── */}
      <MarketPulseWidget indices={indices} krwRate={krwRate} />

      {/* ─── 주목할 종목 (히어로 영역) ───────────────────── */}
      {hasData && (
        <NotableMoversSection
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

      {/* ─── 경제 이벤트 티커 ─────────────────────────────── */}
      <EventTicker />

      {/* ─── 관심종목 (빈 상태 시 인기 종목 추천) ──────────── */}
      <WatchlistWidget
        watchedItems={watchedItems}
        popularItems={popularItems}
        toggle={toggle}
        onItemClick={onItemClick}
        krwRate={krwRate}
      />

      {/* ─── 시장을 움직이는 뉴스 (종목 연결 카드) ──────────── */}
      <NewsFeedWidget allNews={allNews} onNewsClick={onNewsClick} allItems={allItems} />

      {/* ─── 시장 투자자 동향 ─────────────────────────────── */}
      <MarketInvestorSection />

      {/* ─── 급등/급락 6박스 ──────────────────────────────── */}
      <TopMoversWidget
        hasData={hasData}
        krHot={krHot} usHot={usHot} coinHot={coinHot}
        krDrop={krDrop} usDrop={usDrop} coinDrop={coinDrop}
        krwRate={krwRate}
        onItemClick={onItemClick}
      />

      {/* ─── 코인 거래소 공지 ─────────────────────────────── */}
      <CoinListingSection />

      {/* ─── 하단 접힘: 섹터 로테이션 ─────────────────────── */}
      {(krStocks.length > 0 || usStocks.length > 0 || coins.length > 0) && (
        <div>
          <button
            onClick={() => setCollapsed(p => !p)}
            className="w-full flex items-center justify-center gap-2 py-2 text-[12px] text-[#8B95A1] hover:text-[#4E5968] transition-colors"
          >
            <div className="flex-1 h-px bg-[#F2F4F6]" />
            <span>{collapsed ? '▼ 더보기 (섹터 로테이션)' : '▲ 접기'}</span>
            <div className="flex-1 h-px bg-[#F2F4F6]" />
          </button>
          {!collapsed && (
            <div className="mt-2">
              <SectorRotation krStocks={krStocks} usStocks={usStocks} coins={coins} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
