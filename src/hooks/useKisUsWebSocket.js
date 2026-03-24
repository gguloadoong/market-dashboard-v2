// KIS WebSocket HDFSCNT0 — 해외주식 실시간 체결 (미장 최대 40종목)
// wss://ops.koreainvestment.com:21000 연결 후 HDFSCNT0(해외주식 체결) 구독
// tr_key 형식: {거래소코드}{종목코드} (예: NASDAAPL, NYSEJPM)

import { useEffect, useRef } from 'react';

const KIS_WS_URL  = 'wss://ops.koreainvestment.com:21000';
const TR_ID       = 'HDFSCNT0';
const MAX_RETRY   = 3;
const RETRY_DELAY = 5000;
const MAX_SYMS    = 40;

// 거래소 코드 매핑 (KIS HDFSCNT0 기준)
// NASD: NASDAQ, NYSE: New York Stock Exchange
const EXCH_MAP = {
  // ── NASDAQ ──────────────────────────────────────
  AAPL: 'NASD', MSFT: 'NASD', NVDA: 'NASD', GOOGL: 'NASD', GOOG:  'NASD',
  AMZN: 'NASD', META: 'NASD', TSLA: 'NASD', AVGO:  'NASD', NFLX:  'NASD',
  AMD:  'NASD', QCOM: 'NASD', COST: 'NASD', CSCO:  'NASD', INTC:  'NASD',
  TXN:  'NASD', PLTR: 'NASD', ARM:  'NASD', MU:    'NASD', AMAT:  'NASD',
  PEP:  'NASD', ADBE: 'NASD', KLAC: 'NASD', LRCX:  'NASD', ASML:  'NASD',
  MRVL: 'NASD', PANW: 'NASD', CRWD: 'NASD', FTNT:  'NASD', MSTR:  'NASD',
  SMCI: 'NASD', DDOG: 'NASD', NET:  'NASD', SNOW:  'NASD', WDAY:  'NASD',
  TEAM: 'NASD', INTU: 'NASD', NOW:  'NASD', ANET:  'NASD', APP:   'NASD',
  TTD:  'NASD', IONQ: 'NASD', COIN: 'NASD', HOOD:  'NASD', SOFI:  'NASD',
  SOUN: 'NASD', RKLB: 'NASD', ASTS: 'NASD', BBAI:  'NASD', RGTI:  'NASD',
  PATH: 'NASD', RIVN: 'NASD', LCID: 'NASD', SHOP:  'NASD', PINS:  'NASD',
  SNAP: 'NASD', SPOT: 'NASD', SBUX: 'NASD',
  // ── NYSE ────────────────────────────────────────
  JPM:  'NYSE', V:    'NYSE', MA:   'NYSE', JNJ:   'NYSE', XOM:   'NYSE',
  WMT:  'NYSE', UNH:  'NYSE', BAC:  'NYSE', LLY:   'NYSE', GS:    'NYSE',
  MS:   'NYSE', HD:   'NYSE', MCD:  'NYSE', KO:    'NYSE', CVX:   'NYSE',
  WFC:  'NYSE', IBM:  'NYSE', MRK:  'NYSE', ABBV:  'NYSE', ORCL:  'NYSE',
  CRM:  'NYSE', PG:   'NYSE', DIS:  'NYSE', NKE:   'NYSE', UBER:  'NYSE',
  BMY:  'NYSE', AMGN: 'NYSE', GILD: 'NYSE', MDT:   'NYSE', DHR:   'NYSE',
  BLK:  'NYSE', AXP:  'NYSE', C:    'NYSE', WBD:   'NYSE', PARA:  'NYSE',
  BA:   'NYSE', CAT:  'NYSE', HON:  'NYSE', DE:    'NYSE', UPS:   'NYSE',
  FDX:  'NYSE', RTX:  'NYSE', LMT:  'NYSE', NOC:   'NYSE', GD:    'NYSE',
  GE:   'NYSE', MMM:  'NYSE', ITW:  'NYSE', EMR:   'NYSE', PH:    'NYSE',
  NEE:  'NYSE', DUK:  'NYSE', SO:   'NYSE', AEP:   'NYSE', D:     'NYSE',
  XOM:  'NYSE', COP:  'NYSE', SLB:  'NYSE', OXY:   'NYSE', EOG:   'NYSE',
  PSX:  'NYSE', VLO:  'NYSE', FCX:  'NYSE', NEM:   'NYSE', LIN:   'NYSE',
  APD:  'NYSE', LOW:  'NYSE', TJX:  'NYSE', MAR:   'NYSE', HLT:   'NYSE',
  CMG:  'NYSE', YUM:  'NYSE', BKNG: 'NYSE', ABNB:  'NYSE', LYFT:  'NYSE',
  VZ:   'NYSE', T:    'NYSE', TMUS: 'NYSE', AMT:   'NYSE', CCI:   'NYSE',
  F:    'NYSE', GM:   'NYSE', DAL:  'NYSE', UAL:   'NYSE', LUV:   'NYSE',
  SCHW: 'NYSE', ICE:  'NYSE', CME:  'NYSE', CB:    'NYSE', MMC:   'NYSE',
  AON:  'NYSE', ISRG: 'NYSE', ELV:  'NYSE', HCA:   'NYSE', CVS:   'NYSE',
  ZTS:  'NYSE', REGN: 'NYSE', VRTX: 'NYSE', SQ:    'NYSE', NVO:   'NYSE',
  RIOT: 'NYSE', MARA: 'NYSE', CLSK: 'NYSE', HUT:   'NYSE', CORZ:  'NYSE',
  // BRK-B 처리 (하이픈 제거)
  'BRK-B': 'NYSE',
};

// tr_key 생성: exchange+symbol (BRK-B → BRKB)
function toTrKey(symbol) {
  const cleaned = symbol.replace(/-/g, '');
  const exch = EXCH_MAP[symbol] ?? 'NASD'; // 불명 종목은 NASDAQ 기본값
  return `${exch}${cleaned}`;
}

// tr_key에서 순수 심볼 추출 (4자리 거래소 코드 제거)
function parseSymbol(trKey) {
  // NASD, NYSE, AMEX, SEHK 등 4자리 거래소 코드
  return trKey.slice(4);
}

/**
 * KIS WebSocket HDFSCNT0 — 해외주식 실시간 체결 구독 훅
 * @param {string[]} symbols  - 종목코드 배열 (예: ['AAPL', 'NVDA']) 최대 40개
 * @param {Function} onQuote  - 콜백: ({ symbol, price, change, changePct }) => void
 */
export function useKisUsWebSocket(symbols, onQuote) {
  const onQuoteRef  = useRef(onQuote);
  const symbolsRef  = useRef(symbols);
  const wsRef       = useRef(null);
  const retryRef    = useRef(0);
  const retryTimer  = useRef(null);
  const mountedRef  = useRef(true);

  useEffect(() => { onQuoteRef.current = onQuote; }, [onQuote]);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);

  useEffect(() => {
    mountedRef.current = true;
    let approvalKey = null;

    async function fetchApprovalKey() {
      try {
        const res = await fetch('/api/hantoo-ws-approval', {
          method: 'POST',
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`Approval 실패: ${res.status}`);
        const data = await res.json();
        return data.approval_key ?? null;
      } catch (e) {
        console.warn('[KIS US WS] approval_key 취득 실패 (폴링 fallback 유지):', e.message);
        return null;
      }
    }

    function subscribe(ws, key, syms) {
      if (!syms?.length) return;
      syms.slice(0, MAX_SYMS).forEach(sym => {
        const tr_key = toTrKey(sym);
        const msg = JSON.stringify({
          header: {
            approval_key:   key,
            custtype:       'P',
            tr_type:        '1',
            'content-type': 'utf-8',
          },
          body: { input: { tr_id: TR_ID, tr_key } },
        });
        ws.send(msg);
      });
    }

    function unsubscribe(ws, key, syms) {
      if (!syms?.length || ws.readyState !== WebSocket.OPEN) return;
      syms.slice(0, MAX_SYMS).forEach(sym => {
        const tr_key = toTrKey(sym);
        const msg = JSON.stringify({
          header: {
            approval_key:   key,
            custtype:       'P',
            tr_type:        '2',
            'content-type': 'utf-8',
          },
          body: { input: { tr_id: TR_ID, tr_key } },
        });
        try { ws.send(msg); } catch {}
      });
    }

    // HDFSCNT0 파이프 메시지 파싱
    // 형식: `0|HDFSCNT0|001|NASDAAPL^1^20250325^153012^225.43^1^1.23^0.55^...`
    // 필드 (^ 구분, index):
    //   0: RSYM     거래소코드+종목코드 (예: NASDAAPL)
    //   1: ZDIV     소수점 자리수
    //   2: XYMD     일자 (YYYYMMDD)
    //   3: XHMS     시각 (HHmmss)
    //   4: CLOS     현재가
    //   5: SIGN     부호 (1/2=상승, 4/5=하락, 3=보합)
    //   6: DIFF     전일대비 절대값
    //   7: RATE     등락률 (%)
    function parsePipeMessage(raw) {
      const parts = raw.split('|');
      if (parts.length < 4) return null;
      if (parts[1] !== TR_ID) return null;

      const fields   = parts[3].split('^');
      if (fields.length < 8) return null;

      const rsym     = fields[0];                    // 거래소+종목코드
      const symbol   = parseSymbol(rsym);            // 순수 종목코드
      const price    = parseFloat(fields[4]);
      const sign     = fields[5];
      const absChg   = parseFloat(fields[6]);
      const changePct = parseFloat(fields[7]);

      if (!symbol || isNaN(price) || price <= 0) return null;

      const isNeg  = sign === '4' || sign === '5';
      const change = isNeg ? -absChg : absChg;

      return {
        symbol,
        price,
        change:    parseFloat(change.toFixed(2)),
        changePct: isNeg ? -Math.abs(changePct) : changePct,
      };
    }

    function connect(key) {
      if (!mountedRef.current) return;

      const ws = new WebSocket(KIS_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        retryRef.current = 0;
        subscribe(ws, key, symbolsRef.current);
      };

      ws.onmessage = (event) => {
        const raw = event.data;
        if (typeof raw !== 'string' || raw.startsWith('{')) return;
        const quote = parsePipeMessage(raw);
        if (quote) onQuoteRef.current?.(quote);
      };

      ws.onerror = (e) => {
        console.warn('[KIS US WS] 오류:', e?.message ?? 'WebSocket error');
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        if (retryRef.current < MAX_RETRY) {
          retryRef.current += 1;
          console.warn(`[KIS US WS] 연결 끊김 — ${RETRY_DELAY / 1000}초 후 재연결 (${retryRef.current}/${MAX_RETRY})`);
          retryTimer.current = setTimeout(() => {
            if (mountedRef.current) connect(key);
          }, RETRY_DELAY);
        } else {
          console.warn('[KIS US WS] 최대 재연결 횟수 초과 — 폴링 fallback으로 동작');
        }
      };
    }

    fetchApprovalKey().then(key => {
      if (!mountedRef.current || !key) return;
      approvalKey = key;
      connect(key);
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimer.current);
      const ws = wsRef.current;
      if (ws) {
        if (approvalKey) unsubscribe(ws, approvalKey, symbolsRef.current);
        ws.onclose = null;
        ws.close();
        wsRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
