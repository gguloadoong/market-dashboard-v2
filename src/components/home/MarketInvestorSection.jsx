// 시장 전체 투자자 동향 섹션
// 코스피+코스닥 외국인/기관/개인 순매수 흐름 시각화
// 데이터: /api/hantoo-market-investor (한투 KIS API → Naver fallback)

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TabbedChips } from '@coinbase/cds-web/chips';
import { formatNetAmt } from '../../api/investor';

// ─── 탭 정의 ─────────────────────────────────────────────────
const TABS = [
  { id: 'combined', label: '통합' },
  { id: 'kospi',    label: '코스피' },
  { id: 'kosdaq',   label: '코스닥' },
];

// ─── 투자자 행 정의 ───────────────────────────────────────────
const ROWS = [
  { key: 'foreign',     label: '외국인', color: '#1764ED' },
  { key: 'institution', label: '기관',   color: '#8B5CF6' },
  { key: 'individual',  label: '개인',   color: '#8B95A1' },
];

// ─── 시장 투자자 데이터 fetch ─────────────────────────────────
async function fetchMarketInvestor() {
  const res = await fetch('/api/hantoo-market-investor', {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`market-investor ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ─── 게이지 바 너비 계산 (절대값 기준 정규화) ────────────────
function calcBars(marketData) {
  const vals = ROWS.map(r => Math.abs(marketData[r.key] ?? 0));
  const max  = Math.max(...vals, 1);
  return vals.map(v => (v / max) * 100);
}

// ─── 외인+기관 동반 신호 배지 ─────────────────────────────────
function SignalBadge({ marketData }) {
  if (!marketData) return null;
  const fBuy = marketData.foreign     > 0;
  const iBuy = marketData.institution > 0;

  if (fBuy && iBuy) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ background: '#F0FFF4', color: '#2AC769' }}>
        기관+외인 동반매수
      </span>
    );
  }
  if (!fBuy && !iBuy) {
    return (
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{ background: '#FFF0F1', color: '#F04452' }}>
        기관+외인 동반매도
      </span>
    );
  }
  return null;
}

// ─── 스켈레톤 로딩 UI ─────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] overflow-hidden">
      {/* 헤더 스켈레톤 */}
      <div className="px-4 py-3 border-b border-[#F2F4F6] bg-[#FAFBFC]">
        <div className="h-3 bg-[#F2F4F6] rounded w-28 animate-pulse" />
      </div>
      {/* 행 스켈레톤 */}
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="h-3 bg-[#F2F4F6] rounded w-12 animate-pulse" />
          <div className="flex-1 h-1.5 bg-[#F2F4F6] rounded-full animate-pulse" />
          <div className="h-3 bg-[#F2F4F6] rounded w-16 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── 투자자 행 컴포넌트 ───────────────────────────────────────
function InvestorRow({ row, amount, barWidth }) {
  const isPos   = amount > 0;
  const isNeg   = amount < 0;
  const color   = isPos ? '#F04452' : isNeg ? '#1764ED' : '#B0B8C1';
  const arrow   = isPos ? '↑' : isNeg ? '↓' : '';
  const label   = isPos ? '매수' : isNeg ? '매도' : '중립';
  const labelColor = isPos ? '#F04452' : isNeg ? '#1764ED' : '#B0B8C1';

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {/* 레이블 */}
      <span className="text-[12px] text-[#6B7684] w-12 flex-shrink-0 font-medium">
        {row.label}
      </span>

      {/* 게이지 바 */}
      <div className="flex-1 h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${barWidth}%`, background: color }}
        />
      </div>

      {/* 순매수 금액 */}
      <span
        className="text-[12px] font-bold tabular-nums font-mono w-20 text-right flex-shrink-0"
        style={{ color }}
      >
        {amount !== 0 ? formatNetAmt(amount) : '—'}
      </span>

      {/* 방향 화살표 + 레이블 */}
      <span
        className="text-[10px] font-bold w-10 text-right flex-shrink-0"
        style={{ color: labelColor }}
      >
        {arrow} {label}
      </span>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function MarketInvestorSection() {
  const [activeTab, setActiveTab] = useState('combined');

  // React Query — 1분 stale, 에러 시 null 처리
  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-investor'],
    queryFn:  fetchMarketInvestor,
    staleTime:    60_000,
    retry:        1,
    refetchInterval: 60_000,
  });

  // 로딩 중
  if (isLoading) return <Skeleton />;

  // 에러 또는 데이터 없음 → 섹션 숨김 (홈이 깔끔해야 함)
  if (isError || !data) return null;

  // 활성 탭 데이터
  const marketData = data[activeTab];
  if (!marketData) return null;

  const bars = calcBars(marketData);

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] overflow-hidden">

      {/* ─── 헤더 ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6] bg-[#FAFBFC]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#191F28]">👥 오늘 큰손 동향</span>
          <SignalBadge marketData={marketData} />
        </div>
        <span className="text-[10px] text-[#B0B8C1]">
          {data.date
            ? `${data.date.slice(0, 4)}.${data.date.slice(4, 6)}.${data.date.slice(6, 8)}`
            : '오늘'}
        </span>
      </div>

      {/* ─── 투자자 행 ─────────────────────────────────────── */}
      <div className="divide-y divide-[#F2F4F6]">
        {ROWS.map((row, i) => (
          <InvestorRow
            key={row.key}
            row={row}
            amount={marketData[row.key] ?? 0}
            barWidth={bars[i]}
          />
        ))}
      </div>

      {/* ─── 탭 (코스피 / 코스닥 / 통합) ──────────────────── */}
      <div className="flex justify-center px-4 py-2 border-t border-[#F2F4F6]">
        <TabbedChips tabs={TABS} value={activeTab} onChange={setActiveTab} />
      </div>
    </div>
  );
}
