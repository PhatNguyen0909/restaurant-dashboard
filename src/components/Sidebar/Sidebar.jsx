import React from 'react'
import './Sidebar.css';
import { NavLink } from 'react-router-dom';
import { assets } from '../../assets/assets';

const Sidebar = () => {
  // Get user info from localStorage or use default
  const userEmail = localStorage.getItem('userEmail') || 'admin@potato.com';
  const userName = localStorage.getItem('userName') || 'Admin User';
  
  // Get initials from name
  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className='sidebar'>
      {/* Logo Section */}
      <div className='sidebar-header'>
        <div className='sidebar-logo'>
          <div className='logo-icon'>
            <img src={assets.logo} alt="POTATO Logo" width="40" height="40" />
          </div>
          <div className='logo-text'>
            <h2>POTATO</h2>
            <p>Admin Panel</p>
          </div>
        </div>
      </div>

      {/* Menu Options */}
      <div className='sidebar-options'>
        <NavLink to='/dashboard' className='sidebar-option'>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="11" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="2" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="11" y="11" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span>Dashboard</span>
        </NavLink>

        <NavLink to='/info' className='sidebar-option'>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 4H16C17.1046 4 18 4.89543 18 6V14C18 15.1046 17.1046 16 16 16H4C2.89543 16 2 15.1046 2 14V6C2 4.89543 2.89543 4 4 4Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M2 8H18" stroke="currentColor" strokeWidth="1.5"/>
            <rect x="5" y="11" width="4" height="2" rx="0.5" fill="currentColor"/>
          </svg>
          <span>Merchant Info</span>
        </NavLink>

        <NavLink to='/list' className='sidebar-option'>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4L14 4M6 10H14M6 16H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M3 4H3.01M3 10H3.01M3 16H3.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>List Items</span>
        </NavLink>

        <NavLink to='/categories' className='sidebar-option'>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3H8V8H3V3Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 3H17V8H12V3Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 12H8V17H3V12Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 12H17V17H12V12Z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span>Categories</span>
        </NavLink>

        <NavLink to='/order' className='sidebar-option'>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3H17C17.5523 3 18 3.44772 18 4V16C18 16.5523 17.5523 17 17 17H3C2.44772 17 2 16.5523 2 16V4C2 3.44772 2.44772 3 3 3Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M7 3V17" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 7H15M11 10H15M11 13H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Orders</span>
        </NavLink>

        <NavLink to='/option-groups' className='sidebar-option'>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 3V7M10 13V17M3 10H7M13 10H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>Option Groups</span>
        </NavLink>

        <NavLink to='/feedback' className='sidebar-option'>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 10C18 14.4183 14.4183 18 10 18C8.46667 18 7.06667 17.5667 5.86667 16.8333L2 18V14C2 9.58172 5.58172 6 10 6C14.4183 6 18 9.58172 18 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M7 10H7.01M10 10H10.01M13 10H13.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span>Feedback</span>
        </NavLink>
      </div>

      {/* User Info */}
      <div className='sidebar-user'>
        <div className='user-avatar'>
          {getInitials(userName)}
        </div>
        <div className='user-info'>
          <p className='user-name'>{userName}</p>
          <p className='user-email'>{userEmail}</p>
        </div>
      </div>
    </div>
  )
}

export default Sidebar;
