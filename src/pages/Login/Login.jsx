import React, { useState } from 'react';
import './Login.css';
import userAPI from '../../api/userAPI';
import { setToken } from '../../utils/tokenUtils';

const Login = ({ onLogin }) => {
  const [restaurantId, setRestaurantId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Đăng nhập ảo: nếu nhập user là 'demo' và pass là '123', luôn thành công
    if (restaurantId === 'demo' && password === '123') {
      setToken('FAKE_TOKEN_DEMO');
      onLogin?.('demo');
      setLoading(false);
      return;
    }

    try {
      // gọi API login thật
      const res = await userAPI.login({ restaurantId, password });
      if (res?.token) {
        setToken(res.token);
        onLogin?.(restaurantId);
      } else {
        setError('Đăng nhập thất bại!');
      }
    } catch (err) {
      setError('Đăng nhập thất bại!');
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
          placeholder="Email"
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
        <div style={{fontSize:'0.95em',color:'#888',marginTop:8}}>Tài khoản ảo: demo / 123</div>
      </form>
    </div>
  );
};

export default Login;
