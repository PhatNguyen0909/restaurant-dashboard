import React, { useEffect, useState } from 'react';
import './AddDishModal.css';
import merchantAPI from '../../api/merchantAPI';

const AddDishModal = ({ open, onClose, onDishAdded }) => {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [data, setData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const list = await merchantAPI.getCategories();
        const normalized = (Array.isArray(list) ? list : [])
          .map((x) => ({
            id: x?.id ?? x?._id ?? x?.categoryId,
            name: x?.name ?? x?.categoryName ?? x?.title,
          }))
          .filter((it) => it.id != null);
        setCategories(normalized);
      } catch (e) {
        // ignore silently
      }
    })();
  }, []);

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData((data) => ({ ...data, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setImageUrl('');
    }
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setImageUrl(url);
    if (url) {
      setImage(null);
      setImagePreview(url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      const formData = new FormData();

      const name = (data.name || '').trim();
      const description = (data.description || '').trim();
      const categoryIdNum = Number(data.category);
      const basePriceNum = Number(data.price);

      if (!image && !imageUrl) throw new Error('Vui lòng chọn hình ảnh hoặc nhập URL');
      if (!name) throw new Error('Vui lòng nhập tên sản phẩm');
      if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0)
        throw new Error('CategoryId phải là số dương');
      if (!Number.isFinite(basePriceNum) || basePriceNum <= 0)
        throw new Error('Giá cơ bản phải là số dương');

      // Handle image from file or URL
      if (image) {
        formData.append('imgFile', image);
      } else if (imageUrl) {
        // For URL, we could either send URL directly or fetch and convert to blob
        // For now, let's fetch and send as file
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          formData.append('imgFile', blob, 'image.jpg');
        } catch (err) {
          throw new Error('Không thể tải ảnh từ URL');
        }
      }

      formData.append('name', name);
      formData.append('description', description);
      formData.append('categoryId', String(categoryIdNum));
      formData.append('basePrice', String(basePriceNum));

      await merchantAPI.createMenuItem(formData);

      if (typeof onDishAdded === 'function') {
        try {
          await onDishAdded();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to refresh menu after adding dish:', err);
        }
      }

      // Reset form
      setImage(null);
      setImagePreview('');
      setImageUrl('');
      setData({ name: '', description: '', category: '', price: '' });

      // Close modal and refresh
      onClose?.(true); // Pass true to indicate success
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Tạo sản phẩm thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setImage(null);
    setImagePreview('');
    setImageUrl('');
    setData({ name: '', description: '', category: '', price: '' });
    onClose?.(false);
  };

  if (!open) return null;

  return (
    <div className="add-dish-modal-overlay" onClick={handleClose}>
      <div className="add-dish-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="add-dish-modal-header">
          <div className="add-dish-modal-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 5V19M5 12H19"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="add-dish-modal-header-text">
            <h2>Thêm món mới</h2>
            <p>Tạo món ăn/đồ uống mới cho menu nhà hàng</p>
          </div>
          <button className="add-dish-modal-close" onClick={handleClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 5L15 15M15 5L5 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-dish-modal-form">
          {/* Image Upload */}
          <div className="add-dish-form-group">
            <label className="add-dish-form-label">Hình ảnh món ăn</label>
            <div className="add-dish-image-upload">
              <label htmlFor="dish-image" className="add-dish-image-label">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="add-dish-image-preview" />
                ) : (
                  <div className="add-dish-image-placeholder">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <rect width="48" height="48" rx="8" fill="#F3F4F6" />
                      <path
                        d="M24 20V28M20 24H28"
                        stroke="#9CA3AF"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Tải ảnh lên</span>
                  </div>
                )}
              </label>
              <input
                type="file"
                id="dish-image"
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
              <div className="add-dish-url-input-wrapper">
                <span className="add-dish-url-label">hoặc nhập URL ảnh</span>
                <input
                  type="url"
                  className="add-dish-url-input"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={handleUrlChange}
                />
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="add-dish-form-group">
            <label className="add-dish-form-label">
              Tên món <span className="required">*</span>
            </label>
            <input
              type="text"
              name="name"
              className="add-dish-form-input"
              placeholder="Vd: Trà sữa trân châu đường đen"
              value={data.name}
              onChange={onChangeHandler}
              required
            />
          </div>

          {/* Category and Price */}
          <div className="add-dish-form-row">
            <div className="add-dish-form-group">
              <label className="add-dish-form-label">
                Danh mục <span className="required">*</span>
              </label>
              <select
                name="category"
                className="add-dish-form-select"
                value={data.category}
                onChange={onChangeHandler}
                required
              >
                <option value="">Chọn danh mục</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="add-dish-form-group">
              <label className="add-dish-form-label">
                Giá <span className="required">*</span>
              </label>
              <div className="add-dish-price-input-wrapper">
                <input
                  type="number"
                  name="price"
                  className="add-dish-form-input"
                  placeholder="50000"
                  value={data.price}
                  onChange={onChangeHandler}
                  min="1"
                  step="1"
                  required
                />
                <span className="add-dish-price-unit">đ</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="add-dish-form-group">
            <label className="add-dish-form-label">Mô tả</label>
            <textarea
              name="description"
              className="add-dish-form-textarea"
              placeholder="Mô tả chi tiết về món ăn..."
              value={data.description}
              onChange={onChangeHandler}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="add-dish-modal-actions">
            <button
              type="button"
              className="add-dish-btn-cancel"
              onClick={handleClose}
              disabled={submitting}
            >
              Hủy
            </button>
            <button type="submit" className="add-dish-btn-submit" disabled={submitting}>
              {submitting ? 'Đang tạo...' : 'Lưu món'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDishModal;
