import React, { useState } from 'react';
import userAPI from '../../api/userAPI';
import './Register.css';
import { NavLink } from 'react-router-dom';

const Register = () => {
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullname: '',
    phone: '',
    merchantName: '',
    cuisineTypes: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await userAPI.register({
        email: form.email,
        password: form.password,
        fullname: form.fullname,
        phone: form.phone,
        merchantName: form.merchantName,
        cuisineTypes: form.cuisineTypes,
      });
      if (res) {
        setSuccess('Đăng ký thành công! Vui lòng đăng nhập.');
        setForm({ email: '', password: '', fullname: '', phone: '', merchantName: '', cuisineTypes: '' });
      } else {
        setError('Đăng ký thất bại!');
      }
    } catch (err) {
      setError('Đăng ký thất bại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Đăng ký tài khoản nhà hàng</h2>
        <input name="merchantName" value={form.merchantName} onChange={onChange} placeholder="Tên nhà hàng" required />
        <input name="fullname" value={form.fullname} onChange={onChange} placeholder="Tên chủ nhà hàng" required />
        <input name="phone" value={form.phone} onChange={onChange} placeholder="Số điện thoại" required />
        <input name="cuisineTypes" value={form.cuisineTypes} onChange={onChange} placeholder="Loại ẩm thực (phở, cơm, pizza...)" required />
        <input name="email" value={form.email} onChange={onChange} placeholder="Email" type="email" required />
        <input name="password" value={form.password} onChange={onChange} placeholder="Mật khẩu" type="password" required />
        {error && <div className="register-error">{error}</div>}
        {success && <div className="register-success">{success}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Đang đăng ký...' : 'Đăng ký'}</button>
        <div>
            <p>Bạn đã có tài khoản? <NavLink className="login-link" to="/login">Đăng nhập ở đây</NavLink></p>
        </div>
      </form>
    </div>
  );
};

export default Register;
