// 코인 가격 폴링 + Upbit WebSocket 훅
// 가격: WebSocket(실시간, 우선) + REST fallback(30초)
// 스파크라인: CoinGecko(5분) — 유일한 소스
import { useState, useEffect, useCallback, useRef } from 'react';
import { COINS_INITIAL } from '../data/mock';
import { fetchCoins, fetchCoinsUpbitOnly, fetchUpbitAllSymbols, fetchCoinGecko, getSparklineCache } from '../api/coins';
import { subscribeCoinPrices, unsubscribeCoinPrices } from '../api/coinWs';
import { setWhaleBtcKrwPrice } from '../api/whale';
import { POLLING } from '../constants/polling';
import { checkAndAlertBatch } from '../utils/priceAlert';

// ─── localStorage 코인 가격 캐시 (6h TTL) ───────────────────────
const COIN_CACHE_KEY = 'prices_coin_v1';
const COIN_CACHE_TTL = 6 * 60 * 60 * 1000;

function loadCoinCache() {
  try {
    const raw = localStorage.getItem(COIN_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > COIN_CACHE_TTL || !data?.length) return null;
    return data;
  } catch { return null; }
}

function saveCoinCache(coins) {
  try {
    // priceKrw/priceUsd/change24h 핵심 필드만 저장 (용량 최적화)
    const slim = coins.map(c => ({
      id: c.id, symbol: c.symbol, name: c.name, market: c.market,
      priceKrw: c.priceKrw, priceUsd: c.priceUsd, change24h: c.change24h,
      marketCap: c.marketCap, volume24h: c.volume24h,
      image: c.image, sector: c.sector, sparkline: c.sparkline ?? [],
    }));
    localStorage.setItem(COIN_CACHE_KEY, JSON.stringify({ data: slim, ts: Date.now() }));
  } catch {}
}

export function useCoins(krwRateRef) {
  const [coins, setCoins] = useState(() => loadCoinCache() ?? COINS_INITIAL);
  const [coinError, setCoinError] = useState(false);
  const wsTickBufRef  = useRef({});
  const wsFlushTimer  = useRef(null);
  const wsConnectedRef = useRef(false);
  const coinsRef      = useRef(coins);
  coinsRef.current    = coins;

  // 빠른 갱신 (10초, Upbit만)
  const refreshCoinsQuick = useCallback(async () => {
    try {
      if (!coinsRef.current.length) return;
      const data = await fetchCoinsUpbitOnly(coinsRef.current, krwRateRef.current);
      if (data.length) { setCoins(data); saveCoinCache(data); checkAndAlertBatch(data, 'coin'); }
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
        saveCoinCache(data);
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

  // 폴링 인터벌 — WebSocket 연결 시 REST 빠른 갱신 생략
  useEffect(() => {
    // 마운트 즉시 Upbit REST로 첫 가격 로드 (WS 연결 대기 없이 ~1s 내 실제 가격 표시)
    refreshCoinsQuick();
    const quickId     = setInterval(() => { if (!document.hidden && !wsConnectedRef.current) refreshCoinsQuick(); }, POLLING.FAST);
    const fullId      = setInterval(() => { if (!document.hidden) refreshCoins(); }, POLLING.SLOW);
    const sparklineId = setInterval(() => { if (!document.hidden) refreshSparklines(); }, POLLING.SPARKLINE);
    // 탭 복귀 시 즉시 갱신
    const onVisible = () => { if (!document.hidden) refreshCoinsQuick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(quickId);
      clearInterval(fullId);
      clearInterval(sparklineId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshCoinsQuick, refreshCoins, refreshSparklines]);

  // 최초 로드 시 스파크라인 즉시 가져오기
  useEffect(() => {
    refreshSparklines();
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
      if (tick._connected) { wsConnectedRef.current = true; return; }
      if (tick._disconnected) { wsConnectedRef.current = false; return; }
      wsTickBufRef.current[tick.symbol] = tick;
      if (!wsFlushTimer.current) wsFlushTimer.current = setTimeout(flushTicks, 200);
    };
    // 전체 심볼 목록으로 한 번만 구독 (이중 구독 방지)
    const initWs = async () => {
      try {
        const symbols = await fetchUpbitAllSymbols();
        if (!cancelled) subscribeCoinPrices(symbols, wsHandler);
      } catch {
        // Upbit 목록 실패 시 초기 심볼로 fallback
        if (!cancelled) subscribeCoinPrices(COINS_INITIAL.map(c => c.symbol), wsHandler);
      }
    };
    initWs();
    return () => {
      cancelled = true;
      clearTimeout(wsFlushTimer.current);
      wsFlushTimer.current = null;
      unsubscribeCoinPrices();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { coins, setCoins, coinError, refreshCoins, refreshCoinsQuick };
}
