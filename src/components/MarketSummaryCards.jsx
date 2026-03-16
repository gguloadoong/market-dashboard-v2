// 오늘의 마켓 요약 — 공포탐욕 / BTC 도미넌스 / 김치프리미엄
import { useState, useEffect } from 'react';
import { fetchFearGreed, fetchBtcDominance, calcKimchiPremium } from '../api/market';

// 공포탐욕 색상
function fgColor(value) {
  if (value <= 25) return { color: '#F04452', bg: '#FFF0F1', label: '극도 공포' };
  if (value <= 45) return { color: '#FF6B35', bg: '#FFF4EE', label: '공포' };
  if (value <= 55) return { color: '#8B95A1', bg: '#F2F4F6', label: '중립' };
  if (value <= 75) return { color: '#2AC769', bg: '#F0FFF6', label: '탐욕' };
  return { color: '#1764ED', bg: '#EDF4FF', label: '극도 탐욕' };
}

// 게이지 바 컴포넌트
function GaugeBar({ value, max = 100, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="w-full h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden mt-1.5">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function MarketSummaryCards({ coins = [], krwRate = 1466 }) {
  const [fearGreed, setFearGreed] = useState(null);
  const [dominance, setDominance] = useState(null);

  useEffect(() => {
    fetchFearGreed().then(setFearGreed).catch(() => {});
    fetchBtcDominance().then(setDominance).catch(() => {});
  }, []);

  // 김치프리미엄 계산 (실시간 coins 데이터 사용)
  const btcCoin = coins.find(c => c.symbol === 'BTC');
  const kimchi  = btcCoin
    ? calcKimchiPremium(btcCoin.priceKrw, btcCoin.priceUsd, krwRate)
    : null;

  const fgStyle = fearGreed ? fgColor(fearGreed.value) : null;
  const kimchiColor = kimchi === null ? '#8B95A1' : kimchi > 0 ? '#F04452' : '#1764ED';
  const domColor = '#FF9500';

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* 공포 & 탐욕 */}
      <div className="bg-white rounded-xl px-3 py-2.5 border border-[#F2F4F6] shadow-sm">
        <div className="text-[10px] text-[#8B95A1] font-semibold mb-0.5">공포 & 탐욕</div>
        {fearGreed ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[20px] font-bold tabular-nums font-mono" style={{ color: fgStyle.color }}>
                {fearGreed.value}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: fgStyle.bg, color: fgStyle.color }}
              >
                {fearGreed.labelKo}
              </span>
            </div>
            <GaugeBar value={fearGreed.value} color={fgStyle.color} />
          </>
        ) : (
          <div className="h-7 bg-[#F2F4F6] rounded animate-pulse mt-1" />
        )}
      </div>

      {/* BTC 도미넌스 */}
      <div className="bg-white rounded-xl px-3 py-2.5 border border-[#F2F4F6] shadow-sm">
        <div className="text-[10px] text-[#8B95A1] font-semibold mb-0.5">BTC 도미넌스</div>
        {dominance !== null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-bold tabular-nums font-mono" style={{ color: domColor }}>
                {dominance.toFixed(1)}
              </span>
              <span className="text-[12px] text-[#8B95A1] font-bold">%</span>
            </div>
            <GaugeBar value={dominance} color={domColor} />
          </>
        ) : (
          <div className="h-7 bg-[#F2F4F6] rounded animate-pulse mt-1" />
        )}
      </div>

      {/* 김치프리미엄 */}
      <div className="bg-white rounded-xl px-3 py-2.5 border border-[#F2F4F6] shadow-sm">
        <div className="text-[10px] text-[#8B95A1] font-semibold mb-0.5">김치프리미엄</div>
        {kimchi !== null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-bold tabular-nums font-mono" style={{ color: kimchiColor }}>
                {kimchi > 0 ? '+' : ''}{kimchi.toFixed(2)}
              </span>
              <span className="text-[12px] font-bold" style={{ color: kimchiColor }}>%</span>
            </div>
            <div className="text-[10px] text-[#B0B8C1] mt-1">Upbit vs 글로벌</div>
          </>
        ) : (
          <div className="h-7 bg-[#F2F4F6] rounded animate-pulse mt-1" />
        )}
      </div>
    </div>
  );
}
