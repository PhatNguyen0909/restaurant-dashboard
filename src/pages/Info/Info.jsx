import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import './Info.css';
import merchantAPI from '../../api/merchantAPI';
import userAPI from '../../api/userAPI';
import { saveMerchantCoordinates } from '../../utils/locationStorage';

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

const normalizeCuisineValue = (value = '') => (
  stripDiacritics(String(value).trim()).toLowerCase().replace(/[^a-z0-9]/g, '')
);

const Info = () => {
  const navigate = useNavigate();
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
    latitude: '',
    longitude: '',
  });
  const [cuisineOptions, setCuisineOptions] = useState([]);
  const [cuisineLoading, setCuisineLoading] = useState(false);
  const [cuisineError, setCuisineError] = useState('');
  const [cuisineSearch, setCuisineSearch] = useState('');
  const [cuisineDropdownOpen, setCuisineDropdownOpen] = useState(false);
  const cuisineDropdownRef = useRef(null);
  const [showOpeningHoursModal, setShowOpeningHoursModal] = useState(false);
  const [manualOpen, setManualOpen] = useState(null);
  const [openStatusUpdating, setOpenStatusUpdating] = useState(false);
  const [timeTick, setTimeTick] = useState(() => Date.now());

  const parseCoordinate = (value) => {
    if (value === null || value === undefined) return null;
    const raw = typeof value === 'string' ? value.trim() : value;
    if (raw === '') return null;
    const normalized = typeof raw === 'string' ? raw.replace(',', '.') : raw;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  };

  const formatCoordinateInput = (value) => {
    if (value === null || value === undefined) return '';
    const parsed = parseCoordinate(value);
    return parsed === null ? String(value) : String(parsed);
  };

  const isLatitude = (value) => {
    const num = parseCoordinate(value);
    return num !== null && num >= -90 && num <= 90;
  };

  const isLongitude = (value) => {
    const num = parseCoordinate(value);
    return num !== null && num >= -180 && num <= 180;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await merchantAPI.getMyMerchant();
        if (mounted) {
          setData(res || null);
          const latitude = parseCoordinate(res?.latitude);
          const longitude = parseCoordinate(res?.longitude);
          if (latitude != null && longitude != null) {
            saveMerchantCoordinates({ latitude, longitude });
          }
          const formInit = {
            introduction: res?.introduction || res?.description || '',
            address: res?.address || '',
            openingHours: ensureWeeklyOpeningHours(res?.openingHours || res?.opening_hours || {}),
            cuisineTypes: Array.isArray(res?.cuisineTypes) ? res.cuisineTypes : (Array.isArray(res?.cuisine_types) ? res.cuisine_types : []),
            imageFile: null,
            imagePreview: resolveImageUrl(res),
            latitude: formatCoordinateInput(latitude),
            longitude: formatCoordinateInput(longitude),
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
          ? list.map((item, idx) => {
            if (typeof item === 'string') {
              const trimmed = item.trim();
              return trimmed ? { label: trimmed, value: trimmed } : null;
            }
            const rawLabel = item?.name || item?.title || item?.label || item?.displayName || item?.cuisine || item?.value || '';
            const rawValue = item?.code || item?.value || item?.id || item?.name || item?.title || item?.cuisine || '';
            const label = String(rawLabel || rawValue || `Cuisine ${idx + 1}`).trim();
            const value = String(rawValue || rawLabel || '').trim();
            if (!value) return null;
            return {
              label: label || value,
              value,
            };
          }).filter(Boolean)
          : [];
        setCuisineOptions(normalized);
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

  useEffect(() => {
    const latitude = parseCoordinate(data?.latitude);
    const longitude = parseCoordinate(data?.longitude);
    if (latitude != null && longitude != null) {
      saveMerchantCoordinates({ latitude, longitude });
    }
  }, [data?.latitude, data?.longitude]);

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
    const result = [];
    const seen = new Set();
    const pushOption = (entry) => {
      if (!entry || !entry.value) return;
      const key = normalizeCuisineValue(entry.value);
      if (!key || seen.has(key)) return;
      seen.add(key);
      result.push({
        label: entry.label || entry.value,
        value: entry.value,
      });
    };
    (Array.isArray(cuisineOptions) ? cuisineOptions : []).forEach(pushOption);
    return result;
  }, [cuisineOptions]);

  const cuisineValueMap = useMemo(() => {
    const map = new Map();
    cuisineSelectOptions.forEach((option) => {
      const valueKey = normalizeCuisineValue(option.value);
      const labelKey = normalizeCuisineValue(option.label);
      if (valueKey) map.set(valueKey, option);
      if (labelKey) map.set(labelKey, option);
    });
    return map;
  }, [cuisineSelectOptions]);

  const dedupeCuisineList = useCallback((list = []) => {
    const result = [];
    const seen = new Set();
    list.forEach((item) => {
      const rawKey = normalizeCuisineValue(item);
      if (!rawKey) return;
      const matched = cuisineValueMap.get(rawKey);
      const canonicalValue = matched?.value || item;
      const canonicalKey = normalizeCuisineValue(canonicalValue);
      if (!canonicalKey || seen.has(canonicalKey)) return;
      seen.add(canonicalKey);
      result.push(canonicalValue);
    });
    return result;
  }, [cuisineValueMap]);

  const selectedCuisineKeys = useMemo(() => {
    const keys = new Set();
    const current = Array.isArray(form.cuisineTypes) ? form.cuisineTypes : [];
    current.forEach((item) => {
      const matched = cuisineValueMap.get(normalizeCuisineValue(item));
      const canonicalValue = matched?.value || item;
      const canonicalKey = normalizeCuisineValue(canonicalValue);
      if (canonicalKey) keys.add(canonicalKey);
    });
    return keys;
  }, [form.cuisineTypes, cuisineValueMap]);

  const filteredCuisineOptions = useMemo(() => {
    const keyword = stripDiacritics(cuisineSearch).toLowerCase();
    return cuisineSelectOptions.filter((option) => {
      if (!option || !option.value) return false;
      const optionKey = normalizeCuisineValue(option.value);
      if (!optionKey) return false;
      // Cho phép hiển thị cả options đã chọn và chưa chọn để có thể check/uncheck
      if (keyword && !stripDiacritics(option.label).toLowerCase().includes(keyword)) {
        return false;
      }
      return true;
    });
  }, [cuisineSearch, cuisineSelectOptions]);

  const selectedCuisineEntries = useMemo(() => {
    const current = Array.isArray(form.cuisineTypes) ? dedupeCuisineList(form.cuisineTypes) : [];
    return current.map((value) => {
      const matched = cuisineValueMap.get(normalizeCuisineValue(value));
      return {
        value: matched?.value || value,
        label: matched?.label || matched?.value || value,
      };
    });
  }, [form.cuisineTypes, cuisineValueMap, dedupeCuisineList]);

  const serverOpen = interpretBoolean(data?.open);
  const effectiveOpen = manualOpen != null
    ? manualOpen
    : (serverOpen != null ? serverOpen : (scheduledOpen ?? false));
  const openStatusDescription = useMemo(() => {
    if (manualOpen != null) {
      return manualOpen
        ? 'Bạn đã bật trạng thái mở cửa thủ công.'
        : 'Bạn đã tắt trạng thái mở cửa thủ công.';
    }
    if (serverOpen != null && scheduledOpen != null && serverOpen !== scheduledOpen) {
      return serverOpen
        ? 'Nhà hàng đang mở cửa thủ công, khác với lịch hôm nay.'
        : 'Nhà hàng đang tạm đóng thủ công, khác với lịch hôm nay.';
    }
    if (serverOpen != null) {
      return serverOpen
        ? 'Trạng thái mở cửa từ hệ thống là đang hoạt động.'
        : 'Trạng thái mở cửa từ hệ thống là đang tạm đóng.';
    }
    if (scheduledOpen != null) {
      return scheduledOpen
        ? 'Theo lịch hôm nay, nhà hàng đang hoạt động.'
        : 'Theo lịch hôm nay, nhà hàng đang tạm đóng.';
    }
    return 'Chưa có lịch hoạt động cho hôm nay.';
  }, [manualOpen, scheduledOpen, serverOpen]);

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

  const setCuisineSelected = (value, shouldSelect) => {
    const key = normalizeCuisineValue(value);
    const matched = key ? cuisineValueMap.get(key) : null;
    
    if (!matched) {
      console.error('❌ No matched entry in cuisineValueMap for key:', key);
      return;
    }
    
    setForm((prev) => {
      const currentList = Array.isArray(prev.cuisineTypes) ? prev.cuisineTypes : [];
      
      // Backend expects LABEL, not ID - use matched.label
      const itemToStore = matched.label;
      const itemKey = normalizeCuisineValue(itemToStore);
      
      if (shouldSelect) {
        // Check nếu chưa có trong list thì thêm vào
        const hasItem = currentList.some((item) => normalizeCuisineValue(item) === itemKey);
        if (hasItem) return prev;
        return { ...prev, cuisineTypes: [...currentList, itemToStore] };
      } else {
        // Bỏ check: filter bằng cách so sánh normalized keys
        const nextList = currentList.filter((item) => normalizeCuisineValue(item) !== itemKey);
        if (nextList.length === currentList.length) return prev;
        return { ...prev, cuisineTypes: nextList };
      }
    });
    
    if (!editing) setEditing(true);
  };

  // Removed conflicting useEffect that was interfering with uncheck logic

  const updateCoordinateField = (field) => (event) => {
    const value = event?.target?.value ?? '';
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (!editing) {
      setEditing(true);
    }
  };

  const handleToggleOpenStatus = async () => {
    if (openStatusUpdating) return;
    const previousManual = manualOpen;
    const previousOpenField = data?.open;
    const currentEffective = effectiveOpen;
    const nextValue = !currentEffective;
    const manualOverride = scheduledOpen == null || scheduledOpen !== nextValue;
    const nextManual = manualOverride ? nextValue : null;

    setOpenStatusUpdating(true);
    setManualOpen(nextManual);
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
        setManualOpen(nextManual);
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

  const onSave = async () => {
    setSaving(true);
    try {
      const current = {
        introduction: data?.introduction || data?.description || '',
        address: data?.address || '',
        openingHours: ensureWeeklyOpeningHours(data?.openingHours || data?.opening_hours || {}),
        cuisineTypes: Array.isArray(data?.cuisineTypes) ? data.cuisineTypes : (Array.isArray(data?.cuisine_types) ? data.cuisine_types : []),
        image: resolveImageUrl(data),
        latitude: parseCoordinate(data?.latitude),
        longitude: parseCoordinate(data?.longitude),
      };
      const desiredLatitude = parseCoordinate(form.latitude);
      const desiredLongitude = parseCoordinate(form.longitude);
      const desired = {
        introduction: form.introduction,
        address: form.address,
        openingHours: ensureWeeklyOpeningHours(form.openingHours),
        cuisineTypes: Array.isArray(form.cuisineTypes) ? form.cuisineTypes : String(form.cuisineTypes || '').split(',').map(s=>s.trim()).filter(Boolean),
        imageFile: form.imageFile,
        latitude: desiredLatitude,
        longitude: desiredLongitude,
      };

      const invalidCuisineValues = desired.cuisineTypes.filter((value) => {
        const key = normalizeCuisineValue(value);
        return !key || !cuisineValueMap.get(key);
      });
      if (invalidCuisineValues.length > 0) {
        alert(`Các loại ẩm thực không hợp lệ: ${invalidCuisineValues.join(', ')}. Vui lòng chọn lại từ danh sách.`);
        setSaving(false);
        return;
      }

      const missingDays = WEEK_ORDER.filter((day) => !String(desired.openingHours?.[day] ?? '').trim());
      if (missingDays.length > 0) {
        const pretty = missingDays.map((day) => day.charAt(0).toUpperCase() + day.slice(1));
        alert(`Vui lòng nhập thời gian cho các ngày: ${pretty.join(', ')}`);
        return;
      }

      if (desiredLatitude == null || desiredLatitude < -90 || desiredLatitude > 90) {
        alert('Vui lòng nhập vĩ độ hợp lệ (trong khoảng -90 đến 90).');
        setSaving(false);
        return;
      }

      if (desiredLongitude == null || desiredLongitude < -180 || desiredLongitude > 180) {
        alert('Vui lòng nhập kinh độ hợp lệ (trong khoảng -180 đến 180).');
        setSaving(false);
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

      // Tạo data object
      const dataObject = {
        introduction: desired.introduction ?? current.introduction ?? '',
        address: desired.address ?? current.address ?? '',
        openingHours: backendOpeningHours,
        cuisineTypes: desired.cuisineTypes?.length ? desired.cuisineTypes : (current.cuisineTypes ?? []),
        latitude: desiredLatitude,
        longitude: desiredLongitude,
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

      const payload = {
        introduction: desired.introduction,
        address: desired.address,
        openingHours: desired.openingHours,
        cuisineTypes: desired.cuisineTypes,
        imgFile: desired.imageFile,
        latitude: desiredLatitude,
        longitude: desiredLongitude,
      };

      await merchantAPI.updateMyInfo(formData);
      
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
        const refreshedLat = parseCoordinate(refreshed?.latitude);
        const refreshedLng = parseCoordinate(refreshed?.longitude);
        setForm({
          introduction: refreshed?.introduction || refreshed?.description || '',
          address: refreshed?.address || '',
          openingHours: ensureWeeklyOpeningHours(refreshed?.openingHours || refreshed?.opening_hours || {}),
          cuisineTypes: Array.isArray(refreshed?.cuisineTypes) ? refreshed.cuisineTypes : (Array.isArray(refreshed?.cuisine_types) ? refreshed.cuisine_types : []),
          imageFile: null,
          imagePreview: resolveImageUrl(refreshed),
          latitude: formatCoordinateInput(refreshedLat),
          longitude: formatCoordinateInput(refreshedLng),
        });
        if (refreshedLat != null && refreshedLng != null) {
          saveMerchantCoordinates({ latitude: refreshedLat, longitude: refreshedLng });
        }
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
          if (desiredLatitude != null) next.latitude = desiredLatitude;
          if (desiredLongitude != null) next.longitude = desiredLongitude;
          return next;
        });
        setForm((prev) => ({
          ...prev,
          imageFile: null,
          imagePreview: payload.imgFile && form.imagePreview ? form.imagePreview : prev.imagePreview,
          latitude: formatCoordinateInput(desiredLatitude),
          longitude: formatCoordinateInput(desiredLongitude),
        }));
        if (desiredLatitude != null && desiredLongitude != null) {
          saveMerchantCoordinates({ latitude: desiredLatitude, longitude: desiredLongitude });
        }
      }
      setTimeTick(Date.now());
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
  const imageUrl = resolveImageUrl(data);
  const openStatusTitle = effectiveOpen ? 'Nhà hàng đang mở cửa' : 'Nhà hàng đang đóng cửa';
  const syncInProgress = openStatusUpdating;
  const openStatusMessage = openStatusUpdating
    ? 'Đang cập nhật trạng thái...'
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
        <button 
          className="btn-change-password"
          onClick={() => navigate('/change-password')}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 1V6M9 6L12 3M9 6L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 8V13C14 14.1046 13.1046 15 12 15H6C4.89543 15 4 14.1046 4 13V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Đổi mật khẩu
        </button>
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
                <div
                  className={`cuisine-select ${cuisineDropdownOpen ? 'open' : ''}`}
                  ref={cuisineDropdownRef}
                >
                  <button
                    type="button"
                    className="cuisine-select-display"
                    onClick={() => {
                      setCuisineDropdownOpen((prev) => !prev);
                      if (!editing) setEditing(true);
                    }}
                  >
                    <span>
                      {selectedCuisineEntries.length
                        ? selectedCuisineEntries.map((entry) => entry.label).join(', ')
                        : 'Chọn loại ẩm thực'}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M5 7L10 12L15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {cuisineDropdownOpen && (
                    <div className="cuisine-select-dropdown">
                      <div className="cuisine-dropdown-search">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12C8.30622 12 9.49745 11.4957 10.382 10.6567L13.2929 13.5676" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <input
                          type="text"
                          value={cuisineSearch}
                          onChange={(event) => setCuisineSearch(event.target.value)}
                          placeholder="Tìm kiếm"
                        />
                      </div>

                      <div className="cuisine-dropdown-body">
                        {cuisineLoading && <div className="cuisine-list-hint">Đang tải danh sách...</div>}
                        {!cuisineLoading && cuisineError && (
                          <div className="cuisine-list-error">{cuisineError}</div>
                        )}
                        {!cuisineLoading && !cuisineError && !filteredCuisineOptions.length && (
                          <div className="cuisine-list-hint">Không tìm thấy loại phù hợp.</div>
                        )}
                        {!cuisineLoading && !cuisineError && filteredCuisineOptions.length > 0 && (
                          <div className="cuisine-dropdown-options">
                            {filteredCuisineOptions.map((option) => {
                              const optionKey = normalizeCuisineValue(option.value);
                              const checked = selectedCuisineKeys.has(optionKey);
                              return (
                                <label key={option.value} className={`cuisine-dropdown-option ${checked ? 'checked' : ''}`}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(event) => setCuisineSelected(option.value, event.target.checked)}
                                  />
                                  <span>{option.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <small className="field-hint">Chọn các loại ẩm thực có trong danh sách hệ thống.</small>
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

          <div className="info-field">
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label className="field-label" style={{ fontSize: '13px', marginBottom: '6px' }}>Vĩ độ (Latitude)</label>
                <input
                  type="text"
                  className="field-input"
                  value={form.latitude}
                  onChange={updateCoordinateField('latitude')}
                  placeholder="VD: 10.7598249"
                />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label className="field-label" style={{ fontSize: '13px', marginBottom: '6px' }}>Kinh độ (Longitude)</label>
                <input
                  type="text"
                  className="field-input"
                  value={form.longitude}
                  onChange={updateCoordinateField('longitude')}
                  placeholder="VD: 106.6812712"
                />
              </div>
            </div>
            <small className="field-hint">Nhập tọa độ chính xác để hỗ trợ điều hướng Drone.</small>
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
                latitude: formatCoordinateInput(parseCoordinate(data?.latitude)),
                longitude: formatCoordinateInput(parseCoordinate(data?.longitude)),
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
