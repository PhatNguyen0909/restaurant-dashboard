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
  const [step, setStep] = useState(1); // 1: build groups, 2: assign to dish

  const suggestions = useMemo(() => food_list.map(f => ({ id: f._id, name: f.name })).slice(0, 50), []);

  useEffect(() => {
    // If query contains dishId, just prefill the input. We won't auto-load
    // to keep the new flow: build options first, then pick a dish to assign.
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('dishId');
      if (id) { setDishId(id); }
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

  const goNext = () => {
    const err = validateGroups(groups);
    if (err) { alert(err); return; }
    setStep(2);
  };
  const goBack = () => setStep(1);

  return (
    <div className="aog-wrap">
      <div className="aog-header">
        <h2>Thêm/Quản lý Option Groups</h2>
        <p className="aog-sub">Tạo các nhóm tùy chọn trước, sau đó chọn sản phẩm để gán.</p>
      </div>

      {/* Step 1: build groups */}
      {step === 1 && (
        <>
          {/* Quick loader to fetch existing groups without leaving Step 1 */}
          <div className="aog-card aog-assign" style={{marginBottom: 12}}>
            <h3 className="aog-section-title">Tải hiện có (tùy chọn)</h3>
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
              <button className="aog-ghost" onClick={()=> handleLoad()}>Tải hiện có</button>
            </div>
          </div>

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
            <button className="aog-primary" onClick={goNext}>Tiếp theo</button>
          </div>
        </>
      )}

      {/* Step 2: assign to dish (shown after Next) */}
      {step === 2 && (
        <div className="aog-card aog-assign">
          <h3 className="aog-section-title">Gán vào sản phẩm</h3>
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
            <button className="aog-ghost" onClick={()=> handleLoad()}>Tải hiện có</button>
            <button className="aog-primary" onClick={handleSave}>Lưu</button>
            <button className="aog-danger" onClick={handleReset} disabled={!dishId}>Xóa tùy chỉnh món</button>
            <button className="aog-ghost" onClick={goBack}>Quay lại</button>
          </div>
          <div className="aog-chips">
            {suggestions.slice(0, 12).map(s => (
              <button key={s.id} className={`aog-chip${String(s.id) === String(dishId) ? ' active' : ''}`} onClick={()=> setDishId(String(s.id))}>
                <span className="aog-chip-id">{s.id}</span>
                <span className="aog-chip-dot">•</span>
                <span className="aog-chip-name">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="aog-preview aog-card">
        <h3>Xem trước</h3>
        <pre>{JSON.stringify(groups, null, 2)}</pre>
      </div>
    </div>
  );
}
