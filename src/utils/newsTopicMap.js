// 뉴스 주제 → 섹터 매핑 (규칙 기반, AI 없음)
// 종목명 직접 매칭 없이도 뉴스 맥락으로 관련 섹터·종목을 추론

export const NEWS_TOPIC_MAP = [
  {
    id: 'semiconductor',
    keywords: ['반도체','hbm','파운드리','메모리','낸드','dram','tsmc','ai칩','gpu','웨이퍼','칩','chip'],
    sectors: ['반도체', 'IT하드웨어', '전자'],
  },
  {
    id: 'ev_battery',
    keywords: ['2차전지','배터리','전기차','ev','리튬','양극재','음극재','전해질','충전','배터리셀'],
    sectors: ['배터리', '전기차', '자동차부품'],
  },
  {
    id: 'interest_rate',
    keywords: ['금리','연준','fomc','fed','기준금리','금리인상','금리인하','통화정책','긴축','양적완화','인플레','인플레이션','cpi'],
    sectors: ['은행', '보험', '금융'],
  },
  {
    id: 'construction',
    // 건설 관련 뉴스 — 투자 판단에 영향주는 건설주 뉴스 (생활 부동산 기사는 isFinancialNews로 차단됨)
    keywords: ['건설','착공','시공','건축','재건축','재개발','인프라','수주잔고'],
    sectors: ['건설'],
  },
  {
    id: 'energy',
    keywords: ['유가','원유','opec','wti','brent','에너지','석유','천연가스','lng','정유'],
    sectors: ['에너지', '정유', '화학'],
  },
  {
    id: 'trade_tariff',
    keywords: ['관세','무역전쟁','수출규제','미중갈등','통상마찰','무역분쟁'],
    sectors: ['자동차', '조선', '전자', '화학'],
  },
  {
    id: 'exchange_rate',
    keywords: ['환율','달러강세','달러약세','원달러','달러인덱스','원화약세','원화강세'],
    sectors: ['자동차', '전자', '항공'],
  },
  {
    id: 'ai_tech',
    keywords: ['인공지능','ai','llm','chatgpt','데이터센터','클라우드','딥러닝','생성형ai'],
    sectors: ['AI', 'IT소프트웨어', '반도체'],
  },
  {
    id: 'bio_pharma',
    keywords: ['바이오','제약','임상','fda','신약','항암','의약품','헬스케어','임상시험','신약승인'],
    sectors: ['바이오', '제약', '헬스케어'],
  },
  {
    id: 'shipping',
    keywords: ['해운','운임','선박','컨테이너','항만','화물선','조선수주'],
    sectors: ['조선', '해운'],
  },
  {
    id: 'crypto',
    keywords: ['비트코인','이더리움','암호화폐','가상자산','블록체인','코인거래소'],
    sectors: ['암호화폐'],
  },
  {
    id: 'steel_material',
    keywords: ['철강','포스코','원자재','구리','알루미늄','니켈','소재'],
    sectors: ['철강', '소재'],
  },
  {
    id: 'auto',
    keywords: ['자동차','전기차수요','완성차','자동차수출','차량판매'],
    sectors: ['자동차', '자동차부품'],
  },
  {
    id: 'defense',
    keywords: ['방산','방위산업','k방산','군수','무기수출','국방예산'],
    sectors: ['방산'],
  },
];

// 뉴스 제목에서 감지된 섹터 목록 반환
export function detectNewsSectors(newsTitle) {
  if (!newsTitle) return [];
  const lower = newsTitle.toLowerCase();
  const sectors = new Set();
  for (const topic of NEWS_TOPIC_MAP) {
    if (topic.keywords.some(kw => lower.includes(kw))) {
      topic.sectors.forEach(s => sectors.add(s));
    }
  }
  return [...sectors];
}

// 섹터 목록 → allItems에서 관련종목 추출 (시가총액/거래량 상위 우선)
export function findStocksBySectors(sectors, allItems, max = 5) {
  if (!sectors.length || !allItems.length) return [];
  const seen = new Set();
  const matched = [];

  for (const item of allItems) {
    if (!item.sector) continue;
    const key = item.symbol || item.id;
    if (seen.has(key)) continue;
    if (sectors.some(s => (item.sector || '').includes(s) || s.includes(item.sector || ''))) {
      seen.add(key);
      matched.push(item);
    }
  }

  // 거래량 또는 시가총액 높은 순 정렬 (대형주 우선)
  matched.sort((a, b) => {
    const volA = a.volume ?? a.volume24h ?? 0;
    const volB = b.volume ?? b.volume24h ?? 0;
    return volB - volA;
  });

  return matched.slice(0, max);
}
