// 투자자 동향 — 외국인/기관/개인 순매수 흐름 시각화
// 토스 스타일: 숫자 중심, 색상으로 방향, 게이지 바
import { useState, useEffect } from 'react';
import { fetchInvestorDataSafe } from '../api/investor';

const ROWS = [
  { key: 'foreign',     label: '외인',  color: '#1764ED', bgPos: '#EDF4FF', bgNeg: '#FFF0F1' },
  { key: 'institution', label: '기관',  color: '#8B5CF6', bgPos: '#F5F3FF', bgNeg: '#FFF0F1' },
  { key: 'individual',  label: '개인',  color: '#8B95A1', bgPos: '#F2F4F6', bgNeg: '#F2F4F6' },
];

// 전체 합계 중 절대값 기준 최대치 → 바 너비 정규화
function calcBars(data) {
  const vals = ROWS.map(r => Math.abs(data[r.key]?.netAmt ?? 0));
  const max  = Math.max(...vals, 1);
  return vals.map(v => (v / max) * 100);
}

function SignalBadge({ signal }) {
  if (!signal || signal === 'neutral') return null;
  const map = {
    buy:   { label: '매수 우위', bg: '#F0FFF4', color: '#2AC769' },
    sell:  { label: '매도 우위', bg: '#FFF0F1', color: '#F04452' },
    mixed: { label: '혼조',     bg: '#F2F4F6', color: '#6B7684' },
  };
  const s = map[signal];
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function InvestorFlow({ symbol }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol || !/^\d{6}$/.test(symbol)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchInvestorDataSafe(symbol)
      .then(setData)
      .finally(() => setLoading(false));
  }, [symbol]);

  // 국내 종목 아니면 렌더 안 함
  if (!symbol || !/^\d{6}$/.test(symbol)) return null;

  if (loading) {
    return (
      <div className="mx-5 mb-4 border border-[#F2F4F6] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F2F4F6]">
          <div className="h-3 bg-[#F2F4F6] rounded w-24 animate-pulse" />
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="px-4 py-2.5 flex items-center gap-3">
            <div className="h-3 bg-[#F2F4F6] rounded w-8 animate-pulse" />
            <div className="flex-1 h-1.5 bg-[#F2F4F6] rounded-full animate-pulse" />
            <div className="h-3 bg-[#F2F4F6] rounded w-14 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const bars = calcBars(data);

  return (
    <div className="mx-5 mb-4 border border-[#F2F4F6] rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F2F4F6] bg-[#FAFBFC]">
        <span className="text-[12px] font-bold text-[#191F28]">👥 투자자 동향</span>
        <span className="text-[10px] text-[#B0B8C1]">오늘</span>
        <SignalBadge signal={data.signal} />
      </div>

      {/* 외인/기관/개인 행 */}
      <div className="divide-y divide-[#F2F4F6]">
        {ROWS.map((row, i) => {
          const inv   = data[row.key];
          const net   = inv?.netAmt ?? 0;
          const isPos = net > 0;
          const isNeg = net < 0;
          const color = isPos ? '#F04452' : isNeg ? '#1764ED' : '#B0B8C1';
          const barW  = bars[i];

          return (
            <div key={row.key} className="flex items-center gap-3 px-4 py-2.5">
              {/* 레이블 */}
              <span className="text-[12px] text-[#6B7684] w-8 flex-shrink-0 font-medium">
                {row.label}
              </span>

              {/* 게이지 바 */}
              <div className="flex-1 h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${barW}%`, background: color }}
                />
              </div>

              {/* 순매수 금액 */}
              <span className="text-[12px] font-bold tabular-nums font-mono w-16 text-right flex-shrink-0"
                style={{ color }}>
                {inv?.netAmtFormatted ?? '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
