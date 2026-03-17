// 코인 카테고리 맵 — symbol → 섹터 (SectorRotation 통합용)
// CoinGecko top 250 기준 주요 코인 분류

const SECTOR_GROUPS = {
  'Layer 1':   ['BTC','ETH','SOL','AVAX','ADA','TRX','DOT','NEAR','APT','SUI','INJ',
                 'HBAR','ALGO','XTZ','ICP','ONE','EOS','FIL','EGLD','KLAY','IOTA',
                 'VET','ZIL','THETA','ICX','NEO','WAVES','BTT','HTX','TONCOIN','TON'],
  'Layer 2':   ['MATIC','POL','ARB','OP','LRC','IMX','STRK','METIS','MANTA','BOBA',
                 'CELR','SKL','NMR','PERP','GNO'],
  'DeFi':      ['UNI','AAVE','MKR','CRV','SUSHI','COMP','SNX','BAL','1INCH','CAKE',
                 'GMX','DYDX','JUP','RAY','LQTY','FXS','FRAX','CVX','SPELL','ANGLE',
                 'RUNE','OSMO','JUNO','SCRT','INJ'],
  'Oracle':    ['LINK','BAND','API3','UMA','TRB','DIA'],
  '결제/송금':  ['XRP','LTC','BCH','XLM','DASH','ZEC','DCR','BTG','RVN','ZEN','NANO'],
  '밈코인':    ['DOGE','SHIB','PEPE','FLOKI','BONK','WIF','BOME','MEME','MEW','TURBO',
                 'NEIRO','MOG','POPCAT','PNUT','COQ'],
  '거래소토큰': ['BNB','OKB','CRO','KCS','GT','LEO','FTT','BGB'],
  'GameFi':    ['AXS','MANA','SAND','ENJ','GALA','ILV','ALICE','YGG','PLA','MC',
                 'GODS','SLP','WAXP','CHR'],
  'AI/데이터': ['FET','TAO','AGIX','OCEAN','RNDR','GRT','NMR','RLC','CTXC','ANKR',
                 'DIA','POND','AIOZ'],
  'Privacy':   ['XMR','ZEC','DASH','ROSE','KEEP','BEAM','GRIN','ZEN'],
  'CrossChain':['ATOM','QNT','RUNE','AXL','LOOM','POLS'],
  'NFT/메타버스':['APE','BLUR','X2Y2','LOOKS','RARE','FLOW','CHZ','WAX'],
};

// 역방향 맵 생성: symbol → sector
const COIN_SECTOR_MAP = {};
for (const [sector, symbols] of Object.entries(SECTOR_GROUPS)) {
  for (const sym of symbols) {
    COIN_SECTOR_MAP[sym.toUpperCase()] = sector;
  }
}

export function getCoinSector(symbol) {
  return COIN_SECTOR_MAP[(symbol || '').toUpperCase()] ?? null;
}
