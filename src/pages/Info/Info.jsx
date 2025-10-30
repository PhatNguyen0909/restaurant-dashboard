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

const resolveImageUrl = (merchant) => (
  merchant?.imgUrl
  || merchant?.image
  || merchant?.imageUrl
  || merchant?.logoUrl
  || merchant?.logo
  || ''
);

const Info = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    introduction: '',
    address: '',
    openingHours: {},
    cuisineTypes: [],
    imageFile: null,
    imagePreview: '',
  });
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
            imageFile: null,
            imagePreview: resolveImageUrl(res),
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
  const handleImageChange = (event) => {
    const file = event?.target?.files?.[0];
    setForm((prev) => {
      if (prev.imagePreview && prev.imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(prev.imagePreview);
      }
      if (!file) {
        return {
          ...prev,
          imageFile: null,
          imagePreview: resolveImageUrl(data),
        };
      }
      const preview = URL.createObjectURL(file);
      return {
        ...prev,
        imageFile: file,
        imagePreview: preview,
      };
    });
  };
  useEffect(() => () => {
    if (form.imagePreview && form.imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(form.imagePreview);
    }
  }, [form.imagePreview]);
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
        image: resolveImageUrl(data),
      };
      const desired = {
        introduction: form.introduction,
        address: form.address,
        openingHours: ensureWeeklyOpeningHours(form.openingHours),
        cuisineTypes: Array.isArray(form.cuisineTypes) ? form.cuisineTypes : String(form.cuisineTypes || '').split(',').map(s=>s.trim()).filter(Boolean),
        imageFile: form.imageFile,
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
      if (desired.imageFile) payload.imgFile = desired.imageFile;
      // Nếu không có field nào thay đổi, bỏ qua gọi API
      const hasDataChanges = Object.keys(payload).some((key) => key !== 'imgFile');
      if (!hasDataChanges && !payload.imgFile) { setEditing(false); setSaving(false); return; }

      const requestBody = {
        introduction: desired.introduction ?? current.introduction ?? '',
        address: desired.address ?? current.address ?? '',
        openingHours: desired.openingHours ?? current.openingHours ?? {},
        cuisineTypes: desired.cuisineTypes?.length ? desired.cuisineTypes : (current.cuisineTypes ?? []),
      };
      if (payload.imgFile) {
        requestBody.imgFile = payload.imgFile;
      } else if (current.image) {
        requestBody.imgFile = current.image;
      }

      await merchantAPI.updateMyInfo(requestBody);

      let refreshed = null;
      try {
        refreshed = await merchantAPI.getMyMerchant();
      } catch (fetchErr) {
        // eslint-disable-next-line no-console
        console.error('[Info] Không thể load lại merchant sau khi cập nhật:', fetchErr);
      }

      if (refreshed) {
        setData(refreshed || null);
        setForm({
          introduction: refreshed?.introduction || refreshed?.description || '',
          address: refreshed?.address || '',
          openingHours: ensureWeeklyOpeningHours(refreshed?.openingHours || refreshed?.opening_hours || {}),
          cuisineTypes: Array.isArray(refreshed?.cuisineTypes) ? refreshed.cuisineTypes : (Array.isArray(refreshed?.cuisine_types) ? refreshed.cuisine_types : []),
          imageFile: null,
          imagePreview: resolveImageUrl(refreshed),
        });
      } else {
        setData((prev) => {
          const next = { ...(prev || {}) };
          if (Object.prototype.hasOwnProperty.call(payload, 'introduction')) {
            next.introduction = payload.introduction ?? '';
            next.description = payload.introduction ?? '';
          }
          if (Object.prototype.hasOwnProperty.call(payload, 'address')) {
            next.address = payload.address ?? '';
          }
          if (Object.prototype.hasOwnProperty.call(payload, 'openingHours')) {
            const normalized = ensureWeeklyOpeningHours(payload.openingHours);
            next.openingHours = normalized;
            next.opening_hours = normalized;
          }
          if (Object.prototype.hasOwnProperty.call(payload, 'cuisineTypes')) {
            const cuisine = Array.isArray(payload.cuisineTypes) ? payload.cuisineTypes : [];
            next.cuisineTypes = cuisine;
            next.cuisine_types = cuisine;
          }
          if (payload.imgFile && form.imagePreview) {
            const preview = form.imagePreview;
            next.imgUrl = preview;
            next.image = preview;
            next.imageUrl = preview;
            next.logoUrl = preview;
          }
          return next;
        });
        setForm((prev) => ({
          ...prev,
          imageFile: null,
          imagePreview: payload.imgFile && form.imagePreview ? form.imagePreview : prev.imagePreview,
        }));
      }
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

  if (loading) return <div className="info-page"><div className="loading-state">Đang tải...</div></div>;
  if (error) return <div className="info-page"><div className="error-state">{error}</div></div>;
  if (!data) return <div className="info-page"><div className="empty-state">Không có dữ liệu.</div></div>;

  const name = data.name || data.merchantName || 'Nhà hàng của tôi';
  const phone = data.phone || data.phoneNumber || '';
  const email = data.email || '';
  const introduction = data.introduction || data.description || '';
  const address = data.address || '';
  const imageUrl = resolveImageUrl(data);

  // Map day names to Vietnamese
  const dayNameMap = {
    monday: 'Thứ 2',
    tuesday: 'Thứ 3',
    wednesday: 'Thứ 4',
    thursday: 'Thứ 5',
    friday: 'Thứ 6',
    saturday: 'Thứ 7',
    sunday: 'Chủ nhật'
  };

  return (
    <div className="info-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Merchant Info</h1>
          <p className="page-subtitle">Quản lý thông tin nhà hàng của bạn</p>
        </div>
      </div>

      {/* Merchant Info Card */}
      <div className="info-card">
        <div className="card-header">
          <div className="card-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6H18C19.1046 6 20 6.89543 20 8V16C20 17.1046 19.1046 18 18 18H6C4.89543 18 4 17.1046 4 16V8C4 6.89543 4.89543 6 6 6Z" stroke="white" strokeWidth="2"/>
              <path d="M4 10H20" stroke="white" strokeWidth="2"/>
              <rect x="7" y="13" width="4" height="2" rx="0.5" fill="white"/>
            </svg>
          </div>
          <div className="card-header-text">
            <h3>Thông tin cửa hàng</h3>
            <p>Cập nhật thông tin chung về nhà hàng</p>
          </div>
        </div>

        <div className="info-content">
          {/* Name Field */}
          <div className="info-field">
            <label className="field-label">Tên nhà hàng</label>
            <div className="field-value-box">
              <span className="field-value">{name}</span>
            </div>
          </div>

          {/* Phone and Email Row */}
          <div className="info-field-row">
            <div className="info-field">
              <label className="field-label">Số điện thoại</label>
              <div className="field-value-box">
                <svg className="field-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 2H6L7 5L5.5 6C6.5 8 8 9.5 10 10.5L11 9L14 10L14 12C14 13.1046 13.1046 14 12 14C6.47715 14 2 9.52285 2 4C2 2.89543 2.89543 2 4 2Z" stroke="#9CA3AF" strokeWidth="1.5"/>
                </svg>
                <span className="field-value">{phone || 'Chưa có'}</span>
              </div>
            </div>

            <div className="info-field">
              <label className="field-label">Email</label>
              <div className="field-value-box">
                <svg className="field-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4L8 8L14 4M2 4V12C2 12.5523 2.44772 13 3 13H13C13.5523 13 14 12.5523 14 12V4M2 4C2 3.44772 2.44772 3 3 3H13C13.5523 3 14 3.44772 14 4" stroke="#9CA3AF" strokeWidth="1.5"/>
                </svg>
                <span className="field-value">{email || 'Chưa có'}</span>
              </div>
            </div>
          </div>

          {/* Address Field */}
          <div className="info-field">
            <label className="field-label">Địa chỉ</label>
            <input 
              type="text" 
              className="field-input" 
              value={form.address} 
              onChange={(e)=> setForm(prev=> ({...prev, address: e.target.value}))}
              onFocus={() => !editing && setEditing(true)}
              placeholder="Nhập địa chỉ nhà hàng"
            />
          </div>

          {/* Description Field */}
          <div className="info-field">
            <label className="field-label">Mô tả</label>
            <textarea 
              className="field-textarea" 
              rows={4}
              value={form.introduction} 
              onChange={(e)=> setForm(prev=> ({...prev, introduction: e.target.value}))}
              onFocus={() => !editing && setEditing(true)}
              placeholder="Nhập mô tả về nhà hàng"
            />
          </div>
        </div>
      </div>

      {/* Opening Hours Card */}
      <div className="info-card">
        <div className="card-header card-header-blue">
          <div className="card-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2"/>
              <path d="M12 6V12L16 14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="card-header-text">
            <h3>Giờ mở cửa</h3>
            <p>Cài đặt giờ hoạt động của nhà hàng</p>
          </div>
        </div>

        <div className="info-content">
          <div className="opening-hours-edit">
            {WEEK_ORDER.map((day) => {
              const value = form.openingHours?.[day] ?? '';
              return (
                <div className="opening-hours-row" key={day}>
                  <span className="hours-day">{dayNameMap[day]}</span>
                  <input
                    className="hours-input"
                    value={value}
                    placeholder="08:00 - 22:00"
                    onChange={(e)=> updateOpeningHour(day, e.target.value)}
                    onFocus={() => !editing && setEditing(true)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {editing && (
        <div className="action-buttons">
          <button 
            className="btn-cancel" 
            onClick={()=> {
              setEditing(false);
              setForm({
                introduction: data?.introduction || data?.description || '',
                address: data?.address || '',
                openingHours: ensureWeeklyOpeningHours(data?.openingHours || data?.opening_hours || {}),
                cuisineTypes,
                imageFile: null,
                imagePreview: resolveImageUrl(data),
              });
            }}
          >
            Hủy
          </button>
          <button className="btn-save" onClick={onSave} disabled={saving}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M11 2L14 5M2 14L2 11L10.5 2.5C11.0523 1.94772 11.9477 1.94772 12.5 2.5C13.0523 3.05228 13.0523 3.94772 12.5 4.5L4 13L2 14Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Info;
