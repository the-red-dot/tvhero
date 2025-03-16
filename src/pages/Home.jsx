import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import SearchBar from '../components/SearchBar';
import MediaGrid from '../components/MediaGrid';
import AddPopup from '../components/AddPopup';
import AuthModal from '../components/AuthModal';
import { cloneMediaArray } from '../utils/helpers';
import { listenToAuthChanges, loadUserData, handleLogout } from '../utils/auth';

function Home() {
  const [libraries, setLibraries] = useState({});
  const [currentLibrary, setCurrentLibrary] = useState('חיפוש מדיה חכם');
  const [mediaItems, setMediaItems] = useState([]);
  const [user, setUser] = useState(null);

  // Manage sidebar open/close
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Manage Auth modal open/close
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    // Listen to Firebase auth changes and update user state
    listenToAuthChanges(async (user) => {
      setUser(user);
      if (user) {
        const libs = await loadUserData(user.uid);
        setLibraries(libs);
        setCurrentLibrary('חיפוש מדיה חכם');
        setMediaItems(cloneMediaArray(libs['חיפוש מדיה חכם'] || []));
      } else {
        setLibraries({});
        setMediaItems([]);
      }
    });

    // Optionally, listen for custom "userDataLoaded" events:
    const handleUserDataLoaded = (event) => {
      const { libraries } = event.detail;
      setLibraries(libraries);
      setCurrentLibrary('חיפוש מדיה חכם');
      setMediaItems(cloneMediaArray(libraries['חיפוש מדיה חכם'] || []));
    };
    window.addEventListener('userDataLoaded', handleUserDataLoaded);
    return () => {
      window.removeEventListener('userDataLoaded', handleUserDataLoaded);
    };
  }, []);

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
    try {
      await handleLogout();
      setUser(null);
      setLibraries({});
      setMediaItems([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    // Wrap in a container that gets the "main-library" class if currentLibrary is "חיפוש מדיה חכם"
    <div className={currentLibrary === 'חיפוש מדיה חכם' ? 'main-library' : ''}>
      <Header
        currentLibrary={currentLibrary}
        onBurgerClick={handleToggleSidebar}
        onLoginClick={handleOpenAuth}
        user={user}
        onLogout={onLogout}
      />

      <SearchBar
        currentLibrary={currentLibrary}
        setMediaItems={setMediaItems}
        libraries={libraries}
        setLibraries={setLibraries}
        user={user}
      />

      <Sidebar
        libraries={libraries}
        currentLibrary={currentLibrary}
        setCurrentLibrary={setCurrentLibrary}
        setMediaItems={setMediaItems}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        setLibraries={setLibraries}  // Pass setter so Sidebar can update libraries in state
        user={user}
      />

      <MediaGrid mediaItems={mediaItems} />
      <AddPopup libraries={libraries} currentLibrary={currentLibrary} />

      <AuthModal isOpen={isAuthOpen} onClose={handleCloseAuth} />
    </div>
  );
}

export default Home;
