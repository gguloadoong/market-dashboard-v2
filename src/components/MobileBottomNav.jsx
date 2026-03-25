// 모바일 하단 내비게이션 — lg 이상에서는 숨김
// 5탭: 홈 / 국내 / 미장 / 코인 / 뉴스
// 급등 배지(🔥) — 해당 탭 종목 중 ≥3% 종목 존재 시 표시
import { memo } from 'react';

const TABS = [
  {
    id: 'home',
    label: '홈',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#191F28' : 'none'}
        stroke={active ? '#191F28' : '#8B95A1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    id: 'kr',
    label: '국내',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#191F28' : '#8B95A1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
  },
  {
    id: 'us',
    label: '미장',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#191F28' : '#8B95A1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    id: 'coin',
    label: '코인',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#191F28' : '#8B95A1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.5 8.5h4a2 2 0 0 1 0 4h-4v4" />
        <path d="M9.5 8.5V7" />
        <path d="M13.5 16.5V18" />
      </svg>
    ),
  },
  {
    id: 'news',
    label: '뉴스',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#191F28' : '#8B95A1'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8" />
        <path d="M15 18h-5" />
        <path d="M10 6h8v4h-8V6z" />
      </svg>
    ),
  },
];

// 탭별 급등 여부 판단
function hasSurge(id, { krStocks, usStocks, coins }) {
  const check = (items, key) => items.some(s => (s[key] ?? 0) >= 3);
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

const MobileBottomNav = memo(function MobileBottomNav({ activeTab, onTabChange, krStocks = [], usStocks = [], coins = [] }) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-[#E5E8EB]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex">
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const surge = hasSurge(tab.id, { krStocks, usStocks, coins });
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative"
              style={{ minHeight: 56 }}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
            >
              {/* 급등 배지 */}
              {surge && !active && (
                <span
                  className="absolute top-1 right-[calc(50%-14px)] text-[9px] leading-none"
                  aria-hidden="true"
                >🔥</span>
              )}

              {/* 아이콘 */}
              {tab.icon(active)}

              {/* 레이블 */}
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? '#191F28' : '#8B95A1' }}
              >
                {tab.label}
              </span>

              {/* 액티브 인디케이터 점 */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#191F28]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});

export default MobileBottomNav;
