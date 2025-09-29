
import React, { useEffect, useState } from 'react';
import merchantAPI from '../../api/merchantAPI';
import './List.css';
import { NavLink } from 'react-router-dom';



const List = () => {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);

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

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      setError('');
      try {
        // Chỉ thêm log kiểm tra dữ liệu trả về từ API getMyMerchant
        const merchant = await merchantAPI.getMyMerchant();
        console.log('DEBUG getMyMerchant:', merchant);
        // ...existing logic lấy menu nếu cần...
      } catch (e) {
        setError('Không lấy được thực đơn.');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  return (
    <div className="list-container">
      <div className="list-title-wrapper">
        <h2 className="list-title">Danh sách thực đơn</h2>
      </div>
      {loading && <div className="list-loading">Đang tải...</div>}
      {error && <div className="list-error">{error}</div>}
      {!loading && !error && (
        <table className="list-table">
          <thead>
            <tr>
              <th>Tên món</th>
              <th>Mô tả</th>
              <th>Danh mục</th>
              <th>Giá</th>
            </tr>
          </thead>
          <tbody>
            {menu.map((item, idx) => (
              <tr key={item._id || idx}>
                <td>{item.name}</td>
                <td>{item.description}</td>
                <td>{item.category}</td>
                <td>{item.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
            <NavLink className='add-fab-menu-item' to='/add'>Thêm món ăn</NavLink>
            <NavLink className='add-fab-menu-item' to='/add-option-group'>Thêm option group</NavLink>
          </div>
        )}
      </div>
    </div>
  );
}

export default List;
