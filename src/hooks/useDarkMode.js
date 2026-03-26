// 다크모드 훅 — localStorage 저장 + 시스템 선호도 자동 감지
// html.dark 클래스를 직접 제어 → tokens.css의 html.dark 오버라이드 적용
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'mr_darkMode';

function getInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function useDarkMode() {
  const [dark, setDark] = useState(getInitial);

  // html.dark 클래스 토글 + localStorage 저장
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark');
    else root.classList.remove('dark');
    try { localStorage.setItem(STORAGE_KEY, String(dark)); } catch {}
  }, [dark]);

  // 수동 설정 없을 때만 시스템 선호도 변경 감지
  useEffect(() => {
    const hasSaved = localStorage.getItem(STORAGE_KEY) !== null;
    if (hasSaved) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = () => setDark(d => !d);

  return { dark, toggle };
}
