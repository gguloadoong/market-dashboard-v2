// 지수·환율 폴링 훅
import { useState, useEffect, useCallback } from 'react';
import { fetchIndices } from '../api/stocks';
import { fetchExchangeRate } from '../api/coins';
import { setWhaleKrwRate } from '../api/whale';
import { POLLING } from '../constants/polling';

export function useIndices() {
  const [indices, setIndices]   = useState([]);
  const [krwRate, setKrwRate]   = useState(1466);

  const refreshIndices = useCallback(async () => {
    try {
      const data = await fetchIndices();
      if (data.length > 0) {
        const now = Date.now();
        setIndices(prev => {
          // 초기 로드 시 prev가 비어있으면 data 그대로 사용
          if (prev.length === 0) return data.map(d => ({ ...d, _lastUpdated: now }));
          const prevIds = new Set(prev.map(idx => idx.id));
          const updated = prev.map(idx => {
            const found = data.find(d => d.id === idx.id);
            return found ? { ...idx, ...found, _lastUpdated: now } : idx;
          });
          const newItems = data.filter(d => !prevIds.has(d.id)).map(d => ({ ...d, _lastUpdated: now }));
          return newItems.length > 0 ? [...updated, ...newItems] : updated;
        });
      }
    } catch (e) { console.warn('[지수] 갱신 실패:', e.message); }
  }, []);

  const refreshExchangeRate = useCallback(async () => {
    try {
      const rate = await fetchExchangeRate();
      if (rate) {
        setKrwRate(rate);
        setWhaleKrwRate(rate);
      }
    } catch (e) { console.warn('[환율] 갱신 실패:', e.message); }
  }, []);

  useEffect(() => {
    refreshIndices();
    refreshExchangeRate();
    const indicesId = setInterval(() => { if (!document.hidden) refreshIndices(); }, POLLING.SLOW);
    const rateId    = setInterval(() => { if (!document.hidden) refreshExchangeRate(); }, POLLING.NORMAL);
    // 탭 복귀 시 즉시 갱신
    const onVisible = () => { if (!document.hidden) { refreshIndices(); refreshExchangeRate(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(indicesId);
      clearInterval(rateId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshIndices, refreshExchangeRate]);

  return { indices, krwRate, refreshIndices };
}
