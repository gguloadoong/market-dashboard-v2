// Fear & Greed 지수 위젯 — 코인(Alternative.me) + 미장(CNN Money)
// Market Pulse 영역 하단에 표시
import { useFearGreed, getFgLabel, getFgColor } from '../../../hooks/useFearGreed';

function FgGauge({ score, label, color }) {
  const pct = Math.min(100, Math.max(0, score ?? 0));
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      {/* 아크 게이지 대신 심플한 수평 바 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[22px] font-bold tabular-nums font-mono leading-none" style={{ color }}>
            {score ?? '—'}
          </span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
            {label}
          </span>
        </div>
        <div className="h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden">
          {/* 점수 위치에 인디케이터 */}
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, #F04452 0%, #FF6B35 25%, #8B95A1 50%, #2AC769 75%, #00B894 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FgSkeleton() {
  return <div className="h-8 w-20 bg-[#F2F4F6] rounded-lg animate-pulse" />;
}

export default function FearGreedWidget() {
  const { crypto, us } = useFearGreed();

  const cryptoScore  = crypto.data?.score;
  const cryptoLabel  = getFgLabel(cryptoScore);
  const cryptoColor  = getFgColor(cryptoScore);

  const usScore  = us.data?.score;
  const usLabel  = getFgLabel(usScore);
  const usColor  = getFgColor(usScore);

  // 둘 다 로딩 실패 시 숨김
  if (crypto.isError && us.isError) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[13px] font-bold text-[#191F28]">공포 &amp; 탐욕 지수</span>
        <span className="text-[10px] text-[#B0B8C1]">Fear &amp; Greed Index</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* 코인 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[10px] font-bold text-[#8B95A1] uppercase tracking-wide">🪙 코인</span>
            <span className="text-[9px] text-[#C9CDD2]">Alternative.me</span>
          </div>
          {crypto.isLoading ? <FgSkeleton /> : (
            crypto.isError ? (
              <span className="text-[11px] text-[#B0B8C1]">불러오기 실패</span>
            ) : (
              <FgGauge score={cryptoScore} label={cryptoLabel} color={cryptoColor} />
            )
          )}
        </div>
        {/* 미장 */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[10px] font-bold text-[#8B95A1] uppercase tracking-wide">🇺🇸 미장</span>
            <span className="text-[9px] text-[#C9CDD2]">CNN Money</span>
          </div>
          {us.isLoading ? <FgSkeleton /> : (
            us.isError ? (
              <span className="text-[11px] text-[#B0B8C1]">불러오기 실패</span>
            ) : (
              <FgGauge score={usScore} label={usLabel} color={usColor} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
