import React, { useEffect, useMemo, useState } from 'react';
import './Info.css';
import merchantAPI from '../../api/merchantAPI';

// Weekday ordering helper
const WEEK_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const normalizeKey = (k = '') => String(k).toLowerCase();

const Info = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await merchantAPI.getMyMerchant();
        if (mounted) setData(res || null);
      } catch (e) {
        if (mounted) setError('Không thể tải thông tin nhà hàng.');
      } finally {
        if (mounted) setLoading(false);
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
        <h2 className="title">Thông tin Nhà Hàng</h2>

        <div className="row">
          <div className="label">Tên</div>
          <div className="value">{name}</div>
        </div>

        {introduction && (
          <div className="row">
            <div className="label">Giới thiệu</div>
            <div className="value prewrap">{introduction}</div>
          </div>
        )}

        {address && (
          <div className="row">
            <div className="label">Địa chỉ</div>
            <div className="value">{address}</div>
          </div>
        )}

        <div className="row">
          <div className="label">Đánh giá</div>
          <div className="value rating">
            {avgRating != null ? Number(avgRating).toFixed(1) : 'Chưa có'}
            <span className="muted">{` (${ratingCount} lượt)`}</span>
          </div>
        </div>

        {openingHours?.length > 0 && (
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

        {cuisineTypes?.length > 0 && (
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
      </div>
    </div>
  );
};

export default Info;
