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
  '기아':             ['kia', '기아차'],
  '카카오':           ['kakao'],
  '네이버':           ['naver'],
  '셀트리온':         ['celltrion'],
  'POSCO홀딩스':      ['posco'],
  'LG화학':           ['lg chem', 'lg화학'],
  '현대모비스':       ['mobis'],
  'KB금융':           ['kb financial', 'kb국민'],
  '신한지주':         ['shinhan', '신한'],
  '에코프로비엠':     ['ecopro bm', 'ecopro', '에코프로'],
  '에코프로':         ['ecopro', '에코프로비엠'],
  '삼성바이오로직스': ['samsung biologics', 'samsung bio', '삼성바이오'],
  '삼성SDI':          ['samsung sdi', '삼성sdi'],
  'LG전자':           ['lg electronics', 'lg전자'],
  '삼성전기':         ['samsung electro', 'electro-mechanics', '삼성전기'],
  'SK이노베이션':     ['sk innovation', 'sk이노'],
  '포스코퓨처엠':     ['posco future m', '포스코퓨처', 'posco future'],
  '알테오젠':         ['alteogen'],
  '한미약품':         ['hanmi pharm', 'hanmi', '한미'],
  '삼성물산':         ['samsung c&t', '삼성물산'],
  'SK텔레콤':         ['sk telecom', 'skt'],
  'KT':               ['kt corp', 'kt telecom'],
  'SK':               ['sk holdco', 'sk지주'],
  'LG':               ['lg지주', 'lg holdco'],
  '한화에어로스페이스': ['hanwha aerospace', '한화에어로', 'hanwha aero'],
  '한화':             ['hanwha'],
  '두산에너빌리티':   ['doosan enerbility', '두산에너빌', 'doosan'],
  '현대중공업':       ['hhi', '현대중공', 'hyundai heavy'],
  '삼성생명':         ['samsung life', '삼성생명'],
  'LG디스플레이':     ['lg display', 'lgd'],
  '고려아연':         ['korea zinc', '고려아연'],
  '크래프톤':         ['krafton', 'pubg', '배틀그라운드'],
  'NAVER':            ['naver', '네이버'],
  '카카오뱅크':       ['kakaobank', '카카오뱅크'],
  // 금융
  '하나금융지주':     ['hana financial', '하나금융', 'hana bank'],
  '우리금융지주':     ['woori financial', '우리금융', 'woori bank'],
  '미래에셋증권':     ['mirae asset', '미래에셋'],
  '삼성증권':         ['samsung securities', '삼성증권'],
  'NH투자증권':       ['nh investment', 'nh투자'],
  '키움증권':         ['kiwoom', '키움'],
  // 바이오/헬스
  '유한양행':         ['yuhan', '유한'],
  '한국콜마':         ['kolmar', '콜마'],
  '코스맥스':         ['cosmax', '코스맥스'],
  '셀트리온헬스케어': ['celltrion healthcare', '셀트리온헬스'],
  '휴젤':             ['hugel'],
  '메디톡스':         ['medytox', '메디톡스'],
  '씨젠':             ['seegene', '씨젠'],
  '펄어비스':         ['pearl abyss', '검은사막'],
  '엔씨소프트':       ['ncsoft', 'nc소프트', '리니지'],
  '넥슨':             ['nexon'],
  '카카오게임즈':     ['kakao games', '카카오게임'],
  // 반도체/장비
  '한미반도체':       ['hana microdisplay', 'hanmi semiconductor', '한미반도체'],
  'DB하이텍':         ['db hitek', 'db하이텍'],
  '피에스케이':       ['psk', '피에스케이'],
  '원익IPS':          ['wonik ips', '원익'],
  // 2차전지
  '포스코인터내셔널': ['posco international', '포스코인터'],
  '엘앤에프':         ['l&f', 'lnf', '엘앤에프'],
  '코스모신소재':     ['cosmo am&t', '코스모'],
  // 자동차/부품
  '현대위아':         ['hyundai wia', '현대위아'],
  '현대글로비스':     ['hyundai glovis', '글로비스'],
  '만도':             ['mando'],
  // 건설/인프라
  '삼성엔지니어링':   ['samsung engineering', '삼성엔지니어링'],
  '현대건설':         ['hyundai engineering', '현대건설'],
  'GS건설':           ['gs engineering', 'gs건설'],
  // 통신
  'KT&G':             ['kt&g', '케이티앤지'],
  'LG유플러스':       ['lg uplus', 'lg u+'],
  // 유통/소비
  '이마트':           ['e-mart', 'emart', '이마트'],
  '롯데쇼핑':         ['lotte shopping', '롯데'],
  'CJ제일제당':       ['cj cheiljedang', 'cj제일', '제일제당'],
  '오리온':           ['orion'],
  '하이브':           ['hybe', '방탄소년단', 'bts'],
  'SM엔터테인먼트':   ['sm entertainment', 'sm엔터', 'sm entertai'],
  'JYP엔터테인먼트':  ['jyp entertainment', 'jyp엔터'],
  'YG엔터테인먼트':   ['yg entertainment', 'yg엔터'],
};

// 미국 주식 별칭 — 한국 언론이 영문 대신 한국어로 표기하는 경우 커버
export const US_ALIASES = {
  'NVDA':  ['엔비디아', 'nvidia'],
  'AAPL':  ['애플', 'apple'],
  'MSFT':  ['마이크로소프트', 'microsoft'],
  'GOOGL': ['구글', '알파벳', 'google', 'alphabet'],
  'GOOG':  ['구글', '알파벳', 'google', 'alphabet'],
  'META':  ['메타', '페이스북', 'facebook'],
  'AMZN':  ['아마존', 'amazon'],
  'TSLA':  ['테슬라', 'tesla'],
  'AMD':   ['에이엠디', 'advanced micro'],
  'INTC':  ['인텔', 'intel'],
  'QCOM':  ['퀄컴', 'qualcomm'],
  'AVGO':  ['브로드컴', 'broadcom'],
  'TSM':   ['tsmc', 'taiwan semiconductor', '대만 반도체'],
  'MU':    ['마이크론', 'micron'],
  'ASML':  ['asml'],
  'ARM':   ['arm holdings', 'arm chip'],
  'SMCI':  ['슈퍼마이크로', 'supermicro'],
  'PLTR':  ['팔란티어', 'palantir'],
  'NFLX':  ['넷플릭스', 'netflix'],
  'DIS':   ['디즈니', 'disney'],
  'JPM':   ['jp모건', 'jpmorgan', 'jp morgan'],
  'GS':    ['골드만삭스', 'goldman sachs'],
  'BAC':   ['뱅크오브아메리카', 'bank of america'],
  'XOM':   ['엑슨모빌', 'exxon', '유가', '원유', 'wti', '브렌트', '오일', 'oil', 'crude', 'opec', '에너지주'],
  'CVX':   ['셰브론', 'chevron', '유가', '원유', 'wti', '브렌트', '오일', 'oil', 'opec'],
  'SLB':   ['슐럼버거', 'schlumberger', '유전', '시추', 'drilling'],
  'COP':   ['코노코필립스', 'conocophillips'],
  'OXY':   ['옥시덴털', 'occidental'],
  'COIN':  ['코인베이스', 'coinbase'],
  'MSTR':  ['마이크로스트래티지', 'microstrategy'],
  'MARA':  ['마라 홀딩스', 'marathon digital'],
  'SPY':   ['s&p', 'sp500', 's&p500'],
  'QQQ':   ['나스닥', 'nasdaq'],
  'SOXL':  ['반도체 etf', 'semiconductor'],
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
    // 미국 주식: symbol + 이름 첫 단어 + US_ALIASES (한국어 표기 포함)
    if (symbol) keys.add(symbol.toLowerCase());
    if (name) {
      const firstWord = name.split(/[\s,./]/)[0].toLowerCase();
      if (firstWord.length >= 2) keys.add(firstWord);
    }
    const usAliases = US_ALIASES[symbol?.toUpperCase()] || [];
    usAliases.forEach(a => keys.add(a.toLowerCase()));
  }

  return [...keys].filter(k => k.length >= 2 && !/^\d{6}$/.test(k));
}

// ─── 짧은 영문 키워드 — 다른 단어의 부분 문자열이 되기 쉬운 것들 ──
// 이 목록에 포함된 키워드는 길이와 무관하게 항상 단어 경계 매칭 적용
const BOUNDARY_FORCE = new Set([
  'arm', 'meta', 'coin', 'near', 'ton', 'uni', 'link', 'sand',
  'atom', 'op', 'sol', 'apt', 'sui', 'inj',
]);

// ─── 스마트 텍스트 매칭 ────────────────────────────────────
// 짧은 키워드(≤4자 영문) + 거짓양성 위험 키워드는 단어 경계 매칭
// 한글 키워드(3자+)와 긴 영문(5자+)은 includes 사용
export function matchesKeywords(text, keywords) {
  const lowerText = text.toLowerCase();
  return keywords.some(kw => {
    // 단어 경계 매칭 필요 여부 판단:
    // 1) isShortKeyword (영문 ≤2자, 한글 ≤2자)
    // 2) 영문 3~4자 (arm, meta, coin 등 거짓양성 위험)
    // 3) BOUNDARY_FORCE 목록에 포함
    const needBoundary = isShortKeyword(kw)
      || BOUNDARY_FORCE.has(kw)
      || (/^[a-z0-9]{3,4}$/i.test(kw));

    if (needBoundary) {
      // 단어 경계: 앞뒤가 공백/문장부호/시작/끝이어야 함
      // 한글 조사(가,이,을,의...)가 붙은 경우도 허용 (예: 기아가)
      try {
        const re = new RegExp(
          '(?:^|[\\s,;:·\\-/（("\'「【]|(?<=[\\s,;:·\\-/（("\'「【]))' +
          escapeRe(kw) +
          '(?=[\\s,;:·\\-/）)"\'」】가이을를의에서는은도만과와로]|이고|라며|$)',
          'i'
        );
        return re.test(lowerText);
      } catch {
        // lookbehind 미지원 환경 fallback — 주 패턴과 동일한 문자셋 사용
        return new RegExp('(?:^|[\\s,;:·\\-/（("\'「【])' + escapeRe(kw) + '(?=[\\s,;:·\\-/）)"\'」】가이을를의에서는은도만과와로]|이고|라며|$)', 'i').test(lowerText);
      }
    }
    return lowerText.includes(kw);
  });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
