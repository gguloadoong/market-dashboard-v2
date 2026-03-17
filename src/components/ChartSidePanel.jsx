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
import { fetchCandles, PERIOD_CONFIG } from '../api/chart';
import { useStockNews } from '../hooks/useNewsQuery';
import InvestorFlow from './InvestorFlow';
import { findRelatedItems } from '../data/relatedAssets';

// 로고 URL
function getLogoUrl(item) {
  if (item.image) return item.image;
  if (item.market === 'us')
    return `https://assets.parqet.com/logos/symbol/${item.symbol}?format=svg`;
  if (item.market === 'kr')
    return `https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`;
  return null;
}
const PALETTE = ['#3182F6','#F04452','#FF9500','#2AC769','#8B5CF6','#EC4899','#14B8A6','#F59E0B'];
function colorFor(s = '') {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}
function PanelLogo({ item }) {
  const [err, setErr] = useState(false);
  const url = getLogoUrl(item);
  if (url && !err) {
    return (
      <img src={url} alt={item.symbol} onError={() => setErr(true)}
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

// 타임프레임 버튼 목록 (PERIOD_CONFIG 키와 일치)
const PERIODS = ['5분', '15분', '30분', '1시간', '4시간', '일', '주', '월'];
const PERIOD_LABEL = {
  '5분': '5분', '15분': '15분', '30분': '30분',
  '1시간': '1H', '4시간': '4H',
  '일': '일봉', '주': '주봉', '월': '월봉',
};

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

function getPct(item) {
  return item.id ? (item.change24h ?? 0) : (item.changePct ?? 0);
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ─── 차트 컴포넌트 ──────────────────────────────────────────
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
          // lightweight-charts v5 API: addSeries(SeriesType, options)
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

// ─── 메인 패널 ──────────────────────────────────────────────
export default function ChartSidePanel({ item, krwRate = 1466, onClose, onRelatedClick, allData = {} }) {
  const [period,  setPeriod]  = useState('5분');
  const [candles, setCandles] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartType, setChartType] = useState('candle');

  // 종목 키워드 기반 관련 뉴스 — React Query 캐시 활용
  const { news: relatedNews, isLoading: newsLoading } = useStockNews(item?.symbol || item?.id, item?.name || item?.nameEn);

  // 연관 종목 — relatedAssets 매핑 기반, allData에서 현재 가격 조회
  const relatedItems = useMemo(() => {
    if (!item) return [];
    const { krStocks = [], usStocks = [], coins = [], etfs = [] } = allData;
    const dataMap = {};
    for (const s of krStocks) { dataMap[s.symbol] = s; if (s.name) dataMap[s.name] = s; }
    for (const s of usStocks) dataMap[s.symbol] = s;
    for (const e of etfs)     dataMap[e.symbol] = e;
    for (const c of coins)    dataMap[c.symbol?.toUpperCase()] = c;
    // RELATED_ASSETS 키는 대문자 심볼 (BTC, NVDA, 005930 등) 기준
    const sym = item.symbol?.toUpperCase() || item.id?.toUpperCase() || '';
    return findRelatedItems(sym, dataMap);
  }, [item?.symbol, item?.name, allData]);

  const pct    = item ? getPct(item) : 0;
  const isUp   = pct > 0;
  const isDown = pct < 0;

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
        // 스파크라인 데이터로 fallback
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

  const isCoin = !!item.id;
  const high   = isCoin ? item.high24h : item.high52w;
  const low    = isCoin ? item.low24h  : item.low52w;
  const volume = isCoin ? item.volume24h : item.volume;
  const mcap   = item.marketCap;

  const infoRows = [
    { label: '거래량',   value: volume ? `${(volume / 1e6).toFixed(2)}M` : '—' },
    { label: '시가총액', value: mcap ? (mcap >= 1e12 ? `${(mcap / 1e12).toFixed(1)}조` : `${(mcap / 1e8).toFixed(0)}억`) : '—' },
    isCoin
      ? { label: '24h 고가', value: high ? `$${Number(high).toFixed(2)}` : '—' }
      : { label: '52주 고가', value: high ? fmtKrwPrice({ ...item, price: high }, krwRate) : '—' },
    isCoin
      ? { label: '24h 저가', value: low ? `$${Number(low).toFixed(2)}` : '—' }
      : { label: '52주 저가', value: low ? fmtKrwPrice({ ...item, price: low }, krwRate) : '—' },
    item.sector && { label: '섹터', value: item.sector },
    item.nameEn && { label: '영문명', value: item.nameEn },
  ].filter(Boolean);

  return (
    <>
      {/* 딤 오버레이 — z-[150] (sticky 헤더/배너 모두 위) */}
      <div
        className="fixed inset-0 bg-black/30"
        style={{ zIndex: 150 }}
        onClick={onClose}
      />

      {/* 패널 — full-height, 헤더·배너 위로 슬라이드 */}
      <div
        className="fixed top-0 right-0 bg-white shadow-2xl flex flex-col"
        style={{
          zIndex: 151,
          width: 'min(620px, 48vw)',
          height: '100vh',
          borderLeft: '1px solid #E5E8EB',
          animation: 'slideInRight 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* 헤더 */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-[#F2F4F6]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <PanelLogo item={item} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[18px] font-bold text-[#191F28] truncate">{item.name}</span>
                  <span className="text-[11px] font-bold text-[#8B95A1] font-mono bg-[#F2F4F6] px-2 py-0.5 rounded-full flex-shrink-0">{item.symbol}</span>
                  {item.sector && <span className="text-[10px] text-[#B0B8C1] bg-[#F2F4F6] px-1.5 py-0.5 rounded-full flex-shrink-0">{item.sector}</span>}
                </div>
                <div className="flex items-baseline gap-2.5 mt-1">
                  <span className="text-[24px] font-bold text-[#191F28] tabular-nums font-mono">
                    {fmtKrwPrice(item, krwRate)}
                  </span>
                  <span className={`text-[15px] font-semibold tabular-nums font-mono ${isUp ? 'text-[#F04452]' : isDown ? 'text-[#1764ED]' : 'text-[#6B7684]'}`}>
                    {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
                  </span>
                </div>
                {item.market === 'us' && item.price && (
                  <div className="text-[12px] text-[#B0B8C1] mt-0.5 font-mono">${fmt(item.price, 2)} USD</div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[#B0B8C1] hover:text-[#191F28] flex-shrink-0 p-1.5 rounded-lg hover:bg-[#F2F4F6] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto">
          {/* 기간 + 차트 타입 */}
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex gap-1.5">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                    period === p ? 'bg-[#191F28] text-white' : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]'
                  }`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {['candle', 'line'].map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                    chartType === t ? 'bg-[#191F28] text-white' : 'bg-[#F2F4F6] text-[#6B7684]'
                  }`}
                >
                  {t === 'candle' ? '캔들' : '라인'}
                </button>
              ))}
            </div>
          </div>

          {/* 차트 — ErrorBoundary로 크래시 격리 */}
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

          {/* 종목 정보 그리드 */}
          <div className="mx-5 mb-4 border border-[#F2F4F6] rounded-xl overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-[#F2F4F6]">
              {infoRows.map((row, i) => (
                <div
                  key={row.label}
                  className={`px-4 py-3 ${i % 4 < 2 ? 'bg-[#F8F9FA]' : 'bg-white'}`}
                >
                  <div className="text-[11px] text-[#B0B8C1] mb-0.5">{row.label}</div>
                  <div className="text-[14px] font-semibold text-[#191F28] tabular-nums font-mono">{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 투자자 동향 — 국내 종목만 */}
          {item.market === 'kr' && <InvestorFlow symbol={item.symbol} />}

          {/* 연관 종목 — ETF, 동일 섹터, 상관 자산 */}
          {relatedItems.length > 0 && (
            <div className="border-t border-[#F2F4F6] mt-2 pt-4 px-5 mb-2">
              <div className="text-[11px] font-semibold text-[#B0B8C1] uppercase tracking-wide mb-3">
                연관 종목
              </div>
              <div className="grid grid-cols-2 gap-2">
                {relatedItems.map(({ ticker, item: rel, isEtf }) => {
                  const relPct = rel ? (rel.change24h ?? rel.changePct ?? 0) : null;
                  const relColor = relPct == null ? '#B0B8C1'
                    : relPct > 0 ? '#F04452'
                    : relPct < 0 ? '#1764ED'
                    : '#8B95A1';
                  const relPrice = rel
                    ? rel.priceKrw
                      ? `₩${fmt(Math.round(rel.priceKrw))}`
                      : rel.price
                      ? `₩${fmt(Math.round((rel.price ?? 0) * (rel.market === 'us' ? krwRate : 1)))}`
                      : null
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
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          {isEtf && (
                            <span className="text-[10px] font-bold text-[#3182F6] bg-[#EDF4FF] px-1 rounded">ETF</span>
                          )}
                          <span className="text-[12px] font-bold text-[#191F28] font-mono">{ticker}</span>
                        </div>
                        {relPrice && (
                          <div className="text-[10px] text-[#8B95A1] font-mono tabular-nums">{relPrice}</div>
                        )}
                        {!rel && (
                          <div className="text-[10px] text-[#C9CDD2]">미추적</div>
                        )}
                      </div>
                      {relPct != null && (
                        <span className="text-[12px] font-bold tabular-nums font-mono" style={{ color: relColor }}>
                          {relPct > 0 ? '▲' : relPct < 0 ? '▼' : ''}{Math.abs(relPct).toFixed(2)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 관련 뉴스 — useStockNews 훅으로 React Query 캐시 활용, 결과 없으면 안내 메시지 표시 */}
          <div className="border-t border-[#F2F4F6] mt-4 pt-4 mb-6">
            <div className="text-[11px] font-semibold text-[#B0B8C1] uppercase tracking-wide px-4 mb-2">
              관련 뉴스
            </div>
            {newsLoading ? (
              <div className="px-4 py-4 text-center text-[12px] text-[#B0B8C1]">
                뉴스 로딩 중...
              </div>
            ) : relatedNews.length === 0 ? (
              <div className="px-4 py-4 text-center text-[12px] text-[#B0B8C1]">
                관련 뉴스 없음
              </div>
            ) : (
              relatedNews.map((n, i) => (
                <a
                  key={n.id || i}
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-2.5 hover:bg-[#FAFBFC] border-b border-[#F2F4F6] last:border-0"
                >
                  {/* 시간만 표시 — 언론사명은 제목에서 이미 제거됨 (cleanTitle 처리) */}
                  {n.timeAgo && (
                    <span className="text-[10px] text-[#B0B8C1] mb-0.5 block">{n.timeAgo}</span>
                  )}
                  <div className="text-[12px] text-[#191F28] font-medium leading-snug line-clamp-2">
                    {n.title}
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
