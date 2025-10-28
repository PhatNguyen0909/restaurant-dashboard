import React, { useCallback, useEffect, useState } from 'react';
import './ManageOptionGroups.css';
import merchantAPI from '../../api/merchantAPI';
import OptionAPI from '../../api/Option';
import { assets } from '../../assets/assets';

const toNumberSafe = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export default function ManageOptionGroups() {
  // State
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selected group
  const [selectedGroup, setSelectedGroup] = useState(null);
  
  // Edit option value modal
  const [editValueModal, setEditValueModal] = useState({ open: false, value: null });
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

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await OptionAPI.getAll();
      const list = Array.isArray(data) ? data : [];
      setGroups(list);
      if (list.length && !selectedGroup) {
        setSelectedGroup(list[0]);
      }
    } catch (err) {
      setError('Không tải được danh sách nhóm tuỳ chọn');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

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
  }, []);

  // Edit group name
  const startEditingGroupName = () => {
    setGroupNameForm(selectedGroup?.name || '');
    setEditingGroupName(true);
  };

  const cancelEditingGroupName = () => {
    setEditingGroupName(false);
    setGroupNameForm('');
  };

  const handleSaveGroupName = async () => {
    if (!selectedGroup) return;
    const name = groupNameForm.trim();
    if (!name) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }

    setSavingGroupName(true);
    try {
      await OptionAPI.updateGroup(selectedGroup.id, { name });
      
      // Update local state
      setGroups(prevGroups => prevGroups.map(g => 
        g.id === selectedGroup.id ? { ...g, name } : g
      ));
      setSelectedGroup(prev => ({ ...prev, name }));
      
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
      name: value.name || '',
      extraPrice: String(value.extraPrice || 0)
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
    
    const extraPrice = toNumberSafe(editValueForm.extraPrice);
    
    console.log('=== EDIT VALUE DEBUG ===');
    console.log('Value ID:', editValueModal.value.id);
    console.log('Original value:', editValueModal.value);
    console.log('Payload:', { name, extraPrice });
    
    setSavingValue(true);
    try {
      const response = await OptionAPI.updateOptionValue(editValueModal.value.id, { name, extraPrice });
      console.log('Update response:', response);
      
      // Cập nhật local state ngay lập tức
      setGroups(prevGroups => prevGroups.map(group => {
        const values = group.optionValues || group.options || [];
        return {
          ...group,
          optionValues: values.map(v => 
            v.id === editValueModal.value.id 
              ? { ...v, name, extraPrice }
              : v
          ),
          options: values.map(v => 
            v.id === editValueModal.value.id 
              ? { ...v, name, extraPrice }
              : v
          )
        };
      }));
      
      // Cập nhật selectedGroup nếu đang chọn group này
      if (selectedGroup) {
        const values = selectedGroup.optionValues || selectedGroup.options || [];
        setSelectedGroup(prev => ({
          ...prev,
          optionValues: values.map(v => 
            v.id === editValueModal.value.id 
              ? { ...v, name, extraPrice }
              : v
          ),
          options: values.map(v => 
            v.id === editValueModal.value.id 
              ? { ...v, name, extraPrice }
              : v
          )
        }));
      }
      
      alert('Đã cập nhật lựa chọn');
      closeEditValueModal();
      
      // Vẫn fetch lại để sync với server (nhưng không block UI)
      setTimeout(() => fetchGroups(), 500);
    } catch (err) {
      console.error('Update error:', err);
      alert(err?.response?.data?.message || err?.message || 'Lưu thất bại');
    } finally {
      setSavingValue(false);
    }
  };

  // Add new value
  const openAddValueModal = (groupId) => {
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

  // Assign menu items
  const openAssignModal = async (groupId, groupName) => {
    setAssignModal({ open: true, groupId, groupName });
    setSelectedMenuIds([]);
    
    try {
      const res = await OptionAPI.getMenuItems(groupId);
      const arr = Array.isArray(res?.menuItems) ? res.menuItems : [];
      const ids = arr.map(item => String(item.id || item._id)).filter(Boolean);
      setSelectedMenuIds(ids);
    } catch (err) {
      console.error(err);
    }
  };

  const closeAssignModal = () => {
    setAssignModal({ open: false, groupId: null, groupName: '' });
    setSelectedMenuIds([]);
    setOpenCats({});
  };

  const handleAssign = async () => {
    if (!assignModal.groupId) return;
    
    setAssigning(true);
    try {
      await OptionAPI.assignMenuItems(assignModal.groupId, selectedMenuIds);
      alert('Đã gán nhóm vào các món đã chọn');
      closeAssignModal();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Gán thất bại');
    } finally {
      setAssigning(false);
    }
  };

  // Group dishes by category
  const groupedDishes = React.useMemo(() => {
    const byCat = {};
    dishes.forEach((d) => {
      const cat = d?.categoryName || d?.category?.name || 'Khác';
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(d);
    });
    return byCat;
  }, [dishes]);

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
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`mog-group-item ${selectedGroup?.id === g.id ? 'active' : ''}`}
                onClick={() => setSelectedGroup(g)}
              >
                <div className="mog-group-name">{g.name || 'Không tên'}</div>
                <div className="mog-group-meta">
                  {(g.optionValues || g.options || []).length} lựa chọn
                </div>
              </button>
            ))}
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
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          type="button"
                          className="mog-btn-ghost"
                          onClick={startEditingGroupName}
                        >
                          Đổi tên
                        </button>
                        <button
                          type="button"
                          className="mog-btn-primary"
                          onClick={() => openAssignModal(selectedGroup.id, selectedGroup.name)}
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
                      <div style={{ display: 'flex', gap: '12px' }}>
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

                <div className="mog-values">
                  <div className="mog-values-header">
                    <h4>Các lựa chọn ({(selectedGroup.optionValues || selectedGroup.options || []).length})</h4>
                    <button
                      type="button"
                      className="mog-btn-add"
                      onClick={() => openAddValueModal(selectedGroup.id)}
                    >
                      + Thêm lựa chọn
                    </button>
                  </div>

                  <div className="mog-values-list">
                    {!(selectedGroup.optionValues || selectedGroup.options || []).length && (
                      <div className="mog-hint">Chưa có lựa chọn nào</div>
                    )}
                    {(selectedGroup.optionValues || selectedGroup.options || []).map((v) => (
                      <div key={v.id} className="mog-value-item">
                        <div className="mog-value-info">
                          <div className="mog-value-name">{v.name || 'Không tên'}</div>
                          <div className="mog-value-price">+ {toNumberSafe(v.extraPrice).toLocaleString('vi-VN')}đ</div>
                        </div>
                        <button
                          type="button"
                          className="mog-btn-edit"
                          onClick={() => openEditValueModal(v)}
                        >
                          Sửa
                        </button>
                      </div>
                    ))}
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
                              const id = String(d.id || d._id);
                              const checked = selectedMenuIds.includes(id);
                              return (
                                <label key={id} className={`mog-dish-item ${checked ? 'active' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedMenuIds(prev => [...prev, id]);
                                      } else {
                                        setSelectedMenuIds(prev => prev.filter(i => i !== id));
                                      }
                                    }}
                                  />
                                  <span>{d.name}</span>
                                </label>
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
              <button className="mog-btn-primary" onClick={handleAssign} disabled={assigning}>
                {assigning ? 'Đang gán...' : 'Gán vào món đã chọn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
