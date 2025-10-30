import React, { useState, useRef } from 'react';
import OptionGroupsTab from './OptionGroupsTab';
import AddOptionGroup from '../AddOptionGroup/AddOptionGroup';
import './OptionGroupsPage.css';

export default function OptionGroupsPage() {
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFormSuccess = () => {
    setShowForm(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="option-groups-container">
      {/* Header Section */}
      <div className="option-groups-header">
        <div className="option-groups-header-left">
          <h2 className="option-groups-title">Option Groups</h2>
          <p className="option-groups-subtitle">Tạo nhóm tùy chọn mới cho món ăn của nhà hàng</p>
        </div>
        <button 
          className="option-groups-add-btn" 
          onClick={() => setShowForm(!showForm)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {showForm ? 'Đóng Form' : 'Tạo mới'}
        </button>
      </div>

      {/* Add Form Section */}
      {showForm && (
        <div className="option-groups-form-section">
          <AddOptionGroup onSuccess={handleFormSuccess} />
        </div>
      )}

      {/* Content */}
      <div className="option-groups-content">
        <h3 className="section-title">Nhóm tùy chọn hiện có</h3>
        <OptionGroupsTab key={refreshKey} />
      </div>
    </div>
  );
}
