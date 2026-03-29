// 종목 상세 차트 사이드 패널 — lightweight-charts 사용
import { useState, useEffect, useRef, useMemo, Component } from 'react';
import { createChart, CandlestickSeries, LineSeries, AreaSeries, HistogramSeries, ColorType, CrosshairMode } from 'lightweight-charts';

// 차트 크래시 격리 — 흰 화면 방지
class ChartErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err) { console.warn('[ChartPanel] 렌더 오류:', err.message); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-[300px] flex flex-col items-center justify-center bg-[#FAFBFC] rounded-xl gap-2">
          <span className="text-[22px]">📉</span>
          <span className="text-[13px] text-[#B0B8C1]">차트를 불러올 수 없습니다</span>
          <button onClick={() => this.setState({ hasError: false })}
            className="text-[12px] text-[#3182F6] mt-1">다시 시도</button>
        </div>
      );
    }
    return this.props.children;
  }
}
// 네이티브 탭 컴포넌트 (CDS TabbedChips 대체)
function SimpleTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-1 bg-[#F2F4F6] rounded-lg p-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 text-[12px] font-medium py-1 px-2 rounded-md transition-colors ${
            activeTab === tab.id
              ? 'bg-white text-[#191F28] shadow-sm'
              : 'text-[#8B95A1] hover:text-[#191F28]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
import { fetchCandles, PERIOD_CONFIG } from '../api/chart';
import { fetchInvestorDataSafe, fetchInvestorTrendSafe, formatNetAmt } from '../api/investor';
import { useStockAndRelatedNews, useStockDirectNews } from '../hooks/useNewsQuery';
import { findRelatedItems } from '../data/relatedAssets';
import { detectNewsSectors, findStocksBySectors } from '../utils/newsTopicMap';

// ─── 로고 URL + 아바타 색상 (home/utils.js 통합본 사용) ──────
import { getLogoUrls, getAvatarBg as colorFor } from './home/utils';

function PanelLogo({ item }) {
  const urls = getLogoUrls(item);
  const [logoIdx, setLogoIdx] = useState(0);
  if (logoIdx < urls.length) {
    return (
      <img src={urls[logoIdx]} alt={item.symbol} onError={() => setLogoIdx(i => i + 1)}
        className="w-10 h-10 rounded-xl object-contain bg-white border border-[#F2F4F6] flex-shrink-0 p-1"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
      style={{ background: colorFor(item.symbol) }}>
      {(item.symbol || '?').slice(0, 2).toUpperCase()}
    </div>
  );
}

// ─── 시장 배지 컴포넌트 ────────────────────────────────────────
function MarketBadge({ item }) {
  if (item.id) {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF3E0] text-[#E65100] flex-shrink-0">
        코인
      </span>
    );
  }
  if (item.market === 'kr') {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3F2FD] text-[#1565C0] flex-shrink-0">
        국장
      </span>
    );
  }
  if (item.market === 'us') {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex-shrink-0">
        미장
      </span>
    );
  }
  return null;
}

// ─── 타임프레임 탭 (PERIOD_CONFIG 키와 일치) ─────────────────────
const PERIOD_TABS = [
  { id: '5분',   label: '5분' },
  { id: '15분',  label: '15분' },
  { id: '30분',  label: '30분' },
  { id: '1시간', label: '1H' },
  { id: '4시간', label: '4H' },
  { id: '일',    label: '1D' },
  { id: '주',    label: '1W' },
  { id: '월',    label: '1M' },
];

// ─── 숫자 포맷 헬퍼 ───────────────────────────────────────────
function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtKrwPrice(item, krwRate) {
  if (item.id) {
    const p = item.priceKrw || item.priceUsd * krwRate;
    if (!p) return '—';
    if (p < 1) return `₩${p.toFixed(6)}`;
    if (p < 100) return `₩${fmt(p, 2)}`;
    return `₩${fmt(Math.round(p))}`;
  }
  if (item.market === 'kr') return `₩${fmt(item.price)}`;
  if (item.market === 'us') return `₩${fmt(Math.round(item.price * krwRate))}`;
  return `₩${fmt(item.price)}`;
}

// 절대 가격 (원화 기준)
function getAbsPrice(item, krwRate) {
  if (item.id) return item.priceKrw || (item.priceUsd ?? 0) * krwRate;
  if (item.market === 'kr') return item.price ?? 0;
  if (item.market === 'us') return (item.price ?? 0) * krwRate;
  return item.price ?? 0;
}

function getPct(item) {
  return item.id ? (item.change24h ?? 0) : (item.changePct ?? 0);
}

function _timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ─── 시가총액 포맷 (조/억 단위) ──────────────────────────────────
function fmtMcap(v, isCoin = false, _krwRate = 1466) {
  if (!v) return '—';
  // 코인: USD 기준 → 조(T), 억(B)
  if (isCoin) {
    if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
    return `$${fmt(v)}`;
  }
  // 미국: USD 기준
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
  // 국내: 원화 기준
  const krw = v;
  if (krw >= 1e12) return `${(krw / 1e12).toFixed(1)}조`;
  if (krw >= 1e8)  return `${Math.round(krw / 1e8)}억`;
  return `₩${fmt(krw)}`;
}

// 거래량 포맷
function fmtVolume(v, isCoin = false, market = 'kr') {
  if (!v) return '—';
  if (isCoin) {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    return `$${fmt(v)}`;
  }
  if (market === 'us') {
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M주`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K주`;
    return `${fmt(v)}주`;
  }
  // 국내: 거래량(주 단위)
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억주`;
  if (v >= 1e4) return `${Math.round(v / 1e4)}만주`;
  return `${fmt(v)}주`;
}

// 현재가 52주 위치 퍼센트 (0~100)
function get52wPct(price, low, high) {
  if (!price || !low || !high || high === low) return null;
  return Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
}

// ─── 52주 고저가 슬라이더 ────────────────────────────────────────
function RangeMeter({ low, high, current, label52Low = '52주저가', label52High = '52주고가' }) {
  const pct = get52wPct(current, low, high);
  if (pct === null) return null;

  const posLabel = pct < 30 ? '하단' : pct < 70 ? '중간' : '상단';
  const posColor = pct < 30 ? '#1764ED' : pct < 70 ? '#FF9500' : '#F04452';

  return (
    <div className="px-5 pt-1 pb-4">
      {/* 레인지 바 */}
      <div className="relative h-1.5 bg-[#E5E8EB] rounded-full mt-2 mb-1">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all"
          style={{ left: `${pct}%`, transform: 'translateX(-50%) translateY(-50%)', background: posColor }}
        />
      </div>
      {/* 레이블 */}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-[#B0B8C1] font-mono tabular-nums">{label52Low}</span>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: posColor }}>
          {posLabel} {pct.toFixed(0)}%
        </span>
        <span className="text-[10px] text-[#B0B8C1] font-mono tabular-nums">{label52High}</span>
      </div>
    </div>
  );
}

// ─── 투자자 동향 인사이트 문구 생성 ──────────────────────────────
function genInvestorInsight(data) {
  if (!data) return null;
  const foreign = data.foreign?.netAmt ?? 0;
  const inst    = data.institution?.netAmt ?? 0;

  if (foreign > 0 && inst > 0) return { text: '외인·기관 동반 순매수', color: '#F04452', badge: '강세' };
  if (foreign > 0 && inst < 0) return { text: '외인 순매수, 기관 순매도', color: '#FF9500', badge: '혼조' };
  if (foreign < 0 && inst > 0) return { text: '기관 순매수, 외인 순매도', color: '#8B5CF6', badge: '혼조' };
  if (foreign < 0 && inst < 0) return { text: '외인·기관 동반 순매도', color: '#1764ED', badge: '약세' };
  return null;
}

// ─── 뉴스 시그널 라벨 (간단 버전) ────────────────────────────────
function extractSignalLabel(title = '') {
  if (/급등|상승|돌파|신고가|매수|호재/.test(title)) return { label: '호재', color: '#F04452', bg: '#FFF0F1' };
  if (/급락|하락|하한가|매도|악재|리스크/.test(title)) return { label: '악재', color: '#1764ED', bg: '#EDF4FF' };
  if (/실적|매출|영업이익|어닝/.test(title))            return { label: '실적', color: '#8B5CF6', bg: '#F5F3FF' };
  if (/배당|주주|자사주/.test(title))                   return { label: '배당', color: '#2AC769', bg: '#F0FFF4' };
  if (/규제|법안|SEC|금감원/.test(title))               return { label: '규제', color: '#FF9500', bg: '#FFF8E7' };
  return null;
}

// ─── 차트 컴포넌트 ──────────────────────────────────────────────
function LightweightChart({ candles, loading, type, isIntraday = false }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !candles || candles.length === 0) return;

    // 기존 차트 제거
    if (chartRef.current) { try { chartRef.current.remove(); } catch {} chartRef.current = null; }

    // clientWidth=0 방지: ResizeObserver로 실제 렌더 후 초기화
    let chart = null;
    const init = (width) => {
      if (chartRef.current || width < 10) return;
      try {
        chart = createChart(el, {
          layout: { background: { type: ColorType.Solid, color: '#FFFFFF' }, textColor: '#B0B8C1', fontSize: 11 },
          grid:   { vertLines: { color: '#F2F4F6' }, horzLines: { color: '#F2F4F6' } },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: '#E5E8EB' },
          // 분봉/시봉: 시간 표시, 일봉+: 날짜만
          timeScale: { borderColor: '#E5E8EB', timeVisible: isIntraday, secondsVisible: false },
          width,
          height: 300,
        });
        chartRef.current = chart;

        if (type === 'candle') {
          // lightweight-charts v5 API
          const s = chart.addSeries(CandlestickSeries, { upColor:'#F04452', downColor:'#1764ED', borderVisible:false, wickUpColor:'#F04452', wickDownColor:'#1764ED' });
          s.setData(candles);
        } else {
          const up = candles.length > 1 && candles[candles.length-1].close >= candles[0].close;
          const col = up ? '#F04452' : '#1764ED';
          chart.addSeries(LineSeries, { color: col, lineWidth: 2 }).setData(candles.map(c => ({ time: c.time, value: c.close })));
          chart.addSeries(AreaSeries, { topColor: col+'22', bottomColor: col+'00', lineColor:'transparent', lineWidth:0 })
               .setData(candles.map(c => ({ time: c.time, value: c.close })));
        }

        if (candles[0]?.volume != null) {
          const vs = chart.addSeries(HistogramSeries, { color:'#E5E8EB', priceFormat:{type:'volume'}, priceScaleId:'volume' });
          chart.priceScale('volume').applyOptions({ scaleMargins:{ top:0.85, bottom:0 } });
          vs.setData(candles.map(c => ({ time:c.time, value:c.volume??0, color:(c.close??0)>=(c.open??0)?'#F0445222':'#1764ED22' })));
        }
        chart.timeScale().fitContent();
      } catch(e) { console.warn('[LightweightChart] 초기화 실패:', e.message); }
    };

    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (chartRef.current) { try { chartRef.current.applyOptions({ width: w }); } catch {} }
      else { init(w); }
    });
    ro.observe(el);

    // 즉시 시도 (이미 width 있을 경우)
    init(el.clientWidth);

    return () => {
      ro.disconnect();
      if (chartRef.current) { try { chartRef.current.remove(); } catch {} chartRef.current = null; }
    };
  }, [candles, type]);

  if (loading) {
    return (
      <div ref={containerRef} className="w-full h-[300px] flex items-center justify-center bg-[#FAFBFC] rounded-xl">
        <div className="text-[13px] text-[#B0B8C1]">차트 로딩 중...</div>
      </div>
    );
  }
  if (!candles || candles.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-[300px] flex items-center justify-center bg-[#FAFBFC] rounded-xl">
        <div className="text-[13px] text-[#B0B8C1]">차트 데이터 없음</div>
      </div>
    );
  }
  return <div ref={containerRef} className="w-full" />;
}

// ─── 핵심 지표 그리드 ─────────────────────────────────────────────
function MetricsGrid({ item, krwRate }) {
  const isCoin = !!item.id;
  const high   = isCoin ? item.high24h : item.high52w;
  const low    = isCoin ? item.low24h  : item.low52w;
  const curPx  = isCoin ? (item.priceKrw || (item.priceUsd ?? 0) * krwRate) : item.price;
  const pct52  = get52wPct(curPx, low, high);

  const posLabel = pct52 == null ? '—'
    : pct52 < 30 ? `하단 ${pct52.toFixed(0)}%`
    : pct52 < 70 ? `중간 ${pct52.toFixed(0)}%`
    : `상단 ${pct52.toFixed(0)}%`;
  const posColor = pct52 == null ? '#B0B8C1'
    : pct52 < 30 ? '#1764ED'
    : pct52 < 70 ? '#FF9500'
    : '#F04452';

  // 지표 목록 — null이면 숨김
  const cells = [];

  // 시가총액
  const mcapStr = fmtMcap(item.marketCap, isCoin, krwRate);
  if (mcapStr !== '—') cells.push({ label: '시가총액', value: mcapStr, mono: true });

  // 거래량
  const volStr = fmtVolume(
    isCoin ? item.volume24h : item.volume,
    isCoin,
    item.market
  );
  if (volStr !== '—') cells.push({ label: isCoin ? '24h 거래량' : '거래량', value: volStr, mono: true });

  // P/E (미국주식)
  if (item.market === 'us' && item.pe) cells.push({ label: 'P/E', value: `${Number(item.pe).toFixed(1)}x`, mono: true });

  // 코인 상장 거래소 수
  if (isCoin && item.exchanges?.length > 0) {
    cells.push({ label: '거래소', value: `${item.exchanges.length}개`, mono: false });
  }

  // 52주 고가
  const highLabel = isCoin ? '24h 고가' : '52주 고가';
  const highVal = high
    ? isCoin
      ? `$${Number(high).toFixed(2)}`
      : `₩${fmt(Math.round(high))}`
    : '—';
  if (highVal !== '—') cells.push({ label: highLabel, value: highVal, mono: true });

  // 52주 저가
  const lowLabel = isCoin ? '24h 저가' : '52주 저가';
  const lowVal = low
    ? isCoin
      ? `$${Number(low).toFixed(2)}`
      : `₩${fmt(Math.round(low))}`
    : '—';
  if (lowVal !== '—') cells.push({ label: lowLabel, value: lowVal, mono: true });

  // 현재가 위치
  if (pct52 !== null) {
    cells.push({ label: '현재가 위치', value: posLabel, color: posColor, mono: true });
  }

  // 섹터
  if (item.sector) cells.push({ label: '섹터', value: item.sector, mono: false });

  // 영문명 (미국 주식)
  if (item.nameEn) cells.push({ label: '영문명', value: item.nameEn, mono: false });

  if (!cells.length) return null;

  return (
    <div className="mx-5 mb-4 border border-[#F2F4F6] rounded-xl overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-[#F2F4F6]">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`px-3 py-2.5 ${i % 3 === 0 ? 'col-span-1' : ''} ${
              Math.floor(i / 3) % 2 === 0 ? 'bg-[#FAFBFC]' : 'bg-white'
            }`}
          >
            <div className="text-[10px] text-[#B0B8C1] mb-0.5 leading-none">{cell.label}</div>
            <div
              className={`text-[13px] font-semibold leading-snug truncate ${cell.mono ? 'font-mono tabular-nums' : ''}`}
              style={{ color: cell.color || '#191F28' }}
            >
              {cell.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 투자자 행별 색상 ──────────────────────────────────────────
const INV_ROWS = [
  { key: 'foreign',     label: '외인', posColor: '#F04452', negColor: '#1764ED' },
  { key: 'institution', label: '기관', posColor: '#F04452', negColor: '#1764ED' },
  { key: 'individual',  label: '개인', posColor: '#F04452', negColor: '#1764ED' },
];

// ─── 강화된 투자자 동향 섹션 (국내주식 전용) — 오늘 + 5일 테이블 + 30일 바 차트 ──
function InvestorFlowEnhanced({ symbol }) {
  const [data,    setData]    = useState(null);
  const [trend,   setTrend]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState('today'); // 'today' | '5d' | '30d'

  useEffect(() => {
    if (!symbol || !/^\d{6}$/.test(symbol)) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      fetchInvestorDataSafe(symbol),
      fetchInvestorTrendSafe(symbol, 30), // 30일 전체 — 5일 슬라이스도 여기서
    ]).then(([d, t]) => {
      setData(d);
      setTrend(Array.isArray(t) ? t : []);
    }).finally(() => setLoading(false));
  }, [symbol]);

  if (!symbol || !/^\d{6}$/.test(symbol)) return null;

  const insight = genInvestorInsight(data);

  if (loading) {
    return (
      <div className="mx-5 mb-4 border border-[#F2F4F6] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F2F4F6]">
          <div className="h-3 bg-[#F2F4F6] rounded w-24 animate-pulse" />
        </div>
        {[1,2,3].map(i => (
          <div key={i} className="px-4 py-2.5 flex items-center gap-3">
            <div className="h-3 bg-[#F2F4F6] rounded w-8 animate-pulse" />
            <div className="flex-1 h-1.5 bg-[#F2F4F6] rounded-full animate-pulse" />
            <div className="h-3 bg-[#F2F4F6] rounded w-14 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  // 게이지 바 너비 계산
  const vals = INV_ROWS.map(r => Math.abs(data[r.key]?.netAmt ?? 0));
  const maxVal = Math.max(...vals, 1);
  const bars = vals.map(v => (v / maxVal) * 100);

  return (
    <div className="mx-5 mb-4 border border-[#F2F4F6] rounded-xl overflow-hidden">
      {/* 헤더 + 탭 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F2F4F6] bg-[#FAFBFC]">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#191F28]">👥 투자자 동향</span>
          {insight && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: insight.color + '22', color: insight.color }}>
              {insight.badge}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[['today','오늘'], ['5d','5일'], ['30d','30일']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                tab === key ? 'bg-[#3182F6] text-white' : 'text-[#B0B8C1] hover:text-[#4E5968]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'today' ? (
        /* 오늘 외인/기관/개인 게이지 */
        <div className="divide-y divide-[#F2F4F6]">
          {INV_ROWS.map((row, i) => {
            const inv   = data[row.key];
            const net   = inv?.netAmt ?? 0;
            const color = net > 0 ? row.posColor : net < 0 ? row.negColor : '#B0B8C1';
            return (
              <div key={row.key} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[12px] text-[#6B7684] w-8 flex-shrink-0 font-medium">{row.label}</span>
                <div className="flex-1 h-1.5 bg-[#F2F4F6] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${bars[i]}%`, background: color }} />
                </div>
                <span className="text-[12px] font-bold tabular-nums font-mono w-16 text-right flex-shrink-0"
                  style={{ color }}>
                  {inv?.netAmtFormatted ?? '—'}
                </span>
              </div>
            );
          })}
        </div>
      ) : tab === '5d' ? (
        /* 5일 경향성 테이블 */
        trend.length === 0 ? (
          <div className="px-4 py-4 text-center text-[12px] text-[#B0B8C1]">경향성 데이터 없음</div>
        ) : (
          <div>
            <div className="flex items-center px-4 py-1.5 bg-[#FAFBFC] border-b border-[#F2F4F6]">
              <span className="text-[10px] text-[#B0B8C1] w-16 flex-shrink-0">날짜</span>
              <span className="text-[10px] text-[#B0B8C1] flex-1 text-center">외인</span>
              <span className="text-[10px] text-[#B0B8C1] flex-1 text-center">기관</span>
              <span className="text-[10px] text-[#B0B8C1] flex-1 text-center">개인</span>
            </div>
            {trend.slice(0, 5).map((row, i) => {
              const fColor = row.foreign     > 0 ? '#F04452' : row.foreign     < 0 ? '#1764ED' : '#B0B8C1';
              const iColor = row.institution > 0 ? '#F04452' : row.institution < 0 ? '#1764ED' : '#B0B8C1';
              const pColor = row.individual  > 0 ? '#F04452' : row.individual  < 0 ? '#1764ED' : '#B0B8C1';
              const dateStr = row.date ? `${row.date.slice(4,6)}/${row.date.slice(6,8)}` : `${i + 1}일전`;
              return (
                <div key={row.date || i} className="flex items-center px-4 py-2 border-b border-[#F2F4F6] last:border-0">
                  <span className="text-[11px] text-[#8B95A1] w-16 flex-shrink-0">{dateStr}</span>
                  <span className="text-[11px] font-bold font-mono flex-1 text-center" style={{ color: fColor }}>
                    {row.foreignFmt || formatNetAmt(row.foreign)}
                  </span>
                  <span className="text-[11px] font-bold font-mono flex-1 text-center" style={{ color: iColor }}>
                    {row.institutionFmt || formatNetAmt(row.institution)}
                  </span>
                  <span className="text-[11px] font-bold font-mono flex-1 text-center" style={{ color: pColor }}>
                    {row.individualFmt || formatNetAmt(row.individual)}
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* 30일 외인/기관 바 차트 */
        trend.length === 0 ? (
          <div className="px-4 py-4 text-center text-[12px] text-[#B0B8C1]">경향성 데이터 없음</div>
        ) : (() => {
          const rows30 = [...trend].reverse(); // 날짜 오름차순
          const maxAbs = Math.max(...rows30.flatMap(r => [Math.abs(r.foreign), Math.abs(r.institution)]), 1);
          return (
            <div className="px-3 pt-3 pb-2">
              {/* 범례 — 색상은 방향(순매수/순매도)을 의미, 투자 주체 아님 */}
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center gap-1 text-[10px] text-[#8B95A1]">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#F04452' }} />순매수
                </span>
                <span className="flex items-center gap-1 text-[10px] text-[#8B95A1]">
                  <span className="w-2 h-2 rounded-sm inline-block" style={{ background: '#1764ED' }} />순매도
                </span>
                <span className="text-[10px] text-[#B0B8C1]">위=외인 · 아래=기관</span>
              </div>
              {/* 바 차트 */}
              <div className="space-y-1.5">
                {rows30.map((row, i) => {
                  const dateStr = row.date ? `${row.date.slice(4,6)}/${row.date.slice(6,8)}` : '';
                  const fPct = (Math.abs(row.foreign) / maxAbs) * 100;
                  const iPct = (Math.abs(row.institution) / maxAbs) * 100;
                  const fColor = row.foreign > 0 ? '#F04452' : '#1764ED';
                  const iColor = row.institution > 0 ? '#F04452' : '#1764ED';
                  return (
                    <div key={row.date || i} className="flex items-center gap-1.5">
                      <span className="text-[9px] text-[#B0B8C1] w-10 flex-shrink-0 text-right">{dateStr}</span>
                      <div className="flex-1 flex flex-col gap-0.5">
                        {/* 외인 */}
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-2 bg-[#F2F4F6] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${fPct}%`, background: fColor, opacity: 0.85 }} />
                          </div>
                          <span className="text-[9px] font-mono w-12 text-right flex-shrink-0" style={{ color: fColor }}>
                            {row.foreignFmt}
                          </span>
                        </div>
                        {/* 기관 */}
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-2 bg-[#F2F4F6] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${iPct}%`, background: iColor, opacity: 0.85 }} />
                          </div>
                          <span className="text-[9px] font-mono w-12 text-right flex-shrink-0" style={{ color: iColor }}>
                            {row.institutionFmt}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}

// ─── 메인 패널 ──────────────────────────────────────────────────
export default function ChartSidePanel({ item, krwRate = 1466, onClose, onRelatedClick, allData = {}, newsContext = null }) {
  const [period,    setPeriod]    = useState('5분');
  const [candles,   setCandles]   = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartType, setChartType] = useState('candle');
  const [showMoreNews, setShowMoreNews] = useState(false); // "더 보기" 상태
  const [isFav, setIsFav]         = useState(false);       // 관심 종목 토글 (UI 전용)

  // 뉴스 맥락 기반 관련종목 — newsContext가 있으면 키워드→섹터→종목 추출
  const newsBasedItems = useMemo(() => {
    if (!newsContext) return [];
    const text = `${newsContext.title || ''} ${newsContext.description || newsContext.summary || ''}`;
    const sectors = detectNewsSectors(text);
    if (!sectors.length) return [];
    const { krStocks = [], usStocks = [], coins = [] } = allData;
    const allItems = [...krStocks, ...usStocks, ...coins];
    return findStocksBySectors(sectors, allItems, 5);
  }, [newsContext, allData]);

  // 연관 종목 — relatedAssets 매핑 기반, allData에서 현재 가격 조회 (뉴스 훅보다 먼저)
  // newsContext가 있으면 뉴스 기반 관련종목을 앞에 합산 (중복 제거)
  const relatedItems = useMemo(() => {
    if (!item) return [];
    const { krStocks = [], usStocks = [], coins = [], etfs = [] } = allData;
    const dataMap = {};
    for (const s of krStocks) { dataMap[s.symbol] = s; if (s.name) dataMap[s.name] = s; }
    for (const s of usStocks) dataMap[s.symbol] = s;
    for (const e of etfs)     dataMap[e.symbol] = e;
    for (const c of coins)    dataMap[c.symbol?.toUpperCase()] = c;
    const sym = item.symbol?.toUpperCase() || item.id?.toUpperCase() || '';
    const assetBased = findRelatedItems(sym, dataMap, 8); // 최대 8개

    // 뉴스 기반 관련종목이 있으면 앞에 합산
    if (!newsBasedItems.length) return assetBased;
    const seenKeys = new Set();
    const merged = [];
    // 뉴스 기반 종목 먼저 (현재 보고 있는 종목 제외)
    for (const stock of newsBasedItems) {
      const key = stock.symbol?.toUpperCase() || stock.id?.toUpperCase() || '';
      if (key === sym || seenKeys.has(key)) continue;
      seenKeys.add(key);
      merged.push({ ticker: stock.symbol || stock.id, item: stock, type: 'news', reason: '뉴스 관련' });
    }
    // 기존 relatedAssets 기반 종목 추가 (중복 제거)
    for (const rel of assetBased) {
      const key = rel.ticker?.toUpperCase() || '';
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      merged.push(rel);
    }
    return merged.slice(0, 10);
  }, [item?.symbol, item?.name, allData, newsBasedItems]);

  // 종목 키워드 + 관련종목 기반 관련 뉴스 — 주 종목 → 관련종목 순으로 합산
  const newsMarket = item?.id ? 'COIN' : item?.market === 'kr' ? 'KR' : 'US';
  const { news: relatedNews, isLoading: newsLoading } = useStockAndRelatedNews(
    item?.symbol || item?.id,
    item?.name || item?.nameEn,
    newsMarket,
    relatedItems,
  );
  // 글로벌 캐시 매칭 0건 시 종목명으로 직접 구글뉴스 검색 (fallback)
  const directEnabled = !newsLoading && relatedNews.length === 0;
  const { data: directNews = [], isLoading: directNewsLoading } = useStockDirectNews(
    item?.symbol || item?.id,
    item?.name || item?.nameEn,
    newsMarket,
    directEnabled,
  );
  const finalNews        = relatedNews.length > 0 ? relatedNews : directNews;
  const finalNewsLoading = newsLoading || (directEnabled && directNewsLoading);

  // ETF와 일반종목 분리
  const etfItems     = relatedItems.filter(r => r.isEtf);
  const nonEtfItems  = relatedItems.filter(r => !r.isEtf);

  const pct    = item ? getPct(item) : 0;
  const isUp   = pct > 0;
  const isDown = pct < 0;

  // 현재가 (KRW 기준 숫자)
  const curPriceRaw = item ? getAbsPrice(item, krwRate) : 0;
  // 52주 고저가
  const isCoin = !!item?.id;
  const high52 = isCoin ? item?.high24h : item?.high52w;
  const low52  = isCoin ? item?.low24h  : item?.low52w;

  // 뉴스 표시 개수: showMoreNews ? 10 : 5
  const visibleNews = showMoreNews ? finalNews.slice(0, 10) : finalNews.slice(0, 5);

  // ESC 닫기
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 차트 데이터 로드
  useEffect(() => {
    if (!item) return;
    setChartLoading(true);
    setCandles([]);
    fetchCandles(item, period)
      .then(data => setCandles(data))
      .catch(() => {
        const spark = item.sparkline ?? [];
        const today = new Date();
        const fake  = spark.map((close, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (spark.length - 1 - i));
          return {
            time:  d.toISOString().split('T')[0],
            open:  spark[i - 1] ?? close,
            high:  close * 1.005,
            low:   close * 0.995,
            close,
          };
        });
        setCandles(fake);
      })
      .finally(() => setChartLoading(false));
  }, [item?.symbol, item?.id, period]);

  if (!item) return null;

  return (
    <>
      {/* 딤 오버레이 */}
      <div
        className="fixed inset-0 bg-black/30"
        style={{ zIndex: 150 }}
        onClick={onClose}
      />

      {/* 패널 — full-height 슬라이드 */}
      <div
        className="fixed top-0 right-0 bg-white shadow-2xl flex flex-col w-full sm:w-[min(620px,48vw)]"
        style={{
          zIndex: 151,
          height: '100dvh',
          borderLeft: '1px solid #E5E8EB',
          animation: 'slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* ─── 헤더 ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-[#F2F4F6]">

          {/* 1행: 로고 + 종목명 + 닫기 + 관심 */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <PanelLogo item={item} />
              <div className="min-w-0 flex-1">
                {/* 시장배지 + 심볼 */}
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <MarketBadge item={item} />
                  <span className="text-[18px] font-bold text-[#191F28] truncate leading-tight">
                    {item.name}
                  </span>
                  <span className="text-[11px] font-bold text-[#8B95A1] font-mono bg-[#F2F4F6] px-2 py-0.5 rounded-full flex-shrink-0">
                    {item.symbol}
                  </span>
                </div>

                {/* 현재가 + 등락 */}
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-[22px] font-bold text-[#191F28] tabular-nums font-mono leading-tight">
                    {fmtKrwPrice(item, krwRate)}
                  </span>
                  <span className={`text-[14px] font-semibold tabular-nums font-mono ${isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#6B7684]'}`}>
                    {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
                  </span>
                </div>

                {/* 미국 주식 USD 가격 병기 */}
                {item.market === 'us' && item.price && (
                  <div className="text-[11px] text-[#B0B8C1] font-mono tabular-nums mt-0.5">
                    ${fmt(item.price, 2)} USD
                  </div>
                )}

                {/* 코인 상장 거래소 */}
                {item.id && item.exchanges?.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-[#8B95A1]">거래소</span>
                    {item.exchanges.map(ex => (
                      <span key={ex} className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F2F4F6] text-[#4E5968]">{ex}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 우측 버튼 영역 */}
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              {/* 관심 토글 */}
              <button
                onClick={() => setIsFav(v => !v)}
                className="p-1.5 rounded-lg hover:bg-[#F2F4F6] transition-colors"
                title="관심 종목"
              >
                <span className="text-[18px] leading-none">{isFav ? '★' : '☆'}</span>
              </button>
              {/* 닫기 */}
              <button
                onClick={onClose}
                className="text-[#B0B8C1] hover:text-[#191F28] p-1.5 rounded-lg hover:bg-[#F2F4F6] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* 52주/24h 레인지 슬라이더 */}
          {high52 && low52 && (
            <div className="mt-2 -mx-1">
              <div className="px-1">
                {/* 고저가 숫자 */}
                <div className="flex items-center justify-between text-[10px] text-[#B0B8C1] font-mono tabular-nums mb-1">
                  <span>{isCoin ? '24h저' : '52주저'} {isCoin ? `$${Number(low52).toFixed(2)}` : `₩${fmt(Math.round(low52))}`}</span>
                  <span>{isCoin ? '24h고' : '52주고'} {isCoin ? `$${Number(high52).toFixed(2)}` : `₩${fmt(Math.round(high52))}`}</span>
                </div>
                {/* 레인지 바 */}
                {(() => {
                  const pctPos = get52wPct(curPriceRaw, low52, high52);
                  if (pctPos === null) return null;
                  const dotColor = pctPos < 30 ? '#1764ED' : pctPos < 70 ? '#FF9500' : '#F04452';
                  return (
                    <div className="relative h-1.5 bg-[#E5E8EB] rounded-full">
                      {/* 그라디언트 레인지 채우기 */}
                      <div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{
                          width: `${pctPos}%`,
                          background: `linear-gradient(90deg, #1764ED, ${dotColor})`,
                          opacity: 0.35,
                        }}
                      />
                      {/* 현재가 점 */}
                      <div
                        className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-white shadow"
                        style={{
                          left: `${pctPos}%`,
                          transform: 'translateX(-50%) translateY(-50%)',
                          background: dotColor,
                        }}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ─── "왜 지금?" WHY 배지 ──────────────────────────── */}
          {!finalNewsLoading && finalNews.length > 0 && (
            <div className="mt-3 flex items-start gap-2 bg-[#F8F9FA] rounded-xl px-3 py-2.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#191F28] text-white flex-shrink-0 mt-0.5">
                WHY
              </span>
              <a
                href={finalNews[0].link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-[#4E5968] leading-snug line-clamp-2 hover:text-[#191F28] transition-colors"
              >
                {finalNews[0].title}
                {finalNews[0].timeAgo && (
                  <span className="text-[10px] text-[#B0B8C1] ml-1.5">{finalNews[0].timeAgo}</span>
                )}
              </a>
            </div>
          )}
          {!finalNewsLoading && finalNews.length === 0 && Math.abs(pct) >= 2 && (
            <div className="mt-3 flex items-center gap-2 bg-[#F8F9FA] rounded-xl px-3 py-2.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#E5E8EB] text-[#6B7684] flex-shrink-0">
                WHY
              </span>
              <span className="text-[12px] text-[#8B95A1]">
                {Math.abs(pct).toFixed(1)}% {isUp ? '상승' : '하락'} 중 — 관련 뉴스 분석 중
              </span>
            </div>
          )}
        </div>

        {/* ─── 스크롤 영역 ──────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── 투자자 동향 — 국내주식: 외인/기관/개인, 그 외: 안내 ── */}
          <div className="pt-3">
            {item.market === 'kr'
              ? <InvestorFlowEnhanced symbol={item.symbol} />
              : (
                <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl bg-[#F7F8FA] border border-[#F2F4F6]">
                  <div className="text-[11px] font-semibold text-[#B0B8C1] uppercase tracking-wide mb-1">투자자 동향</div>
                  <div className="text-[12px] text-[#B0B8C1]">외인·기관·개인 순매수 데이터는 국내주식만 제공됩니다</div>
                </div>
              )
            }
          </div>

          {/* ── 타임프레임 + 차트 타입 버튼 ──────────────────────── */}
          <div className="flex items-center justify-between px-4 py-2.5 gap-2">
            {/* 타임프레임 탭 */}
            <div className="flex-shrink-1 min-w-0 overflow-hidden">
              <SimpleTabs tabs={PERIOD_TABS} activeTab={period} onChange={setPeriod} />
            </div>
            {/* 캔들/라인 토글 */}
            <div className="flex gap-1 flex-shrink-0 bg-[#F2F4F6] p-0.5 rounded-xl">
              {['candle', 'line'].map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all ${
                    chartType === t ? 'bg-white text-[#191F28] shadow-sm' : 'text-[#6B7684]'
                  }`}
                >
                  {t === 'candle' ? '캔들' : '라인'}
                </button>
              ))}
            </div>
          </div>

          {/* ── 차트 — ErrorBoundary 크래시 격리 ──────────────────── */}
          <div className="px-4 pb-2">
            <ChartErrorBoundary>
              <LightweightChart
                candles={candles}
                loading={chartLoading}
                type={chartType}
                isIntraday={PERIOD_CONFIG[period]?.isIntraday ?? false}
              />
            </ChartErrorBoundary>
          </div>

          {/* ── 핵심 지표 그리드 ────────────────────────────────── */}
          <MetricsGrid item={item} krwRate={krwRate} />

          {/* ── 연관 ETF / 연관 종목 섹션 ──────────────────────── */}
          {relatedItems.length > 0 && (
            <div className="border-t border-[#F2F4F6] pt-4 pb-2 px-5 mb-1">
              {/* ETF 섹션 — 상단 우선 표시 */}
              {etfItems.length > 0 && (
                <>
                  <div className="text-[11px] font-semibold text-[#B0B8C1] uppercase tracking-wide mb-2">
                    연관 ETF
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {etfItems.map(({ ticker, item: rel, reason }) => {
                      const relPct   = rel ? (rel.change24h ?? rel.changePct ?? 0) : null;
                      const relColor = relPct == null ? '#B0B8C1' : relPct > 0 ? '#F04452' : relPct < 0 ? '#1764ED' : '#8B95A1';
                      const relPrice = rel
                        ? rel.price != null
                          ? `$${fmt(rel.price, 2)}`
                          : null
                        : null;
                      return (
                        <button
                          key={ticker}
                          onClick={() => rel && onRelatedClick?.(rel)}
                          disabled={!rel}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                            rel
                              ? 'border-[#3182F6]/30 bg-[#EDF4FF] hover:border-[#3182F6] hover:shadow-sm cursor-pointer'
                              : 'border-[#F2F4F6] bg-[#FAFBFC] cursor-default opacity-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[10px] font-bold text-[#3182F6] bg-white px-1 rounded flex-shrink-0">ETF</span>
                              <span className="text-[12px] font-bold text-[#191F28] font-mono truncate">{ticker}</span>
                            </div>
                            {relPrice && (
                              <div className="text-[10px] text-[#3182F6] font-mono tabular-nums">{relPrice}</div>
                            )}
                            {reason && (
                              <div className="text-[10px] text-[#8B95A1] truncate mt-0.5">{reason}</div>
                            )}
                          </div>
                          {relPct != null && (
                            <span className="text-[11px] font-bold tabular-nums font-mono flex-shrink-0 ml-1" style={{ color: relColor }}>
                              {relPct > 0 ? '▲' : relPct < 0 ? '▼' : ''}{Math.abs(relPct).toFixed(2)}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* 일반 연관 종목 */}
              {nonEtfItems.length > 0 && (
                <>
                  <div className="text-[11px] font-semibold text-[#B0B8C1] uppercase tracking-wide mb-2">
                    {newsBasedItems.length > 0 ? '이 뉴스 관련 종목' : '연관 종목'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {nonEtfItems.map(({ ticker, item: rel, type, reason: _reason }) => {
                      const relPct   = rel ? (rel.change24h ?? rel.changePct ?? 0) : null;
                      const relColor = relPct == null ? '#B0B8C1' : relPct > 0 ? '#F04452' : relPct < 0 ? '#1764ED' : '#8B95A1';
                      const relPrice = rel
                        ? rel.priceKrw
                          ? `₩${fmt(Math.round(rel.priceKrw))}`
                          : rel.price != null
                          ? `₩${fmt(Math.round((rel.price ?? 0) * (rel.market === 'us' ? krwRate : 1)))}`
                          : null
                        : null;

                      // 타입별 배지
                      const typeBadge = type === 'coin'
                        ? { label: '코인', bg: '#FFF3E0', color: '#E65100' }
                        : type === 'news' || type === 'kr' || type === 'us'
                        ? { label: type === 'news' ? '뉴스' : '주식', bg: type === 'news' ? '#E8F5E9' : '#F2F4F6', color: type === 'news' ? '#2E7D32' : '#4E5968' }
                        : type === 'stock' || type === 'sector'
                        ? { label: '주식', bg: '#F2F4F6', color: '#4E5968' }
                        : null;

                      return (
                        <button
                          key={ticker}
                          onClick={() => rel && onRelatedClick?.(rel)}
                          disabled={!rel}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                            rel
                              ? 'border-[#E5E8EB] hover:border-[#B0B8C1] hover:shadow-sm cursor-pointer bg-white'
                              : 'border-[#F2F4F6] bg-[#FAFBFC] cursor-default opacity-60'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                              {typeBadge && (
                                <span className="text-[10px] font-bold px-1 rounded flex-shrink-0"
                                  style={{ background: typeBadge.bg, color: typeBadge.color }}>
                                  {typeBadge.label}
                                </span>
                              )}
                              <span className="text-[12px] font-bold text-[#191F28] font-mono truncate">{ticker}</span>
                            </div>
                            {(rel?.name || rel?.nameEn) && (
                              <div className="text-[11px] text-[#4E5968] truncate font-medium">{rel.name || rel.nameEn}</div>
                            )}
                            {relPrice && (
                              <div className="text-[10px] text-[#8B95A1] font-mono tabular-nums">{relPrice}</div>
                            )}
                            {!rel && <div className="text-[10px] text-[#C9CDD2]">미추적</div>}
                          </div>
                          {relPct != null && (
                            <span className="text-[12px] font-bold tabular-nums font-mono flex-shrink-0 ml-1" style={{ color: relColor }}>
                              {relPct > 0 ? '▲' : relPct < 0 ? '▼' : ''}{Math.abs(relPct).toFixed(2)}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── 관련 뉴스 — 시그널 라벨 + 더 보기 ──────────────── */}
          <div className="border-t border-[#F2F4F6] mt-3 pt-3 mb-6">
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-[11px] font-semibold text-[#B0B8C1] uppercase tracking-wide">
                관련 뉴스
              </span>
              {finalNews.length > 5 && (
                <button
                  onClick={() => setShowMoreNews(v => !v)}
                  className="text-[11px] text-[#3182F6] font-medium hover:underline"
                >
                  {showMoreNews ? '접기' : `더 보기 (${Math.min(finalNews.length, 10)}건)`}
                </button>
              )}
            </div>
            {finalNewsLoading ? (
              <div className="px-4 py-4 text-center text-[12px] text-[#B0B8C1]">
                뉴스 로딩 중...
              </div>
            ) : finalNews.length === 0 ? (
              <div className="px-4 py-4 text-center text-[12px] text-[#B0B8C1]">
                관련 뉴스 없음
              </div>
            ) : (
              visibleNews.map((n, i) => {
                const signal = extractSignalLabel(n.title);
                return (
                  <a
                    key={n.id || i}
                    href={n.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2.5 hover:bg-[#FAFBFC] border-b border-[#F2F4F6] last:border-0 transition-colors"
                  >
                    {/* 메타 행: 시간 + 시그널 라벨 */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {n.timeAgo && (
                        <span className="text-[10px] text-[#B0B8C1]">{n.timeAgo}</span>
                      )}
                      {signal && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: signal.bg, color: signal.color }}
                        >
                          {signal.label}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[#191F28] font-medium leading-snug line-clamp-2">
                      {n.title}
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      </div>
    </>
  );
}
