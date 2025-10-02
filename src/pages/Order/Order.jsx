import React, { useState } from "react";
import { order_list } from '../../assets/assets';
import './Order.css';

const formatCurrency = (amount) => amount.toLocaleString('vi-VN') + '₫';

const statusClass = (status) =>
	status === 'delivered' ? 'status-delivered' :
	status === 'delivering' ? 'status-shipping' :
	status === 'pending' ? 'status-pending' :
	'status-canceled';

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
	const orders = filterOrders(order_list, tab);
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
			</div>
			<div className="order-list-cards">
				{orders.length === 0 && <div style={{textAlign:'center',color:'#888',marginTop:32}}>Không có đơn hàng nào.</div>}
				{orders.map(order => (
					<div className="order-card" key={order.id}>
						<div className="order-card-header">
							<span className="order-id">#{order.id}</span>
							<span className={`order-status ${statusClass(order.status)}`}>{order.status}</span>
							<span className="order-time">{new Date(order.created_at).toLocaleString('vi-VN')}</span>
						</div>
						<div className="order-card-body">
							<div><b>Khách:</b> {order.full_name} | <b>SĐT:</b> {order.phone}</div>
							<div><b>Địa chỉ:</b> {order.address}</div>
							<div><b>Phương thức thanh toán:</b> {order.payment.method} ({order.payment.status})</div>
							<div><b>Tổng tiền:</b> {formatCurrency(order.total_amount)}</div>
							<div><b>Món đã đặt:</b></div>
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