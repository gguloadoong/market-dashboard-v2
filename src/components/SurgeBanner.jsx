// 급등/급락 ticker 배너 — 상단 sticky
// 급등(>=3%) + 급락(<=-3%) 종목 표시
// 급등/급락 없을 때: 시장 지수 요약 표시 (실질적 정보 제공)
import { memo, useMemo } from 'react';
import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';

// React.memo: coins WS 틱마다 재렌더 방지 — 급등 순위 실제 변경 시에만 업데이트
const SurgeBanner = memo(function SurgeBanner({ stocks = [], coins = [], indices = [], onClick }) {
  // 급등 종목 선별 (>=3%), 없으면 지수 요약 표시
  const { items, hasHot, isIndexMode } = useMemo(() => {
    // 휴장 시장 제외 — 열린 시장 + 코인(24h)만
    const krOpen = getKoreanMarketStatus().status === 'open';
    const usOpen = getUsMarketStatus().status === 'open';
    const all = [
      ...stocks
        .filter(s => s.market === 'kr' ? krOpen : s.market === 'us' ? usOpen : true)
        .map(s => ({
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
    ];

    // 급등 (pct >= 3): 등락률 내림차순, 급락 (pct <= -3): 낙폭 내림차순(절댓값)
    const surges = all.filter(i => i.pct >= 3).sort((a, b) => b.pct - a.pct);
    const drops  = all.filter(i => i.pct <= -3).sort((a, b) => a.pct - b.pct);
    const hasHot = surges.length > 0 || drops.length > 0;

    let base;
    if (hasHot) {
      base = [...surges.slice(0, 10), ...drops.slice(0, 10)];
    } else if (indices.length > 0) {
      // 급등/급락 없을 때: 지수 요약 모드
      const idxItems = indices
        .filter(idx => idx.value > 0)
        .map(idx => ({
          name: idx.name, symbol: idx.id,
          pct: idx.changePct ?? 0, market: 'index', _raw: null,
          _value: idx.value,
        }));
      // 지수 + 변동률 상위 종목 3개 혼합
      const topMovers = [...all]
        .filter(i => Math.abs(i.pct) >= 1)
        .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
        .slice(0, 3);
      base = [...idxItems, ...topMovers];
      if (!base.length) base = [...all].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5);
      return { items: [...base, ...base], hasHot: false, isIndexMode: true };
    } else {
      base = [...all].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 5);
    }
    // 무한 스크롤 효과를 위해 2배 복제
    return { items: [...base, ...base], hasHot, isIndexMode: false };
  }, [stocks, coins, indices]);

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
          {hasHot ? '🔥 급등·급락' : isIndexMode ? '📊 시장' : '시세'}
        </span>
      </div>

      {/* ticker track */}
      <div className="ticker-track" style={{ '--dur': `${dur}s` }}>
        {items.map((item, i) => (
          <span
            key={`${i}-${item.symbol}`}
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
            {/* 지수 모드: 지수 값 표시 */}
            {item._value > 0 && (
              <span className="font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {item._value >= 1000 ? item._value.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : item._value.toFixed(2)}
              </span>
            )}
            {/* 등락률 배지 */}
            <span
              className="font-bold tabular-nums px-1.5 py-0.5 rounded-full text-[10px]"
              style={{
                background: item.pct >= 3
                  ? 'rgba(240,68,82,0.2)'
                  : item.pct <= -3
                  ? 'rgba(23,100,237,0.25)'
                  : item.pct > 0
                  ? 'rgba(42,199,105,0.15)'
                  : 'rgba(255,255,255,0.08)',
                color: item.pct >= 3
                  ? '#FF6B77'
                  : item.pct <= -3
                  ? '#5B9CF6'
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
});

export default SurgeBanner;
