import React, { useCallback, useEffect, useState } from 'react';
import './Feedback.css';
import merchantAPI from '../../api/merchantAPI';

const MERCHANT_REPLY_ROLES = ['MERCHANT_ADMIN'];

const getFeedbackRole = (feedback) => {
  if (!feedback || typeof feedback !== 'object') return '';
  const roleCandidates = [
    feedback.role,
    feedback.userRole,
    feedback.user?.role,
    feedback.customer?.role,
    feedback.customerInfo?.role,
  ];
  for (const candidate of roleCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toUpperCase();
    }
  }
  return '';
};

const isMerchantReplyEntry = (feedback) => MERCHANT_REPLY_ROLES.includes(getFeedbackRole(feedback));

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

const normalizeFeedback = (order) => {
  if (!order || typeof order !== 'object' || !Array.isArray(order.feedbacks)) return null;
  
  // Find customer feedback and merchant reply
  const customerFeedback = order.feedbacks.find(fb => 
    fb?.user?.role === 'CUSTOMER'
  );
  const merchantReply = order.feedbacks.find(fb => 
    fb?.user?.role === 'MERCHANT_ADMIN'
  );

  // If no customer feedback, skip this order
  if (!customerFeedback) return null;

  const customer = customerFeedback.user ?? {};
  const fullName = order.fullName 
    ?? customer.fullName 
    ?? customer.name 
    ?? 'Khách hàng';

  // Normalize images
  const rawImages = customerFeedback.imgUrl ?? customerFeedback.images ?? [];
  const images = Array.isArray(rawImages) ? rawImages.filter(img => img && typeof img === 'string') : [];

  return {
    id: customerFeedback.id,
    customerName: fullName,
    rating: Number(customerFeedback.rating ?? 0),
    comment: customerFeedback.comment ?? '',
    reply: merchantReply?.comment ?? '',
    createdAt: customerFeedback.createdAt ?? new Date().toISOString(),
    orderId: order.code ?? order.id,
    images: images,
  };
};

const normalizeFeedbacks = (orders) => {
  if (!Array.isArray(orders)) return [];
  return orders
    .map(normalizeFeedback)
    .filter(Boolean);
};

const StarRating = ({ rating }) => {
  return (
    <div className="feedback-stars">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`star ${star <= rating ? 'filled' : ''}`}>
          ★
        </span>
      ))}
    </div>
  );
};

const ImageGallery = ({ images }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <>
      <div className="feedback-images">
        {images.slice(0, 4).map((img, idx) => (
          <div 
            key={idx} 
            className="feedback-image-wrapper"
            onClick={() => openLightbox(idx)}
          >
            <img src={img} alt={`Đánh giá ${idx + 1}`} className="feedback-image" />
            {idx === 3 && images.length > 4 && (
              <div className="feedback-image-overlay">
                +{images.length - 4}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="feedback-lightbox" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M18 6L6 18" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          
          {images.length > 1 && (
            <>
              <button 
                className="lightbox-prev" 
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button 
                className="lightbox-next" 
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </>
          )}

          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={images[lightboxIndex]} alt={`Đánh giá ${lightboxIndex + 1}`} />
            {images.length > 1 && (
              <div className="lightbox-counter">
                {lightboxIndex + 1} / {images.length}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const Feedback = () => {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [replyModal, setReplyModal] = useState({ open: false, feedback: null });
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all'); // all, replied, pending
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 4;

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const orders = await merchantAPI.getOrders();
      // Only process orders that have feedbacks
      const ordersWithFeedbacks = orders.filter(order => 
        Array.isArray(order.feedbacks) && order.feedbacks.length > 0
      );
      const normalized = normalizeFeedbacks(ordersWithFeedbacks);
      setFeedbacks(normalized);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Không thể tải danh sách feedback');
      setFeedbacks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  const openReplyModal = (feedback) => {
    setReplyModal({ open: true, feedback });
    setReplyText(feedback.reply || '');
  };

  const closeReplyModal = () => {
    setReplyModal({ open: false, feedback: null });
    setReplyText('');
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) {
      alert('Vui lòng nhập nội dung phản hồi');
      return;
    }

    setSubmitting(true);
    try {
      await merchantAPI.replyFeedback(replyModal.feedback.id, replyText);
      
      // Update local state
      setFeedbacks(prev => prev.map(fb => 
        fb.id === replyModal.feedback.id 
          ? { ...fb, reply: replyText.trim() }
          : fb
      ));
      
      closeReplyModal();
      alert('Phản hồi thành công!');
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Không thể gửi phản hồi');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFeedbacks = feedbacks.filter(fb => {
    if (filter === 'replied') return fb.reply;
    if (filter === 'pending') return !fb.reply;
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredFeedbacks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedFeedbacks = filteredFeedbacks.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const getFilterCount = (filterType) => {
    if (filterType === 'replied') return feedbacks.filter(fb => fb.reply).length;
    if (filterType === 'pending') return feedbacks.filter(fb => !fb.reply).length;
    return feedbacks.length;
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="feedback-page">
      {/* Header */}
      <div className="feedback-header">
        <div className="feedback-header-text">
          <h1 className="feedback-title">Đánh giá của Khách hàng</h1>
          <p className="feedback-subtitle">Quản lý và phản hồi đánh giá từ khách hàng</p>
        </div>
        <button
          className="feedback-refresh-btn"
          onClick={fetchFeedbacks}
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M17.5 10C17.5 14.1421 14.1421 17.5 10 17.5C5.85786 17.5 2.5 14.1421 2.5 10C2.5 5.85786 5.85786 2.5 10 2.5C12.0711 2.5 13.9461 3.35786 15.3033 4.75"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M13 2.5H17.5V7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {loading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="feedback-filters">
        <button
          className={`feedback-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          <span>Tất cả</span>
          <span className="filter-count">{getFilterCount('all')}</span>
        </button>
        <button
          className={`feedback-filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          <span>Chưa phản hồi</span>
          <span className="filter-count">{getFilterCount('pending')}</span>
        </button>
        <button
          className={`feedback-filter-btn ${filter === 'replied' ? 'active' : ''}`}
          onClick={() => setFilter('replied')}
        >
          <span>Đã phản hồi</span>
          <span className="filter-count">{getFilterCount('replied')}</span>
        </button>
      </div>

      {/* Feedback List */}
      <div className="feedback-list">
        {error && <div className="feedback-error">{error}</div>}
        
        {!loading && filteredFeedbacks.length === 0 && !error && (
          <div className="feedback-empty">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="30" stroke="#E5E7EB" strokeWidth="2"/>
              <path d="M20 38C20 38 24 34 32 34C40 34 44 38 44 38" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="24" cy="26" r="2" fill="#9CA3AF"/>
              <circle cx="40" cy="26" r="2" fill="#9CA3AF"/>
            </svg>
            <p>Chưa có đánh giá nào</p>
          </div>
        )}

        {paginatedFeedbacks.map(feedback => (
          <div key={feedback.id} className="feedback-card">
            <div className="feedback-card-header">
              <div className="feedback-customer">
                <div className="feedback-avatar">
                  {feedback.customerName.charAt(0).toUpperCase()}
                </div>
                <div className="feedback-customer-info">
                  <h3 className="feedback-customer-name">{feedback.customerName}</h3>
                  <span className="feedback-date">{formatDateTime(feedback.createdAt)}</span>
                </div>
              </div>
              <StarRating rating={feedback.rating} />
            </div>

            <div className="feedback-card-body">
              <p className="feedback-comment">{feedback.comment}</p>
              
              {/* Image Gallery */}
              {feedback.images && feedback.images.length > 0 && (
                <ImageGallery images={feedback.images} />
              )}
              
              {feedback.orderId && (
                <div className="feedback-order-ref">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 2H14C14.5523 2 15 2.44772 15 3V13C15 13.5523 14.5523 14 14 14H2C1.44772 14 1 13.5523 1 13V3C1 2.44772 1.44772 2 2 2Z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <path d="M5 2V14" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  <span>Đơn hàng #{feedback.orderId}</span>
                </div>
              )}

              {feedback.reply ? (
                <div className="feedback-reply-box">
                  <div className="feedback-reply-header">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M14 8C14 11.3137 11.3137 14 8 14C6.5 14 5.16667 13.5 4 12.6667L2 14V11C2 7.68629 4.68629 5 8 5C11.3137 5 14 7.68629 14 8Z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="feedback-reply-label">Phản hồi của bạn:</span>
                  </div>
                  <p className="feedback-reply-text">{feedback.reply}</p>
                </div>
              ) : (
                <button
                  className="feedback-reply-btn"
                  onClick={() => openReplyModal(feedback)}
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path
                      d="M16 9C16 12.866 12.866 16 9 16C7.28889 16 5.72222 15.4222 4.5 14.4444L2 16V12C2 8.13401 5.13401 5 9 5C12.866 5 16 8.13401 16 9Z"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M6 9H12M9 6V12"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  Phản hồi đánh giá
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!loading && filteredFeedbacks.length > 0 && totalPages > 1 && (
        <div className="feedback-pagination">
          <button
            className="pagination-btn"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M12.5 15L7.5 10L12.5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="pagination-btn-text">Trước</span>
          </button>

          <div className="pagination-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first page, last page, current page, and pages around current
              const showPage = 
                page === 1 || 
                page === totalPages || 
                (page >= currentPage - 1 && page <= currentPage + 1);
              
              const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
              const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

              if (showEllipsisBefore || showEllipsisAfter) {
                return (
                  <span key={page} className="pagination-ellipsis">
                    ...
                  </span>
                );
              }

              if (!showPage) return null;

              return (
                <button
                  key={page}
                  className={`pagination-number ${page === currentPage ? 'active' : ''}`}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            className="pagination-btn"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <span className="pagination-btn-text">Sau</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M7.5 15L12.5 10L7.5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Reply Modal */}
      {replyModal.open && replyModal.feedback && (
        <div className="feedback-modal-overlay" onClick={closeReplyModal}>
          <div className="feedback-modal" onClick={(e) => e.stopPropagation()}>
            <div className="feedback-modal-header">
              <h2>Phản hồi đánh giá</h2>
              <button className="feedback-modal-close" onClick={closeReplyModal}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M5 5L15 15M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="feedback-modal-body">
              {/* Original Feedback */}
              <div className="feedback-modal-original">
                <div className="feedback-modal-customer">
                  <div className="feedback-modal-avatar">
                    {replyModal.feedback.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4>{replyModal.feedback.customerName}</h4>
                    <StarRating rating={replyModal.feedback.rating} />
                  </div>
                </div>
                <p className="feedback-modal-comment">{replyModal.feedback.comment}</p>
              </div>

              {/* Reply Form */}
              <form onSubmit={handleReplySubmit} className="feedback-reply-form">
                <label className="feedback-form-label">
                  Nội dung phản hồi <span className="required">*</span>
                </label>
                <textarea
                  className="feedback-form-textarea"
                  placeholder="Cảm ơn bạn đã đánh giá. Chúng tôi rất vui vì..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                  disabled={submitting}
                  required
                />

                <div className="feedback-modal-actions">
                  <button
                    type="button"
                    className="feedback-btn-cancel"
                    onClick={closeReplyModal}
                    disabled={submitting}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="feedback-btn-submit"
                    disabled={submitting || !replyText.trim()}
                  >
                    {submitting ? 'Đang gửi...' : 'Gửi phản hồi'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;
