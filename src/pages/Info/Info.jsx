import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Info.css';
import merchantAPI from '../../api/merchantAPI';
import userAPI from '../../api/userAPI';

// Weekday helpers and transformers
const WEEK_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const JS_DAY_TO_WEEK_ORDER = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DAY_LABELS = {
  monday: 'Thứ 2',
  tuesday: 'Thứ 3',
  wednesday: 'Thứ 4',
  thursday: 'Thứ 5',
  friday: 'Thứ 6',
  saturday: 'Thứ 7',
  sunday: 'Chủ nhật',
};

const stripDiacritics = (value = '') => {
  try {
    return String(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  } catch {
    return String(value);
  }
};

const normalizeWeekdayToken = (value = '') => (
  stripDiacritics(String(value).toLowerCase()).replace(/[^a-z0-9]/g, '')
);

const DAY_KEY_ALIASES = {
  monday: ['monday', 'mon', 'thu2', 'thuhai', 't2'],
  tuesday: ['tuesday', 'tue', 'thu3', 'thuba', 't3'],
  wednesday: ['wednesday', 'wed', 'thu4', 'thutu', 't4'],
  thursday: ['thursday', 'thu5', 'thunam', 't5'],
  friday: ['friday', 'fri', 'thu6', 'thusau', 't6'],
  saturday: ['saturday', 'sat', 'thu7', 'thubay', 't7'],
  sunday: ['sunday', 'sun', 'chunhat', 'chunhat', 'cn'],
};

const resolveWeekdayKey = (value) => {
  const normalized = normalizeWeekdayToken(value);
  if (!normalized) return null;
  return WEEK_ORDER.find((day) => DAY_KEY_ALIASES[day].includes(normalized)) || null;
};

const ensureWeeklyOpeningHours = (source = {}) => {
  const normalized = {};
  if (source && typeof source === 'object') {
    Object.entries(source).forEach(([rawKey, rawValue]) => {
      const dayKey = resolveWeekdayKey(rawKey) || (WEEK_ORDER.includes(rawKey) ? rawKey : null);
      if (dayKey && normalized[dayKey] === undefined) {
        normalized[dayKey] = rawValue ?? '';
      }
    });
  }

  const result = {};
  WEEK_ORDER.forEach((day) => {
    const value = normalized[day];
    result[day] = value == null ? '' : value;
  });
  return result;
};

const parseTimeToMinutes = (value) => {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  let minutes = match[2] ? Number(match[2]) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  hours = Math.max(0, Math.min(23, hours));
  minutes = Math.max(0, Math.min(59, minutes));
  return (hours * 60) + minutes;
};

const parseDailyTimeRange = (value) => {
  if (!value) return null;
  const timeMatches = value.match(/(\d{1,2}:\d{2})/g);
  let start; let end;
  if (timeMatches && timeMatches.length >= 2) {
    [start, end] = timeMatches;
  } else {
    const parts = value.split(/-|–|đến|to/i).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      [start, end] = parts;
    }
  }
  if (!start || !end) return null;
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes == null || endMinutes == null) return null;
  return {
    start: startMinutes,
    end: endMinutes,
    overnight: endMinutes <= startMinutes,
  };
};

const isTimeWithinRange = (range, now) => {
  if (!range) return false;
  const minutes = (now.getHours() * 60) + now.getMinutes();
  if (!range.overnight) {
    return minutes >= range.start && minutes <= range.end;
  }
  return minutes >= range.start || minutes <= range.end;
};

const interpretBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'open'].includes(normalized)) return true;
    if (['false', '0', 'no', 'closed', 'close'].includes(normalized)) return false;
  }
  return null;
};

const evaluateScheduleOpenStatus = (openingHoursMap, referenceDate = new Date()) => {
  if (!openingHoursMap || typeof openingHoursMap !== 'object') return null;
  const normalized = ensureWeeklyOpeningHours(openingHoursMap);
  const dayKey = JS_DAY_TO_WEEK_ORDER[referenceDate.getDay()] || 'monday';
  const value = normalized[dayKey];
  if (!value) return null;
  const range = parseDailyTimeRange(value);
  if (!range) return null;
  return isTimeWithinRange(range, referenceDate);
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
  const [showOpeningHoursModal, setShowOpeningHoursModal] = useState(false);
  const [manualOpen, setManualOpen] = useState(null);
  const [openStatusUpdating, setOpenStatusUpdating] = useState(false);
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const [autoSyncing, setAutoSyncing] = useState(false);

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

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTick(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const openingHours = useMemo(() => {
    const map = data?.openingHours || data?.opening_hours || {};
    const entries = Object.entries(map);
    return entries.sort((a, b) => {
      const aKey = resolveWeekdayKey(a[0]);
      const bKey = resolveWeekdayKey(b[0]);
      const ai = aKey ? WEEK_ORDER.indexOf(aKey) : Number.POSITIVE_INFINITY;
      const bi = bKey ? WEEK_ORDER.indexOf(bKey) : Number.POSITIVE_INFINITY;
      if (ai === bi) {
        return String(a[0]).localeCompare(String(b[0]));
      }
      return ai - bi;
    });
  }, [data]);

  const scheduledOpen = useMemo(() => {
    if (!data) return null;
    return evaluateScheduleOpenStatus(data.openingHours || data.opening_hours, new Date(timeTick));
  }, [data, timeTick]);

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

  const serverOpen = interpretBoolean(data?.open);
  const effectiveOpen = manualOpen != null
    ? manualOpen
    : (scheduledOpen != null ? scheduledOpen : (serverOpen ?? false));
  const openStatusDescription = useMemo(() => {
    if (manualOpen != null) {
      return manualOpen
        ? 'Bạn đã bật trạng thái mở cửa thủ công.'
        : 'Bạn đã tắt trạng thái mở cửa thủ công.';
    }
    if (scheduledOpen != null) {
      return scheduledOpen
        ? 'Theo lịch hôm nay, nhà hàng đang hoạt động.'
        : 'Theo lịch hôm nay, nhà hàng đang tạm đóng.';
    }
    if (serverOpen != null) {
      return serverOpen
        ? 'Trạng thái mở cửa từ hệ thống là đang hoạt động.'
        : 'Trạng thái mở cửa từ hệ thống là đang tạm đóng.';
    }
    return 'Chưa có lịch hoạt động cho hôm nay.';
  }, [manualOpen, scheduledOpen, serverOpen]);

  useEffect(() => {
    if (manualOpen != null) return;
    if (scheduledOpen == null) return;
    if (serverOpen == null) return;
    if (scheduledOpen === serverOpen) return;
    if (autoSyncing) return;

    let cancelled = false;
    const nextState = scheduledOpen;

    const syncStatus = async () => {
      setAutoSyncing(true);
      try {
        await merchantAPI.updateMerchantOpenStatus(nextState);
        if (cancelled) return;
        setData((prev) => (prev ? { ...prev, open: nextState } : prev));
        setTimeTick(Date.now());
      } catch (err) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error('[Info] Auto sync open status failed:', err);
        }
      } finally {
        if (!cancelled) {
          setAutoSyncing(false);
        }
      }
    };

    syncStatus();
    return () => {
      cancelled = true;
    };
  }, [manualOpen, scheduledOpen, serverOpen, autoSyncing]);

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
    const normalized = resolveWeekdayKey(day) || (WEEK_ORDER.includes(day) ? day : null);
    if (!normalized) return;
    setForm(prev => ({
      ...prev,
      openingHours: {
        ...ensureWeeklyOpeningHours(prev.openingHours),
        [normalized]: value,
      },
    }));
  };

  const handleToggleOpenStatus = async () => {
    if (openStatusUpdating) return;
    const previousManual = manualOpen;
    const previousOpenField = data?.open;
    const currentEffective = manualOpen != null ? manualOpen : (scheduledOpen ?? false);
    const nextValue = !currentEffective;

    setOpenStatusUpdating(true);
    setManualOpen(nextValue);
    setData((prev) => (prev ? { ...prev, open: nextValue } : prev));

    try {
      await merchantAPI.updateMerchantOpenStatus(nextValue);
      let refreshed = null;
      try {
        refreshed = await merchantAPI.getMyMerchant();
      } catch (fetchErr) {
        // eslint-disable-next-line no-console
        console.error('[Info] Không thể đồng bộ trạng thái mở cửa:', fetchErr);
      }
      if (refreshed) {
        setData(refreshed || null);
      } else {
        setManualOpen(nextValue);
      }
    } catch (error) {
      alert(error?.message || 'Không thể cập nhật trạng thái mở cửa.');
      setManualOpen(previousManual);
      setData((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        const rollbackOpen = previousManual != null ? previousManual : previousOpenField;
        if (rollbackOpen === undefined) {
          delete next.open;
        } else {
          next.open = rollbackOpen;
        }
        return next;
      });
    } finally {
      setOpenStatusUpdating(false);
    }
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

      // Chuẩn bị FormData theo đúng API format
      const formData = new FormData();
      
      // Convert opening hours về format backend mong muốn (Thứ 2, Thứ 3, ...)
      const backendOpeningHours = {};
      WEEK_ORDER.forEach((day) => {
        const rawValue = (desired.openingHours ?? {})[day];
        const value = String(rawValue ?? '').trim();
        if (!value) return;
        const label = DAY_LABELS[day] || day;
        backendOpeningHours[label] = value;
      });

      const scheduleOpenAfterSave = evaluateScheduleOpenStatus(backendOpeningHours, new Date());

      // Tạo data object
      const dataObject = {
        introduction: desired.introduction ?? current.introduction ?? '',
        address: desired.address ?? current.address ?? '',
        openingHours: backendOpeningHours,
        cuisineTypes: desired.cuisineTypes?.length ? desired.cuisineTypes : (current.cuisineTypes ?? []),
      };
      
      // Append data as JSON blob để backend parse chính xác
      formData.append('data', new Blob([JSON.stringify(dataObject)], { type: 'application/json' }));
      
      // Append image file nếu có
      if (desired.imageFile) {
        formData.append('img', desired.imageFile);
      } else {
        const existingImageUrl = current.image || resolveImageUrl(data) || form.imagePreview || '';
        const sanitizedUrl = typeof existingImageUrl === 'string' ? existingImageUrl.trim() : '';
        if (sanitizedUrl) {
          try {
            const response = await fetch(sanitizedUrl, { mode: 'cors' });
            if (response.ok) {
              const blob = await response.blob();
              const fallbackName = sanitizedUrl.split('/').pop()?.split('?')[0] || 'merchant-image';
              formData.append('img', blob, fallbackName);
            }
          } catch (fetchErr) {
            // eslint-disable-next-line no-console
            console.error('[Info] Không thể lấy ảnh hiện tại để gửi lại:', fetchErr);
          }
        }
      }

      if (!formData.has('img')) {
        alert('Không thể tải ảnh hiện tại. Vui lòng chọn ảnh mới rồi lưu lại.');
        return;
      }

      const updateResult = await merchantAPI.updateMyInfo(formData);
      
      // Hiển thị thông báo thành công
      alert('Cập nhật thông tin nhà hàng thành công!');

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
        setTimeTick(Date.now());
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
      setTimeTick(Date.now());

      if (manualOpen == null && scheduleOpenAfterSave != null) {
        const latestServerOpen = interpretBoolean(refreshed?.open ?? data?.open);
        if (latestServerOpen == null || latestServerOpen !== scheduleOpenAfterSave) {
          try {
            setAutoSyncing(true);
            await merchantAPI.updateMerchantOpenStatus(scheduleOpenAfterSave);
            setData((prev) => (prev ? { ...prev, open: scheduleOpenAfterSave } : prev));
          } catch (syncErr) {
            // eslint-disable-next-line no-console
            console.error('[Info] Không thể đồng bộ trạng thái mở cửa sau khi lưu:', syncErr);
          } finally {
            setAutoSyncing(false);
            setTimeTick(Date.now());
          }
        }
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
  const introduction = data.introduction || data.description || '';
  const address = data.address || '';
  const avgRating = data.avgRating || 0;
  const ratingCount = data.ratingCount || 0;
  const merchantCuisineTypes = data.cuisineTypes || [];
  const imageUrl = resolveImageUrl(data);
  const openStatusTitle = effectiveOpen ? 'Nhà hàng đang mở cửa' : 'Nhà hàng đang đóng cửa';
  const syncInProgress = openStatusUpdating || autoSyncing;
  const openStatusMessage = syncInProgress
    ? (openStatusUpdating ? 'Đang cập nhật trạng thái...' : 'Đang đồng bộ trạng thái theo lịch...')
    : openStatusDescription;
  const openToggleLabel = effectiveOpen ? 'Đang mở' : 'Đang đóng';

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
          <div className={`merchant-status-banner ${effectiveOpen ? 'open' : 'closed'}`}>
            <div className="merchant-status-text">
              <h4>{openStatusTitle}</h4>
              <p>{openStatusMessage}</p>
            </div>
            <label className={`merchant-status-toggle ${effectiveOpen ? 'active' : ''} ${syncInProgress ? 'disabled' : ''}`}>
              <input
                type="checkbox"
                checked={effectiveOpen}
                onChange={handleToggleOpenStatus}
                disabled={syncInProgress}
                aria-label="Thay đổi trạng thái mở cửa của nhà hàng"
              />
              <span className="merchant-status-slider" />
              <span className="merchant-status-toggle-label">{openToggleLabel}</span>
            </label>
          </div>

          {/* Name and Image Row */}
          <div className="info-field-row info-field-row-top">
            <div className="info-field-left-column">
              {/* Name Field */}
              <div className="info-field">
                <label className="field-label">Tên nhà hàng</label>
                <div className="field-value-box">
                  <span className="field-value">{name}</span>
                </div>
              </div>

              {/* Rating Field */}
              <div className="info-field">
                <label className="field-label">Đánh giá</label>
                <div className="field-input-with-icon">
                  <svg className="field-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1L10.163 5.39L15 6.118L11.5 9.521L12.326 14.342L8 12.062L3.674 14.342L4.5 9.521L1 6.118L5.837 5.39L8 1Z" fill="#FFA500" stroke="#FFA500" strokeWidth="1.5"/>
                  </svg>
                  <span className="field-value-readonly">{avgRating.toFixed(1)} ({ratingCount} đánh giá)</span>
                </div>
              </div>

              {/* Cuisine Types Field */}
              <div className="info-field">
                <label className="field-label">Loại ẩm thực</label>
                <div className="field-input-with-icon">
                  <svg className="field-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2L10 6L14 7L10 10L11 14L8 12L5 14L6 10L2 7L6 6L8 2Z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                  <span className="field-value-readonly">
                    {Array.isArray(merchantCuisineTypes) && merchantCuisineTypes.length > 0 
                      ? merchantCuisineTypes.join(', ') 
                      : 'Chưa có'}
                  </span>
                </div>
              </div>
            </div>

            <div className="info-field">
              <label className="field-label">Hình ảnh cửa hàng</label>
              <div className="image-upload-container">
                <div className="image-preview-wrapper">
                  {form.imagePreview ? (
                    <img src={form.imagePreview} alt="Restaurant" className="image-preview" />
                  ) : (
                    <div className="image-placeholder">
                      <svg width="36" height="36" viewBox="0 0 48 48" fill="none">
                        <rect x="6" y="6" width="36" height="36" rx="4" stroke="#D1D5DB" strokeWidth="2"/>
                        <circle cx="18" cy="18" r="4" fill="#D1D5DB"/>
                        <path d="M6 32L14 24L22 32L30 24L42 36V38C42 40.2091 40.2091 42 38 42H10C7.79086 42 6 40.2091 6 38V32Z" fill="#D1D5DB"/>
                      </svg>
                      <p>Chưa có hình ảnh</p>
                    </div>
                  )}
                </div>
                <div className="image-upload-actions">
                  <label className="btn-upload">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2V14M2 8H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Chọn ảnh
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  {form.imagePreview && (
                    <button 
                      type="button"
                      className="btn-remove-image"
                      onClick={() => {
                        if (form.imagePreview.startsWith('blob:')) {
                          URL.revokeObjectURL(form.imagePreview);
                        }
                        setForm(prev => ({
                          ...prev,
                          imageFile: null,
                          imagePreview: '',
                        }));
                        setEditing(true);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Xóa ảnh
                    </button>
                  )}
                </div>
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
              rows={3}
              value={form.introduction} 
              onChange={(e)=> setForm(prev=> ({...prev, introduction: e.target.value}))}
              onFocus={() => !editing && setEditing(true)}
              placeholder="Nhập mô tả về nhà hàng"
            />
          </div>

          {/* Opening Hours Button */}
          <div className="info-field">
            <label className="field-label">Giờ mở cửa</label>
            <button 
              className="btn-opening-hours"
              onClick={() => setShowOpeningHoursModal(true)}
              type="button"
            >
              <div className="btn-opening-hours-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 5V10L13 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="btn-opening-hours-content">
                <span className="btn-opening-hours-title">Quản lý giờ hoạt động</span>
                <span className="btn-opening-hours-subtitle">
                  {form.openingHours?.monday || form.openingHours?.saturday 
                    ? 'Đã cài đặt' 
                    : 'Chưa cài đặt thời gian'}
                </span>
              </div>
              <svg className="btn-opening-hours-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 6L13 10L7 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
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

      {/* Opening Hours Modal */}
      {showOpeningHoursModal && (
        <div className="modal-overlay" onClick={() => setShowOpeningHoursModal(false)}>
          <div 
            className="modal-content modal-opening-hours" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '520px',
              maxWidth: '520px',
              height: '650px', 
              maxHeight: '650px',
              minHeight: '650px',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Giờ mở cửa</h2>
                <p className="modal-subtitle">Cài đặt giờ hoạt động của nhà hàng theo từng ngày</p>
              </div>
              <button className="modal-close" onClick={() => setShowOpeningHoursModal(false)}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {/* Quick Templates */}
              <div className="quick-templates">
                <p className="quick-templates-label">Mẫu nhanh:</p>
                <div className="quick-templates-buttons">
                  <button 
                    type="button"
                    className="btn-template"
                    onClick={() => {
                      const weekdayValue = '08:00 - 22:00';
                      const weekendValue = '07:00 - 23:00';
                      setForm(prev => ({
                        ...prev,
                        openingHours: {
                          monday: weekdayValue,
                          tuesday: weekdayValue,
                          wednesday: weekdayValue,
                          thursday: weekdayValue,
                          friday: weekdayValue,
                          saturday: weekendValue,
                          sunday: weekendValue,
                        },
                      }));
                      setEditing(true);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 4V8L11 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Chuẩn (8:00-22:00)
                  </button>
                  <button 
                    type="button"
                    className="btn-template"
                    onClick={() => {
                      const allDayValue = '00:00 - 23:59';
                      setForm(prev => ({
                        ...prev,
                        openingHours: {
                          monday: allDayValue,
                          tuesday: allDayValue,
                          wednesday: allDayValue,
                          thursday: allDayValue,
                          friday: allDayValue,
                          saturday: allDayValue,
                          sunday: allDayValue,
                        },
                      }));
                      setEditing(true);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2V8L11 11M8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    Cả ngày (24/7)
                  </button>
                </div>
              </div>

              {/* Opening Hours List */}
              <div className="opening-hours-edit">
                {WEEK_ORDER.map((day) => (
                  <div key={day} className="opening-hours-row">
                    <span className="hours-day">{DAY_LABELS[day] || day}</span>
                    <input
                      className="hours-input"
                      value={form.openingHours?.[day] ?? ''}
                      placeholder="08:00 - 22:00"
                      onChange={(e) => {
                        updateOpeningHour(day, e.target.value);
                        setEditing(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowOpeningHoursModal(false)}
              >
                Đóng
              </button>
              <button 
                type="button"
                className="btn-modal-save"
                onClick={() => {
                  setShowOpeningHoursModal(false);
                  setEditing(true);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L6 11L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Info;
