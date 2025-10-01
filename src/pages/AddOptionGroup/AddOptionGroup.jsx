import React, { useEffect, useMemo, useState } from 'react';
import './AddOptionGroup.css';
import { food_list } from '../../assets/assets';

/*
  Trang thêm/sửa Option Group cho món ăn của merchant.
  Hiện tại: demo standalone dùng local state và (tùy chọn) localStorage để lưu tạm.
  Tích hợp API:
  - POST / PUT tới merchantAPI khi backend sẵn sàng: create/update option-groups of a dish
*/

const STORAGE_KEY = 'dashboard_option_groups_overrides_v1';

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {}
  return {};
}
function saveOverrides(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

const defaultGroup = () => ({ title: '', type: 'single', required: false, options: [{ label: '', priceDelta: 0 }] });

export default function AddOptionGroup() {
  const [dishId, setDishId] = useState('');
  const [groups, setGroups] = useState([]);
  // Bỏ tích hợp API; chỉ làm localStorage demo

  // suggestions fallback từ assets nếu API không trả về
  const suggestions = useMemo(() => food_list.map(f => ({ id: f._id, name: f.name })).slice(0, 50), []);

  useEffect(() => {
    // Nếu URL có dishId thì prefill
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('dishId');
      if (id) setDishId(id);
    } catch {}
  }, []);

  const handleLoad = (id = dishId) => {
    if (!id) return;
    const map = loadOverrides();
    setGroups(map[id] || []);
  };

  const handleSave = () => {
    if (!dishId) { alert('Vui lòng nhập ID món ăn'); return; }
    const err = validateGroups(groups);
    if (err) { alert(err); return; }
    const map = loadOverrides();
    map[dishId] = groups;
    saveOverrides(map);
    alert('Đã lưu option groups cho món ' + dishId);
  };

  const handleReset = () => {
    if (!dishId) return;
    if (!confirm('Xóa tùy chỉnh cho món này?')) return;
    const map = loadOverrides();
    delete map[dishId];
    saveOverrides(map);
    setGroups([]);
  };

  const addGroup = () => setGroups(prev => [...prev, defaultGroup()]);
  const removeGroup = (idx) => setGroups(prev => prev.filter((_, i) => i !== idx));
  const patchGroup = (idx, patch) => setGroups(prev => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  const addOption = (gIdx) => setGroups(prev => prev.map((g, i) => (i === gIdx ? { ...g, options: [...g.options, { label: '', priceDelta: 0 }] } : g)));
  const removeOption = (gIdx, oIdx) => setGroups(prev => prev.map((g, i) => (i === gIdx ? { ...g, options: g.options.filter((_, j) => j !== oIdx) } : g)));
  const patchOption = (gIdx, oIdx, patch) => setGroups(prev => prev.map((g, i) => (i === gIdx ? { ...g, options: g.options.map((o, j) => (j === oIdx ? { ...o, ...patch } : o)) } : g)));

  const validateGroups = (gs) => {
    if (!gs.length) return 'Vui lòng thêm ít nhất một nhóm tuỳ chọn';
    for (const g of gs) {
      if (!g.title) return 'Mỗi nhóm cần tiêu đề';
      if (!g.options?.length) return `Nhóm "${g.title}" cần ít nhất 1 lựa chọn`;
      for (const o of g.options) {
        if (!o.label) return `Nhóm "${g.title}" có lựa chọn thiếu tên`;
      }
    }
    return null;
  };

  // Đã bỏ flow nhiều bước; giữ 1 màn hình duy nhất

  const formatVND = (n) => {
    const num = Number(n || 0);
    try { return num.toLocaleString('vi-VN'); } catch { return String(num); }
  };

  return (
    <div className="aog-wrap">
      <div className="aog-header">
        <h2>Thêm/Quản lý Option Groups</h2>
        <p className="aog-sub">Nhập ID món hoặc chọn gợi ý, tải nhóm tuỳ chọn hiện có (lưu ở trình duyệt), rồi thêm/sửa nhóm.</p>
      </div>

      {/* Top row: Chọn món ăn + Preview cùng hàng */}
      <div className="aog-top-row" style={{marginBottom: 16}}>
        <div className="aog-card aog-assign">
          <h3 className="aog-section-title">Chọn món ăn</h3>
          <div className="aog-row">
            <label className="aog-field" style={{flex:1}}>
              <span>Món ăn (ID)</span>
              <input list="dish-suggestions" value={dishId} onChange={(e)=> setDishId(e.target.value)} placeholder="Nhập ID hoặc chọn..." />
              <datalist id="dish-suggestions">
                {suggestions.map(s => (
                  <option key={s.id} value={s.id}>{`${s.id} - ${s.name}`}</option>
                ))}
              </datalist>
            </label>
            <button className="aog-ghost" onClick={()=> handleLoad()} disabled={!dishId}>Tải Option Groups</button>
          </div>
          <div className="aog-hint">Dữ liệu đang lưu tạm tại trình duyệt (localStorage). Bạn có thể thêm/sửa nhóm bên dưới.</div>
        </div>

        <div className="aog-live aog-card">
          <h3 className="live-title-main">Xem trước (App khách)</h3>
          {groups.length === 0 && (
            <div className="aog-hint">Chưa có nhóm tuỳ chọn. Hãy thêm nhóm để xem preview.</div>
          )}
          {groups.map((g, gi) => (
            <div key={gi} className="live-group">
              <div className="live-group-head">
                <div className="live-group-title">{g.title || 'Tên nhóm'}</div>
                <div className="live-group-meta">
                  {g.required ? <span className="badge badge-required">Bắt buộc</span> : <span className="badge">Tùy chọn</span>}
                  <span className="badge badge-weak">{g.type === 'single' ? 'Chọn 1' : 'Chọn nhiều'}</span>
                </div>
              </div>
              <div className="live-options">
                {g.options.map((o, oi) => (
                  <label key={oi} className="live-option">
                    <div className="live-left">
                      <input type={g.type === 'single' ? 'radio' : 'checkbox'} name={`preview-${gi}`} defaultChecked={g.type === 'single' ? oi === 0 : false} readOnly />
                      <span className="live-opt-label">{o.label || 'Lựa chọn'}</span>
                    </div>
                    <span className="live-price">+ {formatVND(o.priceDelta)}đ</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor full width below */}
      {groups.map((g, gi) => (
        <div key={gi} className="aog-group aog-card">
          <div className="aog-group-head">
            <label className="aog-field">
              <span>Tiêu đề</span>
              <input value={g.title} onChange={(e)=> patchGroup(gi, { title: e.target.value })} />
            </label>
            <label className="aog-field">
              <span>Kiểu</span>
              <select value={g.type} onChange={(e)=> patchGroup(gi, { type: e.target.value })}>
                <option value="single">Chọn 1</option>
                <option value="multi">Chọn nhiều</option>
              </select>
            </label>
            <label className="aog-check aog-field-inline">
              <input type="checkbox" checked={!!g.required} onChange={(e)=> patchGroup(gi, { required: e.target.checked })} /> Bắt buộc
            </label>
            <button className="aog-danger" onClick={()=> removeGroup(gi)}>Xóa nhóm</button>
          </div>
          <div className="aog-opts">
            {g.options.map((o, oi) => (
              <div key={oi} className="aog-opt-row">
                <input className="aog-opt-label" placeholder="Tên option" value={o.label} onChange={(e)=> patchOption(gi, oi, { label: e.target.value })} />
                <div className="aog-price-wrap">
                  <input className="aog-opt-price" type="number" value={o.priceDelta} onChange={(e)=> patchOption(gi, oi, { priceDelta: Number(e.target.value || 0) })} />
                  <span>đ</span>
                </div>
                <button className="aog-danger" onClick={()=> removeOption(gi, oi)}>Xóa</button>
              </div>
            ))}
            <button className="aog-add" onClick={()=> addOption(gi)}>+ Thêm option</button>
          </div>
        </div>
      ))}

      <div className="aog-actions">
        <button className="aog-add" onClick={addGroup}>+ Thêm nhóm</button>
        <button className="aog-primary" onClick={handleSave} disabled={!dishId}>Lưu</button>
        <button className="aog-danger" onClick={handleReset} disabled={!dishId}>Xóa tùy chỉnh món</button>
      </div>
    </div>
  );
}
