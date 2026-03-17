import { memo, useState } from 'react';
import Sparkline from '../Sparkline';
import { getPct, fmt, MARKET_BADGE, PALETTE, getAvatarBg, SURGE_FILTERS } from './utils';

// ─── SECTION 1: 급등 스포트라이트 카드 ───────────────────────
const SurgeCard = memo(function SurgeCard({ item, krwRate, onClick, relatedNews }) {
  const pct   = getPct(item);
  const isUp  = pct > 0;
  const isDown = pct < 0;
  const color = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const badge = MARKET_BADGE[item._market] || { bg: '#F2F4F6', color: '#8B95A1' };

  const logoUrls = item.image ? [item.image]
    : item._market === 'US'   ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`]
    : item._market === 'KR'   ? [`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);
  const bg = getAvatarBg(item.symbol);

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
    ? `₩${fmt(item.price)}`
    : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  const sparkData = item.sparkline ?? [];
  const isHot = Math.abs(pct) >= 3;

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex-shrink-0 w-[152px] bg-white rounded-2xl border cursor-pointer active:scale-[0.98] transition-all hover:shadow-md hover:border-[#D1D6DB]"
      style={{
        borderColor: isHot ? (isUp ? '#FFD6D9' : '#C8DCFF') : '#E5E8EB',
        background: isHot ? (isUp ? '#FFFAFA' : '#F4F8FF') : '#fff',
      }}
    >
      <div className="p-3.5">
        {/* 로고 + 마켓 배지 */}
        <div className="flex items-center justify-between mb-2.5">
          {logoIdx < logoUrls.length ? (
            <img
              src={logoUrls[logoIdx]}
              alt={item.symbol}
              onError={() => setLogoIdx(i => i + 1)}
              className="w-8 h-8 rounded-full object-contain bg-white border border-[#F2F4F6] p-0.5"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ background: bg }}
            >
              {(item.symbol || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: badge.bg, color: badge.color }}
          >
            {item._market}
          </span>
        </div>

        {/* 종목명 + 심볼 */}
        <div className="mb-2">
          <div className="text-[13px] font-bold text-[#191F28] truncate leading-tight">{item.name}</div>
          <div className="text-[10px] text-[#8B95A1] font-mono font-semibold mt-0.5">{item.symbol}</div>
        </div>

        {/* 가격 */}
        <div className="text-[13px] font-bold text-[#191F28] tabular-nums font-mono truncate mb-1.5">
          {price}
        </div>

        {/* 등락률 배지 */}
        <div
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums font-mono mb-2"
          style={{
            background: isUp ? '#FFF0F0' : isDown ? '#EDF4FF' : '#F2F4F6',
            color,
          }}
        >
          {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(pct).toFixed(2)}%
        </div>

        {/* 스파크라인 */}
        <div className="mt-1">
          <Sparkline data={sparkData} width={120} height={28} positive={isUp ? true : isDown ? false : undefined} />
        </div>

        {/* 급등 이유 뉴스 컨텍스트 한 줄 */}
        {relatedNews && (
          <div
            className="mt-2 pt-2 border-t"
            style={{ borderColor: isHot ? (isUp ? '#FFD6D9' : '#C8DCFF') : '#F2F4F6' }}
          >
            <p className="text-[10px] text-[#6B7684] leading-tight line-clamp-2 break-keep">
              {relatedNews.title}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

function SkeletonSurgeCard({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="flex-shrink-0 w-[152px] rounded-2xl border border-[#F2F4F6] p-3.5 animate-pulse bg-white">
      <div className="flex items-center justify-between mb-2.5">
        <div className="w-8 h-8 rounded-full bg-[#F2F4F6]" />
        <div className="w-8 h-4 rounded-full bg-[#F2F4F6]" />
      </div>
      <div className="h-3.5 bg-[#F2F4F6] rounded w-20 mb-1" />
      <div className="h-3 bg-[#F2F4F6] rounded w-12 mb-2" />
      <div className="h-4 bg-[#F2F4F6] rounded w-24 mb-1.5" />
      <div className="h-5 bg-[#F2F4F6] rounded-full w-16 mb-2" />
      <div className="h-7 bg-[#F2F4F6] rounded w-full" />
    </div>
  ));
}

export default function SurgeSection({ hasData, surgeItems, krwRate, onItemClick, surgeNewsMap, surgeMarket, setSurgeMarket, hasHotItems }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">🚀</span>
          <span className="text-[14px] font-bold text-[#191F28]">지금 급등</span>
          {hasHotItems && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF0F0] text-[#F04452] animate-pulse">
              HOT
            </span>
          )}
        </div>
        {/* 시장 필터 탭 */}
        <div className="flex items-center gap-1">
          {SURGE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setSurgeMarket(f.id)}
              className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors flex-shrink-0 ${
                surgeMarket === f.id
                  ? 'bg-[#191F28] text-white'
                  : 'text-[#6B7684] hover:bg-[#F2F4F6]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 급등 카드 가로 스크롤 */}
      <div className="flex gap-3 overflow-x-auto p-4 no-scrollbar">
        {!hasData
          ? <SkeletonSurgeCard count={5} />
          : surgeItems.map(item => (
              <SurgeCard
                key={`surge-${item._market}-${item.id || item.symbol}`}
                item={item}
                krwRate={krwRate}
                onClick={onItemClick}
                relatedNews={surgeNewsMap[item.symbol] || null}
              />
            ))
        }
      </div>
    </div>
  );
}
