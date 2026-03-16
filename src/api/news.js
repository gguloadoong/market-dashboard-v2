// ─── 뉴스 API v3 ───────────────────────────────────────────────
// 설계 원칙:
//   1. 자체 Vercel Edge Function (/api/rss) → CORS 없음, 서버사이드 취득
//   2. CryptoCompare (코인): CORS-free 직접 호출
//   3. rss2json / allorigins 완전 제거 (불안정, 속도 느림)
//   4. localStorage 캐시 (5분 신선, 24시간 fallback)
//   5. React Query initialData 패턴으로 즉시 표시

// ─── localStorage 캐시 ─────────────────────────────────────────
const CACHE_TTL   = 5 * 60 * 1000;
const CACHE_STALE = 24 * 60 * 60 * 1000;

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(`news_${key}`);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts < CACHE_TTL)   return { data, fresh: true };
    if (Date.now() - ts < CACHE_STALE) return { data, fresh: false };
    return null;
  } catch { return null; }
}

function cacheSet(key, data) {
  try {
    const ts = Date.now();
    localStorage.setItem(`news_${key}`, JSON.stringify({ ts, updatedAt: ts, data }));
  } catch {}
}

// ─── 시간 포맷 ────────────────────────────────────────────────
function timeAgo(dateInput) {
  if (!dateInput) return '';
  const ms   = typeof dateInput === 'number' ? dateInput * 1000 : new Date(dateInput).getTime();
  if (isNaN(ms)) return '';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}초 전`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// ─── RSS XML 파서 ──────────────────────────────────────────────
function parseRssXml(xmlText, category, sourceName) {
  try {
    const doc   = new DOMParser().parseFromString(xmlText, 'text/xml');
    const items = [...doc.querySelectorAll('item, entry')];
    return items.slice(0, 20).map(el => {
      const get  = s => (el.querySelector(s)?.textContent || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const link = get('link') || get('guid') || el.querySelector('link')?.getAttribute('href') || '';
      const title = get('title');
      if (!title || !link) return null;
      const pubDate = get('pubDate') || get('published') || get('updated') || new Date().toISOString();
      return {
        id:          get('guid') || link,
        title,
        description: get('description').replace(/<[^>]+>/g, '').slice(0, 200),
        link,
        pubDate:     new Date(pubDate).toISOString(),
        timeAgo:     timeAgo(pubDate),
        source:      sourceName,
        image:       el.querySelector('enclosure')?.getAttribute('url') || null,
        category,
      };
    }).filter(Boolean);
  } catch { return []; }
}

// ─── 자체 RSS 프록시 (/api/rss) ───────────────────────────────
// Production: Vercel Edge Function이 서버사이드로 취득
// Development: 같은 호출 (vercel dev 사용 시) 또는 직접 fetch 시도
async function fetchViaProxy(rssUrl, category, sourceName) {
  const proxyUrl = `/api/rss?url=${encodeURIComponent(rssUrl)}`;
  // 개별 fetch 타임아웃: 4초 (전체 race가 아닌 소스별 적용)
  const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const text = await res.text();
  if (text.startsWith('{')) throw new Error('proxy returned JSON error');
  const items = parseRssXml(text, category, sourceName);
  if (!items.length) throw new Error('proxy no items');
  return items;
}

// ─── corsproxy.io 경유 취득 ────────────────────────────────────
async function fetchViaCorsproxy(rssUrl, category, sourceName) {
  const url = `https://corsproxy.io/?${encodeURIComponent(rssUrl)}`;
  // 느린 RSS 소스 대기 시간 최소화: 3초 타임아웃
  const res  = await fetch(url, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`corsproxy ${res.status}`);
  const text = await res.text();
  if (!text.trim().startsWith('<')) throw new Error('corsproxy not xml');
  const items = parseRssXml(text, category, sourceName);
  if (!items.length) throw new Error('corsproxy no items');
  return items;
}

// ─── 단일 RSS 취득 (자체 프록시 → corsproxy.io 순) ───────────
async function fetchRSS(rssUrl, category, sourceName) {
  // 1순위: 자체 Vercel Edge Function 프록시
  try { return await fetchViaProxy(rssUrl, category, sourceName); } catch {}
  // 2순위: corsproxy.io fallback
  try { return await fetchViaCorsproxy(rssUrl, category, sourceName); } catch {}
  return [];
}

// ─── 금융 키워드 필터 ─────────────────────────────────────────
const FINANCE_KW = [
  '주식','증시','코스피','코스닥','코인','비트코인','이더리움','솔라나','리플','암호화폐',
  '가상화폐','나스닥','다우','s&p','금리','환율','달러','원화','기준금리',
  '주가','상장','ipo','공모','배당','실적','매출','영업이익','순이익','시가총액',
  '외국인','기관','etf','펀드','채권','선물','옵션','삼성전자','sk하이닉스',
  'bitcoin','ethereum','crypto','defi','blockchain','fed','fomc','연준',
  '금통위','한국은행','거래소','kospi','kosdaq','증권','투자','급등','급락',
  '어닝','분기','인플레','경기','침체','무역','관세','수출','gdp','cpi',
  'earnings','revenue','profit','shares','nasdaq','sp500','dow',
  '반도체','배터리','전기차','ai','인공지능','클라우드','데이터센터',
];

const BLOCK_KW = [
  '야구','축구','농구','배구','골프','올림픽','월드컵','스포츠','선수',
  '감독','코치','우승','결승','드라마','영화','아이돌','가수','배우','연예',
  '예능','콘서트','앨범','시청률','날씨','태풍','지진','홍수','미세먼지',
  '요리','레시피','맛집','카페','패션','뷰티','화장품','수능','대입','입시',
];

const FINANCE_SOURCES = new Set([
  '코인데스크코리아','블록미디어','한국경제','매일경제','조선비즈',
  'CoinTelegraph','CoinDesk','Decrypt','Bloomberg','Reuters',
]);

function isFinancialNews(item) {
  const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
  if (BLOCK_KW.some(k => text.includes(k))) return false;
  if (FINANCE_SOURCES.has(item.source)) return true;
  return FINANCE_KW.some(k => text.includes(k));
}

function dedup(items) {
  const seen = new Set();
  return items.filter(i => {
    const key = (i.title || '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// 카테고리별 뉴스 취득
// ─────────────────────────────────────────────────────────────

// [코인] CryptoCompare — CORS-free, 안정적, 키 불필요
async function fetchCoinNews() {
  const cached = cacheGet('coin');
  if (cached?.fresh) return cached.data;

  // CryptoCompare 영문 코인 뉴스 (직접 호출, CORS OK)
  const ccItems = await (async () => {
    try {
      const res  = await fetch(
        'https://min-api.cryptocompare.com/data/v2/news/?lang=EN&feeds=cointelegraph,coindesk,decrypt&extraParams=MarketDashboard',
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) throw new Error(`CC ${res.status}`);
      const data = await res.json();
      if (data.Type !== 100 || !data.Data?.length) throw new Error('CC error');
      return data.Data.slice(0, 20).map(a => ({
        id:          String(a.id),
        title:       a.title,
        description: (a.body || '').replace(/<[^>]+>/g, '').slice(0, 200),
        link:        a.url,
        pubDate:     new Date(a.published_on * 1000).toISOString(),
        timeAgo:     timeAgo(a.published_on),
        source:      a.source_info?.name || 'CryptoCompare',
        image:       a.imageurl || null,
        category:    'coin',
      }));
    } catch { return []; }
  })();

  // Google News 코인 RSS — 자체 프록시로 취득
  const krCoinItems = await fetchRSS(
    'https://news.google.com/rss/search?q=%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+%EC%9D%B4%EB%8D%94%EB%A6%AC%EC%9B%80+%EC%BD%94%EC%9D%B8&hl=ko&gl=KR&ceid=KR:ko',
    'coin', '구글뉴스',
  );

  const items = dedup([...ccItems, ...krCoinItems.filter(isFinancialNews)])
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 30);

  if (items.length > 0) cacheSet('coin', items);
  else if (cached?.data) return cached.data;
  return items;
}

// [미장] Google News (자체 프록시) + Finnhub (키 있을 때)
async function fetchUsNews() {
  const cached = cacheGet('us');
  if (cached?.fresh) return cached.data;

  const finnhubKey = import.meta.env.VITE_FINNHUB_API_KEY || '';

  // Finnhub 직접 API (CORS OK, 키 있을 때)
  const finnhubItems = finnhubKey ? await (async () => {
    try {
      const res  = await fetch(
        `https://finnhub.io/api/v1/news?category=general&token=${finnhubKey}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) throw new Error(`Finnhub ${res.status}`);
      const data = await res.json();
      return (Array.isArray(data) ? data : []).slice(0, 15).map(a => ({
        id:          String(a.id),
        title:       a.headline,
        description: (a.summary || '').slice(0, 200),
        link:        a.url,
        pubDate:     new Date(a.datetime * 1000).toISOString(),
        timeAgo:     timeAgo(a.datetime),
        source:      a.source || 'Finnhub',
        image:       a.image || null,
        category:    'us',
      })).filter(i => i.title && i.link);
    } catch { return []; }
  })() : [];

  // Google News 미국 증시 RSS
  const googleItems = await fetchRSS(
    'https://news.google.com/rss/search?q=%EB%AF%B8%EA%B5%AD%EC%A6%9D%EC%8B%9C+%EB%82%98%EC%8A%A4%EB%8B%A5+S%26P500+%EC%97%B0%EC%A4%80&hl=ko&gl=KR&ceid=KR:ko',
    'us', '구글뉴스',
  );

  const items = dedup([...finnhubItems, ...googleItems.filter(isFinancialNews)])
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 30);

  if (items.length > 0) cacheSet('us', items);
  else if (cached?.data) return cached.data;
  return items;
}

// [국장] Google News (자체 프록시)
async function fetchKrNews() {
  const cached = cacheGet('kr');
  if (cached?.fresh) return cached.data;

  const googleItems = await fetchRSS(
    'https://news.google.com/rss/search?q=%EC%BD%94%EC%8A%A4%ED%94%BC+%EC%BD%94%EC%8A%A4%EB%8B%A5+%EC%A6%9D%EC%8B%9C+%EC%A3%BC%EC%8B%9D+%EC%82%BC%EC%84%B1%EC%A0%84%EC%9E%90&hl=ko&gl=KR&ceid=KR:ko',
    'kr', '구글뉴스',
  );

  const items = dedup(googleItems.filter(isFinancialNews))
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 30);

  if (items.length > 0) cacheSet('kr', items);
  else if (cached?.data) return cached.data;
  return items;
}

// ─── Promise 디덥 + stale-while-revalidate ────────────────────
// stale 데이터가 있으면 즉시 반환하고, 백그라운드에서 갱신
const _pending = { all: null, coin: null, us: null, kr: null };

function withDedup(key, fetchFn) {
  const cached = cacheGet(key);

  // fresh 캐시 — 즉시 반환, 네트워크 호출 없음
  if (cached?.fresh) return Promise.resolve(cached.data);

  // stale 캐시 — 즉시 반환 후 백그라운드에서 갱신 (stale-while-revalidate)
  if (cached?.data) {
    if (!_pending[key]) {
      _pending[key] = fetchFn().finally(() => { _pending[key] = null; });
    }
    // stale 데이터를 즉시 반환 (사용자 체감 속도 개선)
    return Promise.resolve(cached.data);
  }

  // 캐시 없음 — 네트워크 대기
  if (_pending[key]) return _pending[key];
  _pending[key] = fetchFn().finally(() => { _pending[key] = null; });
  return _pending[key];
}

// ─── Public API ───────────────────────────────────────────────
export function fetchNewsByCategory(category) {
  switch (category) {
    case 'coin': return withDedup('coin', fetchCoinNews);
    case 'us':   return withDedup('us',   fetchUsNews);
    case 'kr':   return withDedup('kr',   fetchKrNews);
    default:     return fetchAllNews();
  }
}

export function fetchAllNews() {
  return withDedup('all', async () => {
    const cachedAll = cacheGet('all');

    const [coinRes, usRes, krRes] = await Promise.allSettled([
      fetchCoinNews(),
      fetchUsNews(),
      fetchKrNews(),
    ]);

    const all = [
      ...(coinRes.status === 'fulfilled' ? coinRes.value : []),
      ...(usRes.status   === 'fulfilled' ? usRes.value   : []),
      ...(krRes.status   === 'fulfilled' ? krRes.value   : []),
    ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    if (!all.length) {
      if (cachedAll?.data) return cachedAll.data;
      throw new Error('뉴스 없음');
    }
    cacheSet('all', all);
    return all;
  });
}

export function invalidateNewsCache() {
  ['all','coin','us','kr'].forEach(k => {
    try { localStorage.removeItem(`news_${k}`); } catch {}
  });
}

// React Query initialData용 — 동기 로컬스토리지 읽기 (stale 포함 즉시 반환)
export function getInitialNewsData(key = 'all') {
  return cacheGet(key)?.data ?? undefined;
}

// 캐시의 updatedAt 타임스탬프 반환 — 프론트에서 "N분 전 기준" 표시에 활용
export function getInitialNewsTimestamp(key = 'all') {
  try {
    const raw = localStorage.getItem(`news_${key}`);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    // updatedAt: 실제 데이터 갱신 시각 / ts: 캐시 저장 시각 (동일)
    return parsed.updatedAt ?? parsed.ts ?? 0;
  } catch { return 0; }
}
