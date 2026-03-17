// 오늘의 핵심 뉴스 — 금융 시그널 태그 + 최신 5건
import { useMemo } from 'react';
import { extractNewsSignals } from '../../utils/newsSignal';

const CAT_BADGE = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: '미장' },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: '국내' },
};

export default function TopNewsSection({ allNews = [] }) {
  // 24시간 이내 뉴스 중 상위 5건
  const topNews = useMemo(() => {
    const cutoff = 24 * 60 * 60 * 1000;
    return allNews
      .filter(n => {
        if (!n.pubDate) return false;
        try { return Date.now() - new Date(n.pubDate).getTime() < cutoff; }
        catch { return false; }
      })
      .slice(0, 5);
  }, [allNews]);

  if (!topNews.length) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">오늘의 핵심 뉴스</span>
        <span className="text-[11px] text-[#B0B8C1]">24시간 이내</span>
      </div>

      {/* 뉴스 목록 */}
      {topNews.map((item, i) => {
        const cat = CAT_BADGE[item.category] || { bg: '#F2F4F6', color: '#8B95A1', label: 'NEWS' };
        const signals = extractNewsSignals(item.title);
        const isBreaking = item.pubDate && (Date.now() - new Date(item.pubDate).getTime()) < 3600000;

        return (
          <a
            key={item.id || i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 hover:bg-[#FAFBFC] transition-colors"
          >
            {/* 번호 */}
            <span className="text-[13px] font-bold text-[#C9CDD2] tabular-nums mt-0.5 flex-shrink-0 w-4">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              {/* 배지 행 */}
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
                {signals.slice(0, 2).map(sig => (
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
              {/* 제목 */}
              <p className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">
                {item.title}
              </p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
