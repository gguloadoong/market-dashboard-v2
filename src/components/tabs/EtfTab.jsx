import { useMemo } from 'react';
import WatchlistTable from '../WatchlistTable';

export default function EtfTab({ etfs = [], krwRate = 1466, onCardClick }) {
  // ETF의 aum을 marketCap으로 매핑
  const items = useMemo(() =>
    etfs.map(e => ({ ...e, marketCap: e.aum })),
    [etfs]
  );
  return (
    <WatchlistTable items={items} type="us" krwRate={krwRate} onRowClick={onCardClick} />
  );
}
