// 섹터 로테이션 — 국장 + 미장 섹터별 평균 등락률 막대 시각화
import { useState, useMemo } from 'react';

const SECTOR_FLAG = { kr: '🇰🇷', us: '🇺🇸' };

export default function SectorRotation({ krStocks, usStocks }) {
  const [activeMarket, setActiveMarket] = useState('all');

  const sectorMap = useMemo(() => {
    const items = activeMarket === 'kr' ? krStocks
      : activeMarket === 'us' ? usStocks
      : [...krStocks, ...usStocks];
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
  }, [krStocks, usStocks, activeMarket]);

  if (!sectorMap.length) return null;
  const maxAbs = Math.max(...sectorMap.map(s => Math.abs(s.avg)), 0.01);

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">🔄</span>
          <span className="text-[14px] font-bold text-[#191F28]">섹터 로테이션</span>
        </div>
        <div className="flex gap-1">
          {[['all', '전체'], ['kr', '🇰🇷'], ['us', '🇺🇸']].map(([id, label]) => (
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
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {sectorMap.map(({ name, avg, market }) => {
          const isUp  = avg >= 0;
          const clr   = avg === 0 ? '#B0B8C1' : isUp ? '#F04452' : '#1764ED';
          const bgClr = isUp ? 'rgba(240,68,82,0.12)' : 'rgba(23,100,237,0.12)';
          const pct   = Math.abs(avg) / maxAbs * 100;
          return (
            <div key={name} className="flex items-center gap-2 min-w-0">
              <div className="w-[76px] flex-shrink-0 flex items-center gap-1">
                {activeMarket === 'all' && (
                  <span className="text-[9px]">{SECTOR_FLAG[market] ?? ''}</span>
                )}
                <span className="text-[11px] font-medium text-[#191F28] truncate">{name}</span>
              </div>
              <div className="flex-1 h-4 rounded-sm overflow-hidden bg-[#F8F9FA]">
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{ width: `${Math.max(pct, 2)}%`, background: bgClr }}
                />
              </div>
              <span
                className="text-[11px] font-bold font-mono tabular-nums w-[44px] text-right flex-shrink-0"
                style={{ color: clr }}
              >{isUp ? '+' : ''}{avg.toFixed(2)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
