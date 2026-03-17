// 홈 대시보드 — 전면 재설계
// ① 급등 스포트라이트 (전체/KR/US/코인 탭 필터, 카드 형태)
// ② 시장 지수 요약 바 (compact 스트립)
// ③ 3열 HOT 리스트 (국내/미장/코인 각 TOP5)
// ④ 인사이트 카드 (뉴스 시그널 기반, compact 가로 스크롤)

import { useState, useMemo, memo, useCallback } from 'react';
import MarketSummaryCards from './MarketSummaryCards';
import Sparkline from './Sparkline';
import { useAllNewsQuery } from '../hooks/useNewsQuery';
import { useWatchlist } from '../hooks/useWatchlist';
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

// 종목 등락률 추출 (KR/US/COIN 통합)
function getPct(item) {
  if (item._market === 'COIN') return item.change24h ?? 0;
  return item.changePct ?? 0;
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

// ─── 로고 아바타 (로고 실패 시 컬러 이니셜) ──────────────────
const PALETTE = ['#3182F6','#F04452','#FF9500','#2AC769','#8B5CF6','#EC4899','#14B8A6','#F59E0B'];
function getAvatarBg(symbol) {
  return PALETTE[(symbol || '').split('').reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0) % PALETTE.length] || '#8B95A1';
}

// ─── SECTION 1: 급등 스포트라이트 카드 ───────────────────────
const SurgeCard = memo(function SurgeCard({ item, krwRate, onClick, relatedNews }) {
  const pct   = getPct(item);
  const isUp  = pct > 0;
  const isDown = pct < 0;
  const color = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const badge = MARKET_BADGE[item._market] || { bg: '#F2F4F6', color: '#8B95A1' };

  const logoUrls = item.image ? [item.image]
    : item._market === 'US'   ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`]
    : item._market === 'KR'   ? [`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);
  const bg = getAvatarBg(item.symbol);

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
    ? `₩${fmt(item.price)}`
    : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  const sparkData = item.sparkline ?? [];
  const isHot = Math.abs(pct) >= 3;

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex-shrink-0 w-[152px] bg-white rounded-2xl border cursor-pointer active:scale-[0.98] transition-all hover:shadow-md hover:border-[#D1D6DB]"
      style={{
        borderColor: isHot ? (isUp ? '#FFD6D9' : '#C8DCFF') : '#E5E8EB',
        background: isHot ? (isUp ? '#FFFAFA' : '#F4F8FF') : '#fff',
      }}
    >
      <div className="p-3.5">
        {/* 로고 + 마켓 배지 */}
        <div className="flex items-center justify-between mb-2.5">
          {logoIdx < logoUrls.length ? (
            <img
              src={logoUrls[logoIdx]}
              alt={item.symbol}
              onError={() => setLogoIdx(i => i + 1)}
              className="w-8 h-8 rounded-full object-contain bg-white border border-[#F2F4F6] p-0.5"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ background: bg }}
            >
              {(item.symbol || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ background: badge.bg, color: badge.color }}
          >
            {item._market}
          </span>
        </div>

        {/* 종목명 + 심볼 */}
        <div className="mb-2">
          <div className="text-[13px] font-bold text-[#191F28] truncate leading-tight">{item.name}</div>
          <div className="text-[10px] text-[#8B95A1] font-mono font-semibold mt-0.5">{item.symbol}</div>
        </div>

        {/* 가격 */}
        <div className="text-[13px] font-bold text-[#191F28] tabular-nums font-mono truncate mb-1.5">
          {price}
        </div>

        {/* 등락률 배지 */}
        <div
          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums font-mono mb-2"
          style={{
            background: isUp ? '#FFF0F0' : isDown ? '#EDF4FF' : '#F2F4F6',
            color,
          }}
        >
          {isUp ? '▲' : isDown ? '▼' : '—'} {Math.abs(pct).toFixed(2)}%
        </div>

        {/* 스파크라인 */}
        <div className="mt-1">
          <Sparkline data={sparkData} width={120} height={28} positive={isUp ? true : isDown ? false : undefined} />
        </div>

        {/* 급등 이유 뉴스 컨텍스트 한 줄 */}
        {relatedNews && (
          <div
            className="mt-2 pt-2 border-t"
            style={{ borderColor: isHot ? (isUp ? '#FFD6D9' : '#C8DCFF') : '#F2F4F6' }}
          >
            <p className="text-[10px] text-[#6B7684] leading-tight line-clamp-2 break-keep">
              {relatedNews.title}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── SECTION 2: 시장 지수 compact 스트립 아이템 ──────────────
const IndexStripItem = memo(function IndexStripItem({ idx }) {
  const isUp   = (idx.changePct ?? 0) > 0;
  const isDown = (idx.changePct ?? 0) < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';
  const flag   = { KOSPI: '🇰🇷', KOSDAQ: '🇰🇷', SPX: '🇺🇸', NDX: '🇺🇸', DJI: '🇺🇸', DXY: '🌐' }[idx.id] || '';

  return (
    <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#F2F4F6] hover:border-[#D1D6DB] hover:bg-[#F7F8FA] cursor-default transition-colors">
      <span className="text-[12px]">{flag}</span>
      <span className="text-[11px] text-[#8B95A1] font-medium">{idx.name}</span>
      <span className="text-[12px] font-bold tabular-nums font-mono" style={{ color }}>
        {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(idx.changePct ?? 0).toFixed(2)}%
      </span>
    </div>
  );
});

// ─── SECTION 3: HOT 리스트 행 (3열 공통) ─────────────────────
const HotRow = memo(function HotRow({ item, rank, krwRate, onClick }) {
  const pct    = getPct(item);
  const isUp   = pct > 0;
  const isDown = pct < 0;
  const color  = isUp ? '#F04452' : isDown ? '#1764ED' : '#8B95A1';

  const logoUrls = item.image ? [item.image]
    : item._market === 'US'   ? [`https://assets.parqet.com/logos/symbol/${item.symbol}?format=png`]
    : item._market === 'KR'   ? [`https://file.alphasquare.co.kr/media/images/stock_logo/kr/${item.symbol}.png`]
    : [];
  const [logoIdx, setLogoIdx] = useState(0);
  const bg = getAvatarBg(item.symbol);

  const price = item._market === 'COIN'
    ? `₩${fmt(Math.round(item.priceKrw || (item.priceUsd ?? 0) * krwRate))}`
    : item._market === 'KR'
    ? `₩${fmt(item.price)}`
    : `₩${fmt(Math.round((item.price ?? 0) * krwRate))}`;

  return (
    <div
      onClick={() => onClick?.(item)}
      className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-[#F7F8FA] active:scale-[0.99] transition-all rounded-xl"
    >
      {/* 순위 */}
      <span className="w-4 text-[11px] text-[#C9CDD2] tabular-nums font-mono text-center flex-shrink-0">{rank}</span>

      {/* 로고 */}
      {logoIdx < logoUrls.length ? (
        <img
          src={logoUrls[logoIdx]}
          alt={item.symbol}
          onError={() => setLogoIdx(i => i + 1)}
          className="w-6 h-6 rounded-full object-contain bg-white border border-[#F2F4F6] p-0.5 flex-shrink-0"
        />
      ) : (
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
          style={{ background: bg }}
        >
          {(item.symbol || '?').slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* 종목명 */}
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[#191F28] truncate">{item.name}</div>
        <div className="text-[10px] text-[#8B95A1] font-mono truncate">{item.symbol}</div>
      </div>

      {/* 등락률 + 가격 */}
      <div className="text-right flex-shrink-0">
        <div
          className="text-[12px] font-bold tabular-nums font-mono"
          style={{ color }}
        >
          {isUp ? '▲' : isDown ? '▼' : '—'}{Math.abs(pct).toFixed(2)}%
        </div>
        <div className="text-[10px] text-[#8B95A1] tabular-nums font-mono">{price}</div>
      </div>
    </div>
  );
});

// ─── 관련종목 인라인 chip ─────────────────────────────────────
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
        const relPct   = rel ? (rel.change24h ?? rel.changePct ?? 0) : null;
        const relColor = relPct == null ? '#B0B8C1' : relPct > 0 ? '#F04452' : relPct < 0 ? '#1764ED' : '#8B95A1';
        const flag     = MARKET_FLAG[market] || '';
        const arrow    = relPct == null ? '' : relPct > 0 ? '↑' : relPct < 0 ? '↓' : '';

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

// ─── SECTION 4: 인사이트 카드 ────────────────────────────────
const InsightCard = memo(function InsightCard({ mover, news, onMoverClick }) {
  const pct    = getPct(mover);
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
      className="flex-shrink-0 w-[260px] block rounded-xl border p-3 hover:opacity-90 transition-opacity"
      style={{ background: bgColor, borderColor }}
    >
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
      <div className="text-[12px] text-[#4E5968] leading-snug line-clamp-2">
        {news.title}
      </div>
    </a>
  );
});

const MockInsightCard = memo(function MockInsightCard({ mock }) {
  const badgePalette = { COIN: { bg: '#FFF4E6', color: '#FF9500' }, US: { bg: '#EDF4FF', color: '#3182F6' }, KR: { bg: '#FFF0F0', color: '#F04452' } };
  const badge = badgePalette[mock.moverMarket] || { bg: '#F2F4F6', color: '#8B95A1' };
  return (
    <a
      href={mock.link}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-[260px] block rounded-xl border border-[#F2F4F6] p-3 hover:opacity-90 transition-opacity bg-[#FAFBFC]"
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

// ─── 스켈레톤 ─────────────────────────────────────────────────
function SkeletonSurgeCard({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="flex-shrink-0 w-[152px] rounded-2xl border border-[#F2F4F6] p-3.5 animate-pulse bg-white">
      <div className="flex items-center justify-between mb-2.5">
        <div className="w-8 h-8 rounded-full bg-[#F2F4F6]" />
        <div className="w-8 h-4 rounded-full bg-[#F2F4F6]" />
      </div>
      <div className="h-3.5 bg-[#F2F4F6] rounded w-20 mb-1" />
      <div className="h-3 bg-[#F2F4F6] rounded w-12 mb-2" />
      <div className="h-4 bg-[#F2F4F6] rounded w-24 mb-1.5" />
      <div className="h-5 bg-[#F2F4F6] rounded-full w-16 mb-2" />
      <div className="h-7 bg-[#F2F4F6] rounded w-full" />
    </div>
  ));
}

function SkeletonHotRow({ count = 5 }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="flex items-center gap-2.5 px-4 py-2.5 animate-pulse">
      <div className="w-4 h-3 bg-[#F2F4F6] rounded flex-shrink-0" />
      <div className="w-6 h-6 rounded-full bg-[#F2F4F6] flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <div className="h-3 bg-[#F2F4F6] rounded w-20" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-12" />
      </div>
      <div className="space-y-1 text-right">
        <div className="h-3 bg-[#F2F4F6] rounded w-14" />
        <div className="h-2.5 bg-[#F2F4F6] rounded w-12" />
      </div>
    </div>
  ));
}

// ─── mock 인사이트 데이터 ─────────────────────────────────────
const MOCK_INSIGHTS = [
  {
    id: 'mock-btc',
    moverName: 'BTC', moverMarket: 'COIN', moverPct: null,
    title: '비트코인 급등세 — 업비트 거래량 급증, 고래 매수 신호 포착',
    timeAgo: '', link: 'https://coindesk.com',
  },
  {
    id: 'mock-nvda',
    moverName: 'NVDA', moverMarket: 'US', moverPct: null,
    title: 'NVDA AI 모멘텀 지속 — AI 반도체 수요 지속 확대로 실적 전망 상향',
    timeAgo: '', link: 'https://finance.yahoo.com',
  },
  {
    id: 'mock-samsung',
    moverName: '삼성전자', moverMarket: 'KR', moverPct: null,
    title: '삼성전자 외국인 순매수 — HBM4 납품 기대감에 외국인 3일 연속 순매수',
    timeAgo: '', link: 'https://news.naver.com',
  },
];

// ─── 섹터 로테이션 컴포넌트 ──────────────────────────────────
// 국장 + 미장 sector 필드 기반 섹터별 평균 등락률 막대 시각화
const SECTOR_FLAG = { kr: '🇰🇷', us: '🇺🇸' };

function SectorRotation({ krStocks, usStocks }) {
  const [activeMarket, setActiveMarket] = useState('all');

  const sectorMap = useMemo(() => {
    const items = activeMarket === 'kr' ? krStocks
      : activeMarket === 'us' ? usStocks
      : [...krStocks, ...usStocks];
    const map = {};
    for (const s of items) {
      if (!s.sector) continue;
      if (!map[s.sector]) map[s.sector] = { sum: 0, count: 0, market: s.market };
      map[s.sector].sum   += s.changePct ?? 0;
      map[s.sector].count += 1;
    }
    return Object.entries(map)
      .map(([name, { sum, count, market }]) => ({
        name,
        avg: parseFloat((sum / count).toFixed(2)),
        count,
        market,
      }))
      .sort((a, b) => b.avg - a.avg);
  }, [krStocks, usStocks, activeMarket]);

  if (!sectorMap.length) return null;
  const maxAbs = Math.max(...sectorMap.map(s => Math.abs(s.avg)), 0.01);

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
        <div className="flex items-center gap-2">
          <span className="text-[14px]">🔄</span>
          <span className="text-[14px] font-bold text-[#191F28]">섹터 로테이션</span>
        </div>
        <div className="flex gap-1">
          {[['all', '전체'], ['kr', '🇰🇷'], ['us', '🇺🇸']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveMarket(id)}
              className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors ${
                activeMarket === id ? 'bg-[#191F28] text-white' : 'text-[#6B7684] hover:bg-[#F2F4F6]'
              }`}
            >{label}</button>
          ))}
        </div>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {sectorMap.map(({ name, avg, market }) => {
          const isUp  = avg >= 0;
          const clr   = avg === 0 ? '#B0B8C1' : isUp ? '#F04452' : '#1A73E8';
          const bgClr = isUp ? 'rgba(240,68,82,0.12)' : 'rgba(26,115,232,0.12)';
          const pct   = Math.abs(avg) / maxAbs * 100;
          return (
            <div key={name} className="flex items-center gap-2 min-w-0">
              <div className="w-[76px] flex-shrink-0 flex items-center gap-1">
                {activeMarket === 'all' && (
                  <span className="text-[9px]">{SECTOR_FLAG[market] ?? ''}</span>
                )}
                <span className="text-[11px] font-medium text-[#191F28] truncate">{name}</span>
              </div>
              <div className="flex-1 h-4 rounded-sm overflow-hidden bg-[#F8F9FA]">
                <div
                  className="h-full rounded-sm transition-all duration-300"
                  style={{ width: `${Math.max(pct, 2)}%`, background: bgClr }}
                />
              </div>
              <span
                className="text-[11px] font-bold font-mono tabular-nums w-[44px] text-right flex-shrink-0"
                style={{ color: clr }}
              >{isUp ? '+' : ''}{avg.toFixed(2)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 급등 필터 탭 버튼 ──────────────────────────────────────
const SURGE_FILTERS = [
  { id: 'all',  label: '전체' },
  { id: 'KR',   label: '🇰🇷 국내' },
  { id: 'US',   label: '🇺🇸 미장' },
  { id: 'COIN', label: '🪙 코인' },
];

// ─── 메인 홈 대시보드 ────────────────────────────────────────
export default function HomeDashboard({
  indices = [], krStocks = [], usStocks = [], coins = [],
  krwRate = 1466, onItemClick,
}) {
  const { data: allNews = [], isLoading: newsLoading } = useAllNewsQuery();
  const { watchlist, toggle, isWatched } = useWatchlist();
  const [surgeMarket, setSurgeMarket] = useState('all');
  // 모바일에서 홈 화면이 너무 길어지지 않도록 코인 요약 카드 기본 접힘
  // (데스크탑도 동일 — 필요 시 펼치기)
  const [coinCardOpen, setCoinCardOpen] = useState(false);

  // 마켓 태그 추가된 종목 리스트
  const krItems   = useMemo(() => krStocks.map(s => ({ ...s, _market: 'KR'   })), [krStocks]);
  const usItems   = useMemo(() => usStocks.map(s => ({ ...s, _market: 'US'   })), [usStocks]);
  const coinItems = useMemo(() => coins.map(c   => ({ ...c, _market: 'COIN' })), [coins]);
  const allItems  = useMemo(() => [...krItems, ...usItems, ...coinItems], [krItems, usItems, coinItems]);

  // 데이터 맵 (연관 종목용)
  const dataMap = useMemo(() => {
    const map = {};
    for (const s of krStocks)  map[s.symbol] = s;
    for (const s of usStocks)  map[s.symbol] = s;
    for (const c of coins)     map[c.symbol?.toUpperCase()] = c;
    for (const s of krStocks)  if (s.name) map[s.name] = s;
    return map;
  }, [krStocks, usStocks, coins]);

  // ─── SECTION 1: 급등 스포트라이트 계산 ─────────────────────
  const surgeItems = useMemo(() => {
    let list = allItems;
    if (surgeMarket === 'KR')   list = krItems;
    else if (surgeMarket === 'US')   list = usItems;
    else if (surgeMarket === 'COIN') list = coinItems;

    const hot = list.filter(i => getPct(i) >= 2).sort((a, b) => getPct(b) - getPct(a));
    return (hot.length >= 3 ? hot : [...list].sort((a, b) => getPct(b) - getPct(a))).slice(0, 5);
  }, [allItems, krItems, usItems, coinItems, surgeMarket]);

  // 급등 종목 존재 여부 (3% 이상)
  const hasHotItems = useMemo(() => allItems.some(i => getPct(i) >= 3), [allItems]);

  // 급등 카드용 뉴스 컨텍스트 맵 (symbol → 관련 뉴스 1건)
  const surgeNewsMap = useMemo(() => {
    if (!allNews.length || !surgeItems.length) return {};
    return surgeItems.reduce((acc, item) => {
      const news = findRelatedNews(item, allNews);
      if (news) acc[item.symbol] = news;
      return acc;
    }, {});
  }, [surgeItems, allNews]);

  // ─── SECTION 3: 각 시장별 HOT TOP5 ────────────────────────
  const krHot = useMemo(
    () => [...krItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5),
    [krItems]
  );
  const usHot = useMemo(
    () => [...usItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5),
    [usItems]
  );
  const coinHot = useMemo(
    () => [...coinItems].sort((a, b) => getPct(b) - getPct(a)).slice(0, 5),
    [coinItems]
  );

  // ─── SECTION 4: 인사이트 (뉴스 × 무버 매칭) ────────────────
  const topMovers = useMemo(() => {
    return [...allItems].sort((a, b) => Math.abs(getPct(b)) - Math.abs(getPct(a))).slice(0, 20);
  }, [allItems]);

  const insights = useMemo(() => {
    if (!allNews.length || !topMovers.length) return [];
    return topMovers
      .map(mover => ({ mover, news: findRelatedNews(mover, allNews) }))
      .filter(({ news }) => news !== null)
      .slice(0, 6);
  }, [topMovers, allNews]);

  const hasData = krStocks.length > 0 || usStocks.length > 0 || coins.length > 0;

  // ─── 관심종목 필터링 ────────────────────────────────────────
  const watchedItems = useMemo(
    () => allItems.filter(i => isWatched(i.id || i.symbol)),
    [allItems, watchlist] // watchlist dep: Set 변경 시 재계산
  );

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <div className="space-y-4">

      {/* ─── 상단 헤더 ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#191F28] leading-tight">지금 뭐가 움직이고 있어?</h2>
          <p className="text-[12px] text-[#8B95A1] mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-[#F2F4F6] shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2AC769] animate-pulse" />
          <span className="text-[11px] text-[#6B7684] font-medium">실시간</span>
        </div>
      </div>

      {/* ─── SECTION 1: 급등 스포트라이트 ─────────────────── */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
        {/* 섹션 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">🚀</span>
            <span className="text-[14px] font-bold text-[#191F28]">지금 급등</span>
            {hasHotItems && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF0F0] text-[#F04452] animate-pulse">
                HOT
              </span>
            )}
          </div>
          {/* 시장 필터 탭 */}
          <div className="flex items-center gap-1">
            {SURGE_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setSurgeMarket(f.id)}
                className={`text-[10px] px-2 py-1 rounded-md font-semibold transition-colors flex-shrink-0 ${
                  surgeMarket === f.id
                    ? 'bg-[#191F28] text-white'
                    : 'text-[#6B7684] hover:bg-[#F2F4F6]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* 급등 카드 가로 스크롤 */}
        <div className="flex gap-3 overflow-x-auto p-4 no-scrollbar">
          {!hasData
            ? <SkeletonSurgeCard count={5} />
            : surgeItems.map(item => (
                <SurgeCard
                  key={`surge-${item._market}-${item.id || item.symbol}`}
                  item={item}
                  krwRate={krwRate}
                  onClick={onItemClick}
                  relatedNews={surgeNewsMap[item.symbol] || null}
                />
              ))
          }
        </div>
      </div>

      {/* ─── 관심종목 섹션 (등록된 종목 있을 때만 표시) ─────── */}
      {watchedItems.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-2">
              <span className="text-[14px]">⭐</span>
              <span className="text-[14px] font-bold text-[#191F28]">관심종목</span>
              <span className="text-[11px] text-[#8B95A1]">{watchedItems.length}개</span>
            </div>
          </div>
          <div className="divide-y divide-[#F2F4F6]">
            {watchedItems.map(item => {
              const pct    = getPct(item);
              const isUp   = pct >= 0;
              const upClr  = '#F04452';
              const dnClr  = '#1A73E8';
              const clr    = pct === 0 ? '#8B95A1' : isUp ? upClr : dnClr;
              const price  = item._market === 'KR'
                ? `₩${(item.price ?? 0).toLocaleString()}`
                : item._market === 'COIN'
                  ? `₩${Math.round(item.priceKrw ?? 0).toLocaleString()}`
                  : `$${(item.price ?? 0).toLocaleString()}`;
              return (
                <div
                  key={item.id || item.symbol}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[#FAFAFA] cursor-pointer"
                  onClick={() => onItemClick?.(item)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={e => { e.stopPropagation(); toggle(item.id || item.symbol); }}
                      className="text-[14px] text-yellow-400 flex-shrink-0"
                    >★</button>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#191F28] truncate">{item.name ?? item.symbol}</p>
                      <p className="text-[11px] text-[#8B95A1]">{item.symbol}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-[14px] font-bold font-mono tabular-nums" style={{ color: clr }}>
                      {isUp ? '+' : ''}{pct.toFixed(2)}%
                    </p>
                    <p className="text-[11px] text-[#8B95A1] font-mono">{price}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── SECTION 2: 시장 지수 compact 스트립 ─────────── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[12px] font-bold text-[#8B95A1] uppercase tracking-wide">시장 지수</span>
          <div className="flex-1 h-px bg-[#F2F4F6]" />
          {/* 환율 */}
          <span className="text-[12px] font-bold text-[#191F28] tabular-nums font-mono">
            ₩{(krwRate || 0).toLocaleString('ko-KR')}
            <span className="text-[10px] font-normal text-[#B0B8C1] ml-1">USD/KRW</span>
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {indices.length > 0
            ? indices.map(idx => <IndexStripItem key={idx.id} idx={idx} />)
            : [1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="flex-shrink-0 h-9 w-28 rounded-xl bg-[#F2F4F6] animate-pulse" />
              ))
          }
        </div>
      </div>

      {/* ─── SECTION 3: 3열 HOT 리스트 ───────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 국내 급등 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🇰🇷</span>
              <span className="text-[13px] font-bold text-[#191F28]">국내 급등</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF0F0] text-[#F04452]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : krHot.length > 0
                ? krHot.map((item, i) => (
                    <HotRow
                      key={`kr-hot-${item.symbol}`}
                      item={item}
                      rank={i + 1}
                      krwRate={krwRate}
                      onClick={onItemClick}
                    />
                  ))
                : <div className="px-4 py-6 text-center text-[12px] text-[#B0B8C1]">데이터 로딩 중</div>
            }
          </div>
        </div>

        {/* 미장 급등 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🇺🇸</span>
              <span className="text-[13px] font-bold text-[#191F28]">미장 급등</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#EDF4FF] text-[#3182F6]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : usHot.length > 0
                ? usHot.map((item, i) => (
                    <HotRow
                      key={`us-hot-${item.symbol}`}
                      item={item}
                      rank={i + 1}
                      krwRate={krwRate}
                      onClick={onItemClick}
                    />
                  ))
                : <div className="px-4 py-6 text-center text-[12px] text-[#B0B8C1]">데이터 로딩 중</div>
            }
          </div>
        </div>

        {/* 코인 급등 */}
        <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F2F4F6]">
            <div className="flex items-center gap-1.5">
              <span className="text-[13px]">🪙</span>
              <span className="text-[13px] font-bold text-[#191F28]">코인 급등</span>
            </div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#FFF4E6] text-[#FF9500]">TOP 5</span>
          </div>
          <div className="py-1">
            {!hasData
              ? <SkeletonHotRow count={5} />
              : coinHot.length > 0
                ? coinHot.map((item, i) => (
                    <HotRow
                      key={`coin-hot-${item.symbol}`}
                      item={item}
                      rank={i + 1}
                      krwRate={krwRate}
                      onClick={onItemClick}
                    />
                  ))
                : <div className="px-4 py-6 text-center text-[12px] text-[#B0B8C1]">데이터 로딩 중</div>
            }
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: 인사이트 카드 (가로 스크롤) ─────── */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
          <span className="text-[14px]">💡</span>
          <span className="text-[14px] font-bold text-[#191F28]">인사이트</span>
          {!newsLoading && insights.length === 0 && (
            <span className="text-[10px] text-[#B0B8C1] bg-[#F2F4F6] px-1.5 py-0.5 rounded ml-1">뉴스 로드 중</span>
          )}
          <span className="text-[11px] text-[#B0B8C1] ml-auto">급등종목 관련 뉴스</span>
        </div>
        <div className="flex gap-3 overflow-x-auto p-4 no-scrollbar">
          {newsLoading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[260px] rounded-xl border border-[#F2F4F6] p-3 animate-pulse">
              <div className="flex gap-1.5 mb-2">
                <div className="h-3 bg-[#F2F4F6] rounded w-20" />
                <div className="h-3 bg-[#F2F4F6] rounded w-10" />
              </div>
              <div className="h-3 bg-[#F2F4F6] rounded mb-1" />
              <div className="h-3 bg-[#F2F4F6] rounded w-4/5" />
            </div>
          ))}
          {!newsLoading && insights.map(({ mover, news }) => (
            <InsightCard
              key={`insight-${mover._market}-${mover.id || mover.symbol}`}
              mover={mover}
              news={news}
              onMoverClick={onItemClick}
            />
          ))}
          {!newsLoading && insights.length === 0 && MOCK_INSIGHTS.map(mock => (
            <MockInsightCard key={mock.id} mock={mock} />
          ))}
        </div>
      </div>

      {/* ─── SECTION 5: 섹터 로테이션 ────────────────────── */}
      {(krStocks.length > 0 || usStocks.length > 0) && (
        <SectorRotation krStocks={krStocks} usStocks={usStocks} />
      )}

      {/* ─── SECTION 6: 코인 시장 요약 (접기/펼치기) ─────── */}
      <div className="bg-white rounded-2xl overflow-hidden border border-[#F2F4F6] shadow-sm">
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
