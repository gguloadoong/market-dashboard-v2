// 미국·국내 주식 가격 폴링 훅
import { useState, useEffect, useCallback, useRef } from 'react';
import { US_STOCK_LIST } from '../data/usStockList';
import { fetchSnapshot } from '../api/snapshot';
import { fetchUsStocksBatch, fetchKoreanStocksBatch } from '../api/stocks';
import { checkAndAlertBatch } from '../utils/priceAlert';
import { POLLING } from '../constants/polling';

// ─── localStorage 가격 캐시 (구조 변경 시 버전 업) ──────────
const CACHE_KEY_US = 'prices_us_v1';
const CACHE_KEY_KR = 'prices_kr_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간

function loadPriceCache(key, defaultData) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultData;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return defaultData; // 만료
    if (!data?.length) return defaultData;
    // defaultData가 비어있으면 캐시 데이터 그대로 반환
    if (defaultData.length === 0) return data;
    // defaultData의 구조에 캐시 가격을 덮어씌움
    return defaultData.map(s => {
      const cached = data.find(c => c.symbol === s.symbol);
      return cached?.price ? { ...s, ...cached } : s;
    });
  } catch { return defaultData; }
}

function savePriceCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

export function usePrices() {
  const [usStocks, setUsStocks]   = useState(() => loadPriceCache(CACHE_KEY_US, []));
  const [krStocks, setKrStocks]   = useState(() => loadPriceCache(CACHE_KEY_KR, []));
  const [pricesReady, setPricesReady] = useState(false);
  const [dataErrors, setDataErrors] = useState({ kr: false, us: false });
  // 최신 watchlist 심볼 — 클로저 없이 참조 (App이 주입)
  const krSymbolsRef = useRef([]);
  const usSymbolsRef = useRef([]);

  const refreshUsStocks = useCallback(async () => {
    try {
      // 기본 목록 + watchlist US 심볼 합산
      const baseSymbols = usStocks.length > 0
        ? usStocks.map(s => s.symbol)
        : US_STOCK_LIST.map(s => s.symbol);
      const extraSymbols = usSymbolsRef.current.filter(
        sym => !baseSymbols.includes(sym)
      );
      const symbolsToFetch = [...baseSymbols, ...extraSymbols];
      if (symbolsToFetch.length === 0) return; // snapshot 아직 안 왔으면 skip
      const data = await fetchUsStocksBatch(symbolsToFetch);
      if (data.length > 0) {
        setUsStocks(prev => {
          const map = new Map(prev.map(s => [s.symbol, s]));
          for (const u of data) {
            if (!u?.price) continue;
            if (map.has(u.symbol)) {
              const old = map.get(u.symbol);
              map.set(u.symbol, { ...old, ...u, sparkline: u.sparkline?.length ? u.sparkline : old.sparkline });
            } else {
              // watchlist에서 새로 추가된 미장 종목
              map.set(u.symbol, { symbol: u.symbol, name: u.name || u.symbol, market: 'us', sparkline: [], ...u });
            }
          }
          return [...map.values()];
        });
        savePriceCache(CACHE_KEY_US, data);
        checkAndAlertBatch(data, 'us');
        setDataErrors(prev => ({ ...prev, us: false }));
      } else {
        setDataErrors(prev => ({ ...prev, us: true }));
      }
    } catch { setDataErrors(prev => ({ ...prev, us: true })); }
  }, [usStocks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshKoreanStocks = useCallback(async () => {
    try {
      const extraSymbols = krSymbolsRef.current.filter(
        sym => !krStocks.some(s => s.symbol === sym)
      );
      const stocksToFetch = [
        ...(krStocks.length > 0 ? krStocks : []),
        ...extraSymbols.map(sym => ({ symbol: sym, name: sym, market: 'kr', price: 0, sparkline: [] })),
      ].filter((s, i, arr) => arr.findIndex(x => x.symbol === s.symbol) === i);
      if (stocksToFetch.length === 0) return; // snapshot 아직 안 왔으면 skip
      const data = await fetchKoreanStocksBatch(stocksToFetch);
      if (data.length > 0) {
        setKrStocks(prev => {
          const map = new Map(prev.map(s => [s.symbol, s]));
          for (const u of data) {
            if (!u?.price) continue;
            if (map.has(u.symbol)) {
              const old = map.get(u.symbol);
              map.set(u.symbol, { ...old, ...u, sparkline: [...(old.sparkline?.slice(1) ?? []), u.price] });
            } else {
              map.set(u.symbol, { symbol: u.symbol, name: u.name || u.symbol, market: 'kr', sparkline: [u.price], ...u });
            }
          }
          return [...map.values()];
        });
        savePriceCache(CACHE_KEY_KR, data);
        checkAndAlertBatch(data, 'kr');
        setDataErrors(prev => ({ ...prev, kr: false }));
      } else {
        setDataErrors(prev => ({ ...prev, kr: true }));
      }
    } catch { setDataErrors(prev => ({ ...prev, kr: true })); }
  }, [krStocks]); // eslint-disable-line react-hooks/exhaustive-deps

  // 마운트 시 snapshot 초기 로드
  useEffect(() => {
    (async () => {
      const snap = await fetchSnapshot();
      if (snap?.kr?.length > 0) {
        setKrStocks(prev => {
          if (prev.length === 0) return snap.kr;
          const map = new Map(prev.map(s => [s.symbol, s]));
          for (const u of snap.kr) {
            if (u?.price > 0) map.set(u.symbol, { ...map.get(u.symbol), ...u });
          }
          return [...map.values()];
        });
      }
      if (snap?.us?.length > 0) {
        setUsStocks(prev => {
          if (prev.length === 0) return snap.us;
          const map = new Map(prev.map(s => [s.symbol, s]));
          for (const u of snap.us) {
            if (u?.price > 0) map.set(u.symbol, { ...map.get(u.symbol), ...u });
          }
          return [...map.values()];
        });
      }
      setPricesReady(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshUsStocks();
    refreshKoreanStocks();
    const usId = setInterval(() => { if (!document.hidden) refreshUsStocks(); }, POLLING.NORMAL);
    const krId = setInterval(() => { if (!document.hidden) refreshKoreanStocks(); }, POLLING.NORMAL);
    // 탭 복귀 시 즉시 갱신
    const onVisible = () => { if (!document.hidden) { refreshUsStocks(); refreshKoreanStocks(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(usId);
      clearInterval(krId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshUsStocks, refreshKoreanStocks]);

  return {
    usStocks, setUsStocks,
    krStocks, setKrStocks,
    pricesReady,
    dataErrors, setDataErrors,
    krSymbolsRef, usSymbolsRef,
    refreshUsStocks, refreshKoreanStocks,
  };
}
