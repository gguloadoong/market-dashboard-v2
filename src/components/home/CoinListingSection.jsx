// 코인 거래소 공지 섹션 — 뉴스 기반 상장/상폐 감지
// Upbit 공지 API 폐지(404) → 뉴스 피드에서 거래소 관련 키워드 필터링
import { useMemo } from 'react';
import { useAllNewsQuery } from '../../hooks/useNewsQuery';

// ─── 거래소 공지 유형 분류 ───────────────────────────────
const LISTING_PATTERNS = [
  {
    type: 'new',
    label: '신규상장',
    icon: '🟢',
    bg: '#F0FFF4',
    color: '#2AC769',
    borderColor: '#BBF7D0',
    keywords: ['상장', '거래 지원', '마켓 추가', '신규 코인', '코인 추가', '거래 시작', 'listing'],
  },
  {
    type: 'delist',
    label: '상장폐지',
    icon: '🔴',
    bg: '#FFF5F5',
    color: '#F04452',
    borderColor: '#FECACA',
    keywords: ['상장폐지', '거래 종료', '거래 정지', '유의 종목', '투자유의', 'delist'],
  },
  {
    type: 'event',
    label: '이벤트',
    icon: '🎁',
    bg: '#FFFBEB',
    color: '#F59E0B',
    borderColor: '#FDE68A',
    keywords: ['에어드랍', '에어드롭', '스테이킹', '하드포크', 'airdrop', '네트워크 업그레이드'],
  },
];

// 거래소 이름 필터 — 이 거래소 키워드가 포함된 뉴스만 매칭
const EXCHANGE_KW = ['업비트', '빗썸', '코인원', '코빗', '바이낸스', 'upbit', 'bithumb', 'binance', 'coinbase'];

function classifyNews(title) {
  const lower = title.toLowerCase();
  for (const p of LISTING_PATTERNS) {
    if (p.keywords.some(k => lower.includes(k))) return p;
  }
  return null;
}

// ─── 시간 포맷 ───────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    return `${days}일 전`;
  } catch { return ''; }
}

// ─── 공지 아이템 행 ─────────────────────────────────────
function NoticeRow({ item }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2.5 px-4 py-2.5 border-b border-[#F8F9FA] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
    >
      <span
        className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5"
        style={{ background: item.bg, color: item.color, border: `1px solid ${item.borderColor}` }}
      >
        {item.icon} {item.label}
      </span>
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium text-[#191F28] line-clamp-2 leading-snug">
          {item.title}
        </span>
        {item.source && (
          <span className="text-[10px] text-[#B0B8C1] mt-0.5 block">{item.source}</span>
        )}
      </div>
      <span className="flex-shrink-0 text-[11px] text-[#B0B8C1] mt-0.5 whitespace-nowrap">
        {timeAgo(item.pubDate)}
      </span>
    </a>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function CoinListingSection() {
  const { data: allNews = [], isLoading } = useAllNewsQuery();

  // 뉴스에서 거래소 상장/상폐/이벤트 관련 기사 필터
  const notices = useMemo(() => {
    if (!allNews.length) return [];
    const lower = t => (t || '').toLowerCase();
    return allNews
      .filter(n => {
        const text = lower(n.title);
        // 거래소 키워드 포함 필수
        if (!EXCHANGE_KW.some(k => text.includes(k))) return false;
        // 상장/상폐/이벤트 유형 매칭
        return classifyNews(n.title || '') !== null;
      })
      .slice(0, 5)
      .map(n => {
        const type = classifyNews(n.title || '');
        return { ...n, ...type, title: n.title || '' };
      });
  }, [allNews]);

  // 데이터 없으면 숨김
  if (!isLoading && notices.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">📢</span>
          <span className="text-[15px] font-bold text-[#191F28]">거래소 상장·이벤트</span>
        </div>
        <span className="text-[11px] text-[#B0B8C1]">뉴스 기반 감지</span>
      </div>

      <div>
        {isLoading ? (
          <div className="space-y-0">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[#F8F9FA]">
                <div className="w-14 h-4 bg-[#F2F4F6] rounded animate-pulse flex-shrink-0" />
                <div className="flex-1 h-4 bg-[#F2F4F6] rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          notices.map((item, i) => <NoticeRow key={i} item={item} />)
        )}
      </div>
    </div>
  );
}
