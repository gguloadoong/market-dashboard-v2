// 데스크탑 헤더 — 탭 + 장 상태 + 환율 + 새로고침
// 탭: active 상태 개선 (underline + filled bg), 뱃지 🔥, 이모지 레이블
import { getKoreanMarketStatus, getUsMarketStatus } from '../utils/marketHours';
import { fmt } from '../utils/format';

const TABS = [
  { id: 'home', label: '🏠 홈' },
  { id: 'kr',   label: '🇰🇷 국내' },
  { id: 'us',   label: '🇺🇸 미장' },
  { id: 'coin', label: '🪙 코인' },
  { id: 'etf',  label: '📊 ETF' },
  // 모바일 전용 뉴스 탭 — 데스크탑에서는 우측 고정 패널이 담당
  { id: 'news', label: '📰 뉴스', mobileOnly: true },
];

// 탭별 급등 강조 여부 판단 함수 (props로 받은 종목 데이터 활용)
function getTabHasSurge(id, { krStocks, usStocks, coins }) {
  const check = (items, pctKey) => items.some(s => (s[pctKey] ?? 0) >= 3);
  if (id === 'kr')   return check(krStocks, 'changePct');
  if (id === 'us')   return check(usStocks, 'changePct');
  if (id === 'coin') return check(coins, 'change24h');
  if (id === 'home') return (
    check(krStocks, 'changePct') ||
    check(usStocks, 'changePct') ||
    check(coins, 'change24h')
  );
  return false;
}

export default function Header({
  krwRate, lastUpdated, onRefresh, loading, activeTab, onTabChange,
  krStocks = [], usStocks = [], coins = [],
}) {
  const kr = getKoreanMarketStatus();
  const us = getUsMarketStatus();
  const timeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <header className="bg-white sticky top-0 z-20" style={{ borderBottom: '1px solid #E5E8EB' }}>
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between">

        {/* 좌: 로고 + 탭 */}
        <div className="flex items-center gap-5">
          <span className="text-[20px] font-bold text-[#191F28] tracking-tight flex-shrink-0">
            마켓레이더
          </span>
          {/* 탭 — 모바일에서 가로 스크롤 지원 */}
          <nav className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const hasSurge = getTabHasSurge(tab.id, { krStocks, usStocks, coins });
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  // mobileOnly 탭은 데스크탑(lg+)에서 숨김
                  className={`relative flex-shrink-0 flex items-center gap-1 px-3 py-2 text-[13px] font-medium transition-all rounded-lg ${
                    tab.mobileOnly ? 'lg:hidden' : ''
                  } ${
                    isActive
                      ? 'bg-[#191F28] text-white font-bold'
                      : 'text-[#6B7684] hover:bg-[#F2F4F6] hover:text-[#191F28]'
                  }`}
                >
                  {tab.label}
                  {/* 급등 🔥 뱃지 */}
                  {hasSurge && !isActive && (
                    <span className="text-[10px] leading-none">🔥</span>
                  )}
                  {/* active 탭 하단 underline 강조 */}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-white opacity-60" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* 우: 장 상태 + 환율 + 시각 + 새로고침 — 모바일에서 숨김 */}
        <div className="hidden md:flex items-center gap-4">
          {/* 장 운영 상태 */}
          <div className="flex items-center gap-3 text-[13px]">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${kr.status === 'open' ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
              <span className="text-[#6B7684]">국장</span>
              <span className={`font-semibold text-[12px] ${kr.status === 'open' ? 'text-[#2AC769]' : 'text-[#B0B8C1]'}`}>{kr.label}</span>
            </span>
            <span className="text-[#E5E8EB]">|</span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${us.status === 'open' ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
              <span className="text-[#6B7684]">미장</span>
              <span className={`font-semibold text-[12px] ${us.status === 'open' ? 'text-[#2AC769]' : 'text-[#B0B8C1]'}`}>{us.label}</span>
            </span>
          </div>

          {/* 환율 */}
          {krwRate && (
            <div className="text-[14px] font-bold text-[#191F28] font-mono tabular-nums">
              ₩{fmt(krwRate)}
              <span className="text-[11px] font-normal text-[#B0B8C1] ml-1">USD/KRW</span>
            </div>
          )}

          {/* 업데이트 시각 */}
          {timeStr && (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
              <span className="text-[12px] text-[#B0B8C1] font-mono">{timeStr}</span>
            </div>
          )}

          {/* 새로고침 버튼 */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-[#E5E8EB] transition-colors ${
              loading
                ? 'opacity-40 cursor-not-allowed text-[#B0B8C1]'
                : 'text-[#6B7684] hover:bg-[#F2F4F6] hover:text-[#191F28]'
            }`}
          >
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              className={loading ? 'animate-spin' : ''}
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            새로고침
          </button>
        </div>
      </div>
    </header>
  );
}
