// 시장 타임라인 위젯 — 오늘 시장 이벤트를 시간순으로 표시
import { useMemo } from 'react';
import { useSignals } from '../../hooks/useSignals';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';
import { getNewsImportanceScore } from '../../utils/newsSignal';

// 타임라인 아이템 타입별 스타일
const TYPE_STYLE = {
  signal: { bg: '#F0FFF6', border: '#2AC769' },
  news:   { bg: '#FFF0F1', border: '#F04452' },
};

// 타임라인 아이템 생성
function buildTimelineItems(signals, breakingNews) {
  const items = [];

  // 시그널 이벤트
  for (const sig of signals) {
    const emoji = sig.direction === 'bullish' ? '\u{1F7E2}' : sig.direction === 'bearish' ? '\u{1F534}' : '\u{1F7E1}';
    items.push({
      time: sig.timestamp,
      type: 'signal',
      emoji,
      text: sig.title,
    });
  }

  // 주요 뉴스
  for (const news of breakingNews) {
    items.push({
      time: new Date(news.pubDate).getTime(),
      type: 'news',
      emoji: '\u{1F4F0}',
      text: news.title,
    });
  }

  return items.sort((a, b) => b.time - a.time).slice(0, 15);
}

export default function MarketTimeline() {
  const signals = useSignals();
  const { data: allNews = [] } = useAllNewsQuery();

  // 오늘 주요 뉴스 필터 (중요도 점수 5점 이상)
  const breakingNews = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return allNews.filter(n => {
      if (!n.pubDate) return false;
      try {
        const pubMs = new Date(n.pubDate).getTime();
        return pubMs >= todayStart.getTime() && getNewsImportanceScore(n) >= 5;
      } catch { return false; }
    });
  }, [allNews]);

  const items = useMemo(
    () => buildTimelineItems(signals, breakingNews),
    [signals, breakingNews],
  );

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[13px] font-bold text-[#191F28]">오늘의 타임라인</span>
        <span className="text-[11px] text-[#B0B8C1]">시간순</span>
      </div>

      <div className="px-4 py-3">
        {items.map((item, i) => {
          const timeStr = new Date(item.time).toLocaleTimeString('ko-KR', {
            hour: '2-digit', minute: '2-digit',
          });
          const style = TYPE_STYLE[item.type] || TYPE_STYLE.signal;
          const isLast = i === items.length - 1;

          return (
            <div key={`${item.time}-${i}`} className="flex gap-3 min-h-[36px]">
              {/* 시간 */}
              <span className="text-[10px] text-[#8B95A1] font-mono tabular-nums w-[40px] flex-shrink-0 pt-0.5 text-right">
                {timeStr}
              </span>

              {/* 세로 타임라인 라인 */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                  style={{ background: style.border }}
                />
                {!isLast && <div className="w-px flex-1 bg-[#E5E8EB] my-0.5" />}
              </div>

              {/* 내용 */}
              <div className="flex items-start gap-1.5 pb-3 min-w-0 flex-1">
                <span className="text-[12px] flex-shrink-0">{item.emoji}</span>
                <p className="text-[11px] text-[#4E5968] leading-snug line-clamp-2">{item.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
