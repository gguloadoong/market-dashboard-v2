import { memo, useState, useMemo } from 'react';
import { getPct, MARKET_BADGE, TYPE_BADGE, PALETTE } from './utils';
import { MARKET_FLAG, RELATION_TYPES } from '../../data/relatedAssets';
import { extractNewsSignals } from '../../utils/newsSignal';

// ─── 관련종목 인라인 chip ─────────────────────────────────────
const RelatedChips = memo(function RelatedChips({ relatedItems, onChipClick }) {
  const [showAll, setShowAll] = useState(false);
  if (!relatedItems.length) return null;

  const MAX_VISIBLE = 3;
  const visible = showAll ? relatedItems : relatedItems.slice(0, MAX_VISIBLE);
  const hiddenCount = relatedItems.length - MAX_VISIBLE;

  return (
    <div className="flex flex-wrap items-center gap-1 pl-[52px] pb-2 pt-0.5">
      <span className="text-[9px] text-[#C9CDD2] font-semibold tracking-wide flex-shrink-0">연관</span>
      {visible.map(({ ticker, type, market, item: rel }) => {
        const relPct   = rel ? (rel.change24h ?? rel.changePct ?? 0) : null;
        const relColor = relPct == null ? '#B0B8C1' : relPct > 0 ? '#F04452' : relPct < 0 ? '#1764ED' : '#8B95A1';
        const flag     = MARKET_FLAG[market] || '';
        const arrow    = relPct == null ? '' : relPct > 0 ? '↑' : relPct < 0 ? '↓' : '';

        return (
          <button
            key={ticker}
            onClick={e => { e.stopPropagation(); rel && onChipClick?.(rel); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-[6px] border border-[#E5E8EB] transition-colors hover:border-[#B0B8C1]"
            style={{ background: '#F2F4F6', fontSize: '11px' }}
            title={`${ticker} · ${TYPE_BADGE[type]?.label || type}`}
          >
            <span className="text-[9px] leading-none">{flag}</span>
            <span className="font-bold text-[#191F28] font-mono leading-none">{ticker}</span>
            {relPct != null && (
              <span className="font-bold tabular-nums font-mono leading-none" style={{ color: relColor, fontSize: '10px' }}>
                {arrow}{Math.abs(relPct).toFixed(1)}%
              </span>
            )}
          </button>
        );
      })}
      {!showAll && hiddenCount > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setShowAll(true); }}
          className="px-1.5 py-0.5 rounded-[6px] bg-[#F2F4F6] border border-[#E5E8EB] text-[10px] font-bold text-[#8B95A1] hover:text-[#4E5968] transition-colors"
        >
          +{hiddenCount}
        </button>
      )}
    </div>
  );
});

// ─── SECTION 4: 인사이트 카드 ────────────────────────────────
const InsightCard = memo(function InsightCard({ mover, news, onMoverClick }) {
  const pct    = getPct(mover);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const badge  = MARKET_BADGE[mover._market] || { bg: '#F2F4F6', color: '#8B95A1' };
  const signals = useMemo(() => news ? extractNewsSignals(news.title) : [], [news?.title]);
  const bgColor = isUp ? '#FFFAFA' : isDown ? '#F4F8FF' : '#FAFBFC';
  const borderColor = isUp ? '#FFE8E8' : isDown ? '#DCE9FF' : '#F2F4F6';

  const cardContent = (
    <div
      className="flex-shrink-0 w-[240px] rounded-xl border p-3"
      style={{ background: bgColor, borderColor }}
      onClick={() => !news && onMoverClick?.(mover)}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onMoverClick?.(mover); }}
          className="flex items-center gap-1 hover:opacity-75 flex-shrink-0"
        >
          <span className="text-[12px] font-bold text-[#191F28]">{mover.name}</span>
          <span className="text-[12px] font-bold font-mono tabular-nums" style={{ color }}>
            {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
          </span>
        </button>
        <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
          style={{ background: badge.bg, color: badge.color }}>
          {mover._market}
        </span>
        {signals.map(sig => (
          <span key={sig.tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: sig.bg, color: sig.color }}>
            {sig.tag}
          </span>
        ))}
        {news?.timeAgo && (
          <span className="text-[10px] text-[#B0B8C1] flex-shrink-0 ml-auto">{news.timeAgo}</span>
        )}
      </div>
      {news ? (
        <div className="text-[12px] text-[#4E5968] leading-snug line-clamp-2">{news.title}</div>
      ) : (
        <div className="text-[11px] text-[#B0B8C1]">관련 뉴스 수집 중...</div>
      )}
    </div>
  );

  if (!news) return <div className="cursor-pointer hover:opacity-80 transition-opacity">{cardContent}</div>;

  return (
    <a href={news.link} target="_blank" rel="noopener noreferrer"
      className="hover:opacity-90 transition-opacity">
      {cardContent}
    </a>
  );
});

// ─── 관심종목 섹션 ───
export function WatchlistSection({ watchedItems, toggle, onItemClick }) {
  if (watchedItems.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">⭐</span>
          <span className="text-[14px] font-bold text-[#191F28]">관심종목</span>
          <span className="text-[11px] text-[#8B95A1]">{watchedItems.length}개</span>
        </div>
      </div>
      <div className="divide-y divide-[#F2F4F6]">
        {watchedItems.map(item => {
          const pct    = getPct(item);
          const isUp   = pct >= 0;
          const upClr  = '#F04452';
          const dnClr  = '#1764ED';
          const clr    = pct === 0 ? '#8B95A1' : isUp ? upClr : dnClr;
          const price  = item._market === 'KR'
            ? `₩${(item.price ?? 0).toLocaleString()}`
            : item._market === 'COIN'
              ? `₩${Math.round(item.priceKrw ?? 0).toLocaleString()}`
              : `$${(item.price ?? 0).toLocaleString()}`;
          return (
            <div
              key={item.id || item.symbol}
              className="flex items-center justify-between px-4 py-3 hover:bg-[#FAFAFA] cursor-pointer"
              onClick={() => onItemClick?.(item)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={e => { e.stopPropagation(); toggle(item.id || item.symbol); }}
                  className="text-[14px] text-yellow-400 flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >★</button>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#191F28] truncate">{item.name ?? item.symbol}</p>
                  <p className="text-[11px] text-[#8B95A1]">{item.symbol}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <p className="text-[14px] font-bold font-mono tabular-nums" style={{ color: clr }}>
                  {isUp ? '+' : ''}{pct.toFixed(2)}%
                </p>
                <p className="text-[11px] text-[#8B95A1] font-mono">{price}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 관심종목 × 뉴스 매칭 ───
export function WatchlistNewsSection({ watchlistInsights, onItemClick }) {
  if (watchlistInsights.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[14px]">📋</span>
        <span className="text-[14px] font-bold text-[#191F28]">내 종목 뉴스</span>
        <span className="text-[11px] text-[#8B95A1] ml-1">관심종목 관련 최신 뉴스</span>
        <span className="text-[11px] text-[#3182F6] bg-[#EDF4FF] px-1.5 py-0.5 rounded-full ml-auto font-semibold">
          뉴스 {watchlistInsights.length}건
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto p-4 no-scrollbar">
        {watchlistInsights.map(({ mover, news }) => (
          <InsightCard
            key={`watchlist-insight-${mover._market}-${mover.id || mover.symbol}`}
            mover={mover}
            news={news}
            onMoverClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

// ─── SECTION 4: 인사이트 카드 (default export) ───
export default function InsightsSection({ newsLoading, hasData, insights, onItemClick }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[14px]">💡</span>
        <span className="text-[14px] font-bold text-[#191F28]">인사이트</span>
        {newsLoading && (
          <span className="text-[10px] text-[#B0B8C1] bg-[#F2F4F6] px-1.5 py-0.5 rounded ml-1">로딩 중</span>
        )}
        <span className="text-[11px] text-[#B0B8C1] ml-auto">급등종목 관련 뉴스</span>
      </div>
      <div className="flex gap-3 overflow-x-auto p-4 no-scrollbar">
        {(newsLoading || !hasData) && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[260px] rounded-xl border border-[#F2F4F6] p-3 animate-pulse">
            <div className="flex gap-1.5 mb-2">
              <div className="h-3 bg-[#F2F4F6] rounded w-20" />
              <div className="h-3 bg-[#F2F4F6] rounded w-10" />
            </div>
            <div className="h-3 bg-[#F2F4F6] rounded mb-1" />
            <div className="h-3 bg-[#F2F4F6] rounded w-4/5" />
          </div>
        ))}
        {!newsLoading && hasData && insights.map(({ mover, news }) => (
          <InsightCard
            key={`insight-${mover._market}-${mover.id || mover.symbol}`}
            mover={mover}
            news={news}
            onMoverClick={onItemClick}
          />
        ))}
        {!newsLoading && hasData && insights.length === 0 && (
          <div className="flex flex-col items-center justify-center w-full py-6 gap-1.5">
            <span className="text-[22px]">📰</span>
            <span className="text-[13px] text-[#B0B8C1]">현재 급등 종목과 매칭된 뉴스가 없습니다</span>
            <span className="text-[11px] text-[#C8CDD4]">뉴스가 들어오면 자동으로 표시돼요</span>
          </div>
        )}
      </div>
    </div>
  );
}
