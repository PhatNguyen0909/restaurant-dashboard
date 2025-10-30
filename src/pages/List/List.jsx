

import React, { useCallback, useEffect, useRef, useState } from 'react';
import merchantAPI from '../../api/merchantAPI';
import './List.css';
import { food_list } from '../../assets/assets';
import EditDishModal from '../../components/EditDishModal/EditDishModal';
import AddDishModal from '../../components/AddDishModal/AddDishModal';



const List = () => {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [imageCacheBusters, setImageCacheBusters] = useState({});
  const imageCacheBustersRef = useRef(imageCacheBusters);

  useEffect(() => {
    imageCacheBustersRef.current = imageCacheBusters;
  }, [imageCacheBusters]);

  // Xác định có phải tài khoản demo không
  const isDemoUser = (() => {
    const userStr = document.cookie.split('; ').find(row => row.startsWith('user='));
    if (userStr) {
      try {
        const userObj = JSON.parse(decodeURIComponent(userStr.split('=')[1]));
        return userObj.email === 'demo';
      } catch {}
    }
    return false;
  })();

  // Đổi trạng thái món ăn cho tài khoản thường (API)
  const handleToggleStatus = async (item) => {
    const nextIsVisible = item.status !== 'available';
    try {
      await merchantAPI.updateDishStatus(item._id, nextIsVisible);
      setMenu((prevMenu) =>
        prevMenu.map((menuItem) =>
          menuItem._id === item._id ? { ...menuItem, status: nextIsVisible ? 'available' : 'unavailable' } : menuItem
        )
      );
    } catch (error) {
      console.error('Error updating dish status:', error);
    }
  };

  // Đổi trạng thái món ăn cho tài khoản demo (local state)
  const handleToggleStatusDemo = (item) => {
    const newStatus = item.status === 'available' ? 'unavailable' : 'available';
    setMenu((prevMenu) =>
      prevMenu.map((menuItem) =>
        menuItem._id === item._id ? { ...menuItem, status: newStatus } : menuItem
      )
    );
  };

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isDemoUser) {
        const demoMenu = food_list
          .filter(item => item.restaurantId === '1')
          .map((item) => ({ ...item, categoryId: item.categoryId ?? item.category }));
        setMenu(demoMenu);
        return;
      }
      console.log('[List] Fetching menu items...'); // DEBUG
      const data = await merchantAPI.getMenuItems();
      console.log('[List] Raw API response:', data); // DEBUG
      console.log('[List] Is array?', Array.isArray(data)); // DEBUG
      
      const uiItems = (Array.isArray(data) ? data : []).map((it) => {
        const itemId = it?._id ?? it?.id;
        const categoryName = it?.categoryName || it?.category || 'Chưa phân loại';
        const rawImageUrl = it?.imageUrl
          ?? it?.imageURL
          ?? it?.imgUrl
          ?? it?.imgURL
          ?? it?.image
          ?? it?.image_url
          ?? it?.thumbnail
          ?? it?.thumbnailUrl
          ?? it?.thumbnailURL;
        const cacheBuster = itemId != null ? imageCacheBustersRef.current[itemId] : undefined;
        const versionToken = cacheBuster
          ?? it?.imageVersion
          ?? it?.imgVersion
          ?? it?.imageUpdatedAt
          ?? it?.imageUpdated_at
          ?? it?.imageUpdatedTime
          ?? it?.updatedAt
          ?? it?.updated_at
          ?? it?.updatedTime
          ?? it?.lastModified
          ?? it?.modifiedAt
          ?? it?.modified_at
          ?? it?.version;
        const imageWithVersion = (() => {
          if (!rawImageUrl) return rawImageUrl;
          if (versionToken === undefined || versionToken === null || versionToken === '') {
            return rawImageUrl;
          }
          const separator = rawImageUrl.includes('?') ? '&' : '?';
          return `${rawImageUrl}${separator}v=${encodeURIComponent(versionToken)}`;
        })();
        const normalizedStatus = (() => {
          const rawVisible = it?.isVisible ?? it?.is_visible ?? it?.visible;
          if (rawVisible === true) return 'available';
          if (rawVisible === false) return 'unavailable';
          const raw = it?.status ?? it?.state ?? it?.active;
          if (raw === true) return 'available';
          if (raw === false) return 'unavailable';
          const upper = String(raw ?? '').toUpperCase();
          if (upper === 'ACTIVE' || upper === 'AVAILABLE' || upper === 'ON') return 'available';
          if (upper === 'INACTIVE' || upper === 'UNAVAILABLE' || upper === 'OFF') return 'unavailable';
          return 'available';
        })();
        const mapped = {
          _id: itemId,
          name: it?.name,
          image: imageWithVersion,
          price: it?.basePrice ?? it?.price ?? it?.base_price,
          description: it?.description,
          category: categoryName,
          categoryId: it?.categoryId ?? it?.category_id,
          status: normalizedStatus,
        };
        console.log('[List] Mapped item:', mapped); // DEBUG
        return mapped;
      });
      
      console.log('[List] Total mapped items:', uiItems.length); // DEBUG
      const sorted = uiItems.sort((a, b) => (String(a.category || '') > String(b.category || '') ? 1 : -1));
      console.log('[List] Setting menu with', sorted.length, 'items'); // DEBUG
      setMenu(sorted);
    } catch (e) {
      console.error('[List] Error loading menu:', e); // DEBUG
      setError('Không lấy được thực đơn.');
    } finally {
      setLoading(false);
    }
  }, [isDemoUser]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const handleOpenEditModal = (dish) => {
    if (!dish) return;
    setSelectedDish(dish);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedDish(null);
  };

  const handleEditSaved = async (info) => {
    if (isDemoUser) {
      const updatedDish = info?.updatedDish ?? info;
      if (updatedDish?._id) {
        setMenu((prevMenu) => prevMenu.map((item) => (item._id === updatedDish._id ? { ...item, ...updatedDish } : item)));
      }
      return;
    }

    if (info?.cacheVersion && info?.dishId != null) {
      setImageCacheBusters((prev) => {
        const next = { ...prev, [info.dishId]: info.cacheVersion };
        imageCacheBustersRef.current = next;
        return next;
      });
    }

    if (info?.updatedDish?._id) {
      setMenu((prevMenu) => prevMenu.map((item) => (item._id === info.updatedDish._id ? { ...item, ...info.updatedDish } : item)));
    }

    await loadMenu();
  };

  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleDishAdded = async () => {
    await loadMenu();
  };

  return (
    <div className="list-container">
      {/* Header Section */}
      <div className="list-header">
        <div className="list-header-left">
          <h2 className="list-title">List Items</h2>
          <p className="list-subtitle">Quản lý danh sách món ăn và đồ uống</p>
        </div>
        <button className="list-add-btn" onClick={handleOpenAddModal}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Thêm món mới
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div className="list-search-bar">
        <div className="list-search-input-wrapper">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="list-search-icon">
            <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            className="list-search-input"
            placeholder="Tìm kiếm món ăn..."
          />
        </div>
        <button className="list-filter-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 10h10M2.5 5h15M7.5 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Lọc
        </button>
      </div>

      {/* Content */}
      {loading && <div className="list-loading">Đang tải...</div>}
      {error && <div className="list-error">{error}</div>}
      {!loading && !error && (
        <div className="list-items-grid">
          {menu.map((item) => (
            <div className="list-item-card" key={item._id}>
              {/* Toggle Status */}
              <label className="list-item-toggle">
                <input
                  type="checkbox"
                  checked={item.status === 'available'}
                  onChange={() => isDemoUser ? handleToggleStatusDemo(item) : handleToggleStatus(item)}
                />
                <span className="list-item-toggle-slider" />
              </label>

              {/* Three dots menu */}
              <div className="list-item-menu">
                <button className="list-item-menu-btn" onClick={() => handleOpenEditModal(item)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <circle cx="10" cy="4" r="1.5"/>
                    <circle cx="10" cy="10" r="1.5"/>
                    <circle cx="10" cy="16" r="1.5"/>
                  </svg>
                </button>
              </div>

              {/* Image */}
              <div className="list-item-image-wrap">
                <img src={item.image} alt={item.name} className="list-item-image" />
              </div>

              {/* Info */}
              <div className="list-item-info">
                <div className="list-item-category-badge">{item.category}</div>
                <h3 className="list-item-name">{item.name}</h3>
                <p className="list-item-price">{item.price?.toLocaleString?.() || item.price}đ</p>
              </div>

              {/* Edit button */}
              <button className="list-item-edit-btn" onClick={() => handleOpenEditModal(item)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M11.333 2.00004C11.5084 1.82463 11.7163 1.68648 11.9451 1.59347C12.1739 1.50046 12.4191 1.45435 12.6663 1.45435C12.9136 1.45435 13.1588 1.50046 13.3876 1.59347C13.6164 1.68648 13.8243 1.82463 13.9997 2.00004C14.1751 2.17545 14.3132 2.38334 14.4063 2.61213C14.4993 2.84093 14.5454 3.08617 14.5454 3.33337C14.5454 3.58058 14.4993 3.82582 14.4063 4.05461C14.3132 4.28341 14.1751 4.4913 13.9997 4.66671L5.33301 13.3334L1.33301 14.3334L2.33301 10.3334L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Chỉnh sửa
              </button>
            </div>
          ))}
        </div>
      )}
      <EditDishModal
        open={isEditModalOpen && !!selectedDish}
        dish={selectedDish}
        onClose={handleCloseEditModal}
        onSaved={handleEditSaved}
        isDemoUser={isDemoUser}
      />
      <AddDishModal
        open={isAddModalOpen}
        onClose={handleCloseAddModal}
        onDishAdded={handleDishAdded}
      />
    </div>
  );
}

export default List;
