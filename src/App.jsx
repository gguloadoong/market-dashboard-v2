// 마켓레이더 — 데스크탑 2열 레이아웃
// 좌: 마켓바 + 워치리스트 테이블
// 우: 뉴스·속보 패널 (고정)
// 오버레이: 차트 사이드 패널 (종목 클릭 시)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Header from './components/Header';
import SurgeBanner from './components/SurgeBanner';
import MarketSummaryBar from './components/MarketSummaryBar';
import WatchlistTable from './components/WatchlistTable';
import BreakingNewsPanel from './components/BreakingNewsPanel';
import ChartSidePanel from './components/ChartSidePanel';
import HomeDashboard from './components/HomeDashboard';

import { KOREAN_STOCKS, US_STOCKS_INITIAL, COINS_INITIAL, ETF_DATA, INDICES_INITIAL } from './data/mock';
import { fetchCoins, fetchCoinsUpbitOnly, fetchExchangeRate } from './api/coins';
import { fetchUsStocksBatch, fetchKoreanStocksBatch, fetchIndices } from './api/stocks';
import { getKoreanMarketStatus, getUsMarketStatus } from './utils/marketHours';

const US_SYMBOLS = US_STOCKS_INITIAL.map(s => s.symbol);

// 장 외 시간에도 국장 데이터 소폭 변동 시뮬레이션
function simulateKorean(stocks) {
  return stocks.map(s => {
    const delta    = s.price * (Math.random() - 0.5) * 0.003;
    const newPrice = Math.round(s.price + delta);
    const base     = newPrice - s.change;
    return {
      ...s,
      price:     newPrice,
      change:    Math.round(s.change + delta * 0.7),
      changePct: base > 0 ? parseFloat(((newPrice - base) / base * 100).toFixed(2)) : s.changePct,
      sparkline: [...(s.sparkline ?? []).slice(1), newPrice],
    };
  });
}

export default function App() {
  const [activeTab, setActiveTab]         = useState('home');
  const [coins, setCoins]                 = useState(COINS_INITIAL);
  const [usStocks, setUsStocks]           = useState(US_STOCKS_INITIAL);
  const [krStocks, setKrStocks]           = useState(KOREAN_STOCKS);
  const [etfs]                            = useState(ETF_DATA);
  const [indices, setIndices]             = useState(INDICES_INITIAL);
  const [krwRate, setKrwRate]             = useState(1466);
  const [lastUpdated, setLastUpdated]     = useState(null);
  const [loading, setLoading]             = useState(false);
  const [selectedItem, setSelectedItem]   = useState(null);
  const loadingRef = useRef(false);

  // ── 코인 빠른 갱신 — Upbit만 (10초, 가격·등락률만 업데이트) ──
  const refreshCoinsQuick = useCallback(async () => {
    try {
      const rate = await fetchExchangeRate().catch(() => krwRate);
      setKrwRate(rate);
      setCoins(prev => {
        if (!prev.length) return prev;
        // 비동기 업데이트: 완료 후 state 반영
        fetchCoinsUpbitOnly(prev, rate)
          .then(data => { if (data.length) setCoins(data); })
          .catch(() => {});
        return prev; // 즉시 이전 값 유지
      });
    } catch {}
  }, [krwRate]);

  // ── 코인 전체 갱신 — CoinGecko 포함 (60초, 시총·스파크라인 포함) ──
  const refreshCoins = useCallback(async () => {
    try {
      const rate = await fetchExchangeRate().catch(() => krwRate);
      setKrwRate(rate);
      const data = await fetchCoins(rate);
      if (data.length > 0) {
        setCoins(prev => data.map(c => {
          const old = prev.find(p => p.id === c.id);
          return { ...c, sparkline: c.sparkline?.length ? c.sparkline : old?.sparkline ?? [] };
        }));
      }
    } catch (e) { console.warn('코인 전체갱신 실패 (캐시 사용):', e.message); }
  }, [krwRate]);

  // ── 미장 갱신 (30초) ────────────────────────────────────────
  const refreshUsStocks = useCallback(async () => {
    try {
      const data = await fetchUsStocksBatch(US_SYMBOLS);
      if (data.length > 0) {
        setUsStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          return u?.price ? { ...s, ...u, sparkline: u.sparkline?.length ? u.sparkline : s.sparkline } : s;
        }));
      }
    } catch (e) { console.warn('미장 갱신 실패:', e.message); }
  }, []);

  // ── 국장 갱신 (30초) ────────────────────────────────────────
  const refreshKoreanStocks = useCallback(async () => {
    try {
      const data = await fetchKoreanStocksBatch(KOREAN_STOCKS);
      if (data.length > 0) {
        setKrStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          return u?.price ? { ...s, ...u, sparkline: [...s.sparkline.slice(1), u.price] } : s;
        }));
      }
    } catch (e) { console.warn('국장 갱신 실패:', e.message); }
  }, []);

  // ── 지수 갱신 (60초) ────────────────────────────────────────
  const refreshIndices = useCallback(async () => {
    try {
      const data = await fetchIndices();
      if (data.length > 0) {
        setIndices(prev => prev.map(idx => ({ ...idx, ...(data.find(d => d.id === idx.id) ?? {}) })));
      }
    } catch (e) { console.warn('지수 갱신 실패:', e.message); }
  }, []);

  // ── 전체 갱신 ────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await Promise.allSettled([
        refreshCoins(),
        refreshUsStocks(),
        refreshKoreanStocks(),
        refreshIndices(),
      ]);
      setLastUpdated(Date.now());
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [refreshCoins, refreshUsStocks, refreshKoreanStocks, refreshIndices]);

  // ── 초기 로드 + 폴링 인터벌 ─────────────────────────────────
  useEffect(() => { refreshAll(); }, [refreshAll]);
  // 코인 가격·등락률: Upbit만 10초 (CoinGecko 레이트리밋 방지)
  useEffect(() => {
    const id = setInterval(() => refreshCoinsQuick().then(() => setLastUpdated(Date.now())), 10000);
    return () => clearInterval(id);
  }, [refreshCoinsQuick]);
  // 코인 시총·스파크라인: CoinGecko 포함 60초
  useEffect(() => { const id = setInterval(refreshCoins, 60000); return () => clearInterval(id); }, [refreshCoins]);
  useEffect(() => { const id = setInterval(refreshUsStocks,    30000); return () => clearInterval(id); }, [refreshUsStocks]);
  useEffect(() => { const id = setInterval(refreshKoreanStocks,30000); return () => clearInterval(id); }, [refreshKoreanStocks]);
  // 국장 시뮬레이션: 장 외 시간에만 실행 (장 중에는 실제 API 데이터 사용)
  useEffect(() => {
    const id = setInterval(() => {
      const { status } = getKoreanMarketStatus();
      if (status !== 'open') {
        setKrStocks(p => simulateKorean(p));
      }
    }, 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { const id = setInterval(refreshIndices,     60000); return () => clearInterval(id); }, [refreshIndices]);

  // ── 탭별 종목 데이터 (all 탭 제거, home은 HomeDashboard가 담당) ───
  const tabItems = useMemo(() => {
    switch (activeTab) {
      case 'home': return [];
      case 'kr':   return krStocks;
      case 'us':   return usStocks;
      case 'coin': return coins;
      case 'etf':  return etfs.map(e => ({ ...e, marketCap: e.aum }));
      default:     return krStocks;
    }
  }, [activeTab, krStocks, usStocks, coins, etfs]);

  const allStocks = [...krStocks, ...usStocks];

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* 급상승 배너 (sticky, z-30 — 차트 패널 z-150보다 낮게) */}
      <div className="sticky top-0 z-30">
        <SurgeBanner stocks={allStocks} coins={coins} />
      </div>

      {/* 헤더 (sticky, z-20) */}
      <Header
        krwRate={krwRate}
        lastUpdated={lastUpdated}
        onRefresh={refreshAll}
        loading={loading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* ── 반응형 그리드 레이아웃: 모바일 1열 / 데스크탑 2열 ─── */}
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* 좌: 콘텐츠 영역 */}
        <div className="p-5 space-y-4 min-w-0 overflow-hidden">
          {activeTab === 'home' ? (
            <HomeDashboard
              indices={indices}
              krStocks={krStocks}
              usStocks={usStocks}
              coins={coins}
              krwRate={krwRate}
              onItemClick={setSelectedItem}
            />
          ) : (
            <>
              <MarketSummaryBar
                indices={indices}
                krwRate={krwRate}
                loading={loading && indices.every(i => !i.value)}
              />
              <WatchlistTable
                key={activeTab}
                items={tabItems}
                type={activeTab}
                krwRate={krwRate}
                onRowClick={setSelectedItem}
              />
            </>
          )}
        </div>

        {/* 우: 뉴스·속보 패널 — 모바일에서 숨김, 데스크탑에서 표시 */}
        <div
          className="hidden lg:block self-start"
          style={{ position: 'sticky', top: '84px', height: 'calc(100vh - 84px)' }}
        >
          <BreakingNewsPanel />
        </div>
      </div>

      {/* 차트 사이드 패널 (오버레이) */}
      {selectedItem && (
        <ChartSidePanel
          item={selectedItem}
          krwRate={krwRate}
          onClose={() => setSelectedItem(null)}
          onRelatedClick={setSelectedItem}
          allData={{ krStocks, usStocks, coins, etfs }}
        />
      )}
    </div>
  );
}
