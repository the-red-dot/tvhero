import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import MediaDetails from './pages/MediaDetails';
import AuthModal from './components/AuthModal';
import EmailConfirmationModal from './components/EmailConfirmationModal';

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/media" element={<MediaDetails />} />
      </Routes>
      {/* Global modals */}
      <AuthModal />
      <EmailConfirmationModal />
    </div>
  );
}

export default App;
