// 선행 신호 섹션 — 뉴스 발생 2시간 이내 + 주가 변화 < 1.5% = "아직 반응 안 한 종목"
// 매수 기회 포착: 뉴스가 나왔지만 주가가 아직 움직이지 않은 종목
import { useMemo } from 'react';
import { getPct, fmt, buildKeywords } from './utils';
import { matchesKeywords } from '../../utils/newsAlias';

// 뉴스 제목에서 호재/악재 분류
const POSITIVE_KW = ['상승','급등','최고','신고가','돌파','매수','호재','흑자','수주','계약','실적','성장','확대','인수','협력','승인','허가','개발','출시'];
const NEGATIVE_KW = ['하락','급락','최저','신저가','매도','악재','적자','손실','취소','지연','소송','규제','제재','리콜','파산','부도','의혹','조사','하향'];

function detectSentiment(title = '') {
  if (!title) return null;
  const t = title;
  const posScore = POSITIVE_KW.filter(k => t.includes(k)).length;
  const negScore = NEGATIVE_KW.filter(k => t.includes(k)).length;
  if (posScore > negScore) return { label: '호재', bg: '#F0FFF4', color: '#2AC769', icon: '▲' };
  if (negScore > posScore) return { label: '악재', bg: '#FFF0F1', color: '#F04452', icon: '▼' };
  return { label: '이슈', bg: '#FFF4E6', color: '#FF9500', icon: '!' };
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const PRICE_THRESHOLD = 1.5; // 이 미만이면 "아직 미반응"

// 국내(09:00~15:30 KST) 또는 미국(23:30~익일 06:00 KST) 장이 열려 있는지 확인
// 장외 시간에는 모든 종목이 미반응 조건 충족 → 신호 의미 없음
function isAnyMarketOpen() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const day = now.getDay(); // 0=일, 1=월 ... 6=토
  const hm  = now.getHours() * 100 + now.getMinutes();
  if (day === 0) return false;                   // 일요일 전일 휴장
  if (day === 6) return hm < 600;               // 토요일: 미국 금요일 장 마감 전(06:00)까지만
  const krOpen = hm >= 900  && hm < 1530;       // 국장 09:00~15:30
  const usOpen = hm >= 2330 || hm < 600;        // 미장 23:30~익일 06:00
  return krOpen || usOpen;
}

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

  const sentiment = detectSentiment(news.title);

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
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="text-[13px] font-bold text-[#191F28] truncate">{mover.name}</div>
            {sentiment && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: sentiment.bg, color: sentiment.color }}
              >
                {sentiment.icon} {sentiment.label}
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#8B95A1] truncate leading-tight">
            {(news.title?.length ?? 0) > 50 ? news.title.slice(0, 48) + '…' : (news.title ?? '')}
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

    // 2시간 이내 뉴스만 (title 없는 항목 제외)
    const freshNews = recentNews.filter(n => {
      if (!n.pubDate || !n.title) return false;
      try { return Date.now() - new Date(n.pubDate).getTime() < TWO_HOURS_MS; }
      catch { return false; }
    });
    if (!freshNews.length) return [];

    const results = [];
    const seenSymbols = new Set();

    for (const news of freshNews) {
      if (results.length >= 5) break;
      const newsText = (news.title ?? '') + ' ' + (news.description || '');

      for (const item of allItems) {
        if (seenSymbols.has(item.id || item.symbol)) continue;

        const pct = Math.abs(getPct(item));
        // 주가 변화가 threshold 미만인 종목만 (아직 미반응)
        if (pct >= PRICE_THRESHOLD) continue;

        // newsAlias 기반 단어경계 매칭 (거짓 양성 방지)
        const keywords = buildKeywords(item);
        if (!keywords.length || !matchesKeywords(newsText, keywords)) continue;

        seenSymbols.add(item.id || item.symbol);
        results.push({ mover: item, news });
        if (results.length >= 5) break;
      }
    }

    return results;
  }, [allItems, recentNews]);

  if (!earlySignals.length || !isAnyMarketOpen()) return null;

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
