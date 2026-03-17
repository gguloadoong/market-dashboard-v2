// 경제 이벤트 캘린더 — FOMC, CPI, 실업률 등 주요 이벤트 타임라인
// 이번 주 / 다음 주 이벤트 표시
const EVENTS_2026 = [
  // FOMC (Federal Open Market Committee)
  { date: '2026-01-28', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-03-18', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-04-29', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-06-10', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-07-29', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-09-16', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-10-28', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },
  { date: '2026-12-09', type: 'FOMC', label: 'FOMC 금리 결정', importance: 'high' },

  // CPI (US Consumer Price Index) — 매월 두 번째 화요일 전후
  { date: '2026-01-14', type: 'CPI',  label: 'CPI 발표 (12월)', importance: 'high' },
  { date: '2026-02-11', type: 'CPI',  label: 'CPI 발표 (1월)',  importance: 'high' },
  { date: '2026-03-11', type: 'CPI',  label: 'CPI 발표 (2월)',  importance: 'high' },
  { date: '2026-04-10', type: 'CPI',  label: 'CPI 발표 (3월)',  importance: 'high' },
  { date: '2026-05-13', type: 'CPI',  label: 'CPI 발표 (4월)',  importance: 'high' },
  { date: '2026-06-10', type: 'CPI',  label: 'CPI 발표 (5월)',  importance: 'high' },
  { date: '2026-07-15', type: 'CPI',  label: 'CPI 발표 (6월)',  importance: 'high' },
  { date: '2026-08-12', type: 'CPI',  label: 'CPI 발표 (7월)',  importance: 'high' },
  { date: '2026-09-10', type: 'CPI',  label: 'CPI 발표 (8월)',  importance: 'high' },
  { date: '2026-10-14', type: 'CPI',  label: 'CPI 발표 (9월)',  importance: 'high' },
  { date: '2026-11-11', type: 'CPI',  label: 'CPI 발표 (10월)', importance: 'high' },
  { date: '2026-12-09', type: 'CPI',  label: 'CPI 발표 (11월)', importance: 'high' },

  // NFP (Non-Farm Payrolls) — 매월 첫 번째 금요일
  { date: '2026-01-02', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-02-06', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-03-06', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-04-03', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-05-01', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-06-05', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },
  { date: '2026-07-02', type: 'NFP',  label: '비농업 고용지표', importance: 'high' },

  // PCE (Personal Consumption Expenditures) — 연준 선호 인플레 지표
  { date: '2026-01-30', type: 'PCE',  label: 'PCE 물가지수',   importance: 'medium' },
  { date: '2026-02-27', type: 'PCE',  label: 'PCE 물가지수',   importance: 'medium' },
  { date: '2026-03-27', type: 'PCE',  label: 'PCE 물가지수',   importance: 'medium' },
  { date: '2026-04-30', type: 'PCE',  label: 'PCE 물가지수',   importance: 'medium' },
  { date: '2026-05-29', type: 'PCE',  label: 'PCE 물가지수',   importance: 'medium' },

  // GDP
  { date: '2026-01-29', type: 'GDP',  label: 'GDP 1차 발표 (Q4 2025)', importance: 'medium' },
  { date: '2026-04-29', type: 'GDP',  label: 'GDP 1차 발표 (Q1 2026)', importance: 'medium' },
  { date: '2026-07-30', type: 'GDP',  label: 'GDP 1차 발표 (Q2 2026)', importance: 'medium' },

  // 금통위 (한국은행 기준금리 결정)
  { date: '2026-01-16', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-02-25', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-04-16', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-05-28', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-07-16', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
  { date: '2026-08-27', type: '금통위', label: '한국은행 기준금리 결정', importance: 'high' },
];

const TYPE_CONFIG = {
  FOMC:  { color: '#F04452', bg: '#FFF0F0', emoji: '🏦' },
  CPI:   { color: '#3182F6', bg: '#EDF4FF', emoji: '📊' },
  NFP:   { color: '#FF9500', bg: '#FFF4E6', emoji: '👷' },
  PCE:   { color: '#8B5CF6', bg: '#F5F0FF', emoji: '💳' },
  GDP:   { color: '#2AC769', bg: '#F0FFF6', emoji: '📈' },
  금통위: { color: '#F04452', bg: '#FFF0F0', emoji: '🏛' },
};

function getUpcomingEvents(daysAhead = 14) {
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return EVENTS_2026
    .filter(e => {
      const d = new Date(e.date);
      return d >= now && d <= future;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function formatEventDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const diffMs = d - today;
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const day = ['일','월','화','수','목','금','토'][d.getDay()];

  if (diffDays === 0) return { date: `오늘 (${mm}/${dd})`, urgency: 'today' };
  if (diffDays === 1) return { date: `내일 (${mm}/${dd})`, urgency: 'tomorrow' };
  if (diffDays <= 3)  return { date: `${diffDays}일 후 (${mm}/${dd})`, urgency: 'soon' };
  return { date: `${mm}/${dd} (${day})`, urgency: 'normal' };
}

export default function EventCalendar() {
  const events = getUpcomingEvents(14);
  if (!events.length) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-[#191F28]">경제 이벤트</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F2F4F6] text-[#6B7684]">
            14일 이내
          </span>
        </div>
        <span className="text-[11px] text-[#B0B8C1]">시장 변동성 주의</span>
      </div>

      {/* 이벤트 목록 */}
      {events.map((event, i) => {
        const config = TYPE_CONFIG[event.type] || { color: '#8B95A1', bg: '#F2F4F6', emoji: '📅' };
        const { date, urgency } = formatEventDate(event.date);
        const urgencyStyle = urgency === 'today'    ? 'bg-[#FFF0F0] border-[#FFD0D0]'
                           : urgency === 'tomorrow' ? 'bg-[#FFF8E1] border-[#FFE082]'
                           : urgency === 'soon'     ? 'bg-[#F0FFF6] border-[#B8EDD0]'
                           : '';

        return (
          <div
            key={`${event.date}-${event.type}-${i}`}
            className={`flex items-center gap-3 px-4 py-3 border-b border-[#F2F4F6] last:border-0 ${urgencyStyle}`}
          >
            {/* 이모지 */}
            <span className="text-[18px] flex-shrink-0">{config.emoji}</span>

            {/* 내용 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: config.bg, color: config.color }}
                >
                  {event.type}
                </span>
                {event.importance === 'high' && (
                  <span className="text-[10px] text-[#F04452]">⚡</span>
                )}
              </div>
              <div className="text-[13px] font-medium text-[#191F28] mt-0.5">{event.label}</div>
            </div>

            {/* 날짜 */}
            <div className={`text-[12px] font-semibold flex-shrink-0 tabular-nums ${
              urgency === 'today'    ? 'text-[#F04452]'
            : urgency === 'tomorrow'? 'text-[#FF9500]'
            : urgency === 'soon'    ? 'text-[#2AC769]'
            : 'text-[#8B95A1]'
            }`}>
              {date}
            </div>
          </div>
        );
      })}
    </div>
  );
}
