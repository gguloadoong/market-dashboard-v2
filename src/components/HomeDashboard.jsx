// 홈 대시보드 — 레이아웃 순서
// ① 인사이트 카드 (뉴스 시그널 기반 — 최상단)
// ② 시장 맥락 바 (지수)
// ③ 급등/급락 TOP10 + 탭 필터 [전체|KR|US|COIN] (인라인 관련종목 chip)
// ④ 코인 요약 카드 (공포탐욕+도미넌스+김프) — 접기/펼치기

import { useState, useMemo, memo, useCallback } from 'react';
import MarketSummaryCards from './MarketSummaryCards';
import { useAllNewsQuery } from '../hooks/useNewsQuery';
import { findRelatedItems, MARKET_FLAG, RELATION_TYPES } from '../data/relatedAssets';
import { extractNewsSignals } from '../utils/newsSignal';

// ─── 종목 키워드 매핑 테이블 ──────────────────────────────────
const COIN_KEYWORDS = {
  BTC:  ['bitcoin', 'btc'],
  ETH:  ['ethereum', 'eth', 'ether'],
  XRP:  ['ripple', 'xrp'],
  SOL:  ['solana', 'sol'],
  ADA:  ['cardano', 'ada'],
  DOGE: ['dogecoin', 'doge'],
  BNB:  ['binance', 'bnb'],
  AVAX: ['avalanche', 'avax'],
  DOT:  ['polkadot'],
  LINK: ['chainlink'],
  PEPE: ['pepe'],
  SUI:  ['sui'],
  APT:  ['aptos'],
  NEAR: ['near protocol', 'near'],
  ATOM: ['cosmos', 'atom'],
  TON:  ['toncoin', 'ton'],
  UNI:  ['uniswap'],
  OP:   ['optimism'],
  ARB:  ['arbitrum'],
  INJ:  ['injective'],
};

const KR_EN_KEYWORDS = {
  '삼성전자':      ['samsung'],
  'SK하이닉스':   ['sk hynix', 'hynix'],
  'LG에너지솔루션': ['lg energy'],
  '현대차':       ['hyundai'],
  '카카오':       ['kakao'],
  '네이버':       ['naver'],
  '셀트리온':     ['celltrion'],
  'POSCO홀딩스':  ['posco'],
  'LG화학':       ['lg chem'],
  '기아':         ['kia'],
  '현대모비스':   ['mobis'],
  'KB금융':       ['kb financial', 'kb'],
  '신한지주':     ['shinhan'],
  '에코프로비엠': ['ecopro'],
  '삼성바이오로직스': ['samsung biologics', 'samsung bio'],
};

// 종목 → 검색 키워드 배열 반환
function buildKeywords(item) {
  const sym  = (item.symbol || '').toLowerCase();
  const name = (item.name   || '').toLowerCase();
  const keys = new Set([sym, name].filter(k => k.length >= 2));
  if (item._market === 'COIN') {
    (COIN_KEYWORDS[item.symbol?.toUpperCase()] || []).forEach(k => keys.add(k));
  }
  if (item._market === 'KR') {
    (KR_EN_KEYWORDS[item.name] || []).forEach(k => keys.add(k));
  }
  return [...keys];
}

// 무버 → 관련 뉴스 1건 반환
function findRelatedNews(mover, allNews) {
  const kws = buildKeywords(mover);
  return allNews.find(n => {
    const text = `${n.title} ${n.summary || ''}`.toLowerCase();
    return kws.some(kw => text.includes(kw));
  }) || null;
}

// 숫자 포맷 유틸
function fmt(n, d = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ─── 시장 배지 팔레트 ─────────────────────────────────────────
const MARKET_BADGE = {
  KR:   { bg: '#FFF0F0', color: '#F04452' },
  US:   { bg: '#EDF4FF', color: '#3182F6' },
  COIN: { bg: '#FFF4E6', color: '#FF9500' },
};

// 관계 타입별 배지 색상
const TYPE_BADGE = {
  etf:    { bg: '#EDF4FF', color: '#3182F6', label: 'ETF' },
  stock:  { bg: '#F5F0FF', color: '#8B5CF6', label: '주식' },
  coin:   { bg: '#FFF4E6', color: '#FF9500', label: '코인' },
  sector: { bg: '#F0FFF6', color: '#2AC769', label: '섹터' },
  index:  { bg: '#F2F4F6', color: '#8B95A1', label: '지수' },
};

// ─── BLOCK 1: 지수 미니 칩 ───────────────────────────────────
const IndexMiniChip = memo(function IndexMiniChip({ idx }) {
  const isUp   = (idx.changePct ?? 0) > 0;
  const isDown = (idx.changePct ?? 0) < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const flag   = { KOSPI: '🇰🇷', KOSDAQ: '🇰🇷', SPX: '🇺🇸', NDX: '🇺🇸', DJI: '🇺🇸', DXY: '🌐' }[idx.id] || '';

  return (
    <div className="flex-shrink-0 bg-white rounded-xl px-3 py-2.5 flex items-center gap-2.5 border border-[#F2F4F6] shadow-sm">
      <span className="text-[13px]">{flag}</span>
      <div>
        <div className="flex items-center gap-1 mb-0.5">
          <div className="text-[10px] text-[#8B95A1] font-semibold leading-none">{idx.name}</div>
          {idx.isDelayed && (
            <span className="text-[9px] text-[#B0B8C1] bg-[#F2F4F6] px-1 rounded">지연</span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[14px] font-bold text-[#191F28] tabular-nums font-mono">
            {fmt(idx.value, 2)}
          </span>
          <span className="text-[11px] font-bold tabular-nums font-mono" style={{ color }}>
            {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(idx.changePct ?? 0).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
});

// ─── 관련종목 인라인 chip ─────────────────────────────────────
// 항상 표시 (호버 불필요), 최대 3개 + "+N" 버튼
const RelatedChips = memo(function RelatedChips({ relatedItems, onChipClick }) {
  const [showAll, setShowAll] = useState(false);

  if (!relatedItems.length) return null;

  const MAX_VISIBLE = 3;
  const visible = showAll ? relatedItems : relatedItems.slice(0, MAX_VISIBLE);
  const hiddenCount = relatedItems.length - MAX_VISIBLE;

  return (
    <div className="flex flex-wrap items-center gap-1 pl-[52px] pb-2 pt-0.5">
      <span className="text-[9px] text-[#C9CDD2] font-semibold tracking-wide flex-shrink-0">연관</span>
      {visible.map(({ ticker, type, market, item: rel }) => {
        const relPct    = rel ? (rel.change24h ?? rel.changePct ?? 0) : null;
        const relColor  = relPct == null ? '#B0B8C1' : relPct > 0 ? '#F04452' : relPct < 0 ? '#1764ED' : '#8B95A1';
        const flag      = MARKET_FLAG[market] || '';
        const arrow     = relPct == null ? '' : relPct > 0 ? '↑' : relPct < 0 ? '↓' : '';

        return (
          <button
            key={ticker}
            onClick={e => { e.stopPropagation(); rel && onChipClick?.(rel); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-[6px] border border-[#E5E8EB] transition-colors hover:border-[#B0B8C1]"
            style={{ background: '#F2F4F6', fontSize: '11px' }}
            title={`${ticker} · ${TYPE_BADGE[type]?.label || type}`}
          >
            <span className="text-[9px] leading-none">{flag}</span>
            <span className="font-bold text-[#191F28] font-mono leading-none">{ticker}</span>
            {relPct != null && (
              <span className="font-bold tabular-nums font-mono leading-none" style={{ color: relColor, fontSize: '10px' }}>
                {arrow}{Math.abs(relPct).toFixed(1)}%
              </span>
            )}
          </button>
        );
      })}

      {!showAll && hiddenCount > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setShowAll(true); }}
          className="px-1.5 py-0.5 rounded-[6px] bg-[#F2F4F6] border border-[#E5E8EB] text-[10px] font-bold text-[#8B95A1] hover:text-[#4E5968] transition-colors"
        >
          +{hiddenCount}
        </button>
      )}
    </div>
  );
});

// ─── BLOCK 2: 통합 무버 행 (인라인 chip 포함) ────────────────
const MoverRow = memo(function MoverRow({ item, rank, krwRate, onClick, dataMap = {} }) {
  const pct    = item._market === 'COIN' ? (item.change24h ?? 0) : (item.changePct ?? 0);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';

  const logoUrls = item.image ? [item.image]
    : item._market === 'US'   ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`]
    : item._market === 'KR'   ? [`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);

  const PALETTE = ['#3182F6','#F04452','#FF9500','#2AC769','#8B5CF6','#EC4899','#14B8A6','#F59E0B'];
  const bg = PALETTE[(item.symbol || '').split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % PALETTE.length] || '#8B95A1';

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
    ? `₩${fmt(item.price)}`
    : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  const badge = MARKET_BADGE[item._market] || { bg: '#F2F4F6', color: '#8B95A1' };

  // 연관 종목 — relatedAssets 새 구조에서 조회 (useMemo로 re-render 최소화)
  const relatedKey = item.name || item.symbol;
  const relatedItems = useMemo(
    () => findRelatedItems(relatedKey, dataMap),
    [relatedKey, dataMap]
  );

  const handleChipClick = useCallback((rel) => onClick?.(rel), [onClick]);

  return (
    <div className="rounded-xl transition-colors hover:bg-[#FAFBFC]">
      {/* 메인 행 */}
      <div
        onClick={() => onClick?.(item)}
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
      >
        {/* 순위 */}
        <span className="text-[12px] text-[#C9CDD2] w-4 text-center tabular-nums flex-shrink-0">{rank}</span>

        {/* 로고 */}
        {logoIdx < logoUrls.length ? (
          <img
            src={logoUrls[logoIdx]}
            alt={item.symbol}
            onError={() => setLogoIdx(i => i + 1)}
            className="w-7 h-7 rounded-full object-contain bg-white border border-[#F2F4F6] flex-shrink-0 p-0.5"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{ background: bg }}
          >
            {(item.symbol || '?').slice(0, 2).toUpperCase()}
          </div>
        )}

        {/* 종목명 + 심볼 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-[#191F28] truncate">{item.name}</span>
            <span
              className="flex-shrink-0 text-[9px] font-bold px-1 py-0.5 rounded"
              style={{ background: badge.bg, color: badge.color }}
            >
              {item._market}
            </span>
          </div>
          <div className="text-[10px] font-bold text-[#8B95A1] font-mono">{item.symbol}</div>
        </div>

        {/* 등락률 + 가격 */}
        <div className="text-right flex-shrink-0">
          <div className="text-[13px] font-bold tabular-nums font-mono" style={{ color }}>
            {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
          </div>
          <div className="text-[11px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
        </div>
      </div>

      {/* 인라인 관련종목 chip — 항상 표시 (호버 불필요) */}
      {relatedItems.length > 0 && (
        <RelatedChips
          relatedItems={relatedItems}
          onChipClick={handleChipClick}
        />
      )}
    </div>
  );
});

// ─── BLOCK 3: 인사이트 카드 (뉴스 시그널 기반) ──────────────
const InsightCard = memo(function InsightCard({ mover, news, onMoverClick }) {
  const pct    = mover._market === 'COIN' ? (mover.change24h ?? 0) : (mover.changePct ?? 0);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const badge  = MARKET_BADGE[mover._market] || { bg: '#F2F4F6', color: '#8B95A1' };
  const signals = useMemo(() => extractNewsSignals(news.title), [news.title]);
  const bgColor = isUp ? '#FFFAFA' : '#F4F8FF';
  const borderColor = isUp ? '#FFE8E8' : '#DCE9FF';

  return (
    <a
      href={news.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border p-3 hover:opacity-90 transition-opacity"
      style={{ background: bgColor, borderColor }}
    >
      {/* 상단: 종목 + 등락률 + 시장 배지 + 시그널 태그 + 시간 */}
      <div className="flex items-center gap-1.5 mb-2">
        <button
          onClick={e => { e.preventDefault(); onMoverClick?.(mover); }}
          className="flex items-center gap-1 hover:opacity-75 flex-shrink-0"
        >
          <span className="text-[12px] font-bold text-[#191F28]">{mover.name}</span>
          <span className="text-[12px] font-bold font-mono tabular-nums" style={{ color }}>
            {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
          </span>
        </button>
        <span
          className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
          style={{ background: badge.bg, color: badge.color }}
        >
          {mover._market}
        </span>
        {signals.map(sig => (
          <span
            key={sig.tag}
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: sig.bg, color: sig.color }}
          >
            {sig.tag}
          </span>
        ))}
        <span className="text-[10px] text-[#B0B8C1] flex-shrink-0 ml-auto">{news.timeAgo}</span>
      </div>
      {/* 뉴스 헤드라인 */}
      <div className="text-[12px] text-[#4E5968] leading-snug line-clamp-2">
        {news.title}
      </div>
    </a>
  );
});

// ─── 스켈레톤 플레이스홀더 ───────────────────────────────────
function SkeletonRow({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="flex items-center gap-3 px-3 py-2.5">
      <div className="w-4 h-3 bg-[#F2F4F6] rounded animate-pulse flex-shrink-0" />
      <div className="w-7 h-7 rounded-full bg-[#F2F4F6] animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="h-3 bg-[#F2F4F6] rounded w-24 animate-pulse" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-12 animate-pulse" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-3 bg-[#F2F4F6] rounded w-16 animate-pulse" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-14 animate-pulse" />
      </div>
    </div>
  ));
}

function SkeletonInsightCard({ count = 3 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="rounded-xl border border-[#F2F4F6] p-3 space-y-2 animate-pulse">
      <div className="flex items-center gap-1.5">
        <div className="h-3 bg-[#F2F4F6] rounded w-20" />
        <div className="h-3 bg-[#F2F4F6] rounded w-10" />
        <div className="h-3 bg-[#F2F4F6] rounded w-6 ml-auto" />
      </div>
      <div className="h-3 bg-[#F2F4F6] rounded" />
      <div className="h-3 bg-[#F2F4F6] rounded w-4/5" />
    </div>
  ));
}

// ─── 인사이트 mock 데이터 (뉴스-무버 매칭 실패 시 fallback) ─
// 뉴스 로딩 실패 또는 매칭 없을 때 항상 3개 표시
const MOCK_INSIGHTS = [
  {
    id: 'mock-btc',
    moverName: 'BTC', moverMarket: 'COIN', moverPct: null,
    title: '비트코인 급등세 — 업비트 거래량 급증, 고래 매수 신호 포착',
    timeAgo: '',
    link: 'https://coindesk.com',
    isMock: true,
    signal: '강세',
    desc: '업비트 거래량 급증, 고래 매수 신호',
  },
  {
    id: 'mock-nvda',
    moverName: 'NVDA', moverMarket: 'US', moverPct: null,
    title: 'NVDA AI 모멘텀 지속 — AI 반도체 수요 지속 확대로 실적 전망 상향',
    timeAgo: '',
    link: 'https://finance.yahoo.com',
    isMock: true,
    signal: 'AI',
    desc: 'AI 반도체 수요 지속 확대',
  },
  {
    id: 'mock-samsung',
    moverName: '삼성전자', moverMarket: 'KR', moverPct: null,
    title: '삼성전자 외국인 순매수 — HBM4 납품 기대감에 외국인 3일 연속 순매수',
    timeAgo: '',
    link: 'https://news.naver.com',
    isMock: true,
    signal: '강세',
    desc: '외국인 3일 연속 순매수',
  },
];

// mock 인사이트 카드 (데이터 미확보 시 표시)
const MockInsightCard = memo(function MockInsightCard({ mock }) {
  const badgePalette = { COIN: { bg: '#FFF4E6', color: '#FF9500' }, US: { bg: '#EDF4FF', color: '#3182F6' }, KR: { bg: '#FFF0F0', color: '#F04452' } };
  const badge = badgePalette[mock.moverMarket] || { bg: '#F2F4F6', color: '#8B95A1' };
  return (
    <a
      href={mock.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-[#F2F4F6] p-3 hover:opacity-90 transition-opacity bg-[#FAFBFC]"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[12px] font-bold text-[#191F28]">{mock.moverName}</span>
        <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: badge.bg, color: badge.color }}>
          {mock.moverMarket}
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#F2F4F6] text-[#8B95A1] flex-shrink-0">예시</span>
      </div>
      <div className="text-[12px] text-[#4E5968] leading-snug line-clamp-2">{mock.title}</div>
    </a>
  );
});

// ─── 급등/급락 탭 필터 버튼 ─────────────────────────────────
const MOVER_FILTERS = [
  { id: 'all',  label: '전체' },
  { id: 'KR',   label: 'KR'   },
  { id: 'US',   label: 'US'   },
  { id: 'COIN', label: 'COIN' },
];

// ─── 메인 홈 대시보드 ────────────────────────────────────────
export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [],
  krwRate = 1466, onItemClick,
}) {
  const { data: allNews = [], isLoading: newsLoading } = useAllNewsQuery();

  const [moverFilter, setMoverFilter] = useState('all');
  const [coinCardOpen, setCoinCardOpen] = useState(true);

  // 전체 시장 데이터 맵 (연관 종목 조회용)
  const dataMap = useMemo(() => {
    const map = {};
    for (const s of krStocks)  map[s.symbol] = s;
    for (const s of usStocks)  map[s.symbol] = s;
    for (const c of coins)     map[c.symbol?.toUpperCase()] = c;
    for (const s of krStocks)  if (s.name) map[s.name] = s;
    return map;
  }, [krStocks, usStocks, coins]);

  // 전 시장 통합 급등/급락
  const { gainers, losers } = useMemo(() => {
    const krItems   = krStocks.map(s => ({ ...s, _market: 'KR',   _pct: s.changePct ?? 0 }));
    const usItems   = usStocks.map(s => ({ ...s, _market: 'US',   _pct: s.changePct ?? 0 }));
    const coinItems = coins.map(c => ({ ...c, _market: 'COIN', _pct: c.change24h ?? 0 }));
    const all = [...krItems, ...usItems, ...coinItems];

    const gainers = all.filter(i => i._pct > 0).sort((a, b) => b._pct - a._pct).slice(0, 10);
    const losers  = all.filter(i => i._pct < 0).sort((a, b) => a._pct - b._pct).slice(0, 10);

    return { gainers, losers };
  }, [krStocks, usStocks, coins]);

  const filteredGainers = useMemo(
    () => moverFilter === 'all' ? gainers : gainers.filter(i => i._market === moverFilter),
    [gainers, moverFilter]
  );
  const filteredLosers = useMemo(
    () => moverFilter === 'all' ? losers : losers.filter(i => i._market === moverFilter),
    [losers, moverFilter]
  );

  // 인사이트용 급등/급락 합산
  const topMovers = useMemo(() => [...gainers, ...losers], [gainers, losers]);

  // 인사이트: 무버 + 뉴스 매칭 (최대 4개)
  const insights = useMemo(() => {
    if (!allNews.length || !topMovers.length) return [];
    return topMovers
      .map(mover => ({ mover, news: findRelatedNews(mover, allNews) }))
      .filter(({ news }) => news !== null)
      .slice(0, 4);
  }, [topMovers, allNews]);

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0;

  return (
    <div className="space-y-3">
      {/* 상단: 날짜 + 실시간 표시 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#191F28]">지금 핫한 것</h2>
          <p className="text-[12px] text-[#8B95A1] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-[#F2F4F6]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
          <span className="text-[11px] text-[#6B7684] font-medium">실시간 업데이트</span>
        </div>
      </div>

      {/* ① 인사이트 카드 — 최상단 배치 (항상 표시: 로딩/실데이터/mock) */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
          <span className="text-[14px]">💡</span>
          <span className="text-[14px] font-bold text-[#191F28]">인사이트</span>
          {!newsLoading && insights.length === 0 && (
            <span className="text-[10px] text-[#B0B8C1] bg-[#F2F4F6] px-1.5 py-0.5 rounded ml-1">뉴스 로드 중</span>
          )}
          <span className="text-[11px] text-[#B0B8C1] ml-auto">급등종목 관련 뉴스</span>
        </div>
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* 로딩 중: 스켈레톤 */}
          {newsLoading && <SkeletonInsightCard count={4} />}
          {/* 실제 인사이트 */}
          {!newsLoading && insights.map(({ mover, news }) => (
            <InsightCard
              key={`insight-${mover._market}-${mover.id || mover.symbol}`}
              mover={mover}
              news={news}
              onMoverClick={onItemClick}
            />
          ))}
          {/* 뉴스 매칭 없을 때 mock 카드 표시 (데이터 로딩 전까지) */}
          {!newsLoading && insights.length === 0 && MOCK_INSIGHTS.map(mock => (
            <MockInsightCard key={mock.id} mock={mock} />
          ))}
        </div>
      </div>

      {/* ② 시장 맥락 바 (지수 미니칩) */}
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-[#8B95A1]">시장 지수</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {indices.length > 0
          ? indices.map(idx => <IndexMiniChip key={idx.id} idx={idx} />)
          : [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex-shrink-0 bg-white rounded-xl px-3 py-2.5 w-36 h-12 animate-pulse border border-[#F2F4F6]" />
          ))
        }
      </div>

      {/* ③ 급등/급락 TOP10 + 탭 필터 + 인라인 관련종목 chip */}
      <div className="flex items-center gap-1.5">
        {MOVER_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setMoverFilter(f.id)}
            className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${
              moverFilter === f.id
                ? 'bg-[#191F28] text-white'
                : 'bg-[#F2F4F6] text-[#6B7684] hover:bg-[#E5E8EB]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 급등 섹션 */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#FFFAFA' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[14px] font-bold text-[#F04452]">🔴 급등 TOP 10</span>
            <span className="text-[11px] text-[#B0B8C1] ml-auto">
              {moverFilter === 'all' ? '국내·해외·코인' : moverFilter}
            </span>
          </div>
          {!hasData && <SkeletonRow count={5} />}
          {hasData && filteredGainers.length === 0 && (
            <div className="text-center py-6 text-[13px] text-[#B0B8C1]">해당 종목 없음</div>
          )}
          {hasData && filteredGainers.map((item, i) => (
            <MoverRow
              key={`gainer-${item._market}-${item.id || item.symbol}`}
              item={item}
              rank={i + 1}
              krwRate={krwRate}
              onClick={onItemClick}
              dataMap={dataMap}
            />
          ))}
        </div>

        {/* 급락 섹션 */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#F4F8FF' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[14px] font-bold text-[#1764ED]">🔵 급락 TOP 10</span>
            <span className="text-[11px] text-[#B0B8C1] ml-auto">
              {moverFilter === 'all' ? '국내·해외·코인' : moverFilter}
            </span>
          </div>
          {!hasData && <SkeletonRow count={5} />}
          {hasData && filteredLosers.length === 0 && (
            <div className="text-center py-6 text-[13px] text-[#B0B8C1]">해당 종목 없음</div>
          )}
          {hasData && filteredLosers.map((item, i) => (
            <MoverRow
              key={`loser-${item._market}-${item.id || item.symbol}`}
              item={item}
              rank={i + 1}
              krwRate={krwRate}
              onClick={onItemClick}
              dataMap={dataMap}
            />
          ))}
        </div>
      </div>

      {/* ④ 코인 요약 카드 — 접기/펼치기 토글 */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <button
          onClick={() => setCoinCardOpen(prev => !prev)}
          className="w-full flex items-center gap-2 px-4 py-3.5 border-b border-[#F2F4F6] hover:bg-[#FAFBFC] transition-colors"
        >
          <span className="text-[15px]">🪙</span>
          <span className="text-[14px] font-bold text-[#191F28]">코인 시장 요약</span>
          <span className="text-[11px] text-[#B0B8C1] ml-auto mr-1">공포탐욕 · 도미넌스 · 김프</span>
          <span className="text-[12px] text-[#8B95A1]">{coinCardOpen ? '▲' : '▼'}</span>
        </button>
        {coinCardOpen && (
          <div className="p-4">
            <MarketSummaryCards coins={coins} krwRate={krwRate} />
          </div>
        )}
      </div>
    </div>
  );
}
