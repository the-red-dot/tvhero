// src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import SmartSearchBar from '../components/SmartSearchBar';
import StandardSearchBar from '../components/StandardSearchBar';
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

  const hebrewCollator = new Intl.Collator('he');
  const sortMediaItems = (items) => {
    return items.sort((a, b) =>
      hebrewCollator.compare(a.hebrewTitle || '', b.hebrewTitle || '')
    );
  };

  useEffect(() => {
    listenToAuthChanges(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const libs = await loadUserData(firebaseUser.uid);
        // Restore smart search results from localStorage, if available.
        const savedSmart = localStorage.getItem('smartSearchResults');
        if (savedSmart) {
          try {
            const parsed = JSON.parse(savedSmart);
            libs['חיפוש מדיה חכם'] = parsed;
          } catch (err) {
            console.error('Error parsing localStorage smartSearchResults:', err);
          }
        }
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
      // Merge in localStorage smart search results
      const savedSmart = localStorage.getItem('smartSearchResults');
      if (savedSmart) {
        try {
          const parsed = JSON.parse(savedSmart);
          libraries['חיפוש מדיה חכם'] = parsed;
        } catch (err) {
          console.error('Error parsing localStorage:', err);
        }
      }
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

  // When the user clicks "הוספה" on a media card, open the AddPopup.
  const handleMediaAdd = (media) => {
    setMediaToAdd(media);
    setIsAddPopupOpen(true);
  };

  // Called by AddPopup when the user selects one or more libraries (as an array)
  const handleAddMediaToLibraries = async (selectedLibraries) => {
    if (!mediaToAdd || !user) return;
    for (const libName of selectedLibraries) {
      const targetMedia = libraries[libName] ? [...libraries[libName]] : [];
      if (targetMedia.some(item => item.tmdbId === mediaToAdd.tmdbId)) {
        continue;
      }
      targetMedia.push(mediaToAdd);
      const sortedTargetMedia = sortMediaItems(targetMedia);
      setLibraries((prev) => ({
        ...prev,
        [libName]: sortedTargetMedia,
      }));
      try {
        const libDocRef = doc(db, 'users', user.uid, 'libraries', libName);
        await setDoc(libDocRef, { media: sortedTargetMedia }, { merge: true });
      } catch (error) {
        console.error(`Error adding media to library ${libName} in Firestore:`, error);
      }
    }
    alert('הפריט נוסף לספריות הנבחרות.');
    setIsAddPopupOpen(false);
    setMediaToAdd(null);
  };

  // Remove media callback – update local state immediately, then Firestore.
  const handleRemoveMedia = async (media) => {
    if (window.confirm(`האם אתה בטוח שברצונך להסיר את הפריט "${media.hebrewTitle}"?`)) {
      const updatedMedia = (libraries[currentLibrary] || []).filter(m => m.tmdbId !== media.tmdbId);
      const updatedLibraries = { ...libraries, [currentLibrary]: updatedMedia };
      setLibraries(updatedLibraries);
      setMediaItems(sortMediaItems(updatedMedia));
      if (user) {
        try {
          const libDocRef = doc(db, 'users', user.uid, 'libraries', currentLibrary);
          await setDoc(libDocRef, { media: updatedMedia }, { merge: true });
        } catch (error) {
          console.error('Error removing media from Firestore:', error);
        }
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

      {/* Conditionally render the appropriate search bar */}
      {currentLibrary === 'חיפוש מדיה חכם' ? (
        <SmartSearchBar
          user={user}
          libraries={libraries}
          setLibraries={setLibraries}
          setMediaItems={setMediaItems}
        />
      ) : (
        <StandardSearchBar
          user={user}
          setMediaItems={setMediaItems}
        />
      )}

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
        onClose={() => {
          setIsAddPopupOpen(false);
          setMediaToAdd(null);
        }}
        libraries={libraries}
        currentLibrary={currentLibrary}
        onAdd={handleAddMediaToLibraries}
      />

      <AuthModal isOpen={isAuthOpen} onClose={handleCloseAuth} />
    </div>
  );
}

export default Home;
