import React, { useContext, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LibraryContext } from './utils/LibraryContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Home from './pages/Home';
import MediaDetails from './pages/MediaDetails';
import AuthModal from './components/AuthModal';
import EmailConfirmationModal from './components/EmailConfirmationModal';
import { handleLogout } from './utils/auth';

function Layout({ children }) {
  const { currentLibrary, user, setCurrentLibrary, libraries, setLibraries, setMediaItems } =
    useContext(LibraryContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleOpenAuth = () => {
    setIsAuthOpen(true);
  };

  const handleCloseAuth = () => {
    setIsAuthOpen(false);
  };

  const onLogout = async () => {
    await handleLogout();
    setLibraries({});
    setMediaItems([]);
    setCurrentLibrary('חיפוש מדיה חכם');
  };

  return (
    <div>
      <Header
        currentLibrary={currentLibrary}
        onBurgerClick={handleToggleSidebar}
        onLoginClick={handleOpenAuth}
        user={user}
        onLogout={onLogout}
      />
      <Sidebar
        libraries={libraries}
        currentLibrary={currentLibrary}
        setCurrentLibrary={setCurrentLibrary}
        setMediaItems={setMediaItems}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        setLibraries={setLibraries}
        user={user}
      />
      {children}
      <AuthModal isOpen={isAuthOpen} onClose={handleCloseAuth} />
      <EmailConfirmationModal /* Add props as needed */ />
    </div>
  );
}

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/media/:tmdbId/:type" element={<MediaDetails />} />
        {/* Add more routes for new pages here */}
      </Routes>
    </Layout>
  );
}

export default App;