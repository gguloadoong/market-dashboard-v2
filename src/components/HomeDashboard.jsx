// 홈 대시보드 — 3블록 구조
// BLOCK 1: 시장 요약 (공포/탐욕 + 지수 미니칩)
// BLOCK 2: 지금 핫한 것 (전 시장 통합 무버 TOP 8)
// BLOCK 3: 속보 뉴스 (최신 5건)

import { useState, useMemo } from 'react';
import Sparkline from './Sparkline';
import MarketSummaryCards from './MarketSummaryCards';
import { useAllNewsQuery } from '../hooks/useNewsQuery';

// 숫자 포맷 유틸
function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ─── BLOCK 1: 지수 미니 칩 ──────────────────────────────────
function IndexMiniChip({ idx }) {
  const isUp   = (idx.changePct ?? 0) > 0;
  const isDown = (idx.changePct ?? 0) < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const flag   = { KOSPI: '🇰🇷', KOSDAQ: '🇰🇷', SPX: '🇺🇸', NDX: '🇺🇸', DJI: '🇺🇸', DXY: '🌐' }[idx.id] || '';

  return (
    <div className="flex-shrink-0 bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-[#F2F4F6] shadow-sm">
      <span className="text-[13px]">{flag}</span>
      <div>
        {/* 지수명 + 데이터 지연 배지 */}
        <div className="flex items-center gap-1 mb-0.5">
          <div className="text-[10px] text-[#8B95A1] font-semibold leading-none">{idx.name}</div>
          {/* isDelayed: BE(fetchIndices)가 Yahoo 경유 시 true 반환 */}
          {idx.isDelayed && (
            <span className="text-[9px] text-[#B0B8C1] bg-[#F2F4F6] px-1 rounded">지연</span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[14px] font-bold text-[#191F28] tabular-nums font-mono">
            {fmt(idx.value, 2)}
          </span>
          <span className="text-[11px] font-bold tabular-nums font-mono" style={{ color }}>
            {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(idx.changePct ?? 0).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── BLOCK 2: 통합 무버 행 (시장 구분 뱃지 포함) ─────────────
// 뱃지 색상: 국내(KR)=빨강, 해외(US)=파랑, 코인(COIN)=주황
const MARKET_BADGE = {
  KR:   { bg: '#FFF0F0', color: '#F04452' },
  US:   { bg: '#EDF4FF', color: '#3182F6' },
  COIN: { bg: '#FFF4E6', color: '#FF9500' },
};

function MoverRow({ item, rank, krwRate, onClick }) {
  const pct    = item._market === 'COIN' ? (item.change24h ?? 0) : (item.changePct ?? 0);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';

  // 로고 URL 순서대로 fallback
  const logoUrls = item.image ? [item.image]
    : item._market === 'US'   ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`]
    : item._market === 'KR'   ? [`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);

  // 로고 없을 때 아바타 색상
  const PALETTE = ['#3182F6','#F04452','#FF9500','#2AC769','#8B5CF6','#EC4899','#14B8A6','#F59E0B'];
  const bg = PALETTE[(item.symbol || '').split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % PALETTE.length] || '#8B95A1';

  // 가격 표시 (원화 기준)
  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
    ? `₩${fmt(item.price)}`
    : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  const badge = MARKET_BADGE[item._market] || { bg: '#F2F4F6', color: '#8B95A1' };

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F7F8FA] cursor-pointer transition-colors"
    >
      {/* 순위 */}
      <span className="text-[12px] text-[#C9CDD2] w-4 text-center tabular-nums flex-shrink-0">{rank}</span>

      {/* 로고 */}
      {logoIdx < logoUrls.length ? (
        <img
          src={logoUrls[logoIdx]}
          alt={item.symbol}
          onError={() => setLogoIdx(i => i + 1)}
          className="w-7 h-7 rounded-full object-contain bg-white border border-[#F2F4F6] flex-shrink-0 p-0.5"
        />
      ) : (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          style={{ background: bg }}
        >
          {(item.symbol || '?').slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* 종목명 + 심볼 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</span>
          {/* 시장 구분 뱃지 */}
          <span
            className="flex-shrink-0 text-[9px] font-bold px-1 py-0.5 rounded"
            style={{ background: badge.bg, color: badge.color }}
          >
            {item._market}
          </span>
        </div>
        <div className="text-[10px] font-bold text-[#8B95A1] font-mono">{item.symbol}</div>
      </div>

      {/* 등락률 + 가격 */}
      <div className="text-right flex-shrink-0">
        <div className="text-[13px] font-bold tabular-nums font-mono" style={{ color }}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </div>
        <div className="text-[11px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
      </div>
    </div>
  );
}

// ─── BLOCK 3: 뉴스 아이템 ─────────────────────────────────────
const CAT_COLOR = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: 'US'   },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: 'KR'   },
};

function NewsRow({ item }) {
  const isBreaking = (Date.now() - new Date(item.pubDate)) < 3600000;
  const cat = CAT_COLOR[item.category] || { bg: '#F2F4F6', color: '#6B7684', label: 'NEWS' };

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-4 py-3 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors cursor-pointer last:border-b-0"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {isBreaking && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] flex-shrink-0">
            🔴 속보
          </span>
        )}
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.label}
        </span>
        <span className="text-[11px] text-[#B0B8C1] truncate">{item.source}</span>
        <span className="text-[11px] text-[#B0B8C1] flex-shrink-0 ml-auto">{item.timeAgo}</span>
      </div>
      <div className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">
        {item.title}
      </div>
    </a>
  );
}

// ─── 스켈레톤 플레이스홀더 ────────────────────────────────────
function SkeletonRow({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
      <div className="w-4 h-3 bg-[#F2F4F6] rounded animate-pulse flex-shrink-0" />
      <div className="w-7 h-7 rounded-full bg-[#F2F4F6] animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="h-3 bg-[#F2F4F6] rounded w-24 animate-pulse" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-12 animate-pulse" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-3 bg-[#F2F4F6] rounded w-16 animate-pulse" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-14 animate-pulse" />
      </div>
    </div>
  ));
}

function SkeletonNews({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="px-4 py-3 border-b border-[#F2F4F6] space-y-2">
      <div className="flex gap-1.5">
        <div className="h-3 bg-[#F2F4F6] rounded w-10 animate-pulse" />
        <div className="h-3 bg-[#F2F4F6] rounded w-16 animate-pulse" />
      </div>
      <div className="h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
      <div className="h-3.5 bg-[#F2F4F6] rounded w-4/5 animate-pulse" />
    </div>
  ));
}

// ─── 메인 홈 대시보드 ─────────────────────────────────────────
export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [],
  krwRate = 1466, onItemClick,
}) {
  // 뉴스 훅 (상위 5건만 표시)
  const { data: allNews = [], isLoading: newsLoading } = useAllNewsQuery();
  const topNews = useMemo(() => allNews.slice(0, 5), [allNews]);

  // ── BLOCK 2: 전 시장 통합 TOP 8 무버 ──────────────────────
  // 국장, 미장, 코인을 단일 배열로 합쳐 |등락률| 기준 내림차순
  const topMovers = useMemo(() => {
    const krItems  = krStocks.map(s => ({ ...s, _market: 'KR',   _pct: Math.abs(s.changePct ?? 0) }));
    const usItems  = usStocks.map(s => ({ ...s, _market: 'US',   _pct: Math.abs(s.changePct ?? 0) }));
    const coinItems = coins.map(c => ({
      ...c,
      _market: 'COIN',
      _pct: Math.abs(c.change24h ?? 0),
    }));

    return [...krItems, ...usItems, ...coinItems]
      .sort((a, b) => b._pct - a._pct)
      .slice(0, 8);
  }, [krStocks, usStocks, coins]);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0;

  return (
    <div className="space-y-3">
      {/* ── 상단: 날짜 + 실시간 표시 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#191F28]">지금 핫한 것</h2>
          <p className="text-[12px] text-[#8B95A1] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-[#F2F4F6]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
          <span className="text-[11px] text-[#6B7684] font-medium">실시간 업데이트</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* BLOCK 1: 시장 요약                              */}
      {/* ═══════════════════════════════════════════════ */}

      {/* 공포탐욕 + BTC 도미넌스 + 김치프리미엄 */}
      <MarketSummaryCards coins={coins} krwRate={krwRate} />

      {/* 지수 미니바 (가로 스크롤) */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {indices.length > 0
          ? indices.map(idx => <IndexMiniChip key={idx.id} idx={idx} />)
          : [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex-shrink-0 bg-white rounded-xl px-3 py-2.5 w-36 h-12 animate-pulse border border-[#F2F4F6]" />
          ))
        }
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* BLOCK 2: 지금 핫한 것 — 통합 무버 TOP 8        */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[15px]">🔥</span>
          <span className="text-[14px] font-bold text-[#191F28]">전 시장 급등락 TOP 8</span>
          <span className="text-[11px] text-[#B0B8C1] ml-auto">국내·해외·코인 통합</span>
        </div>

        {/* 모바일 1열 / 태블릿 이상 2열 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
          {hasData
            ? topMovers.map((item, i) => (
                <MoverRow
                  key={`${item._market}-${item.id || item.symbol}`}
                  item={item}
                  rank={i + 1}
                  krwRate={krwRate}
                  onClick={onItemClick}
                />
              ))
            : <div className="col-span-2"><SkeletonRow count={8} /></div>
          }
        </div>

        {/* 데이터 있는데 8개 미만인 경우 안내 */}
        {hasData && topMovers.length === 0 && (
          <div className="text-center py-6 text-[13px] text-[#B0B8C1]">
            시세 데이터를 불러오는 중입니다...
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* BLOCK 3: 속보 뉴스 (최신 5건)                  */}
      {/* ═══════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3.5 border-b border-[#F2F4F6]">
          <span className="text-[15px]">📰</span>
          <span className="text-[14px] font-bold text-[#191F28]">속보 뉴스</span>
          <div className="flex items-center gap-1 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
            <span className="text-[11px] text-[#B0B8C1]">5분 갱신</span>
          </div>
        </div>

        {newsLoading && <SkeletonNews count={5} />}

        {!newsLoading && topNews.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#B0B8C1]">
            뉴스를 불러오는 중입니다...
          </div>
        )}

        {!newsLoading && topNews.map(item => (
          <NewsRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
