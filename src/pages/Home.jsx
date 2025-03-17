import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import SearchBar from '../components/SearchBar';
import MediaGrid from '../components/MediaGrid';
import AddPopup from '../components/AddPopup';
import AuthModal from '../components/AuthModal';
import { cloneMediaArray } from '../utils/helpers';
import { listenToAuthChanges, loadUserData, handleLogout } from '../utils/auth';
import { db, doc, setDoc } from '../utils/firebase';

function Home() {
  const [libraries, setLibraries] = useState({});
  const [currentLibrary, setCurrentLibrary] = useState('חיפוש מדיה חכם');
  const [mediaItems, setMediaItems] = useState([]);
  const [user, setUser] = useState(null);

  // Manage sidebar, auth modal, and add popup visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [mediaToAdd, setMediaToAdd] = useState(null);

  // Create a Hebrew collator for sorting (א–ת)
  const hebrewCollator = new Intl.Collator('he');

  const sortMediaItems = (items) => {
    return items.sort((a, b) =>
      hebrewCollator.compare(a.hebrewTitle || '', b.hebrewTitle || '')
    );
  };

  useEffect(() => {
    // Listen to Firebase auth changes and load libraries from Firestore
    listenToAuthChanges(async (user) => {
      setUser(user);
      if (user) {
        const libs = await loadUserData(user.uid);
        setLibraries(libs);
        setCurrentLibrary('חיפוש מדיה חכם');
        const sortedItems = sortMediaItems(cloneMediaArray(libs['חיפוש מדיה חכם'] || []));
        setMediaItems(sortedItems);
      } else {
        setLibraries({});
        setMediaItems([]);
      }
    });

    const handleUserDataLoaded = (event) => {
      const { libraries } = event.detail;
      setLibraries(libraries);
      setCurrentLibrary('חיפוש מדיה חכם');
      const sortedItems = sortMediaItems(cloneMediaArray(libraries['חיפוש מדיה חכם'] || []));
      setMediaItems(sortedItems);
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

  // When the user clicks "הוספה" on a media card
  const handleMediaAdd = (media) => {
    setMediaToAdd(media);
    setIsAddPopupOpen(true);
  };

  // Called by AddPopup when the user selects one or more libraries (as an array)
  const handleAddMediaToLibraries = async (selectedLibraries) => {
    if (!mediaToAdd || !user) return;
    // For each target library, add the media if not already present
    for (const targetLibrary of selectedLibraries) {
      const targetMedia = libraries[targetLibrary] ? [...libraries[targetLibrary]] : [];
      if (targetMedia.some(item => item.tmdbId === mediaToAdd.tmdbId)) {
        // Already exists; skip
        continue;
      }
      targetMedia.push(mediaToAdd);
      const sortedTargetMedia = sortMediaItems(targetMedia);
      // Update local state for that library
      setLibraries((prev) => ({
        ...prev,
        [targetLibrary]: sortedTargetMedia,
      }));
      try {
        const libDocRef = doc(db, 'users', user.uid, 'libraries', targetLibrary);
        await setDoc(libDocRef, { media: sortedTargetMedia }, { merge: true });
      } catch (error) {
        console.error(`Error adding media to ${targetLibrary} in Firestore:`, error);
      }
    }
    alert('הפריט נוסף לספריות הנבחרות.');
    setIsAddPopupOpen(false);
    setMediaToAdd(null);
  };

  // Remove media callback – update local state immediately, then Firestore
  const handleRemoveMedia = async (media) => {
    if (window.confirm(`האם אתה בטוח שברצונך להסיר את הפריט "${media.hebrewTitle}"?`)) {
      const updatedMedia = (libraries[currentLibrary] || []).filter(item => item.tmdbId !== media.tmdbId);
      const updatedLibraries = { ...libraries, [currentLibrary]: updatedMedia };
      setLibraries(updatedLibraries);
      setMediaItems(sortMediaItems([...updatedMedia]));
      try {
        const libDocRef = doc(db, 'users', user.uid, 'libraries', currentLibrary);
        await setDoc(libDocRef, { media: updatedMedia }, { merge: true });
      } catch (error) {
        console.error('Error removing media from Firestore:', error);
      }
    }
  };

  return (
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
        setMediaItems={(items) => setMediaItems(sortMediaItems(items))}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        setLibraries={setLibraries}
        user={user}
      />

      <MediaGrid
        mediaItems={mediaItems}
        onRemoveMedia={handleRemoveMedia}
        onAddMedia={handleMediaAdd}
      />

      <AddPopup
        isOpen={isAddPopupOpen}
        onClose={() => { setIsAddPopupOpen(false); setMediaToAdd(null); }}
        libraries={libraries}
        currentLibrary={currentLibrary}
        onAdd={handleAddMediaToLibraries}
      />

      <AuthModal isOpen={isAuthOpen} onClose={handleCloseAuth} />
    </div>
  );
}

export default Home;
