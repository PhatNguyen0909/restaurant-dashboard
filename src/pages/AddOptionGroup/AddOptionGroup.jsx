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

  const suggestions = useMemo(() => food_list.map(f => ({ id: f._id, name: f.name })).slice(0, 50), []);

  useEffect(() => {
    // auto-load if dishId in query param
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('dishId');
      if (id) { setDishId(id); handleLoad(id); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoad = (id = dishId) => {
    if (!id) return;
    const map = loadOverrides();
    setGroups(map[id] || []);
  };

  const handleSave = () => {
    if (!dishId) { alert('Vui lòng nhập ID món ăn'); return; }
    for (const g of groups) {
      if (!g.title) { alert('Mỗi nhóm cần tiêu đề'); return; }
      if (!g.options?.length) { alert(`Nhóm "${g.title}" cần ít nhất 1 lựa chọn`); return; }
      for (const o of g.options) {
        if (!o.label) { alert(`Nhóm "${g.title}" có lựa chọn thiếu tên`); return; }
      }
    }
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

  return (
    <div className="aog-wrap">
      <h2>Thêm/Quản lý Option Groups</h2>

      <div className="aog-row">
        <label>Món ăn (ID)</label>
        <input value={dishId} onChange={(e)=> setDishId(e.target.value)} placeholder="VD: 9" />
        <button onClick={()=> handleLoad()}>Tải</button>
      </div>

      <div className="aog-hint">Gợi ý ID: {suggestions.map(s=>s.id).slice(0,8).join(', ')}</div>

      {groups.map((g, gi) => (
        <div key={gi} className="aog-group">
          <div className="aog-group-head">
            <label>Tiêu đề
              <input value={g.title} onChange={(e)=> patchGroup(gi, { title: e.target.value })} />
            </label>
            <label>Kiểu
              <select value={g.type} onChange={(e)=> patchGroup(gi, { type: e.target.value })}>
                <option value="single">Chọn 1</option>
                <option value="multi">Chọn nhiều</option>
              </select>
            </label>
            <label className="aog-check">
              <input type="checkbox" checked={!!g.required} onChange={(e)=> patchGroup(gi, { required: e.target.checked })} /> Bắt buộc
            </label>
            <button className="aog-danger" onClick={()=> removeGroup(gi)}>Xóa nhóm</button>
          </div>
          <div className="aog-opts">
            {g.options.map((o, oi) => (
              <div key={oi} className="aog-opt-row">
                <input className="aog-opt-label" placeholder="Tên option" value={o.label} onChange={(e)=> patchOption(gi, oi, { label: e.target.value })} />
                <input className="aog-opt-price" type="number" value={o.priceDelta} onChange={(e)=> patchOption(gi, oi, { priceDelta: Number(e.target.value || 0) })} />
                <span>đ</span>
                <button className="aog-danger" onClick={()=> removeOption(gi, oi)}>Xóa</button>
              </div>
            ))}
            <button className="aog-add" onClick={()=> addOption(gi)}>+ Thêm option</button>
          </div>
        </div>
      ))}

      <div className="aog-actions">
        <button className="aog-add" onClick={addGroup}>+ Thêm nhóm</button>
        <button className="aog-primary" onClick={handleSave}>Lưu</button>
        <button onClick={handleReset}>Xóa tùy chỉnh món</button>
      </div>

      <div className="aog-preview">
        <h3>Xem trước</h3>
        <pre>{JSON.stringify(groups, null, 2)}</pre>
      </div>
    </div>
  );
}
