import { Image as ImageIcon, Settings, BarChart2 } from 'lucide-react';

const TABS = [
  { id: 'gifs',     label: 'GIF Chào Mừng', icon: ImageIcon },
  { id: 'settings', label: 'Cài Đặt Bot',   icon: Settings  },
  { id: 'stats',    label: 'Thống Kê',       icon: BarChart2 },
];

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tab-bar">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          id={`tab-${id}`}
          className={`tab-btn${active === id ? ' active' : ''}`}
          onClick={() => onChange(id)}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
