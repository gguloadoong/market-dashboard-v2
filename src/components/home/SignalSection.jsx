// 핵심 시그널 섹션 — "왜 지금 이 종목이 움직이는가"
// 가장 상단에 배치 — 매수 결정 직전 5분을 위한 핵심 정보
import { useMemo } from 'react';
import { getPct, fmt } from './utils';

// 시그널 카드 1개 — 종목 + 등락률 + 뉴스 이유
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

  // 시그널 강도 (이유 근거)
  const signalReason = news
    ? news.title.length > 60 ? news.title.slice(0, 58) + '…' : news.title
    : `${Math.abs(pct).toFixed(1)}% ${isUp ? '상승' : '하락'} 중 — 이유 분석 중`;

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
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: mktBadge.bg, color: mktBadge.color }}
          >
            {mktBadge.label}
          </span>
          <span className="text-[15px] font-bold text-[#191F28] truncate">
            {mover.name}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5 flex-shrink-0">
          <span className="text-[20px] font-bold tabular-nums font-mono" style={{ color: pctColor }}>
            {pctArrow}{Math.abs(pct).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 현재가 */}
      <div className="text-[13px] text-[#6B7684] font-mono tabular-nums mb-2">
        {price}
      </div>

      {/* 핵심 이유 */}
      <div className="flex items-start gap-2">
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#191F28] text-white flex-shrink-0 mt-0.5">
          WHY
        </span>
        <p className="text-[12px] text-[#4E5968] leading-snug line-clamp-2">
          {signalReason}
        </p>
      </div>

      {/* 뉴스 시간 */}
      {news?.timeAgo && (
        <div className="mt-1.5 text-[10px] text-[#B0B8C1]">
          {news.source ? `${news.source} · ${news.timeAgo}` : news.timeAgo}
        </div>
      )}
    </button>
  );
}

export default function SignalSection({ allItems, recentNews, krwRate, onItemClick }) {
  // 뉴스 있는 상위 무버 최대 3개 선택
  const signals = useMemo(() => {
    if (!allItems.length) return [];
    import('../../utils/newsAlias').then(() => {}); // 사전 캐시

    // 2% 이상 움직임 종목 — 절대값 내림차순
    const movers = [...allItems]
      .filter(i => Math.abs(getPct(i)) >= 2)
      .sort((a, b) => Math.abs(getPct(b)) - Math.abs(getPct(a)))
      .slice(0, 20);

    if (!movers.length) return [];

    // 뉴스 매칭
    const results = [];
    for (const mover of movers) {
      if (results.length >= 3) break;
      const newsMatch = recentNews.find(n => {
        const text = (n.title + ' ' + (n.description || '')).toLowerCase();
        const name = (mover.name || '').toLowerCase();
        const sym  = (mover.symbol || mover.id || '').toLowerCase();
        // 종목명/심볼 직접 포함 여부 (단순 체크, newsAlias와 별개로 빠른 필터)
        return name.length >= 2 && text.includes(name) || (sym.length >= 2 && !/^\d{6}$/.test(sym) && text.includes(sym));
      });
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
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#191F28] rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
          <span className="text-[11px] font-bold text-white">지금 이유 있는 움직임</span>
        </div>
      </div>

      {/* 시그널 카드 그리드 — 최대 3개 */}
      <div className={`grid gap-2 ${signals.length === 1 ? 'grid-cols-1' : signals.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
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
