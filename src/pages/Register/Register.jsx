import React, { useEffect, useMemo, useState } from 'react';
import userAPI from '../../api/userAPI';
import './Register.css';
import { NavLink } from 'react-router-dom';

const Register = () => {
  const [form, setForm] = useState({
    email: '',
    fullName: '',
    address: '',
    merchantName: '',
    cuisineTypes: [],
  });
  const [allCuisineTypes, setAllCuisineTypes] = useState([]);
  const [openCuisine, setOpenCuisine] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await userAPI.getCuisineTypes();
        if (!alive) return;
        // Chuẩn hoá dữ liệu thành { id, name }
        const normalized = (list || []).map((item, idx) => ({
          id: item?.id ?? item?._id ?? item?.code ?? idx,
          name: item?.name ?? item?.title ?? item?.cuisine ?? String(item),
        }));
        setAllCuisineTypes(normalized);
      } catch {}
    })();
    return () => { alive = false };
  }, []);

  const selectedCuisineNames = useMemo(() => new Set(form.cuisineTypes || []), [form.cuisineTypes]);

  // Lưu theo tên (string) để khớp yêu cầu backend
  const toggleCuisine = (name) => {
    setForm((prev) => {
      const set = new Set(prev.cuisineTypes || []);
      if (set.has(name)) set.delete(name); else set.add(name);
      return { ...prev, cuisineTypes: Array.from(set) };
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await userAPI.register({
        email: form.email,
        fullName: form.fullName,
        address: form.address,
        merchantName: form.merchantName,
        cuisineTypes: form.cuisineTypes,
      });
      if (res) {
        setSuccess('Đăng ký thành công!');
        setForm({ email: '', fullName: '', address: '', merchantName: '', cuisineTypes: [] });
      } else {
        setError('Đăng ký thất bại!');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Đăng ký thất bại!';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Đăng Ký Nhà Hàng</h2>
        <input 
          name="merchantName" 
          value={form.merchantName} 
          onChange={onChange} 
          placeholder="Tên nhà hàng" 
          required 
        />
        <input 
          name="fullName" 
          value={form.fullName} 
          onChange={onChange} 
          placeholder="Tên chủ nhà hàng" 
          required 
        />
        <input 
          name="address" 
          value={form.address} 
          onChange={onChange} 
          placeholder="Địa chỉ" 
          required 
        />
        
        {/* Dropdown chọn nhiều cuisine types */}
        <div className="cuisine-select">
          <button type="button" className="dropdown-toggle" onClick={() => setOpenCuisine((v) => !v)}>
            {form.cuisineTypes?.length
              ? (form.cuisineTypes.length <= 3
                  ? form.cuisineTypes.join(', ')
                  : `Đã chọn ${form.cuisineTypes.length} loại ẩm thực`)
              : 'Chọn loại ẩm thực'}
          </button>
          {openCuisine && (
            <div className="dropdown-menu">
              {allCuisineTypes?.length === 0 && (
                <div className="dropdown-empty">Đang tải danh sách...</div>
              )}
              {allCuisineTypes?.map((c) => (
                <label key={c.id ?? c.name} className="dropdown-item">
                  <input
                    type="checkbox"
                    checked={selectedCuisineNames.has(c.name)}
                    onChange={() => toggleCuisine(c.name)}
                  />
                  <span>{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        
        <input 
          name="email" 
          value={form.email} 
          onChange={onChange} 
          placeholder="Email" 
          type="email" 
          required 
        />
        
        {error && <div className="register-error">{error}</div>}
        {success && <div className="register-success">{success}</div>}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Đang đăng ký...' : 'Đăng ký'}
        </button>
        
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#6B7280' }}>
            Đã có tài khoản? <NavLink className="login-link" to="/login">Đăng nhập ngay</NavLink>
          </p>
        </div>
      </form>
    </div>
  );
};

export default Register;
