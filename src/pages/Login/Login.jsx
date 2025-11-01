import React, { useState } from 'react';
import './Login.css';

import userAPI from '../../api/userAPI';
import { setToken, removeToken } from '../../utils/tokenUtils';
import { NavLink } from 'react-router-dom';
// Hàm xóa cookie
function deleteCookie(name) {
  document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

function setCookie(name, value, days = 7) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Đăng nhập ảo: nếu nhập user là 'demo' và pass là '123', luôn thành công
    if (email === 'demo' && password === '123') {
      setToken('FAKE_TOKEN_DEMO');
      setCookie('user', JSON.stringify({ email: 'demo' }));
      // Demo luôn active
      onLogin?.('demo');
      setLoading(false);
      return;
    }

    try {
      // gọi API login thật
      const res = await userAPI.login({ email: email.trim(), password: password.trim() });
      console.log('Login response:', res); // DEBUG
      console.log('Response keys:', Object.keys(res || {})); // DEBUG
      // Một số backend trả về "tocken" thay vì "token"; thử map linh hoạt
      const token = res?.token || res?.tocken || res?.accessToken || res?.jwt || res?.access_token;
      console.log('Extracted token:', token ? `${token.substring(0, 20)}...` : 'NOT FOUND'); // DEBUG
      if (token) {
        setToken(token);
        console.log('Token saved to localStorage'); // DEBUG
        const userInfo = res?.user || res?.merchant || { email: res?.email || email, fullName: res?.fullName };
        if (userInfo) setCookie('user', JSON.stringify(userInfo));
        onLogin?.(userInfo?.email || email);
      } else {
        console.error('No token found in response:', res); // DEBUG
        setError('Đăng nhập thất bại! Không nhận được token.');
      }
    } catch (err) {
      // Hiển thị thông báo chi tiết nếu có
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Đăng nhập thất bại!';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Đăng Nhập</h2>
        <input
          type="text"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
        <div className='register-prompt'>
          <p>Bạn muốn làm đối tác với chúng tôi?</p>
          <NavLink className="register-link" to="/register">
            Đăng ký ngay
          </NavLink>
          <p style={{ fontSize: '0.85rem', color: '#9CA3AF', marginTop: '8px' }}>
            Demo: demo / 123
          </p>
        </div>
      </form>
    </div>
  );
};

export default Login;
