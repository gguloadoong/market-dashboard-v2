// 코인 거래소 공지 섹션 — Upbit 공지사항 API로 신규상장/상장폐지/이벤트 공지 표시
import { useQuery } from '@tanstack/react-query';

// ─── 공지 유형 분류 ──────────────────────────────────────
// Upbit 공지 제목 패턴 기반으로 유형 결정
const LISTING_TYPES = [
  {
    type: 'new',
    label: '신규상장',
    icon: '🟢',
    bg: '#F0FFF4',
    color: '#2AC769',
    borderColor: '#BBF7D0',
    // 신규 상장 패턴
    patterns: [
      '디지털 자산 추가',
      '원화 마켓 추가',
      'BTC 마켓 추가',
      'USDT 마켓 추가',
      '마켓 디지털 자산 추가',
      '신규 상장',
      '거래 지원 안내',
      '거래 지원 시작',
    ],
  },
  {
    type: 'delist',
    label: '상장폐지',
    icon: '🔴',
    bg: '#FFF5F5',
    color: '#F04452',
    borderColor: '#FECACA',
    patterns: [
      '거래 지원 종료',
      '상장폐지',
      '유의 종목',
      '투자유의',
      '거래 정지',
    ],
  },
  {
    type: 'event',
    label: '이벤트',
    icon: '🎁',
    bg: '#FFFBEB',
    color: '#F59E0B',
    borderColor: '#FDE68A',
    patterns: ['이벤트', '에어드랍', '스테이킹', '프로모션'],
  },
];

// 공지 유형 매칭
function classifyNotice(title) {
  for (const t of LISTING_TYPES) {
    if (t.patterns.some(p => title.includes(p))) return t;
  }
  // 기타 → 일반
  return {
    type: 'general',
    label: '공지',
    icon: '📌',
    bg: '#F8F9FA',
    color: '#6B7684',
    borderColor: '#E5E8EB',
  };
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
  } catch {
    return '';
  }
}

// ─── Upbit 공지 API 호출 ─────────────────────────────────
// /api/upbit-notices 프록시 경유 (CORS 처리)
async function fetchCoinListings() {
  const res = await fetch('/api/upbit-notices', {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`공지 API 실패: ${res.status}`);

  const json = await res.json();
  // Upbit 응답 구조: { data: [...] } 또는 배열 직접 반환
  const items = Array.isArray(json) ? json : (json.data || []);

  // 신규상장·상장폐지·이벤트 필터 + 최대 5건
  return items
    .slice(0, 20)
    .map(n => ({
      id: n.id,
      title: n.title || n.subject || '',
      url: n.url || n.link || `https://upbit.com/service_center/notice?id=${n.id}`,
      createdAt: n.created_at || n.created || '',
      ...classifyNotice(n.title || n.subject || ''),
    }))
    .filter(n => n.type !== 'general')   // 일반 공지 제외
    .slice(0, 5);
}

// ─── 공지 아이템 행 ─────────────────────────────────────
function NoticeRow({ item }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-2.5 px-4 py-2.5 border-b border-[#F8F9FA] last:border-0 hover:bg-[#FAFBFC] transition-colors cursor-pointer"
    >
      {/* 유형 뱃지 */}
      <span
        className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5"
        style={{ background: item.bg, color: item.color, border: `1px solid ${item.borderColor}` }}
      >
        {item.icon} {item.label}
      </span>

      {/* 공지 제목 */}
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-medium text-[#191F28] line-clamp-2 leading-snug">
          {item.title}
        </span>
      </div>

      {/* 시간 */}
      <span className="flex-shrink-0 text-[11px] text-[#B0B8C1] mt-0.5 whitespace-nowrap">
        {timeAgo(item.createdAt)}
      </span>
    </a>
  );
}

// ─── 스켈레톤 로딩 ───────────────────────────────────────
function ListingSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-[#F8F9FA]">
          <div className="w-14 h-4 bg-[#F2F4F6] rounded animate-pulse flex-shrink-0" />
          <div className="flex-1 h-4 bg-[#F2F4F6] rounded animate-pulse" />
          <div className="w-12 h-3 bg-[#F2F4F6] rounded animate-pulse flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function CoinListingSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['coin-listings'],
    queryFn: fetchCoinListings,
    staleTime: 300_000,          // 5분 캐시
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // API 실패 시 섹션 전체 숨김
  if (isError) return null;

  // 데이터 로드 완료 후 표시할 공지 없으면 숨김
  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#F2F4F6] shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">📢</span>
          <span className="text-[15px] font-bold text-[#191F28]">코인 거래소 공지</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-[#B0B8C1]">업비트 기준</span>
          {/* 실시간 표시 인디케이터 */}
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
        </div>
      </div>

      {/* 공지 목록 */}
      <div>
        {isLoading ? (
          <ListingSkeleton />
        ) : (
          data?.map(item => <NoticeRow key={item.id} item={item} />)
        )}
      </div>

      {/* 하단 링크 */}
      {!isLoading && data && data.length > 0 && (
        <div className="px-4 py-2 border-t border-[#F8F9FA]">
          <a
            href="https://upbit.com/service_center/notice"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#3182F6] font-medium hover:underline"
          >
            업비트 공지 전체 보기 →
          </a>
        </div>
      )}
    </div>
  );
}
