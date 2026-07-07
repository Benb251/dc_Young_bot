import { useState, useEffect } from 'react';
import { Trash2, Plus, Save, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

export default function GifManager({ apiUrl, apiKey }) {
  const [gifs, setGifs] = useState([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    fetchGifs();
  }, []);

  const fetchGifs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/config`, {
        headers: {
          'X-Dashboard-Key': apiKey
        }
      });
      const data = await res.json();
      setGifs(data.gifs || []);
    } catch (e) {
      console.error(e);
      alert('Không thể tải cấu hình từ Server');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${apiUrl}/api/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dashboard-Key': apiKey
        },
        body: JSON.stringify({ gifs }),
      });
      alert('✅ Đã lưu cấu hình thành công!');
    } catch (e) {
      console.error(e);
      alert('❌ Lỗi khi lưu!');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    if (gifs.includes(trimmed)) {
      alert('Link GIF này đã có trong danh sách!');
      return;
    }
    setGifs([...gifs, trimmed]);
    setNewUrl('');
    setShowPreview(false);
    setPreviewError(false);
  };

  const handleRemove = (index) => {
    setGifs(gifs.filter((_, i) => i !== index));
  };

  const handleUrlChange = (e) => {
    setNewUrl(e.target.value);
    setShowPreview(false);
    setPreviewError(false);
  };

  return (
    <div className="section-card">
      <h2 className="section-title">
        <ImageIcon size={22} color="#5865F2" />
        Kho ảnh GIF Chào mừng
        <span className="badge">{gifs.length} GIF</span>
      </h2>
      <p className="section-desc">
        Mỗi khi thành viên mới nhận Visa, bot sẽ gửi một GIF ngẫu nhiên từ kho này vào kênh chào mừng.
      </p>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <span>Đang tải dữ liệu...</span>
        </div>
      ) : (
        <>
          {gifs.length === 0 ? (
            <div className="empty-state">
              <ImageIcon size={48} opacity={0.3} />
              <p>Chưa có GIF nào. Thêm link GIF đầu tiên bên dưới!</p>
            </div>
          ) : (
            <div className="gif-grid">
              {gifs.map((url, i) => (
                <div key={i} className="gif-card">
                  <img src={url} alt={`Welcome GIF ${i + 1}`} loading="lazy" />
                  <div className="gif-actions">
                    <button className="btn danger" onClick={() => handleRemove(i)}>
                      <Trash2 size={16} /> Xóa
                    </button>
                  </div>
                  <div className="gif-index">#{i + 1}</div>
                </div>
              ))}
            </div>
          )}

          {/* Add section */}
          <div className="add-section">
            <input
              type="text"
              id="gif-url-input"
              className="input"
              placeholder="Nhập link ảnh GIF (https://media.giphy.com/...)"
              value={newUrl}
              onChange={handleUrlChange}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              className="btn secondary"
              onClick={() => { setShowPreview(!showPreview); setPreviewError(false); }}
              disabled={!newUrl.trim()}
              title="Preview GIF"
            >
              {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button className="btn" onClick={handleAdd} disabled={!newUrl.trim()}>
              <Plus size={18} /> Thêm
            </button>
          </div>

          {/* Preview area */}
          {showPreview && newUrl.trim() && (
            <div className="preview-gif-container">
              <p className="preview-label">Xem trước:</p>
              {previewError ? (
                <div className="preview-error">❌ Không thể tải GIF. Kiểm tra lại link.</div>
              ) : (
                <img
                  src={newUrl.trim()}
                  alt="Preview"
                  className="preview-gif"
                  onError={() => setPreviewError(true)}
                />
              )}
            </div>
          )}
        </>
      )}

      <div className="section-footer">
        <button
          className="btn"
          id="save-gifs-btn"
          onClick={handleSave}
          disabled={saving || loading}
        >
          <Save size={18} />
          {saving ? 'Đang lưu...' : 'Lưu Thay Đổi Lên Server'}
        </button>
      </div>
    </div>
  );
}
