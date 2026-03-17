// 섹터 로테이션 — HOT MONEY / COLD MONEY 분리 시각화 (Job 5)
// 국장·미장·코인 통합 섹터 자금 흐름 표시
import { useState, useMemo } from 'react';

const SECTOR_FLAG = { kr: '🇰🇷', us: '🇺🇸', coin: '🪙' };

// 섹터 행 공통 컴포넌트
function SectorRow({ name, avg, market, maxAbs, showFlag }) {
  const isUp  = avg >= 0;
  const clr   = avg === 0 ? '#B0B8C1' : isUp ? '#F04452' : '#1764ED';
  const bgClr = isUp ? 'rgba(240,68,82,0.12)' : 'rgba(23,100,237,0.12)';
  const pct   = Math.abs(avg) / maxAbs * 100;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-[80px] flex-shrink-0 flex items-center gap-1 min-w-0">
        {showFlag && <span className="text-[9px] flex-shrink-0">{SECTOR_FLAG[market] ?? ''}</span>}
        <span className="text-[11px] font-medium text-[#191F28] truncate">{name}</span>
      </div>
      <div className="flex-1 h-3.5 rounded-sm overflow-hidden bg-[#F8F9FA]">
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{ width: `${Math.max(pct, 2)}%`, background: bgClr }}
        />
      </div>
      <span
        className="text-[11px] font-bold font-mono tabular-nums w-[44px] text-right flex-shrink-0"
        style={{ color: clr }}
      >{isUp ? '+' : ''}{avg.toFixed(2)}%</span>
    </div>
  );
}

export default function SectorRotation({ krStocks = [], usStocks = [], coins = [] }) {
  const [activeMarket, setActiveMarket] = useState('all');

  const sectorMap = useMemo(() => {
    // 코인은 change24h 필드 (주식은 changePct)
    const coinsWithPct = coins
      .filter(c => c.sector) // 섹터 있는 코인만
      .map(c => ({ ...c, changePct: c.change24h ?? 0 }));

    const items = activeMarket === 'kr'   ? krStocks
      : activeMarket === 'us'   ? usStocks
      : activeMarket === 'coin' ? coinsWithPct
      : [...krStocks, ...usStocks, ...coinsWithPct];

    const map = {};
    for (const s of items) {
      if (!s.sector) continue;
      if (!map[s.sector]) map[s.sector] = { sum: 0, count: 0, market: s.market };
      map[s.sector].sum   += s.changePct ?? 0;
      map[s.sector].count += 1;
    }
    return Object.entries(map)
      .map(([name, { sum, count, market }]) => ({
        name,
        avg: parseFloat((sum / count).toFixed(2)),
        count,
        market,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [krStocks, usStocks, coins, activeMarket]);

  if (!sectorMap.length) return null;

  // 상승 / 하락 섹터 분리
  const hotSectors  = sectorMap.filter(s => s.avg > 0);
  const coldSectors = [...sectorMap.filter(s => s.avg <= 0)].reverse(); // 낙폭 큰 순서
  const maxAbs      = Math.max(...sectorMap.map(s => Math.abs(s.avg)), 0.01);
  const showFlag    = activeMarket === 'all';

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">🔄</span>
          <span className="text-[14px] font-bold text-[#191F28]">섹터 로테이션</span>
          {/* 지금 어디로 돈이 몰리는지 한 줄 요약 */}
          {hotSectors.length > 0 && (
            <span className="text-[10px] text-[#8B95A1] font-medium hidden sm:block">
              자금 유입 {hotSectors.length}개 ↑ · 유출 {coldSectors.length}개 ↓
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[['all', '전체'], ['kr', '🇰🇷'], ['us', '🇺🇸'], ['coin', '🪙']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveMarket(id)}
              className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${
                activeMarket === id ? 'bg-[#191F28] text-white' : 'text-[#6B7684] hover:bg-[#F2F4F6]'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* HOT MONEY / COLD MONEY 2열 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[#F2F4F6]">
        {/* HOT MONEY — 자금 유입 섹터 */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[11px] font-bold text-[#F04452] uppercase tracking-wide">HOT MONEY</span>
            <span className="text-[10px] text-[#F04452] bg-[#FFF0F1] px-1.5 py-0.5 rounded-full font-semibold">
              자금 유입
            </span>
          </div>
          {hotSectors.length > 0 ? (
            <div className="space-y-2">
              {hotSectors.map(({ name, avg, market }) => (
                <SectorRow
                  key={`hot-${name}`}
                  name={name}
                  avg={avg}
                  market={market}
                  maxAbs={maxAbs}
                  showFlag={showFlag}
                />
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-[11px] text-[#B0B8C1]">상승 섹터 없음</div>
          )}
        </div>

        {/* COLD MONEY — 자금 유출 섹터 */}
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[11px] font-bold text-[#1764ED] uppercase tracking-wide">COLD MONEY</span>
            <span className="text-[10px] text-[#1764ED] bg-[#EDF4FF] px-1.5 py-0.5 rounded-full font-semibold">
              자금 유출
            </span>
          </div>
          {coldSectors.length > 0 ? (
            <div className="space-y-2">
              {coldSectors.map(({ name, avg, market }) => (
                <SectorRow
                  key={`cold-${name}`}
                  name={name}
                  avg={avg}
                  market={market}
                  maxAbs={maxAbs}
                  showFlag={showFlag}
                />
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-[11px] text-[#B0B8C1]">하락 섹터 없음</div>
          )}
        </div>
      </div>
    </div>
  );
}
