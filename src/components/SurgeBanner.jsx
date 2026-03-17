// 급등 ticker 배너 — 상단 sticky
// 급등(>=3%) 종목만 표시, 없으면 상위 5개
// 급등 있을 때: 어두운 배경 + 빨간 강조
// 없을 때: 중립 배경
import { useMemo } from 'react';

export default function SurgeBanner({ stocks = [], coins = [], onClick }) {
  // 급등 종목 선별 (>=3%), 없으면 상위 5개
  const { items, hasHot } = useMemo(() => {
    const all = [
      ...stocks.map(s => ({
        name:   s.name || s.symbol,
        symbol: s.symbol,
        pct:    s.changePct ?? 0,
        image:  null,
        market: s.market,
        _raw:   s,
      })),
      ...coins.map(c => ({
        name:   c.name,
        symbol: c.symbol,
        pct:    c.change24h ?? 0,
        image:  c.image || null,
        market: 'coin',
        _raw:   c,
      })),
    ].sort((a, b) => b.pct - a.pct);

    const hot = all.filter(i => i.pct >= 3);
    const hasHot = hot.length > 0;
    // 급등 있으면 급등만, 없으면 상위 5개
    const base = hasHot ? hot : all.slice(0, 5);
    // 무한 스크롤 효과를 위해 2배 복제
    return { items: [...base, ...base], hasHot };
  }, [stocks, coins]);

  if (!items.length) return null;

  const dur = Math.max(24, items.length * 1.8);

  return (
    <div
      style={{
        background: hasHot ? '#0D0D0D' : '#18181B',
        height: '32px',
        overflow: 'hidden',
      }}
      className="flex items-center ticker-wrap"
    >
      {/* 라벨 */}
      <div
        className="flex-shrink-0 px-3 border-r flex items-center gap-1.5 h-full"
        style={{ borderColor: hasHot ? 'rgba(240,68,82,0.3)' : 'rgba(255,255,255,0.1)' }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: hasHot ? '#FF6B77' : '#6B7280' }}
        />
        <span
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ color: hasHot ? 'rgba(255,107,119,0.9)' : 'rgba(255,255,255,0.35)' }}
        >
          {hasHot ? '🔥 급등' : '시세'}
        </span>
      </div>

      {/* ticker track */}
      <div className="ticker-track" style={{ '--dur': `${dur}s` }}>
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 px-4 text-[11px] font-medium cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => item._raw && onClick?.(item._raw)}
          >
            {/* 심볼 */}
            <span
              className="font-bold"
              style={{ color: hasHot ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)' }}
            >
              {item.symbol}
            </span>
            {/* 이름 */}
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{item.name}</span>
            {/* 등락률 배지 */}
            <span
              className="font-bold tabular-nums px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                background: item.pct >= 3
                  ? 'rgba(240,68,82,0.2)'
                  : item.pct > 0
                  ? 'rgba(42,199,105,0.15)'
                  : 'rgba(255,255,255,0.08)',
                color: item.pct >= 3
                  ? '#FF6B77'
                  : item.pct > 0
                  ? '#2AC769'
                  : 'rgba(255,255,255,0.45)',
              }}
            >
              {item.pct > 0 ? '▲' : item.pct < 0 ? '▼' : '—'}{Math.abs(item.pct).toFixed(2)}%
            </span>
            <span style={{ color: 'rgba(255,255,255,0.08)' }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
