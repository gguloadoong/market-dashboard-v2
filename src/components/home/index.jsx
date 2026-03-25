import { useMemo } from 'react';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { useWatchlist } from '../../hooks/useWatchlist';
import { getPct } from './utils';
import MarketPulseWidget from './widgets/MarketPulseWidget';
import WatchlistWidget from './widgets/WatchlistWidget';
import TopMoversWidget from './widgets/TopMoversWidget';
import NewsFeedWidget from './widgets/NewsFeedWidget';
import NotableMoversSection from './NotableMoversSection';
import MarketInvestorSection from './MarketInvestorSection';
import EarlySignalSection from './EarlySignalSection';
import EventTicker from './EventTicker';
import CoinListingSection from './CoinListingSection';

// ─── 섹터 미니 위젯 (HOT 3 + COLD 3 칩 → 섹터 탭 유도) ──
function SectorMiniWidget({ krStocks, usStocks, coins, onTabChange }) {
  const sectors = useMemo(() => {
    const coinsWithPct = coins.filter(c => c.sector).map(c => ({ ...c, changePct: c.change24h ?? 0 }));
    const items = [...krStocks, ...usStocks, ...coinsWithPct];
    const map = {};
    for (const s of items) {
      if (!s.sector) continue;
      if (!map[s.sector]) map[s.sector] = { sum: 0, count: 0 };
      map[s.sector].sum += s.changePct ?? 0;
      map[s.sector].count += 1;
    }
    return Object.entries(map)
      .map(([name, { sum, count }]) => ({ name, avg: parseFloat((sum / count).toFixed(2)) }))
      .sort((a, b) => b.avg - a.avg);
  }, [krStocks, usStocks, coins]);

  if (!sectors.length) return null;

  const hot  = sectors.filter(s => s.avg > 0).slice(0, 3);
  const cold = [...sectors.filter(s => s.avg <= 0)].reverse().slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#191F28]">섹터 자금 흐름</span>
          <span className="text-[10px] text-[#B0B8C1]">HOT · COLD</span>
        </div>
        <button
          onClick={() => onTabChange?.('sector')}
          className="text-[11px] text-[#3182F6] font-medium hover:underline"
        >섹터 탭에서 상세 →</button>
      </div>
      <div className="flex gap-4">
        {/* HOT */}
        <div className="flex-1">
          <span className="text-[10px] font-bold text-[#F04452] uppercase mb-1.5 block">HOT</span>
          <div className="flex flex-wrap gap-1.5">
            {hot.length > 0 ? hot.map(s => (
              <span key={s.name} className="text-[11px] font-medium px-2 py-1 rounded-lg bg-[#FFF0F1] text-[#F04452]">
                {s.name} +{s.avg.toFixed(1)}%
              </span>
            )) : <span className="text-[10px] text-[#B0B8C1]">없음</span>}
          </div>
        </div>
        {/* COLD */}
        <div className="flex-1">
          <span className="text-[10px] font-bold text-[#1764ED] uppercase mb-1.5 block">COLD</span>
          <div className="flex flex-wrap gap-1.5">
            {cold.length > 0 ? cold.map(s => (
              <span key={s.name} className="text-[11px] font-medium px-2 py-1 rounded-lg bg-[#EDF4FF] text-[#1764ED]">
                {s.name} {s.avg.toFixed(1)}%
              </span>
            )) : <span className="text-[10px] text-[#B0B8C1]">없음</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [], etfs = [],
  krwRate = 1466, onItemClick, onNewsClick, onTabChange,
}) {
  const { data: allNews = [] } = useAllNewsQuery();
  const { watchlist, toggle, isWatched } = useWatchlist();

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
      if (result.length >= 3) break;
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

      {/* ─── 관심종목 + 섹터 흐름 (2열 나란히, 모바일은 세로) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WatchlistWidget
          watchedItems={watchedItems}
          popularItems={popularItems}
          toggle={toggle}
          onItemClick={onItemClick}
          krwRate={krwRate}
        />
        {(krStocks.length > 0 || usStocks.length > 0 || coins.length > 0) && (
          <SectorMiniWidget krStocks={krStocks} usStocks={usStocks} coins={coins} onTabChange={onTabChange} />
        )}
      </div>

      {/* ─── 선행 신호 — 뉴스 나왔지만 주가 미반응 종목 ─── */}
      {hasData && (
        <EarlySignalSection
          allItems={allItems}
          recentNews={recentNews}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      )}

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

      {/* ─── 시장 투자자 동향 (모바일 숨김) ────────────────── */}
      <div className="hidden md:block">
        <MarketInvestorSection />
      </div>

      {/* ─── 코인 거래소 공지 (모바일 숨김) ────────────────── */}
      <div className="hidden md:block">
        <CoinListingSection />
      </div>
    </div>
  );
}
