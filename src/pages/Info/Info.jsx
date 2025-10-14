import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Info.css';
import merchantAPI from '../../api/merchantAPI';
import userAPI from '../../api/userAPI';

// Weekday ordering helper
const WEEK_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const normalizeKey = (k = '') => String(k).toLowerCase();
const ensureWeeklyOpeningHours = (source = {}) => {
  const result = {};
  const entries = Object.entries(source || {});
  WEEK_ORDER.forEach((day) => {
    const matched = entries.find(([key]) => normalizeKey(key) === day);
    const value = matched ? matched[1] : '';
    result[day] = value ?? '';
  });
  return result;
};

const Info = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ introduction: '', address: '', openingHours: {}, cuisineTypes: [] });
  const [cuisineOptions, setCuisineOptions] = useState([]);
  const [cuisineLoading, setCuisineLoading] = useState(false);
  const [cuisineError, setCuisineError] = useState('');
  const [cuisineDropdownOpen, setCuisineDropdownOpen] = useState(false);
  const cuisineDropdownRef = useRef(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await merchantAPI.getMyMerchant();
        if (mounted) {
          setData(res || null);
          const formInit = {
            introduction: res?.introduction || res?.description || '',
            address: res?.address || '',
            openingHours: ensureWeeklyOpeningHours(res?.openingHours || res?.opening_hours || {}),
            cuisineTypes: Array.isArray(res?.cuisineTypes) ? res.cuisineTypes : (Array.isArray(res?.cuisine_types) ? res.cuisine_types : []),
          };
          setForm(formInit);
        }
      } catch (e) {
        if (mounted) setError('Không thể tải thông tin nhà hàng.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setCuisineLoading(true);
        const list = await userAPI.getCuisineTypes();
        if (!mounted) return;
        const normalized = Array.isArray(list)
          ? list.map((item) => (typeof item === 'string' ? item : (item?.name || item?.title || item?.label || item?.value || '')).trim()).filter(Boolean)
          : [];
        setCuisineOptions(Array.from(new Set(normalized)));
        setCuisineError('');
      } catch (e) {
        if (mounted) {
          setCuisineError('Không thể tải danh sách ẩm thực.');
          setCuisineOptions([]);
        }
      } finally {
        if (mounted) setCuisineLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const openingHours = useMemo(() => {
    const map = data?.openingHours || data?.opening_hours || {};
    // Convert entry list and sort by weekday order; keep unknowns last
    const entries = Object.entries(map);
    return entries.sort((a, b) => {
      const ai = WEEK_ORDER.indexOf(normalizeKey(a[0]));
      const bi = WEEK_ORDER.indexOf(normalizeKey(b[0]));
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0]);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [data]);

  const cuisineTypes = useMemo(() => {
    const raw = data?.cuisineTypes || data?.cuisine_types || [];
    if (Array.isArray(raw)) return raw;
    // Backend could return as object/set-like; normalize to array of keys/values
    return Object.values(raw ?? {});
  }, [data]);

  const cuisineSelectOptions = useMemo(() => {
    const base = Array.isArray(cuisineOptions) ? cuisineOptions : [];
    const selected = Array.isArray(form.cuisineTypes) ? form.cuisineTypes : [];
    return Array.from(new Set([...base, ...selected.filter(Boolean)]));
  }, [cuisineOptions, form.cuisineTypes]);

  useEffect(() => {
    if (!cuisineDropdownOpen) return undefined;
    const handler = (event) => {
      if (!cuisineDropdownRef.current) return;
      if (!cuisineDropdownRef.current.contains(event.target)) {
        setCuisineDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
    };
  }, [cuisineDropdownOpen]);

  const updateOpeningHour = (day, value) => {
    const key = normalizeKey(day);
    const normalized = WEEK_ORDER.includes(key) ? key : day;
    setForm(prev => ({
      ...prev,
      openingHours: {
        ...ensureWeeklyOpeningHours(prev.openingHours),
        [normalized]: value,
      },
    }));
  };
  const updatePasswordField = (field) => (event) => {
    const value = event?.target?.value ?? '';
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordMessage((prev) => (prev?.text ? { type: '', text: '' } : prev));
  };
  const onChangePassword = async () => {
    const currentPassword = String(passwordForm.currentPassword || '').trim();
    const newPassword = String(passwordForm.newPassword || '').trim();
    const confirmPassword = String(passwordForm.confirmPassword || '').trim();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Vui lòng nhập đầy đủ các trường bắt buộc.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới và xác nhận mật khẩu không khớp.' });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordMessage({ type: 'error', text: 'Mật khẩu mới phải khác mật khẩu hiện tại.' });
      return;
    }

    setChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      await userAPI.changePassword({ currentPassword, newPassword });
      setPasswordMessage({ type: 'success', text: 'Đổi mật khẩu thành công.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const codeSource = body?.code || body?.errorCode || body?.error_code || body?.message || body?.error;
      const normalizedCode = typeof codeSource === 'string' ? codeSource.toUpperCase() : '';
      const defaultMsg = (body && (body.message || body.error || body.detail || body.title)) || e?.message || 'Đổi mật khẩu thất bại';
      const prettyMsg = normalizedCode.includes('USER_PASSWORD_INVALID_PATTERN')
        ? 'Mật khẩu phải bao gồm 8-20 kí tự, ít nhất 1 chữ hoa, 1 chữ thường 1 số, 1 kí tự đặc biệt'
        : defaultMsg;
      setPasswordMessage({ type: 'error', text: `${prettyMsg}` });
    } finally {
      setChangingPassword(false);
    }
  };
  const onSave = async () => {
    setSaving(true);
    try {
      const current = {
        introduction: data?.introduction || data?.description || '',
        address: data?.address || '',
        openingHours: ensureWeeklyOpeningHours(data?.openingHours || data?.opening_hours || {}),
        cuisineTypes: Array.isArray(data?.cuisineTypes) ? data.cuisineTypes : (Array.isArray(data?.cuisine_types) ? data.cuisine_types : []),
      };
      const desired = {
        introduction: form.introduction,
        address: form.address,
        openingHours: ensureWeeklyOpeningHours(form.openingHours),
        cuisineTypes: Array.isArray(form.cuisineTypes) ? form.cuisineTypes : String(form.cuisineTypes || '').split(',').map(s=>s.trim()).filter(Boolean),
      };

      const missingDays = WEEK_ORDER.filter((day) => !String(desired.openingHours?.[day] ?? '').trim());
      if (missingDays.length > 0) {
        const pretty = missingDays.map((day) => day.charAt(0).toUpperCase() + day.slice(1));
        alert(`Vui lòng nhập thời gian cho các ngày: ${pretty.join(', ')}`);
        return;
      }

      const payload = {};
      if ((current.introduction || '') !== (desired.introduction || '')) payload.introduction = desired.introduction;
      if ((current.address || '') !== (desired.address || '')) payload.address = desired.address;
      const sameOH = JSON.stringify(current.openingHours || {}) === JSON.stringify(desired.openingHours || {});
      if (!sameOH) payload.openingHours = desired.openingHours;
      const sameCuisine = JSON.stringify(current.cuisineTypes || []) === JSON.stringify(desired.cuisineTypes || []);
      if (!sameCuisine) payload.cuisineTypes = desired.cuisineTypes;
      // Nếu không có field nào thay đổi, bỏ qua gọi API
      if (!Object.keys(payload).length) { setEditing(false); setSaving(false); return; }

      const requestBody = {
        introduction: payload.introduction ?? current.introduction ?? '',
        address: payload.address ?? current.address ?? '',
        openingHours: payload.openingHours ?? current.openingHours ?? {},
        cuisineTypes: payload.cuisineTypes ?? current.cuisineTypes ?? [],
      };

      await merchantAPI.updateMyInfo(requestBody);
      // Cập nhật lại data để reflect UI
      setData(prev => ({ ...(prev || {}), ...payload }));
      setEditing(false);
    } catch (e) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      const msg = (body && (body.message || body.error || body.detail || body.title)) || e?.message || 'Lưu thất bại';
      alert(`${msg}${status ? ` (HTTP ${status})` : ''}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="info-page"><div className="card"><p>Đang tải...</p></div></div>;
  if (error) return <div className="info-page"><div className="card error">{error}</div></div>;
  if (!data) return <div className="info-page"><div className="card">Không có dữ liệu.</div></div>;

  const name = data.name || data.merchantName || 'Nhà hàng của tôi';
  const introduction = data.introduction || data.description || '';
  const address = data.address || '';
  const avgRating = data.avgRating ?? data.averageRating ?? data.avg_rating;
  const ratingCount = data.ratingCount ?? data.rating_count ?? 0;

  return (
    <div className="info-page">
      <div className="card">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <h2 className="title" style={{margin:0}}>Thông tin Nhà Hàng</h2>
          {!editing ? (
            <button onClick={()=> setEditing(true)} className="btn-primary">Chỉnh sửa</button>
          ) : (
            <div style={{display:'flex',gap:8}}>
              <button onClick={onSave} disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu'}</button>
              <button onClick={()=> { setEditing(false); setForm({ introduction: data?.introduction || data?.description || '', address: data?.address || '', openingHours: ensureWeeklyOpeningHours(data?.openingHours || data?.opening_hours || {}), cuisineTypes: cuisineTypes }); }}>Hủy</button>
            </div>
          )}
        </div>

        <div className="row">
          <div className="label">Tên</div>
          <div className="value">{name}</div>
        </div>

        {!editing && introduction && (
          <div className="row">
            <div className="label">Giới thiệu</div>
            <div className="value prewrap">{introduction}</div>
          </div>
        )}
        {editing && (
          <div className="row">
            <div className="label">Giới thiệu</div>
            <div className="value"><textarea className="input" rows={4} value={form.introduction} onChange={(e)=> setForm(prev=> ({...prev, introduction: e.target.value}))} /></div>
          </div>
        )}

        {!editing && address && (
          <div className="row">
            <div className="label">Địa chỉ</div>
            <div className="value">{address}</div>
          </div>
        )}
        {editing && (
          <div className="row">
            <div className="label">Địa chỉ</div>
            <div className="value"><input className="input" value={form.address} onChange={(e)=> setForm(prev=> ({...prev, address: e.target.value}))} /></div>
          </div>
        )}

        {!editing && (
          <div className="row">
            <div className="label">Đánh giá</div>
            <div className="value rating">
              {avgRating != null ? Number(avgRating).toFixed(1) : 'Chưa có'}
              <span className="muted">{` (${ratingCount} lượt)`}</span>
            </div>
          </div>
        )}

        {!editing && openingHours?.length > 0 && (
          <div className="row">
            <div className="label">Giờ mở cửa</div>
            <div className="value">
              <div className="hours">
                {openingHours.map(([day, hours]) => (
                  <div className="hours-row" key={day}>
                    <span className="day">{day}</span>
                    <span className="hours-value">{String(hours)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {editing && (
          <div className="row">
            <div className="label">Giờ mở cửa</div>
            <div className="value">
              <div className="hours">
                {WEEK_ORDER.map((day) => {
                  const value = form.openingHours?.[day] ?? '';
                  const label = day.charAt(0).toUpperCase() + day.slice(1);
                  return (
                    <div className="hours-row" key={day}>
                      <span className="day" style={{textTransform:'capitalize'}}>{label}</span>
                      <input
                        className="input"
                        value={value}
                        placeholder="Ví dụ: 08:00-21:00"
                        onChange={(e)=> updateOpeningHour(day, e.target.value)}
                        style={{minWidth:180}}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="muted" style={{marginTop:8}}>Vui lòng nhập thời gian cho đầy đủ các ngày trong tuần.</div>
            </div>
          </div>
        )}

        {!editing && cuisineTypes?.length > 0 && (
          <div className="row">
            <div className="label">Ẩm thực</div>
            <div className="value">
              <div className="chips">
                {cuisineTypes.map((c) => (
                  <span className="chip" key={String(c)}>{String(c)}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        {editing && (
          <div className="row">
            <div className="label">Ẩm thực</div>
            <div className="value">
              <div className="multi-select" ref={cuisineDropdownRef}>
                <button
                  type="button"
                  className="input multi-select-toggle"
                  onClick={()=> setCuisineDropdownOpen(prev => !prev)}
                >
                  {Array.isArray(form.cuisineTypes) && form.cuisineTypes.length
                    ? form.cuisineTypes.join(', ')
                    : 'Chọn ẩm thực'}
                  <span className={`multi-select-caret ${cuisineDropdownOpen ? 'open' : ''}`}>▾</span>
                </button>
                {cuisineDropdownOpen && (
                  <div className="multi-select-dropdown">
                    {cuisineLoading ? (
                      <div className="muted">Đang tải ẩm thực...</div>
                    ) : cuisineError ? (
                      <div className="error-text">{cuisineError}</div>
                    ) : cuisineSelectOptions.length ? (
                      cuisineSelectOptions.map((opt) => {
                        const checked = Array.isArray(form.cuisineTypes) ? form.cuisineTypes.includes(opt) : false;
                        return (
                          <label key={opt} className="multi-select-option">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e)=> {
                                setForm(prev => {
                                  const current = Array.isArray(prev.cuisineTypes) ? [...prev.cuisineTypes] : [];
                                  if (e.target.checked) {
                                    if (!current.includes(opt)) current.push(opt);
                                  } else {
                                    const idx = current.indexOf(opt);
                                    if (idx !== -1) current.splice(idx, 1);
                                  }
                                  return { ...prev, cuisineTypes: current };
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })
                    ) : (
                      <div className="muted">Không có dữ liệu ẩm thực.</div>
                    )}
                    <div className="multi-select-actions">
                      <button type="button" className="btn-outline" onClick={()=> setCuisineDropdownOpen(false)}>Xong</button>
                      {Array.isArray(form.cuisineTypes) && form.cuisineTypes.length > 0 && (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={()=> {
                            setForm(prev => ({ ...prev, cuisineTypes: [] }));
                          }}
                        >Bỏ chọn</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="aog-hint">Chọn nhiều mục bằng checkbox.</div>
            </div>
          </div>
        )}
      </div>
      <div className="card password-card">
        <h2 className="title" style={{marginBottom:12}}>Đổi mật khẩu</h2>
        <div className="row">
          <div className="label">Mật khẩu hiện tại</div>
          <div className="value">
            <input
              type="password"
              autoComplete="current-password"
              className="input"
              value={passwordForm.currentPassword}
              onChange={updatePasswordField('currentPassword')}
              placeholder="Nhập mật khẩu hiện tại"
            />
          </div>
        </div>
        <div className="row">
          <div className="label">Mật khẩu mới</div>
          <div className="value">
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              value={passwordForm.newPassword}
              onChange={updatePasswordField('newPassword')}
              placeholder="Ít nhất 8 ký tự"
            />
          </div>
        </div>
        <div className="row">
          <div className="label">Xác nhận mật khẩu</div>
          <div className="value">
            <input
              type="password"
              autoComplete="new-password"
              className="input"
              value={passwordForm.confirmPassword}
              onChange={updatePasswordField('confirmPassword')}
              placeholder="Nhập lại mật khẩu mới"
            />
          </div>
        </div>
        {passwordMessage.text && (
          <div className={`password-feedback ${passwordMessage.type === 'success' ? 'success' : 'error'}`}>
            {passwordMessage.text}
          </div>
        )}
        <div className="password-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={onChangePassword}
            disabled={changingPassword}
          >
            {changingPassword ? 'Đang đổi...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Info;
