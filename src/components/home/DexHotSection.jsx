// DEX 핫 프로토콜 섹션 — DeFiLlama API로 실시간 DEX 거래량 상위 표시
import { useQuery } from '@tanstack/react-query';

// ─── 금액 포맷 헬퍼 ─────────────────────────────────────
// $1.2B, $890M, $12.3M 등 한눈에 읽히는 형식으로 변환
function fmtVolume(n) {
  if (!n || isNaN(n)) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── 변화율 포맷 ─────────────────────────────────────────
function fmtChange(pct) {
  if (pct === null || pct === undefined || isNaN(pct)) return null;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ─── DeFiLlama DEX 개요 API 호출 ──────────────────────────
// protocols 배열에서 dailyVolume 기준 상위 7개 추출
async function fetchDexHot() {
  const res = await fetch(
    'https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume',
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`DeFiLlama API 실패: ${res.status}`);

  const json = await res.json();
  const protocols = json.protocols || [];

  // dailyVolume 기준 내림차순 정렬, 상위 7개
  return protocols
    .filter(p => p.dailyVolume > 0)
    .sort((a, b) => (b.dailyVolume || 0) - (a.dailyVolume || 0))
    .slice(0, 7)
    .map(p => ({
      name: p.name,
      displayName: p.displayName || p.name,
      dailyVolume: p.dailyVolume || 0,
      change1d: p.change_1d ?? null,   // null 허용 (데이터 없을 수 있음)
      chains: p.chains || [],
    }));
}

// ─── 체인 뱃지 색상 ──────────────────────────────────────
const CHAIN_COLOR = {
  Ethereum: '#627EEA',
  BSC: '#F0B90B',
  Solana: '#9945FF',
  Arbitrum: '#28A0F0',
  Polygon: '#8247E5',
  Optimism: '#FF0420',
  Avalanche: '#E84142',
  Base: '#0052FF',
};

function ChainBadge({ chain }) {
  const color = CHAIN_COLOR[chain] || '#8B95A1';
  return (
    <span
      className="text-[9px] font-bold px-1 py-0.5 rounded"
      style={{ background: `${color}22`, color }}
    >
      {chain.slice(0, 3).toUpperCase()}
    </span>
  );
}

// ─── 개별 DEX 행 ─────────────────────────────────────────
function DexRow({ item, maxVolume, rank }) {
  const barWidth = maxVolume > 0 ? Math.round((item.dailyVolume / maxVolume) * 100) : 0;
  const changeStr = fmtChange(item.change1d);

  // 한국 관례: 양수 빨강, 음수 파랑
  const changeColor =
    item.change1d === null || item.change1d === undefined
      ? '#B0B8C1'
      : item.change1d >= 0
      ? '#F04452'
      : '#3182F6';

  return (
    <div className="flex items-center gap-2 py-2 border-b border-[#F8F9FA] last:border-0">
      {/* 순위 */}
      <span className="text-[11px] text-[#B0B8C1] w-4 flex-shrink-0 text-center">{rank}</span>

      {/* DEX 이름 + 체인 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-[#191F28] truncate">
            {item.displayName}
          </span>
          {/* 주요 체인 뱃지 (최대 2개) */}
          {item.chains.slice(0, 2).map(c => (
            <ChainBadge key={c} chain={c} />
          ))}
        </div>
        {/* 게이지 바 */}
        <div className="mt-1 h-1 bg-[#F2F4F6] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%`, background: '#3182F6' }}
          />
        </div>
      </div>

      {/* 거래량 */}
      <span className="text-[13px] font-bold text-[#191F28] w-16 text-right flex-shrink-0">
        {fmtVolume(item.dailyVolume)}
      </span>

      {/* 변화율 */}
      <span
        className="text-[11px] font-semibold w-14 text-right flex-shrink-0"
        style={{ color: changeColor }}
      >
        {changeStr ?? '—'}
      </span>
    </div>
  );
}

// ─── 스켈레톤 로딩 ───────────────────────────────────────
function DexSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 py-2">
          <div className="w-4 h-3 bg-[#F2F4F6] rounded animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-[#F2F4F6] rounded w-1/2 animate-pulse" />
            <div className="h-1 bg-[#F2F4F6] rounded animate-pulse" />
          </div>
          <div className="w-16 h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
          <div className="w-14 h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function DexHotSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dex-hot'],
    queryFn: fetchDexHot,
    staleTime: 300_000,          // 5분 캐시
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // API 실패 시 섹션 전체 숨김
  if (isError) return null;

  const maxVolume = data?.[0]?.dailyVolume ?? 1;

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">🔥</span>
          <span className="text-[15px] font-bold text-[#191F28]">DEX 핫 프로토콜</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-[#B0B8C1]">24h 거래량</span>
          <span className="text-[10px] text-[#B0B8C1] bg-[#F8F9FA] px-1.5 py-0.5 rounded ml-1">
            DeFiLlama
          </span>
        </div>
      </div>

      {/* 컨텐츠 */}
      <div className="px-4 py-2">
        {/* 컬럼 헤더 */}
        <div className="flex items-center gap-2 pb-1 border-b border-[#F8F9FA]">
          <span className="w-4 flex-shrink-0" />
          <span className="flex-1 text-[10px] text-[#B0B8C1]">프로토콜</span>
          <span className="w-16 text-[10px] text-[#B0B8C1] text-right flex-shrink-0">거래량</span>
          <span className="w-14 text-[10px] text-[#B0B8C1] text-right flex-shrink-0">24h 변화</span>
        </div>

        {isLoading ? (
          <DexSkeleton />
        ) : (
          data?.map((item, idx) => (
            <DexRow
              key={item.name}
              item={item}
              maxVolume={maxVolume}
              rank={idx + 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
