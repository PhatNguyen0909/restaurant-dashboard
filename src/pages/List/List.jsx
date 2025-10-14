

import React, { useCallback, useEffect, useState } from 'react';
import merchantAPI from '../../api/merchantAPI';
import './List.css';
import { NavLink } from 'react-router-dom';
import { food_list, assets } from '../../assets/assets';
import OptionGroupsTab from '../OptionGroupsTab/OptionGroupsTab';
import EditDishModal from '../../components/EditDishModal/EditDishModal';



const List = () => {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  // State cho mở/đóng từng category
  const [openCategories, setOpenCategories] = useState({});
  const [activeTab, setActiveTab] = useState('foods'); // 'foods' | 'groups'
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDish, setSelectedDish] = useState(null);

  const handleToggleCategory = (cat) => {
    setOpenCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

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
    const newStatus = item.status === 'available' ? 'unavailable' : 'available';
    try {
      await merchantAPI.updateDishStatus(item._id, newStatus);
      setMenu((prevMenu) =>
        prevMenu.map((menuItem) =>
          menuItem._id === item._id ? { ...menuItem, status: newStatus } : menuItem
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
  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e) {
      const fab = document.getElementById('fab-menu-wrapper');
      if (fab && !fab.contains(e.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

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
      const data = await merchantAPI.getMenuItems();
      const uiItems = (Array.isArray(data) ? data : []).map((it) => ({
        _id: it?._id ?? it?.id,
        name: it?.name,
        image: it?.imgUrl || it?.image || it?.imgURL,
        price: it?.basePrice ?? it?.price,
        description: it?.description,
        category: it?.categoryName || it?.category,
        categoryId: it?.categoryId ?? it?.category_id,
        status: (it?.status === 'ACTIVE' || it?.status === 'available') ? 'available' : 'unavailable',
      }));
      const sorted = uiItems.sort((a, b) => (String(a.category || '') > String(b.category || '') ? 1 : -1));
      setMenu(sorted);
    } catch (e) {
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
    setShowMenu(false);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedDish(null);
  };

  const handleEditSaved = async (updatedDish) => {
    if (isDemoUser && updatedDish?._id) {
      setMenu((prevMenu) => prevMenu.map((item) => (item._id === updatedDish._id ? { ...item, ...updatedDish } : item)));
      return;
    }
    await loadMenu();
  };

  const handleFabEditClick = () => {
    if (!menu.length) return;
    handleOpenEditModal(menu[0]);
  };

  // Gom nhóm món ăn theo category
  const groupedMenu = menu.reduce((acc, item) => {
    if (!item.category) return acc;
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="list-container">
      <div className="list-title-wrapper">
        <h2 className="list-title">Danh sách thực đơn</h2>
      </div>
      <div className="list-tabs">
        <button className={`list-tab ${activeTab==='foods'?'active':''}`} onClick={()=> setActiveTab('foods')}>Món ăn</button>
        <button className={`list-tab ${activeTab==='groups'?'active':''}`} onClick={()=> setActiveTab('groups')}>Tùy chọn nhóm</button>
      </div>
      {activeTab === 'foods' && (
        <>
          {loading && <div className="list-loading">Đang tải...</div>}
          {error && <div className="list-error">{error}</div>}
          {!loading && !error && (
            <div className="list-grouped-menu">
              {Object.keys(groupedMenu).map((cat) => {
                const isOpen = openCategories[cat] !== false; // mặc định mở
                return (
                  <div className={`menu-category-block${!isOpen ? ' closed' : ''}`} key={cat}>
                    <div className="menu-category-title menu-category-toggle" onClick={() => handleToggleCategory(cat)}>
                      <span className="menu-category-name">{cat}</span>
                      <img
                        src={isOpen ? assets.up : assets.down}
                        alt={isOpen ? 'Thu gọn' : 'Mở rộng'}
                        className="menu-category-icon"
                      />
                    </div>
                    <div className="menu-items-row">
                      {isOpen && groupedMenu[cat].map((item) => (
                        <div className="food-card" key={item._id}>
                          <div className="food-card-status-toggle">
                            <label className="status-toggle">
                              <input
                                type="checkbox"
                                checked={item.status === 'available'}
                                onChange={() => isDemoUser ? handleToggleStatusDemo(item) : handleToggleStatus(item)}
                              />
                              <span className="status-toggle-slider" />
                            </label>
                            <span className="status-toggle-text">{item.status === 'available' ? '' : ''}</span>
                          </div>
                          <div className="food-card-img-wrap">
                            <img src={item.image} alt={item.name} className="food-card-img" />
                          </div>
                          <div className="food-card-info">
                            <div className="food-card-name">{item.name}</div>
                            <div className="food-card-price">{item.price?.toLocaleString?.() || item.price}đ</div>
                            <div className="food-card-desc">{item.description}</div>
                            <button
                              type="button"
                              className="food-card-manage"
                              onClick={() => handleOpenEditModal(item)}
                            >
                              Chỉnh sửa
                            </button>
                            {/* Nút Quản lý đã bỏ theo yêu cầu */}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
      {activeTab === 'groups' && (
        <OptionGroupsTab />
      )}
      {/* Floating Add Button with Hover Menu - wrapper ensures menu stays open when moving between button and menu */}
      <div
        id="fab-menu-wrapper"
        style={{ position: 'fixed', zIndex: 120, right: 24, bottom: 24 }}
      >
        <div
          className='btn-add-option'
          style={{ zIndex: 121 }}
          onClick={() => setShowMenu((v) => !v)}
        >
          +
        </div>
        {showMenu && (
          <div className='add-fab-menu' style={{ zIndex: 120, pointerEvents: 'auto' }}>
            {activeTab === 'foods' ? (
              <>
                <button type='button' className='add-fab-menu-item' onClick={handleFabEditClick}>Chỉnh sửa món ăn</button>
                <NavLink className='add-fab-menu-item' to='/add'>Tạo món ăn</NavLink>
              </>
            ) : (
              <>
                <NavLink className='add-fab-menu-item' to='/add-option-group#manage'>Chỉnh sửa nhóm</NavLink>
                <NavLink className='add-fab-menu-item' to='/add-option-group#create'>Thêm tuỳ chọn</NavLink>
              </>
            )}
          </div>
        )}
      </div>
      <EditDishModal
        open={isEditModalOpen && !!selectedDish}
        dish={selectedDish}
        onClose={handleCloseEditModal}
        onSaved={handleEditSaved}
        isDemoUser={isDemoUser}
      />
    </div>
  );
}

export default List;
