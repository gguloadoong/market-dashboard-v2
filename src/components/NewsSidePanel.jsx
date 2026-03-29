// 뉴스 상세 슬라이드 패널 — AI 요약 + 관련 종목 + 관련 뉴스 + 원문 링크
import { useMemo, useEffect, useState } from 'react';
import { buildStockKeywords, matchesKeywords } from '../utils/newsAlias';
import { RELATED_ASSETS } from '../data/relatedAssets';
import { detectNewsSectors } from '../utils/newsTopicMap';
import { useAllNewsQuery } from '../hooks/useNewsQuery';
import { fetchNewsSummary } from '../api/_gateway.js';

// newsTopicMap 섹터('암호화폐') → RELATED_ASSETS 실제 섹터명 매핑
const TOPIC_TO_ASSET_SECTORS = {
  '암호화폐': ['비트코인', '이더리움', '알트코인', '밈코인', 'DeFi', '레이어2', '암호화폐기업'],
  '반도체':   ['반도체'],
  'AI':      ['빅테크', '소프트웨어', '클라우드'],
  '은행':    ['금융'],
  '바이오':  ['바이오', '제약', '헬스케어'],
};

const CAT_COLOR = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: 'US'   },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: 'KR'   },
};

function fmt(n) {
  if (!n) return '—';
  if (n >= 1e12) return `${(n/1e12).toFixed(0)}조`;
  if (n >= 1e8)  return `${(n/1e8).toFixed(0)}억`;
  return n.toLocaleString('ko-KR');
}

function RelatedRow({ item, krwRate, onItemClick }) {
  const isCoin = !!item.id;
  const pct = isCoin ? (item.change24h ?? 0) : (item.changePct ?? 0);
  const isUp = pct > 0;
  const isDown = pct < 0;
  const color = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';

  const price = isCoin
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * (krwRate || 1466)))}`
    : item._market === 'KR' || item.market === 'kr'
      ? `₩${fmt(item.price)}`
      : `$${(item.price ?? 0).toFixed(2)}`;

  const mktBadge = isCoin
    ? { label: 'COIN', bg: '#FFF4E6', color: '#FF9500' }
    : item._market === 'KR' || item.market === 'kr'
      ? { label: 'KR', bg: '#FFF0F0', color: '#F04452' }
      : { label: 'US', bg: '#EDF4FF', color: '#3182F6' };

  return (
    <button
      onClick={() => onItemClick?.(item)}
      className="flex items-center justify-between w-full px-4 py-3 hover:bg-[#F7F8FA] transition-colors text-left"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{ background: mktBadge.bg, color: mktBadge.color }}>
          {mktBadge.label}
        </span>
        <span className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</span>
        <span className="text-[11px] text-[#B0B8C1] font-mono flex-shrink-0">{item.symbol}</span>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <div className="text-[12px] font-bold tabular-nums font-mono" style={{ color }}>
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#8B95A1] font-mono tabular-nums">{price}</div>
      </div>
    </button>
  );
}

// 제목에서 키워드 추출 (불용어 제거)
const STOPWORDS = new Set([
  // 영문 기본 불용어
  'the','a','an','in','on','at','to','for','of','is','are','was','were','and','or','but','not',
  'with','from','by','as','it','its','this','that','be','have','has','had','do','does','did',
  'will','would','shall','should','can','could','may','might','about','after','before','into',
  'over','under','between','through','during',
  // 영문 금융 일반어 (관련도 낮은 단어 필터)
  'market','markets','investment','investor','investors','trading','trade','price','prices',
  'growth','rate','rates','report','data','says','said','new','year','week','month','day',
  'rise','rises','rising','fall','falls','falling','high','low','record','billion','million',
  'percent','pct','stock','stocks','share','shares','crypto','economy','economic','financial',
  'finance','global','world','us','uk',
  // 한국어 조사/접속어/보조어 (내용어 아닌 연결어 전수 추가)
  '위해','위한','통한','대한','통해','따른','관련','이번','올해','내년','지난','오늘','어제','내일',
  '것으로','있는','하는','되는','된다','한다','있다','없다','것이','라고','에서','까지',
  '부터','으로','에게','한편','또한','이에','따라','대해','보도','전했다','밝혔다',
  '알려졌다','나타났다','분석했다','전망했다','보였다','기자',
  // 한국어 금융 일반어 (관련도 낮은 단어 필터)
  '투자','시장','상승','하락','급등','급락','전망','분석','매수','매도','수익','손실',
  '거래','주가','가격','주식','암호화폐','블록체인','경제','금융','증시','지수','변동',
  '세계','글로벌','올해','최근','이달','이번주','전일','전주','기록','억원','조원',
]);

// 키워드 가중치 분류: 티커(3pts) / 영문 고유명사(2pts) / 일반(1pt)
function extractKeywordsWeighted(title) {
  if (!title) return [];
  return title
    .replace(/[^\wㄱ-ㅎ가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()) && !STOPWORDS.has(w))
    .slice(0, 12)
    .map(word => {
      let pts = 1;
      if (/^[A-Z]{2,6}$/.test(word)) pts = 3;          // 티커: BTC, XRP, NVDA, ETH
      else if (/^[A-Z][a-z]{2,}/.test(word)) pts = 2;  // 영문 고유명사: Bitcoin, Apple
      return { word, pts };
    });
}

export default function NewsSidePanel({ news, allData, krwRate, onClose, onRelatedClick, onNewsClick }) {
  const { krStocks = [], usStocks = [], coins = [] } = allData || {};
  const { data: allNews = [] } = useAllNewsQuery();
  const [aiSummary, setAiSummary]     = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // AI 요약 fetch — 패널 열릴 때 1회
  useEffect(() => {
    if (!news?.link) return;
    setAiSummary(null);
    setSummaryLoading(true);
    const rssDesc = (news.description || news.summary || '')
      .replace(/<[^>]+>/g, '').trim().slice(0, 500);
    fetchNewsSummary(news.link, news.title || '', rssDesc)
      .then(d => { if (d.summary) setAiSummary(d.summary); })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [news?.link]);

  // 관련 뉴스 매칭 — 가중치 스코어링 + 카테고리 필터
  // 동일 카테고리: score≥3 / 교차 카테고리: score≥5 (오염 방지)
  const relatedNews = useMemo(() => {
    if (!news?.title || !allNews.length) return [];
    const kwWeighted = extractKeywordsWeighted(news.title);
    if (!kwWeighted.length) return [];
    const newsCategory = news.category;

    return allNews
      .filter(n => n.link !== news.link && n.title !== news.title)
      .map(n => {
        const combined = `${n.title || ''} ${n.description || n.summary || ''}`.toLowerCase();
        let score = 0;
        for (const { word, pts } of kwWeighted) {
          if (combined.includes(word.toLowerCase())) score += pts;
        }
        return { ...n, _score: score };
      })
      .filter(n => {
        if (n._score === 0) return false;
        const sameCat = n.category === newsCategory;
        return sameCat ? n._score >= 3 : n._score >= 5;
      })
      .sort((a, b) => {
        // 동일 카테고리 우선, 그 다음 score 순
        const aSame = a.category === newsCategory ? 1 : 0;
        const bSame = b.category === newsCategory ? 1 : 0;
        if (bSame !== aSame) return bSame - aSame;
        return b._score - a._score;
      })
      .slice(0, 5);
  }, [news, allNews]);

  // 관련 종목 매칭 — 3단계 알고리즘 + 코인 앵커
  // Stage 1: 직접 키워드 매칭 (score 10)
  // Stage 2: relatedAssets 확장 (score 7)
  // Stage 3: 섹터 기반 자동 확장 (score 3)
  // 코인 앵커: coin 뉴스에 BTC·ETH 미포함 시 추가 (score 5)
  const relatedItems = useMemo(() => {
    if (!news) return [];
    const text = `${news.title || ''} ${news.description || ''} ${news.summary || ''}`;
    const all = [
      ...krStocks.map(s => ({ ...s, _market: 'KR' })),
      ...usStocks.map(s => ({ ...s, _market: 'US' })),
      ...coins.map(c => ({ ...c, _market: 'COIN' })),
    ];
    const allMap = Object.fromEntries(all.map(item => [item.symbol, item]));

    const newsCategory = news.category;
    const allowedMarkets = new Set(
      newsCategory === 'coin' ? ['COIN', 'US']
      : newsCategory === 'kr'  ? ['KR', 'US']
      : ['US', 'COIN', 'KR']
    );

    // score Map: symbol → { item, score }
    const scored = new Map();

    // Stage 1: 키워드 직접 매칭 (score 10) — 직접 언급 종목은 시장 제한 없이 표시
    for (const item of all) {
      const keywords = buildStockKeywords(item.symbol, item.name,
        item._market === 'KR' ? 'KR' : item._market === 'COIN' ? 'COIN' : 'US');
      if (keywords.length > 0 && matchesKeywords(text, keywords)) {
        scored.set(item.symbol, { item, score: 10 });
      }
    }

    // Stage 2: relatedAssets 연관 종목 확장 (score 7)
    for (const [sym] of scored) {
      const info = RELATED_ASSETS[sym];
      if (!info?.related) continue;
      for (const rel of info.related) {
        if (scored.has(rel.symbol)) continue;
        if (!allowedMarkets.has(rel.market)) continue;
        const relItem = allMap[rel.symbol] ?? {
          symbol: rel.symbol, name: rel.reason,
          _market: rel.market, _relationType: rel.type,
        };
        scored.set(rel.symbol, { item: relItem, score: 7 });
      }
    }

    // Stage 3: 섹터 기반 자동 확장 (score 3) — 직접 매칭 종목과 같은 섹터 전체 추가
    const matchedSectors = new Set();
    for (const [sym] of scored) {
      const sector = RELATED_ASSETS[sym]?.sector;
      if (sector) matchedSectors.add(sector);
    }
    // Stage 3b: newsTopicMap 뉴스 텍스트 기반 섹터 보강
    // — 직접 매칭 없어도 'CLARITY Act', '법안' 등 규제 키워드로 관련 자산 섹터 추가
    const titleTopicSectors = detectNewsSectors(`${news.title || ''} ${news.description || ''} ${news.summary || ''}`);
    for (const ts of titleTopicSectors) {
      const assetSectors = TOPIC_TO_ASSET_SECTORS[ts] || [];
      for (const s of assetSectors) matchedSectors.add(s);
    }
    if (matchedSectors.size > 0) {
      for (const [sym, info] of Object.entries(RELATED_ASSETS)) {
        if (!info.sector || !matchedSectors.has(info.sector)) continue;
        if (scored.has(sym)) continue;
        const relItem = allMap[sym];
        if (!relItem || !allowedMarkets.has(relItem._market)) continue;
        scored.set(sym, { item: relItem, score: 3 });
      }
    }

    // 코인 앵커: coin 뉴스에 BTC·ETH 미포함 시 추가 (score 5)
    if (newsCategory === 'coin' && scored.size > 0) {
      for (const anchor of ['BTC', 'ETH']) {
        if (!scored.has(anchor) && allMap[anchor]) {
          scored.set(anchor, { item: allMap[anchor], score: 5 });
        }
      }
    }

    return [...scored.values()]
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
      .slice(0, 8);
  }, [news, krStocks, usStocks, coins]);

  if (!news) return null;

  const cat = CAT_COLOR[news.category] || { bg: '#F2F4F6', color: '#6B7684', label: 'NEWS' };

  // RSS description (AI 요약 로딩 중 또는 실패 시 fallback)
  const rssSummary = (news.description || news.summary || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
    .slice(0, 300);

  const displaySummary = aiSummary || rssSummary;

  return (
    <>
      {/* 딤 오버레이 */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* 슬라이드 패널 */}
      <div
        className="fixed top-0 right-0 w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col"
        style={{
          animation: 'slideInRight 0.25s ease-out',
          height: '100dvh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-4 border-b border-[#F2F4F6]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded"
              style={{ background: cat.bg, color: cat.color }}>
              {cat.label}
            </span>
            {news.source && (
              <span className="text-[11px] text-[#8B95A1]">{news.source}</span>
            )}
            {news.timeAgo && (
              <span className="text-[11px] text-[#C9CDD2]">{news.timeAgo}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F2F4F6] text-[#6B7684] transition-colors text-[18px]"
          >×</button>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">
          {/* 제목 */}
          <div className="px-4 pt-4 pb-3">
            <h2 className="text-[16px] font-bold text-[#191F28] leading-snug">
              {news.title}
            </h2>
          </div>

          {/* 요약 영역 */}
          <div className="px-4 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#EDF4FF] text-[#3182F6]">
                AI 요약
              </span>
              {summaryLoading && (
                <span className="text-[10px] text-[#B0B8C1] animate-pulse">생성 중…</span>
              )}
              {!summaryLoading && aiSummary && (
                <span className="text-[10px] text-[#B0B8C1]">Gemini</span>
              )}
            </div>
            {summaryLoading && !displaySummary ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-[#F2F4F6] rounded w-full" />
                <div className="h-3 bg-[#F2F4F6] rounded w-4/5" />
                <div className="h-3 bg-[#F2F4F6] rounded w-3/5" />
              </div>
            ) : displaySummary ? (
              <p className="text-[13px] text-[#4E5968] leading-relaxed whitespace-pre-line">
                {displaySummary}{!aiSummary && rssSummary.length >= 300 ? '…' : ''}
              </p>
            ) : null}
          </div>

          {/* 관련 종목 */}
          {relatedItems.length > 0 && (
            <div className="border-t border-[#F2F4F6]">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="text-[12px] font-bold text-[#191F28]">관련 종목</span>
                <span className="text-[11px] text-[#B0B8C1]">{relatedItems.length}개</span>
              </div>
              <div className="divide-y divide-[#F2F4F6]">
                {relatedItems.map(item => (
                  <RelatedRow
                    key={item.id || item.symbol}
                    item={item}
                    krwRate={krwRate}
                    onItemClick={(clicked) => {
                      onClose?.();
                      setTimeout(() => onRelatedClick?.(clicked), 250);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 관련 뉴스 */}
          {relatedNews.length > 0 && (
            <div className="border-t border-[#F2F4F6]">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="text-[12px] font-bold text-[#191F28]">관련 뉴스</span>
                <span className="text-[11px] text-[#B0B8C1]">{relatedNews.length}건</span>
              </div>
              <div className="divide-y divide-[#F2F4F6]">
                {relatedNews.map((n, i) => {
                  const nCat = CAT_COLOR[n.category] || { bg: '#F2F4F6', color: '#6B7684', label: 'NEWS' };
                  return (
                    <button
                      key={n.link || i}
                      onClick={() => onNewsClick?.(n)}
                      className="w-full px-4 py-3 hover:bg-[#F7F8FA] transition-colors text-left"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                          style={{ background: nCat.bg, color: nCat.color }}>
                          {nCat.label}
                        </span>
                        {n.source && (
                          <span className="text-[10px] text-[#B0B8C1] flex-shrink-0">{n.source}</span>
                        )}
                        {n.timeAgo && (
                          <span className="text-[10px] text-[#C9CDD2]">{n.timeAgo}</span>
                        )}
                      </div>
                      <p className="text-[12px] font-medium text-[#333D4B] leading-snug line-clamp-2">
                        {n.title}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 하단: 원문 보기 */}
        {news.link && (
          <div className="flex-shrink-0 px-4 py-4 border-t border-[#F2F4F6]">
            <a
              href={news.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => { e.preventDefault(); e.stopPropagation(); if (news.link) window.open(news.link, '_blank', 'noopener,noreferrer'); }}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-[#E5E8EB] text-[13px] font-medium text-[#4E5968] hover:bg-[#F7F8FA] transition-colors cursor-pointer"
            >
              원문 보기
              <span className="text-[11px]">↗</span>
            </a>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
