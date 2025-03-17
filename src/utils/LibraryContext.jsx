import React, { useState, useEffect } from 'react';
import { listenToAuthChanges, loadUserData } from './auth';
import { db, doc, setDoc } from './firebase';

const LibraryContext = React.createContext();

function LibraryProvider({ children }) {
  const [libraries, setLibraries] = useState({});
  const [currentLibrary, setCurrentLibrary] = useState('חיפוש מדיה חכם');
  const [mediaItems, setMediaItems] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    listenToAuthChanges(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const libs = await loadUserData(firebaseUser.uid);
        const savedSmart = localStorage.getItem('smartSearchResults');
        if (savedSmart) {
          try {
            const parsed = JSON.parse(savedSmart);
            libs['חיפוש מדיה חכם'] = parsed;
          } catch (err) {
            console.error('Error parsing localStorage:', err);
          }
        }
        setLibraries(libs);
        setCurrentLibrary('חיפוש מדיה חכם');
        setMediaItems(libs['חיפוש מדיה חכם'] || []);
      } else {
        setLibraries({});
        setMediaItems([]);
      }
    });
  }, []);

  return (
    <LibraryContext.Provider
      value={{
        libraries,
        setLibraries,
        currentLibrary,
        setCurrentLibrary,
        mediaItems,
        setMediaItems,
        user,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export { LibraryContext, LibraryProvider };