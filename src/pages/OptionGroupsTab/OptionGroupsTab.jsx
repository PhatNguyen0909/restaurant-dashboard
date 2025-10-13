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

  return (
    <div className="ogt-wrap">
      <div className="ogt-head">
        <h3>Nhóm tuỳ chọn</h3>
        <div className="ogt-sub">Sắp xếp theo nhóm. Bấm từng nhóm để xem option values.</div>
      </div>

      {loading && <div className="ogt-hint">Đang tải...</div>}
      {error && <div className="ogt-error">{error}</div>}

      {!loading && !error && (
        <div className="ogt-list">
          {sorted.map(g => {
            const gid = g.id || g._id; const title = g.title || g.name || '(Không tiêu đề)';
            const open = expanded.has(gid);
            const values = Array.isArray(g.options) ? g.options : (Array.isArray(g.optionValues) ? g.optionValues : []);
            const totalLinked = counts[gid] ?? 0;
            return (
              <div key={gid} className={`ogt-item ${open?'open':''}`}>
                <div className="ogt-item-head" onClick={()=>toggle(gid)}>
                  <span className="ogt-caret">{open ? '▾' : '▸'}</span>
                  <div className="ogt-title">{title}</div>
                  <div className="ogt-meta">{g.required ? 'Bắt buộc' : 'Tùy chọn'} • {g.type === 'multi' ? 'Chọn nhiều' : 'Chọn 1'} • {values.length} lựa chọn • {totalLinked} món</div>
                </div>
                {open && (
                  <div className="ogt-values">
                    {!values.length && <div className="ogt-hint">Chưa có option value.</div>}
                    {values.map((v, i) => (
                      <div key={i} className="ogt-value-row">
                        <div className="ogt-value-name">{v.label || v.name}</div>
                        <div className="ogt-value-price">+ {(v.priceDelta ?? v.extraPrice ?? 0).toLocaleString?.('vi-VN') || (v.priceDelta ?? v.extraPrice ?? 0)}đ</div>
                      </div>
                    ))}
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
