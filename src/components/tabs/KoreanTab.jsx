import { useState, useMemo } from 'react';
import WatchlistTable from '../WatchlistTable';

const SECTORS = ['반도체','IT','화학','배터리','바이오','자동차','금융','보험','통신','지주','가전','부품','제약','해운','금속','방산','에너지','유틸리티'];

export default function KoreanTab({ stocks = [], krwRate = 1466, onCardClick }) {
  const [sector, setSector] = useState(null);

  const items = useMemo(() => {
    let list = stocks.filter(s => s.market === 'kr');
    if (sector) list = list.filter(s => s.sector === sector);
    return list;
  }, [stocks, sector]);

  return (
    <div className="space-y-3">
      {/* 섹터 필터 */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button className={`chip ${!sector ? 'active' : ''}`} onClick={() => setSector(null)}>전체</button>
        {SECTORS.map(s => (
          <button key={s} className={`chip ${sector === s ? 'active' : ''}`} onClick={() => setSector(s)}>{s}</button>
        ))}
      </div>
      <WatchlistTable items={items} type="kr" krwRate={krwRate} onRowClick={onCardClick} />
    </div>
  );
}
