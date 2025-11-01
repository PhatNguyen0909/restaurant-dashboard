import React, { useCallback, useEffect, useMemo, useState } from "react";
import './Order.css';
import merchantAPI from "../../api/merchantAPI";
import { assets } from "../../assets/assets";

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
	if (key === 'pending') return 'status-pending';
	if (key === 'canceled') return 'status-canceled';
	return 'status-pending';
};

// Map normalized status to Vietnamese label
const statusLabelVN = (status) => {
	switch (status) {
		case 'pending':
			return 'Đang chuẩn bị';
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
		?? '';
	const extra = toNumber(
		opt.extra_price
			?? opt.extraPrice
			?? opt.price
			?? opt.amount
			?? opt.optionPrice
			?? opt.priceEach
			?? 0,
	);
	return {
		option: name || 'Tùy chọn',
		extra_price: extra,
	};
};

const normalizeItem = (item) => {
	if (!item) return null;
	const qty = toNumber(
		item.quantity
			?? item.qty
			?? item.count
			?? item.menuItemQuantity
			?? 1,
		1,
	) || 1;
	const base = toNumber(
		item.base_price
			?? item.basePrice
			?? item.price
			?? item.unitPrice
			?? item.menuItemBasePrice
			?? item.priceEach
			?? 0,
	);
	const subtotal = toNumber(
		item.subtotal
			?? item.line_total
			?? item.totalPrice
			?? item.menuItemTotalPrice
			?? base * qty,
	);
	const optionsRaw = item.options
		?? item.optionSelections
		?? item.selectedOptions
		?? item.option_items
		?? item.optionValues
		?? item.OptionValues
		?? [];
	const options = Array.isArray(optionsRaw) ? optionsRaw.map(normalizeOption).filter(Boolean) : [];
	return {
		dish_id: item.dish_id ?? item.dishId ?? item.id ?? item.menuItemId ?? item.itemId ?? item.menuItem ?? null,
		name: item.name
			?? item.dish_name
			?? item.dishName
			?? item.itemName
			?? item.menuItemName
			?? 'Sản phẩm',
		quantity: qty,
		base_price: base,
		subtotal,
		options,
	};
};

const normalizeItems = (itemsRaw) => {
	if (!Array.isArray(itemsRaw)) return [];
	return itemsRaw.map(normalizeItem).filter(Boolean);
};

const normalizeOrder = (order) => {
	if (!order || typeof order !== 'object') return null;
	const rawStatus = order.status ?? order.orderStatus ?? order.state ?? order.order_state ?? order.progress;
	const status = normalizeStatus(rawStatus);
	const detailId = extractOrderId(order);

		const customer = order.customer ?? order.customerInfo ?? order.user ?? {};
		const composedCustomerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || undefined;
		const fullName = order.full_name
			?? order.fullName
			?? customer.fullName
			?? customer.name
			?? composedCustomerName
			?? 'Khách hàng';

	const itemsRaw = order.items ?? order.orderItems ?? order.order_items ?? order.cartItems ?? [];
	const items = normalizeItems(itemsRaw);

	const payment = order.payment ?? order.paymentInfo ?? {};

	const createdAt = order.created_at
		?? order.createdAt
		?? order.created_date
		?? order.createdDate
		?? order.order_date
		?? order.orderDate;

	return {
		id: order.id
			?? order.orderId
			?? order._id
			?? order.code
			?? order.order_id
			?? order.uuid
			?? `${Date.now()}-${Math.random()}`,
		detailId,
		status,
		statusRaw: rawStatus,
		statusLabel: order.status_label ?? order.statusLabel ?? order.status_name ?? order.statusName ?? rawStatus ?? status,
		created_at: createdAt ?? new Date().toISOString(),
		full_name: fullName,
		phone: order.phone ?? order.phoneNumber ?? customer.phone ?? customer.phoneNumber ?? '',
		address: order.address ?? order.deliveryAddress ?? customer.address ?? '',
		total_amount: toNumber(order.total_amount ?? order.totalAmount ?? order.amount ?? order.grandTotal ?? order.total ?? 0),
		items,
		payment: {
			method: payment.method ?? payment.name ?? payment.type ?? payment.paymentMethod ?? 'N/A',
			status: payment.status ?? payment.state ?? payment.paymentStatus ?? 'unknown',
		},
	};
};

const normalizeOrders = (orders) => {
	if (!Array.isArray(orders)) return [];
	return orders.map(normalizeOrder).filter(Boolean);
};

const extractDetailItems = (detail) => {
	if (!detail) return [];
	if (Array.isArray(detail)) return detail;
	const candidates = [
		detail.items,
		detail.orderItems,
		detail.order_items,
		detail.menuItems,
		detail.menu_items,
		detail.data,
		detail.results,
		detail.records,
		detail.content,
	];
	for (const candidate of candidates) {
		if (Array.isArray(candidate)) return candidate;
	}
	return [];
};

const filterOrders = (orders, tab) => {
	if (tab === 'preparing') return orders.filter(o => o.status === 'pending');
	if (tab === 'delivering') return orders.filter(o => o.status === 'delivering');
	return orders.filter(o => o.status === 'delivered' || o.status === 'canceled');
};

const getAdvanceAction = (status) => {
	if (status === 'pending') {
		return { backendStatus: 'Delivering', label: 'Sẵn sàng' };
	}
	if (status === 'delivering') {
		return { backendStatus: 'Completed', label: 'Hoàn thành' };
	}
	return null;
};

const resolveErrorMessage = (error, fallback) => (
	error?.response?.data?.message || error?.message || fallback
);

const Order = () => {
	const [tab, setTab] = useState('preparing');
	const [orders, setOrders] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [detailModal, setDetailModal] = useState({ open: false, order: null });

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
						total_amount: normalizedDetail?.total_amount || o.total_amount,
						items: detailItems.length > 0 ? detailItems : (normalizedDetail?.items?.length ? normalizedDetail.items : o.items),
						payment: (normalizedDetail?.payment && normalizedDetail.payment.method)
							? normalizedDetail.payment
							: o.payment,
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

	const openDetailModal = useCallback((order) => {
		setDetailModal({ open: true, order });
		
		if (order.detailId && !order.detailLoaded && !order.detailLoading) {
			setOrders(prev => prev.map(o => 
				o.id === order.id ? { ...o, detailLoading: true, detailError: undefined } : o
			));
			fetchOrderDetail(order.id, order.detailId);
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
			setOrders(prev => prev.map(o => {
				if (o.id !== order.id) return o;
				return {
					...o,
					status: normalized,
					statusRaw: action.backendStatus,
					statusLabel: statusLabelVN(normalized),
				};
			}));
			closeDetailModal();
		} catch (err) {
			alert('Lỗi chuyển trạng thái: ' + resolveErrorMessage(err, 'Không thể cập nhật trạng thái đơn hàng'));
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
					const canCancel = order.status === 'pending' || order.status === 'delivering';
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
								</div>
							</div>

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