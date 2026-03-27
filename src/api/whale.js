import { fetchWhaleProxy } from './_gateway.js';
// ─── 코인 고래 알림 API ────────────────────────────────────────
//
// 【결론: WhaleAlert RSS는 클라이언트 사이드에서 불가】
//
// 사유:
//   - whale-alert.io RSS: CORS 헤더 없음 → 브라우저에서 직접 불가
//   - allorigins 경유 가능하나 whale-alert.io가 봇 차단 → 빈 응답 多
//   - WhaleAlert 공식 API: 유료 (Free 플랜은 REST API, 15분 지연)
//   - CryptoCompare Large TX: 유료 플랜만 지원
//   - Upbit 대량 거래 공개 API: 없음
//
// 【채택 대안: CoinGecko 가격 급등 + Upbit 거래량 급증 감지】
//
// 설계:
//   1. 이전 스냅샷 vs 현재 스냅샷 비교
//   2. 가격 1분 내 ±2% 이상 변동 → 급변 알림
//   3. 거래량 전일 대비 500% 이상 급증 → 대량 매매 의심 알림
//   4. Upbit의 acc_trade_price_24h (24h 거래대금) 전 주기 대비 급증 → 고래 의심
//
// 한계:
//   - 실제 온체인 고래 TX 추적은 불가
//   - 가격/거래량 이상 징후 감지로 대체 (간접 지표)

// ─── 환율 / BTC 가격 (App.jsx에서 주입) ──────────────────────
let currentKrwRate    = 1466;       // USD → KRW 환율
let currentBtcKrwPrice = 130_000_000; // BTC 현재가 (원)

/** USD/KRW 환율 업데이트 — App.jsx에서 fetchExchangeRate() 결과로 호출 */
export function setWhaleKrwRate(rate) {
  if (rate > 0) currentKrwRate = rate;
}

/** BTC KRW 가격 업데이트 — App.jsx에서 coins 갱신 시 호출 */
export function setWhaleBtcKrwPrice(price) {
  if (price > 0) currentBtcKrwPrice = price;
}

// ─── 스냅샷 저장소 ────────────────────────────────────────────
// { coinId: { priceKrw, volume24h, timestamp } }
let prevSnapshot = {};

// ─── 고래 이벤트 타입 ─────────────────────────────────────────
// type: 'price_surge' | 'price_crash' | 'volume_spike' | 'whale_suspect'
// severity: 'high' | 'medium'

/**
 * detectWhaleEvents(currentCoins)
 *
 * @param {Array} currentCoins - fetchCoins() 또는 fetchCoinsUpbitOnly() 반환값
 * @returns {Array} 이벤트 배열
 *   [{ id, symbol, type, severity, message, pctChange, timestamp }]
 */
export function detectWhaleEvents(currentCoins) {
  const now    = Date.now();
  const events = [];

  for (const coin of currentCoins) {
    const prev = prevSnapshot[coin.id];
    if (!prev) continue; // 첫 스냅샷 — 비교 불가

    const elapsed = (now - prev.timestamp) / 1000; // 초
    if (elapsed < 5) continue; // 너무 짧은 간격은 무시

    // ─ 가격 변동률 계산 ──────────────────────────────────────
    const pricePct = prev.priceKrw > 0
      ? ((coin.priceKrw - prev.priceKrw) / prev.priceKrw) * 100
      : 0;

    // 1분 이내 ±2% 이상 급변 → 이상 징후
    if (elapsed <= 90 && Math.abs(pricePct) >= 2) {
      events.push({
        id:        coin.id,
        symbol:    coin.symbol,
        type:      pricePct > 0 ? 'price_surge' : 'price_crash',
        severity:  Math.abs(pricePct) >= 5 ? 'high' : 'medium',
        message:   `${coin.symbol} ${pricePct > 0 ? '급등' : '급락'} ${pricePct.toFixed(1)}% (${Math.round(elapsed)}초)`,
        pctChange: pricePct,
        priceKrw:  coin.priceKrw,
        timestamp: now,
      });
    }

    // ─ 거래량 급증 ───────────────────────────────────────────
    // volume24h는 USD 기준 총 24h 거래량
    // 전 주기 대비 급증은 24h 볼륨이므로 의미 있는 단위 변화 필요
    // 현실적 임계값: 전 주기 대비 +30% 이상 (24h 롤링 윈도우이므로 점진적)
    if (prev.volume24h > 0) {
      const volPct = ((coin.volume24h - prev.volume24h) / prev.volume24h) * 100;
      if (volPct >= 30) {
        events.push({
          id:        coin.id,
          symbol:    coin.symbol,
          type:      'volume_spike',
          severity:  volPct >= 100 ? 'high' : 'medium',
          message:   `${coin.symbol} 거래량 급증 +${volPct.toFixed(0)}%`,
          pctChange: volPct,
          priceKrw:  coin.priceKrw,
          timestamp: now,
        });
      }
    }
  }

  // ─ 스냅샷 갱신 ───────────────────────────────────────────
  for (const coin of currentCoins) {
    prevSnapshot[coin.id] = {
      priceKrw:  coin.priceKrw,
      volume24h: coin.volume24h,
      timestamp: now,
    };
  }

  // severity high 우선, 같으면 pctChange 절대값 내림차순
  return events.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return Math.abs(b.pctChange) - Math.abs(a.pctChange);
  });
}

/**
 * resetWhaleSnapshot()
 * 스냅샷 초기화 — 탭 전환 또는 오랜 비활성 후 재활성화 시 사용
 */
export function resetWhaleSnapshot() {
  prevSnapshot = {};
}

// ─────────────────────────────────────────────────────────────
// [보완] Upbit 실시간 거래 체결 WebSocket (고래 대량 단일 주문 감지)
//
// Upbit은 WebSocket으로 실시간 체결 데이터 제공 (인증 불필요)
// 단일 체결 기준 억 단위 이상 → 고래 의심
// ─────────────────────────────────────────────────────────────

let whaleWs        = null;
let whaleHandler   = null;
let whaleSymbols   = null;
let reconnectTimer = null;
let destroyed      = false;

// 원화 금액 포맷
function fmtKrw(n) {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조`;
  if (n >= 1e8)  return `${(n / 1e8).toFixed(1)}억`;
  if (n >= 1e4)  return `${(n / 1e4).toFixed(0)}만`;
  return n.toLocaleString('ko-KR');
}

function connectWs() {
  if (destroyed || !whaleSymbols || !whaleHandler) return;

  const THRESHOLD_KRW = 100_000_000; // 1억 원 (의미 있는 단일 체결 기준)
  const HIGH_KRW      = 500_000_000; // 5억 원 (기관급 대량 체결)
  const markets = whaleSymbols.map(s => `KRW-${s}`);

  try {
    const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    whaleWs = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify([
        { ticket: `whale-${Date.now()}` },
        { type: 'trade', codes: markets },
        { format: 'DEFAULT' },
      ]));
      // 연결 성공 콜백 (연결 상태 알림용 특수 이벤트)
      whaleHandler?.({ _connected: true });
    };

    ws.onmessage = async (evt) => {
      let text;
      if (evt.data instanceof Blob)        text = await evt.data.text();
      else if (evt.data instanceof ArrayBuffer) text = new TextDecoder().decode(evt.data);
      else text = evt.data;

      try {
        const data = JSON.parse(text);
        if (data.type !== 'trade') return;

        const price    = data.trade_price ?? 0;
        const volume   = data.trade_volume ?? 0;
        const tradeAmt = price * volume;

        // 임계값 미만도 수신 카운터용으로 콜백 (이벤트 없이)
        if (tradeAmt < THRESHOLD_KRW) {
          whaleHandler?.({ _tick: true });
          return;
        }

        const symbol = (data.code || '').replace('KRW-', '');
        const side   = data.ask_bid === 'ASK' ? '매도' : '매수';
        // 매수/매도별 signal + insight 부여
        const { signal, insight } = getUpbitInsight(side, tradeAmt);

        whaleHandler?.({
          symbol,
          type:      'whale_trade',
          severity:  tradeAmt >= HIGH_KRW ? 'high' : 'medium',
          price,
          volume,
          tradeAmt,
          side,
          signal,
          insight,
          message:   `${symbol} ${side} ${fmtKrw(tradeAmt)}원 (${volume % 1 === 0 ? volume : volume.toFixed(4)})`,
          timestamp: Date.now(),
        });
      } catch {}
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      whaleWs = null;
      if (!destroyed) {
        // 5초 후 자동 재연결
        reconnectTimer = setTimeout(connectWs, 5000);
      }
    };
  } catch {
    if (!destroyed) reconnectTimer = setTimeout(connectWs, 5000);
  }
}

/**
 * subscribeUpbitWhaleTrades(symbols, onEvent)
 * @param {string[]} symbols - ['BTC','ETH',...]
 * @param {Function} onEvent - 이벤트 수신 콜백
 *   onEvent({ _connected: true }) → 연결 성공 알림
 *   onEvent({ symbol, type, severity, tradeAmt, side, message, timestamp })
 */
export function subscribeUpbitWhaleTrades(symbols, onEvent) {
  destroyed      = false;
  whaleSymbols   = symbols;
  whaleHandler   = onEvent;

  if (whaleWs) { try { whaleWs.close(); } catch {} whaleWs = null; }
  clearTimeout(reconnectTimer);
  connectWs();
}

/**
 * unsubscribeUpbitWhaleTrades()
 * WebSocket 연결 해제 — 컴포넌트 언마운트 시 호출
 */
export function unsubscribeUpbitWhaleTrades() {
  destroyed    = true;
  whaleHandler = null;
  whaleSymbols = null;
  clearTimeout(reconnectTimer);
  if (whaleWs) { try { whaleWs.close(); } catch {} whaleWs = null; }
}

// ─── Layer 1b: 빗썸 WebSocket — 거래소 대량 체결 ─────────────────────────────
const BITHUMB_THRESHOLD_KRW = 100_000_000; // 1억 원 (고래 기준)
const BITHUMB_HIGH_KRW      = 500_000_000; // 5억 원 (기관급)

let bithumbWs        = null;
let bithumbHandler   = null;
let bithumbSymbols   = null;
let bithumbDestroyed = false;
let bithumbReconnect = null;

const BITHUMB_MAIN_SYMBOLS = [
  'BTC','ETH','XRP','SOL','ADA','DOGE','AVAX','DOT','LINK','SUI',
  'NEAR','APT','ARB','OP','PEPE','XLM','TON','ATOM','INJ','BNB',
];

function connectBithumbWs() {
  if (bithumbDestroyed || !bithumbHandler) return;
  try {
    const ws = new WebSocket('wss://pubwss.bithumb.com/pub/ws');
    bithumbWs = ws;

    ws.onopen = () => {
      const symbols = (bithumbSymbols || BITHUMB_MAIN_SYMBOLS).map(s => `${s}_KRW`);
      ws.send(JSON.stringify({ type: 'transaction', symbols }));
      bithumbHandler?.({ _connected: true, source: 'bithumb' });
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type !== 'transaction' || !msg.content?.list) return;
        for (const tx of msg.content.list) {
          const tradeAmt = parseFloat(tx.contAmt || 0);
          if (tradeAmt < BITHUMB_THRESHOLD_KRW) continue;
          const symbol = (tx.symbol || '').replace('_KRW', '');
          const side = tx.buySellGb === '2' ? '매수' : '매도';
          const { signal, insight } = getUpbitInsight(side, tradeAmt);
          bithumbHandler?.({
            symbol,
            type:      'whale_trade',
            severity:  tradeAmt >= BITHUMB_HIGH_KRW ? 'high' : 'medium',
            price:     parseFloat(tx.contPrice || 0),
            volume:    parseFloat(tx.contQty || 0),
            tradeAmt,
            side,
            signal,
            insight:   `[빗썸] ${insight}`,
            message:   `${symbol} ${side} ${fmtKrw(tradeAmt)}원`,
            timestamp: Date.now(),
            source:    'bithumb',
          });
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {
      bithumbWs = null;
      if (!bithumbDestroyed) {
        bithumbReconnect = setTimeout(connectBithumbWs, 5000);
      }
    };
  } catch {
    if (!bithumbDestroyed) bithumbReconnect = setTimeout(connectBithumbWs, 5000);
  }
}

export function subscribeBithumbWhaleTrades(symbols, onEvent) {
  bithumbDestroyed = false;
  bithumbSymbols   = symbols;
  bithumbHandler   = onEvent;
  if (bithumbWs) { try { bithumbWs.close(); } catch {} bithumbWs = null; }
  clearTimeout(bithumbReconnect);
  connectBithumbWs();
}

export function unsubscribeBithumbWhaleTrades() {
  bithumbDestroyed = true;
  bithumbHandler   = null;
  bithumbSymbols   = null;
  clearTimeout(bithumbReconnect);
  if (bithumbWs) { try { bithumbWs.close(); } catch {} bithumbWs = null; }
}

// ─── Layer 2: Blockchain.com WebSocket — BTC 온체인 대형 이동 ──────────────
const BTC_WS_URL = 'wss://ws.blockchain.info/inv';
const BTC_WHALE_THRESHOLD = 10; // 10 BTC+ (약 10억원)
let btcWs = null;
let btcDestroyed = false;

/**
 * subscribeBtcWhales(callback)
 * Blockchain.com 미확인 트랜잭션 스트림에서 10 BTC 이상 이동 감지
 * @param {Function} callback - 이벤트 수신 콜백
 */
export function subscribeBtcWhales(callback) {
  btcDestroyed = false;
  connectBtcWs(callback);
}

function connectBtcWs(callback) {
  if (btcDestroyed) return;
  try {
    btcWs = new WebSocket(BTC_WS_URL);
    btcWs.onopen = () => {
      btcWs.send(JSON.stringify({ op: 'unconfirmed_sub' }));
      callback({ _connected: true, chain: 'BTC' });
    };
    btcWs.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.op !== 'utx' || !msg.x) return;
        const tx = msg.x;
        // outputs 합산 (satoshi → BTC)
        const totalBtc = (tx.out || []).reduce((s, o) => s + (o.value || 0), 0) / 1e8;
        if (totalBtc < BTC_WHALE_THRESHOLD) return;
        // 모듈 레벨 BTC KRW 가격 사용 (setWhaleBtcKrwPrice로 주입)
        const amtKrw = totalBtc * currentBtcKrwPrice;
        callback({
          id:        tx.hash?.slice(0, 8) + '-btc',
          symbol:    'BTC',
          chain:     'bitcoin',
          side:      '온체인',
          tradeAmt:  Math.round(amtKrw),
          volume:    parseFloat(totalBtc.toFixed(4)),
          severity:  totalBtc >= 50 ? 'high' : 'normal',
          timestamp: tx.time ? tx.time * 1000 : Date.now(),
          txHash:    tx.hash,
          label:     '온체인 이동',
        });
      } catch { /* 파싱 오류 무시 */ }
    };
    btcWs.onclose = () => {
      if (!btcDestroyed) setTimeout(() => connectBtcWs(callback), 5000);
    };
    btcWs.onerror = (e) => console.warn('[BTC WS]', e.type);
  } catch (e) {
    console.warn('[BTC WS] connect error', e);
    if (!btcDestroyed) setTimeout(() => connectBtcWs(callback), 10000);
  }
}

/**
 * unsubscribeBtcWhales()
 * BTC 온체인 WebSocket 연결 해제
 */
export function unsubscribeBtcWhales() {
  btcDestroyed = true;
  if (btcWs) { btcWs.close(); btcWs = null; }
}

// ─── Layer 3: Whale Alert v1 REST 폴링 (60초 간격) ──────────────────────────
let waTxIds = new Set(); // 중복 방지
let waTimer = null;
let waDestroyed = false;

/**
 * startWhaleAlertPolling(callback)
 * Vercel 프록시(/api/whale-proxy)를 통해 Whale Alert v1 REST API 폴링
 * @param {Function} callback - 이벤트 수신 콜백
 */
export function startWhaleAlertPolling(callback) {
  waDestroyed = false;
  pollWhaleAlert(callback);
  waTimer = setInterval(() => pollWhaleAlert(callback), 60_000);
}

// Upbit 대량 체결 이벤트에 signal + insight 부여
function getUpbitInsight(side, tradeAmt) {
  if (side === '매수') {
    if (tradeAmt >= 5e8) return { signal: 'bullish', insight: '기관/세력 대량 매수 — 단기 상방 압력' };
    if (tradeAmt >= 2e8) return { signal: 'bullish', insight: '대량 매수 체결 — 모멘텀 확인 필요' };
    return { signal: 'bullish', insight: '고래 단일 매수 체결 감지 (1억원+)' };
  }
  if (tradeAmt >= 5e8) return { signal: 'bearish', insight: '대규모 차익실현 — 하락 압력 주의' };
  if (tradeAmt >= 2e8) return { signal: 'bearish', insight: '고래 매도 출현 — 추격매수 주의' };
  return { signal: 'bearish', insight: '고래 단일 매도 체결 감지 (1억원+)' };
}

async function pollWhaleAlert(callback) {
  if (waDestroyed) return;
  try {
    const data = await fetchWhaleProxy(null, 8000);
    const { transactions = [] } = data;
    for (const tx of transactions) {
      if (waTxIds.has(tx.id)) continue;
      waTxIds.add(tx.id);
      // Set 크기가 너무 커지면 오래된 항목 제거
      if (waTxIds.size > 200) waTxIds = new Set([...waTxIds].slice(-100));

      // from/to owner_type 기반 이동 분류
      const fromType = tx.from?.owner_type ?? 'unknown';
      const toType   = tx.to?.owner_type   ?? 'unknown';
      const fromName = tx.from?.owner ?? fromType;
      const toName   = tx.to?.owner   ?? toType;

      const fromIsExchange = fromType === 'exchange';
      const toIsExchange   = toType   === 'exchange';

      let movementType, signal, insight, label;

      if (!fromIsExchange && toIsExchange) {
        movementType = 'exchange_deposit';
        signal       = 'bearish';
        insight      = `${toName} 입금 — 매도 압력 주의`;
        label        = `${fromName} → ${toName} (거래소)`;
      } else if (fromIsExchange && !toIsExchange) {
        movementType = 'exchange_withdrawal';
        signal       = 'bullish';
        insight      = `${fromName} 출금 — HODLing 신호`;
        label        = `${fromName} (거래소) → ${toName}`;
      } else if (fromIsExchange && toIsExchange) {
        movementType = 'exchange_to_exchange';
        signal       = 'neutral';
        insight      = '거래소 간 이동 — 차익거래 또는 유동성 재배치';
        label        = `${fromName} → ${toName}`;
      } else {
        movementType = 'wallet_to_wallet';
        signal       = 'neutral';
        insight      = 'OTC 거래 또는 자산 분산 이동';
        label        = '지갑 → 지갑';
      }

      callback({
        id:           `wa-${tx.id}`,
        symbol:       tx.symbol?.toUpperCase() || '?',
        chain:        tx.blockchain,
        side:         '온체인',
        tradeAmt:     Math.round((tx.amount_usd || 0) * currentKrwRate), // USD→KRW (환율 동적 반영)
        volume:       tx.amount,
        severity:     tx.amount_usd >= 10_000_000 ? 'high' : 'normal',
        timestamp:    (tx.timestamp || 0) * 1000,
        txHash:       tx.hash,
        label,
        source:       'whale-alert',
        // 세분화 필드
        movementType,
        signal,
        insight,
        fromOwner:    fromName,
        toOwner:      toName,
        fromType,
        toType,
      });
    }
  } catch { /* 실패 시 다음 폴링에 재시도 */ }
}

/**
 * stopWhaleAlertPolling()
 * Whale Alert 폴링 중단
 */
export function stopWhaleAlertPolling() {
  waDestroyed = true;
  if (waTimer) { clearInterval(waTimer); waTimer = null; }
}
