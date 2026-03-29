// api/news-summary.js — Gemini 기반 뉴스 요약 Vercel Edge Function
// GET /api/news-summary?url=<기사URL>&title=<제목>&fallback=<RSS_description>
export const config = { runtime: 'edge' };

const GEMINI_KEY = process.env.GEMINI_API_KEY;
// primary: gemini-2.5-flash-lite, fallback: gemini-1.5-flash (rate limit 시 재시도)
const GEMINI_MODELS = [
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
];

// HTML 엔티티 디코딩 + 공백 정리
function cleanText(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// 기사 HTML 크롤 후 본문 추출 (노이즈 최소화)
async function fetchArticleText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const html = await res.text();

  // og:description 추출 (메타 태그 — 대부분의 뉴스 사이트가 지원)
  const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  const ogDesc = ogMatch ? cleanText(ogMatch[1]) : '';

  // script/style/nav/header/footer/aside 제거
  const stripped = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  // <article> 태그가 있으면 그 안의 텍스트만 추출
  const articleMatch = stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    const articleText = cleanText(articleMatch[1].replace(/<[^>]+>/g, ' '));
    if (articleText.length > 200) return articleText.slice(0, 4000);
  }

  // <article> 없으면 <p> 태그 텍스트 합산 (본문 추출 핵심)
  const pTags = stripped.match(/<p[^>]*>[^<]{20,}<\/p>/gi) || [];
  if (pTags.length >= 2) {
    const pText = pTags.map(p => cleanText(p.replace(/<[^>]+>/g, ' '))).join(' ');
    if (pText.length > 200) return pText.slice(0, 4000);
  }

  // og:description이 충분하면 사용
  if (ogDesc.length > 80) return ogDesc;

  // 최종 fallback: 전체 텍스트 (노이즈 포함)
  const fullText = cleanText(stripped.replace(/<[^>]+>/g, ' '));
  return fullText.slice(0, 3000);
}

// Gemini로 요약 — 429 rate limit 시 fallback 모델로 재시도
async function summarize(text, isFullArticle = false) {
  const prompt = isFullArticle
    ? `다음 뉴스 기사 본문을 투자자 관점에서 핵심만 3문장 이내로 한국어 요약해주세요. 구체적 수치, 종목명, 영향(상승/하락 요인)을 반드시 포함하세요. 제목을 반복하지 마세요:\n\n${text}`
    : `다음은 뉴스 제목과 요약입니다. 이 정보만으로 투자자에게 유용한 핵심 분석을 2~3문장으로 작성해주세요. 시장 영향, 관련 섹터, 투자 시사점을 포함하세요. 제목을 그대로 반복하지 말고 새로운 인사이트를 제공하세요:\n\n${text}`;

  let lastError = new Error('Gemini 모델 목록 비어있음');
  for (const modelUrl of GEMINI_MODELS) {
    const res = await fetch(`${modelUrl}?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    }
    const errBody = await res.text().catch(() => '');
    lastError = new Error(`Gemini ${res.status}: ${errBody.slice(0, 200)}`);
    // 429(rate limit) / 503(과부하)만 fallback — 그 외(400, 401 등)는 즉시 실패
    if (res.status !== 429 && res.status !== 503) break;
  }
  throw lastError;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const url      = searchParams.get('url');
  const title    = searchParams.get('title') || '';
  const fallback = searchParams.get('fallback') || '';

  if (!url) {
    return new Response(JSON.stringify({ error: 'url required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // SSRF 방어: 허용된 프로토콜만 크롤
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: 'Invalid protocol' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }
    // 내부 네트워크 차단 (localhost, 사설 IP, 메타데이터)
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1'
      || host === '0.0.0.0' || host.endsWith('.local')
      || host === '169.254.169.254' || host === 'metadata.google.internal'
      || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) {
      return new Response(JSON.stringify({ error: 'Internal hosts not allowed' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (e) {
    console.warn('[news-summary] Invalid URL:', url, e.message);
    return new Response(JSON.stringify({ error: 'Invalid url' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!GEMINI_KEY) {
    return new Response(JSON.stringify({ summary: null, error: 'no gemini key' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 기사 크롤 시도 → 실패 시 제목+RSS description 조합
    let articleText = '';
    try {
      articleText = await fetchArticleText(url);
    } catch (e) {
      console.warn('[news-summary] 크롤 실패:', url, e.message);
    }

    // 크롤 성공 시 기사 본문, 실패 시 제목+description 조합
    const isFullArticle = articleText.length > 200;
    const text = isFullArticle
      ? articleText
      : [title, fallback].filter(Boolean).join('\n\n');

    if (!text || text.length < 20) {
      return new Response(JSON.stringify({ summary: null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const summary = await summarize(text, isFullArticle);
    return new Response(JSON.stringify({ summary }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    // 에러 시에도 200 반환 — 클라이언트는 summary:null 처리
    return new Response(JSON.stringify({ summary: null, error: e.message }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
