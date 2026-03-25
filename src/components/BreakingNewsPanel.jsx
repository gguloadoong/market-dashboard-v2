// 우측 고정 뉴스·속보 패널 — React Query로 중복 호출 차단
import { useState, useEffect } from 'react';
import { useNewsAutoRefetch, useCategoryNewsQuery } from '../hooks/useNewsQuery';
import WhalePanel from './WhalePanel';
import { subscribeLatestWhale } from '../state/whaleBus';
import { extractNewsSignals, getNewsImpact } from '../utils/newsSignal';

// ─── 종목 태그 추출 — 뉴스 제목에서 주요 종목명 감지 ──────────
// 자주 언급되는 주요 종목명만 체크 (성능 + 정확도 균형)
const STOCK_TAG_LIST = [
  // 국내
  '삼성전자','SK하이닉스','LG에너지솔루션','삼성SDI','현대차','기아','LG화학',
  '셀트리온','삼성바이오로직스','카카오','네이버','NAVER','포스코','에코프로',
  '한화에어로스페이스','현대중공업','두산에너빌리티','삼성전기','알테오젠','한미약품',
  // 미국
  'NVIDIA','엔비디아','애플','Apple','테슬라','Tesla','마이크로소프트','Microsoft',
  'Meta','아마존','Amazon','구글','Google','알파벳','Alphabet',
  'AMD','인텔','Intel','퀄컴','Qualcomm','ASML',
  // 코인
  '비트코인','이더리움','리플','솔라나','Bitcoin','Ethereum',
];

function extractStockTags(title) {
  const lower = title.toLowerCase();
  return STOCK_TAG_LIST.filter(name => lower.includes(name.toLowerCase())).slice(0, 3);
}

// 속보 탭 제거 — 속보는 시그널 태그(🔴 속보)로 자동 표시
const TABS = [
  { id: 'all',   label: '전체'    },
  { id: 'kr',    label: '국내'    },
  { id: 'us',    label: '미장'    },
  { id: 'coin',  label: '코인'    },
  { id: 'whale', label: '🐋 고래' },
];

const CAT_COLOR = {
  coin: { bg: '#FFF4E6', color: '#FF9500', label: 'COIN' },
  us:   { bg: '#EDF4FF', color: '#3182F6', label: 'US'   },
  kr:   { bg: '#FFF0F0', color: '#F04452', label: 'KR'   },
};

// RSS description에서 HTML 태그/엔티티 제거 후 1줄 미리보기
function cleanDesc(raw) {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function NewsItem({ item, onNewsClick }) {
  const cat = CAT_COLOR[item.category] || { bg: '#F2F4F6', color: '#6B7684', label: 'NEWS' };
  // 시그널 태그 추출 — pubDate 전달하여 속보(🔴 속보) 자동 감지, 최대 2개
  const signals = extractNewsSignals(item.title, item.pubDate);
  const impact = getNewsImpact(item.title);
  // 뉴스 제목에서 종목 태그 추출
  const stockTags = extractStockTags(item.title);
  // RSS description 1줄 미리보기
  const desc = cleanDesc(item.description || item.summary || '');

  return (
    <div
      onClick={() => onNewsClick?.(item)}
      className="block px-4 py-3 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0"
          style={{ background: cat.bg, color: cat.color }}
        >
          {cat.label}
        </span>
        <span className="text-[11px] text-[#B0B8C1] flex-shrink-0 ml-auto">{item.timeAgo}</span>
      </div>
      {/* 시그널 태그 + 호재/악재 배지 */}
      {(signals.length > 0 || impact) && (
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          {signals.map(sig => (
            <span key={sig.tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: sig.bg, color: sig.color }}>{sig.tag}</span>
          ))}
          {impact && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: impact.bg, color: impact.color }}>{impact.label}</span>
          )}
        </div>
      )}
      <div className="text-[13px] font-medium text-[#191F28] leading-snug line-clamp-2">
        {item.title}
      </div>
      {/* RSS description 미리보기 — 제목과 다른 내용만 표시 */}
      {desc && desc.length > 20 && !desc.startsWith(item.title?.slice(0, 30)) && (
        <p className="text-[11px] text-[#8B95A1] leading-snug mt-1 line-clamp-1">
          {desc}
        </p>
      )}
      {/* 종목 태그 — 제목 아래 표시 */}
      {stockTags.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          {stockTags.map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F2F4F6] text-[#6B7684] font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonItem() {
  return (
    <div className="px-4 py-3 border-b border-[#F2F4F6] space-y-2">
      <div className="h-3 bg-[#F2F4F6] rounded w-1/3 animate-pulse" />
      <div className="h-3.5 bg-[#F2F4F6] rounded animate-pulse" />
      <div className="h-3.5 bg-[#F2F4F6] rounded w-4/5 animate-pulse" />
    </div>
  );
}

// 탭별 뉴스 훅 선택
function useTabNews(activeTab) {
  // 'all' → 전체 뉴스 (자동갱신 포함)
  const allQuery  = useNewsAutoRefetch();
  // 카테고리 탭 → 해당 카테고리만
  const catQuery  = useCategoryNewsQuery(
    ['kr','us','coin'].includes(activeTab) ? activeTab : null
  );
  // 고래 탭은 뉴스 호출 없음
  if (activeTab === 'whale') return { data: [], isLoading: false, isError: false, refetch: () => {} };
  if (['kr','us','coin'].includes(activeTab)) return catQuery;
  return allQuery;
}

// 1시간 이내 속보를 상단에 핀 — 속보 내에서도 최신순, 일반 뉴스도 최신순
function sortWithBreakingFirst(items) {
  const now = Date.now();
  const ONE_HOUR = 3600000;
  // pubDate null/undefined 방어: 유효하지 않은 날짜는 일반 뉴스로 분류
  const getMs = (i) => {
    const ms = i.pubDate ? new Date(i.pubDate).getTime() : 0;
    return isNaN(ms) ? 0 : ms;
  };
  const breaking = items.filter(i => { const ms = getMs(i); return ms > 0 && (now - ms) < ONE_HOUR; })
    .sort((a, b) => getMs(b) - getMs(a));
  const normal = items.filter(i => { const ms = getMs(i); return ms === 0 || (now - ms) >= ONE_HOUR; })
    .sort((a, b) => getMs(b) - getMs(a));
  return [...breaking, ...normal];
}

// 금액 포맷 (고래 핀용)
function fmtAmt(n) {
  if (!n) return '—';
  if (n >= 1e12) return `${(n/1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n/1e8).toFixed(1)}억`;
  if (n >= 1e4)  return `${(n/1e4).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

// 고래 이벤트 인사이트 텍스트 (insight 필드 우선, 없으면 로컬 생성)
function getWhalePinInsight(evt) {
  if (evt.insight) return evt.insight;
  const amt = evt.tradeAmt || 0;
  const side = evt.side;
  if (side === '매수') {
    if (amt >= 5e8) return '기관/대형 투자자 대량 매수 — 단기 급등 주의';
    if (amt >= 1e8) return '세력 유입 의심 — 모멘텀 확인 필요';
    return '대량 단일 체결 — 방향성 주시';
  }
  if (side === '매도') {
    if (amt >= 5e8) return '대규모 매도 출현 — 하락 압력 주의';
    if (amt >= 1e8) return '고래 차익실현 가능성 — 추격매수 주의';
    return '대량 단일 체결 — 방향성 주시';
  }
  if (amt >= 5e9) return '거래소 대규모 입금 — 매도 압력 가능성';
  if (amt >= 1e9) return '고래 자산 이동 — 방향성 주시';
  return '대형 지갑 자산 이동 감지';
}

export default function BreakingNewsPanel({ coins = [], onItemClick, onNewsClick }) {
  const [activeTab, setActiveTab] = useState('all');
  const { data: rawNews = [], isLoading, isError, refetch } = useTabNews(activeTab);
  // 고래 미리보기 핀 — WhalePanel이 이벤트 발행 시 자동 업데이트
  const [latestWhale, setLatestWhale] = useState(null);
  // 읽지 않은 고래 이벤트 카운트
  const [unreadWhale, setUnreadWhale] = useState(0);

  useEffect(() => {
    const unsub = subscribeLatestWhale((evt) => {
      setLatestWhale(evt);
      // 고래 탭이 아닐 때만 배지 카운트 증가
      setUnreadWhale(prev => activeTab !== 'whale' ? prev + 1 : 0);
    });
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // activeTab 변경 시 고래 탭 선택하면 배지 초기화
  useEffect(() => {
    if (activeTab === 'whale') setUnreadWhale(0);
  }, [activeTab]);

  // 전체 탭은 최대 30건, 카테고리 탭은 전체 — 속보는 상단 핀 정렬
  const news = sortWithBreakingFirst(activeTab === 'all' ? rawNews.slice(0, 30) : rawNews);

  return (
    <div className="flex flex-col h-full bg-white border-l border-[#E5E8EB]">
      {/* 탭 헤더 */}
      <div className="flex-shrink-0 border-b border-[#F2F4F6] px-2 pt-3">
        <div className="flex gap-0.5 overflow-x-auto no-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2 text-[12px] font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'text-[#191F28] bg-[#F8F9FA] font-semibold'
                  : 'text-[#6B7684] hover:text-[#191F28]'
              }`}
            >
              {tab.label}
              {/* 고래 탭 읽지 않은 배지 */}
              {tab.id === 'whale' && unreadWhale > 0 && activeTab !== 'whale' && (
                <span className="ml-1 inline-flex items-center justify-center bg-[#F04452] text-white text-[10px] rounded-full px-1 min-w-[14px] h-[14px]">
                  {unreadWhale > 99 ? '99+' : unreadWhale}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 고래 미리보기 핀 — 최신 고래 이벤트 상시 표시 */}
      {latestWhale && activeTab !== 'whale' && (
        <button
          onClick={() => setActiveTab('whale')}
          className="flex-shrink-0 flex items-start gap-2 px-4 py-2 border-b hover:opacity-90 transition-colors text-left w-full"
          style={{
            background: latestWhale.severity === 'high' ? '#FFF0F1' : '#FFFBF0',
            borderBottomColor: latestWhale.severity === 'high' ? '#FFD0D4' : '#FFE5A0',
          }}
        >
          <span className="text-[12px] flex-shrink-0 mt-0.5">🐋</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="text-[11px] font-bold"
                style={{ color: latestWhale.severity === 'high' ? '#F04452' : '#CC8800' }}
              >
                {latestWhale.symbol} {latestWhale.side} ₩{fmtAmt(latestWhale.tradeAmt)}
              </span>
              {latestWhale.severity === 'high' && (
                <span className="text-[9px] font-bold text-[#F04452] bg-[#FFF0F1] border border-[#FFD0D4] px-1 py-0.5 rounded">🔥HIGH</span>
              )}
              <span className="text-[10px] text-[#B0B8C1] flex-shrink-0 ml-auto">고래 탭 →</span>
            </div>
            {/* insight 텍스트 */}
            <div className="text-[10px] text-[#8B95A1] mt-0.5 italic truncate">
              {getWhalePinInsight(latestWhale)}
            </div>
          </div>
        </button>
      )}

      {/* 갱신 상태 */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[#F2F4F6]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
        <span className="text-[11px] text-[#B0B8C1]">
          {activeTab === 'whale' ? '온체인 고래 알림' : '투자 뉴스 · 5분 갱신'}
        </span>
        {activeTab !== 'whale' && !isLoading && (
          <span className="text-[11px] text-[#B0B8C1] ml-auto">{news.length}건</span>
        )}
      </div>

      {/* 뉴스 or 고래 목록 */}
      <div className="flex-1 overflow-y-auto">
        {/* 고래 탭: 항상 마운트 유지 (WebSocket 상시 연결) — 탭 미선택 시 hidden */}
        <div className={activeTab === 'whale' ? 'p-3' : 'hidden'}>
          <WhalePanel coins={coins} onItemClick={onItemClick} />
        </div>

        {/* 뉴스 탭 영역 */}
        {activeTab !== 'whale' && (
          <>
            {isLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonItem key={i} />)}

            {!isLoading && isError && (
              <div className="px-4 py-8 text-center">
                <div className="text-[13px] text-[#B0B8C1] mb-3">뉴스를 불러오지 못했습니다.</div>
                <button onClick={() => refetch()} className="text-[13px] text-[#3182F6] font-medium">
                  다시 시도
                </button>
              </div>
            )}

            {!isLoading && !isError && news.length === 0 && (
              <div className="px-4 py-8 text-center text-[13px] text-[#B0B8C1]">
                뉴스가 없습니다.
              </div>
            )}

            {!isLoading && !isError && news.map(item => (
              <NewsItem key={item.id} item={item} onNewsClick={onNewsClick} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
