// 워치리스트 테이블 — 로고 + 섹션 구분 + 티커 심볼 + 클릭 시 차트
import { useState, useRef, useEffect, useMemo } from 'react';
import Sparkline from './Sparkline';
import { useWatchlist } from '../hooks/useWatchlist';

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

// ─── 로고 URL 후보 목록 (우선순위 순) ───────────────────────
function getLogoUrls(item) {
  if (item.image) return [item.image]; // 코인: CoinGecko 이미지
  if (item.market === 'us') return [
    `https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`,
    `https://static.toss.im/png-icons/securities/icn-sec-fill-${item.symbol}.png`,
  ];
  if (item.market === 'kr') return [
    `https://static.toss.im/png-icons/securities/icn-sec-fill-${item.symbol}.png`,
    `https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`,
  ];
  return [];
}

// 심볼별 배경 색상 (로고 실패 시)
const PALETTE = [
  '#3182F6','#F04452','#FF9500','#2AC769','#8B5CF6',
  '#EC4899','#14B8A6','#F59E0B','#6366F1','#EF4444',
];
function colorFor(symbol = '') {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = symbol.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ─── 로고 아바타 (멀티-폴백) ─────────────────────────────────
function LogoAvatar({ item, size = 32 }) {
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
}

// ─── 행 플래시 애니메이션 ────────────────────────────────────
function FlashRow({ item, rank, krwRate, onClick, searchTerm, toggle, isWatched }) {
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
    <tr
      ref={rowRef}
      onClick={() => onClick?.(item)}
      className={`border-b border-[#F2F4F6] cursor-pointer group transition-colors duration-75
        hover:bg-[#F7F8FA] active:bg-[#F2F4F6]
        ${isHot ? 'bg-[#FFFBFB] hover:bg-[#FFF5F5]' : ''}`}
    >
      {/* 관심종목 별 버튼 */}
      <td className="pl-2 pr-0 py-3 w-7">
        <button
          onClick={e => { e.stopPropagation(); toggle(item.id || item.symbol); }}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-[14px] hover:scale-110 transition-transform"
        >
          {isWatched(item.id || item.symbol) ? '★' : '☆'}
        </button>
      </td>

      {/* 순위 */}
      <td className="pl-1 pr-1 py-3 text-[12px] text-[#C9CDD2] w-8 text-center tabular-nums">{rank}</td>

      {/* 종목: 로고 + 이름 + 티커 */}
      <td className="px-2 py-3">
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
      </td>

      {/* 현재가 (KRW) */}
      <td className="px-3 py-3 text-right">
        <div className="text-[14px] font-bold text-[#191F28] tabular-nums font-mono leading-tight">
          {fmtKrwPrice(item, krwRate)}
        </div>
        {usdPrice && (
          <div className="text-[11px] text-[#B0B8C1] tabular-nums font-mono mt-0.5 leading-tight">
            {usdPrice}
          </div>
        )}
      </td>

      {/* 전일대비 */}
      <td className={`px-3 py-3 text-right text-[13px] tabular-nums font-mono ${
        isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#8B95A1]'
      }`}>
        {fmtChangeAmt(item, krwRate)}
      </td>

      {/* 등락률 */}
      <td className="px-3 py-3 text-right w-[90px]">
        <span className={`inline-block px-2 py-1 rounded-md text-[12px] font-bold tabular-nums font-mono ${
          isUp ? 'bg-[#FFF0F1] text-[#F04452]'
               : isDown ? 'bg-[#F0F4FF] text-[#1764ED]'
               : 'bg-[#F2F4F6] text-[#8B95A1]'
        }`}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </span>
      </td>

      {/* 거래량 */}
      <td className="px-3 py-3 text-right text-[12px] text-[#8B95A1] tabular-nums hidden sm:table-cell">
        {fmtLarge(volume)}
      </td>

      {/* 시가총액 */}
      <td className="px-3 py-3 text-right text-[12px] text-[#8B95A1] tabular-nums hidden lg:table-cell">
        {fmtLarge(mcap)}
      </td>

      {/* 스파크라인 */}
      <td className="px-3 py-3 w-[88px]">
        <Sparkline
          data={item.sparkline}
          width={76}
          height={28}
          positive={isUp ? true : isDown ? false : undefined}
        />
      </td>

      {/* 클릭 화살표 */}
      <td className="pr-4 py-3 w-8">
        <svg className="text-[#C9CDD2] group-hover:text-[#8B95A1] transition-colors mx-auto" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </td>
    </tr>
  );
}

// ─── 섹션 헤더 (전체 탭) ─────────────────────────────────────
function SectionHeader({ label, count, icon }) {
  return (
    <tr className="bg-[#F7F8FA]">
      <td colSpan={10} className="px-4 py-2 border-b border-t border-[#E5E8EB]">
        <div className="flex items-center gap-2">
          <span className="text-[15px]">{icon}</span>
          <span className="text-[12px] font-bold text-[#191F28]">{label}</span>
          <span className="text-[10px] text-[#B0B8C1] bg-[#E5E8EB] px-2 py-0.5 rounded-full ml-1">{count}종목</span>
        </div>
      </td>
    </tr>
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

const SECTION_INFO = {
  kr:   { label: '국내주식', icon: '🇰🇷' },
  us:   { label: '해외주식', icon: '🇺🇸' },
  coin: { label: '코인',     icon: '🪙'   },
  etf:  { label: 'ETF',     icon: '📊'   },
};

// ─── 메인 컴포넌트 ───────────────────────────────────────────
export default function WatchlistTable({ items = [], type = 'kr', krwRate = 1466, onRowClick }) {
  const [sortKey, setSortKey] = useState('changePct');
  const [sortDir, setSortDir] = useState('desc');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const { toggle, isWatched, watchlist } = useWatchlist();

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sortFn = (list) => [...list].sort((a, b) => {
    let va, vb;
    if (sortKey === 'changePct') {
      va = Math.abs(getPct(a)); vb = Math.abs(getPct(b));
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
  });

  const filtered = useMemo(() => {
    let list = [...items];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.name || '').toLowerCase().includes(q) ||
        (i.symbol || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'up')        list = list.filter(i => getPct(i) > 0);
    if (filter === 'down')      list = list.filter(i => getPct(i) < 0);
    if (filter === 'hot')       list = list.filter(i => getPct(i) >= 3);
    if (filter === 'watchlist') list = list.filter(i => isWatched(i.id || i.symbol));
    return list;
  }, [items, search, filter, watchlist, isWatched]);

  const hotCount = items.filter(i => getPct(i) >= 3).length;
  const isAll = type === 'all';

  // 전체 탭: 섹션별 그룹핑
  const groups = useMemo(() => {
    if (!isAll) return null;
    return [
      { key: 'kr',   items: sortFn(filtered.filter(i => i.market === 'kr' && !i.id)) },
      { key: 'us',   items: sortFn(filtered.filter(i => i.market === 'us' && !i.id)) },
      { key: 'coin', items: sortFn(filtered.filter(i => !!i.id)) },
    ].filter(g => g.items.length > 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAll, filtered, sortKey, sortDir, krwRate]);

  const flatSorted = useMemo(() => {
    if (isAll) return null;
    return sortFn(filtered);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAll, filtered, sortKey, sortDir, krwRate]);

  const totalCount = isAll
    ? (groups?.reduce((s, g) => s + g.items.length, 0) ?? 0)
    : (flatSorted?.length ?? 0);

  const renderRows = () => {
    if (isAll && groups) {
      let rank = 0;
      return groups.flatMap(group => {
        const info = SECTION_INFO[group.key] || { label: group.key, icon: '📌' };
        return [
          <SectionHeader key={`hdr-${group.key}`} label={info.label} count={group.items.length} icon={info.icon} />,
          ...group.items.map(item => {
            rank++;
            return (
              <FlashRow
                key={item.id || item.symbol}
                item={item}
                rank={rank}
                krwRate={krwRate}
                onClick={onRowClick}
                searchTerm={search}
              />
            );
          }),
        ];
      });
    }
    return (flatSorted || []).map((item, i) => (
      <FlashRow
        key={item.id || item.symbol}
        item={item}
        rank={i + 1}
        krwRate={krwRate}
        onClick={onRowClick}
        searchTerm={search}
      />
    ));
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* 검색 + 필터 */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#F2F4F6] flex-wrap">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#C9CDD2]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="종목명·티커 검색"
            className="pl-8 pr-3 py-1.5 text-[13px] bg-[#F7F8FA] rounded-lg outline-none placeholder:text-[#C9CDD2] w-44 focus:w-56 transition-all duration-200 border border-transparent focus:border-[#E5E8EB]"
          />
        </div>

        <div className="flex gap-1">
          {[
            { key: 'all',  label: '전체' },
            { key: 'hot',  label: `🔥 급등${hotCount > 0 ? ` ${hotCount}` : ''}` },
            { key: 'up',   label: '▲ 상승' },
            { key: 'down', label: '▼ 하락' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1.5 text-[11px] rounded-lg font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-[#191F28] text-white'
                  : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-[11px] text-[#B0B8C1] tabular-nums">{totalCount}개 종목</span>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-[#F2F4F6]">
              <th className="pl-4 pr-1 py-2 text-center text-[11px] font-semibold text-[#B0B8C1] w-8">#</th>
              <th className="px-2 py-2 text-left text-[11px] font-semibold text-[#B0B8C1] min-w-[200px]">종목</th>
              <SortHeader label="현재가"   sortKey="price"     currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="전일대비" sortKey="change"    currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="등락률"   sortKey="changePct" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortHeader label="거래량"   sortKey="volume"    currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
              <SortHeader label="시가총액" sortKey="marketCap" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} className="hidden lg:table-cell" />
              <th className="px-3 py-2 text-right text-[11px] font-semibold text-[#B0B8C1] w-[88px]">차트</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {renderRows()}
          </tbody>
        </table>

        {totalCount === 0 && (
          <div className="py-16 text-center text-[14px] text-[#B0B8C1]">
            {search ? `"${search}" 검색 결과가 없습니다.` : '데이터 없음'}
          </div>
        )}
      </div>
    </div>
  );
}
