// 전역 종목 검색 모달 — `/` 키로 열기, ESC / 바깥 클릭으로 닫기
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { fetchNaverSearch, fetchUsStockSearch } from '../api/_gateway.js';

function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function getPct(item) {
  return item.id ? (item.change24h ?? 0) : (item.changePct ?? 0);
}

function getPrice(item, krwRate) {
  if (item.id) {
    const p = item.priceKrw || (item.priceUsd ?? 0) * krwRate;
    if (!p) return '—';
    if (p < 1)   return `₩${p.toFixed(4)}`;
    if (p < 100) return `₩${fmt(p, 2)}`;
    return `₩${fmt(Math.round(p))}`;
  }
  if (item.market === 'kr') return `₩${fmt(item.price)}`;
  if (item.market === 'us') return `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;
  return `₩${fmt(item.price)}`;
}

const MARKET_LABEL = { kr: '국내', us: '미장', coin: '코인', etf: 'ETF' };
const MARKET_COLOR = { kr: '#F04452', us: '#3182F6', coin: '#FF9500', etf: '#8B5CF6' };

import { useWatchlist } from '../hooks/useWatchlist';
import { useAllNewsQuery } from '../hooks/useNewsQuery';

export default function GlobalSearch({ krStocks = [], usStocks = [], coins = [], etfs = [], krwRate = 1466, onSelect, onNewsClick, onClose }) {
  const { toggle, isWatched } = useWatchlist();
  const { data: allNews = [] } = useAllNewsQuery();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [naverItems, setNaverItems] = useState([]);
  const [usSearchItems, setUsSearchItems] = useState([]);
  const [naverLoading, setNaverLoading] = useState(false);
  const usSearchTimerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const naverTimerRef = useRef(null);

  // 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 쿼리 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  // 네이버 실시간 검색 (디바운스 300ms)
  useEffect(() => {
    clearTimeout(naverTimerRef.current);
    if (!query.trim()) {
      setNaverItems([]);
      setNaverLoading(false);
      return;
    }
    setNaverLoading(true);
    naverTimerRef.current = setTimeout(async () => {
      try {
        const data = await fetchNaverSearch(query.trim());
        setNaverItems(data.items || []);
      } catch {
        setNaverItems([]);
      } finally {
        setNaverLoading(false);
      }
    }, 300);
    return () => clearTimeout(naverTimerRef.current);
  }, [query]);

  // 미장 종목 실시간 검색 (NASDAQ/Yahoo, 디바운스 400ms)
  useEffect(() => {
    clearTimeout(usSearchTimerRef.current);
    if (!query.trim() || query.trim().length < 2) { setUsSearchItems([]); return; }
    usSearchTimerRef.current = setTimeout(async () => {
      try {
        const data = await fetchUsStockSearch(query.trim());
        setUsSearchItems(data.items || []);
      } catch { setUsSearchItems([]); }
    }, 400);
    return () => clearTimeout(usSearchTimerRef.current);
  }, [query]);

  // ESC + 키보드 네비게이션
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const count = listRef.current?.querySelectorAll('button[data-idx]').length ?? 0;
        setSelectedIndex(i => Math.min(i + 1, count - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setSelectedIndex(i => {
          if (i >= 0) {
            // results는 클로저 밖이므로 DOM에서 클릭 트리거
            const btns = listRef.current?.querySelectorAll('button[data-idx]');
            btns?.[i]?.click();
          }
          return i;
        });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 전체 종목 합치기 (market 태그 포함)
  const allItems = useMemo(() => [
    ...krStocks.map(s => ({ ...s, _market: 'kr' })),
    ...usStocks.map(s => ({ ...s, _market: 'us' })),
    ...coins.map(c    => ({ ...c, _market: 'coin' })),
    ...etfs.map(e     => ({ ...e, _market: 'etf' })),
  ], [krStocks, usStocks, coins, etfs]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();

    // 기존 allItems 필터
    const local = allItems
      .filter(i =>
        (i.name   || '').toLowerCase().includes(q) ||
        (i.symbol || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        // 심볼 정확 일치 우선
        const aExact = (a.symbol || '').toLowerCase() === q;
        const bExact = (b.symbol || '').toLowerCase() === q;
        if (aExact !== bExact) return aExact ? -1 : 1;
        // 시작 일치 우선
        const aStart = (a.name || '').toLowerCase().startsWith(q) || (a.symbol || '').toLowerCase().startsWith(q);
        const bStart = (b.name || '').toLowerCase().startsWith(q) || (b.symbol || '').toLowerCase().startsWith(q);
        if (aStart !== bStart) return aStart ? -1 : 1;
        return 0;
      });

    // 로컬 결과의 code/symbol 집합 (중복 제거용)
    const localCodes = new Set(local.map(i => (i.symbol || i.id || '').toUpperCase()));

    // 네이버 검색 결과 정규화 — 중복 제거 후 추가
    const naverNormalized = naverItems
      .filter(item => !localCodes.has((item.code || '').toUpperCase()))
      .map(item => ({
        id:       item.code,
        code:     item.code,
        symbol:   item.code,
        name:     item.name,
        market:   'kr',
        _market:  'kr',
        price:    0,
        changePct: 0,
        change:   0,
        _naverOnly: true,
      }));

    // 미장 검색 결과 정규화 — 로컬에 없는 종목만 추가
    const allCodes = new Set([...localCodes, ...naverNormalized.map(i => i.symbol.toUpperCase())]);
    const usNormalized = usSearchItems
      .filter(item => !allCodes.has((item.symbol || '').toUpperCase()))
      .map(item => ({
        symbol:   item.symbol,
        name:     item.name,
        market:   'us',
        _market:  'us',
        price:    0,
        changePct: 0,
        change:   0,
        _searchOnly: true,
      }));

    return [...local, ...naverNormalized, ...usNormalized].slice(0, 15);
  }, [query, allItems, naverItems]);

  // 뉴스 검색 결과
  const newsResults = useMemo(() => {
    if (!query.trim() || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return allNews
      .filter(n => (n.title || '').toLowerCase().includes(q))
      .slice(0, 4);
  }, [query, allNews]);

  const handleSelect = useCallback((item) => {
    onSelect?.(item);
    onClose?.();
  }, [onSelect, onClose]);

  return (
    <>
      {/* 배경 딤 */}
      <div
        className="fixed inset-0 bg-black/40"
        style={{ zIndex: 200 }}
        onClick={onClose}
      />

      {/* 모달 */}
      <div
        className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ zIndex: 201 }}
      >
        {/* 검색 입력 */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F2F4F6]">
          <svg className="text-[#B0B8C1] flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="종목명 또는 티커 검색... (예: 삼성전자, BTC, AAPL)"
            className="flex-1 text-[15px] text-[#191F28] outline-none placeholder:text-[#C9CDD2] bg-transparent"
          />
          <kbd
            onClick={onClose}
            className="flex-shrink-0 text-[11px] text-[#B0B8C1] bg-[#F2F4F6] px-2 py-0.5 rounded cursor-pointer hover:bg-[#E5E8EB]"
          >
            ESC
          </kbd>
        </div>

        {/* 결과 */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {query && results.length === 0 && newsResults.length === 0 && !naverLoading ? (
            <div className="px-5 py-8 text-center text-[14px] text-[#B0B8C1]">
              "{query}" 검색 결과가 없습니다.
            </div>
          ) : naverLoading && results.length === 0 ? (
            <div className="px-5 py-8 text-center text-[14px] text-[#B0B8C1] flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4 text-[#3182F6]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              검색 중...
            </div>
          ) : results.length > 0 ? (
            results.map((item, idx) => {
              const pct = getPct(item);
              const isUp = pct > 0;
              const isDown = pct < 0;
              const market = item._market;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id || item.symbol}
                  data-idx={idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-3 py-3 border-b border-[#F2F4F6] last:border-0 transition-colors text-left relative ${isSelected ? 'bg-[#F2F4F6]' : 'hover:bg-[#F7F8FA] active:bg-[#F2F4F6]'}`}
                >
                  {/* 선택 accent bar */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: '#3182F6' }} />
                  )}

                  {/* 왼쪽 패딩 */}
                  <div className="w-4 flex-shrink-0" />

                  {/* 마켓 배지 */}
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      background: (MARKET_COLOR[market] ?? '#8B95A1') + '18',
                      color: MARKET_COLOR[market] ?? '#8B95A1',
                    }}
                  >
                    {MARKET_LABEL[market] ?? market}
                  </span>

                  {/* 종목 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[#191F28] truncate">{item.name}</span>
                      <span className="text-[11px] font-bold text-[#8B95A1] font-mono bg-[#F2F4F6] px-1.5 py-0.5 rounded flex-shrink-0">{item.symbol}</span>
                    </div>
                    {item.sector && (
                      <div className="text-[11px] text-[#B0B8C1] mt-0.5">{item.sector}</div>
                    )}
                  </div>

                  {/* 가격 + 등락률 */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-[13px] font-semibold text-[#191F28] tabular-nums font-mono">
                      {getPrice(item, krwRate)}
                    </div>
                    <div className={`text-[12px] font-bold tabular-nums font-mono ${isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#8B95A1]'}`}>
                      {isUp ? '▲' : isDown ? '▼' : ''}{Math.abs(pct).toFixed(2)}%
                    </div>
                  </div>

                  {/* 관심종목 ★ */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(item.id || item.symbol); }}
                    className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[16px] mr-2 ${
                      isWatched(item.id || item.symbol) ? 'text-[#FF9500] hover:bg-[#FFF4E6]' : 'text-[#D5D8DC] hover:bg-[#F2F4F6]'
                    }`}
                    title={isWatched(item.id || item.symbol) ? '관심종목 해제' : '관심종목 추가'}
                  >
                    {isWatched(item.id || item.symbol) ? '★' : '☆'}
                  </button>
                </button>
              );
            })
          ) : (
            <div className="px-5 py-8 text-center text-[13px] text-[#B0B8C1]">
              종목명 또는 티커를 입력하세요
            </div>
          )}

          {/* 뉴스 검색 결과 */}
          {newsResults.length > 0 && (
            <div className="border-t border-[#F2F4F6]">
              <div className="px-4 py-2 text-[11px] font-bold text-[#8B95A1] bg-[#F8F9FA] border-b border-[#F2F4F6]">뉴스</div>
              {newsResults.map((news, idx) => (
                <button
                  key={news.link || idx}
                  onClick={() => { onNewsClick?.(news); onClose?.(); }}
                  className="w-full flex items-start gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 hover:bg-[#F7F8FA] active:bg-[#F2F4F6] text-left transition-colors"
                >
                  <span className="flex-shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#F2F4F6] text-[#8B95A1]">뉴스</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#191F28] leading-snug line-clamp-2">{news.title}</div>
                    {news.source && <div className="text-[11px] text-[#B0B8C1] mt-0.5">{news.source}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 하단 힌트 */}
        <div className="px-4 py-2.5 bg-[#F8F9FA] border-t border-[#F2F4F6] flex items-center gap-3 text-[11px] text-[#B0B8C1]">
          <span><kbd className="bg-white border border-[#E5E8EB] px-1 rounded text-[10px]">↑↓</kbd> 이동</span>
          <span><kbd className="bg-white border border-[#E5E8EB] px-1 rounded text-[10px]">Enter</kbd> 선택</span>
          <span className="ml-auto">{allItems.length}개 종목 + KRX 실시간 검색</span>
        </div>
      </div>
    </>
  );
}
