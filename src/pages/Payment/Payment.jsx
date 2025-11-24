import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import merchantAPI from '../../api/merchantAPI';
import './Payment.css';

const Payment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [merchantName, setMerchantName] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Lấy merchantName từ URL query params
    const name = searchParams.get('merchantName') || searchParams.get('merchant');
    if (name) {
      setMerchantName(name);
    }
  }, [searchParams]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    // Kiểm tra định dạng file
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Vui lòng chọn file ảnh (JPEG, PNG, GIF)');
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    // Kiểm tra kích thước file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước file không được vượt quá 5MB');
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    setImageFile(file);
    setError('');

    // Tạo preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!merchantName.trim()) {
      setError('Vui lòng nhập tên nhà hàng');
      return;
    }

    if (!imageFile) {
      setError('Vui lòng chọn ảnh chứng từ giao dịch');
      return;
    }

    setLoading(true);
    try {
      await merchantAPI.uploadTransactionProof(merchantName.trim(), imageFile);
      setSuccess('Upload chứng từ thành công! Chúng tôi sẽ xác nhận trong thời gian sớm nhất.');
      setImageFile(null);
      setImagePreview(null);
      
      // Chuyển hướng về trang login sau 3 giây
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Có lỗi xảy ra khi upload chứng từ. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-container">
      <div className="payment-card">
        <div className="payment-header">
          <h1>Thanh toán phí đăng ký</h1>
          <p>Vui lòng chuyển khoản và upload ảnh chứng từ giao dịch</p>
        </div>

        <div className="payment-info">
          <h2>Thông tin chuyển khoản</h2>
          <div className="bank-info">
            <div className="info-row">
              <span className="info-label">Ngân hàng:</span>
              <span className="info-value">Vietcombank</span>
            </div>
            <div className="info-row">
              <span className="info-label">Số tài khoản:</span>
              <span className="info-value">1234567890</span>
            </div>
            <div className="info-row">
              <span className="info-label">Chủ tài khoản:</span>
              <span className="info-value">CÔNG TY TNHH FOOD DELIVERY</span>
            </div>
            <div className="info-row">
              <span className="info-label">Số tiền:</span>
              <span className="info-value highlight">1.200.000 VNĐ</span>
            </div>
            <div className="info-row">
              <span className="info-label">Nội dung:</span>
              <span className="info-value">{merchantName ? `Phi dang ky ${merchantName}` : 'Phí đăng ký nhà hàng'}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="form-group">
            <label htmlFor="merchantName">Tên nhà hàng</label>
            <input
              type="text"
              id="merchantName"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="Nhập tên nhà hàng của bạn"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="imageFile">Upload ảnh chứng từ giao dịch</label>
            <input
              type="file"
              id="imageFile"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
            />
            <p className="file-hint">Hỗ trợ: JPEG, PNG, GIF. Tối đa 5MB</p>
          </div>

          {imagePreview && (
            <div className="image-preview">
              <p>Xem trước ảnh:</p>
              <img src={imagePreview} alt="Preview" />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Đang upload...' : 'Xác nhận thanh toán'}
          </button>

          <div className="payment-note">
            <p>Lưu ý:</p>
            <ul>
              <li>Vui lòng chuyển khoản đúng số tiền và nội dung đã ghi</li>
              <li>Sau khi upload chứng từ, chúng tôi sẽ xác nhận trong vòng 24h</li>
              <li>Bạn sẽ nhận được email thông báo khi tài khoản được kích hoạt</li>
            </ul>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Payment;
