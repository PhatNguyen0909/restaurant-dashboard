import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './AddOptionGroup.css';
import merchantAPI from '../../api/merchantAPI';
import OptionAPI from '../../api/Option';
import { assets } from '../../assets/assets';

// v2 storage: groups and assignments
const GROUPS_KEY = 'dashboard_option_groups_v2'; // { [groupId]: Group }
const ASSIGN_KEY = 'dashboard_option_group_assignments_v2'; // { [groupId]: string[] dishIds }

const defaultGroup = () => ({ title: '', type: 'single', required: false, options: [{ label: '', priceDelta: 0 }] });
const clone = (obj) => JSON.parse(JSON.stringify(obj || {}));
const genGroupId = () => 'og_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now().toString(36);
const genValueId = () => 'ov_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now().toString(36);
const toNumberSafe = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

function safeLoad(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : clone(fallback); } catch { return clone(fallback); }
}
function safeSave(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export default function AddOptionGroup({ onSuccess }) {
  const isDemo = useMemo(() => {
    const userStr = document.cookie.split('; ').find((row) => row.startsWith('user='));
    if (userStr) {
      try {
        const userObj = JSON.parse(decodeURIComponent(userStr.split('=')[1]));
        return userObj.email === 'demo';
      } catch {}
    }
    return false;
  }, []);

  // Dishes
  const [dishes, setDishes] = useState([]);
  const [dishesLoading, setDishesLoading] = useState(true);

  // Create states
  const [newGroup, setNewGroup] = useState(defaultGroup());
  // Linking modal after create
  const [linkModal, setLinkModal] = useState({ open: false, groupId: null, groupName: '' });
  const [selectedMenuIds, setSelectedMenuIds] = useState([]); // array of string ids
  const [linking, setLinking] = useState(false);
  const [openCats, setOpenCats] = useState({}); // modal: open/close category blocks

  // Fetch dishes (menu items của nhà hàng)
  useEffect(() => {
    (async () => {
      setDishesLoading(true);
      try {
        const data = await merchantAPI.getMenuItems();
        setDishes(Array.isArray(data) ? data : []);
      } catch (e) {
        setDishes([]);
      } finally {
        setDishesLoading(false);
      }
    })();
  }, []);

  // Validation
  const validateGroup = (g) => {
    if (!g) return 'Thiếu dữ liệu nhóm';
    if (!g.title) return 'Nhóm cần tiêu đề';
    if (!g.options?.length) return 'Nhóm cần ít nhất 1 lựa chọn';
    for (const o of g.options) { if (!o.label) return 'Có lựa chọn thiếu tên'; }
    return null;
  };

  // Create tab actions
  const createAddOption = () => setNewGroup((prev) => ({ ...prev, options: [...prev.options, { label: '', priceDelta: 0 }] }));
  const createRemoveOption = (idx) => setNewGroup((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  const createPatchOption = (idx, patch) => setNewGroup((prev) => ({ ...prev, options: prev.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }));

  const openAssignModal = useCallback(async (groupId, groupName) => {
    if (!groupId) return;
    const idStr = String(groupId);
    setSelectedMenuIds([]);
    setLinkModal({ open: true, groupId: idStr, groupName });
  }, []);

  const closeAssignModal = useCallback(() => {
    setLinkModal({ open: false, groupId: null, groupName: '' });
    setSelectedMenuIds([]);
    if (onSuccess) onSuccess();
  }, [onSuccess]);

  const handleCreateSave = async () => {
    const err = validateGroup(newGroup);
    if (err) { alert(err); return; }
    const createdGroupName = newGroup.title || 'Nhóm tuỳ chọn';
    const pickGroupId = (obj) => {
      if (!obj || typeof obj !== 'object') return undefined;
      return (
        obj.id || obj._id || obj.optionId || obj.option_id ||
        obj?.data?.id || obj?.data?._id || obj?.data?.optionId || obj?.data?.option_id ||
        obj?.result?.id || obj?.option?.id || obj?.option?._id
      );
    };

    if (isDemo) {
      const gMap = safeLoad(GROUPS_KEY, {});
      const id = genGroupId();
      const optionsWithIds = (newGroup.options || []).map((opt) => ({ ...clone(opt), id: genValueId() }));
      gMap[id] = { id, ...clone(newGroup), options: optionsWithIds };
      safeSave(GROUPS_KEY, gMap);
      setNewGroup(defaultGroup());
      setSelectedMenuIds([]);
      setLinkModal({ open: true, groupId: id, groupName: gMap[id]?.title || createdGroupName });
      return;
    }

    try {
      const optionValues = (newGroup.options || [])
        .filter((o) => (o?.label || '').trim().length > 0)
        .map((o) => ({ name: String(o.label).trim(), extraPrice: toNumberSafe(o.priceDelta || 0) }));
      const payload = {
        name: newGroup.title,
        required: !!newGroup.required,
        selectionType: newGroup.type === 'multi' ? 'MULTI' : 'SINGLE',
        optionValues,
      };

      const groupRes = await OptionAPI.create(payload);
      let createdId = pickGroupId(groupRes);

      setNewGroup(defaultGroup());

      if (!createdId) {
        try {
          const list = await OptionAPI.getAll();
          const found = (Array.isArray(list) ? list : []).find((g) => (g.title || g.name) === createdGroupName);
          createdId = pickGroupId(found) ?? found?.id ?? found?._id;
        } catch {}
      }

      if (createdId) {
        await openAssignModal(String(createdId), createdGroupName);
      } else {
        alert('Đã tạo Option Group. Không xác định được mã nhóm để gán. Vui lòng gán sau ở trang Quản lý.');
      }
    } catch (e) {
      console.error('Lỗi khi lưu Option Group:', e);
      alert(e?.response?.data?.message || e?.message || 'Lỗi khi lưu Option Group');
    }
  };

  const handleConfirmLinking = async () => {
    if (!linkModal.groupId) {
      closeAssignModal();
      if (onSuccess) onSuccess();
      return;
    }

    const uniqueIds = Array.from(new Set(selectedMenuIds));
    setLinking(true);
    try {
      if (isDemo) {
        const aMap = safeLoad(ASSIGN_KEY, {});
        aMap[linkModal.groupId] = uniqueIds;
        safeSave(ASSIGN_KEY, aMap);
      } else {
        await OptionAPI.assignMenuItems(linkModal.groupId, uniqueIds);
      }
      alert('Đã gán nhóm vào các món đã chọn');
      closeAssignModal();
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error('Linking error', e);
      alert('Lỗi khi gán món vào Option Group');
    } finally {
      setLinking(false);
    }
  };

  // UI helpers
  const formatVND = (n) => {
    const num = Number(n || 0);
    try { return num.toLocaleString('vi-VN'); } catch { return String(num); }
  };

  // Group dishes by category for the linking modal (block + column by category)
  const groupedDishes = useMemo(() => {
    const byCat = {};
    const getCat = (d) => {
      const c1 = d?.categoryName || d?.category_name || d?.category;
      if (typeof c1 === 'string' && c1.trim()) return c1.trim();
      if (c1 && typeof c1 === 'object') {
        const name = c1?.name || c1?.title || c1?.displayName;
        if (name) return String(name);
      }
      if (d?.categoryId || d?.category_id) return 'Danh mục';
      return 'Khác';
    };
    (Array.isArray(dishes) ? dishes : []).forEach((d) => {
      const cat = getCat(d);
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(d);
    });
    const sorted = {};
    Object.keys(byCat).sort((a, b) => a.localeCompare(b, 'vi')).forEach((cat) => {
      sorted[cat] = byCat[cat].slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'vi'));
    });
    return sorted;
  }, [dishes]);

  // When modal opens, reset category states so all are collapsed by default
  useEffect(() => {
    if (linkModal.open) {
      setOpenCats({});
    }
  }, [linkModal.open]);

  return (
    <div className="aog-wrap">
      <div className="aog-header">
        <h2>Tạo Option Group Mới</h2>
        <p className="aog-sub">Tạo nhóm tuỳ chọn mới cho món ăn của nhà hàng.</p>
      </div>

      <div className="aog-top-row">
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
                </div>
              </div>
              <div className="live-options">
                {newGroup.options.map((o, oi) => (
                  <label key={oi} className="live-option">
                    <div className="live-left">
                      <input type={newGroup.type === 'single' ? 'radio' : 'checkbox'} name="preview-create" defaultChecked={newGroup.type === 'single' ? oi === 0 : false} readOnly />
                      <span className="live-opt-label">{o.label || 'Lựa chọn'}</span>
                    </div>
                    <span className="live-price">+ {formatVND(o.priceDelta)}đ</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="aog-group aog-card">
          <div className="aog-section">
            <label className="aog-field">
              <span>Tiêu đề</span>
              <input 
                placeholder="Nhập tên nhóm tùy chọn"
                value={newGroup.title} 
                onChange={(e) => setNewGroup((prev) => ({ ...prev, title: e.target.value }))} 
              />
            </label>
          </div>

          <div className="aog-section">
            <span className="aog-section-label">Tùy chọn</span>

            <div className="aog-selection-dropdown">
              <label>Tùy chọn</label>
              <select value={newGroup.type === 'single' ? '1' : 'multi'} onChange={(e) => setNewGroup((prev) => ({ ...prev, type: e.target.value === '1' ? 'single' : 'multi' }))}>
                <option value="1">Chọn 1</option>
                <option value="multi">Chọn nhiều</option>
              </select>
            </div>

            <div className="aog-required-section">
              <span className="aog-section-label">Bắt buộc</span>
              <label className="aog-toggle">
                <input 
                  type="checkbox" 
                  checked={!!newGroup.required} 
                  onChange={(e) => setNewGroup((prev) => ({ ...prev, required: e.target.checked }))} 
                />
                <span className="aog-toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="aog-opts">
            <div className="aog-opts-header">
              <span>Tên option</span>
              <span>Giá thêm</span>
              <span></span>
            </div>
            {newGroup.options.map((o, oi) => (
              <div key={oi} className="aog-opt-row">
                <input 
                  className="aog-opt-label" 
                  placeholder="Tên option" 
                  value={o.label} 
                  onChange={(e) => createPatchOption(oi, { label: e.target.value })} 
                />
                <div className="aog-price-wrap">
                  <input 
                    className="aog-opt-price" 
                    type="number" 
                    placeholder="0"
                    value={o.priceDelta} 
                    onChange={(e) => createPatchOption(oi, { priceDelta: Number(e.target.value || 0) })} 
                  />
                  <span>đ</span>
                </div>
                <button className="aog-danger" onClick={() => createRemoveOption(oi)} title="Xóa">
                  🗑️
                </button>
              </div>
            ))}
            <button className="aog-add" onClick={createAddOption}>
              <span>+</span> Thêm option
            </button>
          </div>

          <div className="aog-actions">
            <button className="aog-ghost" onClick={() => setNewGroup(defaultGroup())}>Hủy</button>
            <button className="aog-primary" onClick={handleCreateSave} disabled={dishesLoading}>Tạo nhóm</button>
          </div>
        </div>
      </div>

      {linkModal.open && (
        <div className="aog-modal-backdrop" role="dialog" aria-modal="true">
          <div className="aog-modal">
            <div className="aog-modal-head">
              <h3>Gán vào món</h3>
              <button className="aog-ghost" onClick={closeAssignModal}>Đóng</button>
            </div>
            <p className="aog-hint" style={{ marginTop: 0 }}>Chọn các món để liên kết với nhóm "{linkModal.groupName}"</p>
            <div className="aog-modal-list">
              {dishesLoading && <div className="aog-hint">Đang tải danh sách món...</div>}
              {!dishesLoading && !dishes.length && <div className="aog-hint">Chưa có món nào.</div>}
              {!dishesLoading && !!dishes.length && (
                <div className="aog-dish-groups">
                  {Object.keys(groupedDishes).map((cat) => (
                    <div className="aog-cat-block" key={cat}>
                      {(() => {
                        const isOpen = openCats[cat] === true;
                        return (
                          <>
                            <div
                              className="aog-cat-header"
                              onClick={() => setOpenCats((prev) => ({ ...prev, [cat]: !isOpen }))}
                            >
                              <span className="aog-cat-title">{cat}</span>
                              <img
                                src={isOpen ? assets.up : assets.down}
                                alt={isOpen ? 'Thu gọn' : 'Mở rộng'}
                                className="aog-cat-icon"
                              />
                            </div>
                            {isOpen && (
                              <div className="aog-dish-grid">
                                {groupedDishes[cat].map((d) => {
                                  const idRaw = d.id || d._id || d.menuItemId || d.menu_item_id || d.name;
                                  const id = idRaw != null ? String(idRaw) : '';
                                  const checked = selectedMenuIds.includes(id);
                                  return (
                                    <label key={id || idRaw || cat} className={`aog-dish-item ${checked ? 'active' : ''}`}>
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          const next = new Set(selectedMenuIds);
                                          if (e.target.checked) next.add(id); else next.delete(id);
                                          setSelectedMenuIds(Array.from(next));
                                        }}
                                      />
                                      <span className="aog-dish-name">{d.name || d.title || `Món ${id}`}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="aog-actions" style={{ marginTop: 16 }}>
              <button className="aog-ghost" onClick={closeAssignModal}>Để sau</button>
              <button className="aog-primary" onClick={handleConfirmLinking} disabled={linking}>
                {linking ? 'Đang gán...' : 'Gán vào món đã chọn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
