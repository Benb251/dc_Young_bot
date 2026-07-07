import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Shield, Layers, Save, RotateCcw } from 'lucide-react';

const ROLES_INFO = [
  { key: 'blender',   label: 'Blender',       emoji: '🟠', color: '#EA7600' },
  { key: 'maya',      label: 'Maya / Max',    emoji: '🔵', color: '#0BA1E2' },
  { key: 'zbrush',    label: 'ZBrush',        emoji: '🔴', color: '#CC4444' },
  { key: 'substance', label: 'Substance',     emoji: '🟡', color: '#F2A900' },
  { key: 'twoD',      label: '2D Design',     emoji: '🟣', color: '#A855F7' },
  { key: 'beginner',  label: 'Beginner',      emoji: '📚', color: '#10B981' },
];

const DEFAULTS = {
  welcomeTitle: '🎉 Chào mừng đến với Tổ Young Phố!',
  welcomeDescription: `Chào mừng <@{userId}> đến với nơi những đứa trẻ phố phường chia sẻ và phát triển kỹ năng **3D Game Art & Design**.\n\n**Để bắt đầu:**\n• Đọc <#rules> để hiểu quy tắc\n• Đến <#roles> để chọn vai trò\n\nChúc bạn có những trải nghiệm vui vẻ! 🔥\nBạn là thành viên thứ **{memberCount}** của Tổ Young Phố!`,
  welcomeColor: '#00B0F4',
  visaTitle: '🏡 Chào mừng đến với Tổ Young Phố!',
  visaDescription: `Bạn đang đứng trước cổng **Tổ Young Phố** — cộng đồng chia sẻ, học hỏi và cháy hết mình với đam mê 3D, Game & 2D Design!\n\n**Trước khi vào Phố, hãy nhận Visa của bạn** ⬇️`,
  visaButtonLabel: 'Nhận Visa vào Phố 🏡',
  rolePanelThumbnail: 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJvZ2IzcnhzMjdjcHlxODVkMWZxbDdheWs1cjViMzE1OWluamRlaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/j91j9wdUh3rm8/giphy.gif',
  rulesTitle: '📜 NỘI QUY TỔ YOUNG PHỐ',
  rulesDescription: 'Chào mừng anh em đến với **Tổ Young Phố** - Cộng đồng chia sẻ, học hỏi và cháy hết mình với đam mê 3D, Game & 2D Design! Để giữ cho "khu phố" luôn văn minh và ngăn nắp, anh em vui lòng tuân thủ các quy tắc dưới đây nhé:\n\n1️⃣ **Tôn trọng lẫn nhau**\nKhông chửi bới, công kích cá nhân, phân biệt vùng miền hay sử dụng ngôn từ thù ghét. Mọi đóng góp và nhận xét (đặc biệt trong phần khoe tác phẩm) đều phải mang tính chất xây dựng.\n\n2️⃣ **Đúng kênh, đúng chỗ**\nServer đã được chia theo từng phần mềm (Blender, Maya, ZBrush...). Hãy chat và đặt câu hỏi ở đúng danh mục tương ứng để được hỗ trợ tốt nhất.\n\n3️⃣ **Sử dụng Diễn đàn (Forum) hiệu quả**\nVới các kênh Hỏi - Đáp hoặc Khoe Work, hãy tạo **Post mới** thay vì chat tràn lan. Nhớ đặt tiêu đề rõ ràng để mọi người dễ dàng tìm kiếm và hỗ trợ.\n\n4️⃣ **Không Spam & Quảng cáo**\nCấm spam tin nhắn, gửi link độc hại, nội dung NSFW (18+), hoặc tự ý quảng cáo/mua bán khi chưa có sự cho phép của Ban Quản Đốc.\n\n5️⃣ **Tinh thần chia sẻ**\nKhông giấu nghề! Nếu bạn biết, hãy giúp đỡ những người mới. Cộng đồng phát triển thì mỗi cá nhân mới có thể tiến xa.\n\n*Cảm ơn bạn đã trở thành một phần của Tổ Young Phố!* 🖤',
  rulesColor: '#2b2d31',
  visaChannelId: '',
  visaMessageId: '',
  rolesChannelId: '',
  rolesMessageId: '',
  rulesChannelId: '',
  rulesMessageId: '',
};

export default function BotSettings({ apiUrl, apiKey }) {
  const [config, setConfig] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // 'welcome' | 'visa' | 'roles' | 'rules' | null

  const [channels, setChannels] = useState([]);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/channels`, {
        headers: {
          'X-Dashboard-Key': apiKey
        }
      });
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [apiKey, apiUrl]);

  const renderChannelOptions = () => {
    if (!channels || channels.length === 0) return null;

    const textChannels = channels.filter(c => c.type === 0 || c.type === 5);
    const categories = channels.filter(c => c.type === 4);

    const groupedChannels = categories.map(cat => {
      return {
        category: cat,
        channels: textChannels.filter(c => c.parentId === cat.id).sort((a, b) => a.position - b.position)
      };
    }).filter(group => group.channels.length > 0);

    const uncategorized = textChannels.filter(c => !c.parentId);

    return (
      <>
        {uncategorized.map(c => (
          <option key={c.id} value={c.id}># {c.name}</option>
        ))}
        {groupedChannels.map(group => (
          <optgroup key={group.category.id} label={group.category.name.toUpperCase()}>
            {group.channels.map(c => (
              <option key={c.id} value={c.id}># {c.name}</option>
            ))}
          </optgroup>
        ))}
      </>
    );
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/bot-config`, {
        headers: {
          'X-Dashboard-Key': apiKey
        }
      });
      if (res.ok) {
        const data = await res.json();
        setConfig({ ...DEFAULTS, ...data });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiKey, apiUrl]);

  useEffect(() => {
    fetchConfig();
    fetchChannels();
  }, [fetchChannels, fetchConfig]);

  const handleChange = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (section) => {
    setSaving(section);
    const sectionKeys = {
      welcome: ['welcomeTitle', 'welcomeDescription', 'welcomeColor'],
      visa:    ['visaTitle', 'visaDescription', 'visaButtonLabel', 'visaChannelId', 'visaMessageId'],
      roles:   ['rolePanelThumbnail', 'rolesChannelId', 'rolesMessageId'],
      rules:   ['rulesTitle', 'rulesDescription', 'rulesColor', 'rulesChannelId', 'rulesMessageId'],
    };
    const payload = {};
    for (const k of sectionKeys[section]) payload[k] = config[k];

    try {
      const res = await fetch(`${apiUrl}/api/bot-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dashboard-Key': apiKey
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const result = await res.json();
        const sectionName = section === 'welcome' ? 'Welcome Embed' : section === 'visa' ? 'Visa Panel' : section === 'rules' ? 'Rules Panel' : 'Role Panel';
        
        const hasMessageId = 
          (section === 'visa' && config.visaMessageId) ||
          (section === 'roles' && config.rolesMessageId) ||
          (section === 'rules' && config.rulesMessageId);

        if (result.syncError) {
          alert(`⚠️ Đã lưu cấu hình ${sectionName}, nhưng không thể cập nhật trực tiếp lên Discord:\n${result.syncError}\n\nVui lòng kiểm tra lại Channel ID và Message ID!`);
        } else if (section !== 'welcome' && !hasMessageId) {
          alert(`✅ Đã lưu cấu hình ${sectionName} thành công!\n\n💡 Lưu ý: Bạn chưa điền "Discord Message ID" nên bot chỉ lưu cấu hình vào bộ nhớ chứ chưa thể cập nhật đè lên tin nhắn cũ trên Discord.\n\nHướng dẫn: Nhấp chuột phải vào tin nhắn luật cũ trên Discord -> chọn "Copy Message ID" (Sao chép ID tin nhắn) và dán vào ô bên trên rồi bấm Lưu lại!`);
        } else {
          alert(`✅ Đã lưu cấu hình ${sectionName} và cập nhật trực tiếp lên Discord thành công!`);
        }
      } else {
        alert('❌ Lỗi khi lưu!');
      }
    } catch {
      alert('❌ Lỗi khi lưu!');
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (section) => {
    if (!confirm('Bạn có chắc muốn khôi phục về mặc định?')) return;
    const sectionKeys = {
      welcome: ['welcomeTitle', 'welcomeDescription', 'welcomeColor'],
      visa:    ['visaTitle', 'visaDescription', 'visaButtonLabel', 'visaChannelId', 'visaMessageId'],
      roles:   ['rolePanelThumbnail', 'rolesChannelId', 'rolesMessageId'],
      rules:   ['rulesTitle', 'rulesDescription', 'rulesColor', 'rulesChannelId', 'rulesMessageId'],
    };
    const reset = {};
    for (const k of sectionKeys[section]) reset[k] = DEFAULTS[k];
    setConfig(prev => ({ ...prev, ...reset }));
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Đang tải cài đặt...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Section A: Welcome Embed */}
      <div className="section-card">
        <h2 className="section-title">
          <MessageSquare size={22} color="#5865F2" />
          Welcome Embed (kênh #chào-mừng)
        </h2>
        <p className="section-desc">
          Nội dung embed gửi vào kênh chào mừng khi thành viên mới nhận Visa.
          Dùng <code>{'{userId}'}</code> và <code>{'{memberCount}'}</code> làm placeholder.
        </p>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="welcome-title">Tiêu đề Embed</label>
            <input
              id="welcome-title"
              className="input"
              type="text"
              value={config.welcomeTitle}
              onChange={e => handleChange('welcomeTitle', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="welcome-color">Màu Embed</label>
            <div className="color-input-row">
              <input
                id="welcome-color-picker"
                className="color-picker"
                type="color"
                value={config.welcomeColor}
                onChange={e => handleChange('welcomeColor', e.target.value)}
              />
              <input
                id="welcome-color"
                className="input"
                type="text"
                value={config.welcomeColor}
                onChange={e => handleChange('welcomeColor', e.target.value)}
                style={{ flex: 1 }}
              />
              <div className="color-preview" style={{ background: config.welcomeColor }} />
            </div>
          </div>

          <div className="form-group full-width">
            <label htmlFor="welcome-desc">Nội dung Embed</label>
            <textarea
              id="welcome-desc"
              className="input textarea"
              rows={5}
              value={config.welcomeDescription}
              onChange={e => handleChange('welcomeDescription', e.target.value)}
            />
          </div>
        </div>

        <div className="section-footer">
          <button className="btn secondary" onClick={() => handleReset('welcome')}>
            <RotateCcw size={16} /> Khôi phục mặc định
          </button>
          <button className="btn" id="save-welcome-btn" onClick={() => handleSave('welcome')} disabled={saving === 'welcome'}>
            <Save size={16} />
            {saving === 'welcome' ? 'Đang lưu...' : 'Lưu Welcome Embed'}
          </button>
        </div>
      </div>

      {/* Section B: Visa Panel */}
      <div className="section-card">
        <h2 className="section-title">
          <Shield size={22} color="#57F287" />
          Visa Panel (kênh #bắt-đầu)
        </h2>
        <p className="section-desc">
          Nội dung panel "Nhận Visa" ghim trong kênh bắt đầu. Thay đổi sẽ có hiệu lực với lần gửi tiếp theo.
        </p>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="visa-title">Tiêu đề Panel</label>
            <input id="visa-title" className="input" type="text" value={config.visaTitle} onChange={e => handleChange('visaTitle', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="visa-btn-label">Nhãn nút Visa</label>
            <input id="visa-btn-label" className="input" type="text" value={config.visaButtonLabel} onChange={e => handleChange('visaButtonLabel', e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="visa-channel-id">Discord Channel ID (Kênh chứa panel)</label>
            {channels.length > 0 ? (
              <select id="visa-channel-id" className="input" value={config.visaChannelId || ''} onChange={e => handleChange('visaChannelId', e.target.value)}>
                <option value="">Mặc định: Kênh bắt đầu</option>
                {renderChannelOptions()}
              </select>
            ) : (
              <input id="visa-channel-id" className="input" type="text" placeholder="Mặc định: Kênh bắt đầu" value={config.visaChannelId || ''} onChange={e => handleChange('visaChannelId', e.target.value)} />
            )}
          </div>
          <div className="form-group">
            <label htmlFor="visa-message-id">Discord Message ID (Để cập nhật đè)</label>
            <input id="visa-message-id" className="input" type="text" placeholder="Nhập Message ID để tự động đồng bộ" value={config.visaMessageId || ''} onChange={e => handleChange('visaMessageId', e.target.value)} />
          </div>
          <div className="form-group full-width">
            <label htmlFor="visa-desc">Nội dung Panel</label>
            <textarea id="visa-desc" className="input textarea" rows={4} value={config.visaDescription} onChange={e => handleChange('visaDescription', e.target.value)} />
          </div>
        </div>

        <div className="section-footer">
          <button className="btn secondary" onClick={() => handleReset('visa')}>
            <RotateCcw size={16} /> Khôi phục mặc định
          </button>
          <button className="btn" id="save-visa-btn" onClick={() => handleSave('visa')} disabled={saving === 'visa'}>
            <Save size={16} />
            {saving === 'visa' ? 'Đang lưu...' : 'Lưu Visa Panel'}
          </button>
        </div>
      </div>

      {/* Section C: Role Panel */}
      <div className="section-card">
        <h2 className="section-title">
          <Layers size={22} color="#FEE75C" />
          Role Panel (kênh #chọn-vai-trò)
        </h2>
        <p className="section-desc">
          Roles trong server. ID được cấu hình trong <code>config.js</code>. Bạn có thể thay đổi ảnh thumbnail.
        </p>

        <div className="roles-grid">
          {ROLES_INFO.map(role => (
            <div key={role.key} className="role-badge" style={{ '--role-color': role.color }}>
              <span className="role-emoji">{role.emoji}</span>
              <span className="role-name">{role.label}</span>
            </div>
          ))}
        </div>

        <div className="form-group" style={{ marginTop: '1.5rem' }}>
          <label htmlFor="role-thumbnail">Thumbnail GIF của Role Panel</label>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="role-thumbnail"
              className="input"
              type="text"
              value={config.rolePanelThumbnail}
              onChange={e => handleChange('rolePanelThumbnail', e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
            {config.rolePanelThumbnail && (
              <img src={config.rolePanelThumbnail} alt="Thumbnail preview" className="thumbnail-preview" />
            )}
          </div>
        </div>
        <div className="form-grid" style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label htmlFor="roles-channel-id">Discord Channel ID (Kênh chọn vai trò)</label>
            {channels.length > 0 ? (
              <select id="roles-channel-id" className="input" value={config.rolesChannelId || ''} onChange={e => handleChange('rolesChannelId', e.target.value)}>
                <option value="">Mặc định: Kênh chọn vai trò</option>
                {renderChannelOptions()}
              </select>
            ) : (
              <input id="roles-channel-id" className="input" type="text" placeholder="Mặc định: Kênh chọn vai trò" value={config.rolesChannelId || ''} onChange={e => handleChange('rolesChannelId', e.target.value)} />
            )}
          </div>
          <div className="form-group">
            <label htmlFor="roles-message-id">Discord Message ID (Để cập nhật đè)</label>
            <input id="roles-message-id" className="input" type="text" placeholder="Nhập Message ID để tự động đồng bộ" value={config.rolesMessageId || ''} onChange={e => handleChange('rolesMessageId', e.target.value)} />
          </div>
        </div>

        <div className="section-footer">
          <button className="btn secondary" onClick={() => handleReset('roles')}>
            <RotateCcw size={16} /> Khôi phục mặc định
          </button>
          <button className="btn" id="save-roles-btn" onClick={() => handleSave('roles')} disabled={saving === 'roles'}>
            <Save size={16} />
            {saving === 'roles' ? 'Đang lưu...' : 'Lưu Role Panel'}
          </button>
        </div>
      </div>

      {/* Section D: Rules Panel */}
      <div className="section-card">
        <h2 className="section-title">
          <MessageSquare size={22} color="#F87171" />
          Rules Panel (kênh #rules)
        </h2>
        <p className="section-desc">
          Nội quy của Server. Cấu hình này sẽ được áp dụng khi bạn dùng lệnh <code>/send-rules-panel</code> hoặc <code>/edit-panel</code>.
        </p>

        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="rules-title">Tiêu đề Rules</label>
            <input
              id="rules-title"
              className="input"
              type="text"
              value={config.rulesTitle}
              onChange={e => handleChange('rulesTitle', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="rules-color">Màu Embed</label>
            <div className="color-input-row">
              <input
                id="rules-color-picker"
                className="color-picker"
                type="color"
                value={config.rulesColor}
                onChange={e => handleChange('rulesColor', e.target.value)}
              />
              <input
                id="rules-color"
                className="input"
                type="text"
                value={config.rulesColor}
                onChange={e => handleChange('rulesColor', e.target.value)}
                style={{ flex: 1 }}
              />
              <div className="color-preview" style={{ background: config.rulesColor }} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="rules-channel-id">Discord Channel ID (Kênh rules)</label>
            {channels.length > 0 ? (
              <select id="rules-channel-id" className="input" value={config.rulesChannelId || ''} onChange={e => handleChange('rulesChannelId', e.target.value)}>
                <option value="">Mặc định: Kênh rules</option>
                {renderChannelOptions()}
              </select>
            ) : (
              <input id="rules-channel-id" className="input" type="text" placeholder="Mặc định: Kênh rules" value={config.rulesChannelId || ''} onChange={e => handleChange('rulesChannelId', e.target.value)} />
            )}
          </div>
          <div className="form-group">
            <label htmlFor="rules-message-id">Discord Message ID (Để cập nhật đè)</label>
            <input id="rules-message-id" className="input" type="text" placeholder="Nhập Message ID để tự động đồng bộ" value={config.rulesMessageId || ''} onChange={e => handleChange('rulesMessageId', e.target.value)} />
          </div>
          <div className="form-group full-width">
            <label htmlFor="rules-desc">Nội dung Rules (hỗ trợ Markdown)</label>
            <textarea
              id="rules-desc"
              className="input textarea"
              rows={12}
              value={config.rulesDescription}
              onChange={e => handleChange('rulesDescription', e.target.value)}
            />
          </div>
        </div>

        <div className="section-footer">
          <button className="btn secondary" onClick={() => handleReset('rules')}>
            <RotateCcw size={16} /> Khôi phục mặc định
          </button>
          <button className="btn" id="save-rules-btn" onClick={() => handleSave('rules')} disabled={saving === 'rules'}>
            <Save size={16} />
            {saving === 'rules' ? 'Đang lưu...' : 'Lưu Rules Panel'}
          </button>
        </div>
      </div>

    </div>
  );
}
