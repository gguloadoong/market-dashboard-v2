/**
 * 아키텍처 테스트 템플릿
 *
 * 사용법:
 * 1. 이 파일을 복사: `cp architecture.test.template.js src/__tests__/[기능]-layout.test.js`
 * 2. BANNED_IMPORTS, REQUIRED_IMPORTS, TARGET_FILE 수정
 * 3. npm test 실행
 *
 * 이 테스트가 하는 일:
 * - 삭제된 컴포넌트가 실수로 재추가(import)되면 즉시 CI 실패
 * - 핵심 컴포넌트가 누락되면 즉시 CI 실패
 *
 * 효과: 코드 리뷰 없이도 "좀비 컴포넌트 재import" 자동 차단
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── 수정 필요 ────────────────────────────────────────────────────────────────

// 검사할 파일 경로 (index.jsx, App.jsx 등)
const TARGET_FILE = resolve(__dirname, '../components/[기능]/index.jsx');

// 절대 import 금지 컴포넌트 목록
// → CONTRACT.md "영구 삭제된 컴포넌트" 목록과 동기화 유지
const BANNED_IMPORTS = [
  { name: 'DeletedComponent', reason: '삭제 이유 + PR 번호' },
  // { name: 'AnotherDeleted', reason: '...' },
];

// 반드시 import 있어야 하는 핵심 컴포넌트 목록
// → 실수로 삭제되면 즉시 감지
const REQUIRED_IMPORTS = [
  'CoreComponent',
  // 'AnotherCore',
];

// ─── 수정 불필요 ──────────────────────────────────────────────────────────────

const fileContent = readFileSync(TARGET_FILE, 'utf-8');

describe('아키텍처 가드 — 삭제된 컴포넌트 재import 방지', () => {
  for (const { name, reason } of BANNED_IMPORTS) {
    test(`${name} import 금지 (사유: ${reason})`, () => {
      const hasImport =
        fileContent.includes(`import ${name}`) ||
        fileContent.includes(`import { ${name}`) ||
        fileContent.includes(`from './${name}'`) ||
        fileContent.includes(`from "./${name}"`);
      expect(hasImport).toBe(false);
    });
  }
});

describe('아키텍처 가드 — 핵심 컴포넌트 누락 방지', () => {
  for (const name of REQUIRED_IMPORTS) {
    test(`${name} import 존재`, () => {
      expect(fileContent).toContain(name);
    });
  }
});
