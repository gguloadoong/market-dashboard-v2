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
import GlobalSearch from './components/GlobalSearch';

import { KOREAN_STOCKS, US_STOCKS_INITIAL, COINS_INITIAL, ETF_DATA, INDICES_INITIAL } from './data/mock';
import { fetchCoins, fetchCoinsUpbitOnly, fetchExchangeRate, fetchUpbitAllSymbols } from './api/coins';
import { fetchUsStocksBatch, fetchKoreanStocksBatch, fetchIndices } from './api/stocks';
import { subscribeCoinPrices, unsubscribeCoinPrices } from './api/coinWs';
import { requestNotificationPermission, checkAndAlertBatch, getNotificationPermission } from './utils/priceAlert';

const US_SYMBOLS = US_STOCKS_INITIAL.map(s => s.symbol);
// ETF 목록은 정적 데이터 — 컴포넌트 외부에서 한 번만 계산
const ETF_ITEMS  = ETF_DATA.map(e => ({ ...e, marketCap: e.aum }));


export default function App() {
  const [activeTab, setActiveTab]         = useState('home');
  const [coins, setCoins]                 = useState(COINS_INITIAL);
  const [usStocks, setUsStocks]           = useState(US_STOCKS_INITIAL);
  const [krStocks, setKrStocks]           = useState(KOREAN_STOCKS);
  // etfs는 정적 데이터 — state 불필요 (모듈 레벨 ETF_ITEMS 사용)
  const etfs = ETF_DATA;
  const [indices, setIndices]             = useState(INDICES_INITIAL);
  const [krwRate, setKrwRate]             = useState(1466);
  const [lastUpdated, setLastUpdated]     = useState(null);
  const [loading, setLoading]             = useState(false);
  const [selectedItem, setSelectedItem]   = useState(null);
  const [searchOpen, setSearchOpen]       = useState(false);
  // 알림 권한 차단 시 복구 배너 표시 여부
  const [notifBanner, setNotifBanner]     = useState(() => {
    const perm = getNotificationPermission();
    const dismissed = sessionStorage.getItem('notif-banner-dismissed');
    return perm === 'denied' && !dismissed;
  });
  const loadingRef  = useRef(false);
  const krwRateRef  = useRef(1466); // WS 핸들러에서 클로저 없이 최신 환율 참조
  const wsThrottleRef = useRef({}); // 심볼별 마지막 WS 업데이트 시각 (100ms throttle)

  // ── 코인 빠른 갱신 — Upbit만 (10초, 가격·등락률만 업데이트) ──
  // krwRateRef 사용 → krwRate state dep 불필요 (환율 변경 시 interval 재설정 방지)
  const refreshCoinsQuick = useCallback(async () => {
    try {
      const rate = await fetchExchangeRate().catch(() => krwRateRef.current);
      setKrwRate(rate);
      krwRateRef.current = rate;
      setCoins(prev => {
        if (!prev.length) return prev;
        fetchCoinsUpbitOnly(prev, rate)
          .then(data => {
            if (data.length) {
              setCoins(data);
              // 코인 급등/급락 브라우저 알림 체크 (폴링에서만, WS 틱 아님)
              checkAndAlertBatch(data, 'coin');
            }
          })
          .catch(() => {});
        return prev;
      });
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 코인 전체 갱신 — CoinGecko 포함 (60초, 시총·스파크라인 포함) ──
  const refreshCoins = useCallback(async () => {
    try {
      const rate = await fetchExchangeRate().catch(() => krwRateRef.current);
      setKrwRate(rate);
      krwRateRef.current = rate;
      const data = await fetchCoins(rate);
      if (data.length > 0) {
        setCoins(prev => data.map(c => {
          const old = prev.find(p => p.id === c.id);
          return { ...c, sparkline: c.sparkline?.length ? c.sparkline : old?.sparkline ?? [] };
        }));
      }
    } catch (e) { console.warn('코인 전체갱신 실패 (캐시 사용):', e.message); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 미장 갱신 (30초) ────────────────────────────────────────
  const refreshUsStocks = useCallback(async () => {
    try {
      const data = await fetchUsStocksBatch(US_SYMBOLS);
      if (data.length > 0) {
        setUsStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          return u?.price ? { ...s, ...u, sparkline: u.sparkline?.length ? u.sparkline : s.sparkline } : s;
        }));
        checkAndAlertBatch(data, 'us');
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
        checkAndAlertBatch(data, 'kr');
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
  }, [refreshCoins, refreshUsStocks, refreshKoreanStocks, refreshIndices]); // eslint-disable-line react-hooks/exhaustive-deps

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
  useEffect(() => { const id = setInterval(refreshIndices,     60000); return () => clearInterval(id); }, [refreshIndices]);

  // 환율 변경 시 ref 동기화 (WS 핸들러에서 클로저 없이 사용)
  useEffect(() => { krwRateRef.current = krwRate; }, [krwRate]);

  // ── 브라우저 알림 권한 요청 (초기 1회) ──────────────────────────
  useEffect(() => { requestNotificationPermission(); }, []);

  // ── 탭 타이틀 동적 업데이트 — 급등 종목 있을 때 "⚡ BTC +5.2% — 마켓레이더" ──
  // Job 2 강화: 다른 탭에서 작업 중에도 탭 전환기로 급등 종목 인지
  // 1초 디바운스: Upbit WS 틱(<1초)마다 정렬 폭주 방지
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
      if (top && top.pct >= 3) {
        document.title = `⚡ ${top.name} +${top.pct.toFixed(1)}% — 마켓레이더`;
      } else if (top && top.pct <= -3) {
        document.title = `📉 ${top.name} ${top.pct.toFixed(1)}% — 마켓레이더`;
      } else {
        document.title = '마켓레이더';
      }
    }, 1000);
    return () => clearTimeout(titleTimerRef.current);
  }, [krStocks, usStocks, coins]);

  // ── 전역 종목 검색: `/` 키 → 검색 모달 ─────────────────────────
  useEffect(() => {
    const onKey = e => {
      // 입력 필드 포커스 중이면 무시 (검색창 자체 입력 방해하지 않도록)
      if (e.key !== '/' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      setSearchOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── Upbit WebSocket 코인 가격 실시간 스트림 ─────────────────────
  // 1단계: 초기 30개로 빠르게 구독 시작
  // 2단계: Upbit 전체 KRW 마켓 목록 로드 후 재구독 (200개+)
  useEffect(() => {
    let cancelled = false;

    const wsHandler = (tick) => {
      if (tick._connected) return;
      const now = Date.now();
      if (now - (wsThrottleRef.current[tick.symbol] ?? 0) < 100) return;
      wsThrottleRef.current[tick.symbol] = now;
      setCoins(prev => {
        const rate = krwRateRef.current;
        const idx  = prev.findIndex(c => c.symbol === tick.symbol);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          priceKrw:    tick.priceKrw,
          priceUsd:    tick.priceKrw / rate,
          change24h:   tick.change24h,
          priceSource: 'upbit-ws',
        };
        return updated;
      });
    };

    // 1단계: COINS_INITIAL 30개로 즉시 구독 (빠른 시작)
    subscribeCoinPrices(COINS_INITIAL.map(c => c.symbol), wsHandler);

    // 2단계: Upbit 전체 KRW 마켓 (~200개)으로 재구독
    fetchUpbitAllSymbols()
      .then(symbols => {
        if (!cancelled) subscribeCoinPrices(symbols, wsHandler);
      })
      .catch(() => {}); // 실패 시 초기 30개 유지

    return () => { cancelled = true; unsubscribeCoinPrices(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 탭별 종목 데이터 (all 탭 제거, home은 HomeDashboard가 담당) ───
  // ETF_ITEMS는 모듈 레벨 상수 — etfs dep 불필요 (렌더마다 새 배열 생성 방지)
  const tabItems = useMemo(() => {
    switch (activeTab) {
      case 'home': return [];
      case 'kr':   return krStocks;
      case 'us':   return usStocks;
      case 'coin': return coins;
      case 'etf':  return ETF_ITEMS;
      default:     return krStocks;
    }
  }, [activeTab, krStocks, usStocks, coins]);

  const allStocks = useMemo(() => [...krStocks, ...usStocks], [krStocks, usStocks]);

  // ChartSidePanel에 전달하는 데이터 맵 — 인라인 객체 생성 방지 (WS 틱마다 relatedItems 재계산 차단)
  const allData = useMemo(
    () => ({ krStocks, usStocks, coins, etfs }),
    [krStocks, usStocks, coins, etfs]
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* 급상승 배너 (sticky, z-20 — Header와 동일 레이어, DOM 순서상 Header가 위) */}
      <div className="sticky top-0 z-20">
        <SurgeBanner stocks={allStocks} coins={coins} onClick={setSelectedItem} />
      </div>

      {/* 알림 권한 차단 복구 배너 */}
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
          >
            닫기
          </button>
        </div>
      )}

      {/* 헤더 (sticky, z-20 — DOM 순서상 SurgeBanner 위에 쌓임) */}
      <Header
        krwRate={krwRate}
        lastUpdated={lastUpdated}
        onRefresh={refreshAll}
        loading={loading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        krStocks={krStocks}
        usStocks={usStocks}
        coins={coins}
      />

      {/* ── 반응형 그리드 레이아웃: 모바일 1열 / 데스크탑 2열 ─── */}
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* 좌: 콘텐츠 영역 */}
        <div className={`min-w-0 overflow-hidden ${activeTab === 'news' ? '' : 'p-5 space-y-4'}`}>
          {activeTab === 'home' ? (
            <HomeDashboard
              indices={indices}
              krStocks={krStocks}
              usStocks={usStocks}
              coins={coins}
              krwRate={krwRate}
              onItemClick={setSelectedItem}
            />
          ) : activeTab === 'news' ? (
            // 모바일 뉴스 탭 — 데스크탑 우측 패널과 동일한 컴포넌트, 모바일 전용
            <div className="lg:hidden h-[calc(100vh-112px)]">
              <BreakingNewsPanel coins={coins} onItemClick={setSelectedItem} />
            </div>
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
                loading={loading}
              />
            </>
          )}
        </div>

        {/* 우: 뉴스·속보 패널 — 모바일에서 숨김, 데스크탑에서 표시 */}
        <div
          className="hidden lg:block self-start"
          style={{ position: 'sticky', top: '84px', height: 'calc(100vh - 84px)' }}
        >
          <BreakingNewsPanel coins={coins} onItemClick={setSelectedItem} />
        </div>
      </div>

      {/* 차트 사이드 패널 (오버레이) */}
      {selectedItem && (
        <ChartSidePanel
          item={selectedItem}
          krwRate={krwRate}
          onClose={() => setSelectedItem(null)}
          onRelatedClick={setSelectedItem}
          allData={allData}
        />
      )}

      {/* 전역 종목 검색 모달 — `/` 키로 열기 */}
      {searchOpen && (
        <GlobalSearch
          krStocks={krStocks}
          usStocks={usStocks}
          coins={coins}
          etfs={ETF_ITEMS}
          krwRate={krwRate}
          onSelect={setSelectedItem}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
