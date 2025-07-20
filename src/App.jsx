import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Editprofile from './pages/Editprofile';
import Map from './pages/Map';
import Login from './pages/Login';
import Creategame from './pages/Creategame';
import Wallet from './pages/Wallet';
import Howto from './pages/Howto';
import Activities from './pages/Activities';
import Playersactivities from './pages/Playersactivities';
import Creatorsactivities from './pages/Creatorsactivities';
import Logout from './pages/Logout';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/editprofile' element={<Editprofile />} />
        <Route path='/map' element={<Map />} />
        <Route path='/login' element={<Login />} />
        <Route path='/creategame' element={<Creategame />} />
        <Route path='/wallet' element={<Wallet />} />
        <Route path='/howto' element={<Howto />} />
        <Route path='/activities' element={<Activities />} />
        <Route path='/playersactivities' element={<Playersactivities />} />
        <Route path='/creatorsactivities' element={<Creatorsactivities />} />
        <Route path='/logout' element={<Logout />} />
        <Route path='/profile' element={<Profile />} />
      </Routes>
    </Router>
  );
}

export default App;
