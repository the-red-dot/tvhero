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

  // Manage sidebar, auth modal, add popup
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [mediaToAdd, setMediaToAdd] = useState(null);

  const hebrewCollator = new Intl.Collator('he');
  const sortMediaItems = (items) =>
    items.sort((a, b) => hebrewCollator.compare(a.hebrewTitle || '', b.hebrewTitle || ''));

  useEffect(() => {
    // Listen for auth changes (make sure your listenToAuthChanges is refactored for React)
    listenToAuthChanges(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const libs = await loadUserData(firebaseUser.uid);
        // Merge any saved smart search results from localStorage
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
        const sorted = sortMediaItems(cloneMediaArray(libs['חיפוש מדיה חכם'] || []));
        setMediaItems(sorted);
      } else {
        setLibraries({});
        setMediaItems([]);
      }
    });

    // Also listen for a custom "userDataLoaded" event (if used)
    const handleUserDataLoaded = (event) => {
      const { libraries } = event.detail;
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
      const sorted = sortMediaItems(cloneMediaArray(libraries['חיפוש מדיה חכם'] || []));
      setMediaItems(sorted);
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

  // “הוספה” from a MediaCard – this sets the media to add and opens the popup.
  const handleMediaAdd = (media) => {
    setMediaToAdd(media);
    setIsAddPopupOpen(true);
  };

  // When the user confirms in the AddPopup, update all selected libraries.
  const handleAddMediaToLibraries = async (selectedLibraries) => {
    if (!mediaToAdd || !user) return;
    for (const libName of selectedLibraries) {
      const libMedia = libraries[libName] ? [...libraries[libName]] : [];
      // Only add if it doesn't already exist
      if (!libMedia.some((m) => m.tmdbId === mediaToAdd.tmdbId)) {
        libMedia.push(mediaToAdd);
        const sorted = sortMediaItems(libMedia);
        setLibraries((prev) => ({
          ...prev,
          [libName]: sorted,
        }));
        try {
          const libDocRef = doc(db, 'users', user.uid, 'libraries', libName);
          await setDoc(libDocRef, { media: sorted }, { merge: true });
        } catch (err) {
          console.error(`Error adding media to library ${libName}:`, err);
        }
      }
    }
    alert('הפריט נוסף לספריות הנבחרות.');
    setIsAddPopupOpen(false);
    setMediaToAdd(null);
  };

  // “הסר” a media item from the current library.
  const handleRemoveMedia = async (media) => {
    if (window.confirm(`האם אתה בטוח שברצונך להסיר את הפריט "${media.hebrewTitle}"?`)) {
      const updated = (libraries[currentLibrary] || []).filter((m) => m.tmdbId !== media.tmdbId);
      const newLibs = { ...libraries, [currentLibrary]: updated };
      setLibraries(newLibs);
      setMediaItems(sortMediaItems(updated));
      if (user) {
        try {
          const libDocRef = doc(db, 'users', user.uid, 'libraries', currentLibrary);
          await setDoc(libDocRef, { media: updated }, { merge: true });
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
          currentLibrary={currentLibrary}
          libraries={libraries}
          setLibraries={setLibraries}
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
