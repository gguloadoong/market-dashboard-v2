// 관심종목 위젯 — 빈 상태 시 인기 종목 추천
import { getPct, fmt } from '../utils';

function WatchRow({ item, krwRate, onItemClick, onToggle }) {
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const isCoin = !!item.id;

  const price = isCoin
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item.market === 'kr' || item._market === 'KR'
      ? `₩${fmt(item.price)}`
      : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  const mktBadge = isCoin
    ? { label: 'COIN', bg: '#FFF4E6', color: '#FF9500' }
    : item._market === 'KR' || item.market === 'kr'
      ? { label: 'KR', bg: '#FFF0F0', color: '#F04452' }
      : { label: 'US', bg: '#EDF4FF', color: '#3182F6' };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F7F8FA] transition-colors rounded-xl">
      <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => onItemClick?.(item)}>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: mktBadge.bg, color: mktBadge.color }}>
          {mktBadge.label}
        </span>
        <span className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</span>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <div className="text-[12px] font-bold tabular-nums font-mono" style={{ color }}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle?.(item.id || item.symbol); }}
        className="ml-2 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#FFF0F0] transition-colors text-[14px]"
        title="관심종목 제거"
      >
        ★
      </button>
    </div>
  );
}

// 빈 상태: 인기 종목 추천 행
function SuggestRow({ item, krwRate, onItemClick, onAdd }) {
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const isCoin = !!item.id;

  const price = isCoin
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item.market === 'kr' || item._market === 'KR'
      ? `₩${fmt(item.price)}`
      : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  const mktBadge = isCoin
    ? { label: 'COIN', bg: '#FFF4E6', color: '#FF9500' }
    : item._market === 'KR' || item.market === 'kr'
      ? { label: 'KR', bg: '#FFF0F0', color: '#F04452' }
      : { label: 'US', bg: '#EDF4FF', color: '#3182F6' };

  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-[#F7F8FA] transition-colors rounded-xl">
      <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => onItemClick?.(item)}>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: mktBadge.bg, color: mktBadge.color }}>
          {mktBadge.label}
        </span>
        <span className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</span>
      </div>
      <div className="text-right flex-shrink-0 ml-2">
        <div className="text-[12px] font-bold tabular-nums font-mono" style={{ color }}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onAdd?.(item.id || item.symbol); }}
        className="ml-2 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#EDF4FF] text-[#3182F6] transition-colors text-[16px] font-bold"
        title="관심종목 추가"
      >
        +
      </button>
    </div>
  );
}

export default function WatchlistWidget({ watchedItems, popularItems = [], toggle, onItemClick, krwRate = 1466 }) {
  if (!watchedItems.length) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
          <span className="text-[13px] font-bold text-[#191F28]">관심종목</span>
          <span className="text-[11px] text-[#B0B8C1]">/ 검색</span>
        </div>
        {popularItems.length > 0 ? (
          <>
            <div className="px-4 pt-3 pb-1">
              <p className="text-[12px] text-[#8B95A1]">관심종목을 추가해보세요 — 인기 종목을 둘러보세요</p>
            </div>
            <div className="py-1">
              {popularItems.map(item => (
                <SuggestRow
                  key={item.id || item.symbol}
                  item={item}
                  krwRate={krwRate}
                  onItemClick={onItemClick}
                  onAdd={toggle}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="py-6 text-center">
            <p className="text-[13px] text-[#8B95A1]">종목을 검색해서 관심목록에 추가하세요</p>
            <p className="text-[11px] text-[#C9CDD2] mt-1">/ 키를 눌러 검색</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">관심종목</span>
        <span className="text-[11px] text-[#B0B8C1]">{watchedItems.length}개</span>
      </div>
      <div className="py-1 max-h-[100px] overflow-y-auto">
        {watchedItems.map(item => (
          <WatchRow key={item.id || item.symbol} item={item} krwRate={krwRate} onItemClick={onItemClick} onToggle={toggle} />
        ))}
      </div>
      {/* 스크롤 힌트 — 3개 이상일 때 */}
      {watchedItems.length > 2 && (
        <div className="text-center py-1.5 text-[10px] text-[#B0B8C1] border-t border-[#F2F4F6]">
          ↕ {watchedItems.length}개 종목 · 워치리스트 탭에서 상세 보기
        </div>
      )}
    </div>
  );
}
