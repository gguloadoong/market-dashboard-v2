import { memo, useState } from 'react';
import { getPct, fmt, getAvatarBg, getLogoUrls } from './utils';

// ─── SECTION 3: HOT 리스트 행 (3열 공통) ─────────────────────
const HotRow = memo(function HotRow({ item, rank, krwRate, onClick }) {
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';

  const logoUrls = getLogoUrls(item);
  const [logoIdx, setLogoIdx] = useState(0);
  const bg = getAvatarBg(item.symbol);

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
    ? `₩${fmt(item.price)}`
    : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-[#F7F8FA] active:scale-[0.99] transition-all rounded-xl"
    >
      {/* 순위 */}
      <span className="w-4 text-[11px] text-[#C9CDD2] tabular-nums font-mono text-center flex-shrink-0">{rank}</span>

      {/* 로고 */}
      {logoIdx < logoUrls.length ? (
        <img
          src={logoUrls[logoIdx]}
          alt={item.symbol}
          onError={() => setLogoIdx(i => i + 1)}
          className="w-6 h-6 rounded-full object-contain bg-white border border-[#F2F4F6] p-0.5 flex-shrink-0"
        />
      ) : (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
          style={{ background: bg }}
        >
          {(item.symbol || '?').slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* 종목명 */}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[#191F28] truncate">{item.name}</div>
        <div className="text-[10px] text-[#8B95A1] font-mono truncate">{item.symbol}</div>
      </div>

      {/* 등락률 + 가격 */}
      <div className="text-right flex-shrink-0">
        <div
          className="text-[12px] font-bold tabular-nums font-mono"
          style={{ color }}
        >
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
      </div>
    </div>
  );
});

function SkeletonHotRow({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 animate-pulse">
      <div className="w-4 h-3 bg-[#F2F4F6] rounded flex-shrink-0" />
      <div className="w-6 h-6 rounded-full bg-[#F2F4F6] flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="h-3 bg-[#F2F4F6] rounded w-20" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-12" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-3 bg-[#F2F4F6] rounded w-14" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-12" />
      </div>
    </div>
  ));
}

export default function HotListSection({ hasData, krHot, usHot, coinHot, krDrop, usDrop, coinDrop, krwRate, onItemClick }) {
  return (
    <>
      {/* ─── SECTION 3: 3열 HOT 리스트 ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 국내 급등 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🇰🇷</span>
              <span className="text-[13px] font-bold text-[#191F28]">국내 급등</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF0F0] text-[#F04452]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : krHot.length > 0
                ? krHot.map((item, i) => (
                    <HotRow
                      key={`kr-hot-${item.symbol}`}
                      item={item}
                      rank={i + 1}
                      krwRate={krwRate}
                      onClick={onItemClick}
                    />
                  ))
                : <div className="px-4 py-6 text-center text-[12px] text-[#B0B8C1]">데이터 로딩 중</div>
            }
          </div>
        </div>

        {/* 미장 급등 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🇺🇸</span>
              <span className="text-[13px] font-bold text-[#191F28]">미장 급등</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDF4FF] text-[#3182F6]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : usHot.length > 0
                ? usHot.map((item, i) => (
                    <HotRow
                      key={`us-hot-${item.symbol}`}
                      item={item}
                      rank={i + 1}
                      krwRate={krwRate}
                      onClick={onItemClick}
                    />
                  ))
                : <div className="px-4 py-6 text-center text-[12px] text-[#B0B8C1]">데이터 로딩 중</div>
            }
          </div>
        </div>

        {/* 코인 급등 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🪙</span>
              <span className="text-[13px] font-bold text-[#191F28]">코인 급등</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF4E6] text-[#FF9500]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : coinHot.length > 0
                ? coinHot.map((item, i) => (
                    <HotRow
                      key={`coin-hot-${item.symbol}`}
                      item={item}
                      rank={i + 1}
                      krwRate={krwRate}
                      onClick={onItemClick}
                    />
                  ))
                : <div className="px-4 py-6 text-center text-[12px] text-[#B0B8C1]">데이터 로딩 중</div>
            }
          </div>
        </div>
      </div>

      {/* ─── SECTION 3b: 3열 DROP 리스트 ───── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 국내 급락 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🇰🇷</span>
              <span className="text-[13px] font-bold text-[#191F28]">국내 급락</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDF4FF] text-[#1764ED]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : krDrop.map((item, i) => (
                  <HotRow
                    key={`kr-drop-${item.symbol}`}
                    item={item}
                    rank={i + 1}
                    krwRate={krwRate}
                    onClick={onItemClick}
                  />
                ))
            }
          </div>
        </div>

        {/* 미장 급락 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🇺🇸</span>
              <span className="text-[13px] font-bold text-[#191F28]">미장 급락</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDF4FF] text-[#1764ED]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : usDrop.map((item, i) => (
                  <HotRow
                    key={`us-drop-${item.symbol}`}
                    item={item}
                    rank={i + 1}
                    krwRate={krwRate}
                    onClick={onItemClick}
                  />
                ))
            }
          </div>
        </div>

        {/* 코인 급락 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🪙</span>
              <span className="text-[13px] font-bold text-[#191F28]">코인 급락</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDF4FF] text-[#1764ED]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : coinDrop.map((item, i) => (
                  <HotRow
                    key={`coin-drop-${item.symbol}`}
                    item={item}
                    rank={i + 1}
                    krwRate={krwRate}
                    onClick={onItemClick}
                  />
                ))
            }
          </div>
        </div>
      </div>
    </>
  );
}
