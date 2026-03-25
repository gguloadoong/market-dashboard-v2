// 급등/급락 ticker 배너 — 상단 sticky (Coinbase ticker 스타일)
// 급등(>=3%) + 급락(<=-3%) 종목 표시
// 급등/급락 없을 때: 시장 지수 요약 표시
// afterHoursPrice: 시간외 단일가가 있을 때 표시
import { memo, useMemo } from 'react';
import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';

// 시장별 컬러 도트
const MARKET_DOT = {
  kr:    '#FF6B77',  // 국장 — 빨강
  us:    '#5B9CF6',  // 미장 — 파랑
  coin:  '#F59E0B',  // 코인 — 노랑
  index: '#9CA3AF',  // 지수 — 회색
};

// 배너 상태별 컬러 토큰 — Gemini 제안: 하드코딩 제거
const C = {
  bgHot:          '#0A0A0A',
  bgDefault:      '#111318',
  borderHot:      'rgba(240,68,82,0.15)',
  borderDefault:  'rgba(255,255,255,0.06)',
  dotHot:         '#F04452',   // 급등 상태 ping/dot
  dotIdle:        '#6B7280',   // 비활성 ping
  dotIdleSolid:   '#4B5563',   // 비활성 dot
  labelHot:       '#FF6B77',   // LIVE 텍스트
  labelDefault:   'rgba(255,255,255,0.28)',
  afterHoursBg:   'rgba(245,158,11,0.15)',
  afterHoursText: '#F59E0B',
  pctUp:          '#FF6B77',   // 상승 등락률
  pctDown:        '#5B9CF6',   // 하락 등락률
  pctFlat:        'rgba(255,255,255,0.38)',
  separator:      'rgba(255,255,255,0.08)',
  labelBorder:    'rgba(255,255,255,0.07)',
  symbolText:     'rgba(255,255,255,0.88)',
  valueText:      'rgba(255,255,255,0.55)',
};

// React.memo: coins WS 틱마다 재렌더 방지 — 급등 순위 실제 변경 시에만 업데이트
const SurgeBanner = memo(function SurgeBanner({ stocks = [], coins = [], indices = [], onClick }) {
  const { items, hasHot, isIndexMode } = useMemo(() => {
    const krOpen = getKoreanMarketStatus().status === 'open';
    const usOpen = getUsMarketStatus().status === 'open';

    const all = [
      ...stocks
        .filter(s => s.market === 'kr' ? krOpen : s.market === 'us' ? usOpen : true)
        .map(s => ({
          name:            s.name || s.symbol,
          symbol:          s.symbol,
          pct:             s.changePct ?? 0,
          market:          s.market,
          afterHoursPrice: s.afterHoursPrice ?? null,
          afterHoursPct:   s.afterHoursChangePct ?? null,
          _raw:            s,
        })),
      ...coins.map(c => ({
        name:            c.name,
        symbol:          c.symbol,
        pct:             c.change24h ?? 0,
        market:          'coin',
        afterHoursPrice: null,
        afterHoursPct:   null,
        _raw:            c,
      })),
    ];

    const surges = all.filter(i => i.pct >= 3).sort((a, b) => b.pct - a.pct);
    const drops  = all.filter(i => i.pct <= -3).sort((a, b) => a.pct - b.pct);
    const hasHot = surges.length > 0 || drops.length > 0;

    let base;
    if (hasHot) {
      base = [...surges.slice(0, 10), ...drops.slice(0, 10)];
    } else if (indices.length > 0) {
      const idxItems = indices
        .filter(idx => idx.value > 0)
        .map(idx => ({
          name: idx.name, symbol: idx.id,
          pct: idx.changePct ?? 0, market: 'index',
          afterHoursPrice: null, afterHoursPct: null,
          _value: idx.value, _raw: null,
        }));
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

    return { items: [...base, ...base], hasHot, isIndexMode: false };
  }, [stocks, coins, indices]);

  if (!items.length) return null;

  const dur = Math.max(28, items.length * 2.2);

  return (
    <div
      className="flex items-center ticker-wrap select-none"
      style={{
        background: hasHot ? C.bgHot : C.bgDefault,
        height: '36px',
        borderBottom: hasHot
          ? `1px solid ${C.borderHot}`
          : `1px solid ${C.borderDefault}`,
      }}
    >
      {/* 라벨 */}
      <div
        className="flex-shrink-0 flex items-center gap-2 h-full px-3"
        style={{ borderRight: `1px solid ${C.labelBorder}`, minWidth: 72 }}
      >
        {/* 상태 표시 펄스 */}
        <span
          className="relative flex h-2 w-2 flex-shrink-0"
          aria-hidden="true"
        >
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: hasHot ? C.dotHot : C.dotIdle }}
          />
          <span
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ background: hasHot ? C.dotHot : C.dotIdleSolid }}
          />
        </span>
        <span
          className="text-[10px] font-semibold tracking-[0.08em] uppercase whitespace-nowrap"
          style={{ color: hasHot ? C.labelHot : C.labelDefault }}
        >
          {hasHot ? 'LIVE' : isIndexMode ? 'INDEX' : 'MARKET'}
        </span>
      </div>

      {/* ticker track */}
      <div className="ticker-track" style={{ '--dur': `${dur}s` }}>
        {items.map((item, i) => {
          // afterHours 표시: 정규장 외 시간에 시간외 데이터가 있을 때
          const showAfterHours = item.afterHoursPrice != null && item.afterHoursPct != null;
          const displayPct     = showAfterHours ? item.afterHoursPct : item.pct;
          const isUp           = displayPct > 0;
          const isDown         = displayPct < 0;

          return (
            <button
              key={`${i}-${item.symbol}`}
              type="button"
              className="inline-flex items-center gap-1.5 px-3 h-full cursor-pointer transition-opacity hover:opacity-70 focus:outline-none bg-transparent border-0"
              onClick={() => item._raw && onClick?.(item._raw)}
            >
              {/* 시장 컬러 도트 */}
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: MARKET_DOT[item.market] ?? C.dotIdleSolid }}
              />

              {/* 심볼 */}
              <span
                className="text-[11px] font-bold tracking-tight"
                style={{ color: C.symbolText }}
              >
                {item.symbol}
              </span>

              {/* 지수 모드: 지수 값 */}
              {item._value > 0 && (
                <span
                  className="text-[11px] font-mono tabular-nums"
                  style={{ color: C.valueText }}
                >
                  {item._value >= 1000
                    ? item._value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
                    : item._value.toFixed(2)}
                </span>
              )}

              {/* 시간외 배지 */}
              {showAfterHours && (
                <span
                  className="text-[9px] font-semibold px-1 rounded"
                  style={{
                    background: C.afterHoursBg,
                    color: C.afterHoursText,
                    letterSpacing: '0.04em',
                  }}
                >
                  시간외
                </span>
              )}

              {/* 등락률 */}
              <span
                className="text-[11px] font-semibold tabular-nums font-mono"
                style={{ color: isUp ? C.pctUp : isDown ? C.pctDown : C.pctFlat }}
              >
                {isUp ? '+' : ''}{displayPct.toFixed(2)}%
              </span>

              {/* 구분선 */}
              <span
                className="w-px h-3 flex-shrink-0 ml-1"
                style={{ background: C.separator }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default SurgeBanner;
