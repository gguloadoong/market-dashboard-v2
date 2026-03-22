// 지수·환율 폴링 훅
import { useState, useEffect, useCallback } from 'react';
import { INDICES_INITIAL } from '../data/mock';
import { fetchIndices } from '../api/stocks';
import { fetchExchangeRate } from '../api/coins';
import { setWhaleKrwRate } from '../api/whale';
import { POLLING } from '../constants/polling';

export function useIndices() {
  const [indices, setIndices]   = useState(INDICES_INITIAL);
  const [krwRate, setKrwRate]   = useState(1466);

  const refreshIndices = useCallback(async () => {
    try {
      const data = await fetchIndices();
      if (data.length > 0) {
        setIndices(prev => prev.map(idx => ({ ...idx, ...(data.find(d => d.id === idx.id) ?? {}) })));
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
    const indicesId = setInterval(refreshIndices, POLLING.SLOW);
    const rateId    = setInterval(refreshExchangeRate, POLLING.NORMAL);
    return () => { clearInterval(indicesId); clearInterval(rateId); };
  }, [refreshIndices, refreshExchangeRate]);

  return { indices, krwRate, refreshIndices };
}
