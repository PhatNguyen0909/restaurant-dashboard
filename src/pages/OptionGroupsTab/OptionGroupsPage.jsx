import React from 'react';
import { Link } from 'react-router-dom';
import OptionGroupsTab from './OptionGroupsTab';
import './OptionGroupsPage.css';

export default function OptionGroupsPage() {
  return (
    <div className="option-groups-container">
      {/* Header Section */}
      <div className="option-groups-header">
        <div className="option-groups-header-left">
          <h2 className="option-groups-title">Option Groups</h2>
          <p className="option-groups-subtitle">Quản lý nhóm tùy chọn và giá trị option</p>
        </div>
        <Link to="/add-option-group" className="option-groups-add-btn">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Thêm nhóm mới
        </Link>
      </div>

      {/* Content */}
      <div className="option-groups-content">
        <OptionGroupsTab />
      </div>
    </div>
  );
}
