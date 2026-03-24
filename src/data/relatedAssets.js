// 연관 종목 다층 관계 시스템
// ChartSidePanel 상세 패널 + HomeDashboard 인라인 chip에서 사용
// 관계 타입: etf(해당 자산 투자 ETF) / stock(관련 주식) / coin(관련 코인) / sector(같은 섹터 주식) / index(관련 지수)

// ─── 관계 타입 상수 ────────────────────────────────────────────
export const RELATION_TYPES = {
  ETF:    'etf',
  STOCK:  'stock',
  COIN:   'coin',
  SECTOR: 'sector',
  INDEX:  'index',
};

// ─── 시장 배지 이모지 ──────────────────────────────────────────
export const MARKET_FLAG = {
  KR:   '🇰🇷',
  US:   '🇺🇸',
  COIN: '🪙',
};

// ─── 메인 관계 매핑 테이블 ─────────────────────────────────────
// related 배열 각 항목: { symbol, type, reason, market }
export const RELATED_ASSETS = {

  // ══════════════════════════════════════════════════════════
  //  코인 섹션
  // ══════════════════════════════════════════════════════════

  BTC: {
    label: '비트코인',
    sector: '비트코인',
    related: [
      { symbol: 'IBIT',   type: 'etf',    reason: '블랙록 BTC 현물 ETF',      market: 'US' },
      { symbol: 'FBTC',   type: 'etf',    reason: '피델리티 BTC 현물 ETF',    market: 'US' },
      { symbol: 'GBTC',   type: 'etf',    reason: '그레이스케일 BTC 신탁',    market: 'US' },
      { symbol: 'BITX',   type: 'etf',    reason: 'BTC 2배 레버리지 ETF',     market: 'US' },
      { symbol: 'BITU',   type: 'etf',    reason: 'ProShares BTC 2배 ETF',    market: 'US' },
      { symbol: 'SBIT',   type: 'etf',    reason: 'BTC 인버스 ETF (하락 베팅)', market: 'US' },
      { symbol: 'BKCH',   type: 'etf',    reason: '블록체인 테마 ETF',         market: 'US' },
      { symbol: 'MSTR',   type: 'stock',  reason: 'BTC 최대 보유 기업',        market: 'US' },
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 거래소',          market: 'US' },
      { symbol: 'CLSK',   type: 'stock',  reason: 'BTC 채굴 (클린스파크)',      market: 'US' },
      { symbol: 'RIOT',   type: 'stock',  reason: 'BTC 채굴 대표주',            market: 'US' },
      { symbol: 'MARA',   type: 'stock',  reason: 'BTC 채굴 대표주',            market: 'US' },
      { symbol: 'ETH',    type: 'coin',   reason: '2위 코인, 강한 상관관계',   market: 'COIN' },
      { symbol: 'SOL',    type: 'coin',   reason: 'BTC 강세 시 동반 상승',      market: 'COIN' },
      { symbol: 'BNB',    type: 'coin',   reason: '대형 코인 동조화',            market: 'COIN' },
    ],
  },

  ETH: {
    label: '이더리움',
    sector: '이더리움',
    related: [
      { symbol: 'ETHA',   type: 'etf',    reason: '블랙록 ETH 현물 ETF',        market: 'US' },
      { symbol: 'FETH',   type: 'etf',    reason: '피델리티 ETH 현물 ETF',      market: 'US' },
      { symbol: 'ETHE',   type: 'etf',    reason: '그레이스케일 ETH 신탁',      market: 'US' },
      { symbol: 'ETHU',   type: 'etf',    reason: 'ETH 2배 레버리지 ETF',       market: 'US' },
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 (ETH 스테이킹)',   market: 'US' },
      { symbol: 'BTC',    type: 'coin',   reason: '강한 상관관계',               market: 'COIN' },
      { symbol: 'SOL',    type: 'coin',   reason: '레이어1 경쟁 코인',           market: 'COIN' },
      { symbol: 'LINK',   type: 'coin',   reason: 'ETH 생태계 오라클',           market: 'COIN' },
      { symbol: 'UNI',    type: 'coin',   reason: 'ETH 기반 최대 DEX',           market: 'COIN' },
      { symbol: 'ARB',    type: 'coin',   reason: 'ETH 레이어2 (아비트럼)',       market: 'COIN' },
      { symbol: 'OP',     type: 'coin',   reason: 'ETH 레이어2 (옵티미즘)',       market: 'COIN' },
    ],
  },

  SOL: {
    label: '솔라나',
    sector: '알트코인',
    related: [
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 (SOL 거래)',    market: 'US' },
      { symbol: 'BTC',    type: 'coin',   reason: '강한 상관관계',             market: 'COIN' },
      { symbol: 'ETH',    type: 'coin',   reason: '레이어1 경쟁 코인',         market: 'COIN' },
      { symbol: 'AVAX',   type: 'coin',   reason: '레이어1 경쟁 코인',         market: 'COIN' },
      { symbol: 'APT',    type: 'coin',   reason: '고성능 레이어1 경쟁',        market: 'COIN' },
      { symbol: 'SUI',    type: 'coin',   reason: '고성능 레이어1 경쟁',        market: 'COIN' },
    ],
  },

  XRP: {
    label: '리플',
    sector: '알트코인',
    related: [
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 (XRP 거래)',    market: 'US' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',          market: 'COIN' },
      { symbol: 'XLM',    type: 'coin',   reason: '결제 코인 경쟁/동조',       market: 'COIN' },
      { symbol: 'ADA',    type: 'coin',   reason: '대형 알트코인 동조화',       market: 'COIN' },
    ],
  },

  BNB: {
    label: 'BNB',
    sector: '알트코인',
    related: [
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 (거래소 주식)',  market: 'US' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',           market: 'COIN' },
      { symbol: 'ETH',    type: 'coin',   reason: '강한 상관관계',               market: 'COIN' },
      { symbol: 'CAKE',   type: 'coin',   reason: 'BSC 생태계 DEX',              market: 'COIN' },
    ],
  },

  DOGE: {
    label: '도지코인',
    sector: '밈코인',
    related: [
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 (DOGE 거래)',   market: 'US' },
      { symbol: 'TSLA',   type: 'stock',  reason: '일론 머스크 관련주',        market: 'US' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',           market: 'COIN' },
      { symbol: 'SHIB',   type: 'coin',   reason: '밈코인 동조화',               market: 'COIN' },
      { symbol: 'PEPE',   type: 'coin',   reason: '밈코인 동조화',               market: 'COIN' },
    ],
  },

  ADA: {
    label: '카르다노',
    sector: '알트코인',
    related: [
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',           market: 'COIN' },
      { symbol: 'ETH',    type: 'coin',   reason: '레이어1 경쟁 코인',           market: 'COIN' },
      { symbol: 'SOL',    type: 'coin',   reason: '레이어1 경쟁 코인',           market: 'COIN' },
      { symbol: 'XRP',    type: 'coin',   reason: '대형 알트코인 동조화',        market: 'COIN' },
    ],
  },

  AVAX: {
    label: '아발란체',
    sector: '알트코인',
    related: [
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 (거래)',          market: 'US' },
      { symbol: 'ETH',    type: 'coin',   reason: '레이어1 경쟁 코인',           market: 'COIN' },
      { symbol: 'SOL',    type: 'coin',   reason: '레이어1 경쟁 코인',           market: 'COIN' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',            market: 'COIN' },
    ],
  },

  LINK: {
    label: '체인링크',
    sector: '알트코인',
    related: [
      { symbol: 'ETH',    type: 'coin',   reason: 'ETH 생태계 (오라클)',        market: 'COIN' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',            market: 'COIN' },
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 (거래)',           market: 'US' },
    ],
  },

  DOT: {
    label: '폴카닷',
    sector: '알트코인',
    related: [
      { symbol: 'ETH',    type: 'coin',   reason: '멀티체인 경쟁',              market: 'COIN' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',            market: 'COIN' },
      { symbol: 'ATOM',   type: 'coin',   reason: '인터체인 경쟁 코인',          market: 'COIN' },
    ],
  },

  ATOM: {
    label: '코스모스',
    sector: '알트코인',
    related: [
      { symbol: 'DOT',    type: 'coin',   reason: '인터체인 경쟁 코인',          market: 'COIN' },
      { symbol: 'ETH',    type: 'coin',   reason: '레이어1 관련',                market: 'COIN' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',            market: 'COIN' },
    ],
  },

  UNI: {
    label: '유니스왑',
    sector: 'DeFi',
    related: [
      { symbol: 'ETH',    type: 'coin',   reason: 'ETH 기반 DEX',               market: 'COIN' },
      { symbol: 'AAVE',   type: 'coin',   reason: 'DeFi 동조화',                 market: 'COIN' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',            market: 'COIN' },
      { symbol: 'COIN',   type: 'stock',  reason: '코인베이스 (DeFi 연관)',      market: 'US' },
    ],
  },

  ARB: {
    label: '아비트럼',
    sector: '레이어2',
    related: [
      { symbol: 'ETH',    type: 'coin',   reason: 'ETH 레이어2',                 market: 'COIN' },
      { symbol: 'OP',     type: 'coin',   reason: '레이어2 경쟁 코인',           market: 'COIN' },
      { symbol: 'MATIC',  type: 'coin',   reason: '레이어2 경쟁 코인',           market: 'COIN' },
    ],
  },

  OP: {
    label: '옵티미즘',
    sector: '레이어2',
    related: [
      { symbol: 'ETH',    type: 'coin',   reason: 'ETH 레이어2',                 market: 'COIN' },
      { symbol: 'ARB',    type: 'coin',   reason: '레이어2 경쟁 코인',           market: 'COIN' },
      { symbol: 'MATIC',  type: 'coin',   reason: '레이어2 경쟁 코인',           market: 'COIN' },
    ],
  },

  MATIC: {
    label: '폴리곤',
    sector: '레이어2',
    related: [
      { symbol: 'ETH',    type: 'coin',   reason: 'ETH 레이어2/사이드체인',     market: 'COIN' },
      { symbol: 'ARB',    type: 'coin',   reason: '레이어2 경쟁 코인',           market: 'COIN' },
      { symbol: 'OP',     type: 'coin',   reason: '레이어2 경쟁 코인',           market: 'COIN' },
    ],
  },

  SHIB: {
    label: '시바이누',
    sector: '밈코인',
    related: [
      { symbol: 'DOGE',   type: 'coin',   reason: '밈코인 동조화',               market: 'COIN' },
      { symbol: 'PEPE',   type: 'coin',   reason: '밈코인 동조화',               market: 'COIN' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',            market: 'COIN' },
    ],
  },

  PEPE: {
    label: 'PEPE',
    sector: '밈코인',
    related: [
      { symbol: 'DOGE',   type: 'coin',   reason: '밈코인 동조화',               market: 'COIN' },
      { symbol: 'SHIB',   type: 'coin',   reason: '밈코인 동조화',               market: 'COIN' },
      { symbol: 'BTC',    type: 'coin',   reason: '코인 시장 동조화',            market: 'COIN' },
    ],
  },

  SUI: {
    label: 'Sui',
    sector: '알트코인',
    related: [
      { symbol: 'APT',    type: 'coin',   reason: 'Move 언어 기반 경쟁',         market: 'COIN' },
      { symbol: 'SOL',    type: 'coin',   reason: '고성능 레이어1 경쟁',          market: 'COIN' },
      { symbol: 'ETH',    type: 'coin',   reason: '레이어1 관련',                market: 'COIN' },
    ],
  },

  APT: {
    label: 'Aptos',
    sector: '알트코인',
    related: [
      { symbol: 'SUI',    type: 'coin',   reason: 'Move 언어 기반 경쟁',         market: 'COIN' },
      { symbol: 'SOL',    type: 'coin',   reason: '고성능 레이어1 경쟁',          market: 'COIN' },
      { symbol: 'ETH',    type: 'coin',   reason: '레이어1 관련',                market: 'COIN' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  미장 — 빅테크
  // ══════════════════════════════════════════════════════════

  AAPL: {
    label: 'Apple',
    sector: '빅테크',
    related: [
      { symbol: 'QQQ',    type: 'etf',    reason: '나스닥100 ETF',               market: 'US' },
      { symbol: 'XLK',    type: 'etf',    reason: '테크 섹터 ETF',               market: 'US' },
      { symbol: 'MSFT',   type: 'sector', reason: '빅테크 경쟁/동조',             market: 'US' },
      { symbol: 'GOOGL',  type: 'sector', reason: '빅테크 경쟁/동조',             market: 'US' },
      { symbol: 'META',   type: 'sector', reason: '빅테크 경쟁/동조',             market: 'US' },
      { symbol: 'TSM',    type: 'sector', reason: 'TSMC (AP 칩 생산)',            market: 'US' },
    ],
  },

  MSFT: {
    label: 'Microsoft',
    sector: '빅테크',
    related: [
      { symbol: 'QQQ',    type: 'etf',    reason: '나스닥100 ETF',               market: 'US' },
      { symbol: 'XLK',    type: 'etf',    reason: '테크 섹터 ETF',               market: 'US' },
      { symbol: 'AAPL',   type: 'sector', reason: '빅테크 경쟁/동조',             market: 'US' },
      { symbol: 'GOOGL',  type: 'sector', reason: '클라우드/AI 경쟁',             market: 'US' },
      { symbol: 'AMZN',   type: 'sector', reason: '클라우드(Azure↔AWS) 경쟁',    market: 'US' },
      { symbol: 'NVDA',   type: 'sector', reason: 'AI 인프라 파트너십',           market: 'US' },
    ],
  },

  GOOGL: {
    label: 'Alphabet',
    sector: '빅테크',
    related: [
      { symbol: 'QQQ',    type: 'etf',    reason: '나스닥100 ETF',               market: 'US' },
      { symbol: 'XLK',    type: 'etf',    reason: '테크 섹터 ETF',               market: 'US' },
      { symbol: 'META',   type: 'sector', reason: '광고·AI 경쟁',                 market: 'US' },
      { symbol: 'MSFT',   type: 'sector', reason: '클라우드/AI 경쟁',             market: 'US' },
      { symbol: 'AMZN',   type: 'sector', reason: '클라우드(GCP↔AWS) 경쟁',      market: 'US' },
    ],
  },

  META: {
    label: 'Meta',
    sector: '빅테크',
    related: [
      { symbol: 'QQQ',    type: 'etf',    reason: '나스닥100 ETF',               market: 'US' },
      { symbol: 'XLK',    type: 'etf',    reason: '테크 섹터 ETF',               market: 'US' },
      { symbol: 'GOOGL',  type: 'sector', reason: '광고 경쟁사',                  market: 'US' },
      { symbol: 'SNAP',   type: 'sector', reason: 'SNS 섹터 동조',                market: 'US' },
      { symbol: 'NVDA',   type: 'sector', reason: 'AI 칩 최대 고객사',            market: 'US' },
    ],
  },

  AMZN: {
    label: 'Amazon',
    sector: '빅테크',
    related: [
      { symbol: 'QQQ',    type: 'etf',    reason: '나스닥100 ETF',               market: 'US' },
      { symbol: 'MSFT',   type: 'sector', reason: '클라우드(AWS↔Azure) 경쟁',    market: 'US' },
      { symbol: 'GOOGL',  type: 'sector', reason: '클라우드(AWS↔GCP) 경쟁',      market: 'US' },
      { symbol: 'NVDA',   type: 'sector', reason: 'AI 인프라 고객사',             market: 'US' },
    ],
  },

  NFLX: {
    label: 'Netflix',
    sector: '미디어',
    related: [
      { symbol: 'QQQ',    type: 'etf',    reason: '나스닥100 ETF',               market: 'US' },
      { symbol: 'DIS',    type: 'sector', reason: '스트리밍 경쟁사',              market: 'US' },
      { symbol: 'GOOGL',  type: 'sector', reason: '광고·콘텐츠 경쟁',             market: 'US' },
    ],
  },

  ORCL: {
    label: 'Oracle',
    sector: '클라우드',
    related: [
      { symbol: 'XLK',    type: 'etf',    reason: '테크 섹터 ETF',               market: 'US' },
      { symbol: 'MSFT',   type: 'sector', reason: '클라우드/DB 경쟁',             market: 'US' },
      { symbol: 'CRM',    type: 'sector', reason: '엔터프라이즈 SW 경쟁',         market: 'US' },
      { symbol: 'NVDA',   type: 'sector', reason: 'AI 클라우드 파트너십',         market: 'US' },
    ],
  },

  CRM: {
    label: 'Salesforce',
    sector: '클라우드',
    related: [
      { symbol: 'XLK',    type: 'etf',    reason: '테크 섹터 ETF',               market: 'US' },
      { symbol: 'ORCL',   type: 'sector', reason: '엔터프라이즈 SW 경쟁',         market: 'US' },
      { symbol: 'MSFT',   type: 'sector', reason: 'CRM·클라우드 경쟁',            market: 'US' },
    ],
  },

  ADBE: {
    label: 'Adobe',
    sector: '소프트웨어',
    related: [
      { symbol: 'XLK',    type: 'etf',    reason: '테크 섹터 ETF',               market: 'US' },
      { symbol: 'MSFT',   type: 'sector', reason: 'AI 크리에이티브 경쟁',         market: 'US' },
      { symbol: 'CRM',    type: 'sector', reason: 'SaaS 동조화',                  market: 'US' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  미장 — 반도체 클러스터
  // ══════════════════════════════════════════════════════════

  NVDA: {
    label: 'NVIDIA',
    sector: '반도체',
    related: [
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'SMH',     type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'AMD',     type: 'sector', reason: 'AI GPU 경쟁사',              market: 'US' },
      { symbol: 'TSM',     type: 'sector', reason: 'TSMC (NVIDIA 칩 생산)',      market: 'US' },
      { symbol: 'ARM',     type: 'sector', reason: 'AI 칩 아키텍처 파트너',       market: 'US' },
      { symbol: '005930',  type: 'sector', reason: '삼성전자 (HBM 공급)',         market: 'KR' },
      { symbol: '000660',  type: 'sector', reason: 'SK하이닉스 (HBM 1위 공급)',  market: 'KR' },
    ],
  },

  AMD: {
    label: 'AMD',
    sector: '반도체',
    related: [
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'SMH',     type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'NVDA',    type: 'sector', reason: 'AI GPU 경쟁사',              market: 'US' },
      { symbol: 'INTC',    type: 'sector', reason: 'CPU 경쟁사',                  market: 'US' },
      { symbol: 'TSM',     type: 'sector', reason: 'TSMC (AMD 칩 생산)',          market: 'US' },
      { symbol: '005930',  type: 'sector', reason: '삼성전자 (메모리 공급)',      market: 'KR' },
    ],
  },

  TSM: {
    label: 'TSMC',
    sector: '반도체',
    related: [
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'SMH',     type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'NVDA',    type: 'sector', reason: 'TSMC 최대 고객사',            market: 'US' },
      { symbol: 'AAPL',    type: 'sector', reason: 'TSMC 주요 고객사',            market: 'US' },
      { symbol: 'AMD',     type: 'sector', reason: 'TSMC 주요 고객사',            market: 'US' },
      { symbol: '005930',  type: 'sector', reason: '삼성전자 (파운드리 경쟁)',     market: 'KR' },
    ],
  },

  INTC: {
    label: 'Intel',
    sector: '반도체',
    related: [
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'SMH',     type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'AMD',     type: 'sector', reason: 'CPU 경쟁사',                  market: 'US' },
      { symbol: 'NVDA',    type: 'sector', reason: 'AI 칩 경쟁',                  market: 'US' },
      { symbol: 'TSM',     type: 'sector', reason: 'TSMC (파운드리 협력)',         market: 'US' },
      { symbol: '005930',  type: 'sector', reason: '삼성전자 (파운드리 경쟁)',     market: 'KR' },
    ],
  },

  SMCI: {
    label: 'Super Micro',
    sector: '반도체',
    related: [
      { symbol: 'NVDA',    type: 'sector', reason: 'NVIDIA GPU 서버 최대 판매사', market: 'US' },
      { symbol: 'AMD',     type: 'sector', reason: 'AI 서버 경쟁',               market: 'US' },
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
    ],
  },

  ARM: {
    label: 'ARM',
    sector: '반도체',
    related: [
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'NVDA',    type: 'sector', reason: 'AI 칩 아키텍처 파트너',       market: 'US' },
      { symbol: 'QCOM',    type: 'sector', reason: 'ARM 기반 칩 설계',            market: 'US' },
    ],
  },

  QCOM: {
    label: 'Qualcomm',
    sector: '반도체',
    related: [
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'SMH',     type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'ARM',     type: 'sector', reason: 'ARM 기반 칩 설계',            market: 'US' },
      { symbol: 'NVDA',    type: 'sector', reason: '모바일 AI 칩 경쟁',           market: 'US' },
      { symbol: 'INTC',    type: 'sector', reason: '반도체 동조화',               market: 'US' },
    ],
  },

  AVGO: {
    label: 'Broadcom',
    sector: '반도체',
    related: [
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                 market: 'US' },
      { symbol: 'NVDA',    type: 'sector', reason: 'AI 칩 경쟁/협력',             market: 'US' },
      { symbol: 'QCOM',    type: 'sector', reason: '반도체 동조화',               market: 'US' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  미장 — EV / 자동차
  // ══════════════════════════════════════════════════════════

  TSLA: {
    label: 'Tesla',
    sector: 'EV',
    related: [
      { symbol: 'DRIV',    type: 'etf',    reason: 'EV/자율주행 ETF',            market: 'US' },
      { symbol: 'RIVN',    type: 'sector', reason: 'EV 경쟁사',                   market: 'US' },
      { symbol: 'NIO',     type: 'sector', reason: 'EV 경쟁사 (중국)',             market: 'US' },
      { symbol: 'DOGE',    type: 'coin',   reason: '일론 머스크 연관 코인',        market: 'COIN' },
      { symbol: 'BTC',     type: 'coin',   reason: '테슬라 BTC 보유',              market: 'COIN' },
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (배터리 공급)', market: 'KR' },
      { symbol: '006400',  type: 'sector', reason: '삼성SDI (배터리 공급)',        market: 'KR' },
      { symbol: '247540',  type: 'sector', reason: '에코프로비엠 (양극재)',        market: 'KR' },
    ],
  },

  RIVN: {
    label: 'Rivian',
    sector: 'EV',
    related: [
      { symbol: 'TSLA',    type: 'sector', reason: 'EV 리더 기업',                market: 'US' },
      { symbol: 'NIO',     type: 'sector', reason: 'EV 경쟁사',                   market: 'US' },
      { symbol: 'DRIV',    type: 'etf',    reason: 'EV/자율주행 ETF',            market: 'US' },
    ],
  },

  NIO: {
    label: 'NIO',
    sector: 'EV',
    related: [
      { symbol: 'TSLA',    type: 'sector', reason: 'EV 리더 기업',                market: 'US' },
      { symbol: 'RIVN',    type: 'sector', reason: 'EV 경쟁사',                   market: 'US' },
      { symbol: 'DRIV',    type: 'etf',    reason: 'EV/자율주행 ETF',            market: 'US' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  미장 — 바이오/헬스케어
  // ══════════════════════════════════════════════════════════

  JNJ: {
    label: 'Johnson & Johnson',
    sector: '헬스케어',
    related: [
      { symbol: 'XLV',     type: 'etf',    reason: '헬스케어 섹터 ETF',           market: 'US' },
      { symbol: 'PFE',     type: 'sector', reason: '제약 동조화',                  market: 'US' },
      { symbol: 'MRK',     type: 'sector', reason: '제약 동조화',                  market: 'US' },
      { symbol: '068270',  type: 'sector', reason: '셀트리온 (바이오시밀러)',       market: 'KR' },
      { symbol: '207940',  type: 'sector', reason: '삼성바이오로직스 (CMO)',       market: 'KR' },
    ],
  },

  PFE: {
    label: 'Pfizer',
    sector: '제약',
    related: [
      { symbol: 'XLV',     type: 'etf',    reason: '헬스케어 섹터 ETF',           market: 'US' },
      { symbol: 'MRNA',    type: 'sector', reason: 'mRNA 백신 경쟁',               market: 'US' },
      { symbol: 'JNJ',     type: 'sector', reason: '제약 동조화',                  market: 'US' },
      { symbol: '068270',  type: 'sector', reason: '셀트리온 (바이오시밀러 경쟁)', market: 'KR' },
    ],
  },

  MRNA: {
    label: 'Moderna',
    sector: '제약',
    related: [
      { symbol: 'XLV',     type: 'etf',    reason: '헬스케어 섹터 ETF',           market: 'US' },
      { symbol: 'PFE',     type: 'sector', reason: 'mRNA 백신 경쟁',               market: 'US' },
      { symbol: '068270',  type: 'sector', reason: '셀트리온 (바이오 동조화)',      market: 'KR' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  국장 — 반도체
  // ══════════════════════════════════════════════════════════

  // 삼성전자 (코스피 코드 005930)
  '005930': {
    label: '삼성전자',
    sector: '반도체',
    related: [
      { symbol: '000660',  type: 'sector', reason: 'SK하이닉스 (반도체 동반)',    market: 'KR' },
      { symbol: 'NVDA',    type: 'sector', reason: 'AI GPU → HBM 수요 연결',      market: 'US' },
      { symbol: 'TSM',     type: 'sector', reason: 'TSMC (파운드리 경쟁)',         market: 'US' },
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                  market: 'US' },
      { symbol: 'SMH',     type: 'etf',    reason: '반도체 ETF',                  market: 'US' },
    ],
  },
  // 한글명 alias
  '삼성전자': {
    label: '삼성전자',
    sector: '반도체',
    related: [
      { symbol: '000660',  type: 'sector', reason: 'SK하이닉스 (반도체 동반)',    market: 'KR' },
      { symbol: 'NVDA',    type: 'sector', reason: 'AI GPU → HBM 수요 연결',      market: 'US' },
      { symbol: 'TSM',     type: 'sector', reason: 'TSMC (파운드리 경쟁)',         market: 'US' },
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                  market: 'US' },
      { symbol: 'SMH',     type: 'etf',    reason: '반도체 ETF',                  market: 'US' },
    ],
  },

  // 삼성전기 (코스피 009150)
  '009150': {
    label: '삼성전기',
    sector: '전자부품',
    related: [
      { symbol: '005930',  type: 'sector', reason: '삼성전자 (모회사 · MLCC 최대 고객)', market: 'KR' },
      { symbol: '011070',  type: 'sector', reason: 'LG이노텍 (MLCC 경쟁)',               market: 'KR' },
      { symbol: 'AAPL',    type: 'customer', reason: '애플 (삼성전기 주요 고객)',         market: 'US' },
      { symbol: 'AVGO',    type: 'sector',   reason: '브로드컴 (부품 수요 연관)',          market: 'US' },
      { symbol: 'QCOM',    type: 'sector',   reason: '퀄컴 (모바일 부품 연관)',            market: 'US' },
    ],
  },
  '삼성전기': {
    label: '삼성전기',
    sector: '전자부품',
    related: [
      { symbol: '005930',  type: 'sector', reason: '삼성전자 (모회사 · MLCC 최대 고객)', market: 'KR' },
      { symbol: '011070',  type: 'sector', reason: 'LG이노텍 (MLCC 경쟁)',               market: 'KR' },
      { symbol: 'AAPL',    type: 'customer', reason: '애플 (삼성전기 주요 고객)',         market: 'US' },
      { symbol: 'AVGO',    type: 'sector',   reason: '브로드컴 (부품 수요 연관)',          market: 'US' },
      { symbol: 'QCOM',    type: 'sector',   reason: '퀄컴 (모바일 부품 연관)',            market: 'US' },
    ],
  },

  // SK하이닉스 (코스피 코드 000660)
  '000660': {
    label: 'SK하이닉스',
    sector: '반도체',
    related: [
      { symbol: '005930',  type: 'sector', reason: '삼성전자 (반도체 동반)',       market: 'KR' },
      { symbol: 'NVDA',    type: 'sector', reason: 'NVIDIA HBM 최대 공급사',      market: 'US' },
      { symbol: 'AMD',     type: 'sector', reason: 'AMD HBM 공급',                market: 'US' },
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                  market: 'US' },
    ],
  },
  'SK하이닉스': {
    label: 'SK하이닉스',
    sector: '반도체',
    related: [
      { symbol: '005930',  type: 'sector', reason: '삼성전자 (반도체 동반)',       market: 'KR' },
      { symbol: 'NVDA',    type: 'sector', reason: 'NVIDIA HBM 최대 공급사',      market: 'US' },
      { symbol: 'AMD',     type: 'sector', reason: 'AMD HBM 공급',                market: 'US' },
      { symbol: 'SOXX',    type: 'etf',    reason: '반도체 ETF',                  market: 'US' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  국장 — 자동차
  // ══════════════════════════════════════════════════════════

  '005380': {
    label: '현대차',
    sector: '자동차',
    related: [
      { symbol: '000270',  type: 'sector', reason: '기아 (그룹 동반)',             market: 'KR' },
      { symbol: '012330',  type: 'sector', reason: '현대모비스 (부품 동반)',        market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: 'EV 시장 경쟁',                 market: 'US' },
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (배터리)',       market: 'KR' },
    ],
  },
  '현대차': {
    label: '현대차',
    sector: '자동차',
    related: [
      { symbol: '000270',  type: 'sector', reason: '기아 (그룹 동반)',             market: 'KR' },
      { symbol: '012330',  type: 'sector', reason: '현대모비스 (부품 동반)',        market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: 'EV 시장 경쟁',                 market: 'US' },
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (배터리)',       market: 'KR' },
    ],
  },

  '000270': {
    label: '기아',
    sector: '자동차',
    related: [
      { symbol: '005380',  type: 'sector', reason: '현대차 (그룹 동반)',            market: 'KR' },
      { symbol: '012330',  type: 'sector', reason: '현대모비스 (부품 동반)',        market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: 'EV 시장 경쟁',                 market: 'US' },
    ],
  },
  '기아': {
    label: '기아',
    sector: '자동차',
    related: [
      { symbol: '005380',  type: 'sector', reason: '현대차 (그룹 동반)',            market: 'KR' },
      { symbol: '012330',  type: 'sector', reason: '현대모비스 (부품 동반)',        market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: 'EV 시장 경쟁',                 market: 'US' },
    ],
  },

  '012330': { label: '현대모비스', sector: '자동차', related: [
    { symbol: '005380', type: 'sector', reason: '현대차 (완성차 동반)', market: 'KR' },
    { symbol: '000270', type: 'sector', reason: '기아 (완성차 동반)',  market: 'KR' },
  ]},
  '현대모비스': { label: '현대모비스', sector: '자동차', related: [
    { symbol: '005380', type: 'sector', reason: '현대차 (완성차 동반)', market: 'KR' },
    { symbol: '000270', type: 'sector', reason: '기아 (완성차 동반)',  market: 'KR' },
  ]},

  // ══════════════════════════════════════════════════════════
  //  국장 — 배터리 / 2차전지
  // ══════════════════════════════════════════════════════════

  '373220': {
    label: 'LG에너지솔루션',
    sector: '배터리',
    related: [
      { symbol: '006400',  type: 'sector', reason: '삼성SDI (배터리 경쟁)',        market: 'KR' },
      { symbol: '247540',  type: 'sector', reason: '에코프로비엠 (양극재 공급)',   market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: '테슬라 (최대 고객)',            market: 'US' },
      { symbol: 'RIVN',    type: 'sector', reason: 'Rivian (주요 고객)',            market: 'US' },
    ],
  },
  'LG에너지솔루션': {
    label: 'LG에너지솔루션',
    sector: '배터리',
    related: [
      { symbol: '006400',  type: 'sector', reason: '삼성SDI (배터리 경쟁)',        market: 'KR' },
      { symbol: '247540',  type: 'sector', reason: '에코프로비엠 (양극재 공급)',   market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: '테슬라 (최대 고객)',            market: 'US' },
    ],
  },

  '006400': {
    label: '삼성SDI',
    sector: '배터리',
    related: [
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (배터리 경쟁)', market: 'KR' },
      { symbol: '247540',  type: 'sector', reason: '에코프로비엠 (양극재 공급)',   market: 'KR' },
      { symbol: '051910',  type: 'sector', reason: 'LG화학 (모회사)',               market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: '테슬라 (배터리 공급)',          market: 'US' },
    ],
  },
  '삼성SDI': {
    label: '삼성SDI',
    sector: '배터리',
    related: [
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (배터리 경쟁)', market: 'KR' },
      { symbol: '247540',  type: 'sector', reason: '에코프로비엠 (양극재 공급)',   market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: '테슬라 (배터리 공급)',          market: 'US' },
    ],
  },

  '247540': {
    label: '에코프로비엠',
    sector: '2차전지소재',
    related: [
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (주요 고객)',   market: 'KR' },
      { symbol: '006400',  type: 'sector', reason: '삼성SDI (주요 고객)',           market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: 'EV 배터리 소재 수요',           market: 'US' },
    ],
  },
  '에코프로비엠': {
    label: '에코프로비엠',
    sector: '2차전지소재',
    related: [
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (주요 고객)',   market: 'KR' },
      { symbol: '006400',  type: 'sector', reason: '삼성SDI (주요 고객)',           market: 'KR' },
      { symbol: 'TSLA',    type: 'sector', reason: 'EV 배터리 소재 수요',           market: 'US' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  국장 — 화학 / 소재
  // ══════════════════════════════════════════════════════════

  '051910': {
    label: 'LG화학',
    sector: '화학',
    related: [
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (자회사)',      market: 'KR' },
      { symbol: '006400',  type: 'sector', reason: '삼성SDI (배터리 경쟁)',        market: 'KR' },
      { symbol: '005490',  type: 'sector', reason: 'POSCO홀딩스 (소재 동반)',      market: 'KR' },
    ],
  },
  'LG화학': {
    label: 'LG화학',
    sector: '화학',
    related: [
      { symbol: '373220',  type: 'sector', reason: 'LG에너지솔루션 (자회사)',      market: 'KR' },
      { symbol: '006400',  type: 'sector', reason: '삼성SDI (배터리 경쟁)',        market: 'KR' },
    ],
  },

  '005490': {
    label: 'POSCO홀딩스',
    sector: '철강/소재',
    related: [
      { symbol: '051910',  type: 'sector', reason: 'LG화학 (소재 동반)',           market: 'KR' },
      { symbol: '247540',  type: 'sector', reason: '에코프로비엠 (2차전지 소재)',  market: 'KR' },
    ],
  },
  'POSCO홀딩스': {
    label: 'POSCO홀딩스',
    sector: '철강/소재',
    related: [
      { symbol: '051910',  type: 'sector', reason: 'LG화학 (소재 동반)',           market: 'KR' },
      { symbol: '247540',  type: 'sector', reason: '에코프로비엠 (2차전지 소재)',  market: 'KR' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  국장 — 플랫폼 / 인터넷
  // ══════════════════════════════════════════════════════════

  '035420': {
    label: '네이버',
    sector: '플랫폼',
    related: [
      { symbol: '035720',  type: 'sector', reason: '카카오 (플랫폼 경쟁/동조)',   market: 'KR' },
      { symbol: 'GOOGL',   type: 'sector', reason: '검색·AI 플랫폼 글로벌 비교', market: 'US' },
      { symbol: 'META',    type: 'sector', reason: 'SNS·광고 플랫폼 비교',        market: 'US' },
    ],
  },
  '네이버': {
    label: '네이버',
    sector: '플랫폼',
    related: [
      { symbol: '035720',  type: 'sector', reason: '카카오 (플랫폼 경쟁/동조)',   market: 'KR' },
      { symbol: 'GOOGL',   type: 'sector', reason: '검색·AI 플랫폼 글로벌 비교', market: 'US' },
    ],
  },

  '035720': {
    label: '카카오',
    sector: '플랫폼',
    related: [
      { symbol: '035420',  type: 'sector', reason: '네이버 (플랫폼 경쟁/동조)',   market: 'KR' },
      { symbol: 'META',    type: 'sector', reason: 'SNS·광고 플랫폼 비교',        market: 'US' },
    ],
  },
  '카카오': {
    label: '카카오',
    sector: '플랫폼',
    related: [
      { symbol: '035420',  type: 'sector', reason: '네이버 (플랫폼 경쟁/동조)',   market: 'KR' },
      { symbol: 'META',    type: 'sector', reason: 'SNS·광고 플랫폼 비교',        market: 'US' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  국장 — 바이오
  // ══════════════════════════════════════════════════════════

  '068270': {
    label: '셀트리온',
    sector: '바이오',
    related: [
      { symbol: '207940',  type: 'sector', reason: '삼성바이오로직스 (바이오 동반)', market: 'KR' },
      { symbol: 'JNJ',     type: 'sector', reason: '글로벌 제약 동조화',              market: 'US' },
      { symbol: 'PFE',     type: 'sector', reason: '바이오시밀러 경쟁',               market: 'US' },
      { symbol: 'XLV',     type: 'etf',    reason: '헬스케어 섹터 ETF',               market: 'US' },
    ],
  },
  '셀트리온': {
    label: '셀트리온',
    sector: '바이오',
    related: [
      { symbol: '207940',  type: 'sector', reason: '삼성바이오로직스 (바이오 동반)', market: 'KR' },
      { symbol: 'JNJ',     type: 'sector', reason: '글로벌 제약 동조화',              market: 'US' },
      { symbol: 'PFE',     type: 'sector', reason: '바이오시밀러 경쟁',               market: 'US' },
    ],
  },

  '207940': {
    label: '삼성바이오로직스',
    sector: '바이오',
    related: [
      { symbol: '068270',  type: 'sector', reason: '셀트리온 (바이오 동반)',          market: 'KR' },
      { symbol: 'JNJ',     type: 'sector', reason: '글로벌 제약 CMO 고객사',          market: 'US' },
      { symbol: 'MRNA',    type: 'sector', reason: '바이오 동조화',                   market: 'US' },
    ],
  },
  '삼성바이오로직스': {
    label: '삼성바이오로직스',
    sector: '바이오',
    related: [
      { symbol: '068270',  type: 'sector', reason: '셀트리온 (바이오 동반)',          market: 'KR' },
      { symbol: 'JNJ',     type: 'sector', reason: '글로벌 제약 CMO 고객사',          market: 'US' },
    ],
  },

  // ══════════════════════════════════════════════════════════
  //  국장 — 금융
  // ══════════════════════════════════════════════════════════

  'KB금융': {
    label: 'KB금융',
    sector: '금융',
    related: [
      { symbol: '신한지주',   type: 'sector', reason: '은행 섹터 동조화',           market: 'KR' },
      { symbol: '하나금융지주', type: 'sector', reason: '은행 섹터 동조화',          market: 'KR' },
    ],
  },
  '신한지주': {
    label: '신한지주',
    sector: '금융',
    related: [
      { symbol: 'KB금융',       type: 'sector', reason: '은행 섹터 동조화',          market: 'KR' },
      { symbol: '하나금융지주', type: 'sector', reason: '은행 섹터 동조화',          market: 'KR' },
    ],
  },
  '하나금융지주': {
    label: '하나금융지주',
    sector: '금융',
    related: [
      { symbol: 'KB금융',  type: 'sector', reason: '은행 섹터 동조화',               market: 'KR' },
      { symbol: '신한지주', type: 'sector', reason: '은행 섹터 동조화',              market: 'KR' },
    ],
  },

  // ── 에너지 섹터 (유가·원유 뉴스 관련종목 매핑) ────────────────
  XOM: {
    label: 'ExxonMobil',
    sector: '에너지',
    related: [
      { symbol: 'CVX',  type: 'sector', reason: '에너지 메이저 동조화',  market: 'US' },
      { symbol: 'COP',  type: 'sector', reason: '에너지 메이저 동조화',  market: 'US' },
      { symbol: 'SLB',  type: 'sector', reason: '유전 서비스 연관',      market: 'US' },
      { symbol: 'XLE',  type: 'etf',    reason: '에너지 섹터 ETF',      market: 'US' },
      { symbol: 'USO',  type: 'etf',    reason: '원유 선물 ETF',         market: 'US' },
    ],
  },
  CVX: {
    label: 'Chevron',
    sector: '에너지',
    related: [
      { symbol: 'XOM',  type: 'sector', reason: '에너지 메이저 동조화',  market: 'US' },
      { symbol: 'COP',  type: 'sector', reason: '에너지 메이저 동조화',  market: 'US' },
      { symbol: 'SLB',  type: 'sector', reason: '유전 서비스 연관',      market: 'US' },
      { symbol: 'XLE',  type: 'etf',    reason: '에너지 섹터 ETF',      market: 'US' },
    ],
  },
  SLB: {
    label: 'Schlumberger',
    sector: '에너지',
    related: [
      { symbol: 'XOM',  type: 'sector', reason: '에너지 메이저 연관',   market: 'US' },
      { symbol: 'CVX',  type: 'sector', reason: '에너지 메이저 연관',   market: 'US' },
      { symbol: 'COP',  type: 'sector', reason: '에너지 메이저 연관',   market: 'US' },
    ],
  },
  COP: {
    label: 'ConocoPhillips',
    sector: '에너지',
    related: [
      { symbol: 'XOM',  type: 'sector', reason: '에너지 메이저 동조화', market: 'US' },
      { symbol: 'CVX',  type: 'sector', reason: '에너지 메이저 동조화', market: 'US' },
      { symbol: 'OXY',  type: 'sector', reason: '에너지 독립계 연관',   market: 'US' },
      { symbol: 'XLE',  type: 'etf',    reason: '에너지 섹터 ETF',     market: 'US' },
    ],
  },
  OXY: {
    label: 'Occidental',
    sector: '에너지',
    related: [
      { symbol: 'COP',  type: 'sector', reason: '에너지 독립계 동조화', market: 'US' },
      { symbol: 'XOM',  type: 'sector', reason: '에너지 메이저 연관',   market: 'US' },
      { symbol: 'XLE',  type: 'etf',    reason: '에너지 섹터 ETF',     market: 'US' },
    ],
  },
};

// ─── 헬퍼 함수 ────────────────────────────────────────────────

/**
 * 종목의 연관 자산 목록 반환 (새 구조)
 * @param {string} symbol - 종목 심볼 또는 한글명
 * @returns {{ symbol: string, type: string, reason: string, market: string }[]}
 */
export function getRelatedAssets(symbol) {
  const info = RELATED_ASSETS[symbol];
  if (!info) return [];
  return info.related || [];
}

/**
 * 종목의 연관 종목 티커 목록 반환 (하위 호환)
 * @param {string} symbol
 * @returns {string[]}
 */
export function getRelatedTickers(symbol) {
  const related = getRelatedAssets(symbol);
  return related.map(r => r.symbol);
}

/**
 * 전체 시장 데이터에서 연관 종목 찾기 (새 구조)
 * @param {string} symbol
 * @param {Object} dataMap - { symbol: item } 형태의 전체 시장 데이터 맵
 * @param {number} [limit=6] - 최대 반환 개수
 * @returns {{ ticker: string, type: string, reason: string, market: string, item: object|null }[]}
 */
export function findRelatedItems(symbol, dataMap, limit = 6) {
  const related = getRelatedAssets(symbol);

  // ── 하드코딩 연관 종목 있으면 우선 사용 ──────────────────────
  if (related.length) {
    return related
      .slice(0, limit)
      .map(r => ({
        ticker: r.symbol,
        type:   r.type,
        reason: r.reason,
        market: r.market,
        isEtf:  r.type === RELATION_TYPES.ETF,
        item:   dataMap[r.symbol] || null,
      }));
  }

  // ── Fallback: 섹터 기반 자동 연관 종목 ───────────────────────
  // dataMap 내 현재 종목 찾기 (심볼 or 이름 매칭)
  const currentItem = dataMap[symbol];
  if (!currentItem) return [];

  const currentSector = currentItem.sector;
  const currentMarket = currentItem.market;
  if (!currentSector) return [];

  // 같은 섹터의 다른 종목을 최대 limit개 반환
  const sectorPeers = Object.values(dataMap)
    .filter(item =>
      item &&
      item.sector === currentSector &&
      item.market === currentMarket &&
      (item.symbol || item.id) !== symbol &&
      item.name !== symbol
    )
    .slice(0, limit)
    .map(item => ({
      ticker: item.symbol || item.id || '',
      type:   'sector',
      reason: `같은 섹터 (${currentSector})`,
      market: currentMarket?.toUpperCase() || '',
      isEtf:  false,
      item,
    }));

  return sectorPeers;
}
