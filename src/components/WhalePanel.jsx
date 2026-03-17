// 고래 알림 패널 — 멀티소스 실시간 대량 체결 감지
// 소스 1: Upbit WebSocket (2000만원+ 단일 체결)
// 소스 2: Blockchain.com WebSocket (10 BTC+ 온체인 이동)
// 소스 3: Whale Alert REST 폴링 (Vercel 프록시, 60초 간격)
import { useState, useEffect } from 'react';
import {
  subscribeUpbitWhaleTrades,
  unsubscribeUpbitWhaleTrades,
  subscribeBtcWhales,
  unsubscribeBtcWhales,
  startWhaleAlertPolling,
  stopWhaleAlertPolling,
} from '../api/whale';
import { pushWhaleEvent } from '../state/whaleBus';

const MAX_EVENTS = 30;

// ─── 알려진 거래소 이름 한국어 매핑 ────────────────────────────
const EXCHANGE_NAME_MAP = {
  binance:    '바이낸스',
  coinbase:   '코인베이스',
  kraken:     '크라켄',
  bitfinex:   '비트파이낸스',
  okx:        'OKX',
  okex:       'OKX',
  upbit:      '업비트',
  bithumb:    '빗썸',
  bybit:      '바이빗',
  huobi:      '후오비',
  kucoin:     '쿠코인',
  gate:       '게이트',
  'gate.io':  '게이트',
  bitstamp:   '비트스탬프',
  gemini:     '제미나이',
  ftx:        'FTX',
  bitget:     '비트겟',
  mexc:       'MEXC',
  cryptocom:  '크립토닷컴',
};

// 거래소명 원시 문자열에서 한국어 이름 추출
function resolveExchangeName(raw) {
  if (!raw || raw === 'unknown') return null;
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(EXCHANGE_NAME_MAP)) {
    if (lower.includes(key)) return val;
  }
  // 원본 문자열 그대로 (첫 글자 대문자)
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ─── 이동 패턴 설명 (카드 제목 수준 한 줄 요약) ─────────────────
// "바이낸스 → 콜드월렛 (HODLing 신호)" 형식으로 생성
function buildRouteTitle(event) {
  const from = resolveExchangeName(event.fromOwner) || event.fromOwner || null;
  const to   = resolveExchangeName(event.toOwner)   || event.toOwner   || null;

  if (event.source !== 'whale-alert') {
    // Upbit 체결: 거래소명 없음 — 종목 + 매수/매도 방향 표시
    return `업비트 ${event.symbol || ''} ${event.side || '체결'}`;
  }

  switch (event.movementType) {
    case 'exchange_withdrawal':
      return `${from || '거래소'} → 개인 지갑 (HODLing 신호)`;
    case 'exchange_deposit':
      return `개인 지갑 → ${to || '거래소'} (매도 압력)`;
    case 'exchange_to_exchange':
      return `${from || '거래소'} → ${to || '거래소'} (거래소 간 이동)`;
    case 'wallet_to_wallet':
      return `지갑 → 지갑 (OTC 또는 내부 이동)`;
    default:
      if (from && to) return `${from} → ${to}`;
      if (from)       return `${from} → 지갑`;
      if (to)         return `지갑 → ${to}`;
      return '거래소 이동';
  }
}

// ─── 이동 패턴별 배지 스타일 ────────────────────────────────────
function getMovementBadge(movementType, side) {
  // Whale Alert 온체인 이벤트 (movementType 있음)
  if (movementType === 'exchange_deposit') {
    return {
      emoji: '🔴',
      label: '매도 압력',
      bg: '#FFF0F1',
      border: '#FFD0D4',
      color: '#F04452',
    };
  }
  if (movementType === 'exchange_withdrawal') {
    return {
      emoji: '🟢',
      label: 'HODLing',
      bg: '#F0FFF6',
      border: '#C6F6D5',
      color: '#2AC769',
    };
  }
  if (movementType === 'exchange_to_exchange') {
    return {
      emoji: '🟡',
      label: '차익거래?',
      bg: '#FFFBEB',
      border: '#FDE68A',
      color: '#CC8800',
    };
  }
  if (movementType === 'wallet_to_wallet') {
    return {
      emoji: '⚪',
      label: 'OTC 가능성',
      bg: '#F2F4F6',
      border: '#E2E8F0',
      color: '#6B7684',
    };
  }
  // BTC 온체인 (movementType 없음, chain=bitcoin)
  if (side === '온체인') {
    return {
      emoji: '⚡',
      label: '온체인 이동',
      bg: '#FFF4E6',
      border: '#FFD8A8',
      color: '#FF9500',
    };
  }
  // Upbit 매수
  if (side === '매수') {
    return {
      emoji: '🟢',
      label: '매수',
      bg: '#F0FFF6',
      border: '#C6F6D5',
      color: '#2AC769',
    };
  }
  // Upbit 매도
  return {
    emoji: '🔴',
    label: '매도',
    bg: '#FFF0F1',
    border: '#FFD0D4',
    color: '#F04452',
  };
}

// ─── 금액 포맷 (한국어 + 달러 병기) ────────────────────────────
function fmtAmt(n) {
  if (!n || n === 0) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4)  return `${(n / 1e4).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

// USD 금액 포맷 (달러)
function fmtUsd(n) {
  if (!n || n === 0) return null;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// 수량 포맷 (소수점 처리)
function fmtVol(vol, symbol) {
  if (vol == null || isNaN(Number(vol))) return null;
  const n = Number(vol);
  const formatted = n % 1 === 0 ? n.toLocaleString('ko-KR') : n.toFixed(3);
  return `${formatted} ${symbol || ''}`;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60)   return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  return `${Math.floor(diff / 3600)}시간 전`;
}

// ─── 이벤트 인사이트 설명 생성 ──────────────────────────────────
function buildInsightText(event) {
  // whale.js가 이미 생성한 insight 필드 우선 사용
  if (event.insight) return event.insight;

  const sym      = event.symbol || '코인';
  const fromKo   = resolveExchangeName(event.fromOwner);
  const toKo     = resolveExchangeName(event.toOwner);
  const fromLabel = fromKo || event.fromOwner || '지갑';
  const toLabel   = toKo   || event.toOwner   || '지갑';

  switch (event.movementType) {
    case 'exchange_deposit':
      return `${sym}을 ${toLabel}으로 이동. 매도 준비 가능성`;
    case 'exchange_withdrawal':
      return `${sym}을 ${fromLabel}에서 출금. 장기 보유 신호`;
    case 'exchange_to_exchange':
      return `${fromLabel}→${toLabel} 거래소간 이동. 차익거래 또는 포지션 이동`;
    case 'wallet_to_wallet':
      return '지갑간 이동. OTC 거래 또는 내부 이동일 수 있음';
    default:
      break;
  }

  // Upbit 체결 fallback
  const amt  = event.tradeAmt || 0;
  const side = event.side;
  if (side === '매수') {
    if (amt >= 5e8) return '기관/대형 투자자 대량 매수 — 단기 상방 압력';
    if (amt >= 1e8) return '세력 유입 의심 — 모멘텀 확인 필요';
    return '대량 단일 체결 — 방향성 주시';
  }
  if (side === '매도') {
    if (amt >= 5e8) return '대규모 차익실현 — 하락 압력 주의';
    if (amt >= 1e8) return '고래 매도 출현 — 추격매수 주의';
    return '대량 단일 체결 — 방향성 주시';
  }
  if (amt >= 5e9) return '거래소 대규모 입금 — 매도 압력 가능성';
  if (amt >= 1e9) return '고래 자산 이동 — 방향성 주시';
  return '대형 지갑 자산 이동 감지';
}

// ─── 거래소 경로 표시 (fromOwner → toOwner) ─────────────────────
function buildRouteLabel(event) {
  if (event.source !== 'whale-alert') {
    // Upbit 체결은 거래소 이름 표시 없음
    return null;
  }
  const from = resolveExchangeName(event.fromOwner) || event.fromOwner || '지갑';
  const to   = resolveExchangeName(event.toOwner)   || event.toOwner   || '지갑';
  if (!from && !to) return null;
  return `${from} → ${to}`;
}

// ─── 이벤트 카드 컴포넌트 ────────────────────────────────────────
function EventRow({ event }) {
  const isHigh   = event.severity === 'high';
  const badge    = getMovementBadge(event.movementType, event.side);
  const routeLabel = buildRouteLabel(event);
  const insightText = buildInsightText(event);

  // 달러 환산 (whale-alert는 USD 금액 포함, BTC온체인은 KRW로 변환됨)
  // tradeAmt가 원화 기준 → USD로 역산 (1466원/달러 근사)
  const usdAmt = event.source === 'whale-alert'
    ? fmtUsd(Math.round((event.tradeAmt || 0) / 1466))
    : null;

  // 수량 + 심볼 표시
  const volStr = fmtVol(event.volume, event.symbol);

  // 체인/소스 배지
  const chainBadge = event.source === 'whale-alert'
    ? { bg: '#F0F4FF', color: '#3182F6', text: (event.chain || 'CHAIN').toUpperCase() }
    : event.chain === 'bitcoin'
    ? { bg: '#FFF4E6', color: '#FF9500', text: 'BTC 온체인' }
    : { bg: '#F2F4F6', color: '#6B7684', text: 'UPBIT' };

  return (
    <div className={`px-4 py-3 border-b border-[#F2F4F6] last:border-0 ${isHigh ? 'bg-[#FFFBF0]' : ''}`}>
      {/* 1행: 이동 유형 배지 + 거래소 경로 + 시간 */}
      <div className="flex items-center gap-2 mb-1.5">
        {/* 이동 유형 배지 */}
        <span
          className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
          style={{ background: badge.bg, borderColor: badge.border, color: badge.color }}
        >
          {badge.emoji} {badge.label}
        </span>

        {/* 거래소 경로 (whale-alert만) */}
        {routeLabel && (
          <span className="text-[11px] font-medium text-[#4E5968] truncate flex-1">{routeLabel}</span>
        )}

        {/* 심볼 + 체인 배지 */}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <span className="text-[12px] font-bold text-[#191F28]">{event.symbol}</span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: chainBadge.bg, color: chainBadge.color }}
          >
            {chainBadge.text}
          </span>
          {isHigh && (
            <span className="text-[10px] font-bold bg-[#FFF0F1] text-[#F04452] px-1.5 py-0.5 rounded">🔥 HIGH</span>
          )}
        </div>
      </div>

      {/* 2행: 수량 + 금액 */}
      <div className="flex items-baseline gap-2 mb-1">
        {/* 수량 */}
        {volStr && (
          <span className="text-[13px] font-bold text-[#191F28] font-mono tabular-nums">
            {volStr}
          </span>
        )}
        {/* 원화 금액 */}
        <span className="text-[13px] font-bold font-mono tabular-nums" style={{ color: badge.color }}>
          ₩{fmtAmt(event.tradeAmt)}
        </span>
        {/* USD 병기 */}
        {usdAmt && (
          <span className="text-[11px] text-[#8B95A1] font-mono tabular-nums">({usdAmt})</span>
        )}
      </div>

      {/* 3행: 인사이트 설명 */}
      <div className="text-[11px] text-[#6B7684] leading-snug mb-1">
        {insightText}
      </div>

      {/* 4행: 시간 */}
      <div className="text-[10px] text-[#B0B8C1]">
        {timeAgo(event.timestamp)}
      </div>
    </div>
  );
}

// Upbit KRW 마켓 감시 종목 목록
const WATCH_SYMBOLS = [
  'BTC','ETH','XRP','SOL','ADA','DOGE','AVAX','DOT','LINK','UNI',
  'NEAR','APT','ARB','SUI','OP','PEPE','XLM','TON','ATOM','INJ',
];

export default function WhalePanel({ isVisible = true }) {
  const [events,       setEvents]       = useState([]);
  const [connected,    setConnected]    = useState(false);
  const [btcConnected, setBtcConnected] = useState(false);
  const [msgCount,     setMsgCount]     = useState(0); // WS 수신 전체 체결 수

  // 이벤트 추가 헬퍼 (MAX_EVENTS 제한 + 버스 발행)
  const addEvent = (evt) => {
    pushWhaleEvent(evt);
    setEvents(prev => [evt, ...prev].slice(0, MAX_EVENTS));
  };

  useEffect(() => {
    if (!isVisible) return;

    setConnected(false);
    setBtcConnected(false);
    setMsgCount(0);

    // ── 소스 1: Upbit WebSocket ─────────────────────────────────
    subscribeUpbitWhaleTrades(WATCH_SYMBOLS, (evt) => {
      if (evt._connected) { setConnected(true); return; }
      if (evt._tick)      { setConnected(true); setMsgCount(p => p + 1); return; }
      setConnected(true);
      setMsgCount(p => p + 1);
      addEvent(evt);
    });

    // ── 소스 2: Blockchain.com BTC 온체인 WebSocket ─────────────
    subscribeBtcWhales((evt) => {
      if (evt._connected) { setBtcConnected(true); return; }
      setBtcConnected(true);
      addEvent(evt);
    });

    // ── 소스 3: Whale Alert REST 폴링 (프록시 없으면 무시) ───────
    startWhaleAlertPolling((evt) => {
      addEvent(evt);
    });

    return () => {
      unsubscribeUpbitWhaleTrades();
      unsubscribeBtcWhales();
      stopWhaleAlertPolling();
      setConnected(false);
      setBtcConnected(false);
    };
  }, [isVisible]);

  // 연결 상태 텍스트
  const connStatus = connected && btcConnected
    ? 'Upbit + BTC 온체인'
    : connected
    ? 'Upbit 실시간'
    : btcConnected
    ? 'BTC 온체인'
    : '연결 중...';

  const isAnyConnected = connected || btcConnected;

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F2F4F6]">
        <span className="text-[15px]">🐋</span>
        <span className="text-[14px] font-bold text-[#191F28]">고래 알림</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAnyConnected ? 'bg-[#2AC769] animate-pulse' : 'bg-[#E5E8EB]'}`} />
          <span className="text-[10px] text-[#B0B8C1]">{connStatus}</span>
          {connected && msgCount > 0 && (
            <span className="text-[10px] text-[#C9CDD2] font-mono">수신 {msgCount.toLocaleString()}건</span>
          )}
        </div>
      </div>

      {/* 이벤트 목록 */}
      <div className="max-h-[400px] overflow-y-auto">
        {events.length === 0 && (
          <div className="px-4 py-6 text-center">
            <div className="text-[13px] text-[#B0B8C1] mb-1">
              {isAnyConnected
                ? `2,000만원+ 단일 체결 / 10 BTC+ 온체인 감지 중...`
                : '웹소켓 연결 중...'}
            </div>
            <div className="text-[11px] text-[#C9CDD2]">대량 매매 발생 시 즉시 표시됩니다</div>
          </div>
        )}
        {events.map((evt, i) => (
          <EventRow key={`${evt.id || evt.symbol}-${evt.timestamp}-${i}`} event={evt} />
        ))}
      </div>

      {/* 안내 — 이동 유형 범례 */}
      <div className="px-4 py-2.5 border-t border-[#F2F4F6] bg-[#FAFBFC]">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-[10px] text-[#C9CDD2]">🔴 매도압력 = 거래소 입금</span>
          <span className="text-[10px] text-[#C9CDD2]">🟢 HODLing = 거래소 출금</span>
          <span className="text-[10px] text-[#C9CDD2]">🟡 차익거래 = 거래소간 이동</span>
          <span className="text-[10px] text-[#C9CDD2]">⚪ OTC = 지갑간 이동</span>
        </div>
      </div>
    </div>
  );
}
