# 보안 지침

## API 키 관리 원칙

### 저장 위치
- 모든 키값은 반드시 `.env` 파일에만 저장한다
- `.env.example` 파일에는 키 이름만 적고 값은 비워둔다
- Vercel 배포 시 동일한 환경변수를 Vercel Dashboard에서 설정

### 공유 금지
- `.env` 파일은 절대 GitHub, Slack, 카카오톡 등 어디에도 전송하지 않는다
- 스크린샷에 키값이 보이지 않도록 주의한다

### .gitignore 확인
- 프로젝트 시작 시 반드시 `.gitignore`에 아래 항목 등록 여부 확인
```
.env
.env.local
.env.production
```

### 서버 전용 키 vs 클라이언트 키
- `VITE_` prefix가 **없는** 환경변수는 서버(Vercel Serverless/Edge)에서만 접근 가능
- `VITE_` prefix가 **있는** 환경변수는 클라이언트 번들에 포함되므로 민감 정보 저장 금지

---

## 실수로 키가 노출됐을 때

### 절대 "삭제"만 하면 안 된다
Git에 한 번 올라간 키는 삭제해도 히스토리에 남는다.

### 올바른 대응 순서
1. **즉시 무효화(Revoke)** - 해당 서비스 대시보드에서 키 삭제
2. **새 키 발급** - 새로운 키를 즉시 발급
3. **`.env` 업데이트** - 새 키로 교체
4. **Git 히스토리 정리** - `git filter-branch` 또는 GitHub 지원팀에 문의
5. **Vercel 환경변수 업데이트** - 배포 환경도 새 키로 교체

---

## 이 프로젝트 환경변수 목록

| 변수명 | 필수 | 설명 | 발급처 |
|--------|:----:|------|--------|
| `HANTOO_APP_KEY` | O | 한국투자증권 앱 키 | [apiportal.koreainvestment.com](https://apiportal.koreainvestment.com) |
| `HANTOO_APP_SECRET` | O | 한국투자증권 앱 시크릿 | 동일 |
| `GEMINI_API_KEY` | - | Google Gemini (뉴스 AI 요약) | [aistudio.google.com](https://aistudio.google.com) |
| `WHALE_ALERT_KEY` | - | Whale Alert (고래 추적) | [whale-alert.io](https://whale-alert.io) |
| `KRX_API_KEY` | - | KRX ETF 데이터 | [data.krx.co.kr](https://data.krx.co.kr) |

> **필수 키 없이도 작동**: 코인(Upbit/CoinPaprika/Binance)과 미장(Yahoo/Stooq)은 공개 API 사용. 국내 주식만 한투 키 필요.

### .env 파일 예시
```
HANTOO_APP_KEY=your_hantoo_app_key
HANTOO_APP_SECRET=your_hantoo_app_secret
GEMINI_API_KEY=your_gemini_api_key
WHALE_ALERT_KEY=your_whale_alert_key
KRX_API_KEY=your_krx_api_key
```

---

## 배포 시 체크리스트

- [ ] `.env` 파일이 `.gitignore`에 등록되어 있는가
- [ ] `git status`에 `.env`가 포함되어 있지 않은가
- [ ] 코드에 키값이 직접 적혀있지 않은가
- [ ] Vercel 환경변수에 필수 키값이 입력되어 있는가
- [ ] `VITE_` prefix 키에 민감 정보가 포함되어 있지 않은가
