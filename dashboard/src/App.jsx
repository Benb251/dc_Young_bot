import { useState, useEffect } from 'react';
import { Bot, LogOut, Key } from 'lucide-react';
import TabBar from './components/TabBar';
import GifManager from './components/GifManager';
import BotSettings from './components/BotSettings';
import StatsPanel from './components/StatsPanel';

const API_URL = import.meta.env.VITE_API_URL || 'https://quan-hem-bot.hungyd-112.workers.dev';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('gifs');
  const [inputKey, setInputKey] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const savedKey = sessionStorage.getItem('dashboard_api_key');
    if (savedKey) {
      validateAndLogin(savedKey);
    }
  }, []);

  const validateAndLogin = async (keyToValidate) => {
    setChecking(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/api/config`, {
        headers: {
          'X-Dashboard-Key': keyToValidate
        }
      });
      if (res.ok) {
        setApiKey(keyToValidate);
        sessionStorage.setItem('dashboard_api_key', keyToValidate);
        setIsLoggedIn(true);
      } else {
        setErrorMsg('Mã bí mật (API Key) không đúng hoặc đã hết hạn.');
        sessionStorage.removeItem('dashboard_api_key');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Không thể kết nối tới server. Vui lòng kiểm tra lại.');
    } finally {
      setChecking(false);
    }
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!inputKey.trim()) return;
    validateAndLogin(inputKey.trim());
  };

  const handleLogout = () => {
    sessionStorage.removeItem('dashboard_api_key');
    setApiKey('');
    setIsLoggedIn(false);
    setInputKey('');
  };

  // ── Login Screen ────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="glass login-container" style={{ maxWidth: '400px', margin: '10vh auto' }}>
        <Bot size={64} color="#5865F2" style={{ margin: '0 auto 1rem', display: 'block' }} />
        <h1 className="title">Tổ Young Phố</h1>
        <p className="subtitle">Bot Management Dashboard</p>
        
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
          <div className="form-group">
            <label htmlFor="api-key-input" style={{ textAlign: 'left', display: 'block', marginBottom: '0.5rem' }}>
              Mã bảo mật Dashboard:
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="api-key-input"
                className="input"
                type="password"
                placeholder="Nhập API Key để đăng nhập"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                style={{ paddingLeft: '2.5rem', width: '100%', boxSizing: 'border-box' }}
                required
              />
              <Key size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            </div>
          </div>

          {errorMsg && (
            <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0, textAlign: 'left' }}>
              ⚠️ {errorMsg}
            </p>
          )}

          <button
            type="submit"
            className="btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
            disabled={checking}
          >
            {checking ? 'Đang xác thực...' : 'Xác thực & Vào Dashboard'}
          </button>
        </form>

        <p style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#64748b' }}>
          * Cấp phát và quản lý bởi Ban Quản Đốc.
        </p>
      </div>
    );
  }

  // ── Main Dashboard ──────────────────────────────────────────────
  return (
    <div className="dashboard-root">
      {/* Header */}
      <header className="dashboard-header glass">
        <div className="header-brand">
          <Bot size={28} color="#5865F2" />
          <div>
            <h1 className="header-title">Quản Hẻm Bot</h1>
            <p className="header-sub">Tổ Young Phố • Management Dashboard</p>
          </div>
        </div>
        <button
          id="logout-btn"
          className="btn danger"
          onClick={handleLogout}
          title="Đăng xuất"
        >
          <LogOut size={18} />
          <span>Đăng xuất</span>
        </button>
      </header>

      {/* Tab Bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <main className="dashboard-content">
        {activeTab === 'gifs'     && <GifManager  apiUrl={API_URL} apiKey={apiKey} />}
        {activeTab === 'settings' && <BotSettings apiUrl={API_URL} apiKey={apiKey} />}
        {activeTab === 'stats'    && <StatsPanel  apiUrl={API_URL} apiKey={apiKey} />}
      </main>
    </div>
  );
}

export default App;
