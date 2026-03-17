// Upbit WebSocket 코인 가격 실시간 스트림
//
// 기존 10초 폴링을 보완: WS가 연결되면 <1초 단위로 가격 갱신
// WS 끊김 → 5초 후 자동 재연결 (whale.js와 동일 패턴)
// 폴링은 WS 연결 여부와 무관하게 유지 (fallback)

let coinWs          = null;
let coinHandler     = null;
let coinMarkets     = null;
let coinReconnTimer = null;
let coinDestroyed   = false;

function connectCoinWs() {
  if (coinDestroyed || !coinMarkets || !coinHandler) return;

  try {
    const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
    coinWs = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify([
        { ticket: `coin-ticker-${Date.now()}` },
        { type: 'ticker', codes: coinMarkets },
        { format: 'DEFAULT' },
      ]));
      coinHandler?.({ _connected: true });
    };

    ws.onmessage = async (evt) => {
      let text;
      if (evt.data instanceof Blob)             text = await evt.data.text();
      else if (evt.data instanceof ArrayBuffer) text = new TextDecoder().decode(evt.data);
      else                                      text = evt.data;

      try {
        const d = JSON.parse(text);
        if (d.type !== 'ticker') return;

        const sym = (d.code || '').replace('KRW-', '');
        coinHandler?.({
          symbol:       sym,
          priceKrw:     d.trade_price,
          change24h:    d.signed_change_rate * 100,
          volume24hKrw: d.acc_trade_price_24h,
          high24hKrw:   d.high_price,
          low24hKrw:    d.low_price,
          timestamp:    Date.now(),
        });
      } catch {}
    };

    ws.onerror  = () => {};
    ws.onclose  = () => {
      coinWs = null;
      if (!coinDestroyed) {
        coinReconnTimer = setTimeout(connectCoinWs, 5000);
      }
    };
  } catch {
    if (!coinDestroyed) coinReconnTimer = setTimeout(connectCoinWs, 5000);
  }
}

/**
 * subscribeCoinPrices(symbols, onTick)
 * @param {string[]} symbols   - ['BTC','ETH', ...]
 * @param {Function} onTick    - 가격 업데이트 콜백 or { _connected: true }
 */
export function subscribeCoinPrices(symbols, onTick) {
  coinDestroyed = false;
  coinMarkets   = symbols.map(s => `KRW-${s}`);
  coinHandler   = onTick;

  if (coinWs) { try { coinWs.close(); } catch {} coinWs = null; }
  clearTimeout(coinReconnTimer);
  connectCoinWs();
}

/**
 * unsubscribeCoinPrices()
 * WebSocket 연결 해제
 */
export function unsubscribeCoinPrices() {
  coinDestroyed = true;
  coinHandler   = null;
  coinMarkets   = null;
  clearTimeout(coinReconnTimer);
  if (coinWs) { try { coinWs.close(); } catch {} coinWs = null; }
}
