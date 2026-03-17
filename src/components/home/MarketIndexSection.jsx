import { memo, useState } from 'react';
import MarketSummaryCards from '../MarketSummaryCards';

// ─── SECTION 2: 시장 지수 compact 스트립 아이템 ──────────────
const IndexStripItem = memo(function IndexStripItem({ idx }) {
  const isUp   = (idx.changePct ?? 0) > 0;
  const isDown = (idx.changePct ?? 0) < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const flag   = { KOSPI: '🇰🇷', KOSDAQ: '🇰🇷', SPX: '🇺🇸', NDX: '🇺🇸', DJI: '🇺🇸', DXY: '🌐' }[idx.id] || '';

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#F2F4F6] hover:border-[#D1D6DB] hover:bg-[#F7F8FA] cursor-default transition-colors">
      <span className="text-[12px]">{flag}</span>
      <span className="text-[11px] text-[#8B95A1] font-medium">{idx.name}</span>
      <span className="text-[12px] font-bold tabular-nums font-mono" style={{ color }}>
        {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(idx.changePct ?? 0).toFixed(2)}%
      </span>
    </div>
  );
});

// ─── SECTION 6: 코인 시장 요약 ───
export function CoinSummarySection({ coins, krwRate }) {
  const [coinCardOpen, setCoinCardOpen] = useState(true);

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <button
        onClick={() => setCoinCardOpen(prev => !prev)}
        className="w-full flex items-center gap-2 px-4 py-3.5 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors"
      >
        <span className="text-[15px]">🪙</span>
        <span className="text-[14px] font-bold text-[#191F28]">코인 시장 요약</span>
        <span className="text-[11px] text-[#B0B8C1] ml-auto mr-1">공포탐욕 · 도미넌스 · 김프</span>
        <span className="text-[12px] text-[#8B95A1]">{coinCardOpen ? '▲' : '▼'}</span>
      </button>
      {coinCardOpen && (
        <div className="p-4">
          <MarketSummaryCards coins={coins} krwRate={krwRate} />
        </div>
      )}
    </div>
  );
}

// ─── SECTION 2: 시장 지수 compact 스트립 (default export) ───
export default function MarketIndexSection({ indices, krwRate }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] font-bold text-[#8B95A1] uppercase tracking-wide">시장 지수</span>
        <div className="flex-1 h-px bg-[#F2F4F6]" />
        {/* 환율 */}
        <span className="text-[12px] font-bold text-[#191F28] tabular-nums font-mono">
          ₩{(krwRate || 0).toLocaleString('ko-KR')}
          <span className="text-[10px] font-normal text-[#B0B8C1] ml-1">USD/KRW</span>
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {indices.length > 0
          ? indices.map(idx => <IndexStripItem key={idx.id} idx={idx} />)
          : [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex-shrink-0 h-9 w-28 rounded-xl bg-[#F2F4F6] animate-pulse" />
            ))
        }
      </div>
    </div>
  );
}
