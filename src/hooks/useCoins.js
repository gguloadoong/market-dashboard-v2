// 코인 가격 폴링 + Upbit WebSocket 훅
// 가격: Upbit(10초) + CoinPaprika/Binance(60초) + WebSocket(실시간)
// 스파크라인: CoinGecko(5분) — 유일한 소스
import { useState, useEffect, useCallback, useRef } from 'react';
import { COINS_INITIAL } from '../data/mock';
import { fetchCoins, fetchCoinsUpbitOnly, fetchExchangeRate, fetchUpbitAllSymbols, fetchCoinGecko, getSparklineCache } from '../api/coins';
import { subscribeCoinPrices, unsubscribeCoinPrices } from '../api/coinWs';
import { setWhaleBtcKrwPrice } from '../api/whale';
import { checkAndAlertBatch } from '../utils/priceAlert';

export function useCoins(krwRateRef) {
  const [coins, setCoins]   = useState(COINS_INITIAL);
  const [coinError, setCoinError] = useState(false);
  const wsTickBufRef  = useRef({});
  const wsFlushTimer  = useRef(null);
  const coinsRef      = useRef(coins);
  coinsRef.current    = coins;

  // 빠른 갱신 (10초, Upbit만)
  const refreshCoinsQuick = useCallback(async () => {
    try {
      if (!coinsRef.current.length) return;
      const data = await fetchCoinsUpbitOnly(coinsRef.current, krwRateRef.current);
      if (data.length) { setCoins(data); checkAndAlertBatch(data, 'coin'); }
    } catch (err) { console.warn('[useCoins] quick refresh 실패:', err.message); }
  }, [krwRateRef]);

  // 전체 갱신 (60초, CoinPaprika/Binance + Upbit)
  const refreshCoins = useCallback(async () => {
    try {
      const data = await fetchCoins(krwRateRef.current);
      if (data.length > 0) {
        setCoins(prev => data.map(c => {
          const old = prev.find(p => p.id === c.id || p.symbol === c.symbol);
          return { ...c, sparkline: c.sparkline?.length ? c.sparkline : old?.sparkline ?? [] };
        }));
        setCoinError(false);
      }
    } catch (err) { console.warn('[useCoins] full refresh 실패:', err.message); setCoinError(true); }
  }, [krwRateRef]);

  // 스파크라인 갱신 (5분, CoinGecko 전용)
  const refreshSparklines = useCallback(async () => {
    try {
      await fetchCoinGecko();
      const sparkCache = getSparklineCache();
      setCoins(prev => prev.map(c => {
        const spark = sparkCache[c.symbol];
        return spark?.length ? { ...c, sparkline: spark } : c;
      }));
    } catch {
      // CoinGecko 실패해도 가격에는 영향 없음
    }
  }, []);

  // BTC KRW 가격 → whale 모듈
  useEffect(() => {
    const btc = coins.find(c => c.symbol === 'BTC');
    if (btc?.priceKrw) setWhaleBtcKrwPrice(btc.priceKrw);
  }, [coins]);

  // 폴링 인터벌
  useEffect(() => {
    const quickId     = setInterval(() => refreshCoinsQuick(), 10000);
    const fullId      = setInterval(refreshCoins, 60000);
    const sparklineId = setInterval(refreshSparklines, 5 * 60 * 1000); // 5분
    return () => { clearInterval(quickId); clearInterval(fullId); clearInterval(sparklineId); };
  }, [refreshCoinsQuick, refreshCoins, refreshSparklines]);

  // 최초 로드 시 스파크라인도 가져오기
  useEffect(() => {
    const timer = setTimeout(refreshSparklines, 3000); // 초기 로드 3초 후
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Upbit WebSocket
  useEffect(() => {
    let cancelled = false;
    const flushTicks = () => {
      wsFlushTimer.current = null;
      const buf = wsTickBufRef.current;
      if (!Object.keys(buf).length) return;
      wsTickBufRef.current = {};
      setCoins(prev => {
        const rate    = krwRateRef.current;
        const updated = [...prev];
        let changed   = false;
        for (const sym of Object.keys(buf)) {
          const tick = buf[sym];
          const idx  = updated.findIndex(c => c.symbol === sym);
          if (idx === -1) continue;
          updated[idx] = { ...updated[idx], priceKrw: tick.priceKrw, priceUsd: tick.priceKrw / rate, change24h: tick.change24h, priceSource: 'upbit-ws' };
          changed = true;
        }
        return changed ? updated : prev;
      });
    };
    const wsHandler = (tick) => {
      if (tick._connected) return;
      wsTickBufRef.current[tick.symbol] = tick;
      if (!wsFlushTimer.current) wsFlushTimer.current = setTimeout(flushTicks, 200);
    };
    subscribeCoinPrices(COINS_INITIAL.map(c => c.symbol), wsHandler);
    fetchUpbitAllSymbols()
      .then(symbols => { if (!cancelled) subscribeCoinPrices(symbols, wsHandler); })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(wsFlushTimer.current);
      wsFlushTimer.current = null;
      unsubscribeCoinPrices();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { coins, setCoins, coinError, refreshCoins, refreshCoinsQuick };
}
