// 핵심 시그널 섹션 — "왜 지금 이 종목이 움직이는가"
import { useMemo } from 'react';
import { getPct, fmt, findRelatedNews, computeSignalScore } from './utils';

function SignalCard({ mover, news, krwRate, onItemClick }) {
  const pct    = getPct(mover);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const isCoin = !!mover.id;

  const price = isCoin
    ? (mover.priceKrw ? `₩${fmt(Math.round(mover.priceKrw))}` : `$${mover.priceUsd?.toFixed(2) ?? '—'}`)
    : mover.market === 'us'
      ? `₩${fmt(Math.round((mover.price ?? 0) * krwRate))}`
      : `₩${fmt(mover.price)}`;

  const pctColor = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const pctArrow = isUp ? '▲' : isDown ? '▼' : '—';
  const bgGradient = isUp
    ? 'linear-gradient(135deg, #FFF8F8 0%, #FFFAF0 100%)'
    : isDown
      ? 'linear-gradient(135deg, #F4F8FF 0%, #F0F4FF 100%)'
      : 'linear-gradient(135deg, #FAFBFC 0%, #F8F9FA 100%)';

  const { score, signal, signalBg, signalColor } = computeSignalScore(mover, !!news);

  const signalReason = news
    ? news.title.length > 60 ? news.title.slice(0, 58) + '…' : news.title
    : pct >= 5 ? `${Math.abs(pct).toFixed(1)}% ${isUp ? '급등' : '급락'} — 수급·모멘텀 확인 필요`
    : `${Math.abs(pct).toFixed(1)}% ${isUp ? '상승' : '하락'} 중 — 관련 뉴스 탐색 중`;

  const mktBadge = isCoin ? { label: 'COIN', bg: '#FFF4E6', color: '#FF9500' }
    : mover._market === 'KR' || mover.market === 'kr'
      ? { label: 'KR', bg: '#FFF0F0', color: '#F04452' }
      : { label: 'US', bg: '#EDF4FF', color: '#3182F6' };

  return (
    <button
      onClick={() => onItemClick?.(mover)}
      className="w-full text-left rounded-2xl p-4 transition-all hover:shadow-md active:scale-[0.98]"
      style={{ background: bgGradient, border: '1px solid #F0F0F0' }}
    >
      {/* 상단: 종목명 + 시장 배지 + 등락률 */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: mktBadge.bg, color: mktBadge.color }}>
            {mktBadge.label}
          </span>
          <span className="text-[15px] font-bold text-[#191F28] truncate">{mover.name}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 시그널 점수 배지 */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: signalBg, color: signalColor }}>
            {signal} {score}
          </span>
          <span className="text-[20px] font-bold tabular-nums font-mono" style={{ color: pctColor }}>
            {pctArrow}{Math.abs(pct).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 현재가 */}
      <div className="text-[13px] text-[#6B7684] font-mono tabular-nums mb-2">{price}</div>

      {/* 핵심 이유 */}
      <div className="flex items-start gap-2">
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
          style={{ background: news ? '#191F28' : '#8B95A1', color: 'white' }}>
          {news ? 'WHY' : '...'}
        </span>
        <p className="text-[12px] text-[#4E5968] leading-snug line-clamp-2">{signalReason}</p>
      </div>

      {news?.timeAgo && (
        <div className="mt-1.5 text-[10px] text-[#B0B8C1]">
          {news.source ? `${news.source} · ${news.timeAgo}` : news.timeAgo}
        </div>
      )}
    </button>
  );
}

export default function SignalSection({ allItems, recentNews, krwRate, onItemClick }) {
  const signals = useMemo(() => {
    if (!allItems.length) return [];

    // 2% 이상 움직임 종목 — 절대값 내림차순
    const movers = [...allItems]
      .filter(i => Math.abs(getPct(i)) >= 2)
      .sort((a, b) => Math.abs(getPct(b)) - Math.abs(getPct(a)))
      .slice(0, 30);

    if (!movers.length) return [];

    const results = [];
    for (const mover of movers) {
      if (results.length >= 5) break;
      const newsMatch = findRelatedNews(mover, recentNews);
      results.push({ mover, news: newsMatch || null });
    }

    // 뉴스 있는 시그널 우선 정렬
    return results.sort((a, b) => {
      if (a.news && !b.news) return -1;
      if (!a.news && b.news) return 1;
      return Math.abs(getPct(b.mover)) - Math.abs(getPct(a.mover));
    });
  }, [allItems, recentNews]);

  if (!signals.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#191F28] rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
          <span className="text-[11px] font-bold text-white">지금 이유 있는 움직임</span>
        </div>
        <span className="text-[11px] text-[#B0B8C1]">{signals.length}개 시그널</span>
      </div>

      <div className={`grid gap-2 ${
        signals.length === 1 ? 'grid-cols-1' :
        signals.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
        signals.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' :
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {signals.map(({ mover, news }) => (
          <SignalCard
            key={mover.id || mover.symbol}
            mover={mover}
            news={news}
            krwRate={krwRate}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}
