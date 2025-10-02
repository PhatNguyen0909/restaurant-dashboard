import React from 'react'
import './Sidebar.css';
import { assets } from '../../assets/assets';
import { NavLink } from 'react-router-dom';
const Sidebar = () => {
  return (
    <div className = 'sidebar'>
      <div className='sidebar-options'>
       
        <NavLink to='/info' className='sidebar-option'>
          <img src={assets.detail_icon} alt="i" />
          <p>Merchant Info</p>
        </NavLink>
        <NavLink to='/list' className='sidebar-option'>
          <img src={assets.order_icon} alt="" />
          <p>List Items</p>
        </NavLink>
        <NavLink to='/categories' className='sidebar-option'>
          <img src={assets.category_icon} alt="" />
          <p>Categories</p>
        </NavLink>
        <NavLink to='/order' className='sidebar-option'>
          <img src={assets.order_icon} alt="" />
          <p>Orders</p>
        </NavLink>
      </div>
    </div>
  )
}


export default Sidebar;
