// 종목 뉴스 매칭 — 별칭 딕셔너리 + 스마트 키워드 빌더
//
// 설계 원칙:
//   1. 짧은 종목명(≤2자)은 단독 출현 매칭 (단어 경계) — LG/SK 거짓 양성 방지
//   2. 별칭 딕셔너리: 한국어명 ↔ 영문명 매핑으로 커버리지 확대
//   3. 6자리 국장 코드는 키워드에서 제외
//   4. 영문 종목명의 첫 단어만 사용 (불필요한 공통 단어 매칭 방지)

// ─── 종목 별칭 딕셔너리 ───────────────────────────────────────
// 한국어 종목명 → 추가 검색 키워드 배열
export const KR_ALIASES = {
  '삼성전자':         ['samsung electronics', 'samsung', '삼성'],
  'SK하이닉스':       ['sk hynix', 'hynix', '하이닉스'],
  'LG에너지솔루션':   ['lg energy', 'lges'],
  '현대차':           ['hyundai', '현대자동차'],
  '현대자동차':       ['hyundai', '현대차'],
  '기아':             ['kia'],
  '카카오':           ['kakao'],
  '네이버':           ['naver'],
  '셀트리온':         ['celltrion'],
  'POSCO홀딩스':      ['posco'],
  'LG화학':           ['lg chem', 'lg화학'],
  '현대모비스':       ['mobis'],
  'KB금융':           ['kb financial'],
  '신한지주':         ['shinhan'],
  '에코프로비엠':     ['ecopro'],
  '에코프로':         ['ecopro'],
  '삼성바이오로직스': ['samsung biologics', 'samsung bio'],
  '삼성SDI':          ['samsung sdi'],
  'LG전자':           ['lg electronics'],
  '삼성전기':         ['samsung electro', 'electro-mechanics', '삼성전기'],
  'SK이노베이션':     ['sk innovation', 'sk이노'],
  '포스코퓨처엠':     ['posco future m', '포스코퓨처'],
  '알테오젠':         ['alteogen'],
  '한미약품':         ['hanmi pharm', 'hanmi'],
  '삼성물산':         ['samsung c&t'],
  'SK텔레콤':         ['sk telecom', 'skt'],
  'KT':               ['kt corp', 'kt telecop'],
  'SK':               ['sk holdco', 'sk지주'],
  'LG':               ['lg지주', 'lg holdco'],
  '한화에어로스페이스': ['hanwha aerospace', '한화에어로'],
  '한화':             ['hanwha'],
  '두산에너빌리티':   ['doosan enerbility', '두산'],
  '현대중공업':       ['hhi', '현대중공'],
  '삼성생명':         ['samsung life'],
  'LG디스플레이':     ['lg display', 'lgd'],
  '고려아연':         ['korea zinc'],
  '크래프톤':         ['krafton', 'pubg'],
  'NAVER':            ['naver', '네이버'],
  '카카오뱅크':       ['kakaobank'],
};

// 코인 별칭
export const COIN_ALIASES = {
  BTC:  ['bitcoin', 'btc', '비트코인'],
  ETH:  ['ethereum', 'eth', '이더리움', 'ether'],
  XRP:  ['ripple', 'xrp', '리플'],
  SOL:  ['solana', 'sol', '솔라나'],
  ADA:  ['cardano', 'ada', '에이다'],
  DOGE: ['dogecoin', 'doge', '도지'],
  BNB:  ['binance', 'bnb'],
  AVAX: ['avalanche', 'avax'],
  DOT:  ['polkadot', '폴카닷'],
  LINK: ['chainlink', '체인링크'],
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

// ─── "짧은" 키워드 판정 ─────────────────────────────────────
// 영문 2자 이하 or 한글 2자 이하 → 단어 경계 매칭 필요
function isShortKeyword(kw) {
  const hasCJK = /[\u4e00-\u9fff\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]/.test(kw);
  if (hasCJK) {
    // 한글/한자 포함 시: 2글자 이하면 짧다고 간주
    const cjkLen = (kw.match(/[\u4e00-\u9fff\uac00-\ud7af]/g) || []).length;
    return cjkLen <= 2 && kw.length <= 3;
  }
  // 영문/숫자: 2자 이하
  return kw.length <= 2;
}

// ─── 키워드 배열 생성 ────────────────────────────────────────
// market: 'KR' | 'US' | 'COIN'
export function buildStockKeywords(symbol, name, market) {
  const keys = new Set();

  if (market === 'KR') {
    // 국장: 심볼(6자리 코드)은 제외, 이름만 사용
    if (name) {
      keys.add(name.toLowerCase());
      // 영문 이름이 있는 경우 첫 단어
      const firstWord = name.split(/[\s/]/)[0].toLowerCase();
      if (firstWord !== name.toLowerCase() && firstWord.length >= 2) {
        keys.add(firstWord);
      }
    }
    // 별칭 딕셔너리
    const aliases = KR_ALIASES[name] || [];
    aliases.forEach(a => keys.add(a.toLowerCase()));
  } else if (market === 'COIN') {
    // 코인: symbol(BTC 등) + 별칭
    if (symbol) keys.add(symbol.toLowerCase());
    if (name)   keys.add(name.toLowerCase());
    const aliases = COIN_ALIASES[symbol?.toUpperCase()] || [];
    aliases.forEach(a => keys.add(a.toLowerCase()));
  } else {
    // 미국 주식: symbol + 이름 첫 단어
    if (symbol) keys.add(symbol.toLowerCase());
    if (name) {
      const firstWord = name.split(/[\s,./]/)[0].toLowerCase();
      if (firstWord.length >= 2) keys.add(firstWord);
    }
  }

  return [...keys].filter(k => k.length >= 2 && !/^\d{6}$/.test(k));
}

// ─── 스마트 텍스트 매칭 ────────────────────────────────────
// 짧은 키워드(≤2자)는 단어 경계 매칭, 긴 것은 includes
export function matchesKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some(kw => {
    if (isShortKeyword(kw)) {
      // 단어 경계: 앞뒤가 공백/문장부호/시작/끝이어야 함
      // 한글 조사(가,이,을,의...)가 붙은 경우도 허용 (예: 기아가)
      try {
        const re = new RegExp(
          '(?:^|[\\s,;:·\\-（("\'「【]|(?<=[\\s,;:·\\-（("\'「【]))' +
          escapeRe(kw) +
          '(?=[\\s,;:·\\-）)"\'」】가이을를의에서는은도만과와로]|$)',
          'i'
        );
        return re.test(lowerText);
      } catch {
        // lookbehind 미지원 환경 fallback
        return new RegExp('(?:^|\\s)' + escapeRe(kw) + '(?=\\s|$|[가이을를의에서는은도만과와로])', 'i').test(lowerText);
      }
    }
    return lowerText.includes(kw);
  });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
