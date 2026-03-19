// 주목할만한 움직임 — 복합 스코어 기반 히어로 수평 카드
// 변동폭 + 거래량 순위 + 뉴스 매칭 복합 점수 + WHY 뉴스 연결
import { useMemo, useState } from 'react';
import { getPct, fmt, getAvatarBg, findRelatedNews } from './utils';
import { buildStockKeywords, matchesKeywords } from '../../utils/newsAlias';

const MKT_BADGE = {
  KR:   { label: '국내', bg: '#FFF0F0', color: '#F04452' },
  US:   { label: '미장', bg: '#EDF4FF', color: '#3182F6' },
  COIN: { label: '코인', bg: '#FFF4E6', color: '#FF9500' },
};

// 이유 태그 생성
function buildReasonTags(item, newsCount, volumeRank) {
  const tags = [];
  const pct = Math.abs(getPct(item));

  if (pct >= 5)      tags.push({ label: '급변동', bg: '#FFF0F1', color: '#F04452' });
  else if (pct >= 3) tags.push({ label: '큰 변동', bg: '#FFF4E6', color: '#FF9500' });

  if (volumeRank <= 5)       tags.push({ label: '거래량 TOP', bg: '#F0FFF6', color: '#2AC769' });
  else if (volumeRank <= 15) tags.push({ label: '거래 활발', bg: '#F0FFF6', color: '#2AC769' });

  if (newsCount >= 2)     tags.push({ label: `뉴스 ${newsCount}건`, bg: '#EDF4FF', color: '#3182F6' });
  else if (newsCount === 1) tags.push({ label: '뉴스 1건', bg: '#EDF4FF', color: '#3182F6' });

  return tags.slice(0, 2);
}

function NotableCard({ item, newsCount, volumeRank, newsTitle, newsSource, krwRate, onClick }) {
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const badge  = MKT_BADGE[item._market] || MKT_BADGE.KR;
  const tags   = buildReasonTags(item, newsCount, volumeRank);

  const logoUrls = item.image ? [item.image]
    : item._market === 'US'   ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`]
    : item._market === 'KR'   ? [`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);
  const bg = getAvatarBg(item.symbol);

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
      ? `₩${fmt(item.price)}`
      : `$${(item.price ?? 0).toFixed(2)}`;

  // 스파크라인 미니 SVG
  const spark = item.sparkline?.length >= 3 ? item.sparkline : null;
  let sparkPath = '';
  if (spark) {
    const min = Math.min(...spark);
    const max = Math.max(...spark);
    const range = max - min || 1;
    sparkPath = spark.map((v, i) => {
      const x = (i / (spark.length - 1)) * 90;
      const y = 24 - ((v - min) / range) * 20;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }

  // WHY 뉴스 이유 텍스트
  const whyText = newsTitle
    ? (newsTitle.length > 50 ? newsTitle.slice(0, 48) + '…' : newsTitle)
    : null;

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex-shrink-0 w-[200px] bg-white rounded-xl border border-[#F2F4F6] shadow-sm p-3 cursor-pointer hover:shadow-md hover:border-[#E5E8EB] transition-all"
    >
      {/* 상단: 로고 + 종목명 */}
      <div className="flex items-center gap-2 mb-2">
        {logoIdx < logoUrls.length ? (
          <img src={logoUrls[logoIdx]} alt={item.symbol}
            onError={() => setLogoIdx(i => i + 1)}
            className="w-7 h-7 rounded-full object-contain bg-white border border-[#F2F4F6] p-0.5 flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0" style={{ background: bg }}>
            {(item.symbol || '?').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold text-[#191F28] truncate">{item.name}</div>
          <div className="flex items-center gap-1">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
            <span className="text-[9px] text-[#B0B8C1] font-mono">{item.symbol}</span>
          </div>
        </div>
      </div>

      {/* 등락률 (크게) */}
      <div className="text-[20px] font-bold tabular-nums font-mono mb-1" style={{ color }}>
        {isUp ? '+' : ''}{pct.toFixed(2)}%
      </div>

      {/* 가격 */}
      <div className="text-[11px] text-[#8B95A1] font-mono tabular-nums mb-2">{price}</div>

      {/* 스파크라인 */}
      {spark && (
        <svg viewBox="0 0 90 24" className="w-full h-[24px] mb-2">
          <path d={sparkPath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}

      {/* WHY 뉴스 이유 — SignalSection 통합 */}
      {whyText && (
        <div className="flex items-start gap-1.5 mb-1.5">
          <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#191F28] text-white flex-shrink-0 mt-0.5">WHY</span>
          <p className="text-[10px] text-[#4E5968] leading-snug line-clamp-2">{whyText}</p>
        </div>
      )}

      {/* 뉴스 출처 */}
      {newsSource && (
        <div className="text-[9px] text-[#B0B8C1] mb-1.5 truncate">{newsSource}</div>
      )}

      {/* 이유 태그 */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(t => (
            <span key={t.label} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: t.bg, color: t.color }}>
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotableMoversSection({ allItems = [], recentNews = [], krwRate = 1466, onItemClick }) {
  const notables = useMemo(() => {
    if (!allItems.length) return [];

    // 마켓별 거래량 순위 계산
    const volumeRanks = new Map();
    const byMarket = { KR: [], US: [], COIN: [] };
    for (const item of allItems) {
      const vol = item._market === 'COIN' ? (item.volume24h ?? 0) : (item.volume ?? 0);
      (byMarket[item._market] || []).push({ symbol: item.symbol || item.id, vol });
    }
    for (const items of Object.values(byMarket)) {
      items.sort((a, b) => b.vol - a.vol);
      items.forEach((it, i) => volumeRanks.set(it.symbol, i + 1));
    }

    return allItems
      .map(item => {
        const pct = Math.abs(getPct(item));
        const volRank = volumeRanks.get(item.symbol || item.id) || 999;

        // 뉴스 매칭
        const keywords = buildStockKeywords(
          item.symbol, item.name,
          item._market === 'KR' ? 'KR' : item._market === 'COIN' ? 'COIN' : 'US'
        );
        const newsCount = keywords.length > 0
          ? recentNews.filter(n => matchesKeywords(`${n.title || ''} ${n.description || ''}`, keywords)).length
          : 0;

        // WHY 뉴스 매칭 (SignalSection 통합)
        const relatedNews = findRelatedNews(item, recentNews);

        // 복합 점수: 변동폭(0~5) + 거래량 순위(0~3) + 뉴스(0~3)
        const pctScore = pct >= 10 ? 5 : pct >= 5 ? 4 : pct >= 3 ? 3 : pct >= 1.5 ? 2 : pct >= 0.5 ? 1 : 0;
        const volScore = volRank <= 5 ? 3 : volRank <= 10 ? 2 : volRank <= 20 ? 1 : 0;
        const newsScore = Math.min(newsCount, 3);
        const totalScore = pctScore + volScore + newsScore;

        return {
          ...item,
          _totalScore: totalScore,
          _newsCount: newsCount,
          _volRank: volRank,
          _newsTitle: relatedNews?.title || null,
          _newsSource: relatedNews?.source || null,
        };
      })
      .filter(i => i._totalScore >= 3)
      .sort((a, b) => b._totalScore - a._totalScore)
      .slice(0, 7);
  }, [allItems, recentNews]);

  // 최소 2개 보장 — 점수 부족하면 변동폭 기준 fallback
  const displayed = useMemo(() => {
    if (notables.length >= 2) return notables;
    const fallback = [...allItems]
      .sort((a, b) => Math.abs(getPct(b)) - Math.abs(getPct(a)))
      .slice(0, 2)
      .map(i => {
        const relatedNews = findRelatedNews(i, recentNews);
        return {
          ...i,
          _totalScore: 0, _newsCount: 0, _volRank: 999,
          _newsTitle: relatedNews?.title || null,
          _newsSource: relatedNews?.source || null,
        };
      });
    return fallback;
  }, [notables, allItems, recentNews]);

  if (!displayed.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#191F28]">주목할 종목</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
        </div>
        <span className="text-[11px] text-[#B0B8C1]">변동폭 + 거래량 + 뉴스</span>
      </div>
      {/* 수평 스크롤 + 양쪽 페이드 힌트 */}
      <div className="relative">
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
          <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
            {displayed.map(item => (
              <NotableCard
                key={item.id || item.symbol}
                item={item}
                newsCount={item._newsCount}
                volumeRank={item._volRank}
                newsTitle={item._newsTitle}
                newsSource={item._newsSource}
                krwRate={krwRate}
                onClick={onItemClick}
              />
            ))}
          </div>
        </div>
        {/* 우측 페이드 힌트 — 더 스크롤할 수 있음을 암시 */}
        {displayed.length > 2 && (
          <div className="absolute right-0 top-0 bottom-2 w-8 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(255,255,255,0.9), transparent)' }} />
        )}
      </div>
    </div>
  );
}
