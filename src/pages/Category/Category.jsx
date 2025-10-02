import React, { useEffect, useMemo, useState } from 'react';
import './Category.css';
import merchantAPI from '../../api/merchantAPI';

const Category = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

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

  const onCreate = async (e) => {
    e?.preventDefault?.();
    if (creating) return;
    if (!newName.trim()) return;
    try {
      setCreating(true);
      await merchantAPI.createCategory(newName.trim());
      setNewName('');
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
  };

  const onSaveEdit = async () => {
    const id = editingId;
    if (!id) return;
    try {
      await merchantAPI.updateCategory(id, editingName.trim());
      setEditingId(null);
      setEditingName('');
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
    })).filter(it => it.id != null);
  }, [items]);

  return (
    <div className="category-page">
      <h2>Quản lý Danh mục</h2>
      <form className="category-create" onSubmit={onCreate}>
        <input
          type="text"
          placeholder="Tên danh mục mới"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={creating || !newName.trim()}>
          {creating ? 'Đang tạo…' : 'Tạo'}
        </button>
      </form>

      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <table className="category-table">
          <thead>
            <tr>
              <th style={{width: 120}}>ID</th>
              <th>Tên danh mục</th>
              <th style={{width: 220}}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {normalized.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>
                  {editingId === item.id ? (
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                    />
                  ) : (
                    item.name
                  )}
                </td>
                <td className="actions">
                  {editingId === item.id ? (
                    <>
                      <button onClick={onSaveEdit}>Lưu</button>
                      <button onClick={() => setEditingId(null)}>Hủy</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(item)}>Sửa</button>
                      <button className="danger" onClick={() => onDelete(item.id)}>Xóa</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {normalized.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: '#777' }}>
                  Chưa có danh mục nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Category;
