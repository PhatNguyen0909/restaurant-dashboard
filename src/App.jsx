import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Order from './pages/Order/Order';
import Add from './pages/Add/Add';
import List from './pages/List/List';
import Navbar from './components/Navbar/Navbar';
import Sidebar from './components/Sidebar/Sidebar';
import Login from './pages/Login/Login';

function App() {
  const [restaurantId, setRestaurantId] = useState(null);

  if (!restaurantId) {
    return <Login onLogin={setRestaurantId} />;
  }

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
        </Routes>
      </div>
    </div>
  );
}

export default App;
