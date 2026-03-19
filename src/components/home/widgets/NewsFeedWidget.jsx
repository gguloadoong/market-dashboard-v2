// 뉴스 피드 위젯 — 종목 연결 카드형
import TopNewsSection from '../TopNewsSection';

export default function NewsFeedWidget({ allNews, onNewsClick, allItems = [] }) {
  return <TopNewsSection allNews={allNews} onNewsClick={onNewsClick} allItems={allItems} />;
}
