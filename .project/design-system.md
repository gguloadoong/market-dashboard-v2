# 디자인 시스템 문서

> 담당: 최유나 (Staff Product Designer)
> 마지막 업데이트: 2026-03-17

---

## 색상 토큰

```
상승:     #F04452    배경: #FFF0F1    (한국식 빨강 — 절대 변경 금지)
하락:     #1764ED    배경: #EDF4FF    (한국식 파랑 — 절대 변경 금지)
중립:     #8B95A1

Primary:  #191F28    (텍스트 주요)
Secondary:#6B7684    (텍스트 보조)
Tertiary: #B0B8C1    (텍스트 부가)

Surface:  #F8F9FA    (앱 배경)
Card:     #FFFFFF    border: #E5E8EB  radius: 16px (rounded-2xl)
Hover:    #F7F8FA
Active:   #F2F4F6
Divider:  #F2F4F6
```

> **주의:** 한국 사용자는 빨강=상승, 파랑=하락이 몸에 배어있음.
> 이 토큰을 바꾸면 인지 오류가 발생함. 협상 불가.

---

## 마켓 배지 팔레트

```
KR (국내):  bg #FFF0F0  color #F04452
US (미장):  bg #EDF4FF  color #3182F6
COIN (코인): bg #FFF4E6  color #FF9500
HOT:        bg #FFF0F1  color #F04452  (animate-pulse)
```

---

## 타이포그래피

```
Title:    16-18px / font-bold    (종목명, 섹션 헤더)
Body:     14px    / font-semibold (가격, 주요 수치)
Label:    13px    / font-medium   (보조 정보)
Caption:  12px    / font-medium   (태그, 배지, 일반 텍스트)
Micro:    11px    / font-semibold (레이블, 시간, 섹션 제목)
Tiny:     10px    / font-bold     (배지 텍스트)
Nano:      9px    / font-bold     (마켓 배지)

가격/수치: font-mono + tabular-nums (반드시 적용)
```

---

## 여백 체계 (8px 기반)

```
카드 패딩:   px-4 py-3     (16px / 12px)
섹션 간격:   space-y-4     (16px)
인라인 gap:  gap-2 (8px)   gap-3 (12px)   gap-2.5 (10px)
헤더 패딩:   px-4 py-3     섹션 헤더 표준
행 패딩:     px-4 py-2.5   테이블 행 표준
```

---

## 컴포넌트 패턴

### 카드 (SurgeCard 기준)
```
bg-white rounded-2xl border border-[#E5E8EB] shadow-sm
hover:shadow-md hover:border-[#D1D6DB] transition-all
```

### 배지 (등락률)
```
상승: bg-[#FFF0F1] text-[#F04452] px-2 py-1 rounded-md text-[12px] font-bold tabular-nums
하락: bg-[#F0F4FF] text-[#1764ED] (동일)
중립: bg-[#F2F4F6] text-[#8B95A1] (동일)
```

### 필터 버튼 (활성/비활성)
```
활성:   bg-[#191F28] text-white
비활성: bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]
```

### 섹션 헤더
```
border-b border-[#F2F4F6] px-4 py-3
text-[14px] font-bold text-[#191F28]
```

---

## 접근성 (WCAG AA — 협상 불가)

- 등락률 색상 대비: 4.5:1 이상 확인됨 (#F04452 on white: 4.5+, #1764ED on white: 7.0+)
- 터치 타겟: 44px 이상 (모바일 기준)
- 관심종목 버튼: 24px (별 버튼) — P0 개선 필요

---

## 스켈레톤 로딩 패턴

```jsx
// 표준 스켈레톤 클래스
"animate-pulse bg-[#F2F4F6] rounded"

// SurgeCard 스켈레톤: w-[152px] rounded-2xl
// HotRow 스켈레톤: 구현됨
// WatchlistTable 스켈레톤: P0 미구현 — 즉시 필요
```

---

## 미해결 디자인 이슈

| 우선순위 | 이슈 | 영향 |
|---------|------|------|
| P0 | WatchlistTable 스켈레톤 없음 | 로딩 시 CLS (레이아웃 흔들림) |
| P1 | 관심종목 별 버튼 터치 타겟 24px → 44px로 확대 필요 | 모바일 접근성 |
| P1 | 급등 이유 컨텍스트 tooltip 디자인 미정 | Job 2 완성에 필요 |
| P2 | 다크모드 토큰 미정의 | 야간 투자자 UX |
