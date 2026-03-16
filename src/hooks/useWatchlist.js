// 관심종목 훅 — localStorage 기반 영구 저장
import { useState, useCallback } from 'react';

const KEY = 'watchlist_v1';

function load() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY)) ?? []); } catch { return new Set(); }
}
function save(set) {
  try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch {}
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => load());

  const toggle = useCallback((id) => {
    setWatchlist(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
      return next;
    });
  }, []);

  const isWatched = useCallback((id) => watchlist.has(id), [watchlist]);

  return { watchlist, toggle, isWatched };
}
