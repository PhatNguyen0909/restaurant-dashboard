import React, { useEffect, useMemo, useState } from 'react';
import './Category.css';
import merchantAPI from '../../api/merchantAPI';
import { assets } from '../../assets/assets';

const Category = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingKey, setEditingKey] = useState('');
  const [merchantId, setMerchantId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await merchantAPI.getCategories();
      setItems(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    (async () => {
      try {
        const info = await merchantAPI.getMyMerchant();
        const id = info?.id ?? info?._id ?? info?.merchantId ?? info?.merchant_id;
        if (id != null) setMerchantId(id);
      } catch {
        setMerchantId(null);
      }
    })();
  }, []);

  const onCreate = async (e) => {
    e?.preventDefault?.();
    if (creating) return;
    if (!newName.trim()) return;
    try {
      setCreating(true);
      await merchantAPI.createCategory({ name: newName.trim(), merchantId });
      setNewName('');
      setShowCreateModal(false);
      await refresh();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.message || err?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item?.id ?? item?._id ?? item?.categoryId);
    setEditingName(item?.name ?? item?.categoryName ?? item?.title ?? '');
    setEditingKey(item?.categoryKey ?? item?.categoryName ?? item?.title ?? '');
  };

  const onSaveEdit = async () => {
    const id = editingId;
    if (!id) return;
    try {
      await merchantAPI.updateCategory(id, { name: editingName.trim(), merchantId, categoryKey: editingKey });
      setEditingId(null);
      setEditingName('');
      setEditingKey('');
      await refresh();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.message || err?.message || 'Update failed');
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Xóa danh mục này?')) return;
    try {
      await merchantAPI.deleteCategory(id);
      await refresh();
    } catch (err) {
      // eslint-disable-next-line no-alert
      alert(err?.response?.data?.message || err?.message || 'Delete failed');
    }
  };

  const normalized = useMemo(() => {
    return items.map((x) => ({
      id: x?.id ?? x?._id ?? x?.categoryId,
      name: x?.name ?? x?.categoryName ?? x?.title,
      categoryKey: x?.categoryName ?? x?.category_name ?? x?.code ?? '',
    })).filter(it => it.id != null);
  }, [items]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return normalized;
    const term = searchTerm.toLowerCase();
    return normalized.filter(item => 
      item.name?.toLowerCase().includes(term)
    );
  }, [normalized, searchTerm]);

  // Random colors for category cards
  const categoryColors = ['#FF6B35', '#FF8E53', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9', '#74B9FF'];
  const getColorForCategory = (index) => categoryColors[index % categoryColors.length];

  return (
    <div className="category-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Quản lý danh mục món ăn</p>
        </div>
        <button className="btn-create" onClick={() => setShowCreateModal(true)}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3V13M3 8H13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Tạo danh mục
        </button>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="6" stroke="#9CA3AF" strokeWidth="1.5"/>
          <path d="M14 14L17 17" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          placeholder="Tìm kiếm danh mục..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Category Grid */}
      {loading ? (
        <div className="loading-state">Đang tải...</div>
      ) : (
        <div className="category-grid">
          {filteredCategories.length === 0 ? (
            <div className="empty-state">
              {searchTerm ? 'Không tìm thấy danh mục nào' : 'Chưa có danh mục nào'}
            </div>
          ) : (
            filteredCategories.map((item, index) => (
              <div 
                key={item.id} 
                className="category-card"
                style={{ borderLeftColor: getColorForCategory(index) }}
              >
                <div className="category-card-header">
                  <div className="category-icon" style={{ backgroundColor: getColorForCategory(index) }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 3H8V8H3V3Z" stroke="white" strokeWidth="1.5"/>
                      <path d="M12 3H17V8H12V3Z" stroke="white" strokeWidth="1.5"/>
                      <path d="M3 12H8V17H3V12Z" stroke="white" strokeWidth="1.5"/>
                      <path d="M12 12H17V17H12V12Z" stroke="white" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  {editingId === item.id ? (
                    <input
                      className="category-name-edit"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <h3 className="category-name">{item.name}</h3>
                  )}
                </div>

                <div className="category-card-footer">
                  <span className="category-count"></span>
                  <div className="category-actions">
                    {editingId === item.id ? (
                      <>
                        <button className="btn-icon btn-save" onClick={onSaveEdit} title="Lưu">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8L6 11L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                        <button 
                          className="btn-icon btn-cancel" 
                          onClick={() => { setEditingId(null); setEditingName(''); setEditingKey(''); }}
                          title="Hủy"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn-icon btn-edit" onClick={() => startEdit(item)} title="Sửa">
                          <img src={assets.edit} alt="Sửa" />
                        </button>
                        <button className="btn-icon btn-delete" onClick={() => onDelete(item.id)} title="Xóa">
                          <img src={assets.trash} alt="Xóa" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Tạo danh mục mới</h2>
                <p className="modal-subtitle">Thêm danh mục mới cho món ăn của nhà hàng</p>
              </div>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <form onSubmit={onCreate} className="modal-form">
              <div className="form-field">
                <label className="form-label">Tên danh mục</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nhập tên danh mục..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel-modal" 
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewName('');
                  }}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn-submit" 
                  disabled={creating || !newName.trim()}
                >
                  {creating ? 'Đang tạo...' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Category;
