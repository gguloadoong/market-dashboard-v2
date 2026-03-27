// KIS WebSocket HDFSCNT0 — 해외주식 실시간 체결 (미장 최대 40종목)
// wss://ops.koreainvestment.com:21000 연결 후 HDFSCNT0(해외주식 체결) 구독
// tr_key 형식: {거래소코드}{종목코드} (예: NASDAAPL, NYSEJPM)

import { useEffect, useRef } from 'react';
import { fetchWsApproval } from '../api/_gateway.js';

const KIS_WS_URL  = 'wss://ops.koreainvestment.com:21000';
const TR_ID       = 'HDFSCNT0';
const MAX_RETRY   = 3;
const RETRY_DELAY = 5000;
const MAX_SYMS    = 40;
const KEY_TTL_MS  = 23 * 60 * 60 * 1000; // 23h — 한투 approval_key 24h 만료 1h 전 자동 갱신

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
  SNAP: 'NASD', SPOT: 'NASD', SBUX: 'NASD', MRNA:  'NASD', BIIB:  'NASD',
  ADSK: 'NASD', CDNS: 'NASD', SNPS: 'NASD', ADP:   'NASD', PAYX:  'NASD',
  CTAS: 'NASD', MDLZ: 'NASD', TMUS: 'NASD',
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
  COP:  'NYSE', SLB:  'NYSE', OXY:  'NYSE', EOG:   'NYSE', PSX:   'NYSE',
  VLO:  'NYSE', FCX:  'NYSE', NEM:  'NYSE', LIN:   'NYSE', APD:   'NYSE',
  LOW:  'NYSE', TJX:  'NYSE', MAR:  'NYSE', HLT:   'NYSE', CMG:   'NYSE',
  YUM:  'NYSE', BKNG: 'NYSE', ABNB: 'NYSE', LYFT:  'NYSE',
  VZ:   'NYSE', T:    'NYSE', AMT:  'NYSE', CCI:   'NYSE',
  F:    'NYSE', GM:   'NYSE', DAL:  'NYSE', UAL:   'NYSE', LUV:   'NYSE',
  SCHW: 'NYSE', ICE:  'NYSE', CME:  'NYSE', CB:    'NYSE', MMC:   'NYSE',
  AON:  'NYSE', ISRG: 'NYSE', ELV:  'NYSE', HCA:   'NYSE', CVS:   'NYSE',
  ZTS:  'NYSE', REGN: 'NYSE', VRTX: 'NYSE', SQ:    'NYSE', NVO:   'NYSE',
  RIOT: 'NYSE', MARA: 'NYSE', CLSK: 'NYSE', HUT:   'NYSE', CORZ:  'NYSE',
  // S&P 500 추가 종목 (NYSE)
  TMO:  'NYSE', BSX:  'NYSE', SYK:  'NYSE', IQV:   'NYSE',
  SPGI: 'NYSE', MCO:  'NYSE', PM:   'NYSE', MO:    'NYSE',
  KMB:  'NYSE', CL:   'NYSE', UNP:  'NYSE', NSC:   'NYSE',
  WM:   'NYSE', SHW:  'NYSE', ECL:  'NYSE', PLD:   'NYSE',
  O:    'NYSE', BDX:  'NYSE', EW:   'NYSE',
  // BRK-B (하이픈 포함 심볼 — 키는 원본 그대로)
  'BRK-B': 'NYSE',
};

// tr_key → 원본 심볼 역매핑 (BRK-B 등 하이픈 종목 복원용)
const trKeyToSymbol = new Map();

// tr_key 생성: exchange+symbol (BRK-B → BRKB 하이픈 제거)
function toTrKey(symbol) {
  const cleaned = symbol.replace(/-/g, '');
  const exch    = EXCH_MAP[symbol] ?? 'NASD'; // 매핑 없으면 NASDAQ 기본값
  const trKey   = `${exch}${cleaned}`;
  trKeyToSymbol.set(trKey.toUpperCase(), symbol); // 역매핑 저장
  return trKey;
}

// tr_key에서 원본 심볼 복원 (역매핑 우선, 없으면 4자리 거래소 코드 제거)
function parseSymbol(trKey) {
  return trKeyToSymbol.get(trKey.toUpperCase()) ?? trKey.slice(4);
}

/**
 * KIS WebSocket HDFSCNT0 — 해외주식 실시간 체결 구독 훅
 * @param {string[]} symbols  - 종목코드 배열 (예: ['AAPL', 'NVDA']) 최대 40개
 * @param {Function} onQuote  - 콜백: ({ symbol, price, change, changePct }) => void
 */
export function useKisUsWebSocket(symbols, onQuote) {
  const onQuoteRef      = useRef(onQuote);
  const symbolsRef      = useRef(symbols);
  const prevSymbolsRef  = useRef([]);
  const wsRef           = useRef(null);
  const approvalKeyRef  = useRef(null);
  const retryRef        = useRef(0);
  const retryTimer      = useRef(null);
  const keyRefreshTimer = useRef(null);
  const mountedRef      = useRef(true);

  useEffect(() => { onQuoteRef.current = onQuote; }, [onQuote]);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);

  // ── 구독/해제 헬퍼 ──────────────────────────────────────────────
  function sendSubscribe(ws, key, syms, trType) {
    if (!syms?.length || ws.readyState !== WebSocket.OPEN) return;
    syms.forEach(sym => {
      try {
        ws.send(JSON.stringify({
          header: {
            approval_key:   key,
            custtype:       'P',
            tr_type:        trType, // '1'=등록, '2'=해제
            'content-type': 'utf-8',
          },
          body: { input: { tr_id: TR_ID, tr_key: toTrKey(sym) } },
        }));
      } catch {}
    });
  }

  // ── symbols 변경 시 diff 기반 구독 갱신 ────────────────────────
  useEffect(() => {
    const next = symbols.slice(0, MAX_SYMS);
    const prev = prevSymbolsRef.current;
    prevSymbolsRef.current = next;

    const ws  = wsRef.current;
    const key = approvalKeyRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !key) return;

    const prevSet = new Set(prev.map(toTrKey));
    const nextSet = new Set(next.map(toTrKey));

    const toRemove = prev.filter(s => !nextSet.has(toTrKey(s)));
    const toAdd    = next.filter(s => !prevSet.has(toTrKey(s)));

    if (toRemove.length) sendSubscribe(ws, key, toRemove, '2');
    if (toAdd.length)    sendSubscribe(ws, key, toAdd,    '1');
  }, [symbols]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── HDFSCNT0 파이프 메시지 파싱 ────────────────────────────────
  // 형식: `0|HDFSCNT0|001|NASDAAPL^1^20250325^153012^225.43^1^1.23^0.55^...`
  // 필드 (^ 구분):
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

    const fields    = parts[3].split('^');
    if (fields.length < 8) return null;

    const symbol    = parseSymbol(fields[0]);
    const price     = parseFloat(fields[4]);
    const sign      = fields[5];
    const absChg    = parseFloat(fields[6]);
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

  // ── WebSocket 연결 관리 ─────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    async function fetchApprovalKey() {
      try {
        const data = await fetchWsApproval(8000);
        return data.approval_key ?? null;
      } catch (e) {
        console.warn('[KIS US WS] approval_key 취득 실패 (폴링 fallback 유지):', e.message);
        return null;
      }
    }

    function connect(key) {
      if (!mountedRef.current) return;

      const ws = new WebSocket(KIS_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        retryRef.current = 0;
        const syms = symbolsRef.current.slice(0, MAX_SYMS);
        prevSymbolsRef.current = syms;
        sendSubscribe(ws, key, syms, '1');
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

    // approval_key 갱신 + WS 재연결 (23시간마다 자동 실행)
    function scheduleKeyRefresh() {
      clearTimeout(keyRefreshTimer.current);
      keyRefreshTimer.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        const newKey = await fetchApprovalKey();
        if (!mountedRef.current || !newKey) return;
        approvalKeyRef.current = newKey;
        // 기존 WS 정리 후 새 키로 재연결
        clearTimeout(retryTimer.current);
        const oldWs = wsRef.current;
        if (oldWs) { oldWs.onclose = null; oldWs.close(); wsRef.current = null; }
        retryRef.current = 0;
        prevSymbolsRef.current = [];
        connect(newKey);
        scheduleKeyRefresh(); // 다음 갱신 예약
      }, KEY_TTL_MS);
    }

    fetchApprovalKey().then(key => {
      if (!mountedRef.current || !key) return;
      approvalKeyRef.current = key;
      connect(key);
      scheduleKeyRefresh();
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimer.current);
      clearTimeout(keyRefreshTimer.current);
      const ws  = wsRef.current;
      const key = approvalKeyRef.current;
      if (ws) {
        if (key) sendSubscribe(ws, key, prevSymbolsRef.current, '2');
        ws.onclose = null;
        ws.close();
        wsRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
