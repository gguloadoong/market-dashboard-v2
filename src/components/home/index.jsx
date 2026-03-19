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
  const [sectorExpanded, setSectorExpanded] = useState(false);

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

      {/* ─── 관심종목 (컴팩트 — 4개 넘으면 스크롤) ──────── */}
      <WatchlistWidget
        watchedItems={watchedItems}
        popularItems={popularItems}
        toggle={toggle}
        onItemClick={onItemClick}
        krwRate={krwRate}
      />

      {/* ─── 급등/급락 6박스 (첫 화면에 걸치도록 승격) ──── */}
      <TopMoversWidget
        hasData={hasData}
        krHot={krHot} usHot={usHot} coinHot={coinHot}
        krDrop={krDrop} usDrop={usDrop} coinDrop={coinDrop}
        krwRate={krwRate}
        onItemClick={onItemClick}
      />

      {/* ─── 시장을 움직이는 뉴스 (종목 연결 카드) ──────────── */}
      <NewsFeedWidget allNews={allNews} onNewsClick={onNewsClick} allItems={allItems} />

      {/* ─── 시장 투자자 동향 ─────────────────────────────── */}
      <MarketInvestorSection />

      {/* ─── 코인 거래소 공지 ─────────────────────────────── */}
      <CoinListingSection />

      {/* ─── 섹터 로테이션 (미리보기 + 펼치기) ────────────── */}
      {(krStocks.length > 0 || usStocks.length > 0 || coins.length > 0) && (
        <div className="relative">
          {/* 미리보기: 항상 헤더 + 상위 3개 HOT 섹터 표시 */}
          <div className={sectorExpanded ? '' : 'max-h-[160px] overflow-hidden'}>
            <SectorRotation krStocks={krStocks} usStocks={usStocks} coins={coins} />
          </div>
          {/* 접힌 상태일 때 하단 페이드 + 펼치기 버튼 */}
          {!sectorExpanded && (
            <div className="absolute bottom-0 left-0 right-0">
              <div className="h-12 bg-gradient-to-t from-white to-transparent" />
              <button
                onClick={() => setSectorExpanded(true)}
                className="w-full flex items-center justify-center gap-1 py-2 bg-white text-[12px] font-medium text-[#3182F6] hover:text-[#1764ED] transition-colors"
              >
                <span>섹터 로테이션 전체보기</span>
                <span className="text-[10px]">▼</span>
              </button>
            </div>
          )}
          {sectorExpanded && (
            <button
              onClick={() => setSectorExpanded(false)}
              className="w-full flex items-center justify-center gap-1 py-2 text-[12px] text-[#8B95A1] hover:text-[#4E5968] transition-colors"
            >
              <span>접기</span>
              <span className="text-[10px]">▲</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
