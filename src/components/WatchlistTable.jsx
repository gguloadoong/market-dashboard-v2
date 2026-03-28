// 워치리스트 테이블 — 로고 + 섹션 구분 + 티커 심볼 + 클릭 시 차트
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import React from 'react';
import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';
import { setTargetPrice, removeTargetPrice, getTargetPrices } from '../utils/priceAlert';
import Sparkline from './Sparkline';
import { useWatchlist } from '../hooks/useWatchlist';
// 네이티브 테이블 컴포넌트 (CDS Table 대체)
const Table = React.forwardRef(({ className = '', children, ...props }, ref) => (
  <table ref={ref} className={className} {...props}>{children}</table>
));
const TableBody = React.forwardRef(({ className = '', children, ...props }, ref) => (
  <tbody ref={ref} className={className} {...props}>{children}</tbody>
));
const TableRow = React.forwardRef(({ className = '', children, onClick, ...props }, ref) => (
  <tr ref={ref} className={className} onClick={onClick} {...props}>{children}</tr>
));
const TableCell = React.forwardRef(({ className = '', children, as: Tag, scope, onClick, ...props }, ref) => {
  const El = Tag === 'th' ? 'th' : 'td';
  return <El ref={ref} className={className} scope={scope} onClick={onClick} {...props}>{children}</El>;
});
const TableHeader = React.forwardRef(({ className = '', children, ...props }, ref) => (
  <thead ref={ref} className={className} {...props}>{children}</thead>
));
const TableCaption = React.forwardRef(({ className = '', children, ...props }, ref) => (
  <caption ref={ref} className={className} {...props}>{children}</caption>
));

// 네이티브 탭 컴포넌트 (CDS TabbedChips 대체)
function SimpleTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-1 bg-[#F2F4F6] rounded-lg p-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 text-[12px] font-medium py-1 px-2 rounded-md transition-colors ${
            activeTab === tab.id
              ? 'bg-white text-[#191F28] shadow-sm'
              : 'text-[#8B95A1] hover:text-[#191F28]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── 숫자 포맷 ──────────────────────────────────────────────
function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtLarge(n) {
  if (!n || n <= 0) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n / 1e8).toFixed(0)}억`;
  if (n >= 1e4)  return `${(n / 1e4).toFixed(0)}만`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(1)}M`;
  return String(Math.round(n));
}
function getPct(item) {
  return item.id ? (item.change24h ?? 0) : (item.changePct ?? 0);
}

// ─── KRW 가격 표시 ───────────────────────────────────────────
function fmtKrwPrice(item, krwRate) {
  if (item.id) {
    const p = item.priceKrw || (item.priceUsd ?? 0) * krwRate;
    if (!p) return '—';
    if (p < 1)   return `₩${p.toFixed(4)}`;
    if (p < 100) return `₩${fmt(p, 2)}`;
    return `₩${fmt(Math.round(p))}`;
  }
  if (item.market === 'kr') return `₩${fmt(item.price)}`;
  if (item.market === 'us') {
    const krw = Math.round((item.price ?? 0) * krwRate);
    return `₩${fmt(krw)}`;
  }
  return `₩${fmt(item.price)}`;
}
function fmtChangeAmt(item, krwRate) {
  if (item.id) return '';
  const amt = item.change ?? 0;
  const sign = amt >= 0 ? '+' : '';
  if (item.market === 'kr') return `${sign}₩${fmt(Math.abs(amt))}`;
  if (item.market === 'us') return `${sign}₩${fmt(Math.abs(Math.round((amt ?? 0) * krwRate)))}`;
  return `${sign}${amt.toFixed(2)}`;
}

// ─── 매수가 입력 + 평가손익 셀 ──────────────────────────────
function BuyPriceCell({ item, buyPrice, onBuyPriceChange, krwRate }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef(null);

  const currentKrwPrice = item.id
    ? (item.priceKrw || (item.priceUsd ?? 0) * krwRate)
    : item.market === 'us'
      ? (item.price ?? 0) * krwRate
      : (item.price ?? 0);

  const pnlPct = buyPrice && currentKrwPrice ? (currentKrwPrice - buyPrice) / buyPrice * 100 : null;
  const pnlAmt = buyPrice && currentKrwPrice ? currentKrwPrice - buyPrice : null;
  const isProfit = pnlPct != null && pnlPct > 0;
  const isLoss   = pnlPct != null && pnlPct < 0;

  const startEdit = (e) => {
    e.stopPropagation();
    setInputVal(buyPrice ? String(buyPrice) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const save = () => {
    const num = parseFloat(String(inputVal).replace(/,/g, ''));
    onBuyPriceChange(item.id || item.symbol, (!num || num <= 0) ? null : num);
    setEditing(false);
  };

  if (editing) {
    return (
      <TableCell className="px-2 py-3 text-right" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          placeholder="매수가"
          className="w-20 text-right text-[12px] px-1.5 py-1 border border-[#3182F6] rounded-md outline-none bg-white tabular-nums font-mono"
        />
      </TableCell>
    );
  }

  if (pnlPct != null) {
    return (
      <TableCell className="px-2 py-3 text-right" onClick={startEdit}>
        <div className={`text-[12px] font-bold tabular-nums font-mono ${isProfit ? 'text-[#F04452]' : isLoss ? 'text-[#1764ED]' : 'text-[#8B95A1]'}`}>
          {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
        </div>
        <div className={`text-[10px] tabular-nums font-mono mt-0.5 ${isProfit ? 'text-[#F04452]' : isLoss ? 'text-[#1764ED]' : 'text-[#8B95A1]'}`}>
          {pnlAmt >= 0 ? '+' : ''}₩{Math.abs(Math.round(pnlAmt)).toLocaleString('ko-KR')}
        </div>
      </TableCell>
    );
  }

  return (
    <TableCell className="px-2 py-3 text-right" onClick={startEdit}>
      <span className="text-[10px] text-[#C9CDD2] hover:text-[#8B95A1] transition-colors cursor-pointer select-none">
        ✎ 매수가
      </span>
    </TableCell>
  );
}

// ─── 목표가 알림 셀 ──────────────────────────────────────────
function TargetPriceCell({ item, targetPrice, targetDir, onTargetChange, krwRate }) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [dir, setDir] = useState('above');
  const inputRef = useRef(null);

  const currentKrwPrice = item.id
    ? (item.priceKrw || (item.priceUsd ?? 0) * krwRate)
    : item.market === 'us'
      ? (item.price ?? 0) * krwRate
      : (item.price ?? 0);

  const hasTarget = targetPrice != null && targetPrice > 0;
  const reached = hasTarget && (
    targetDir === 'above' ? currentKrwPrice >= targetPrice : currentKrwPrice <= targetPrice
  );

  const startEdit = (e) => {
    e.stopPropagation();
    setInputVal(hasTarget ? String(targetPrice) : '');
    setDir(targetDir || 'above');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const save = () => {
    const num = parseFloat(String(inputVal).replace(/,/g, ''));
    if (!num || num <= 0) {
      onTargetChange(item.id || item.symbol, null, null);
    } else {
      onTargetChange(item.id || item.symbol, num, dir);
    }
    setEditing(false);
  };

  const clear = (e) => {
    e.stopPropagation();
    onTargetChange(item.id || item.symbol, null, null);
    setEditing(false);
  };

  if (editing) {
    return (
      <TableCell className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDir(d => d === 'above' ? 'below' : 'above')}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${
                dir === 'above'
                  ? 'bg-[#FFF0F1] text-[#F04452] border-[#FFD5D8]'
                  : 'bg-[#F0F4FF] text-[#1764ED] border-[#C9D8FF]'
              }`}
            >
              {dir === 'above' ? '≥↑' : '≤↓'}
            </button>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onBlur={save}
              onKeyDown={e => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') setEditing(false);
              }}
              placeholder="목표가"
              className="w-20 text-right text-[12px] px-1.5 py-1 border border-[#3182F6] rounded-md outline-none bg-white tabular-nums font-mono"
            />
          </div>
          {hasTarget && (
            <button onClick={clear} className="text-[10px] text-[#C9CDD2] hover:text-[#F04452] transition-colors">
              삭제
            </button>
          )}
        </div>
      </TableCell>
    );
  }

  if (hasTarget) {
    return (
      <TableCell className="px-2 py-3 text-right" onClick={startEdit}>
        <div className={`text-[11px] font-bold ${reached ? 'text-[#059669]' : targetDir === 'above' ? 'text-[#F04452]' : 'text-[#1764ED]'}`}>
          {reached ? '🎯' : (targetDir === 'above' ? '↑' : '↓')}
        </div>
        <div className="text-[10px] text-[#8B95A1] font-mono tabular-nums mt-0.5">
          ₩{Math.round(targetPrice).toLocaleString('ko-KR')}
        </div>
      </TableCell>
    );
  }

  return (
    <TableCell className="px-2 py-3 text-right" onClick={startEdit}>
      <span className="text-[13px] text-[#D9DDE3] hover:text-[#8B95A1] transition-colors cursor-pointer select-none">🔔</span>
    </TableCell>
  );
}

// ─── 로고 URL + 아바타 색상 (home/utils.js 통합본 사용) ──────
import { getLogoUrls, getAvatarBg as colorFor } from './home/utils';

// ─── 로고 아바타 (멀티-폴백) ─────────────────────────────────
const LogoAvatar = React.memo(function LogoAvatar({ item, size = 32 }) {
  const urls = getLogoUrls(item);
  const [idx, setIdx] = useState(0);
  const label = (item.symbol || '?').slice(0, 2).toUpperCase();
  const bg = colorFor(item.symbol);
  const px = size === 32 ? 'w-8 h-8' : 'w-10 h-10';
  const pad = item.market === 'us' || item.market === 'kr' ? '3px' : '0';

  if (idx < urls.length) {
    return (
      <img
        src={urls[idx]}
        alt={item.symbol}
        onError={() => setIdx(i => i + 1)}
        className={`${px} rounded-full object-contain bg-white border border-[#F2F4F6] flex-shrink-0`}
        style={{ padding: pad }}
      />
    );
  }
  return (
    <div
      className={`${px} rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 select-none`}
      style={{ background: bg }}
    >
      {label}
    </div>
  );
});

// ─── 행 플래시 애니메이션 ────────────────────────────────────
const FlashRow = React.memo(function FlashRow({ item, rank, krwRate, onClick, searchTerm, toggle, isWatched, buyPrice, onBuyPriceChange, targetPrice, targetDir, onTargetChange }) {
  const rowRef  = useRef(null);
  const prevPct = useRef(getPct(item));
  const pct     = getPct(item);
  const isUp    = pct > 0;
  const isDown  = pct < 0;
  const isHot   = pct >= 3;

  useEffect(() => {
    if (pct !== prevPct.current && rowRef.current) {
      const cls = pct > prevPct.current ? 'flash-up' : 'flash-down';
      rowRef.current.classList.add(cls);
      const t = setTimeout(() => rowRef.current?.classList.remove(cls), 500);
      prevPct.current = pct;
      return () => clearTimeout(t);
    }
    prevPct.current = pct;
  }, [pct]);

  const highlight = (text) => {
    if (!searchTerm || !text) return text;
    const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 text-inherit rounded px-0.5">{text.slice(idx, idx + searchTerm.length)}</mark>
        {text.slice(idx + searchTerm.length)}
      </>
    );
  };

  const volume = item.id ? item.volume24h : item.volume;
  const mcap   = item.id ? item.marketCap : (item.aum ?? item.marketCap);
  // 미장: 달러 가격도 보조 표시
  const usdPrice = item.market === 'us' && item.price ? `$${fmt(item.price, 2)}` : null;

  return (
    <TableRow
      ref={rowRef}
      onClick={() => onClick?.(item)}
      className={`border-b border-[#F2F4F6] cursor-pointer group transition-colors duration-75
        hover:bg-[#F7F8FA] active:bg-[#F2F4F6]
        ${isHot ? 'bg-[#FFFBFB] hover:bg-[#FFF5F5]' : ''}`}
    >
      {/* 관심종목 별 버튼 */}
      <TableCell className="pl-2 pr-0 py-3 w-7">
        <button
          onClick={e => { e.stopPropagation(); toggle(item.id || item.symbol); }}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[14px] hover:scale-110 transition-transform"
        >
          {isWatched(item.id || item.symbol) ? '★' : '☆'}
        </button>
      </TableCell>

      {/* 순위 */}
      <TableCell className="pl-1 pr-1 py-3 text-[12px] text-[#C9CDD2] w-8 text-center tabular-nums">{rank}</TableCell>

      {/* 종목: 로고 + 이름 + 티커 */}
      <TableCell className="px-2 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <LogoAvatar item={item} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[14px] font-semibold text-[#191F28] truncate max-w-[160px]">
                {highlight(item.name)}
              </span>
              {isHot && (
                <span className="text-[9px] font-bold bg-[#FFF0F1] text-[#F04452] px-1.5 py-0.5 rounded-full flex-shrink-0">
                  HOT
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-bold text-[#8B95A1] font-mono tracking-wider">
                {highlight(item.symbol)}
              </span>
              {item.sector && (
                <span className="text-[10px] text-[#B0B8C1] bg-[#F2F4F6] px-1.5 py-0.5 rounded">
                  {item.sector}
                </span>
              )}
            </div>
          </div>
        </div>
      </TableCell>

      {/* 현재가 (KRW) */}
      <TableCell className="px-3 py-3 text-right">
        <div className="text-[14px] font-semibold text-[#191F28] tabular-nums font-mono">
          {fmtKrwPrice(item, krwRate)}
        </div>
        {usdPrice && (
          <div className="text-[11px] text-[#8B95A1] tabular-nums font-mono mt-0.5">{usdPrice}</div>
        )}
      </TableCell>

      {/* 전일대비 */}
      <TableCell className={`px-3 py-3 text-right text-[13px] tabular-nums font-mono ${
        isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#8B95A1]'
      }`}>
        {fmtChangeAmt(item, krwRate)}
      </TableCell>

      {/* 등락률 */}
      <TableCell className="px-3 py-3 text-right w-[90px]">
        <span className={`inline-block px-2 py-1 rounded-md text-[12px] font-bold tabular-nums font-mono ${
          isUp ? 'bg-[#FFF0F1] text-[#F04452]'
               : isDown ? 'bg-[#F0F4FF] text-[#1764ED]'
               : 'bg-[#F2F4F6] text-[#8B95A1]'
        }`}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </span>
      </TableCell>

      {/* 거래량 */}
      <TableCell className="px-3 py-3 text-right text-[12px] text-[#8B95A1] tabular-nums hidden sm:table-cell">
        {fmtLarge(volume)}
      </TableCell>

      {/* 시가총액 */}
      <TableCell className="px-3 py-3 text-right text-[12px] text-[#8B95A1] tabular-nums hidden lg:table-cell">
        {fmtLarge(mcap)}
      </TableCell>

      {/* 스파크라인 */}
      <TableCell className="px-3 py-3 w-[88px]">
        <Sparkline
          data={item.sparkline}
          width={76}
          height={28}
          positive={isUp ? true : isDown ? false : undefined}
        />
      </TableCell>

      {/* 매수가 / 평가손익 */}
      <BuyPriceCell item={item} buyPrice={buyPrice} onBuyPriceChange={onBuyPriceChange} krwRate={krwRate} />

      {/* 목표가 알림 */}
      <TargetPriceCell item={item} targetPrice={targetPrice} targetDir={targetDir} onTargetChange={onTargetChange} krwRate={krwRate} />

      {/* 클릭 화살표 */}
      <TableCell className="pr-4 py-3 w-8">
        <svg className="text-[#C9CDD2] group-hover:text-[#8B95A1] transition-colors mx-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </TableCell>
    </TableRow>
  );
});


// ─── 테이블 스켈레톤 로딩 ────────────────────────────────────
function SkeletonRow() {
  return (
    <TableRow className="border-b border-[#F2F4F6] animate-pulse">
      <TableCell className="pl-2 pr-0 py-3 w-7"><div className="w-5 h-5 rounded bg-[#F2F4F6]" /></TableCell>
      <TableCell className="pl-1 pr-1 py-3 w-8"><div className="w-4 h-3 rounded bg-[#F2F4F6] mx-auto" /></TableCell>
      <TableCell className="px-2 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#F2F4F6] flex-shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 bg-[#F2F4F6] rounded w-28" />
            <div className="h-3 bg-[#F2F4F6] rounded w-16" />
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 text-right">
        <div className="h-4 bg-[#F2F4F6] rounded w-24 ml-auto" />
        <div className="h-3 bg-[#F2F4F6] rounded w-16 ml-auto mt-1" />
      </TableCell>
      <TableCell className="px-3 py-3 text-right"><div className="h-3.5 bg-[#F2F4F6] rounded w-16 ml-auto" /></TableCell>
      <TableCell className="px-3 py-3 text-right w-[90px]"><div className="h-6 bg-[#F2F4F6] rounded-md w-16 ml-auto" /></TableCell>
      <TableCell className="px-3 py-3 text-right hidden sm:table-cell"><div className="h-3 bg-[#F2F4F6] rounded w-12 ml-auto" /></TableCell>
      <TableCell className="px-3 py-3 text-right hidden lg:table-cell"><div className="h-3 bg-[#F2F4F6] rounded w-16 ml-auto" /></TableCell>
      <TableCell className="px-3 py-3 w-[88px]"><div className="h-7 bg-[#F2F4F6] rounded w-full" /></TableCell>
      <TableCell className="px-2 py-3 w-[80px]" />
      <TableCell className="px-2 py-3 w-8" />
      <TableCell className="pr-4 py-3 w-8" />
    </TableRow>
  );
}

// ─── 컬럼 정렬 헤더 ─────────────────────────────────────────
function SortHeader({ label, sortKey, currentKey, currentDir, onSort, className = '' }) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-3 py-2.5 text-right text-[11px] font-semibold text-[#B0B8C1] cursor-pointer hover:text-[#6B7684] select-none transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      {label}{active && <span className="ml-0.5 text-[#3182F6]">{currentDir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  );
}


// 탭 타입별 장 상태 배지 (사용자에게 데이터 freshness 명시)
function MarketStatusBadge({ type }) {
  if (type === 'etf' || type === 'coin') return null;
  const { status, label } = type === 'kr' ? getKoreanMarketStatus() : getUsMarketStatus();
  if (status === 'open') return null; // 거래 중이면 배지 불필요
  const text = type === 'kr'
    ? `${label} · 전일 종가 기준`
    : status === 'pre' ? `${label} · 정규장 전`
    : status === 'after' ? `${label} · 정규장 후`
    : `${label} · 전일 종가 기준`;
  return (
    <span className="text-[11px] text-[#8B95A1] bg-[#F2F4F6] px-2 py-1 rounded-lg flex-shrink-0">
      {text}
    </span>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────
// ─── 데이터 신뢰도 배지 ─────────────────────────────────────
const RELIABILITY = {
  kr:   { label: '● LIVE', sub: '한국투자증권',  color: '#2AC769' },
  us:   { label: '⏱ 15분 지연', sub: 'Yahoo Finance', color: '#FF9500' },
  coin: { label: '● LIVE', sub: 'Upbit WebSocket', color: '#2AC769' },
  etf:  { label: '⏱ 15분 지연', sub: 'Yahoo Finance', color: '#FF9500' },
};

export default function WatchlistTable({ items = [], type = 'kr', krwRate = 1466, onRowClick, loading = false, initializing = false, dataError = null, onRetry }) {
  const [sortKey, setSortKey] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [sector,  setSector]  = useState(null);
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [buyPrices, setBuyPrices] = useState(() => {
    try { return JSON.parse(localStorage.getItem('marketradar_buyprices') || '{}'); }
    catch { return {}; }
  });
  const handleBuyPriceChange = useCallback((symbol, price) => {
    setBuyPrices(prev => {
      const next = price != null
        ? { ...prev, [symbol]: price }
        : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== symbol));
      localStorage.setItem('marketradar_buyprices', JSON.stringify(next));
      return next;
    });
  }, []);

  // 목표가 상태
  const [targetPrices, setTargetPrices] = useState(() => getTargetPrices());
  const handleTargetPriceChange = useCallback((symbol, price, direction) => {
    if (!price || price <= 0) {
      removeTargetPrice(symbol);
      setTargetPrices(prev => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== symbol)));
    } else {
      setTargetPrice(symbol, price, direction);
      setTargetPrices(prev => ({ ...prev, [symbol]: { price, direction } }));
    }
  }, []);
  // 코인 탭: 100개씩 표시 (250개 한번에 렌더링 성능 방지)
  const PAGE_SIZE   = 100;
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const { toggle, isWatched } = useWatchlist();

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortFn = useCallback((list) => [...list].sort((a, b) => {
    let va, vb;
    if (sortKey === 'changePct') {
      va = getPct(a); vb = getPct(b);
    } else if (sortKey === 'price') {
      va = a.id ? (a.priceKrw || (a.priceUsd ?? 0) * krwRate) : (a.market === 'us' ? (a.price ?? 0) * krwRate : (a.price ?? 0));
      vb = b.id ? (b.priceKrw || (b.priceUsd ?? 0) * krwRate) : (b.market === 'us' ? (b.price ?? 0) * krwRate : (b.price ?? 0));
    } else if (sortKey === 'volume') {
      va = a.id ? (a.volume24h ?? 0) : (a.volume ?? 0);
      vb = b.id ? (b.volume24h ?? 0) : (b.volume ?? 0);
    } else if (sortKey === 'marketCap') {
      va = a.id ? (a.marketCap ?? 0) : (a.aum ?? a.marketCap ?? 0);
      vb = b.id ? (b.marketCap ?? 0) : (b.aum ?? b.marketCap ?? 0);
    } else {
      va = a[sortKey] ?? 0; vb = b[sortKey] ?? 0;
    }
    return sortDir === 'desc' ? (vb - va) : (va - vb);
  }), [sortKey, sortDir, krwRate]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.symbol || '').toLowerCase().includes(q)
      );
    }
    if (sector) list = list.filter(i => i.sector === sector);
    if (filter === 'up')        list = list.filter(i => getPct(i) > 0);
    if (filter === 'down')      list = list.filter(i => getPct(i) < 0);
    if (filter === 'hot')       list = list.filter(i => getPct(i) >= 3);
    if (filter === 'hot5')      list = list.filter(i => getPct(i) >= 5);
    if (filter === 'drop3')     list = list.filter(i => getPct(i) <= -3);
    if (filter === 'vol') {
      const getVol = i => i.id ? (i.volume24h ?? 0) : (i.volume ?? 0);
      const avg = items.length ? items.reduce((s, i) => s + getVol(i), 0) / items.length : 0;
      if (avg > 0) list = list.filter(i => getVol(i) >= avg * 2);
    }
    if (filter === 'watchlist') list = list.filter(i => isWatched(i.id || i.symbol));
    // ★ 관심종목만 보기 토글
    if (showWatchlistOnly)      list = list.filter(i => isWatched(i.id || i.symbol));
    return list;
  }, [items, search, filter, sector, showWatchlistOnly, isWatched]);

  // items에서 고유 섹터 목록 동적 추출 (kr/us 탭에서만 의미있음)
  const availableSectors = useMemo(() => {
    if (type === 'coin' || type === 'etf') return [];
    const s = new Set(items.map(i => i.sector).filter(Boolean));
    return [...s].sort();
  }, [items, type]);

  const hotCount    = items.filter(i => getPct(i) >= 3).length;
  const hot5Count   = items.filter(i => getPct(i) >= 5).length;
  const drop3Count  = items.filter(i => getPct(i) <= -3).length;
  const volSpikeCount = useMemo(() => {
    const getVol = i => i.id ? (i.volume24h ?? 0) : (i.volume ?? 0);
    const avg = items.length ? items.reduce((s, i) => s + getVol(i), 0) / items.length : 0;
    return avg > 0 ? items.filter(i => getVol(i) >= avg * 2).length : 0;
  }, [items]);

  // 코인 탭: BTC 도미넌스 + ETH 도미넌스 + 전체 시총 (보유 데이터에서 계산, 추가 API 호출 없음)
  const coinMarketStats = useMemo(() => {
    if (type !== 'coin' || !items.length) return null;
    const totalMCap    = items.reduce((s, c) => s + (c.marketCap || 0), 0);
    const btc          = items.find(c => c.symbol === 'BTC');
    const eth          = items.find(c => c.symbol === 'ETH');
    const btcDominance = btc && totalMCap ? (btc.marketCap / totalMCap * 100) : null;
    const ethDominance = eth && totalMCap ? (eth.marketCap / totalMCap * 100) : null;
    const altDominance = (btcDominance != null && ethDominance != null)
      ? 100 - btcDominance - ethDominance : null;
    return { totalMCap, btcDominance, ethDominance, altDominance };
  }, [type, items]);

  const flatSorted = useMemo(
    () => sortFn(filtered),
    [filtered, sortFn]
  );

  const totalCount = flatSorted.length;
  // 코인 탭은 pageLimit만큼만 렌더링, 나머지는 "더 보기"로
  const displayedRows = type === 'coin' ? flatSorted.slice(0, pageLimit) : flatSorted;
  const hasMore       = type === 'coin' && flatSorted.length > pageLimit;

  const renderRows = () => {
    // 초기 로딩: 데이터 없거나, 코인 탭에서 데이터 수신 전 + 로딩 중이면 스켈레톤
    const isInitialLoad = (loading || initializing) && (items.length === 0 || (type === 'coin' && items.length <= 30));
    if (isInitialLoad) {
      return Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />);
    }
    return displayedRows.map((item, i) => (
      <FlashRow
        key={item.id || item.symbol}
        item={item}
        rank={i + 1}
        krwRate={krwRate}
        onClick={onRowClick}
        searchTerm={search}
        toggle={toggle}
        isWatched={isWatched}
        buyPrice={buyPrices[item.id || item.symbol] ?? null}
        onBuyPriceChange={handleBuyPriceChange}
        targetPrice={targetPrices[item.id || item.symbol]?.price ?? null}
        targetDir={targetPrices[item.id || item.symbol]?.direction ?? 'above'}
        onTargetChange={handleTargetPriceChange}
      />
    ));
  };

  const reliability = RELIABILITY[type];

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* 데이터 신뢰도 + 에러 상태 배너 */}
      {(reliability || dataError) && (
        <div className={`flex items-center justify-between px-4 py-2 border-b border-[#F2F4F6] ${dataError ? 'bg-[#FFF8E1]' : 'bg-[#FAFBFC]'}`}>
          {dataError ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[13px]">⚠️</span>
                <span className="text-[12px] text-[#7B5D00] font-medium">데이터 불러오기 실패 — 이전 데이터를 표시하고 있어요</span>
              </div>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-[12px] text-[#3182F6] font-semibold px-3 py-1 rounded-lg hover:bg-[#EDF4FF] transition-colors flex-shrink-0"
                >
                  재시도
                </button>
              )}
            </>
          ) : reliability && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] font-semibold" style={{ color: reliability.color }}>
                {reliability.label}
              </span>
              <span className="text-[10px] text-[#C9CDD2]">{reliability.sub}</span>
            </div>
          )}
        </div>
      )}

      {/* 코인 탭 전용: BTC 도미넌스 + 전체 시총 통계 바 */}
      {coinMarketStats && (
        <div className="flex items-center gap-0 px-4 py-2.5 border-b border-[#F2F4F6] bg-[#FAFBFC] overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 pr-4 border-r border-[#F2F4F6] flex-shrink-0">
            <span className="text-[11px] text-[#8B95A1]">전체 시총</span>
            <span className="text-[13px] font-bold text-[#191F28] font-mono tabular-nums">
              ${coinMarketStats.totalMCap >= 1e12
                ? `${(coinMarketStats.totalMCap / 1e12).toFixed(2)}T`
                : `${(coinMarketStats.totalMCap / 1e9).toFixed(0)}B`}
            </span>
          </div>
          {coinMarketStats.btcDominance != null && (
            <div className="flex items-center gap-1.5 px-4 border-r border-[#F2F4F6] flex-shrink-0">
              <span className="text-[11px] text-[#8B95A1]">BTC</span>
              <span className="text-[13px] font-bold text-[#F7931A] font-mono tabular-nums">
                {coinMarketStats.btcDominance.toFixed(1)}%
              </span>
              {/* 도미넌스 바 */}
              <div className="w-16 h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden hidden sm:block">
                <div
                  className="h-full bg-[#F7931A] rounded-full"
                  style={{ width: `${Math.min(coinMarketStats.btcDominance, 100)}%` }}
                />
              </div>
            </div>
          )}
          {coinMarketStats.ethDominance != null && (
            <div className="flex items-center gap-1.5 px-4 border-r border-[#F2F4F6] flex-shrink-0">
              <span className="text-[11px] text-[#8B95A1]">ETH</span>
              <span className="text-[13px] font-bold text-[#627EEA] font-mono tabular-nums">
                {coinMarketStats.ethDominance.toFixed(1)}%
              </span>
            </div>
          )}
          {coinMarketStats.altDominance != null && (
            <div className="flex items-center gap-1.5 px-4 flex-shrink-0">
              <span className="text-[11px] text-[#8B95A1]">알트</span>
              <span className="text-[13px] font-bold text-[#8B5CF6] font-mono tabular-nums">
                {coinMarketStats.altDominance.toFixed(1)}%
              </span>
            </div>
          )}
          <span className="ml-auto text-[10px] text-[#C9CDD2] flex-shrink-0 pl-4">
            상위 {items.length}개 기준
          </span>
        </div>
      )}

      {/* 1행: 검색 + 메인 필터 + 관심종목 토글 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
        <div className="relative flex-shrink-0">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#C9CDD2]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="종목명·티커 검색"
            className="pl-8 pr-3 py-1.5 text-[13px] bg-[#F7F8FA] rounded-lg outline-none placeholder:text-[#C9CDD2] w-32 sm:w-44 focus:w-44 sm:focus:w-56 transition-all duration-200 border border-transparent focus:border-[#E5E8EB]"
          />
        </div>

        <div className="overflow-x-auto no-scrollbar flex-shrink-0">
          <SimpleTabs
            tabs={[
              { id: 'all',   label: '전체' },
              { id: 'hot',   label: hotCount  > 0 ? `🔥 ${hotCount}` : '🔥' },
              { id: 'hot5',  label: hot5Count > 0 ? `🚀 ${hot5Count}` : '🚀' },
              { id: 'up',    label: '▲' },
              { id: 'down',  label: '▼' },
              { id: 'drop3', label: drop3Count > 0 ? `📉 ${drop3Count}` : '📉' },
              { id: 'vol',   label: volSpikeCount > 0 ? `📦 ${volSpikeCount}` : '📦' },
            ]}
            activeTab={filter}
            onChange={setFilter}
          />
        </div>

        {/* ★ 관심종목만 보기 토글 버튼 */}
        <button
          onClick={() => setShowWatchlistOnly(p => !p)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors flex-shrink-0 ${
            showWatchlistOnly
              ? 'bg-[#191F28] text-white border-[#191F28]'
              : 'text-[#6B7684] border-[#E5E8EB] hover:bg-[#F2F4F6]'
          }`}
        >
          ★
        </button>

        <MarketStatusBadge type={type} />
        <span className="ml-auto text-[11px] text-[#B0B8C1] tabular-nums flex-shrink-0">{totalCount}개</span>
      </div>

      {/* 2행: 섹터 칩 — kr/us 탭에만, 모바일 가로 스크롤 */}
      {availableSectors.length > 0 && (
        <div className="flex gap-1 px-4 py-2 border-b border-[#F2F4F6] overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSector(null)}
            className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-colors flex-shrink-0 ${
              !sector ? 'bg-[#3182F6] text-white' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]'
            }`}
          >
            전체
          </button>
          {availableSectors.map(s => (
            <button
              key={s}
              onClick={() => setSector(prev => prev === s ? null : s)}
              className={`px-2.5 py-1 text-[11px] rounded-lg font-semibold transition-colors flex-shrink-0 ${
                sector === s ? 'bg-[#3182F6] text-white' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 테이블 — CDS Table 컴포넌트 사용 */}
      <div className="overflow-x-auto">
        <Table className="w-full">
          <TableCaption className="sr-only">종목 워치리스트 테이블</TableCaption>
          <TableHeader>
            <TableRow className="bg-[#F8F9FA] border-b border-[#F2F4F6]">
              {/* ★ 관심종목 버튼 헤더 - 빈 컬럼 */}
              <TableCell as="th" scope="col" className="pl-2 pr-0 w-7" />
              {/* 기존 # 컬럼 */}
              <TableCell as="th" scope="col" className="pl-1 pr-1 py-2 text-center text-[11px] font-semibold text-[#B0B8C1] w-8">#</TableCell>
              <TableCell as="th" scope="col" className="px-2 py-2 text-left text-[11px] font-semibold text-[#B0B8C1] min-w-[200px]">종목</TableCell>
              <TableCell as="th" scope="col"
                className={`px-3 py-2.5 text-right text-[11px] font-semibold cursor-pointer hover:text-[#6B7684] select-none transition-colors ${sortKey === 'price' ? 'text-[#3182F6]' : 'text-[#B0B8C1]'}`}
                onClick={() => handleSort('price')}
              >현재가{sortKey === 'price' && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}</TableCell>
              <TableCell as="th" scope="col"
                className={`px-3 py-2.5 text-right text-[11px] font-semibold cursor-pointer hover:text-[#6B7684] select-none transition-colors ${sortKey === 'change' ? 'text-[#3182F6]' : 'text-[#B0B8C1]'}`}
                onClick={() => handleSort('change')}
              >전일대비{sortKey === 'change' && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}</TableCell>
              <TableCell as="th" scope="col"
                className={`px-3 py-2.5 text-right text-[11px] font-semibold cursor-pointer hover:text-[#6B7684] select-none transition-colors ${sortKey === 'changePct' ? 'text-[#3182F6]' : 'text-[#B0B8C1]'}`}
                onClick={() => handleSort('changePct')}
              >등락률{sortKey === 'changePct' && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}</TableCell>
              <TableCell as="th" scope="col"
                className={`px-3 py-2.5 text-right text-[11px] font-semibold cursor-pointer hover:text-[#6B7684] select-none transition-colors hidden sm:table-cell ${sortKey === 'volume' ? 'text-[#3182F6]' : 'text-[#B0B8C1]'}`}
                onClick={() => handleSort('volume')}
              >거래량{sortKey === 'volume' && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}</TableCell>
              <TableCell as="th" scope="col"
                className={`px-3 py-2.5 text-right text-[11px] font-semibold cursor-pointer hover:text-[#6B7684] select-none transition-colors hidden lg:table-cell ${sortKey === 'marketCap' ? 'text-[#3182F6]' : 'text-[#B0B8C1]'}`}
                onClick={() => handleSort('marketCap')}
              >시가총액{sortKey === 'marketCap' && <span className="ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>}</TableCell>
              <TableCell as="th" scope="col" className="px-3 py-2 text-right text-[11px] font-semibold text-[#B0B8C1] w-[88px]">차트</TableCell>
              <TableCell as="th" scope="col" className="px-2 py-2 text-right text-[11px] font-semibold text-[#B0B8C1] w-[80px]">손익</TableCell>
              <TableCell as="th" scope="col" className="px-2 py-2 text-right text-[11px] font-semibold text-[#B0B8C1] w-8">알림</TableCell>
              <TableCell as="th" scope="col" className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderRows()}
          </TableBody>
        </Table>

        {totalCount === 0 && (
          <div className="py-16 text-center text-[14px] text-[#B0B8C1]">
            {search ? `"${search}" 검색 결과가 없습니다.` : '데이터 없음'}
          </div>
        )}

        {/* 코인 탭 더 보기 버튼 */}
        {hasMore && (
          <div className="py-4 text-center border-t border-[#F2F4F6]">
            <button
              onClick={() => setPageLimit(l => l + PAGE_SIZE)}
              className="px-5 py-2 text-[13px] font-medium text-[#3182F6] bg-[#F0F5FF] hover:bg-[#DCE8FF] rounded-lg transition-colors"
            >
              더 보기 ({flatSorted.length - pageLimit}개 남음)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
