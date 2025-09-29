
import React, { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Order from './pages/Order/Order';
import Add from './pages/Add/Add';
import List from './pages/List/List';
import Navbar from './components/Navbar/Navbar';
import Sidebar from './components/Sidebar/Sidebar';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';

function App() {
  const [MerchantId, setMerchantId] = useState(null);
  const location = useLocation();

  // Nếu chưa đăng nhập, chỉ cho phép vào /login và /register
  if (!MerchantId) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setMerchantId} />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Đã đăng nhập, cho vào dashboard
  return (
    <div>
      <Navbar />
      <hr />
      <div className='app-content'>
        <Sidebar />
        <Routes>
          <Route path='/add' element={<Add />} />
          <Route path='/list' element={<List />} />
          <Route path='/order' element={<Order />} />
          <Route path='*' element={<Navigate to='/list' replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
