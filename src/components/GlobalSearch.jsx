// 전역 종목 검색 모달 — `/` 키로 열기, ESC / 바깥 클릭으로 닫기
import { useState, useEffect, useRef, useMemo } from 'react';

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

export default function GlobalSearch({ krStocks = [], usStocks = [], coins = [], etfs = [], krwRate = 1466, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // 포커스
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ESC 닫기
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
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
    return allItems
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
      })
      .slice(0, 10);
  }, [query, allItems]);

  const handleSelect = (item) => {
    onSelect?.(item);
    onClose?.();
  };

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
        <div className="max-h-[60vh] overflow-y-auto">
          {query && results.length === 0 ? (
            <div className="px-5 py-8 text-center text-[14px] text-[#B0B8C1]">
              "{query}" 검색 결과가 없습니다.
            </div>
          ) : results.length > 0 ? (
            results.map(item => {
              const pct = getPct(item);
              const isUp = pct > 0;
              const isDown = pct < 0;
              const market = item._market;
              return (
                <button
                  key={item.id || item.symbol}
                  onClick={() => handleSelect(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F7F8FA] active:bg-[#F2F4F6] border-b border-[#F2F4F6] last:border-0 transition-colors text-left"
                >
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
                </button>
              );
            })
          ) : (
            <div className="px-5 py-8 text-center text-[13px] text-[#B0B8C1]">
              종목명 또는 티커를 입력하세요
            </div>
          )}
        </div>

        {/* 하단 힌트 */}
        <div className="px-4 py-2.5 bg-[#F8F9FA] border-t border-[#F2F4F6] flex items-center gap-3 text-[11px] text-[#B0B8C1]">
          <span><kbd className="bg-white border border-[#E5E8EB] px-1 rounded text-[10px]">↑↓</kbd> 이동</span>
          <span><kbd className="bg-white border border-[#E5E8EB] px-1 rounded text-[10px]">Enter</kbd> 선택</span>
          <span className="ml-auto">{allItems.length}개 종목 검색 가능</span>
        </div>
      </div>
    </>
  );
}
