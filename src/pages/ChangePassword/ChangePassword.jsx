import React, { useState, useMemo } from 'react';
import './ChangePassword.css';
import userAPI from '../../api/userAPI';
import { useNavigate } from 'react-router-dom';

const ChangePassword = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Password requirements validation
  const passwordRequirements = useMemo(() => {
    const { newPassword } = formData;
    return {
      minLength: newPassword.length >= 8,
      hasUpper: /[A-Z]/.test(newPassword),
      hasLower: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
    };
  }, [formData.newPassword]);

  const isPasswordValid = useMemo(() => {
    return Object.values(passwordRequirements).every(Boolean);
  }, [passwordRequirements]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const toggleShowPassword = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'Vui lòng nhập mật khẩu mới';
    } else if (!isPasswordValid) {
      newErrors.newPassword = 'Mật khẩu không đáp ứng yêu cầu';
    } else if (formData.newPassword === formData.currentPassword) {
      newErrors.newPassword = 'Mật khẩu mới phải khác mật khẩu hiện tại';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    } else if (formData.confirmPassword !== formData.newPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      await userAPI.changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      
      setSuccess(true);
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/info');
      }, 2000);
    } catch (err) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Không thể đổi mật khẩu';
      if (errorMsg.toLowerCase().includes('current') || errorMsg.toLowerCase().includes('hiện tại')) {
        setErrors({ currentPassword: 'Mật khẩu hiện tại không đúng' });
      } else {
        alert(errorMsg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/info');
  };

  return (
    <div className="change-password-page">
      <div className="change-password-header">
        <h1 className="change-password-title">Đổi mật khẩu</h1>
        <p className="change-password-subtitle">Cập nhật mật khẩu để bảo mật tài khoản của bạn</p>
      </div>

      <div className="change-password-card">
        {success && (
          <div className="change-password-success">
            <div className="change-password-success-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.1"/>
                <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="change-password-success-content">
              <h4>Đổi mật khẩu thành công!</h4>
              <p>Mật khẩu của bạn đã được cập nhật. Đang chuyển hướng...</p>
            </div>
          </div>
        )}

        <form className="change-password-form" onSubmit={handleSubmit}>
          {/* Current Password */}
          <div className="change-password-field">
            <label className="change-password-label">
              Mật khẩu hiện tại <span className="required">*</span>
            </label>
            <div className="change-password-input-wrapper">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                className={`change-password-input ${errors.currentPassword ? 'error' : ''}`}
                placeholder="Nhập mật khẩu hiện tại"
                value={formData.currentPassword}
                onChange={(e) => handleChange('currentPassword', e.target.value)}
                disabled={submitting || success}
              />
              <button
                type="button"
                className="change-password-toggle"
                onClick={() => toggleShowPassword('current')}
                disabled={submitting || success}
              >
                {showPasswords.current ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 3L17 17M10 7C11.6569 7 13 8.34315 13 10C13 10.3588 12.9314 10.7016 12.8065 11.0161M10 13C8.34315 13 7 11.6569 7 10C7 9.64118 7.06863 9.29844 7.19349 8.98389M14.8982 14.8982C13.5885 15.9349 11.8754 16.5 10 16.5C5.52944 16.5 2.65233 13.0833 1.64706 11.5417C1.55013 11.3944 1.50166 11.3208 1.47141 11.1896C1.44738 11.0829 1.44738 10.9171 1.47141 10.8104C1.50166 10.6792 1.55013 10.6056 1.64706 10.4583C2.00073 9.9188 2.69156 8.97283 3.61034 8.08679M7.52779 5.59251C8.30608 5.21763 9.1303 5 10 5C14.4706 5 17.3477 8.41667 18.3529 9.95833C18.4499 10.1056 18.4983 10.1792 18.5286 10.3104C18.5526 10.4171 18.5526 10.5829 18.5286 10.6896C18.4983 10.8208 18.4499 10.8944 18.3529 11.0417C18.1019 11.4207 17.6874 11.9681 17.1414 12.5514" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 16.5C5.52944 16.5 2.65233 13.0833 1.64706 11.5417C1.55013 11.3944 1.50166 11.3208 1.47141 11.1896C1.44738 11.0829 1.44738 10.9171 1.47141 10.8104C1.50166 10.6792 1.55013 10.6056 1.64706 10.4583C2.65233 8.91667 5.52944 5.5 10 5.5C14.4706 5.5 17.3477 8.91667 18.3529 10.4583C18.4499 10.6056 18.4983 10.6792 18.5286 10.8104C18.5526 10.9171 18.5526 11.0829 18.5286 11.1896C18.4983 11.3208 18.4499 11.3944 18.3529 11.5417C17.3477 13.0833 14.4706 16.5 10 16.5Z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="change-password-error">{errors.currentPassword}</p>
            )}
          </div>

          {/* New Password */}
          <div className="change-password-field">
            <label className="change-password-label">
              Mật khẩu mới <span className="required">*</span>
            </label>
            <div className="change-password-input-wrapper">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                className={`change-password-input ${errors.newPassword ? 'error' : ''}`}
                placeholder="Nhập mật khẩu mới"
                value={formData.newPassword}
                onChange={(e) => handleChange('newPassword', e.target.value)}
                disabled={submitting || success}
              />
              <button
                type="button"
                className="change-password-toggle"
                onClick={() => toggleShowPassword('new')}
                disabled={submitting || success}
              >
                {showPasswords.new ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 3L17 17M10 7C11.6569 7 13 8.34315 13 10C13 10.3588 12.9314 10.7016 12.8065 11.0161M10 13C8.34315 13 7 11.6569 7 10C7 9.64118 7.06863 9.29844 7.19349 8.98389M14.8982 14.8982C13.5885 15.9349 11.8754 16.5 10 16.5C5.52944 16.5 2.65233 13.0833 1.64706 11.5417C1.55013 11.3944 1.50166 11.3208 1.47141 11.1896C1.44738 11.0829 1.44738 10.9171 1.47141 10.8104C1.50166 10.6792 1.55013 10.6056 1.64706 10.4583C2.00073 9.9188 2.69156 8.97283 3.61034 8.08679M7.52779 5.59251C8.30608 5.21763 9.1303 5 10 5C14.4706 5 17.3477 8.41667 18.3529 9.95833C18.4499 10.1056 18.4983 10.1792 18.5286 10.3104C18.5526 10.4171 18.5526 10.5829 18.5286 10.6896C18.4983 10.8208 18.4499 10.8944 18.3529 11.0417C18.1019 11.4207 17.6874 11.9681 17.1414 12.5514" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 16.5C5.52944 16.5 2.65233 13.0833 1.64706 11.5417C1.55013 11.3944 1.50166 11.3208 1.47141 11.1896C1.44738 11.0829 1.44738 10.9171 1.47141 10.8104C1.50166 10.6792 1.55013 10.6056 1.64706 10.4583C2.65233 8.91667 5.52944 5.5 10 5.5C14.4706 5.5 17.3477 8.91667 18.3529 10.4583C18.4499 10.6056 18.4983 10.6792 18.5286 10.8104C18.5526 10.9171 18.5526 11.0829 18.5286 11.1896C18.4983 11.3208 18.4499 11.3944 18.3529 11.5417C17.3477 13.0833 14.4706 16.5 10 16.5Z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.newPassword && (
              <p className="change-password-error">{errors.newPassword}</p>
            )}
            
            {/* Password Requirements */}
            {formData.newPassword && (
              <div className="password-requirements">
                <p className="password-requirements-title">Yêu cầu mật khẩu:</p>
                <ul className="password-requirements-list">
                  <li className={`requirement-item ${passwordRequirements.minLength ? 'met' : ''}`}>
                    <span className="requirement-icon">
                      {passwordRequirements.minLength ? '✓' : '○'}
                    </span>
                    Ít nhất 8 ký tự
                  </li>
                  <li className={`requirement-item ${passwordRequirements.hasUpper ? 'met' : ''}`}>
                    <span className="requirement-icon">
                      {passwordRequirements.hasUpper ? '✓' : '○'}
                    </span>
                    Có chữ hoa (A-Z)
                  </li>
                  <li className={`requirement-item ${passwordRequirements.hasLower ? 'met' : ''}`}>
                    <span className="requirement-icon">
                      {passwordRequirements.hasLower ? '✓' : '○'}
                    </span>
                    Có chữ thường (a-z)
                  </li>
                  <li className={`requirement-item ${passwordRequirements.hasNumber ? 'met' : ''}`}>
                    <span className="requirement-icon">
                      {passwordRequirements.hasNumber ? '✓' : '○'}
                    </span>
                    Có số (0-9)
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="change-password-field">
            <label className="change-password-label">
              Xác nhận mật khẩu mới <span className="required">*</span>
            </label>
            <div className="change-password-input-wrapper">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                className={`change-password-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="Nhập lại mật khẩu mới"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                disabled={submitting || success}
              />
              <button
                type="button"
                className="change-password-toggle"
                onClick={() => toggleShowPassword('confirm')}
                disabled={submitting || success}
              >
                {showPasswords.confirm ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M3 3L17 17M10 7C11.6569 7 13 8.34315 13 10C13 10.3588 12.9314 10.7016 12.8065 11.0161M10 13C8.34315 13 7 11.6569 7 10C7 9.64118 7.06863 9.29844 7.19349 8.98389M14.8982 14.8982C13.5885 15.9349 11.8754 16.5 10 16.5C5.52944 16.5 2.65233 13.0833 1.64706 11.5417C1.55013 11.3944 1.50166 11.3208 1.47141 11.1896C1.44738 11.0829 1.44738 10.9171 1.47141 10.8104C1.50166 10.6792 1.55013 10.6056 1.64706 10.4583C2.00073 9.9188 2.69156 8.97283 3.61034 8.08679M7.52779 5.59251C8.30608 5.21763 9.1303 5 10 5C14.4706 5 17.3477 8.41667 18.3529 9.95833C18.4499 10.1056 18.4983 10.1792 18.5286 10.3104C18.5526 10.4171 18.5526 10.5829 18.5286 10.6896C18.4983 10.8208 18.4499 10.8944 18.3529 11.0417C18.1019 11.4207 17.6874 11.9681 17.1414 12.5514" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 16.5C5.52944 16.5 2.65233 13.0833 1.64706 11.5417C1.55013 11.3944 1.50166 11.3208 1.47141 11.1896C1.44738 11.0829 1.44738 10.9171 1.47141 10.8104C1.50166 10.6792 1.55013 10.6056 1.64706 10.4583C2.65233 8.91667 5.52944 5.5 10 5.5C14.4706 5.5 17.3477 8.91667 18.3529 10.4583C18.4499 10.6056 18.4983 10.6792 18.5286 10.8104C18.5526 10.9171 18.5526 11.0829 18.5286 11.1896C18.4983 11.3208 18.4499 11.3944 18.3529 11.5417C17.3477 13.0833 14.4706 16.5 10 16.5Z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="change-password-error">{errors.confirmPassword}</p>
            )}
            {!errors.confirmPassword && formData.confirmPassword && formData.confirmPassword === formData.newPassword && (
              <p className="change-password-hint" style={{ color: '#10B981' }}>✓ Mật khẩu khớp</p>
            )}
          </div>

          {/* Actions */}
          <div className="change-password-actions">
            <button
              type="button"
              className="change-password-btn change-password-btn-cancel"
              onClick={handleCancel}
              disabled={submitting || success}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="change-password-btn change-password-btn-submit"
              disabled={submitting || success}
            >
              {submitting ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="8" opacity="0.5"/>
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2V8M8 8L11 5M8 8L5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 9C2 9 2 11.5 2 12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12C14 11.5 14 9 14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  Đổi mật khẩu
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ChangePassword;
