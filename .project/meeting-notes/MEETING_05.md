# 팀 회의 — 2026-03-25

**안건:** CDS 전면 적용 + SurgeBanner 개선 + 국장 애프터마켓 + 퍼포먼스 고도화

## 결론

| 순서 | 작업 | 공수 |
|------|------|------|
| 1 | 퍼포먼스: KR WebSocket 20→40, YAHOO_CONCURRENCY 6→10 | 2h |
| 2 | 국장 애프터마켓 API (FHKST03010100 + 시간대 분기) | 4h |
| 3 | SurgeBanner Coinbase ticker 스타일 개선 | 2h |
| 4 | CDS Button/Badge/Text/Chip 전면 교체 | 1~2d |

## 주요 논점
- 애프터마켓: 정규장 중 null 처리 필수
- WebSocket 40개 초과 시 기존 구독 전체 끊김 위험 → 에러핸들링 필수
- CDS 전환: badge-up/badge-down 클래스 전사 마이그레이션 주의
