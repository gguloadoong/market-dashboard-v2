---
소유자: 박서연 (FE)
마지막 업데이트: 2026-03-18
출처: CONVENTIONS.md + DEPLOY.md + SECURITY.md 통합
---

# 마켓레이더 기술 스펙

## 기술 스택

| 기술 | 용도 |
|------|------|
| React + Vite | 기반 프레임워크 |
| TailwindCSS | 스타일링 |
| React Query | 데이터 페칭 + 캐싱 + 자동 갱신 |
| Recharts | 스파크라인, 라인 차트 |
| lightweight-charts | 캔들 차트 (TradingView 오픈소스) |
| axios | API 호출 |
| vite-plugin-pwa | PWA 지원 |

## 디렉토리 구조

```
src/
├── components/   # UI 컴포넌트 (PascalCase)
├── hooks/        # 커스텀 훅 (camelCase + use)
├── api/          # API 호출 함수
├── utils/        # 유틸 함수 (camelCase)
├── constants/    # 상수 (UPPER_SNAKE_CASE)
└── state/        # 상태 관리 (whaleBus 등)
```

## 코딩 컨벤션

### 네이밍
| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 파일 | PascalCase | `StockCard.jsx` |
| 훅 파일 | camelCase + use | `useCoinData.js` |
| 유틸 파일 | camelCase | `formatNumber.js` |
| 상수 | UPPER_SNAKE_CASE | `COIN_SYMBOLS` |

### 컴포넌트 규칙
- 한 파일 200줄 이하 (초과 시 분리)
- props는 구조분해할당
- `React.memo`, `useMemo`, `useCallback` 활용
- 주석은 한국어

### 스타일
- TailwindCSS 유틸 클래스만 사용 (인라인 style 지양)
- 상승: `#F04452`, 하락: `#1764ED`, 보합: `#8B95A1`

### API 호출
- 모든 API 호출은 `hooks/` 커스텀 훅에서만
- React Query: `staleTime`, `refetchInterval` 명시
- 실패 시 마지막 정상 데이터 유지 + 에러 핸들링

## 배포

### 로컬 개발
```bash
cd ~/Documents/market-dashboard-v2
npm run dev  # → http://localhost:5173
```

### Vercel 프로덕션
- GitHub 연동 자동 배포 (`git push` → Vercel 빌드)
- URL: https://market-dashboard-v2-mu.vercel.app
- 환경변수: Vercel Dashboard → Settings → Environment Variables

### 환경변수
| 변수 | 설명 | 발급처 |
|------|------|--------|
| `VITE_KIS_APP_KEY` | 한국투자증권 앱 키 | securities.koreainvestment.com |
| `VITE_KIS_APP_SECRET` | 한국투자증권 시크릿 | 동일 |
| `VITE_NEWS_API_KEY` | 뉴스 API 키 | newsapi.org |

## 보안
- API 키는 `.env`에만 저장, 코드 하드코딩 금지
- `.env`는 `.gitignore`에 등록
- `import.meta.env.VITE_XXX` 형식으로 접근
- 프로덕션에서 스택 트레이스 노출 금지

## 성능 전략
- React Query 캐싱 (코인 10초, 주식 30초, 뉴스 5분)
- `useMemo`/`useCallback` 메모이제이션
- dynamic import로 번들 최적화
- PWA precache로 정적 에셋 오프라인 지원

## 커밋 컨벤션
```
feat: 종목 카드 스파크라인 추가
fix: 급상승 배너 클릭 이동 버그 수정
style: 카드 hover 애니메이션 개선
refactor: useCoinData 훅 분리
```
