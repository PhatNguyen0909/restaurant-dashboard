import React, { useEffect, useMemo, useState } from 'react';
import './AddOptionGroup.css';
import { food_list } from '../../assets/assets';
import merchantAPI from '../../api/merchantAPI';

// v2 storage: groups and assignments
const GROUPS_KEY = 'dashboard_option_groups_v2'; // { [groupId]: Group }
const ASSIGN_KEY = 'dashboard_option_group_assignments_v2'; // { [groupId]: string[] dishIds }

const defaultGroup = () => ({ title: '', type: 'single', required: false, options: [{ label: '', priceDelta: 0 }] });
const clone = (obj) => JSON.parse(JSON.stringify(obj || {}));
const genGroupId = () => 'og_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now().toString(36);

function safeLoad(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : clone(fallback); } catch { return clone(fallback); }
}
function safeSave(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export default function AddOptionGroup() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'manage'

  // Dishes
  const [dishes, setDishes] = useState([]);
  const [dishesLoading, setDishesLoading] = useState(true);
  const dishMap = useMemo(() => {
    const m = {};
    for (const d of dishes) { m[d._id] = d; }
    return m;
  }, [dishes]);
  const dishSuggestions = useMemo(() => dishes.map(d => ({ id: d._id, name: d.name })), [dishes]);

  // Storage states (manage tab)
  const [groupsMap, setGroupsMap] = useState(() => safeLoad(GROUPS_KEY, {}));
  const [assignMap, setAssignMap] = useState(() => safeLoad(ASSIGN_KEY, {}));
  const groupsList = useMemo(() => Object.values(groupsMap), [groupsMap]);

  // Create tab states
  const [newGroup, setNewGroup] = useState(defaultGroup());
  const [assignDishId, setAssignDishId] = useState('');

  // Manage tab states
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [editGroup, setEditGroup] = useState(null);
  const selectedAssignments = useMemo(() => assignMap[selectedGroupId] || [], [assignMap, selectedGroupId]);

  // Fetch dishes (demo-aware)
  useEffect(() => {
    (async () => {
      setDishesLoading(true);
      try {
        // Detect demo user
        const userStr = document.cookie.split('; ').find(row => row.startsWith('user='));
        let isDemo = false;
        if (userStr) {
          try { const userObj = JSON.parse(decodeURIComponent(userStr.split('=')[1])); isDemo = userObj.email === 'demo'; } catch {}
        }
        if (isDemo) {
          const demo = food_list.filter(item => item.restaurantId === '1');
          setDishes(demo);
        } else {
          const merchant = await merchantAPI.getMyMerchant();
          const merchantId = merchant?.id || merchant?._id;
          if (!merchantId) throw new Error('missing merchant id');
          const data = await merchantAPI.getDish(merchantId);
          setDishes(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        // fallback minimal from assets to avoid blank UI
        if (!dishes?.length) {
          setDishes(food_list.slice(0, 50));
        }
      } finally {
        setDishesLoading(false);
      }
    })();
  }, []);

  // Helpers to refresh storage states
  const refreshStorage = () => {
    setGroupsMap(safeLoad(GROUPS_KEY, {}));
    setAssignMap(safeLoad(ASSIGN_KEY, {}));
  };

  // When selecting a group in Manage, load a working copy
  useEffect(() => {
    if (!selectedGroupId) { setEditGroup(null); return; }
    const g = groupsMap[selectedGroupId];
    setEditGroup(g ? clone(g) : null);
  }, [selectedGroupId, groupsMap]);

  // Validation
  const validateGroup = (g) => {
    if (!g) return 'Thiếu dữ liệu nhóm';
    if (!g.title) return 'Nhóm cần tiêu đề';
    if (!g.options?.length) return 'Nhóm cần ít nhất 1 lựa chọn';
    for (const o of g.options) { if (!o.label) return 'Có lựa chọn thiếu tên'; }
    return null;
  };

  // Create tab actions
  const createAddOption = () => setNewGroup(prev => ({ ...prev, options: [...prev.options, { label: '', priceDelta: 0 }] }));
  const createRemoveOption = (idx) => setNewGroup(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  const createPatchOption = (idx, patch) => setNewGroup(prev => ({ ...prev, options: prev.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }));

  const handleCreateSave = () => {
    const err = validateGroup(newGroup);
    if (err) { alert(err); return; }
    const gMap = safeLoad(GROUPS_KEY, {});
    const id = genGroupId();
    gMap[id] = { id, ...clone(newGroup) };
    safeSave(GROUPS_KEY, gMap);

    if (assignDishId) {
      const aMap = safeLoad(ASSIGN_KEY, {});
      const list = Array.from(new Set([...(aMap[id] || []), assignDishId]));
      aMap[id] = list;
      safeSave(ASSIGN_KEY, aMap);
      setAssignMap(aMap);
    }
    setGroupsMap(gMap);
    setNewGroup(defaultGroup());
    setAssignDishId('');
    alert('Đã lưu Option Group' + (assignDishId ? ' và gán vào món đã chọn' : ''));
  };

  // Manage tab actions
  const editAddOption = () => setEditGroup(prev => ({ ...prev, options: [...(prev?.options || []), { label: '', priceDelta: 0 }] }));
  const editRemoveOption = (idx) => setEditGroup(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  const editPatchOption = (idx, patch) => setEditGroup(prev => ({ ...prev, options: prev.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }));

  const handleEditSave = () => {
    if (!selectedGroupId || !editGroup) return;
    const err = validateGroup(editGroup);
    if (err) { alert(err); return; }
    const gMap = safeLoad(GROUPS_KEY, {});
    gMap[selectedGroupId] = { id: selectedGroupId, ...clone(editGroup) };
    safeSave(GROUPS_KEY, gMap);
    setGroupsMap(gMap);
    alert('Đã cập nhật Option Group');
  };

  const handleDeleteGroup = () => {
    if (!selectedGroupId) return;
    if (!confirm('Xóa Option Group này? Thao tác sẽ gỡ gán khỏi các món.')) return;
    const gMap = safeLoad(GROUPS_KEY, {});
    const aMap = safeLoad(ASSIGN_KEY, {});
    delete gMap[selectedGroupId];
    delete aMap[selectedGroupId];
    safeSave(GROUPS_KEY, gMap);
    safeSave(ASSIGN_KEY, aMap);
    setGroupsMap(gMap);
    setAssignMap(aMap);
    setSelectedGroupId('');
    setEditGroup(null);
  };

  const unassignDish = (dishId) => {
    const aMap = safeLoad(ASSIGN_KEY, {});
    const list = (aMap[selectedGroupId] || []).filter(id => id !== dishId);
    aMap[selectedGroupId] = list;
    safeSave(ASSIGN_KEY, aMap);
    setAssignMap(aMap);
  };

  // UI helpers
  const formatVND = (n) => {
    const num = Number(n || 0);
    try { return num.toLocaleString('vi-VN'); } catch { return String(num); }
  };

  return (
    <div className="aog-wrap">
      <div className="aog-header">
        <h2>Option Groups</h2>
        <p className="aog-sub">Tạo nhóm tuỳ chọn và gán vào món ăn của nhà hàng. Quản lý các nhóm đã tạo ở tab Quản lý.</p>
      </div>

      <div className="aog-tabs">
        <button className={`aog-tab ${activeTab==='create' ? 'active' : ''}`} onClick={()=> setActiveTab('create')}>Thêm nhóm</button>
        <button className={`aog-tab ${activeTab==='manage' ? 'active' : ''}`} onClick={()=> setActiveTab('manage')}>Quản lý</button>
      </div>

      {activeTab === 'create' && (
        <div>
          <div className="aog-top-row" style={{ marginBottom: 16 }}>
            <div className="aog-live aog-card">
              <h3 className="live-title-main">Xem trước (App khách)</h3>
              {!newGroup?.options?.length && (
                <div className="aog-hint">Chưa có lựa chọn. Hãy thêm option để xem preview.</div>
              )}
              {!!newGroup?.options?.length && (
                <div className="live-group">
                  <div className="live-group-head">
                    <div className="live-group-title">{newGroup.title || 'Tên nhóm'}</div>
                    <div className="live-group-meta">
                      {newGroup.required ? <span className="badge badge-required">Bắt buộc</span> : <span className="badge">Tùy chọn</span>}
                      <span className="badge badge-weak">{newGroup.type === 'single' ? 'Chọn 1' : 'Chọn nhiều'}</span>
                    </div>
                  </div>
                  <div className="live-options">
                    {newGroup.options.map((o, oi) => (
                      <label key={oi} className="live-option">
                        <div className="live-left">
                          <input type={newGroup.type === 'single' ? 'radio' : 'checkbox'} name={`preview-create`} defaultChecked={newGroup.type === 'single' ? oi === 0 : false} readOnly />
                          <span className="live-opt-label">{o.label || 'Lựa chọn'}</span>
                        </div>
                        <span className="live-price">+ {formatVND(o.priceDelta)}đ</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="aog-card aog-assign">
              <h3 className="aog-section-title">Gán vào món (tùy chọn)</h3>
              <div className="aog-row">
                <label className="aog-field" style={{flex:1}}>
                  <span>Món ăn</span>
                  <input list="dish-suggestions" value={assignDishId} onChange={(e)=> setAssignDishId(e.target.value)} placeholder="Nhập ID hoặc chọn..." />
                  <datalist id="dish-suggestions">
                    {dishSuggestions.map(s => (
                      <option key={s.id} value={s.id}>{`${s.id} - ${s.name}`}</option>
                    ))}
                  </datalist>
                </label>
              </div>
              <div className="aog-hint">Bạn có thể lưu nhóm trước, sau đó quay lại gán ở tab Quản lý.</div>
            </div>
          </div>

          <div className="aog-group aog-card">
            <div className="aog-group-head">
              <label className="aog-field">
                <span>Tiêu đề</span>
                <input value={newGroup.title} onChange={(e)=> setNewGroup(prev => ({ ...prev, title: e.target.value }))} />
              </label>
              <label className="aog-field">
                <span>Kiểu</span>
                <select value={newGroup.type} onChange={(e)=> setNewGroup(prev => ({ ...prev, type: e.target.value }))}>
                  <option value="single">Chọn 1</option>
                  <option value="multi">Chọn nhiều</option>
                </select>
              </label>
              <label className="aog-check aog-field-inline">
                <input type="checkbox" checked={!!newGroup.required} onChange={(e)=> setNewGroup(prev => ({ ...prev, required: e.target.checked }))} /> Bắt buộc
              </label>
            </div>
            <div className="aog-opts">
              {newGroup.options.map((o, oi) => (
                <div key={oi} className="aog-opt-row">
                  <input className="aog-opt-label" placeholder="Tên option" value={o.label} onChange={(e)=> createPatchOption(oi, { label: e.target.value })} />
                  <div className="aog-price-wrap">
                    <input className="aog-opt-price" type="number" value={o.priceDelta} onChange={(e)=> createPatchOption(oi, { priceDelta: Number(e.target.value || 0) })} />
                    <span>đ</span>
                  </div>
                  <button className="aog-danger" onClick={()=> createRemoveOption(oi)}>Xóa</button>
                </div>
              ))}
              <button className="aog-add" onClick={createAddOption}>+ Thêm option</button>
            </div>
          </div>

          <div className="aog-actions">
            <button className="aog-primary" onClick={handleCreateSave} disabled={dishesLoading}>Lưu nhóm (và gán nếu đã chọn)</button>
          </div>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="aog-manage-layout">
          <div className="aog-card">
            <h3 style={{marginTop:0}}>Danh sách Option Groups</h3>
            {!groupsList.length && <div className="aog-hint">Chưa có nhóm nào. Tạo nhóm ở tab Thêm.</div>}
            <div className="aog-list">
              {groupsList.map(g => (
                <div key={g.id} className={`aog-list-item ${selectedGroupId===g.id?'active':''}`} onClick={()=> setSelectedGroupId(g.id)}>
                  <div className="aog-list-title">{g.title || '(Không tiêu đề)'}</div>
                  <div className="aog-list-meta">{g.type === 'single' ? 'Chọn 1' : 'Chọn nhiều'} • {g.required ? 'Bắt buộc' : 'Tuỳ chọn'} • {g.options?.length || 0} lựa chọn</div>
                </div>
              ))}
            </div>
          </div>

          <div className="aog-card aog-editor-col">
            {!selectedGroupId && <div className="aog-hint">Chọn 1 nhóm để chỉnh sửa</div>}
            {selectedGroupId && editGroup && (
              <>
                <h3 style={{marginTop:0}}>Sửa Option Group</h3>
                <div className="aog-group">
                  <div className="aog-group-head">
                    <label className="aog-field">
                      <span>Tiêu đề</span>
                      <input value={editGroup.title} onChange={(e)=> setEditGroup(prev => ({ ...prev, title: e.target.value }))} />
                    </label>
                    <label className="aog-field">
                      <span>Kiểu</span>
                      <select value={editGroup.type} onChange={(e)=> setEditGroup(prev => ({ ...prev, type: e.target.value }))}>
                        <option value="single">Chọn 1</option>
                        <option value="multi">Chọn nhiều</option>
                      </select>
                    </label>
                    <label className="aog-check aog-field-inline">
                      <input type="checkbox" checked={!!editGroup.required} onChange={(e)=> setEditGroup(prev => ({ ...prev, required: e.target.checked }))} /> Bắt buộc
                    </label>
                  </div>
                  <div className="aog-opts">
                    {editGroup.options.map((o, oi) => (
                      <div key={oi} className="aog-opt-row">
                        <input className="aog-opt-label" placeholder="Tên option" value={o.label} onChange={(e)=> editPatchOption(oi, { label: e.target.value })} />
                        <div className="aog-price-wrap">
                          <input className="aog-opt-price" type="number" value={o.priceDelta} onChange={(e)=> editPatchOption(oi, { priceDelta: Number(e.target.value || 0) })} />
                          <span>đ</span>
                        </div>
                        <button className="aog-danger" onClick={()=> editRemoveOption(oi)}>Xóa</button>
                      </div>
                    ))}
                    <button className="aog-add" onClick={editAddOption}>+ Thêm option</button>
                  </div>
                </div>

                <div className="aog-actions">
                  <button className="aog-primary" onClick={handleEditSave}>Lưu thay đổi</button>
                  <button className="aog-danger" onClick={handleDeleteGroup}>Xóa nhóm</button>
                </div>

                <div className="aog-card" style={{marginTop:12}}>
                  <h3 style={{marginTop:0}}>Món đang gán</h3>
                  {!selectedAssignments.length && <div className="aog-hint">Chưa gán vào món nào.</div>}
                  <div className="aog-assignments">
                    {selectedAssignments.map((id) => (
                      <div key={id} className="aog-assignment-row">
                        <div className="aog-assignment-name">{dishMap[id]?.name || id}</div>
                        <button className="aog-danger" onClick={()=> unassignDish(id)}>Gỡ</button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
