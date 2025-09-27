import React, { useState } from 'react';
import './Login.css';
import UserAPI from '../../api/userAPI';

const Login = ({ onLogin }) => {
  const [restaurantId, setRestaurantId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError("");

  try {
    // gọi API login
    const res = await userAPI.login({
      restaurantId,
      password,
    });

    if (res?.token) {
      localStorage.setItem("token", res.token);
      onLogin?.(restaurantId); // gọi callback nếu có
    } else {
      setError("Đăng nhập thất bại!");
    }
  } catch (err) {
    console.error("Login error:", err);
    setError("Đăng nhập thất bại!");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Đăng nhập Nhà Hàng</h2>
        <input
          type="text"
          placeholder="Mã nhà hàng"
          value={restaurantId}
          onChange={e => setRestaurantId(e.target.value)}
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
      </form>
    </div>
  );
};

export default Login;
