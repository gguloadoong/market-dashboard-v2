// 마켓레이더 — 메인 앱 (훅 기반 상태 관리)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Header from './components/Header';
import MobileBottomNav from './components/MobileBottomNav';
import SurgeBanner from './components/SurgeBanner';
import MarketSummaryBar from './components/MarketSummaryBar';
import WatchlistTable from './components/WatchlistTable';
import BreakingNewsPanel from './components/BreakingNewsPanel';
import ChartSidePanel from './components/ChartSidePanel';
import NewsSidePanel from './components/NewsSidePanel';
import HomeDashboard from './components/home';
import GlobalSearch from './components/GlobalSearch';
import SectorRotation from './components/SectorRotation';

import { ETF_DATA } from './data/mock';
import { fetchKoreanStocksBatch, fetchEtfPricesBatch } from './api/stocks';
import { requestNotificationPermission, getNotificationPermission, setAlertWatchlistIds } from './utils/priceAlert';
import { useWatchlist } from './hooks/useWatchlist';
import { useNewsAlerts } from './hooks/useNewsAlerts';
import { useDarkMode } from './hooks/useDarkMode';
import { useKrxEtf } from './hooks/useKrxEtf';
import { useKisWebSocket } from './hooks/useKisWebSocket';
import { useKisUsWebSocket } from './hooks/useKisUsWebSocket';
import { usePrices } from './hooks/usePrices';
import { useCoins } from './hooks/useCoins';
import { useIndices } from './hooks/useIndices';
import { KOREAN_STOCKS } from './data/mock';

export default function App() {
  const { dark, toggle: toggleDark } = useDarkMode();
  const { watchlist, krSymbols, usSymbols } = useWatchlist();
  const { indices, krwRate }        = useIndices();
  const krwRateRef                  = useRef(1466);
  useEffect(() => { krwRateRef.current = krwRate; }, [krwRate]);

  const { coins, setCoins: _setCoins, coinError, refreshCoins } = useCoins(krwRateRef);
  const {
    usStocks, setUsStocks, krStocks, setKrStocks,
    dataErrors, setDataErrors: _setDataErrors,
    krSymbolsRef, usSymbolsRef, refreshUsStocks, refreshKoreanStocks,
  } = usePrices();

  // watchlist 심볼 동기화
  useEffect(() => { krSymbolsRef.current = krSymbols; }, [krSymbols, krSymbolsRef]);
  useEffect(() => { usSymbolsRef.current = usSymbols; }, [usSymbols, usSymbolsRef]);

  const { data: krxEtfs = [] } = useKrxEtf();
  const [activeTab, setActiveTab]       = useState('home');
  const [etfs, setEtfs]                 = useState(ETF_DATA);
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [loading, setLoading]           = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedNews, setSelectedNews] = useState(null);
  const [newsContext, setNewsContext]   = useState(null); // 뉴스에서 종목 클릭 시 뉴스 맥락 전달
  const [searchOpen, setSearchOpen]     = useState(false);
  const [notifBanner, setNotifBanner]   = useState(() => {
    const perm = getNotificationPermission();
    const dismissed = sessionStorage.getItem('notif-banner-dismissed');
    return perm === 'denied' && !dismissed;
  });
  const loadingRef = useRef(false);

  // KIS WebSocket — watchlist KR 우선
  const kisSymbols = useMemo(() => {
    const combined = [...new Set([...krSymbols, ...KOREAN_STOCKS.map(s => s.symbol)])];
    return combined.slice(0, 40); // H0STCNT0 세션당 최대 40개
  }, [krSymbols]);
  useKisWebSocket(kisSymbols, useCallback((quote) => {
    setKrStocks(prev => prev.map(s => s.symbol === quote.symbol ? { ...s, ...quote } : s));
  }, []));

  // KIS WebSocket HDFSCNT0 — 미장 실시간 (watchlist 우선, 최대 40개)
  const kisUsSymbols = useMemo(() => {
    const defaultTop = ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AVGO',
                        'JPM','NFLX','AMD','V','MA','LLY','WMT','XOM','PLTR','ARM'];
    const combined = [...new Set([...usSymbols, ...defaultTop])];
    return combined.slice(0, 40);
  }, [usSymbols]);
  useKisUsWebSocket(kisUsSymbols, useCallback((quote) => {
    setUsStocks(prev => prev.map(s => s.symbol === quote.symbol ? { ...s, ...quote } : s));
  }, []));

  // ETF 폴링 (60초)
  const KR_ETFS         = useMemo(() => ETF_DATA.filter(e => e.market === 'kr'), []);
  const US_ETF_SYMBOLS  = useMemo(() => ETF_DATA.filter(e => e.market === 'us').map(e => e.symbol), []);
  const refreshEtfs = useCallback(async () => {
    const [krResult, usResult] = await Promise.allSettled([
      KR_ETFS.length > 0 ? fetchKoreanStocksBatch(KR_ETFS) : Promise.resolve([]),
      US_ETF_SYMBOLS.length > 0 ? fetchEtfPricesBatch(US_ETF_SYMBOLS) : Promise.resolve([]),
    ]);
    const allFresh = [
      ...(krResult.status === 'fulfilled' ? krResult.value : []),
      ...(usResult.status === 'fulfilled' ? usResult.value : []),
    ];
    if (allFresh.length > 0) {
      setEtfs(prev => prev.map(etf => {
        const f = allFresh.find(s => s.symbol === etf.symbol);
        return f ? { ...etf, price: f.price, change: f.change, changePct: f.changePct } : etf;
      }));
    }
  }, [KR_ETFS, US_ETF_SYMBOLS]);

  useEffect(() => { refreshEtfs(); const id = setInterval(() => { if (!document.hidden) refreshEtfs(); }, 60000); return () => clearInterval(id); }, [refreshEtfs]);

  // 전체 갱신
  const refreshAll = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await Promise.allSettled([refreshCoins(), refreshUsStocks(), refreshKoreanStocks()]);
      setLastUpdated(Date.now());
    } finally { setLoading(false); loadingRef.current = false; }
  }, [refreshCoins, refreshUsStocks, refreshKoreanStocks]);

  // 알림 권한
  useEffect(() => { requestNotificationPermission(); }, []);
  useEffect(() => { setAlertWatchlistIds(watchlist); }, [watchlist]);

  // 탭 타이틀 업데이트
  const titleTimerRef = useRef(null);
  useEffect(() => {
    clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      const all = [
        ...krStocks.map(s => ({ name: s.name || s.symbol, pct: s.changePct ?? 0 })),
        ...usStocks.map(s => ({ name: s.name || s.symbol, pct: s.changePct ?? 0 })),
        ...coins.map(c =>   ({ name: c.name  || c.symbol, pct: c.change24h ?? 0 })),
      ].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
      const top = all[0];
      if (top?.pct >= 3)       document.title = `⚡ ${top.name} +${top.pct.toFixed(1)}% — 마켓레이더`;
      else if (top?.pct <= -3) document.title = `📉 ${top.name} ${top.pct.toFixed(1)}% — 마켓레이더`;
      else                     document.title = '마켓레이더';
    }, 1000);
    return () => clearTimeout(titleTimerRef.current);
  }, [krStocks, usStocks, coins]);

  // `/` 키 → 검색
  useEffect(() => {
    const onKey = e => {
      if (e.key !== '/' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault(); setSearchOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // 알림 클릭 딥링크 — priceAlert.js 'alert-open-item' 이벤트 수신 → ChartSidePanel 오픈
  useEffect(() => {
    const onAlertOpen = e => { if (e.detail) setSelectedItem(e.detail); };
    window.addEventListener('alert-open-item', onAlertOpen);
    return () => window.removeEventListener('alert-open-item', onAlertOpen);
  }, []);

  // 뉴스 알림 클릭 딥링크 — useNewsAlerts 'alert-open-news' 이벤트 수신 → NewsSidePanel 오픈
  useEffect(() => {
    const onNewsAlertOpen = e => { if (e.detail) setSelectedNews(e.detail); };
    window.addEventListener('alert-open-news', onNewsAlertOpen);
    return () => window.removeEventListener('alert-open-news', onNewsAlertOpen);
  }, []);

  // 관심종목 뉴스 알림 — watchlist에 있는 종목 필터링 후 useNewsAlerts에 주입
  const watchedItemsForAlert = useMemo(() => {
    const watchSet = new Set(watchlist.map(w => (typeof w === 'string' ? w : w.symbol)));
    return [
      ...krStocks.filter(s => watchSet.has(s.symbol)).map(s => ({ ...s, _market: 'KR' })),
      ...usStocks.filter(s => watchSet.has(s.symbol)).map(s => ({ ...s, _market: 'US' })),
      ...coins.filter(c => watchSet.has(c.symbol)).map(c => ({ ...c, _market: 'COIN' })),
    ];
  }, [watchlist, krStocks, usStocks, coins]);
  useNewsAlerts(watchedItemsForAlert);

  // ── 모바일 백버튼 처리 (History API) ──────────────────────────
  // 패널/검색이 열릴 때 history entry 추가 → 뒤로가기 시 앱 닫힘 방지
  // closingViaUI: X 버튼으로 닫을 때 history.back()에 의한 popstate 중복 처리 방지
  const closingViaUI = useRef(false);

  useEffect(() => {
    if (selectedItem) history.pushState({ panel: 'chart' }, '');
  }, [selectedItem]);

  useEffect(() => {
    if (selectedNews) history.pushState({ panel: 'news' }, '');
  }, [selectedNews]);

  useEffect(() => {
    if (searchOpen) history.pushState({ panel: 'search' }, '');
  }, [searchOpen]);

  useEffect(() => {
    const onPop = () => {
      // X 버튼 닫기 → history.back() → popstate 중복 차단
      if (closingViaUI.current) { closingViaUI.current = false; return; }
      // 열린 패널을 역순으로 닫음 (검색 → 뉴스 → 차트)
      if (searchOpen)   { setSearchOpen(false);  return; }
      if (selectedNews) { setSelectedNews(null); return; }
      if (selectedItem) { setSelectedItem(null); return; }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [searchOpen, selectedNews, selectedItem]);

  // 뉴스에서 종목 클릭 — 뉴스 맥락 함께 전달
  const handleNewsRelatedClick = useCallback((item) => {
    setNewsContext(selectedNews);
    setSelectedItem(item);
  }, [selectedNews]);

  // ChartSidePanel 관련종목 클릭 — 뉴스 맥락 초기화 후 새 종목 열기
  const handleChartRelatedClick = useCallback((item) => {
    setNewsContext(null);
    setSelectedItem(item);
  }, []);

  // X 버튼 close 핸들러 — history entry도 함께 소비
  const closeSelectedItem = useCallback(() => {
    closingViaUI.current = true;
    setSelectedItem(null);
    setNewsContext(null);
    history.back();
  }, []);
  const closeSelectedNews = useCallback(() => {
    closingViaUI.current = true;
    setSelectedNews(null);
    history.back();
  }, []);
  const closeSearch = useCallback(() => {
    closingViaUI.current = true;
    setSearchOpen(false);
    history.back();
  }, []);

  // KRX ETF 병합 — 기존 ETF_DATA + KRX 신규 ETF (중복 symbol 제거)
  const mergedEtfs = useMemo(() => {
    if (!krxEtfs.length) return etfs;
    const existingSymbols = new Set(etfs.map(e => e.symbol));
    const newEtfs = krxEtfs.filter(e => !existingSymbols.has(e.symbol));
    return [...etfs, ...newEtfs];
  }, [etfs, krxEtfs]);

  // 탭별 데이터
  const etfItems       = useMemo(() => mergedEtfs.map(e => ({ ...e, marketCap: e.aum })), [mergedEtfs]);
  const activeCoinData = activeTab === 'coin' ? coins : undefined;
  const tabItems       = useMemo(() => {
    switch (activeTab) {
      case 'home': return [];
      case 'kr':   return krStocks;
      case 'us':   return usStocks;
      case 'coin': return activeCoinData ?? [];
      case 'etf':  return etfItems;
      default:     return krStocks;
    }
  }, [activeTab, krStocks, usStocks, activeCoinData, etfItems]);
  const allStocks = useMemo(() => [...krStocks, ...usStocks], [krStocks, usStocks]);
  const allData   = useMemo(() => ({ krStocks, usStocks, coins, etfs: mergedEtfs }), [krStocks, usStocks, coins, mergedEtfs]);

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <div className="sticky top-0 z-20">
        <SurgeBanner stocks={allStocks} coins={coins} indices={indices} onClick={setSelectedItem} />
      </div>

      {notifBanner && (
        <div className="sticky top-0 z-[19] bg-[#FFF8E1] border-b border-[#FFD54F] px-4 py-2 flex items-center gap-3">
          <span className="text-[14px]">🔔</span>
          <p className="flex-1 text-[12px] text-[#7B5D00]">
            급등 알림이 차단되어 있어요.&nbsp;
            <span className="font-semibold">주소창 왼쪽 🔒 아이콘 → 알림 → 허용</span>으로 설정해 주세요.
          </p>
          <button
            onClick={() => { sessionStorage.setItem('notif-banner-dismissed', '1'); setNotifBanner(false); }}
            className="text-[12px] text-[#7B5D00] hover:text-[#3E2E00] font-medium px-2 py-1 rounded hover:bg-[#FFE082] transition-colors flex-shrink-0"
          >닫기</button>
        </div>
      )}

      <Header
        krwRate={krwRate} lastUpdated={lastUpdated} onRefresh={refreshAll} loading={loading}
        activeTab={activeTab} onTabChange={setActiveTab}
        krStocks={krStocks} usStocks={usStocks} coins={coins}
        dark={dark} onDarkToggle={toggleDark}
      />

      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        <div className={`min-w-0 overflow-hidden ${activeTab === 'news' ? '' : 'p-5 space-y-4'} lg:pb-0 pb-safe-nav`}>
          {activeTab === 'home' ? (
            <HomeDashboard
              indices={indices} krStocks={krStocks} usStocks={usStocks}
              coins={coins} etfs={mergedEtfs} krwRate={krwRate}
              onItemClick={setSelectedItem} onNewsClick={setSelectedNews}
              onTabChange={setActiveTab}
            />
          ) : activeTab === 'sector' ? (
            <SectorRotation krStocks={krStocks} usStocks={usStocks} coins={coins} />
          ) : activeTab === 'news' ? (
            <div className="lg:hidden h-[calc(100vh-112px)]">
              <BreakingNewsPanel coins={coins} onItemClick={setSelectedItem} onNewsClick={setSelectedNews} />
            </div>
          ) : (
            <>
              <MarketSummaryBar indices={indices} krwRate={krwRate} loading={loading && indices.every(i => !i.value)} />
              <WatchlistTable
                key={activeTab} items={tabItems} type={activeTab} krwRate={krwRate}
                onRowClick={setSelectedItem} loading={loading}
                dataError={activeTab === 'kr' ? dataErrors.kr : activeTab === 'us' ? dataErrors.us : activeTab === 'coin' ? coinError : false}
                onRetry={activeTab === 'kr' ? refreshKoreanStocks : activeTab === 'us' ? refreshUsStocks : activeTab === 'coin' ? refreshCoins : undefined}
              />
            </>
          )}
        </div>

        <div className="hidden lg:block self-start" style={{ position: 'sticky', top: '84px', height: 'calc(100vh - 84px)' }}>
          <BreakingNewsPanel coins={coins} onItemClick={setSelectedItem} onNewsClick={setSelectedNews} />
        </div>
      </div>

      {selectedItem && (
        <ChartSidePanel item={selectedItem} krwRate={krwRate} onClose={closeSelectedItem} onRelatedClick={handleChartRelatedClick} allData={allData} newsContext={newsContext} />
      )}
      {selectedNews && (
        <NewsSidePanel news={selectedNews} allData={allData} krwRate={krwRate} onClose={closeSelectedNews} onRelatedClick={handleNewsRelatedClick} onNewsClick={setSelectedNews} />
      )}
      {searchOpen && (
        <GlobalSearch krStocks={krStocks} usStocks={usStocks} coins={coins} etfs={etfItems} krwRate={krwRate} onSelect={setSelectedItem} onNewsClick={setSelectedNews} onClose={closeSearch} />
      )}

      {/* 모바일 하단 내비게이션 */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        krStocks={krStocks}
        usStocks={usStocks}
        coins={coins}
      />
    </div>
  );
}
