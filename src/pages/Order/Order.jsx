import React, { useCallback, useEffect, useMemo, useState } from "react";
import './Order.css';
import merchantAPI from "../../api/merchantAPI";
import { assets } from "../../assets/assets";
import DroneMap from "../../components/DroneMap/DroneMap";
import { loadMerchantCoordinates, saveMerchantCoordinates } from "../../utils/locationStorage";

const toNumber = (value, fallback = 0) => {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
};

const formatCurrency = (amount) => `${toNumber(amount).toLocaleString('vi-VN')}₫`;

const formatDateTime = (value) => {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const year = date.getFullYear();
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${hours}:${minutes} ${day}/${month}/${year}`;
};

const extractOrderId = (order) => {
	if (!order || typeof order !== 'object') return null;
	const candidates = [
		order.orderId,
		order.id,
		order.order_id,
		order.orderID,
		order.uuid,
		order.code,
		order.reference,
	];
	for (const candidate of candidates) {
		if (candidate === undefined || candidate === null || candidate === '') continue;
		const numeric = Number(candidate);
		if (Number.isFinite(numeric)) return numeric;
		return candidate;
	}
	return null;
};

// Map backend status to UI status
const normalizeStatus = (status) => {
	const s = String(status ?? '').trim().toUpperCase();
	switch (s) {
		case 'CONFIRMED':
			return 'pending'; // Đang chuẩn bị
		case 'READY':
			return 'ready'; // Đã sẵn sàng
		case 'DELIVERING':
			return 'delivering'; // Đang giao
		case 'COMPLETED':
			return 'delivered'; // Đã giao
		case 'CANCELED':
		case 'CANCELLED':
			return 'canceled'; // Đã hủy
		case 'DELIVERED':
			return 'delivered';
		default:
			return 'pending';
	}
};

const statusClass = (status) => {
	const key = (status || '').toLowerCase();
	if (key === 'delivered') return 'status-delivered';
	if (key === 'delivering') return 'status-shipping';
	if (key === 'ready') return 'status-shipping';
	if (key === 'pending') return 'status-pending';
	if (key === 'canceled') return 'status-canceled';
	return 'status-pending';
};

// Map normalized status to Vietnamese label
const statusLabelVN = (status) => {
	switch (status) {
		case 'pending':
			return 'Đang chuẩn bị';
		case 'ready':
			return 'Đã sẵn sàng';
		case 'delivering':
			return 'Đang giao';
		case 'delivered':
			return 'Hoàn thành';
		case 'canceled':
			return 'Đã hủy';
		default:
			return status;
	}
};

const normalizeOption = (opt) => {
	if (!opt) return null;
	const name = opt.option
		?? opt.name
		?? opt.label
		?? opt.title
		?? opt.optionValueName
		?? opt.OptionValueName
		?? opt.option_value_name
		?? opt.optionValue
		?? opt.optionName
		?? opt.value;
	
	if (!name) return null;

	return {
		option: name,
		extra_price: toNumber(opt.extra_price ?? opt.extraPrice ?? opt.price ?? 0)
	};
};

// Geocoding helper
const geocodeAddress = async (address) => {
    if (!address || address.trim().length < 3) return null
    
    // Fallback coordinates for common districts in HCMC
    const districtDefaults = {
      'q1': { lat: 10.7769, lng: 106.7009, name: 'Quận 1' },
      'quan 1': { lat: 10.7769, lng: 106.7009, name: 'Quận 1' },
      'quận 1': { lat: 10.7769, lng: 106.7009, name: 'Quận 1' },
      'q2': { lat: 10.7875, lng: 106.7399, name: 'Quận 2' },
      'q3': { lat: 10.7866, lng: 106.6831, name: 'Quận 3' },
      'q4': { lat: 10.7628, lng: 106.7032, name: 'Quận 4' },
      'q5': { lat: 10.7542, lng: 106.6662, name: 'Quận 5' },
      'q6': { lat: 10.7471, lng: 106.6357, name: 'Quận 6' },
      'q7': { lat: 10.7355, lng: 106.7217, name: 'Quận 7' },
      'q8': { lat: 10.7376, lng: 106.6761, name: 'Quận 8' },
      'quan 8': { lat: 10.7376, lng: 106.6761, name: 'Quận 8' },
      'quận 8': { lat: 10.7376, lng: 106.6761, name: 'Quận 8' },
      'q10': { lat: 10.7726, lng: 106.6677, name: 'Quận 10' },
      'q11': { lat: 10.7632, lng: 106.6503, name: 'Quận 11' },
      'q12': { lat: 10.8563, lng: 106.6717, name: 'Quận 12' },
      'binh thanh': { lat: 10.8142, lng: 106.7068, name: 'Bình Thạnh' },
      'tan binh': { lat: 10.8004, lng: 106.6524, name: 'Tân Bình' },
      'phu nhuan': { lat: 10.7991, lng: 106.6831, name: 'Phú Nhuận' },
      'thu duc': { lat: 10.8505, lng: 106.7620, name: 'Thủ Đức' },
    }

    // Check if address matches a known district (case insensitive)
    const normalizedAddr = address.toLowerCase().trim()
    for (const [key, coords] of Object.entries(districtDefaults)) {
      if (normalizedAddr.includes(key)) {
        return { lat: coords.lat, lng: coords.lng }
      }
    }

    // Try Nominatim geocoding
    try {
      // Enhance short addresses with "Ho Chi Minh" for better results
      const enhancedAddress = normalizedAddr.includes('hcm') || normalizedAddr.includes('ho chi minh') 
        ? address 
        : `${address}, Ho Chi Minh City, Vietnam`
        
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enhancedAddress)}&countrycodes=vn&limit=1&accept-language=vi`
      )
      const data = await response.json()
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error)
    }
    
    // If all fails, return HCMC center as last resort
    return { lat: 10.8231, lng: 106.6297 }
}

const resolveErrorMessage = (err, defaultMsg) => {
    return err?.response?.data?.message || err?.message || defaultMsg;
};

const normalizeItems = (items) => {
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
        name: item.menuItemName || item.name || item.productName || 'Món ăn',
        quantity: toNumber(item.quantity || item.qty),
        base_price: toNumber(item.menuItemBasePrice || item.basePrice || item.price || item.subtotal / (item.quantity || 1)),
        options: (item.optionValues || item.options || []).map(normalizeOption).filter(Boolean),
        note: item.note || ''
    }));
};

const extractDetailItems = (detail) => {
    if (!detail) return [];
    return detail.items || detail.orderItems || detail.order_items || [];
};

const parseCoordinate = (value) => {
	if (value === null || value === undefined || value === '') return null;
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
};

const normalizeDroneInfo = (drone) => {
	if (!drone || typeof drone !== 'object') return null;
	return {
		id: drone.id,
		code: drone.code || drone.droneCode,
		status: drone.status,
		latitude: parseCoordinate(drone.latitude),
		longitude: parseCoordinate(drone.longitude),
	};
};

const normalizeOrder = (order) => {
	if (!order) return null;
	const latitude = parseCoordinate(order.latitude || order.customerLatitude);
	const longitude = parseCoordinate(order.longitude || order.customerLongitude);
	return {
		id: extractOrderId(order),
		status: normalizeStatus(order.status),
		statusRaw: order.status,
		statusLabel: statusLabelVN(normalizeStatus(order.status)),
		created_at: order.createdAt || order.created_at,
		full_name: order.fullName || order.full_name || order.customerName || 'Khách lẻ',
		phone: order.phone || order.phoneNumber || '',
		address: order.address || order.deliveryAddress || '',
		note: order.note || order.notes || '',
		total_amount: toNumber(order.totalAmount || order.total_amount),
		items: normalizeItems(order.items || order.orderItems || order.order_items),
		payment: {
			method: order.paymentMethod || order.payment_method || 'COD',
			status: order.paymentStatus || order.payment_status || 'PENDING'
		},
		detailId: order._id || order.id,
		customerLatitude: latitude,
		customerLongitude: longitude,
		drone: normalizeDroneInfo(order.drone),
	};
};

const normalizeOrders = (list) => {
    if (!Array.isArray(list)) return [];
    return list.map(normalizeOrder);
};

const filterOrders = (list, tab) => {
    if (!Array.isArray(list)) return [];
    return list.filter(order => {
        const status = normalizeStatus(order.status);
        if (tab === 'preparing') return status === 'pending' || status === 'ready';
        if (tab === 'delivering') return status === 'delivering';
        if (tab === 'history') return status === 'delivered' || status === 'canceled';
        return true;
    });
};

const getAdvanceAction = (status) => {
    const s = normalizeStatus(status);
	if (s === 'pending') return { label: 'Sẵn sàng', backendStatus: 'READY' };
    return null;
};

const Order = () => {
	const [tab, setTab] = useState('preparing');
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [detailModal, setDetailModal] = useState({ open: false, order: null });
	const [merchantInfo, setMerchantInfo] = useState(null);
	const [merchantCoords, setMerchantCoords] = useState(null);
	const [deliveryCoords, setDeliveryCoords] = useState(null);
	const [geocoding, setGeocoding] = useState(false);

	useEffect(() => {
		const cached = loadMerchantCoordinates();
		if (cached && Number.isFinite(cached.latitude) && Number.isFinite(cached.longitude)) {
			setMerchantCoords({ lat: cached.latitude, lng: cached.longitude });
		}
	}, []);

	useEffect(() => {
		const fetchMerchantInfo = async () => {
			try {
				const info = await merchantAPI.getMyMerchant();
				setMerchantInfo(info);
				const lat = Number(info?.latitude);
				const lng = Number(info?.longitude);
				if (Number.isFinite(lat) && Number.isFinite(lng)) {
					const coords = { lat, lng };
					setMerchantCoords(coords);
					saveMerchantCoordinates({ latitude: lat, longitude: lng });
				} else if (info?.address) {
					const coords = await geocodeAddress(info.address);
					if (coords) {
						setMerchantCoords(coords);
						saveMerchantCoordinates(coords);
					}
				}
			} catch (err) {
				console.error('Failed to fetch merchant info', err);
			}
		};
		fetchMerchantInfo();
	}, []);

		const fetchOrders = useCallback(async () => {
			setLoading(true);
			setError('');
			try {
				const list = await merchantAPI.getOrders();
				const normalizedList = normalizeOrders(list).map(order => ({
					...order,
					detailLoaded: !order.detailId || (order.items && order.items.length > 0),
					detailLoading: false,
					detailError: undefined,
				}));
				setOrders(normalizedList);
			} catch (err) {
				setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách đơn hàng');
				setOrders([]);
			} finally {
				setLoading(false);
			}
		}, []);

		useEffect(() => {
			fetchOrders();
		}, [fetchOrders]);

		const fetchOrderDetail = useCallback(async (orderId, detailId) => {
			try {
				const detail = await merchantAPI.getOrderDetail(detailId);
				const detailItems = normalizeItems(extractDetailItems(detail));
				const normalizedDetail = Array.isArray(detail) ? null : normalizeOrder(detail);
				setOrders(prev => prev.map(o => {
					if (o.id !== orderId) return o;
					return {
						...o,
						status: normalizedDetail?.status || o.status,
						statusRaw: normalizedDetail?.statusRaw ?? o.statusRaw,
						statusLabel: normalizedDetail?.statusLabel || o.statusLabel,
						created_at: normalizedDetail?.created_at || o.created_at,
						full_name: normalizedDetail?.full_name || o.full_name,
						phone: normalizedDetail?.phone || o.phone,
						address: normalizedDetail?.address || o.address,
						note: normalizedDetail?.note || o.note,
						total_amount: normalizedDetail?.total_amount || o.total_amount,
						items: detailItems.length > 0 ? detailItems : (normalizedDetail?.items?.length ? normalizedDetail.items : o.items),
						payment: (normalizedDetail?.payment && normalizedDetail.payment.method)
							? normalizedDetail.payment
							: o.payment,
						customerLatitude: normalizedDetail?.customerLatitude ?? o.customerLatitude,
						customerLongitude: normalizedDetail?.customerLongitude ?? o.customerLongitude,
						drone: normalizedDetail?.drone ?? o.drone,
						detailError: undefined,
						detailLoaded: true,
						detailLoading: false,
					};
				}));
			} catch (detailErr) {
				console.error('Failed to fetch order detail', detailErr);
				setOrders(prev => prev.map(o => {
					if (o.id !== orderId) return o;
					return {
						...o,
						detailError: detailErr?.response?.data?.message
							|| detailErr?.message
							|| 'Không thể tải chi tiết đơn hàng',
						detailLoaded: false,
						detailLoading: false,
					};
				}));
			}
		}, []);

		const filteredOrders = useMemo(() => filterOrders(orders, tab), [orders, tab]);

	// Sync detailModal with orders state
	useEffect(() => {
		if (detailModal.open && detailModal.order) {
			const currentOrder = orders.find(o => o.id === detailModal.order.id);
			if (currentOrder) {
				// Only update if there are changes to avoid infinite loops if object reference changes but content is same
				// But here we rely on setDetailModal to just update the reference.
				// To be safe, we can check if specific fields changed or just update.
				// Since setDetailModal triggers re-render, and this effect runs on [orders], 
				// and orders updates only on fetch/action, it should be fine.
				setDetailModal(prev => ({ ...prev, order: currentOrder }));
			}
		}
	}, [orders]);

	const openDetailModal = useCallback(async (order) => {
		setDetailModal({ open: true, order });
		setDeliveryCoords(null);
		setGeocoding(false);
		const hasBackendCoords = Number.isFinite(order?.customerLatitude) && Number.isFinite(order?.customerLongitude);
		if (hasBackendCoords) {
			setDeliveryCoords({ lat: order.customerLatitude, lng: order.customerLongitude });
		} else {
			setGeocoding(true);
			if (order.address) {
				const coords = await geocodeAddress(order.address);
				if (coords) setDeliveryCoords(coords);
			}
			setGeocoding(false);
		}
		
		if (!order.detailLoaded && !order.detailLoading) {
			fetchOrderDetail(order.id, order.detailId || order.id);
		}
	}, [fetchOrderDetail]);

	const closeDetailModal = () => {
		setDetailModal({ open: false, order: null });
	};

	const handleAdvanceStatus = async (order) => {
		const action = getAdvanceAction(order?.status);
		if (!action) return;
		const targetId = order?.detailId ?? order?.id;
		if (!targetId) {
			alert('Không tìm thấy mã đơn hàng để cập nhật trạng thái.');
			return;
		}
		try {
			await merchantAPI.updateOrderStatus(targetId, action.backendStatus);
			const normalized = normalizeStatus(action.backendStatus);
			const nextOrderState = {
				...order,
				status: normalized,
				statusRaw: action.backendStatus,
				statusLabel: statusLabelVN(normalized),
				detailLoaded: action.backendStatus === 'READY' ? false : order.detailLoaded,
				detailLoading: false,
			};

			// Update local state
			setOrders(prev => prev.map(o => (o.id === order.id ? nextOrderState : o)));

			if (action.backendStatus === 'READY') {
				openDetailModal(nextOrderState);
			} else {
				closeDetailModal();
			}
		} catch (err) {
			alert('Lỗi chuyển trạng thái: ' + resolveErrorMessage(err, 'Không thể cập nhật trạng thái đơn hàng'));
		}
	};

	const handleStartDelivery = async (order) => {
		const targetId = order?.detailId ?? order?.id;
		if (!targetId) {
			alert('Không tìm thấy mã đơn hàng để bắt đầu giao.');
			return;
		}
		try {
			await merchantAPI.updateOrderStatus(targetId, 'DELIVERING');
			const nextOrderState = {
				...order,
				status: 'delivering',
				statusRaw: 'DELIVERING',
				statusLabel: statusLabelVN('delivering'),
			};
			setOrders(prev => prev.map(o => (o.id === order.id ? nextOrderState : o)));
			setDetailModal(prev => ({ ...prev, order: nextOrderState }));
		} catch (err) {
			alert('Lỗi bắt đầu giao hàng: ' + resolveErrorMessage(err, 'Không thể cập nhật trạng thái'));
		}
	};

	const handleCancel = async (order) => {
		const targetId = order?.detailId ?? order?.id;
		if (!targetId) {
			alert('Không tìm thấy mã đơn hàng để hủy.');
			return;
		}
		const confirmCancel = window.confirm('Bạn có chắc muốn hủy đơn hàng này?');
		if (!confirmCancel) return;
		const reason = window.prompt('Vui lòng nhập lý do hủy đơn:', 'Khách từ chối nhận hàng');
		if (reason === null) return;
		const trimmedReason = String(reason).trim();
		try {
			await merchantAPI.updateOrderStatus(targetId, 'Canceled', trimmedReason || undefined);
			setOrders(prev => prev.map(o => {
				if (o.id !== order.id) return o;
				return {
					...o,
					status: 'canceled',
					statusRaw: 'Canceled',
					statusLabel: statusLabelVN('canceled'),
				};
			}));
			closeDetailModal();
		} catch (err) {
			alert('Lỗi hủy đơn: ' + resolveErrorMessage(err, 'Không thể cập nhật trạng thái đơn hàng'));
		}
	};

	const getTabCount = (tabKey) => {
		return filterOrders(orders, tabKey).length;
	};

	return (
		<div className="order-page">
			{/* Header */}
			<div className="order-header">
				<h1 className="order-title">Quản lý Đơn Hàng</h1>
				<p className="order-subtitle">Theo dõi và quản lý tất cả đơn hàng</p>
			</div>

			{/* Tabs with counts */}
			<div className="order-tabs-wrapper">
				<div className="order-tabs">
					<button
						className={`order-tab ${tab === 'preparing' ? 'active' : ''}`}
						onClick={() => setTab('preparing')}
					>
						<img src={assets.clock} alt="Đang chuẩn bị" className="tab-icon" />
						<span>Đang chuẩn bị</span>
						<span className="tab-count">{getTabCount('preparing')}</span>
					</button>
					<button
						className={`order-tab ${tab === 'delivering' ? 'active' : ''}`}
						onClick={() => setTab('delivering')}
					>
						<img src={assets.delivery} alt="Đang giao" className="tab-icon" />
						<span>Đang giao</span>
						<span className="tab-count">{getTabCount('delivering')}</span>
					</button>
					<button
						className={`order-tab ${tab === 'history' ? 'active' : ''}`}
						onClick={() => setTab('history')}
					>
						<img src={assets.checked} alt="Hoàn thành" className="tab-icon" />
						<span>Lịch sử</span>
						<span className="tab-count">{getTabCount('history')}</span>
					</button>
				</div>
				<button
					className="order-refresh-btn"
					onClick={fetchOrders}
					disabled={loading}
					title="Làm mới"
				>
					<img src={assets.refresh} alt="Làm mới" />
					{loading ? 'Đang tải...' : 'Làm mới'}
				</button>
			</div>

			{/* Order List */}
			<div className="order-list">
				{error && <div className="order-error">{error}</div>}
				{!loading && filteredOrders.length === 0 && !error && (
					<div className="order-empty">Không có đơn hàng nào</div>
				)}
				{!loading && filteredOrders.map(order => {
					const advanceAction = getAdvanceAction(order.status);
					const canCancel = order.status === 'pending';
					return (
					<div key={order.id} className="order-card" onClick={() => openDetailModal(order)}>
						<div className="order-card-header">
							<span className="order-number">#{order.id}</span>
							<span className={`order-badge order-badge-${order.status}`}>
								{statusLabelVN(order.status)}
							</span>
						</div>
						<div className="order-card-body">
							<div className="order-info-row">
								<span className="order-info-label">Thời gian:</span>
								<span className="order-info-value order-time">{formatDateTime(order.created_at)}</span>
							</div>
							<div className="order-info-row">
								<span className="order-info-label">Tổng tiền:</span>
								<span className="order-info-value order-info-value--amount">{formatCurrency(order.total_amount)}</span>
							</div>
						</div>
						<div className="order-card-actions">
							{canCancel && (
								<button
									className="order-btn-cancel"
									onClick={(e) => {
										e.stopPropagation();
										handleCancel(order);
									}}
								>
									Hủy đơn
								</button>
							)}
							{advanceAction && (
								<button 
									className="order-btn-complete"
									onClick={(e) => {
										e.stopPropagation();
										handleAdvanceStatus(order);
									}}
								>
									{advanceAction.label}
								</button>
							)}
						</div>
					</div>
					);
				})}
			</div>

			{/* Detail Modal */}
			{detailModal.open && detailModal.order && (
				<div className="order-modal-overlay" onClick={closeDetailModal}>
					<div className="order-modal" onClick={(e) => e.stopPropagation()}>
						<div className="order-modal-header">
							<h2>Chi tiết đơn hàng #{detailModal.order.id}</h2>
							<button className="order-modal-close" onClick={closeDetailModal}>✕</button>
						</div>
						<div className="order-modal-body">
							<div className="order-modal-section">
								<h3>Thông tin chi tiết về đơn hàng</h3>
								<div className="order-detail-grid">
									<div className="order-detail-item">
										<span className="order-detail-label">Khách hàng:</span>
										<span className="order-detail-value">{detailModal.order.full_name}</span>
									</div>
									<div className="order-detail-item">
										<span className="order-detail-label">Số điện thoại:</span>
										<span className="order-detail-value">{detailModal.order.phone}</span>
									</div>
									<div className="order-detail-item">
										<span className="order-detail-label">Địa chỉ:</span>
										<span className="order-detail-value">{detailModal.order.address}</span>
									</div>
									<div className="order-detail-item">
										<span className="order-detail-label">Thời gian:</span>
										<span className="order-detail-value">{formatDateTime(detailModal.order.created_at)}</span>
									</div>
									<div className="order-detail-item">
										<span className="order-detail-label">Thanh toán:</span>
										<span className="order-detail-value">{detailModal.order.payment.method} ({detailModal.order.payment.status})</span>
									</div>
									{detailModal.order.note && (
										<div className="order-detail-item order-detail-item-note">
											<span className="order-detail-label">Ghi chú:</span>
											<span className="order-detail-value order-detail-note-text">{detailModal.order.note}</span>
										</div>
									)}
									{detailModal.order.drone && (
										<div className="order-detail-item order-detail-item-drone">
											<span className="order-detail-label">Drone:</span>
											<span className="order-detail-value">
												{detailModal.order.drone.code || detailModal.order.drone.id} 
												<span className={`drone-status-badge ${detailModal.order.drone.status?.toLowerCase()}`}>
													({detailModal.order.drone.status})
												</span>
											</span>
										</div>
									)}
								</div>
							</div>

							{/* Drone Map Section */}
							{(() => {
								const statusKey = normalizeStatus(detailModal.order.status);
								const canTrack = detailModal.order.drone && ['ready', 'delivering', 'delivered'].includes(statusKey);
								if (!canTrack) return null;
								return (
									<div className="order-modal-section">
										<h3>Theo dõi đơn hàng</h3>
										{geocoding && <div className="order-loading-text">Đang xác định vị trí...</div>}
										{!geocoding && merchantCoords && deliveryCoords && (
											<DroneMap
												merchantLocation={{
													lat: merchantCoords.lat,
													lng: merchantCoords.lng,
													name: merchantInfo?.name || 'Cửa hàng'
												}}
												deliveryLocation={{
													lat: deliveryCoords.lat,
													lng: deliveryCoords.lng,
													address: detailModal.order.address
												}}
												droneLocation={detailModal.order.drone ? {
													lat: detailModal.order.drone.latitude,
													lng: detailModal.order.drone.longitude
												} : null}
												droneId={detailModal.order.drone?.id}
												droneStatus={detailModal.order.drone?.status}
												orderStatus={(() => {
													if (statusKey === 'delivering') return 'DELIVERING';
													if (statusKey === 'delivered') return 'COMPLETED';
													if (statusKey === 'ready') return 'READY';
													return 'CONFIRMED';
												})()}
												autoAnimate={true}
												orderKey={detailModal.order.id}
												canStartDelivery={statusKey === 'ready'}
												onStartDelivery={() => handleStartDelivery(detailModal.order)}
											/>
										)}
										{!geocoding && (!merchantCoords || !deliveryCoords) && (
											<div className="order-error-text">Không thể hiển thị bản đồ do thiếu thông tin vị trí.</div>
										)}
									</div>
								);
							})()}

							<div className="order-modal-section">
								<h3>Món đã đặt:</h3>
								{detailModal.order.detailLoading && (
									<div className="order-loading-text">Đang tải chi tiết...</div>
								)}
								{detailModal.order.detailError && (
									<div className="order-error-text">{detailModal.order.detailError}</div>
								)}
								<ul className="order-modal-items">
									{detailModal.order.items.length === 0 && !detailModal.order.detailLoading && (
										<li>Không có món nào</li>
									)}
									{detailModal.order.items.map((item, idx) => (
										<li key={idx} className="order-modal-item">
											<div className="order-modal-item-header">
												<span className="order-modal-item-name">{item.name}</span>
												<span className="order-modal-item-qty">x{item.quantity}</span>
												<span className="order-modal-item-price">{formatCurrency(item.base_price * item.quantity)}</span>
											</div>
											{item.options && item.options.length > 0 && (
												<ul className="order-modal-item-options">
													{item.options.map((opt, i) => (
														<li key={i}>
															{opt.option} {opt.extra_price > 0 && `(+${formatCurrency(opt.extra_price)})`}
														</li>
													))}
												</ul>
											)}
											{item.note && (
												<div className="order-modal-item-note">
													<span className="order-modal-item-note-label">📝 Ghi chú:</span>
													<span className="order-modal-item-note-text">{item.note}</span>
												</div>
											)}
										</li>
									))}
								</ul>
							</div>

							<div className="order-modal-total">
								<span>Tổng tiền:</span>
								<span className="order-modal-total-amount">{formatCurrency(detailModal.order.total_amount)}</span>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Order;