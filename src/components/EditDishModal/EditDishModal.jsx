import React, { useEffect, useMemo, useState } from 'react';
import merchantAPI from '../../api/merchantAPI';
import './EditDishModal.css';

const initialForm = {
  name: '',
  description: '',
  basePrice: '',
  categoryId: '',
  imageFile: null,
};

const EditDishModal = ({
  open,
  onClose,
  dish,
  onSaved,
  isDemoUser,
}) => {
  const [form, setForm] = useState(initialForm);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | submitting | error
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const isLoading = status === 'loading';
  const isSubmitting = status === 'submitting';

  useEffect(() => {
    if (!open) return;
    if (isDemoUser) {
      setStatus('idle');
      setError('');
      if (dish?.category) {
        setCategories([{ id: dish.categoryId ?? dish.category, name: dish.category }]);
      } else {
        setCategories([]);
      }
      return;
    }
    setStatus('loading');
    setError('');
    const fetchData = async () => {
      try {
        const cats = await merchantAPI.getCategories();
        setCategories((Array.isArray(cats) ? cats : []).map((c) => ({
          id: c?.id ?? c?._id ?? c?.categoryId,
          name: c?.name ?? c?.categoryName ?? c?.title,
        })).filter((c) => c.id != null));
      } catch (err) {
        setError(err?.message || 'Không tải được dữ liệu.');
      } finally {
        setStatus('idle');
      }
    };
    fetchData();
  }, [open, isDemoUser, dish]);

  useEffect(() => {
    if (!dish || !open) return;
    setForm({
      name: dish.name || '',
      description: dish.description || '',
      basePrice: dish.price ?? dish.basePrice ?? '',
      categoryId: dish.categoryId ?? '',
      imageFile: null,
    });
    setPreviewUrl(dish.image || '');
  }, [dish, open]);

  useEffect(() => {
    if (!dish || !open) return;
    if (form.categoryId || !dish.category || !categories.length) return;
    const matched = categories.find((cat) => String(cat.name).toLowerCase() === String(dish.category).toLowerCase());
    if (matched) {
      setForm((prev) => ({ ...prev, categoryId: matched.id }));
    }
  }, [categories, dish, form.categoryId, open]);

  useEffect(() => () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setForm((prev) => ({ ...prev, imageFile: file }));
    if (file) {
      const blobUrl = URL.createObjectURL(file);
      setPreviewUrl(blobUrl);
    }
  };

  const formattedPrice = useMemo(() => {
    const num = Number(form.basePrice);
    if (Number.isNaN(num)) return form.basePrice;
    return num.toLocaleString('vi-VN');
  }, [form.basePrice]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!dish || isSubmitting) return;

    const sanitizedExistingImage = typeof dish?.image === 'string'
      ? dish.image.split('?')[0]
      : dish?.image;

    const payload = {
      name: (form.name || '').trim(),
      description: (form.description || '').trim(),
      categoryId: form.categoryId,
      basePrice: Number(form.basePrice),
      imageFile: form.imageFile,
      isVisible: dish?.status === 'available',
      forceFormData: true,
      existingImageUrl: sanitizedExistingImage,
    };

    if (!payload.name) {
      setError('Vui lòng nhập tên món ăn.');
      return;
    }
    if (!Number.isFinite(payload.basePrice) || payload.basePrice <= 0) {
      setError('Vui lòng nhập giá hợp lệ.');
      return;
    }
    if (!payload.categoryId) {
      setError('Vui lòng chọn danh mục.');
      return;
    }

    if (isDemoUser) {
      const dishId = dish._id ?? dish.id;
      onSaved?.({
        updatedDish: {
          ...dish,
          _id: dishId,
          id: dishId,
          name: payload.name,
          description: payload.description,
          category: dish.category,
          categoryId: payload.categoryId,
          price: payload.basePrice,
          image: payload.imageFile ? previewUrl : dish.image,
          status: payload.isVisible ? 'available' : 'unavailable',
        },
      });
      onClose?.();
      return;
    }

    try {
      setStatus('submitting');
      setError('');
      const dishId = dish._id ?? dish.id;
      if (!dishId) {
        setError('Thiếu mã món ăn để cập nhật.');
        setStatus('idle');
        return;
      }
      const result = await merchantAPI.updateMenuItem(dishId, payload);
      if (!result) throw new Error('Cập nhật thất bại');
      const cacheVersion = form.imageFile ? Date.now() : undefined;
      const updatedDish = {
        ...dish,
        _id: dishId,
        id: dishId,
        name: payload.name,
        description: payload.description,
        category: dish.category,
        categoryId: payload.categoryId,
        price: payload.basePrice,
        image: form.imageFile ? previewUrl : dish.image,
        status: payload.isVisible ? 'available' : 'unavailable',
      };
      const meta = { dishId, updatedDish };
      if (cacheVersion !== undefined) {
        meta.cacheVersion = cacheVersion;
      }
      onSaved?.(meta);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Không cập nhật được món ăn');
      setStatus('idle');
    } finally {
      setStatus('idle');
    }
  };

  if (!open) return null;

  return (
    <div className="edit-dish-modal-backdrop" role="dialog" aria-modal="true">
      <div className="edit-dish-modal">
        <header className="edit-dish-header">
          <h2>Chỉnh sửa món ăn</h2>
          <button type="button" className="edit-dish-close" onClick={onClose}>
            ×
          </button>
        </header>
        <form className="edit-dish-body" onSubmit={handleSubmit}>
          {error && <div className="edit-dish-error">{error}</div>}
          <div className="edit-dish-row">
            <label className="edit-dish-label" htmlFor="dish-name">Tên món ăn</label>
            <input
              id="dish-name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleInputChange}
              disabled={isLoading || isSubmitting}
              required
            />
          </div>
          <div className="edit-dish-row">
            <label className="edit-dish-label" htmlFor="dish-description">Mô tả</label>
            <textarea
              id="dish-description"
              name="description"
              rows="3"
              value={form.description}
              onChange={handleInputChange}
              disabled={isLoading || isSubmitting}
            />
          </div>
          <div className="edit-dish-grid">
            <div className="edit-dish-row">
              <label className="edit-dish-label" htmlFor="dish-price">Giá cơ bản</label>
              <input
                id="dish-price"
                name="basePrice"
                type="number"
                min="0"
                step="1000"
                value={form.basePrice}
                onChange={handleInputChange}
                disabled={isLoading || isSubmitting}
              />
              <div className="edit-dish-hint">{formattedPrice} đ</div>
            </div>
            <div className="edit-dish-row">
              <label className="edit-dish-label" htmlFor="dish-category">Danh mục</label>
              <select
                id="dish-category"
                name="categoryId"
                value={form.categoryId}
                onChange={handleInputChange}
                disabled={isLoading || isSubmitting}
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} (#{cat.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="edit-dish-row">
            <label className="edit-dish-label" htmlFor="dish-image">Ảnh món ăn</label>
            <input
              id="dish-image"
              name="image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={isLoading || isSubmitting}
            />
            {previewUrl && (
              <div className="edit-dish-preview">
                <img src={previewUrl} alt={dish?.name || 'Preview'} />
              </div>
            )}
          </div>
          <footer className="edit-dish-actions">
            <button type="button" onClick={onClose} className="edit-dish-btn secondary">
              Huỷ
            </button>
            <button type="submit" className="edit-dish-btn primary" disabled={isSubmitting}>
              {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default EditDishModal;
