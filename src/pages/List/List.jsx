
import React, { useEffect, useState } from 'react';
import merchantAPI from '../../api/merchantAPI';
import './List.css';

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

const List = () => {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMenu = async () => {
      setLoading(true);
      setError('');
      try {
        const restaurantId = getCookie('restaurantId');
        if (!restaurantId) {
          setError('Không tìm thấy id nhà hàng.');
          setLoading(false);
          return;
        }
        const data = await merchantAPI.getMenuByRestaurant(restaurantId);
        // Sắp xếp theo category (tăng dần)
        const sorted = [...(data || [])].sort((a, b) => (a.category > b.category ? 1 : -1));
        setMenu(sorted);
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
    </div>
  );
}

export default List;
