// 미국·국내 주식 가격 폴링 훅
import { useState, useEffect, useCallback, useRef } from 'react';
import { KOREAN_STOCKS, US_STOCKS_INITIAL } from '../data/mock';
import { fetchUsStocksBatch, fetchKoreanStocksBatch } from '../api/stocks';
import { checkAndAlertBatch } from '../utils/priceAlert';
import { POLLING } from '../constants/polling';

const US_SYMBOLS = US_STOCKS_INITIAL.map(s => s.symbol);

export function usePrices() {
  const [usStocks, setUsStocks]   = useState(US_STOCKS_INITIAL);
  const [krStocks, setKrStocks]   = useState(KOREAN_STOCKS);
  const [dataErrors, setDataErrors] = useState({ kr: false, us: false });
  // 최신 watchlist KR 심볼 — 클로저 없이 참조 (App이 주입)
  const krSymbolsRef = useRef([]);

  const refreshUsStocks = useCallback(async () => {
    try {
      const data = await fetchUsStocksBatch(US_SYMBOLS);
      if (data.length > 0) {
        setUsStocks(prev => prev.map(s => {
          const u = data.find(d => d.symbol === s.symbol);
          return u?.price ? { ...s, ...u, sparkline: u.sparkline?.length ? u.sparkline : s.sparkline } : s;
        }));
        checkAndAlertBatch(data, 'us');
        setDataErrors(prev => ({ ...prev, us: false }));
      }
    } catch { setDataErrors(prev => ({ ...prev, us: true })); }
  }, []);

  const refreshKoreanStocks = useCallback(async () => {
    try {
      const extraSymbols = krSymbolsRef.current.filter(
        sym => !KOREAN_STOCKS.some(s => s.symbol === sym)
      );
      const stocksToFetch = [
        ...KOREAN_STOCKS,
        ...extraSymbols.map(sym => ({ symbol: sym, name: sym, market: 'kr', price: 0, sparkline: [] })),
      ];
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
        checkAndAlertBatch(data, 'kr');
        setDataErrors(prev => ({ ...prev, kr: false }));
      }
    } catch { setDataErrors(prev => ({ ...prev, kr: true })); }
  }, []);

  useEffect(() => {
    refreshUsStocks();
    refreshKoreanStocks();
    const usId = setInterval(refreshUsStocks, POLLING.NORMAL);
    const krId = setInterval(refreshKoreanStocks, POLLING.NORMAL);
    return () => { clearInterval(usId); clearInterval(krId); };
  }, [refreshUsStocks, refreshKoreanStocks]);

  return {
    usStocks, setUsStocks,
    krStocks, setKrStocks,
    dataErrors, setDataErrors,
    krSymbolsRef,
    refreshUsStocks, refreshKoreanStocks,
  };
}
