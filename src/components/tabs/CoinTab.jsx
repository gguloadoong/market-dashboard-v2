import WatchlistTable from '../WatchlistTable';

export default function CoinTab({ coins = [], krwRate = 1466, onCardClick }) {
  return (
    <WatchlistTable items={coins} type="coin" krwRate={krwRate} onRowClick={onCardClick} />
  );
}
