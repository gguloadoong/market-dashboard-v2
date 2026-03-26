// 급등/급락 위젯 — KR/US/COIN 탭 (6박스)
import { useState } from 'react';
// 네이티브 탭 컴포넌트 (CDS TabbedChips 대체)
function SimpleTabs({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-1 bg-[#F2F4F6] rounded-lg p-1">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 text-[12px] font-medium py-1 px-2 rounded-md transition-colors ${
            activeTab === tab.id
              ? 'bg-white text-[#191F28] shadow-sm'
              : 'text-[#8B95A1] hover:text-[#191F28]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
import HotListSection from '../HotListSection';

const TABS = [
  { id: 'all',  label: '전체' },
  { id: 'kr',   label: '국내' },
  { id: 'us',   label: '미장' },
  { id: 'coin', label: '코인' },
];

export default function TopMoversWidget({ hasData, krHot, usHot, coinHot, krDrop, usDrop, coinDrop, krwRate, onItemClick }) {
  const [tab, setTab] = useState('all');

  const filtered = {
    krHot:   tab === 'us' || tab === 'coin' ? [] : krHot,
    usHot:   tab === 'kr' || tab === 'coin' ? [] : usHot,
    coinHot: tab === 'kr' || tab === 'us'   ? [] : coinHot,
    krDrop:  tab === 'us' || tab === 'coin' ? [] : krDrop,
    usDrop:  tab === 'kr' || tab === 'coin' ? [] : usDrop,
    coinDrop:tab === 'kr' || tab === 'us'   ? [] : coinDrop,
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[12px] font-bold text-[#8B95A1] uppercase tracking-wide flex-shrink-0">급등/급락</span>
        <SimpleTabs tabs={TABS} activeTab={tab} onChange={setTab} />
      </div>
      <HotListSection hasData={hasData} krwRate={krwRate} onItemClick={onItemClick} {...filtered} />
    </div>
  );
}
