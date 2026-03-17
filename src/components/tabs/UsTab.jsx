import { useState, useMemo } from 'react';
import WatchlistTable from '../WatchlistTable';

const SECTORS = ['테크','반도체','금융','헬스케어','소비재','에너지','소재','산업','유틸리티','통신','미디어','전기차','방산'];

export default function UsTab({ stocks = [], krwRate = 1466, onCardClick }) {
  const [sector, setSector] = useState(null);

  const items = useMemo(() => {
    let list = stocks.filter(s => s.market === 'us');
    if (sector) list = list.filter(s => s.sector === sector);
    return list;
  }, [stocks, sector]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button className={`chip ${!sector ? 'active' : ''}`} onClick={() => setSector(null)}>전체</button>
        {SECTORS.map(s => (
          <button key={s} className={`chip ${sector === s ? 'active' : ''}`} onClick={() => setSector(s)}>{s}</button>
        ))}
      </div>
      <WatchlistTable items={items} type="us" krwRate={krwRate} onRowClick={onCardClick} />
    </div>
  );
}
