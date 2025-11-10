

import React, { useCallback, useEffect, useRef, useState } from 'react';
import merchantAPI from '../../api/merchantAPI';
import './List.css';
import { food_list } from '../../assets/assets';
import EditDishModal from '../../components/EditDishModal/EditDishModal';
import AddDishModal from '../../components/AddDishModal/AddDishModal';



const List = () => {
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [imageCacheBusters, setImageCacheBusters] = useState({});
  const imageCacheBustersRef = useRef(imageCacheBusters);
  const [deletingItemId, setDeletingItemId] = useState(null);

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
        // Load demo categories
        const demoCategories = [...new Set(demoMenu.map(item => item.category))].map((name, idx) => ({
          id: idx + 1,
          name: name || 'Chưa phân loại'
        }));
        setCategories(demoCategories);
        return;
      }
      
      // Load categories first
      console.log('[List] Fetching categories...'); // DEBUG
      const categoriesData = await merchantAPI.getCategories();
      console.log('[List] Categories response:', categoriesData); // DEBUG
      const normalizedCategories = (Array.isArray(categoriesData) ? categoriesData : []).map((cat) => ({
        id: cat?.id ?? cat?._id ?? cat?.categoryId,
        name: cat?.name ?? cat?.categoryName ?? cat?.title ?? 'Chưa phân loại',
      }));
      setCategories(normalizedCategories);
      
      console.log('[List] Fetching menu items...'); // DEBUG
      const data = await merchantAPI.getMenuItems();
      console.log('[List] Raw API response:', data); // DEBUG
      console.log('[List] Is array?', Array.isArray(data)); // DEBUG
      
      const uiItems = (Array.isArray(data) ? data : []).map((it) => {
        const itemId = it?._id ?? it?.id;
        // Handle category - can be object or string
        const categoryObj = it?.category;
        const categoryName = (() => {
          if (categoryObj && typeof categoryObj === 'object') {
            return categoryObj.name || categoryObj.categoryName || categoryObj.title || 'Chưa phân loại';
          }
          return it?.categoryName || categoryObj || 'Chưa phân loại';
        })();
        const categoryId = (() => {
          if (categoryObj && typeof categoryObj === 'object') {
            return categoryObj.id || categoryObj._id || categoryObj.categoryId;
          }
          return it?.categoryId ?? it?.category_id;
        })();
        const rawImageUrl = it?.imgUrl
          ?? it?.imageUrl
          ?? it?.imageURL
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
          categoryId: categoryId,
          status: normalizedStatus,
        };
        console.log('[List] Mapped item:', mapped); // DEBUG
        return mapped;
      });
      
      console.log('[List] Total mapped items:', uiItems.length); // DEBUG
      console.log('[List] Setting menu with', uiItems.length, 'items'); // DEBUG
      setMenu(uiItems);
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

  // Xóa món ăn
  const handleDeleteDish = async (item) => {
    if (!item || !item._id) return;

    const confirmMessage = `Bạn có chắc chắn muốn xóa món "${item.name}"?\nHành động này không thể hoàn tác.`;
    if (!window.confirm(confirmMessage)) return;

    setDeletingItemId(item._id);
    
    try {
      if (isDemoUser) {
        // Demo mode: just remove from local state
        setMenu((prevMenu) => prevMenu.filter((menuItem) => menuItem._id !== item._id));
        alert('Đã xóa món ăn (demo mode)');
      } else {
        // Real mode: call API
        await merchantAPI.deleteMenuItem(item._id);
        setMenu((prevMenu) => prevMenu.filter((menuItem) => menuItem._id !== item._id));
        alert('Đã xóa món ăn thành công');
      }
    } catch (error) {
      console.error('Error deleting dish:', error);
      alert(error?.response?.data?.message || error?.message || 'Không thể xóa món ăn. Vui lòng thử lại.');
    } finally {
      setDeletingItemId(null);
    }
  };

  // Group menu items by category
  const groupedMenu = React.useMemo(() => {
    const grouped = {};
    
    menu.forEach((item) => {
      // Use categoryId as key, fallback to category name, then 'uncategorized'
      const categoryKey = item.categoryId 
        ? String(item.categoryId) 
        : (item.category || 'uncategorized');
      
      if (!grouped[categoryKey]) {
        grouped[categoryKey] = {
          categoryId: item.categoryId,
          categoryName: item.category || 'Chưa phân loại',
          items: [],
        };
      }
      grouped[categoryKey].items.push(item);
    });
    
    // Sort by category name (Vietnamese)
    return Object.values(grouped).sort((a, b) => 
      a.categoryName.localeCompare(b.categoryName, 'vi')
    );
  }, [menu]);

  const totalItems = menu.length;
  const totalCategories = groupedMenu.length;

  return (
    <div className="list-container">
      {/* Header Section */}
      <div className="list-header">
        <div className="list-header-left">
          <h2 className="list-title">List Items</h2>
          <p className="list-subtitle">
            {loading ? 'Đang tải...' : `${totalItems} món ăn trong ${totalCategories} danh mục`}
          </p>
        </div>
        <button className="list-add-btn" onClick={handleOpenAddModal}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Thêm món mới
        </button>
      </div>

      {/* Quick Stats */}
      {!loading && !error && totalItems > 0 && (
        <div className="list-quick-stats">
          <div className="list-stat-card">
            <div className="list-stat-icon list-stat-icon-primary">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="list-stat-content">
              <p className="list-stat-label">Tổng món ăn</p>
              <h3 className="list-stat-value">{totalItems}</h3>
            </div>
          </div>
          
          <div className="list-stat-card">
            <div className="list-stat-icon list-stat-icon-success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="list-stat-content">
              <p className="list-stat-label">Đang bán</p>
              <h3 className="list-stat-value">{menu.filter(item => item.status === 'available').length}</h3>
            </div>
          </div>
          
          <div className="list-stat-card">
            <div className="list-stat-icon list-stat-icon-warning">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="list-stat-content">
              <p className="list-stat-label">Tạm ngưng</p>
              <h3 className="list-stat-value">{menu.filter(item => item.status === 'unavailable').length}</h3>
            </div>
          </div>
          
          <div className="list-stat-card">
            <div className="list-stat-icon list-stat-icon-info">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="list-stat-content">
              <p className="list-stat-label">Danh mục</p>
              <h3 className="list-stat-value">{totalCategories}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading && <div className="list-loading">Đang tải...</div>}
      {error && <div className="list-error">{error}</div>}
      {!loading && !error && (
        <>
          {groupedMenu.length === 0 ? (
            <div className="list-empty-state">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="#F3F4F6"/>
                <path d="M32 20v24M20 32h24" stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <h3>Chưa có món ăn nào</h3>
              <p>Bắt đầu thêm món ăn vào thực đơn của bạn</p>
              <button className="list-add-btn" onClick={handleOpenAddModal}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Thêm món mới
              </button>
            </div>
          ) : (
            <div className="list-categories-wrapper">
              {groupedMenu.map((group, groupIndex) => (
                <div key={group.categoryId || groupIndex} className="list-category-section">
                  {/* Category Header */}
                  <div className="list-category-header">
                    <h3 className="list-category-title">{group.categoryName}</h3>
                    <span className="list-category-count">{group.items.length} món</span>
                  </div>
                  
                  {/* Items Grid */}
                  <div className="list-items-grid">
                {group.items.map((item) => {
                  const isDeleting = deletingItemId === item._id;
                  return (
                  <div className="list-item-card" key={item._id} style={{ opacity: isDeleting ? 0.5 : 1 }}>
                    {/* Toggle Status */}
                    <label className="list-item-toggle">
                      <input
                        type="checkbox"
                        checked={item.status === 'available'}
                        onChange={() => isDemoUser ? handleToggleStatusDemo(item) : handleToggleStatus(item)}
                        disabled={isDeleting}
                      />
                      <span className="list-item-toggle-slider" />
                    </label>

                    {/* Three dots menu */}
                    <div className="list-item-menu">
                      <button className="list-item-menu-btn" onClick={() => handleOpenEditModal(item)} disabled={isDeleting}>
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

                    {/* Action buttons */}
                    <div className="list-item-actions">
                      <button 
                        className="list-item-edit-btn" 
                        onClick={() => handleOpenEditModal(item)}
                        disabled={isDeleting}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M11.333 2.00004C11.5084 1.82463 11.7163 1.68648 11.9451 1.59347C12.1739 1.50046 12.4191 1.45435 12.6663 1.45435C12.9136 1.45435 13.1588 1.50046 13.3876 1.59347C13.6164 1.68648 13.8243 1.82463 13.9997 2.00004C14.1751 2.17545 14.3132 2.38334 14.4063 2.61213C14.4993 2.84093 14.5454 3.08617 14.5454 3.33337C14.5454 3.58058 14.4993 3.82582 14.4063 4.05461C14.3132 4.28341 14.1751 4.4913 13.9997 4.66671L5.33301 13.3334L1.33301 14.3334L2.33301 10.3334L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Chỉnh sửa
                      </button>
                      <button 
                        className="list-item-delete-btn" 
                        onClick={() => handleDeleteDish(item)}
                        disabled={isDeleting}
                        title="Xóa món ăn"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {isDeleting ? 'Đang xóa...' : 'Xóa'}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
          )}
        </>
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
