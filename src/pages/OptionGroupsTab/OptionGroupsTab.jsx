import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './OptionGroupsTab.css';
import OptionAPI from '../../api/Option';

export default function OptionGroupsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [counts, setCounts] = useState({}); // { [groupId]: number of linked menu items }

  const toArray = useCallback((input) => {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (typeof input !== 'object') return [];

    const keys = ['items', 'data', 'result', 'results', 'rows', 'records', 'options', 'optionValues', 'optionGroups', 'option_groups', 'groups', 'list', 'docs', 'content', 'optionList'];
    for (const key of keys) {
      const value = input?.[key];
      if (Array.isArray(value)) return value;
    }

    for (const value of Object.values(input)) {
      const nested = toArray(value);
      if (nested.length) return nested;
    }

    return [];
  }, []);

  const getGroupId = (group) => (
    group?.id
    ?? group?._id
    ?? group?.optionId
    ?? group?.option_id
    ?? group?.optionGroupId
    ?? group?.option_group_id
  );

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
          list.forEach((g) => {
            const gid = getGroupId(g);
            if (gid == null) return;
            const key = String(gid);
            c[key] = Array.isArray(aMap[key]) ? aMap[key].length : 0;
          });
          setCounts(c);
        } else {
          const data = await OptionAPI.getAll();
          const list = toArray(data);
          setGroups(list);
          // Fetch counts in parallel
          const results = await Promise.all(list.map(async (g) => {
            const groupId = getGroupId(g);
            if (groupId == null) {
              return { id: undefined, count: 0 };
            }
            try {
                const res = await OptionAPI.getMenuItems(groupId);
                const cnt = Array.isArray(res) ? res.length : 0;
              return { id: String(groupId), count: cnt };
            } catch {
              return { id: String(groupId), count: 0 };
            }
          }));
          const c = {};
          results.forEach(({id, count}) => {
            if (id !== undefined) c[id] = count;
          });
          setCounts(c);
        }
      } catch (e) {
        setError('Không tải được danh sách nhóm tuỳ chọn.');
      } finally { setLoading(false); }
    })();
  }, [isDemo]);

  const sorted = useMemo(() => groups.slice().sort((a,b)=> String(a.title||a.name||'').localeCompare(String(b.title||b.name||''),'vi')), [groups]);

  const resolveType = (group) => {
    const raw = (group?.type ?? group?.selectionType ?? '').toString().toLowerCase();
    return raw.includes('multi') ? 'multi' : 'single';
  };

  const toggle = (id) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const getValueId = (value) => value?.id ?? value?.valueId ?? value?.value_id ?? value?.key;

  const isValueVisible = (value) => {
    const raw = value?.isVisible ?? value?.visible ?? value?.status ?? value?.state ?? value?.isActive ?? value?.active;
    if (raw === undefined || raw === null) return true;
    if (typeof raw === 'boolean') return raw;
    const token = String(raw).trim().toLowerCase();
    if (['false', '0', 'inactive', 'hidden', 'disabled'].includes(token)) return false;
    if (['true', '1', 'active', 'visible', 'enabled'].includes(token)) return true;
    return true;
  };

  const makeValueKey = (groupId, value) => {
    const id = getValueId(value);
    if (id !== undefined && id !== null) return String(id);
    if (value?.index !== undefined) return `${groupId}-${value.index}`;
    return `${groupId}-${value?.name ?? 'value'}`;
  };

  const applyVisibilityToGroup = (groupId, valueMeta, nextVisible) => {
    const targetId = groupId != null ? String(groupId) : undefined;
    if (targetId === undefined) return;
    setGroups((prev) => prev.map((g) => {
      const gid = getGroupId(g);
      if (targetId !== undefined && String(gid) !== targetId) return g;
      const patchArray = (arr) => arr.map((opt, idx) => {
        const optId = getValueId(opt);
        const sameId = (optId != null && valueMeta.id != null && String(optId) === String(valueMeta.id));
        if (sameId
          || (valueMeta.id == null && idx === valueMeta.index)) {
          return { ...opt, isVisible: nextVisible };
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
      const stored = gMap[targetId];
      if (stored) {
        const patchArray = (arr) => (
          Array.isArray(arr)
            ? arr.map((opt, idx) => {
                const optId = getValueId(opt);
                const sameId = (optId != null && valueMeta.id != null && String(optId) === String(valueMeta.id));
                if (sameId
                  || (valueMeta.id == null && idx === valueMeta.index)) {
                  return { ...opt, isVisible: nextVisible };
                }
                return opt;
              })
            : arr
        );
        gMap[targetId] = {
          ...stored,
          options: patchArray(stored.options),
          optionValues: patchArray(stored.optionValues),
        };
        safeSave(GROUPS_KEY, gMap);
      }
    }
  };

  const handleToggleOption = async (group, value) => {
  const groupId = getGroupId(group);
    if (groupId == null) {
      alert('Không xác định được mã nhóm tuỳ chọn.');
      return;
    }
    const optionId = getValueId(value);
    const currentVisible = isValueVisible(value);
    const nextVisible = !currentVisible;
  const trackingKey = makeValueKey(String(groupId), value);
    if (!isDemo && updatingMap[trackingKey]) return;

    if (!isDemo && (optionId === undefined || optionId === null)) {
      alert('Không tìm thấy mã option để cập nhật trạng thái.');
      return;
    }

    const meta = { id: optionId, index: value.index };
    applyVisibilityToGroup(groupId, meta, nextVisible);

    if (isDemo) return;

    setUpdatingMap((prev) => ({ ...prev, [trackingKey]: true }));
    try {
      await OptionAPI.updateStatus(optionId, nextVisible);
    } catch (e) {
      // revert on failure
      applyVisibilityToGroup(groupId, meta, currentVisible);
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
          {sorted.map((group, index) => {
            const rawGroupId = getGroupId(group);
            const gid = rawGroupId != null ? String(rawGroupId) : `group-${index}`;
            const title = group.title || group.name || '(Không tiêu đề)';
            const open = expanded.has(gid);
            const valuesRaw = Array.isArray(group.options)
              ? group.options
              : (Array.isArray(group.optionValues) ? group.optionValues : []);
            const values = valuesRaw.map((val, idx) => ({
              key: getValueId(val) ?? `${gid}-${idx}`,
              id: getValueId(val),
              index: idx,
              name: val.label || val.name || val.title || `Lựa chọn ${idx + 1}`,
              price: val.extraPrice ?? val.priceDelta ?? val.price ?? 0,
              isVisible: isValueVisible(val),
            }));
            const totalLinked = counts[gid] ?? 0;
            return (
              <div key={gid} className={`ogt-item ${open?'open':''}`}>
                <div className="ogt-item-head" onClick={()=>toggle(gid)}>
                  <span className="ogt-caret">{open ? '▾' : '▸'}</span>
                  <div className="ogt-title">{title}</div>
                  <div className="ogt-meta">{group.required ? 'Bắt buộc' : 'Tùy chọn'} • {resolveType(group) === 'multi' ? 'Chọn nhiều' : 'Chọn 1'} • {values.length} lựa chọn • {totalLinked} món</div>
                </div>
                {open && (
                  <div className="ogt-values">
                    {!values.length && <div className="ogt-hint">Chưa có option value.</div>}
                    {values.map((v) => {
                      const toggleKey = makeValueKey(gid, v);
                      const isUpdating = !isDemo && updatingMap[toggleKey];
                      return (
                        <div key={v.key} className="ogt-val-row">
                          <div className="ogt-val-info">
                            <div className="ogt-val-name">{v.name}</div>
                            <div className="ogt-val-price">+ {Number(v.price || 0).toLocaleString('vi-VN')}đ</div>
                          </div>
                          <div className="ogt-val-toggle">
                            <label className="ogt-switch">
                              <input
                                type="checkbox"
                                checked={v.isVisible !== false}
                                onChange={() => handleToggleOption(group, v)}
                                disabled={isUpdating || !v.id}
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
