import React, { useEffect, useMemo, useState } from 'react';
import './OptionGroupsTab.css';
import OptionAPI from '../../api/Option';

export default function OptionGroupsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [counts, setCounts] = useState({}); // { [groupId]: number of linked menu items }

  // Demo mode detection + localStorage keys (align with AddOptionGroup)
  const GROUPS_KEY = 'dashboard_option_groups_v2';
  const ASSIGN_KEY = 'dashboard_option_group_assignments_v2';
  const isDemo = useMemo(() => {
    const userStr = document.cookie.split('; ').find((row) => row.startsWith('user='));
    if (userStr) {
      try { const userObj = JSON.parse(decodeURIComponent(userStr.split('=')[1])); return userObj.email === 'demo'; } catch {}
    }
    return false;
  }, []);
  const safeLoad = (key, fallback) => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : (fallback ?? {}); } catch { return (fallback ?? {}); } };
  const safeSave = (key, data) => { try { localStorage.setItem(key, JSON.stringify(data)); } catch {} };
  const [updatingMap, setUpdatingMap] = useState({});

  useEffect(() => {
    (async () => {
      setLoading(true); setError('');
      try {
        if (isDemo) {
          // Demo: read from localStorage for groups and assignments
          const gMap = safeLoad(GROUPS_KEY, {});
          const list = Object.values(gMap);
          setGroups(list);
          const aMap = safeLoad(ASSIGN_KEY, {});
          const c = {};
          list.forEach((g) => { const gid = g.id || g._id; c[gid] = Array.isArray(aMap[gid]) ? aMap[gid].length : 0; });
          setCounts(c);
        } else {
          const data = await OptionAPI.getAll();
          const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
          setGroups(list);
          // Fetch counts in parallel
          const results = await Promise.all(list.map(async (g) => {
            try {
              const res = await OptionAPI.getMenuItems(g.id || g._id);
              // Backend returns an object that includes `menuItems: []`
              const body = res;
              const arr = Array.isArray(body?.menuItems)
                ? body.menuItems
                : (Array.isArray(body) ? body : (Array.isArray(body?.items) ? body.items : (Array.isArray(body?.data) ? body.data : [])));
              const cnt = Array.isArray(arr) ? arr.length : 0;
              return { id: g.id || g._id, count: cnt };
            } catch { return { id: g.id || g._id, count: 0 }; }
          }));
          const c = {};
          results.forEach(({id, count}) => { c[id] = count; });
          setCounts(c);
        }
      } catch (e) {
        setError('Không tải được danh sách nhóm tuỳ chọn.');
      } finally { setLoading(false); }
    })();
  }, [isDemo]);

  const sorted = useMemo(() => groups.slice().sort((a,b)=> String(a.title||a.name||'').localeCompare(String(b.title||b.name||''),'vi')), [groups]);

  const toggle = (id) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const formatCurrency = (n) => {
    const value = Number(n || 0);
    try { return value.toLocaleString('vi-VN'); } catch { return String(value); }
  };

  const isActiveStatus = (status) => {
    if (status === undefined || status === null) return true;
    if (typeof status === 'boolean') return status;
    const raw = String(status).trim().toLowerCase();
    if (['inactive', 'disabled', 'unavailable', 'false', '0'].includes(raw)) return false;
    return true;
  };

  const makeValueKey = (groupId, value) => {
    const id = value?.id ?? value?.valueId ?? value?.value_id ?? value?.key;
    if (id !== undefined && id !== null) return String(id);
    if (value?.index !== undefined) return `${groupId}-${value.index}`;
    return `${groupId}-${value?.name ?? 'value'}`;
  };

  const applyStatusToGroup = (groupId, valueMeta, nextStatus) => {
    setGroups((prev) => prev.map((g) => {
      const gid = g.id || g._id;
      if (gid !== groupId) return g;
      const patchArray = (arr) => arr.map((opt, idx) => {
        const optId = opt.id || opt._id || opt.valueId || opt.value_id;
        if ((optId != null && valueMeta.id != null && optId === valueMeta.id)
          || (valueMeta.id == null && idx === valueMeta.index)) {
          return { ...opt, status: nextStatus };
        }
        return opt;
      });
      const next = { ...g };
      if (Array.isArray(g.options)) next.options = patchArray(g.options);
      if (Array.isArray(g.optionValues)) next.optionValues = patchArray(g.optionValues);
      return next;
    }));

    if (isDemo) {
      const gMap = safeLoad(GROUPS_KEY, {});
      const stored = gMap[groupId];
      if (stored && Array.isArray(stored.options)) {
        gMap[groupId] = {
          ...stored,
          options: stored.options.map((opt, idx) => {
            const optId = opt.id || opt._id || opt.valueId || opt.value_id;
            if ((optId != null && valueMeta.id != null && optId === valueMeta.id)
              || (valueMeta.id == null && idx === valueMeta.index)) {
              return { ...opt, status: nextStatus };
            }
            return opt;
          }),
        };
        safeSave(GROUPS_KEY, gMap);
      }
    }
  };

  const handleToggleOption = async (group, value) => {
    const groupId = group.id || group._id;
    const optionId = value.id ?? value.valueId ?? value.value_id;
    const currentStatus = value.status;
    const nextStatus = isActiveStatus(currentStatus) ? 'inactive' : 'active';
    const trackingKey = makeValueKey(groupId, value);
    if (!isDemo && updatingMap[trackingKey]) return;

    if (!isDemo && (optionId === undefined || optionId === null)) {
      alert('Không tìm thấy mã option để cập nhật trạng thái.');
      return;
    }

    applyStatusToGroup(groupId, value, nextStatus);

    if (isDemo) return;

    setUpdatingMap((prev) => ({ ...prev, [trackingKey]: true }));
    try {
      await OptionAPI.updateStatus(optionId, nextStatus);
    } catch (e) {
      // revert on failure
      applyStatusToGroup(groupId, value, currentStatus);
      console.error('Toggle option status failed', e);
      alert('Không cập nhật được trạng thái option.');
    } finally {
      setUpdatingMap((prev) => {
        const next = { ...prev };
        delete next[trackingKey];
        return next;
      });
    }
  };

  return (
    <div className="ogt-wrap">
      <div className="ogt-head">
        <h3>Nhóm tuỳ chọn</h3>
        <div className="ogt-sub">Liên kết và quản lý option values cho từng nhóm.</div>
      </div>

      {loading && <div className="ogt-hint">Đang tải...</div>}
      {error && <div className="ogt-error">{error}</div>}

      {!loading && !error && !sorted.length && (
        <div className="ogt-hint">Chưa có nhóm tuỳ chọn nào.</div>
      )}

      {!loading && !error && !!sorted.length && (
        <div className="ogt-board">
          {sorted.map((group) => {
            const gid = group.id || group._id;
            const title = group.title || group.name || '(Không tiêu đề)';
            const open = expanded.has(gid);
            const valuesRaw = Array.isArray(group.options)
              ? group.options
              : (Array.isArray(group.optionValues) ? group.optionValues : []);
            const values = valuesRaw.map((val, idx) => ({
              key: (val.id || val._id || val.valueId || val.value_id || `${gid}-${idx}`),
              id: val.id || val._id || val.valueId || val.value_id,
              index: idx,
              name: val.label || val.name || val.title || `Lựa chọn ${idx + 1}`,
              price: val.priceDelta ?? val.extraPrice ?? val.price ?? 0,
              status: val.status ?? val.state ?? val.isActive ?? val.active,
            }));
            const totalLinked = counts[gid] ?? 0;
            return (
              <div key={gid} className={`ogt-card ${open ? 'open' : ''}`}>
                <button type="button" className="ogt-card-head" onClick={() => toggle(gid)}>
                  <div className="ogt-card-text">
                    <div className="ogt-card-title">{title}</div>
                    <div className="ogt-card-sub">Liên kết với {totalLinked} món</div>
                  </div>
                  <span className="ogt-card-arrow" aria-hidden="true" />
                </button>
                {open && (
                  <div className="ogt-card-body">
                    {!values.length && <div className="ogt-empty">Chưa có option value.</div>}
                    {values.map((val) => {
                      const activeFlag = isActiveStatus(val.status);
                      const trackingKey = makeValueKey(gid, val);
                      const busy = !!updatingMap[trackingKey];
                      return (
                        <div key={val.key} className="ogt-val-row">
                          <div className="ogt-val-info">
                            <div className="ogt-val-name">{val.name}</div>
                            <div className="ogt-val-price">+ {formatCurrency(val.price)}đ</div>
                          </div>
                          <div className="ogt-val-toggle">
                            <label className="ogt-switch">
                              <input
                                type="checkbox"
                                checked={activeFlag}
                                disabled={busy}
                                onChange={() => handleToggleOption(group, val)}
                              />
                              <span className="ogt-switch-slider" />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
