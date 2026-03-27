// KIS (한국투자증권) WebSocket 실시간 국장 가격 스트림 훅
// wss://ops.koreainvestment.com:21000 연결 후 H0STCNT0(주식 체결) 구독
// 마운트 시 통합 게이트웨이에서 approval_key 취득
// 언마운트 시 구독 해제 + 소켓 close

import { useEffect, useRef } from 'react';
import { fetchWsApproval } from '../api/_gateway.js';

const KIS_WS_URL     = 'wss://ops.koreainvestment.com:21000';
const TR_ID          = 'H0STCNT0';
const MAX_RETRY      = 3;
const RETRY_DELAY_MS = 5000;
const KEY_TTL_MS     = 23 * 60 * 60 * 1000; // 23h — 한투 approval_key 24h 만료 1h 전 자동 갱신

/**
 * KIS WebSocket 실시간 체결 가격 구독 훅
 * @param {string[]} symbols    - 종목코드 배열 (예: ['005930', '000660'])
 * @param {Function} onQuote    - 콜백: ({ symbol, price, change, changePct }) => void
 */
export function useKisWebSocket(symbols, onQuote) {
  // 최신 콜백·symbols을 ref로 유지 → 재연결 시 클로저 문제 방지
  const onQuoteRef      = useRef(onQuote);
  const symbolsRef      = useRef(symbols);
  const wsRef           = useRef(null);
  const retryRef        = useRef(0);
  const retryTimer      = useRef(null);
  const keyRefreshTimer = useRef(null);
  const mountedRef      = useRef(true);

  // 콜백·symbols 최신값 동기화 (재연결 없이)
  useEffect(() => { onQuoteRef.current = onQuote; }, [onQuote]);
  useEffect(() => { symbolsRef.current = symbols; }, [symbols]);

  useEffect(() => {
    mountedRef.current = true;
    let approvalKey = null;

    // ── approval_key 취득 ──────────────────────────────────────
    async function fetchApprovalKey() {
      try {
        const data = await fetchWsApproval(8000);
        return data.approval_key ?? null;
      } catch (e) {
        // 조용히 실패 — 폴링 fallback이 계속 동작함
        console.warn('[KIS WS] approval_key 취득 실패 (폴링 fallback 유지):', e.message);
        return null;
      }
    }

    // ── 구독 메시지 전송 ───────────────────────────────────────
    function subscribe(ws, key, syms) {
      if (!syms?.length) return;
      // 최대 40개 제한 (H0STCNT0 세션당 40개)
      syms.slice(0, 40).forEach(tr_key => {
        const msg = JSON.stringify({
          header: {
            approval_key:   key,
            custtype:       'P',      // 개인
            tr_type:        '1',      // 등록
            'content-type': 'utf-8',
          },
          body: {
            input: { tr_id: TR_ID, tr_key },
          },
        });
        ws.send(msg);
      });
    }

    // ── 구독 해제 메시지 전송 ──────────────────────────────────
    function unsubscribe(ws, key, syms) {
      if (!syms?.length || ws.readyState !== WebSocket.OPEN) return;
      syms.slice(0, 40).forEach(tr_key => {
        const msg = JSON.stringify({
          header: {
            approval_key:   key,
            custtype:       'P',
            tr_type:        '2',      // 해제
            'content-type': 'utf-8',
          },
          body: {
            input: { tr_id: TR_ID, tr_key },
          },
        });
        try { ws.send(msg); } catch {}
      });
    }

    // ── 실시간 체결 응답 파싱 ─────────────────────────────────
    // 형식: `0|H0STCNT0|001|005930^153012^62900^5^3100^0.51^...`
    // | 구분자: [헤더구분|TR_ID|데이터건수|데이터]
    // ^ 구분자 필드 (index):
    //   0: MKSC_SHRN_ISCD (종목코드)
    //   2: STCK_PRPR      (현재가)
    //   3: PRDY_VRSS_SIGN (부호: 1=상한,2=상승,3=보합,4=하한,5=하락)
    //   4: PRDY_VRSS      (전일대비, 부호없는 절댓값)
    //   5: PRDY_CTRT      (등락률, %)
    function parsePipeMessage(raw) {
      const parts = raw.split('|');
      // 최소 4개 파트 필요: [recvType, trId, dataCount, data]
      if (parts.length < 4) return null;
      const trId = parts[1];
      if (trId !== TR_ID) return null;

      const fields = parts[3].split('^');
      const symbol   = fields[0];
      const price    = parseFloat(fields[2]);
      const sign     = fields[3]; // '1','2': 상승 / '4','5': 하락 / '3': 보합
      const absChg   = parseFloat(fields[4]);
      const changePct = parseFloat(fields[5]);

      if (!symbol || isNaN(price)) return null;

      // 부호 적용
      const isNeg = sign === '4' || sign === '5';
      const change = isNeg ? -absChg : absChg;

      return { symbol, price, change, changePct: isNeg ? -Math.abs(changePct) : changePct };
    }

    // ── WebSocket 연결 ─────────────────────────────────────────
    function connect(key) {
      if (!mountedRef.current) return;

      const ws = new WebSocket(KIS_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        retryRef.current = 0; // 연결 성공 → 재시도 카운터 초기화
        subscribe(ws, key, symbolsRef.current);
      };

      ws.onmessage = (event) => {
        const raw = event.data;
        if (typeof raw !== 'string') return;

        // JSON 응답 (PINGPONG, 구독확인 등) — 무시
        if (raw.startsWith('{')) return;

        const quote = parsePipeMessage(raw);
        if (quote) {
          onQuoteRef.current?.(quote);
        }
      };

      ws.onerror = (e) => {
        console.warn('[KIS WS] 오류:', e?.message ?? 'WebSocket error');
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        // 최대 재연결 횟수 이하일 때만 재시도
        if (retryRef.current < MAX_RETRY) {
          retryRef.current += 1;
          console.warn(`[KIS WS] 연결 끊김 — ${RETRY_DELAY_MS / 1000}초 후 재연결 (${retryRef.current}/${MAX_RETRY})`);
          retryTimer.current = setTimeout(() => {
            if (mountedRef.current) connect(key);
          }, RETRY_DELAY_MS);
        } else {
          console.warn('[KIS WS] 최대 재연결 횟수 초과 — 폴링 fallback으로 동작');
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
        approvalKey = newKey;
        clearTimeout(retryTimer.current);
        const oldWs = wsRef.current;
        if (oldWs) { oldWs.onclose = null; oldWs.close(); wsRef.current = null; }
        retryRef.current = 0;
        connect(newKey);
        scheduleKeyRefresh();
      }, KEY_TTL_MS);
    }

    // ── 초기 실행: approval_key 취득 후 연결 ─────────────────
    fetchApprovalKey().then(key => {
      if (!mountedRef.current || !key) return;
      approvalKey = key;
      connect(key);
      scheduleKeyRefresh();
    });

    // ── 클린업: 구독 해제 + 소켓 닫기 ───────────────────────
    return () => {
      mountedRef.current = false;
      clearTimeout(retryTimer.current);
      clearTimeout(keyRefreshTimer.current);
      const ws = wsRef.current;
      if (ws) {
        if (approvalKey) unsubscribe(ws, approvalKey, symbolsRef.current);
        ws.onclose = null;
        ws.close();
        wsRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // symbols, onQuote 변경은 ref로 반영 → 재연결 없이 최신값 유지
}
