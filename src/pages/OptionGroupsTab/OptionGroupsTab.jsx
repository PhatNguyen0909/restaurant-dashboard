import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './OptionGroupsTab.css';
import OptionAPI from '../../api/Option';
import { assets } from '../../assets/assets';

const toNumberSafe = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export default function OptionGroupsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [counts, setCounts] = useState({}); // { [groupId]: number of linked menu items }

  const toArray = useCallback((input) => {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (typeof input !== 'object') return [];

    const keys = ['items', 'data', 'result', 'results', 'rows', 'records', 'options', 'optionValues', 'optionGroups', 'option_groups', 'groups', 'list', 'docs', 'content', 'optionList'];
    for (const key of keys) {
      const value = input?.[key];
      if (Array.isArray(value)) return value;
    }

    for (const value of Object.values(input)) {
      const nested = toArray(value);
      if (nested.length) return nested;
    }

    return [];
  }, []);

  const getGroupId = useCallback((group) => (
    group?.id
    ?? group?._id
    ?? group?.optionId
    ?? group?.option_id
    ?? group?.optionGroupId
    ?? group?.option_group_id
  ), []);

  // Demo mode detection + localStorage keys (align with AddOptionGroup)
  const GROUPS_KEY = 'dashboard_option_groups_v2';
  const ASSIGN_KEY = 'dashboard_option_group_assignments_v2';
  const isDemo = useMemo(() => {
    const userStr = document.cookie.split('; ').find((row) => row.startsWith('user='));
    if (userStr) {
      try { const userObj = JSON.parse(decodeURIComponent(userStr.split('=')[1])); return userObj.email === 'demo'; } catch {}
    }
    return false;
  }, []);
  const safeLoad = useCallback((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : (fallback ?? {});
    } catch {
      return (fallback ?? {});
    }
  }, []);
  const safeSave = useCallback((key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }, []);
  const [updatingMap, setUpdatingMap] = useState({});
  
  // Edit modal states
  const [editModal, setEditModal] = useState({ open: false, group: null });
  const [addValueForm, setAddValueForm] = useState({ name: '', extraPrice: '' });
  const [addingValue, setAddingValue] = useState(false);
  const [deletingValueId, setDeletingValueId] = useState('');
  const [deletingGroupId, setDeletingGroupId] = useState('');
  const [editValueModal, setEditValueModal] = useState({ open: false, value: null, groupId: null });
  const [editValueForm, setEditValueForm] = useState({ name: '', extraPrice: '' });
  const [savingValue, setSavingValue] = useState(false);

  const syncEditModalGroup = useCallback((list) => {
    if (!Array.isArray(list) || !list.length) return;
    setEditModal((prev) => {
      if (!prev.open || !prev.group) return prev;
      const currentId = getGroupId(prev.group);
      if (currentId == null) return prev;
      const latest = list.find((item) => {
        const gid = getGroupId(item);
        return gid != null && String(gid) === String(currentId);
      });
      if (!latest || latest === prev.group) return prev;
      return { ...prev, group: latest };
    });
  }, [getGroupId]);

  const refreshGroups = useCallback(async () => {
    try {
      if (isDemo) {
        const gMap = safeLoad(GROUPS_KEY, {});
        const list = Object.values(gMap);
        setGroups(list);
        const aMap = safeLoad(ASSIGN_KEY, {});
        const c = {};
        list.forEach((g) => {
          const gid = getGroupId(g);
          if (gid == null) return;
          const key = String(gid);
          c[key] = Array.isArray(aMap[key]) ? aMap[key].length : 0;
        });
        setCounts(c);
        syncEditModalGroup(list);
        return list;
      } else {
        const data = await OptionAPI.getAll();
        const list = toArray(data);
        setGroups(list);
        const results = await Promise.all(list.map(async (g) => {
          const groupId = getGroupId(g);
          if (groupId == null) return { id: undefined, count: 0 };
          try {
            const res = await OptionAPI.getMenuItems(groupId);
            const cnt = Array.isArray(res) ? res.length : 0;
            return { id: String(groupId), count: cnt };
          } catch {
            return { id: String(groupId), count: 0 };
          }
        }));
        const c = {};
        results.forEach(({id, count}) => {
          if (id !== undefined) c[id] = count;
        });
        setCounts(c);
        syncEditModalGroup(list);
        return list;
      }
    } catch (e) {
      console.error('Refresh groups error:', e);
      return [];
    }
  }, [getGroupId, isDemo, safeLoad, syncEditModalGroup, toArray]);

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        if (isDemo) {
          // Demo: read from localStorage for groups and assignments
          const gMap = safeLoad(GROUPS_KEY, {});
          const list = Object.values(gMap);
          setGroups(list);
          const aMap = safeLoad(ASSIGN_KEY, {});
          const c = {};
          list.forEach((g) => {
            const gid = getGroupId(g);
            if (gid == null) return;
            const key = String(gid);
            c[key] = Array.isArray(aMap[key]) ? aMap[key].length : 0;
          });
          setCounts(c);
        } else {
          const data = await OptionAPI.getAll();
          const list = toArray(data);
          setGroups(list);
          // Fetch counts in parallel
          const results = await Promise.all(list.map(async (g) => {
            const groupId = getGroupId(g);
            if (groupId == null) {
              return { id: undefined, count: 0 };
            }
            try {
                const res = await OptionAPI.getMenuItems(groupId);
                const cnt = Array.isArray(res) ? res.length : 0;
              return { id: String(groupId), count: cnt };
            } catch {
              return { id: String(groupId), count: 0 };
            }
          }));
          const c = {};
          results.forEach(({id, count}) => {
            if (id !== undefined) c[id] = count;
          });
          setCounts(c);
        }
      } catch (e) {
        setError('Không tải được danh sách nhóm tuỳ chọn.');
      } finally { setLoading(false); }
    })();
  }, [isDemo]);

  const sorted = useMemo(() => groups.slice().sort((a,b)=> String(a.title||a.name||'').localeCompare(String(b.title||b.name||''),'vi')), [groups]);

  const resolveType = (group) => {
    const raw = (group?.type ?? group?.selectionType ?? '').toString().toLowerCase();
    return raw.includes('multi') ? 'multi' : 'single';
  };

  const toggle = (id) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const getValueId = (value) => value?.id ?? value?.valueId ?? value?.value_id ?? value?.key;

  const isValueVisible = (value) => {
    const raw = value?.isVisible ?? value?.visible ?? value?.status ?? value?.state ?? value?.isActive ?? value?.active;
    if (raw === undefined || raw === null) return true;
    if (typeof raw === 'boolean') return raw;
    const token = String(raw).trim().toLowerCase();
    if (['false', '0', 'inactive', 'hidden', 'disabled'].includes(token)) return false;
    if (['true', '1', 'active', 'visible', 'enabled'].includes(token)) return true;
    return true;
  };

  const makeValueKey = (groupId, value) => {
    const id = getValueId(value);
    if (id !== undefined && id !== null) return String(id);
    if (value?.index !== undefined) return `${groupId}-${value.index}`;
    return `${groupId}-${value?.name ?? 'value'}`;
  };

  const applyVisibilityToGroup = (groupId, valueMeta, nextVisible) => {
    const targetId = groupId != null ? String(groupId) : undefined;
    if (targetId === undefined) return;
    setGroups((prev) => prev.map((g) => {
      const gid = getGroupId(g);
      if (targetId !== undefined && String(gid) !== targetId) return g;
      const patchArray = (arr) => arr.map((opt, idx) => {
        const optId = getValueId(opt);
        const sameId = (optId != null && valueMeta.id != null && String(optId) === String(valueMeta.id));
        if (sameId
          || (valueMeta.id == null && idx === valueMeta.index)) {
          return { ...opt, isVisible: nextVisible };
        }
        return opt;
      });
      const next = { ...g };
      if (Array.isArray(g.options)) next.options = patchArray(g.options);
      if (Array.isArray(g.optionValues)) next.optionValues = patchArray(g.optionValues);
      return next;
    }));

    if (isDemo) {
      const gMap = safeLoad(GROUPS_KEY, {});
      const stored = gMap[targetId];
      if (stored) {
        const patchArray = (arr) => (
          Array.isArray(arr)
            ? arr.map((opt, idx) => {
                const optId = getValueId(opt);
                const sameId = (optId != null && valueMeta.id != null && String(optId) === String(valueMeta.id));
                if (sameId
                  || (valueMeta.id == null && idx === valueMeta.index)) {
                  return { ...opt, isVisible: nextVisible };
                }
                return opt;
              })
            : arr
        );
        gMap[targetId] = {
          ...stored,
          options: patchArray(stored.options),
          optionValues: patchArray(stored.optionValues),
        };
        safeSave(GROUPS_KEY, gMap);
      }
    }
  };

  const handleToggleOption = async (group, value) => {
  const groupId = getGroupId(group);
    if (groupId == null) {
      alert('Không xác định được mã nhóm tuỳ chọn.');
      return;
    }
    const optionId = getValueId(value);
    const currentVisible = isValueVisible(value);
    const nextVisible = !currentVisible;
  const trackingKey = makeValueKey(String(groupId), value);
    if (!isDemo && updatingMap[trackingKey]) return;

    if (!isDemo && (optionId === undefined || optionId === null)) {
      alert('Không tìm thấy mã option để cập nhật trạng thái.');
      return;
    }

    const meta = { id: optionId, index: value.index };
    applyVisibilityToGroup(groupId, meta, nextVisible);

    if (isDemo) return;

    setUpdatingMap((prev) => ({ ...prev, [trackingKey]: true }));
    try {
      await OptionAPI.updateStatus(optionId, nextVisible);
    } catch (e) {
      // revert on failure
      applyVisibilityToGroup(groupId, meta, currentVisible);
      console.error('Toggle option status failed', e);
      alert('Không cập nhật được trạng thái option.');
    } finally {
      setUpdatingMap((prev) => {
        const next = { ...prev };
        delete next[trackingKey];
        return next;
      });
    }
  };

  // Open edit modal
  const handleEditGroup = (group) => {
    setEditModal({ open: true, group });
    setAddValueForm({ name: '', extraPrice: '' });
  };

  // Close edit modal
  const closeEditModal = () => {
    setEditModal({ open: false, group: null });
    setAddValueForm({ name: '', extraPrice: '' });
    setEditValueModal({ open: false, value: null, groupId: null });
    setEditValueForm({ name: '', extraPrice: '' });
  };

  // Add new option value
  const handleAddValue = async () => {
    if (!editModal.group) return;
    const groupId = getGroupId(editModal.group);
    if (!groupId) {
      alert('Không xác định được mã nhóm');
      return;
    }

    const name = addValueForm.name.trim();
    if (!name) {
      alert('Vui lòng nhập tên lựa chọn');
      return;
    }

    const extraPrice = toNumberSafe(addValueForm.extraPrice);

    setAddingValue(true);
    try {
      await OptionAPI.addOptionValue(groupId, { name, extraPrice });
      alert('Đã thêm lựa chọn mới');
      setAddValueForm({ name: '', extraPrice: '' });
      await refreshGroups();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Thêm thất bại');
    } finally {
      setAddingValue(false);
    }
  };

  // Delete option value
  const handleDeleteValue = async (value) => {
    if (!editModal.group) return;
    const groupId = getGroupId(editModal.group);
    if (!groupId) {
      alert('Không xác định được mã nhóm');
      return;
    }

    const valueId = getValueId(value);
    if (!valueId) {
      alert('Không xác định được mã lựa chọn');
      return;
    }

    if (!window.confirm('Xóa lựa chọn này khỏi nhóm?')) return;

    const valueIdStr = String(valueId);
    setDeletingValueId(valueIdStr);

    try {
      await OptionAPI.deleteOptionValue(valueId);
      alert('Đã xóa lựa chọn');
      await refreshGroups();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Xóa thất bại');
    } finally {
      setDeletingValueId('');
    }
  };

  // Delete entire group
  const handleDeleteGroup = async (group) => {
    const groupId = getGroupId(group);
    if (!groupId) {
      alert('Không xác định được mã nhóm');
      return;
    }

    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ nhóm tuỳ chọn này?')) return;

    const groupIdStr = String(groupId);
    setDeletingGroupId(groupIdStr);

    try {
      await OptionAPI.deleteGroup(groupId);
      alert('Đã xóa nhóm tuỳ chọn');
      closeEditModal();
      await refreshGroups();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Xóa nhóm thất bại');
    } finally {
      setDeletingGroupId('');
    }
  };

  // Open edit value modal
  const handleEditValue = (value, groupId) => {
    setEditValueModal({ open: true, value, groupId });
    setEditValueForm({ 
      name: value.name || '', 
      extraPrice: String(value.price || 0) 
    });
  };

  // Save edited value
  const handleSaveEditValue = async () => {
    if (!editValueModal.value) return;
    const valueId = getValueId(editValueModal.value);
    if (!valueId) {
      alert('Không xác định được mã lựa chọn');
      return;
    }

    const name = editValueForm.name.trim();
    if (!name) {
      alert('Vui lòng nhập tên lựa chọn');
      return;
    }

    const extraPrice = toNumberSafe(editValueForm.extraPrice);

    setSavingValue(true);
    try {
      await OptionAPI.updateOptionValue(valueId, { name, extraPrice });
      alert('Đã cập nhật lựa chọn');
      setEditValueModal({ open: false, value: null, groupId: null });
      setEditValueForm({ name: '', extraPrice: '' });
      await refreshGroups();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Cập nhật thất bại');
    } finally {
      setSavingValue(false);
    }
  };

  return (
    <div className="ogt-wrap">
      <div className="ogt-head">
        <h3>Nhóm tuỳ chọn</h3>
        <div className="ogt-sub">Liên kết và quản lý option values cho từng nhóm.</div>
      </div>

      {loading && <div className="ogt-hint">Đang tải...</div>}
      {error && <div className="ogt-error">{error}</div>}

      {!loading && !error && !sorted.length && (
        <div className="ogt-hint">Chưa có nhóm tuỳ chọn nào.</div>
      )}

      {!loading && !error && !!sorted.length && (
        <div className="ogt-board">
          {sorted.map((group, index) => {
            const rawGroupId = getGroupId(group);
            const gid = rawGroupId != null ? String(rawGroupId) : `group-${index}`;
            const title = group.title || group.name || '(Không tiêu đề)';
            const open = expanded.has(gid);
            const valuesRaw = Array.isArray(group.options)
              ? group.options
              : (Array.isArray(group.optionValues) ? group.optionValues : []);
            const values = valuesRaw.map((val, idx) => ({
              key: getValueId(val) ?? `${gid}-${idx}`,
              id: getValueId(val),
              index: idx,
              name: val.label || val.name || val.title || `Lựa chọn ${idx + 1}`,
              price: val.extraPrice ?? val.priceDelta ?? val.price ?? 0,
              isVisible: isValueVisible(val),
            }));
            const totalLinked = counts[gid] ?? 0;
            return (
              <div key={gid} className={`ogt-item ${open?'open':''}`}>
                <div className="ogt-item-head" onClick={()=>toggle(gid)}>
                  <div className="ogt-caret">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M3 3H13V13H3V3Z" opacity="0.3"/>
                      <path d="M5 6H11M5 8H11M5 10H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="ogt-title">{title}</div>
                  <div className="ogt-meta">
                    <span className="ogt-meta-badge" style={{ background: group.required ? '#FEE2E2' : '#FFF4E6', color: group.required ? '#DC2626' : '#FF8C00' }}>
                      {group.required ? 'Bắt buộc' : 'Tùy chọn'}
                    </span>
                    <span>{resolveType(group) === 'multi' ? 'Chọn nhiều' : 'Chọn 1'}</span>
                  </div>
                  <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      className="ogt-action-btn ogt-action-btn-edit"
                      onClick={(e) => { e.stopPropagation(); handleEditGroup(group); }}
                      title="Chỉnh sửa"
                    >
                      <img src={assets.edit} alt="Chỉnh sửa nhóm" />
                    </button>
                    <button 
                      className="ogt-action-btn ogt-action-btn-delete"
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                      disabled={deletingGroupId === gid}
                      title="Xóa nhóm"
                    >
                      <img src={assets.trash} alt="Xóa nhóm" />
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="ogt-values">
                    {!values.length && <div className="ogt-hint">Chưa có option value.</div>}
                    {values.map((v) => {
                      const toggleKey = makeValueKey(gid, v);
                      const isUpdating = !isDemo && updatingMap[toggleKey];
                      return (
                        <div key={v.key} className="ogt-val-row">
                          <div className="ogt-val-info">
                            <div className="ogt-val-name">{v.name}</div>
                            <div className="ogt-val-price">+ {Number(v.price || 0).toLocaleString('vi-VN')}đ</div>
                          </div>
                          <div className="ogt-val-toggle">
                            <label className="ogt-switch">
                              <input
                                type="checkbox"
                                checked={v.isVisible !== false}
                                onChange={() => handleToggleOption(group, v)}
                                disabled={isUpdating || !v.id}
                              />
                              <span className="ogt-switch-slider" />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editModal.open && editModal.group && (
        <div className="ogt-modal-backdrop" onClick={closeEditModal}>
          <div className="ogt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ogt-modal-head">
              <h3>Quản lý: {editModal.group.title || editModal.group.name}</h3>
              <button className="ogt-modal-close" onClick={closeEditModal}>✕</button>
            </div>

            <div className="ogt-modal-body">
              {/* Existing Values */}
              <div className="ogt-modal-section">
                <h4>Danh sách option values</h4>
                <div className="ogt-modal-values">
                  {(() => {
                    const valuesRaw = Array.isArray(editModal.group.options)
                      ? editModal.group.options
                      : (Array.isArray(editModal.group.optionValues) ? editModal.group.optionValues : []);
                    if (!valuesRaw.length) return <div className="ogt-hint">Chưa có option value.</div>;
                    return valuesRaw.map((val, idx) => {
                      const valId = getValueId(val);
                      const valName = val.label || val.name || val.title || `Lựa chọn ${idx + 1}`;
                      const valPrice = val.extraPrice ?? val.priceDelta ?? val.price ?? 0;
                      const isDeleting = deletingValueId === String(valId);
                      const valueObj = {
                        key: valId ?? `${getGroupId(editModal.group)}-${idx}`,
                        id: valId,
                        index: idx,
                        name: valName,
                        price: valPrice,
                      };
                      return (
                        <div key={valueObj.key} className="ogt-modal-value-row">
                          <div className="ogt-modal-value-info">
                            <span className="ogt-modal-value-name">{valName}</span>
                            <span className="ogt-modal-value-price">+ {Number(valPrice).toLocaleString('vi-VN')}đ</span>
                          </div>
                          <div className="ogt-modal-value-actions">
                            <button 
                              className="ogt-modal-btn-edit" 
                              onClick={() => handleEditValue(valueObj, getGroupId(editModal.group))}
                              disabled={isDeleting}
                            >
                              <img src={assets.edit} alt="Sửa option" />
                            </button>
                            <button 
                              className="ogt-modal-btn-delete" 
                              onClick={() => handleDeleteValue(valueObj)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? '...' : <img src={assets.trash} alt="Xóa option" />}
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Add New Value */}
              <div className="ogt-modal-section">
                <h4>Thêm option value mới</h4>
                <div className="ogt-modal-add-form">
                  <input
                    type="text"
                    placeholder="Tên option"
                    value={addValueForm.name}
                    onChange={(e) => setAddValueForm(prev => ({ ...prev, name: e.target.value }))}
                    className="ogt-modal-input"
                  />
                  <div className="ogt-modal-price-input">
                    <input
                      type="number"
                      placeholder="0"
                      value={addValueForm.extraPrice}
                      onChange={(e) => setAddValueForm(prev => ({ ...prev, extraPrice: e.target.value }))}
                      className="ogt-modal-input"
                    />
                    <span>đ</span>
                  </div>
                  <button 
                    className="ogt-modal-btn-add" 
                    onClick={handleAddValue}
                    disabled={addingValue}
                  >
                    {addingValue ? 'Đang thêm...' : '+ Thêm'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Value Modal */}
      {editValueModal.open && editValueModal.value && (
        <div className="ogt-modal-backdrop" onClick={() => setEditValueModal({ open: false, value: null, groupId: null })}>
          <div className="ogt-modal ogt-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="ogt-modal-head">
              <h3>Chỉnh sửa option value</h3>
              <button className="ogt-modal-close" onClick={() => setEditValueModal({ open: false, value: null, groupId: null })}>✕</button>
            </div>
            <div className="ogt-modal-body">
              <div className="ogt-modal-field">
                <label>Tên option</label>
                <input
                  type="text"
                  placeholder="Tên option"
                  value={editValueForm.name}
                  onChange={(e) => setEditValueForm(prev => ({ ...prev, name: e.target.value }))}
                  className="ogt-modal-input"
                />
              </div>
              <div className="ogt-modal-field">
                <label>Giá thêm</label>
                <div className="ogt-modal-price-input">
                  <input
                    type="number"
                    placeholder="0"
                    value={editValueForm.extraPrice}
                    onChange={(e) => setEditValueForm(prev => ({ ...prev, extraPrice: e.target.value }))}
                    className="ogt-modal-input"
                  />
                  <span>đ</span>
                </div>
              </div>
              <div className="ogt-modal-actions">
                <button 
                  className="ogt-modal-btn-cancel" 
                  onClick={() => setEditValueModal({ open: false, value: null, groupId: null })}
                >
                  Hủy
                </button>
                <button 
                  className="ogt-modal-btn-save" 
                  onClick={handleSaveEditValue}
                  disabled={savingValue}
                >
                  {savingValue ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
