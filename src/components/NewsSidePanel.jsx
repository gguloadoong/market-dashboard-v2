// 뉴스 상세 슬라이드 패널 — AI 요약 + 관련 종목 + 관련 뉴스 + 원문 링크
import { useMemo, useEffect, useState } from 'react';
import { buildStockKeywords, matchesKeywords } from '../utils/newsAlias';
import { RELATED_ASSETS } from '../data/relatedAssets';
import { useAllNewsQuery } from '../hooks/useNewsQuery';

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
const STOPWORDS = new Set(['the','a','an','in','on','at','to','for','of','is','are','was','were','and','or','but','not','with','from','by','as','it','its','this','that','be','have','has','had','do','does','did','will','would','shall','should','can','could','may','might','about','after','before','into','over','under','between','through','during','위해','대한','통해','따른','관련','이번','올해','내년','지난','오늘','어제','내일','것으로','있는','하는','되는','된다','한다','있다','없다','것이','라고','에서','까지','부터','으로','에게','한편','또한','이에','따라','대해','보도','전했다','밝혔다','알려졌다','나타났다','분석했다','전망했다','보였다','기자']);

function extractKeywords(title) {
  if (!title) return [];
  return title
    .replace(/[^\wㄱ-ㅎ가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 2 && !STOPWORDS.has(w.toLowerCase()))
    .slice(0, 10);
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
    const params = new URLSearchParams({ url: news.link });
    if (news.title) params.set('title', news.title);
    if (rssDesc) params.set('fallback', rssDesc);
    fetch(`/api/news-summary?${params}`)
      .then(r => r.json())
      .then(d => { if (d.summary) setAiSummary(d.summary); })
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, [news?.link]);

  // 관련 뉴스 매칭 — 키워드 2개 이상 겹치는 뉴스
  const relatedNews = useMemo(() => {
    if (!news?.title || !allNews.length) return [];
    const keywords = extractKeywords(news.title);
    if (keywords.length < 2) return [];
    return allNews
      .filter(n => n.link !== news.link && n.title !== news.title)
      .map(n => {
        const nTitle = (n.title || '').toLowerCase();
        const nDesc  = (n.description || n.summary || '').toLowerCase();
        const combined = `${nTitle} ${nDesc}`;
        const score = keywords.filter(kw => combined.includes(kw.toLowerCase())).length;
        return { ...n, _score: score };
      })
      .filter(n => n._score >= 2)
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);
  }, [news, allNews]);

  // 관련 종목 매칭 — 키워드 직접 매칭 + relatedAssets 연관 종목 확장
  const relatedItems = useMemo(() => {
    if (!news) return [];
    const text = `${news.title || ''} ${news.description || ''} ${news.summary || ''}`;
    const all = [
      ...krStocks.map(s => ({ ...s, _market: 'KR' })),
      ...usStocks.map(s => ({ ...s, _market: 'US' })),
      ...coins.map(c => ({ ...c, _market: 'COIN' })),
    ];
    const allMap = Object.fromEntries(all.map(item => [item.symbol, item]));

    // 1단계: 키워드 직접 매칭
    const directMatches = all.filter(item => {
      const keywords = buildStockKeywords(item.symbol, item.name,
        item._market === 'KR' ? 'KR' : item._market === 'COIN' ? 'COIN' : 'US');
      return keywords.length > 0 && matchesKeywords(text, keywords);
    });

    // 2단계: 직접 매칭된 종목의 연관 종목 확장 (relatedAssets)
    const seen = new Set(directMatches.map(d => d.symbol));
    const expanded = [];
    for (const matched of directMatches) {
      const info = RELATED_ASSETS[matched.symbol];
      if (!info?.related) continue;
      for (const rel of info.related) {
        if (seen.has(rel.symbol)) continue;
        seen.add(rel.symbol);
        expanded.push(allMap[rel.symbol] ?? {
          symbol: rel.symbol,
          name: rel.reason,
          _market: rel.market,
          _relationType: rel.type,
        });
      }
    }

    return [...directMatches, ...expanded].slice(0, 8);
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
        className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white z-50 shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
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
              className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-[#E5E8EB] text-[13px] font-medium text-[#4E5968] hover:bg-[#F7F8FA] transition-colors"
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
