import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Import your page components
import LoginPage from './pages/Login.jsx';
import MapPage from './pages/Map.jsx'; // The main game map
// ... import other pages as you build them

function App() {
  return (
    <Router>
      <Routes>
        {/* ✅ CHANGE: Set the MapPage as the root/home page */}
        <Route path="/" element={<MapPage />} />
        
        <Route path="/login" element={<LoginPage />} />
        
        {/* Add other routes here as you convert more pages */}
      </Routes>
    </Router>
  );
}

export default App;
