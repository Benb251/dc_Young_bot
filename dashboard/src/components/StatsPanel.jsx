import { useState, useEffect } from 'react';
import { BarChart2, RefreshCw, Users } from 'lucide-react';

const ROLE_DEFINITIONS = [
  { key: 'blender',   label: 'Blender',    emoji: '🟠', color: '#EA7600' },
  { key: 'maya',      label: 'Maya / Max', emoji: '🔵', color: '#0BA1E2' },
  { key: 'zbrush',    label: 'ZBrush',     emoji: '🔴', color: '#CC4444' },
  { key: 'substance', label: 'Substance',  emoji: '🟡', color: '#F2A900' },
  { key: 'twoD',      label: '2D Design',  emoji: '🟣', color: '#A855F7' },
  { key: 'beginner',  label: 'Beginner',   emoji: '📚', color: '#10B981' },
  { key: 'visa',      label: 'Cư dân (Visa)', emoji: '🎟️', color: '#5865F2' },
];

export default function StatsPanel({ apiUrl, apiKey }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/stats`, {
        headers: {
          'X-Dashboard-Key': apiKey
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
      setError('Không thể tải thống kê. Kiểm tra kết nối hoặc token bot.');
    } finally {
      setLoading(false);
    }
  };

  const maxCount = stats
    ? Math.max(...Object.values(stats.roles), 1)
    : 1;

  const formatTime = (d) =>
    d ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header card: tổng thành viên */}
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            <BarChart2 size={22} color="#5865F2" />
            Thống Kê Server
          </h2>
          <button
            id="refresh-stats-btn"
            className="btn secondary"
            onClick={fetchStats}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            {loading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
        {lastUpdated && (
          <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.5rem' }}>
            Cập nhật lần cuối: {formatTime(lastUpdated)}
          </p>
        )}
      </div>

      {/* Total members card */}
      {stats && (
        <div className="stats-hero-card">
          <div className="stats-hero-icon">
            <Users size={32} />
          </div>
          <div>
            <div className="stats-hero-number">{stats.totalMembers.toLocaleString()}</div>
            <div className="stats-hero-label">Tổng thành viên Server</div>
          </div>
        </div>
      )}

      {/* Role bars card */}
      <div className="section-card">
        <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#94a3b8', fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Phân bổ theo Role
        </h3>

        {error && (
          <div className="error-state">
            ⚠️ {error}
          </div>
        )}

        {loading && !stats && (
          <div className="loading-state">
            <div className="spinner" />
            <span>Đang gọi Discord API...</span>
          </div>
        )}

        {stats && (
          <div className="stat-rows">
            {ROLE_DEFINITIONS.map(({ key, label, emoji, color }) => {
              const count = stats.roles[key] ?? 0;
              const pct = Math.round((count / maxCount) * 100);
              const memberPct = stats.totalMembers > 0
                ? Math.round((count / stats.totalMembers) * 100)
                : 0;
              return (
                <div key={key} className="stat-row">
                  <div className="stat-label">
                    <span className="stat-emoji">{emoji}</span>
                    <span className="stat-name">{label}</span>
                  </div>
                  <div className="stat-bar-track">
                    <div
                      className="stat-bar-fill"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                  <div className="stat-count">
                    <strong>{count}</strong>
                    <span className="stat-pct">{memberPct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
