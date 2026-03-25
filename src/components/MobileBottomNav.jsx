// 모바일 하단 내비게이션 — lg 이상에서는 숨김
// 5탭: 홈 / 국내 / 미장 / 코인 / 뉴스
// Lucide 아이콘 — 통일된 2px stroke 스타일
import { memo } from 'react';
import { Home, TrendingUp, Globe, Bitcoin, Newspaper } from 'lucide-react';

const TABS = [
  { id: 'home',  label: '홈',  Icon: Home       },
  { id: 'kr',    label: '국내', Icon: TrendingUp },
  { id: 'us',    label: '미장', Icon: Globe      },
  { id: 'coin',  label: '코인', Icon: Bitcoin    },
  { id: 'news',  label: '뉴스', Icon: Newspaper  },
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
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          const surge = hasSurge(id, { krStocks, usStocks, coins });
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative"
              style={{ minHeight: 56 }}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              {/* 급등 배지 */}
              {surge && !active && (
                <span
                  className="absolute top-1 right-[calc(50%-14px)] text-[9px] leading-none"
                  aria-hidden="true"
                >🔥</span>
              )}

              {/* Lucide 아이콘 */}
              <Icon
                size={22}
                strokeWidth={active ? 2.5 : 1.8}
                color={active ? '#191F28' : '#8B95A1'}
              />

              {/* 레이블 */}
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? '#191F28' : '#8B95A1' }}
              >
                {label}
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
