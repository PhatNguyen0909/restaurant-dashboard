import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ManageOptionGroups.css';
import merchantAPI from '../../api/merchantAPI';
import OptionAPI from '../../api/Option';
import { assets } from '../../assets/assets';

const toNumberSafe = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const getGroupId = (group) => (
  group?.id
  ?? group?._id
  ?? group?.optionId
  ?? group?.option_id
  ?? group?.optionGroupId
  ?? group?.option_group_id
);

const getValueId = (value) => (
  value?.id
  ?? value?._id
  ?? value?.valueId
  ?? value?.value_id
);

const getActiveOptionValues = (group) => {
  if (!group) return [];
  const baseValues = Array.isArray(group?.optionValues)
    ? group.optionValues
    : (Array.isArray(group?.options) ? group.options : []);
  return baseValues.filter((item) => item?.active !== false);
};

export default function ManageOptionGroups() {
  // State
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selected group
  const [selectedGroup, setSelectedGroup] = useState(null);
  const selectedGroupRef = useRef(null);
  
  // Edit option value modal
  const [editValueModal, setEditValueModal] = useState({ open: false, value: null });
    const selectedGroupActiveValues = useMemo(() => getActiveOptionValues(selectedGroup), [selectedGroup]);
  const [editValueForm, setEditValueForm] = useState({ name: '', extraPrice: '' });
  const [savingValue, setSavingValue] = useState(false);
  
  // Add new value modal
  const [addValueModal, setAddValueModal] = useState({ open: false, groupId: null });
  const [newValueForm, setNewValueForm] = useState({ name: '', extraPrice: '' });
  const [addingValue, setAddingValue] = useState(false);
  
  // Edit group name
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameForm, setGroupNameForm] = useState('');
  const [savingGroupName, setSavingGroupName] = useState(false);
  
  // Assign menu items modal
  const [assignModal, setAssignModal] = useState({ open: false, groupId: null, groupName: '' });
  const [dishes, setDishes] = useState([]);
  const [dishesLoading, setDishesLoading] = useState(false);
  const [selectedMenuIds, setSelectedMenuIds] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const [assignedItems, setAssignedItems] = useState([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedError, setAssignedError] = useState('');
  const [openAssignedCats, setOpenAssignedCats] = useState({});
  const [removingMenuItemId, setRemovingMenuItemId] = useState('');
  const [deletingGroupId, setDeletingGroupId] = useState('');
  const [deletingValueId, setDeletingValueId] = useState('');

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await OptionAPI.getAll();
      const list = Array.isArray(data) ? data : [];
      setGroups(list);
      if (!list.length) {
        setSelectedGroup(null);
      } else {
        const currentId = getGroupId(selectedGroupRef.current);
        if (currentId) {
          const existing = list.find((item) => getGroupId(item) === currentId);
          setSelectedGroup(existing || list[0]);
        } else {
          setSelectedGroup(list[0]);
        }
      }
    } catch (err) {
      setError('Không tải được danh sách nhóm tuỳ chọn');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch dishes
  const fetchDishes = useCallback(async () => {
    setDishesLoading(true);
    try {
      const data = await merchantAPI.getMenuItems();
      setDishes(Array.isArray(data) ? data : []);
    } catch (err) {
      setDishes([]);
      console.error(err);
    } finally {
      setDishesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchDishes();
  }, [fetchGroups, fetchDishes]);

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  const dishesById = useMemo(() => {
    const map = new Map();
    dishes.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const rawId = item?.id ?? item?._id ?? item?.menuItemId ?? item?.menu_item_id;
      if (rawId === undefined || rawId === null) return;
      map.set(String(rawId), item);
    });
    return map;
  }, [dishes]);

  const fetchAssignedMenuItems = useCallback(async (groupId, options = {}) => {
    const { syncSelection = false } = options;
    if (!groupId) {
      setAssignedItems([]);
      setAssignedError('');
      if (syncSelection) setSelectedMenuIds([]);
      return [];
    }

    setAssignedLoading(true);
    setAssignedError('');
    try {
      const res = await OptionAPI.getMenuItems(groupId);
      const rawList = Array.isArray(res) ? res : [];

      const normalized = [];
      const seen = new Set();
      rawList.forEach((entry) => {
        const rawId = typeof entry === 'object'
          ? (entry?.menuItemId ?? entry?.menu_item_id ?? entry?.id ?? entry?._id)
          : entry;
        if (rawId === undefined || rawId === null) return;
        const id = String(rawId);
        if (seen.has(id)) return;
        seen.add(id);
        const base = dishesById.get(id) || {};
        const payload = (entry && typeof entry === 'object') ? entry : {};
        const merged = { ...base, ...payload, id };
        if (!merged.category && merged.categoryName) {
          merged.category = { name: merged.categoryName };
        }
        normalized.push(merged);
      });

      const missing = normalized
        .filter((item) => {
          const category = item?.category;
          const hasName = category?.name || item?.categoryName;
          return !hasName;
        })
        .map((item) => item.id);

      if (missing.length) {
        const uniqueMissing = Array.from(new Set(missing));
        const details = await Promise.all(uniqueMissing.map(async (id) => {
          try {
            const detail = await merchantAPI.getMenuItemById(id);
            return { id, detail };
          } catch (error) {
            console.error('Fetch menu item detail failed:', error);
            return { id, detail: null };
          }
        }));
        const detailMap = new Map(details
          .filter((item) => item.detail && typeof item.detail === 'object')
          .map(({ id, detail }) => [String(id), detail]));
        normalized.forEach((item, index) => {
          const detail = detailMap.get(item.id);
          if (detail) {
            normalized[index] = { ...detail, ...item, id: item.id };
          }
        });
      }

      setAssignedItems(normalized);
      if (syncSelection) {
        setSelectedMenuIds(normalized.map((item) => item.id).filter(Boolean));
      }
      return normalized;
    } catch (err) {
      console.error('Fetch assigned menu items error:', err);
      setAssignedItems([]);
      setAssignedError('Không tải được danh sách món đã gán');
      if (syncSelection) setSelectedMenuIds([]);
      return [];
    } finally {
      setAssignedLoading(false);
    }
  }, [dishesById]);

  useEffect(() => {
    const groupId = getGroupId(selectedGroup);
    setOpenAssignedCats({});
    if (!groupId) {
      setAssignedItems([]);
      setAssignedError('');
      return;
    }
    fetchAssignedMenuItems(groupId);
  }, [selectedGroup, fetchAssignedMenuItems]);

  // Edit group name
  const startEditingGroupName = () => {
  setGroupNameForm(selectedGroup?.name || selectedGroup?.title || '');
    setEditingGroupName(true);
  };

  const cancelEditingGroupName = () => {
    setEditingGroupName(false);
    setGroupNameForm('');
  };

  const handleSaveGroupName = async () => {
    if (!selectedGroup) return;
    const groupId = getGroupId(selectedGroup);
    if (!groupId) {
      alert('Không xác định được mã nhóm');
      return;
    }
    const name = groupNameForm.trim();
    if (!name) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }

    setSavingGroupName(true);
    try {
      await OptionAPI.updateGroup(groupId, { name });
      
      // Update local state
      setGroups((prevGroups) => prevGroups.map((g) =>
        (getGroupId(g) === groupId ? { ...g, name } : g)
      ));
      setSelectedGroup((prev) => (prev ? { ...prev, name } : prev));
      
      alert('Đã cập nhật tên nhóm');
      setEditingGroupName(false);
      
      // Fetch lại để sync
      setTimeout(() => fetchGroups(), 300);
    } catch (err) {
      console.error('Update group name error:', err);
      alert(err?.response?.data?.message || err?.message || 'Lưu thất bại');
    } finally {
      setSavingGroupName(false);
    }
  };

  // Edit option value
  const openEditValueModal = (value) => {
    setEditValueForm({
      name: value?.name || value?.label || '',
      extraPrice: String(toNumberSafe(value?.extraPrice ?? value?.priceDelta ?? value?.price ?? 0))
    });
    setEditValueModal({ open: true, value });
  };

  const closeEditValueModal = () => {
    setEditValueModal({ open: false, value: null });
    setEditValueForm({ name: '', extraPrice: '' });
  };

  const handleSaveValue = async () => {
    if (!editValueModal.value) return;
    const name = editValueForm.name.trim();
    if (!name) {
      alert('Vui lòng nhập tên lựa chọn');
      return;
    }

    const valueId = getValueId(editValueModal.value);
    if (!valueId) {
      alert('Không tìm thấy mã lựa chọn để cập nhật');
      return;
    }

    const extraPrice = toNumberSafe(editValueForm.extraPrice);
    setSavingValue(true);
    try {
      await OptionAPI.updateOptionValue(valueId, { name, extraPrice });

      const patchValues = (source) => (
        Array.isArray(source)
          ? source.map((item) => (String(getValueId(item)) === String(valueId) ? { ...item, name, extraPrice } : item))
          : source
      );

      setGroups((prevGroups) => prevGroups.map((group) => ({
        ...group,
        optionValues: patchValues(group.optionValues),
        options: patchValues(group.options),
      })));

      setSelectedGroup((prev) => (prev ? ({
        ...prev,
        optionValues: patchValues(prev.optionValues),
        options: patchValues(prev.options),
      }) : prev));

      alert('Đã cập nhật lựa chọn');
      closeEditValueModal();

      // Vẫn fetch lại để sync với server (nhưng không block UI)
      setTimeout(() => fetchGroups(), 300);
    } catch (err) {
      console.error('Update error:', err);
      alert(err?.response?.data?.message || err?.message || 'Lưu thất bại');
    } finally {
      setSavingValue(false);
    }
  };

  // Add new value
  const openAddValueModal = (groupIdRaw) => {
    const groupId = groupIdRaw ?? getGroupId(selectedGroup);
    if (!groupId) {
      alert('Không xác định được mã nhóm');
      return;
    }
    setNewValueForm({ name: '', extraPrice: '0' });
    setAddValueModal({ open: true, groupId });
  };

  const closeAddValueModal = () => {
    setAddValueModal({ open: false, groupId: null });
    setNewValueForm({ name: '', extraPrice: '0' });
  };

  const handleAddValue = async () => {
    if (!addValueModal.groupId) return;
    const name = newValueForm.name.trim();
    if (!name) {
      alert('Vui lòng nhập tên lựa chọn');
      return;
    }
    
    const extraPrice = toNumberSafe(newValueForm.extraPrice);
    
    setAddingValue(true);
    try {
      await OptionAPI.addOptionValue(addValueModal.groupId, { name, extraPrice });
      alert('Đã thêm lựa chọn mới');
      closeAddValueModal();
      await fetchGroups();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Thêm thất bại');
    } finally {
      setAddingValue(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) {
      alert('Chưa chọn nhóm nào để xóa');
      return;
    }
    const groupId = getGroupId(selectedGroup);
    if (!groupId) {
      alert('Không xác định được mã nhóm');
      return;
    }
    if (!window.confirm('Bạn có chắc muốn xóa toàn bộ nhóm tuỳ chọn này?')) return;

    const groupIdStr = String(groupId);
    setDeletingGroupId(groupIdStr);
    try {
      await OptionAPI.deleteGroup(groupId);

      setAssignModal({ open: false, groupId: null, groupName: '' });
      setSelectedMenuIds([]);
      setOpenCats({});
      setAssignedItems([]);
      setAssignedError('');
      setOpenAssignedCats({});
      setRemovingMenuItemId('');
      closeEditValueModal();
      closeAddValueModal();
      selectedGroupRef.current = null;
      setSelectedGroup(null);

      await fetchGroups();
      alert('Đã xóa nhóm tuỳ chọn');
    } catch (err) {
      console.error('Delete option group error:', err);
      alert(err?.response?.data?.message || err?.message || 'Xóa nhóm thất bại');
    } finally {
      setDeletingGroupId('');
    }
  };

  const handleDeleteValue = async (value) => {
    if (!selectedGroup) {
      alert('Chưa chọn nhóm nào');
      return;
    }
    const groupId = getGroupId(selectedGroup);
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

    const groupIdStr = String(groupId);
    const valueIdStr = String(valueId);
    setDeletingValueId(valueIdStr);

    try {
      await OptionAPI.deleteOptionValue(valueId);

      const filterValues = (source) => (
        Array.isArray(source)
          ? source.filter((item) => String(getValueId(item)) !== valueIdStr)
          : source
      );

      setGroups((prevGroups) => prevGroups.map((group) => {
        if (String(getGroupId(group)) !== groupIdStr) {
          return group;
        }
        const next = { ...group };
        if (Array.isArray(group.optionValues)) {
          next.optionValues = filterValues(group.optionValues);
        }
        if (Array.isArray(group.options)) {
          next.options = filterValues(group.options);
        }
        return next;
      }));

      setSelectedGroup((prev) => {
        if (!prev) return prev;
        if (String(getGroupId(prev)) !== groupIdStr) return prev;
        const next = { ...prev };
        if (Array.isArray(prev.optionValues)) {
          next.optionValues = filterValues(prev.optionValues);
        }
        if (Array.isArray(prev.options)) {
          next.options = filterValues(prev.options);
        }
        return next;
      });

      if (editValueModal.open && String(getValueId(editValueModal.value)) === valueIdStr) {
        closeEditValueModal();
      }

      alert('Đã xóa lựa chọn');
    } catch (err) {
      console.error('Delete option value error:', err);
      alert(err?.response?.data?.message || err?.message || 'Xóa lựa chọn thất bại');
    } finally {
      setDeletingValueId('');
    }
  };

  // Assign menu items
  const openAssignModal = async (groupIdRaw, groupName) => {
    const groupId = groupIdRaw ?? getGroupId(selectedGroup);
    if (!groupId) {
      alert('Không xác định được mã nhóm');
      return;
    }

    setAssignModal({ open: true, groupId, groupName: groupName || '' });
    setSelectedMenuIds([]);
    setOpenCats({});
    setRemovingMenuItemId('');

    await fetchAssignedMenuItems(groupId, { syncSelection: true });
  };

  const closeAssignModal = () => {
    setAssignModal({ open: false, groupId: null, groupName: '' });
    setSelectedMenuIds([]);
    setOpenCats({});
  };

  const handleAssign = async () => {
    if (!assignModal.groupId) return;
    const uniqueIds = Array.from(new Set(selectedMenuIds));

    setAssigning(true);
    try {
      await OptionAPI.assignMenuItems(assignModal.groupId, uniqueIds);
      alert('Đã gán nhóm vào các món đã chọn');
      await fetchAssignedMenuItems(assignModal.groupId);
      closeAssignModal();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Gán thất bại');
    } finally {
      setAssigning(false);
    }
  };

  // Group dishes by category
  const groupedDishes = useMemo(() => {
    const byCat = {};
    dishes.forEach((d) => {
      const cat = d?.categoryName || d?.category?.name || 'Khác';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(d);
    });
    return byCat;
  }, [dishes]);

  const assignedCategories = useMemo(() => {
    if (!assignedItems.length) return [];
    const map = new Map();
    assignedItems.forEach((item) => {
      if (!item) return;
      const catIdRaw = item?.category?.id ?? item?.categoryId ?? item?.category_id ?? item?.categoryKey;
      const catName = item?.category?.name ?? item?.categoryName ?? 'Khác';
      const key = catIdRaw !== undefined && catIdRaw !== null ? String(catIdRaw) : catName;
      if (!map.has(key)) {
        map.set(key, { id: key, name: catName, dishes: [] });
      }
      const bucket = map.get(key);
      const dishIdRaw = item?.id ?? item?.menuItemId ?? item?.menu_item_id ?? item?._id;
      bucket.dishes.push({
        id: dishIdRaw != null ? String(dishIdRaw) : undefined,
        name: item?.name || item?.title || 'Không tên',
        price: toNumberSafe(item?.basePrice ?? item?.price ?? item?.listPrice ?? 0),
        imgUrl: item?.imgUrl ?? item?.image ?? item?.thumbnailUrl ?? '',
      });
    });

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        dishes: entry.dishes.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi', { sensitivity: 'base' })),
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi', { sensitivity: 'base' }));
  }, [assignedItems]);

  const toggleAssignedCategory = (id) => {
    setOpenAssignedCats((prev) => {
      const key = id != null ? String(id) : '__unknown__';
      return { ...prev, [key]: !prev[key] };
    });
  };

  const handleRemoveAssignedDish = useCallback(async (menuItemIdRaw) => {
    if (menuItemIdRaw === undefined || menuItemIdRaw === null) {
      return;
    }

    const groupId = assignModal.groupId ?? getGroupId(selectedGroup);
    if (!groupId) {
      alert('Không xác định được mã nhóm');
      return;
    }

    const idStr = String(menuItemIdRaw);
    const baseIds = assignModal.open
      ? Array.from(new Set((selectedMenuIds || []).map((value) => String(value)).filter(Boolean)))
      : assignedItems.map((item) => String(item?.id)).filter(Boolean);

    if (!baseIds.includes(idStr)) {
      return;
    }

    const payloadIds = baseIds.filter((value) => value !== idStr);
    const previousAssigned = assignedItems.slice();
    const previousSelected = selectedMenuIds.slice();

    setRemovingMenuItemId(idStr);

    setAssignedItems((prev) => prev.filter((item) => String(item?.id) !== idStr));
    if (assignModal.open) {
      setSelectedMenuIds(payloadIds);
    }

    try {
      await OptionAPI.assignMenuItems(groupId, payloadIds);
      await fetchAssignedMenuItems(groupId, { syncSelection: true });
    } catch (err) {
      console.error('Unassign menu item error:', err);
      setAssignedItems(previousAssigned);
      if (assignModal.open) {
        setSelectedMenuIds(previousSelected);
      }
      alert(err?.response?.data?.message || err?.message || 'Bỏ gán thất bại');
    } finally {
      setRemovingMenuItemId('');
    }
  }, [assignModal.groupId, assignModal.open, selectedGroup, selectedMenuIds, assignedItems, fetchAssignedMenuItems]);

  return (
    <div className="mog-wrap">
      <div className="mog-header">
        <h2>Quản lý Option Groups</h2>
        <p>Chỉnh sửa và quản lý nhóm tuỳ chọn</p>
      </div>

      {loading && <div className="mog-hint">Đang tải...</div>}
      {error && <div className="mog-error">{error}</div>}

      {!loading && !error && (
        <div className="mog-layout">
          {/* Sidebar - List groups */}
          <div className="mog-sidebar">
            <h3>Danh sách nhóm</h3>
            {!groups.length && <div className="mog-hint">Chưa có nhóm nào</div>}
            {groups.map((g, index) => {
              const gid = getGroupId(g);
              const isActive = selectedGroup && getGroupId(selectedGroup) === gid;
              const activeValueCount = getActiveOptionValues(g).length;
              return (
                <button
                  key={gid ?? `group-${index}`}
                  type="button"
                  className={`mog-group-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSelectedGroup(g)}
                >
                  <div className="mog-group-name">{g.name || g.title || 'Không tên'}</div>
                  <div className="mog-group-meta">
                    {activeValueCount} lựa chọn
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main - Selected group detail */}
          <div className="mog-main">
            {!selectedGroup && <div className="mog-hint">Chọn một nhóm để xem chi tiết</div>}
            
            {selectedGroup && (
              <>
                <div className="mog-group-header">
                  {!editingGroupName ? (
                    <>
                      <h3>{selectedGroup.name || 'Không tên'}</h3>
                      <div className="mog-group-actions">
                        <button
                          type="button"
                          className="mog-btn-ghost"
                          onClick={startEditingGroupName}
                        >
                          Đổi tên
                        </button>
                        <button
                          type="button"
                          className="mog-btn-danger"
                          onClick={handleDeleteGroup}
                          disabled={deletingGroupId === String(getGroupId(selectedGroup))}
                        >
                          {deletingGroupId === String(getGroupId(selectedGroup)) ? 'Đang xóa...' : 'Xóa nhóm'}
                        </button>
                        <button
                          type="button"
                          className="mog-btn-primary"
                          onClick={() => openAssignModal(getGroupId(selectedGroup), selectedGroup.name || selectedGroup.title)}
                        >
                          Gán vào món
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mog-field" style={{ flex: 1, margin: 0 }}>
                        <input
                          type="text"
                          value={groupNameForm}
                          onChange={(e) => setGroupNameForm(e.target.value)}
                          placeholder="Tên nhóm"
                          autoFocus
                        />
                      </div>
                      <div className="mog-group-actions">
                        <button
                          type="button"
                          className="mog-btn-ghost"
                          onClick={cancelEditingGroupName}
                          disabled={savingGroupName}
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          className="mog-btn-primary"
                          onClick={handleSaveGroupName}
                          disabled={savingGroupName}
                        >
                          {savingGroupName ? 'Đang lưu...' : 'Lưu'}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="mog-assigned">
                  <div className="mog-assigned-header">
                    <h4>Danh mục &amp; món đã gán</h4>
                    <span>{assignedItems.length ? `${assignedItems.length} món` : 'Chưa có món'}</span>
                  </div>
                  {assignedLoading && (
                    <div className="mog-hint">Đang tải danh sách món đã gán...</div>
                  )}
                  {!assignedLoading && assignedError && (
                    <div className="mog-inline-error">{assignedError}</div>
                  )}
                  {!assignedLoading && !assignedError && !assignedCategories.length && (
                    <div className="mog-hint">Chưa gán nhóm này cho món nào.</div>
                  )}
                  {!assignedLoading && !assignedError && !!assignedCategories.length && (
                    <div className="mog-assigned-list">
                      {assignedCategories.map((cat, index) => {
                        const keyRaw = cat.id ?? cat.name ?? index;
                        const key = String(keyRaw);
                        const open = openAssignedCats[key] === true;
                        return (
                          <div key={key} className={`mog-assigned-cat ${open ? 'open' : ''}`}>
                            <button
                              type="button"
                              className="mog-assigned-cat-header"
                              onClick={() => toggleAssignedCategory(key)}
                            >
                              <div className="mog-assigned-cat-info">
                                <div className="mog-assigned-cat-name">{cat.name || 'Không có danh mục'}</div>
                                <div className="mog-assigned-cat-meta">Liên kết với {cat.dishes.length} món</div>
                              </div>
                              <img src={open ? assets.up : assets.down} alt="toggle" />
                            </button>
                            {open && (
                              <div className="mog-assigned-dishes">
                                {cat.dishes.map((dish, idx) => {
                                  const price = Number.isFinite(dish.price) ? `${dish.price.toLocaleString('vi-VN')}đ` : '-';
                                  const dishKey = dish.id ?? `${key}-${idx}`;
                                  const fallbackLetter = (dish.name || '?').trim().charAt(0).toUpperCase() || '?';
                                  const idStr = dish.id != null ? String(dish.id) : '';
                                  const removing = removingMenuItemId && idStr && removingMenuItemId === idStr;
                                  return (
                                    <div key={dishKey} className="mog-assigned-dish">
                                      <div className="mog-assigned-dish-content">
                                        {dish.imgUrl ? (
                                          <img src={dish.imgUrl} alt={dish.name} />
                                        ) : (
                                          <div className="mog-assigned-dish-fallback">{fallbackLetter}</div>
                                        )}
                                        <div className="mog-assigned-dish-info">
                                          <div className="mog-assigned-dish-name">{dish.name}</div>
                                          <div className="mog-assigned-dish-price">{price}</div>
                                        </div>
                                      </div>
                                      {idStr && (
                                        <button
                                          type="button"
                                          className="mog-assigned-dish-remove"
                                          onClick={() => handleRemoveAssignedDish(idStr)}
                                          disabled={removing}
                                        >
                                          {removing ? 'Đang bỏ...' : 'Bỏ gán'}
                                        </button>
                                      )}
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
                </div>

                <div className="mog-values">
                  <div className="mog-values-header">
                    <h4>Các lựa chọn ({selectedGroupActiveValues.length})</h4>
                    <button
                      type="button"
                      className="mog-btn-add"
                      onClick={() => openAddValueModal(getGroupId(selectedGroup))}
                    >
                      + Thêm lựa chọn
                    </button>
                  </div>

                  <div className="mog-values-list">
                    {!selectedGroupActiveValues.length && (
                      <div className="mog-hint">Chưa có lựa chọn nào</div>
                    )}
                    {selectedGroupActiveValues.map((v, index) => {
                      const valueId = getValueId(v);
                      const valueKey = valueId ?? `value-${index}`;
                      const valueIdStr = valueId != null ? String(valueId) : '';
                      const deleting = valueIdStr !== '' && deletingValueId === valueIdStr;
                      return (
                        <div key={valueKey} className="mog-value-item">
                          <div className="mog-value-info">
                            <div className="mog-value-name">{v.name || v.label || 'Không tên'}</div>
                            <div className="mog-value-price">+ {toNumberSafe(v.extraPrice ?? v.priceDelta ?? v.price ?? 0).toLocaleString('vi-VN')}đ</div>
                          </div>
                          <div className="mog-value-actions">
                            <button
                              type="button"
                              className="mog-btn-edit"
                              onClick={() => openEditValueModal(v)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="mog-btn-danger"
                              onClick={() => handleDeleteValue(v)}
                              disabled={deleting}
                            >
                              {deleting ? 'Đang xóa...' : 'Xóa'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Value Modal */}
      {editValueModal.open && (
        <div className="mog-modal-backdrop">
          <div className="mog-modal">
            <div className="mog-modal-header">
              <h3>Chỉnh sửa lựa chọn</h3>
              <button className="mog-btn-close" onClick={closeEditValueModal}>×</button>
            </div>
            <div className="mog-modal-body">
              <label className="mog-field">
                <span>Tên lựa chọn</span>
                <input
                  value={editValueForm.name}
                  onChange={(e) => setEditValueForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ví dụ: Đá ít"
                />
              </label>
              <label className="mog-field">
                <span>Giá thêm (đ)</span>
                <input
                  type="number"
                  value={editValueForm.extraPrice}
                  onChange={(e) => setEditValueForm(prev => ({ ...prev, extraPrice: e.target.value }))}
                  placeholder="0"
                />
              </label>
            </div>
            <div className="mog-modal-footer">
              <button className="mog-btn-ghost" onClick={closeEditValueModal}>Hủy</button>
              <button className="mog-btn-primary" onClick={handleSaveValue} disabled={savingValue}>
                {savingValue ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Value Modal */}
      {addValueModal.open && (
        <div className="mog-modal-backdrop">
          <div className="mog-modal">
            <div className="mog-modal-header">
              <h3>Thêm lựa chọn mới</h3>
              <button className="mog-btn-close" onClick={closeAddValueModal}>×</button>
            </div>
            <div className="mog-modal-body">
              <label className="mog-field">
                <span>Tên lựa chọn</span>
                <input
                  value={newValueForm.name}
                  onChange={(e) => setNewValueForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ví dụ: Đá nhiều"
                />
              </label>
              <label className="mog-field">
                <span>Giá thêm (đ)</span>
                <input
                  type="number"
                  value={newValueForm.extraPrice}
                  onChange={(e) => setNewValueForm(prev => ({ ...prev, extraPrice: e.target.value }))}
                  placeholder="0"
                />
              </label>
            </div>
            <div className="mog-modal-footer">
              <button className="mog-btn-ghost" onClick={closeAddValueModal}>Hủy</button>
              <button className="mog-btn-primary" onClick={handleAddValue} disabled={addingValue}>
                {addingValue ? 'Đang thêm...' : 'Thêm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal.open && (
        <div className="mog-modal-backdrop">
          <div className="mog-modal mog-modal-lg">
            <div className="mog-modal-header">
              <h3>Gán vào món - {assignModal.groupName}</h3>
              <button className="mog-btn-close" onClick={closeAssignModal}>×</button>
            </div>
            <div className="mog-modal-body">
              {dishesLoading && <div className="mog-hint">Đang tải món...</div>}
              {!dishesLoading && !dishes.length && <div className="mog-hint">Chưa có món nào</div>}
              {!dishesLoading && dishes.length > 0 && (
                <div className="mog-dish-groups">
                  {Object.keys(groupedDishes).map((cat) => {
                    const isOpen = openCats[cat];
                    return (
                      <div className="mog-cat-block" key={cat}>
                        <div
                          className="mog-cat-header"
                          onClick={() => setOpenCats(prev => ({ ...prev, [cat]: !isOpen }))}
                        >
                          <span>{cat}</span>
                          <img src={isOpen ? assets.up : assets.down} alt="toggle" />
                        </div>
                        {isOpen && (
                          <div className="mog-dish-grid">
                              {groupedDishes[cat].map((d) => {
                                const rawId = d?.id ?? d?._id ?? d?.menuItemId ?? d?.menu_item_id;
                                if (rawId === undefined || rawId === null) return null;
                                const id = String(rawId);
                                const checked = selectedMenuIds.includes(id);
                                const removing = removingMenuItemId && removingMenuItemId === id;
                                return (
                                  <div key={id} className={`mog-dish-item ${checked ? 'active' : ''}`}>
                                    <label className="mog-dish-item-select">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          setSelectedMenuIds((prev) => {
                                            const next = new Set(prev);
                                            if (e.target.checked) {
                                              next.add(id);
                                            } else {
                                              next.delete(id);
                                            }
                                            return Array.from(next);
                                          });
                                        }}
                                      />
                                      <span>{d.name}</span>
                                    </label>
                                    {checked && (
                                      <button
                                        type="button"
                                        className="mog-dish-remove"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleRemoveAssignedDish(id);
                                        }}
                                        disabled={removing || assigning}
                                      >
                                        {removing ? 'Đang bỏ...' : 'Bỏ gán'}
                                      </button>
                                    )}
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
            </div>
            <div className="mog-modal-footer">
              <button className="mog-btn-ghost" onClick={closeAssignModal}>Hủy</button>
              <button className="mog-btn-primary" onClick={handleAssign} disabled={assigning || !!removingMenuItemId}>
                {assigning ? 'Đang gán...' : 'Gán vào món đã chọn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
