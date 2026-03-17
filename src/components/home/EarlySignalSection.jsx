// 선행 신호 섹션 — 뉴스 발생 2시간 이내 + 주가 변화 < 1.5% = "아직 반응 안 한 종목"
// 매수 기회 포착: 뉴스가 나왔지만 주가가 아직 움직이지 않은 종목
import { useMemo } from 'react';
import { getPct, fmt } from './utils';

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const PRICE_THRESHOLD = 1.5; // 이 미만이면 "아직 미반응"

function EarlySignalCard({ mover, news, krwRate, onItemClick }) {
  const pct = getPct(mover);
  const isCoin = !!mover.id;

  const price = isCoin
    ? (mover.priceKrw ? `₩${fmt(Math.round(mover.priceKrw))}` : `$${mover.priceUsd?.toFixed(2) ?? '—'}`)
    : mover.market === 'us'
      ? `₩${fmt(Math.round((mover.price ?? 0) * krwRate))}`
      : `₩${fmt(mover.price)}`;

  const mktBadge = isCoin
    ? { label: 'COIN', bg: '#FFF4E6', color: '#FF9500' }
    : mover._market === 'KR' || mover.market === 'kr'
      ? { label: 'KR', bg: '#FFF0F0', color: '#F04452' }
      : { label: 'US', bg: '#EDF4FF', color: '#3182F6' };

  // 뉴스가 얼마나 됐는지 (분)
  const newsAgeMin = news?.pubDate
    ? Math.floor((Date.now() - new Date(news.pubDate).getTime()) / 60000)
    : null;

  return (
    <button
      onClick={() => onItemClick?.(mover)}
      className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 hover:bg-[#F8F9FA] transition-colors w-full text-left"
    >
      {/* 왼쪽: 배지 + 종목명 */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: mktBadge.bg, color: mktBadge.color }}
        >
          {mktBadge.label}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-[#191F28] truncate">{mover.name}</div>
          <div className="text-[11px] text-[#8B95A1] truncate leading-tight mt-0.5">
            {news.title.length > 50 ? news.title.slice(0, 48) + '…' : news.title}
          </div>
        </div>
      </div>

      {/* 오른쪽: 현재가 + 미반응 표시 */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <div className="text-[12px] font-mono text-[#191F28] tabular-nums">{price}</div>
        <div className="flex items-center gap-1">
          {Math.abs(pct) < 0.1 ? (
            <span className="text-[10px] text-[#8B95A1]">변동 없음</span>
          ) : (
            <span className="text-[10px] font-semibold font-mono tabular-nums"
              style={{ color: pct > 0 ? '#F04452' : '#1764ED' }}>
              {pct > 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(2)}%
            </span>
          )}
          {newsAgeMin != null && (
            <span className="text-[10px] text-[#B0B8C1]">{newsAgeMin}분 전 뉴스</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function EarlySignalSection({ allItems, recentNews, krwRate, onItemClick }) {
  const earlySignals = useMemo(() => {
    if (!allItems.length || !recentNews.length) return [];

    // 2시간 이내 뉴스만
    const freshNews = recentNews.filter(n => {
      if (!n.pubDate) return false;
      try { return Date.now() - new Date(n.pubDate).getTime() < TWO_HOURS_MS; }
      catch { return false; }
    });
    if (!freshNews.length) return [];

    const results = [];
    const seenSymbols = new Set();

    for (const news of freshNews) {
      if (results.length >= 5) break;
      const titleLower = news.title.toLowerCase();

      for (const item of allItems) {
        if (seenSymbols.has(item.id || item.symbol)) continue;

        const pct = Math.abs(getPct(item));
        // 주가 변화가 threshold 미만인 종목만 (아직 미반응)
        if (pct >= PRICE_THRESHOLD) continue;

        const name = (item.name || '').toLowerCase();
        const sym  = (item.symbol || item.id || '').toLowerCase();
        // 종목명이 뉴스 제목에 포함되는지 확인
        const nameMatch = name.length >= 2 && titleLower.includes(name);
        const symMatch  = sym.length >= 2 && !/^\d{6}$/.test(sym) && titleLower.includes(sym);

        if (!nameMatch && !symMatch) continue;

        seenSymbols.add(item.id || item.symbol);
        results.push({ mover: item, news });
        if (results.length >= 5) break;
      }
    }

    return results;
  }, [allItems, recentNews]);

  if (!earlySignals.length) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2AC769]">
          선행 신호
        </span>
        <span className="text-[13px] font-bold text-[#191F28]">뉴스 나왔지만 주가 아직 미반응</span>
        <span className="ml-auto text-[11px] text-[#B0B8C1]">2시간 이내 뉴스</span>
      </div>

      {/* 시그널 목록 */}
      {earlySignals.map(({ mover, news }) => (
        <EarlySignalCard
          key={mover.id || mover.symbol}
          mover={mover}
          news={news}
          krwRate={krwRate}
          onItemClick={onItemClick}
        />
      ))}
    </div>
  );
}
