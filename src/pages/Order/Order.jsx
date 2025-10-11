import React, { useCallback, useEffect, useMemo, useState } from "react";
import './Order.css';
import merchantAPI from "../../api/merchantAPI";

const toNumber = (value, fallback = 0) => {
	const num = Number(value);
	return Number.isFinite(num) ? num : fallback;
};

const formatCurrency = (amount) => `${toNumber(amount).toLocaleString('vi-VN')}₫`;

const formatDateTime = (value) => {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toLocaleString('vi-VN');
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

const normalizeStatus = (status) => {
	const s = String(status ?? '').toLowerCase();
	if (!s) return 'pending';
	if (['pending', 'processing', 'process', 'confirmed', 'preparing', 'awaiting', 'new'].includes(s)) {
		return 'pending';
	}
	if (['delivering', 'delivery', 'shipping', 'in_delivery', 'in-transit', 'in_transit', 'transporting'].includes(s)) {
		return 'delivering';
	}
	if (['delivered', 'completed', 'done', 'success', 'fulfilled', 'finished'].includes(s)) {
		return 'delivered';
	}
	if (['canceled', 'cancelled', 'rejected', 'failed', 'void'].includes(s)) {
		return 'canceled';
	}
	return s;
};

const statusClass = (status) => {
	const key = (status || '').toLowerCase();
	if (key === 'delivered') return 'status-delivered';
	if (key === 'delivering') return 'status-shipping';
	if (key === 'pending') return 'status-pending';
	if (key === 'canceled') return 'status-canceled';
	return 'status-pending';
};

const normalizeOption = (opt) => {
	if (!opt) return null;
	const name = opt.option
		?? opt.name
		?? opt.label
		?? opt.title
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

const TABS = [
	{ key: 'preparing', label: 'Đang chuẩn bị' },
	{ key: 'delivering', label: 'Đang giao' },
	{ key: 'history', label: 'Lịch sử' },
];

// Quy ước: status = 'pending' => Đang chuẩn bị, 'shipping' => Đang giao, 'delivered' hoặc 'canceled' => Lịch sử
const filterOrders = (orders, tab) => {
  if (tab === 'preparing') return orders.filter(o => o.status === 'pending');
  if (tab === 'delivering') return orders.filter(o => o.status === 'delivering');
  return orders.filter(o => o.status === 'delivered' || o.status === 'canceled');
};
const Order = () => {
	const [tab, setTab] = useState('preparing');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
			const list = await merchantAPI.getOrders();
			const normalizedList = normalizeOrders(list);
			const withDetails = await Promise.all(normalizedList.map(async (order) => {
				if (!order?.detailId) {
					return order;
				}
				try {
					const detail = await merchantAPI.getOrderDetail(order.detailId);
					const detailItems = normalizeItems(extractDetailItems(detail));
					const normalizedDetail = Array.isArray(detail) ? null : normalizeOrder(detail);
					return {
						...order,
						status: normalizedDetail?.status || order.status,
						statusRaw: normalizedDetail?.statusRaw ?? order.statusRaw,
						statusLabel: normalizedDetail?.statusLabel || order.statusLabel,
						created_at: normalizedDetail?.created_at || order.created_at,
						full_name: normalizedDetail?.full_name || order.full_name,
						phone: normalizedDetail?.phone || order.phone,
						address: normalizedDetail?.address || order.address,
						total_amount: normalizedDetail?.total_amount || order.total_amount,
						items: detailItems.length > 0 ? detailItems : (normalizedDetail?.items?.length ? normalizedDetail.items : order.items),
						payment: (normalizedDetail?.payment && normalizedDetail.payment.method)
							? normalizedDetail.payment
							: order.payment,
						detailError: undefined,
						detailId: order.detailId,
					};
				} catch (detailErr) {
					console.error('Failed to fetch order detail', detailErr);
					return {
						...order,
						detailError: detailErr?.response?.data?.message
							|| detailErr?.message
							|| 'Không thể tải chi tiết đơn hàng',
					};
				}
			}));
			setOrders(withDetails);
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

  const filteredOrders = useMemo(() => filterOrders(orders, tab), [orders, tab]);

	return (<div className="order-container">
			<h1 className="order-title">Quản lý Đơn Hàng</h1>
			<div className="order-tabs">
				{TABS.map(t => (
					<button
						key={t.key}
						className={tab === t.key ? 'order-tab active' : 'order-tab'}
						onClick={() => setTab(t.key)}
					>
						{t.label}
					</button>
				))}
			<button
				className="order-tab refresh"
				onClick={fetchOrders}
				disabled={loading}
			>
				{loading ? 'Đang tải…' : 'Làm mới'}
			</button>
			</div>
			<div className="order-list-cards">
			{error && <div style={{ color: '#d9534f', marginBottom: 16 }}>{error}</div>}
			{!loading && filteredOrders.length === 0 && !error && <div style={{textAlign:'center',color:'#888',marginTop:32}}>Không có đơn hàng nào.</div>}
			{loading && <div style={{textAlign:'center',color:'#555',marginTop:32}}>Đang tải danh sách đơn hàng…</div>}
			{!loading && filteredOrders.map(order => (
					<div className="order-card" key={order.id}>
						<div className="order-card-header">
							<span className="order-id">#{order.id}</span>
						<span className={`order-status ${statusClass(order.status)}`}>{order.statusLabel || order.status}</span>
						<span className="order-time">{formatDateTime(order.created_at)}</span>
						</div>
						<div className="order-card-body">
							<div><b>Khách:</b> {order.full_name} | <b>SĐT:</b> {order.phone}</div>
							<div><b>Địa chỉ:</b> {order.address}</div>
							<div><b>Phương thức thanh toán:</b> {order.payment.method} ({order.payment.status})</div>
							<div><b>Tổng tiền:</b> {formatCurrency(order.total_amount)}</div>
							<div><b>Món đã đặt:</b></div>
							{order.detailError && (
								<div style={{ color: '#d9534f', marginBottom: 8 }}>{order.detailError}</div>
							)}
							<ul style={{ margin: 0, paddingLeft: 18 }}>
								{order.items.length === 0 && <li>Không có món nào</li>}
								{order.items.map((item, idx) => (
									<li key={idx}>
										{item.name} x{item.quantity} ({formatCurrency(item.base_price)})
										{item.options && item.options.length > 0 && (
											<ul style={{ margin: 0, paddingLeft: 16 }}>
												{item.options.map((opt, i) => (
												<li  key={i}>{opt.option} {opt.extra_price > 0 && `(+${formatCurrency(opt.extra_price)})`}</li>
												))}
											</ul>
										)}
									</li>
								))}
							</ul>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
export default Order;