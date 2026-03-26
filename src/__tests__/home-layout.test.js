/**
 * 홈 레이아웃 아키텍처 테스트
 *
 * 이 테스트가 존재하는 이유:
 * - EarlySignalSection: 삭제→복원→재삭제 3사이클 반복
 * - EventCalendar(섹션): 삭제→재생성→재삭제 4사이클 반복
 * - DexHotSection, InsightsSection, SurgeSection: 좀비 파일로 방치 → 재발견 후 재import 위험
 *
 * 규칙: 삭제된 컴포넌트가 index.jsx에 import되는 순간 이 테스트가 실패한다.
 * 실패하면 "실수로 재추가됐다"는 뜻이다. HOME_CONTRACT.md를 먼저 읽어라.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const homeIndexPath = resolve(__dirname, '../components/home/index.jsx');
const homeIndex = readFileSync(homeIndexPath, 'utf-8');

// ─── 영구 삭제된 컴포넌트 — import 금지 ──────────────────────────────────────
// 이 목록에 추가할 때는 HOME_CONTRACT.md "영구 삭제된 컴포넌트" 표에도 추가하라.
const BANNED_IMPORTS = [
  { name: 'EarlySignalSection', reason: '오탐률 높음, #172에서 삭제' },
  { name: 'EventCalendar',      reason: 'EventTicker 롤링으로 대체, 섹션 형태 금지' },
  { name: 'DexHotSection',      reason: '데이터 소스 불안정, #180에서 삭제' },
  { name: 'InsightsSection',    reason: 'TopMoversWidget으로 통합, #180에서 삭제' },
  { name: 'SurgeSection',       reason: 'TopMoversWidget으로 통합, #180에서 삭제' },
];

describe('홈 레이아웃 — 삭제된 컴포넌트 재import 방지', () => {
  for (const { name, reason } of BANNED_IMPORTS) {
    test(`${name} import 금지 (사유: ${reason})`, () => {
      const hasImport = homeIndex.includes(`import ${name}`) ||
                        homeIndex.includes(`import { ${name}`) ||
                        homeIndex.includes(`from './${name}'`) ||
                        homeIndex.includes(`from "./${name}"`);
      expect(hasImport).toBe(false);
    });
  }
});

// ─── 현재 활성 컴포넌트 — 누락 방지 ──────────────────────────────────────────
// HomeDashboard가 렌더해야 하는 핵심 위젯 목록.
// 새 위젯을 추가하면 여기도 추가하라. 삭제하면 여기서도 제거하라.
const REQUIRED_IMPORTS = [
  'MarketPulseWidget',
  'WatchlistWidget',
  'TopMoversWidget',
  'NewsFeedWidget',
  'FearGreedWidget',
  'EventTicker',
];

describe('홈 레이아웃 — 핵심 위젯 누락 방지', () => {
  for (const name of REQUIRED_IMPORTS) {
    test(`${name} import 존재`, () => {
      expect(homeIndex).toContain(name);
    });
  }
});
