import React, { useEffect, useMemo, useState } from 'react';
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

function safeLoad(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : clone(fallback); } catch { return clone(fallback); }
}
function safeSave(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export default function AddOptionGroup() {
  // Dishes
  const [dishes, setDishes] = useState([]);
  const [dishesLoading, setDishesLoading] = useState(true);
  

  // Create tab states
  const [newGroup, setNewGroup] = useState(defaultGroup());
  // Linking modal after create
  const [linkModal, setLinkModal] = useState({ open: false, groupId: null, groupName: '' });
  const [selectedMenuIds, setSelectedMenuIds] = useState([]); // array of ids
  const [linking, setLinking] = useState(false);
  const [openCats, setOpenCats] = useState({}); // modal: open/close category blocks

  // Fetch dishes (menu items của nhà hàng)
  useEffect(() => {
    (async () => {
      setDishesLoading(true);
      try {
        // Lấy danh sách món ăn từ API /merchant/menu-items
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
  const createAddOption = () => setNewGroup(prev => ({ ...prev, options: [...prev.options, { label: '', priceDelta: 0 }] }));
  const createRemoveOption = (idx) => setNewGroup(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  const createPatchOption = (idx, patch) => setNewGroup(prev => ({ ...prev, options: prev.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) }));

  const handleCreateSave = async () => {
    const err = validateGroup(newGroup);
    if (err) { alert(err); return; }
    const userStr = document.cookie.split('; ').find(row => row.startsWith('user='));
    let isDemo = false;
    if (userStr) {
      try { const userObj = JSON.parse(decodeURIComponent(userStr.split('=')[1])); isDemo = userObj.email === 'demo'; } catch {}
    }
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
      // Demo: lưu localStorage như cũ
      const gMap = safeLoad(GROUPS_KEY, {});
      const id = genGroupId();
      gMap[id] = { id, ...clone(newGroup) };
      safeSave(GROUPS_KEY, gMap);
      setNewGroup(defaultGroup());
      // Mở popup chọn món để gán
      setLinkModal({ open: true, groupId: id, groupName: gMap[id]?.title || createdGroupName });
      setSelectedMenuIds([]);
    } else {
      // Thực tế: gọi API
      try {
        // Chuẩn hóa payload cho API
        // Build all option values at once (Swagger supports creating with many values in one request)
        const optionValues = (newGroup.options || [])
          .filter(o => (o?.label || '').trim().length > 0)
          .map(o => ({ name: String(o.label).trim(), extraPrice: Number(o.priceDelta || 0) }));
        const payload = {
          name: newGroup.title,
          required: !!newGroup.required,
          optionValues,
        };
        // Tạo option group với value đầu tiên
        const groupRes = await OptionAPI.create(payload);
        let createdId = pickGroupId(groupRes);
        // Mở popup ngay khi có id, không chờ thêm values để đảm bảo hiện ngay
        setNewGroup(defaultGroup());
        if (createdId) {
          setLinkModal({ open: true, groupId: createdId, groupName: createdGroupName });
          setSelectedMenuIds([]);
        }
        // Không cần loop addOptionValue nữa vì đã gửi tất cả trong payload
        // Fallback: nếu backend không trả id, thử lấy theo title vừa tạo
        if (!createdId) {
          try {
            const list = await OptionAPI.getAll();
            const found = (Array.isArray(list) ? list : []).find(g => (g.title || g.name) === createdGroupName);
            createdId = pickGroupId(found) ?? found?.id ?? found?._id;
          } catch {}
        }
        // Nếu vẫn chưa có id thì báo để người dùng gán sau
        if (!createdId) {
          alert('Đã tạo Option Group. Không xác định được mã nhóm để gán. Vui lòng gán sau ở tab Quản lý.');
        }
      } catch (e) {
        console.error('Lỗi khi lưu Option Group:', e);
        alert('Lỗi khi lưu Option Group');
      }
    }
  };

  // Confirm linking selected menu items to created group
  const handleConfirmLinking = async () => {
    if (!linkModal.open || !linkModal.groupId) { setLinkModal({ open: false, groupId: null, groupName: '' }); return; }
    // If nothing selected, just close
    if (!selectedMenuIds?.length) { setLinkModal({ open: false, groupId: null, groupName: '' }); return; }
    const userStr = document.cookie.split('; ').find(row => row.startsWith('user='));
    let isDemo = false;
    if (userStr) {
      try { const userObj = JSON.parse(decodeURIComponent(userStr.split('=')[1])); isDemo = userObj.email === 'demo'; } catch {}
    }
    setLinking(true);
    try {
      if (isDemo) {
        const aMap = safeLoad(ASSIGN_KEY, {});
        const prev = new Set(aMap[linkModal.groupId] || []);
        selectedMenuIds.forEach(id => prev.add(id));
        aMap[linkModal.groupId] = Array.from(prev);
        safeSave(ASSIGN_KEY, aMap);
      } else {
        await OptionAPI.assignMenuItems(linkModal.groupId, selectedMenuIds);
      }
      alert('Đã gán nhóm vào các món đã chọn');
      setLinkModal({ open: false, groupId: null, groupName: '' });
      setSelectedMenuIds([]);
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
      // some APIs use categoryId only; fallback
      if (d?.categoryId || d?.category_id) return 'Danh mục';
      return 'Khác';
    };
    (Array.isArray(dishes) ? dishes : []).forEach((d) => {
      const cat = getCat(d);
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(d);
    });
    // sort categories alphabetically, items by name
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
        <h2>Option Groups</h2>
        <p className="aog-sub">Tạo nhóm tuỳ chọn và gán vào món ăn của nhà hàng.</p>
      </div>
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
            <button className="aog-primary" onClick={handleCreateSave} disabled={dishesLoading}>Tạo nhóm</button>
          </div>

      </div>

      {/* Modal chọn món để gán sau khi tạo xong */}
      {linkModal.open && (
        <div className="aog-modal-backdrop" role="dialog" aria-modal="true">
          <div className="aog-modal">
            <div className="aog-modal-head">
              <h3>Gán vào món</h3>
              <button className="aog-ghost" onClick={() => setLinkModal({ open:false, groupId:null, groupName:'' })}>Đóng</button>
            </div>
            <p className="aog-hint" style={{marginTop:0}}>Chọn các món để liên kết với nhóm "{linkModal.groupName}"</p>
            <div className="aog-modal-list">
              {dishesLoading && <div className="aog-hint">Đang tải danh sách món...</div>}
              {!dishesLoading && !dishes.length && <div className="aog-hint">Chưa có món nào.</div>}
              {!dishesLoading && !!dishes.length && (
                <div className="aog-dish-groups">
                  {Object.keys(groupedDishes).map((cat) => (
                    <div className="aog-cat-block" key={cat}>
                      {(() => {
                        const isOpen = openCats[cat] === true; // default closed
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
                                  const id = d.id || d._id || d.menuItemId || d.menu_item_id || d.name; // fallback
                                  const checked = selectedMenuIds.includes(id);
                                  return (
                                    <label key={id} className={`aog-dish-item ${checked?'active':''}`}>
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
            <div className="aog-actions" style={{marginTop:16}}>
              <button className="aog-ghost" onClick={() => setLinkModal({ open:false, groupId:null, groupName:'' })}>Để sau</button>
              <button className="aog-primary" onClick={handleConfirmLinking} disabled={linking || !selectedMenuIds.length}>{linking ? 'Đang gán...' : 'Gán vào món đã chọn'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
