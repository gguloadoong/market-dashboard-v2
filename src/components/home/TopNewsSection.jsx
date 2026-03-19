// 시장을 움직이는 뉴스 — 종목 연결 카드형 뉴스 피드
// 뉴스와 관련 종목을 뱃지로 연결, 종목 등락률 표시
import { useMemo } from 'react';
import { extractNewsSignals } from '../../utils/newsSignal';
import { buildStockKeywords, matchesKeywords } from '../../utils/newsAlias';

const CAT_BADGE = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: '미장' },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: '국내' },
};

// 종목 태그 추출
const STOCK_NAMES = [
  '삼성전자','SK하이닉스','LG에너지솔루션','현대차','기아','셀트리온','카카오','네이버',
  'NVIDIA','엔비디아','애플','테슬라','Tesla','마이크로소프트','Meta','아마존','구글','AMD',
  '비트코인','이더리움','리플','솔라나','Bitcoin','Ethereum',
];

function countStockTags(title) {
  const lower = (title || '').toLowerCase();
  return STOCK_NAMES.filter(n => lower.includes(n.toLowerCase())).length;
}

// RSS description에서 HTML 태그/엔티티 제거
function cleanDesc(raw) {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

// 뉴스와 매칭되는 종목 찾기 (allItems에서)
function findMatchedStocks(newsTitle, allItems, max = 3) {
  if (!newsTitle || !allItems.length) return [];
  const text = newsTitle.toLowerCase();
  const matched = [];
  const seen = new Set();

  for (const item of allItems) {
    if (matched.length >= max) break;
    const key = item.symbol || item.id;
    if (seen.has(key)) continue;

    const keywords = buildStockKeywords(
      item.symbol, item.name,
      item._market === 'KR' ? 'KR' : item._market === 'COIN' ? 'COIN' : 'US'
    );
    if (keywords.length > 0 && matchesKeywords(newsTitle, keywords)) {
      seen.add(key);
      const pct = item._market === 'COIN' ? (item.change24h ?? 0) : (item.changePct ?? 0);
      matched.push({
        symbol: item.symbol || item.id,
        name: item.name,
        market: item._market,
        pct,
      });
    }
  }
  return matched;
}

function StockBadge({ stock }) {
  const isUp = stock.pct > 0;
  const isDown = stock.pct < 0;
  const pctColor = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const bgColor = isUp ? '#FFF0F1' : isDown ? '#F0F4FF' : '#F2F4F6';

  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
      style={{ background: bgColor, color: pctColor }}
    >
      <span className="text-[#4E5968] font-medium">{stock.name?.slice(0, 6)}</span>
      <span>{isUp ? '+' : ''}{stock.pct.toFixed(1)}%</span>
    </span>
  );
}

export default function TopNewsSection({ allNews = [], onNewsClick, allItems = [] }) {
  // 24시간 이내 뉴스 중 시그널 점수 + 종목 매칭 기준 상위 5건
  const topNews = useMemo(() => {
    const cutoff = 24 * 60 * 60 * 1000;
    const recent = allNews.filter(n => {
      if (!n.pubDate) return false;
      try { return Date.now() - new Date(n.pubDate).getTime() < cutoff; }
      catch { return false; }
    });

    return recent
      .map(n => {
        const signals = extractNewsSignals(n.title);
        const stockCount = countStockTags(n.title);
        const isRecent = n.pubDate && (Date.now() - new Date(n.pubDate).getTime()) < 3600000;
        // 종목 실제 움직임 점수 (연결된 종목의 변동폭 합산)
        const matchedStocks = findMatchedStocks(n.title, allItems);
        const movementScore = matchedStocks.reduce((sum, s) => sum + Math.abs(s.pct), 0);
        // 점수: 시그널 태그 2점 + 종목 태그 1점 + 1시간 이내 1점 + 종목 움직임 가산
        const score = signals.length * 2 + stockCount + (isRecent ? 1 : 0) + Math.min(movementScore * 0.5, 3);
        return { ...n, _signals: signals, _score: score, _matchedStocks: matchedStocks };
      })
      .sort((a, b) => b._score - a._score || new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, 5);
  }, [allNews, allItems]);

  if (!topNews.length) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">시장을 움직이는 뉴스</span>
        <span className="text-[11px] text-[#B0B8C1]">24시간 이내</span>
      </div>

      {topNews.map((item, i) => {
        const cat = CAT_BADGE[item.category] || { bg: '#F2F4F6', color: '#8B95A1', label: 'NEWS' };
        const isBreaking = item.pubDate && (Date.now() - new Date(item.pubDate).getTime()) < 3600000;

        return (
          <div
            key={item.id || i}
            onClick={() => onNewsClick?.(item)}
            className="flex items-start gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
          >
            <span className="text-[13px] font-bold text-[#C9CDD2] tabular-nums mt-0.5 flex-shrink-0 w-4">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                {isBreaking && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFF0F1] text-[#F04452] flex-shrink-0">
                    속보
                  </span>
                )}
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: cat.bg, color: cat.color }}
                >
                  {cat.label}
                </span>
                {item._signals.slice(0, 2).map(sig => (
                  <span
                    key={sig.tag}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{ background: sig.bg, color: sig.color }}
                  >
                    {sig.tag}
                  </span>
                ))}
                <span className="text-[10px] text-[#C9CDD2] ml-auto flex-shrink-0">{item.timeAgo}</span>
              </div>
              <p className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">
                {item.title}
              </p>
              {/* RSS description 미리보기 */}
              {(() => {
                const desc = cleanDesc(item.description || item.summary || '');
                return desc && desc.length > 20 && !desc.startsWith(item.title?.slice(0, 30))
                  ? <p className="text-[11px] text-[#8B95A1] leading-snug mt-1 line-clamp-1">{desc}</p>
                  : null;
              })()}
              {/* 종목 연결 뱃지 — 관련 종목 + 등락률 */}
              {item._matchedStocks?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {item._matchedStocks.map(stock => (
                    <StockBadge key={stock.symbol} stock={stock} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
