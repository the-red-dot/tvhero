import React from 'react';
import { doc, setDoc, deleteDoc, getDoc } from '../utils/firebase';
import { db } from '../utils/firebase';

function Sidebar({
  libraries,
  currentLibrary,
  setCurrentLibrary,
  setMediaItems,
  isOpen,
  onClose,
  setLibraries,
  user,
}) {
  // Hebrew collator for sorting
  const hebrewCollator = new Intl.Collator('he');

  const sortMediaItems = (items) => {
    return items.sort((a, b) =>
      hebrewCollator.compare(a.hebrewTitle || '', b.hebrewTitle || '')
    );
  };

  const handleLibraryClick = (libName) => {
    setCurrentLibrary(libName);
    const items = libraries[libName] ? [...libraries[libName]] : [];
    setMediaItems(sortMediaItems(items));
    onClose();
  };

  const handleCreateLibrary = async () => {
    const libName = prompt('הכנס שם לספרייה החדשה:');
    if (libName) {
      if (!libraries[libName]) {
        const updatedLibraries = { ...libraries, [libName]: [] };
        setLibraries(updatedLibraries);
        setCurrentLibrary(libName);
        setMediaItems([]);
        onClose();
        if (user) {
          try {
            const libDocRef = doc(db, 'users', user.uid, 'libraries', libName);
            await setDoc(libDocRef, { media: [] }, { merge: true });
          } catch (error) {
            console.error('Error creating library in Firestore:', error);
          }
        }
      } else {
        alert('ספרייה עם שם זה כבר קיימת.');
      }
    }
  };

  const handleRenameLibrary = async (oldName) => {
    const newName = prompt('הכנס שם חדש לספרייה:', oldName);
    if (newName && newName !== oldName) {
      if (libraries[newName]) {
        alert('ספרייה עם שם זה כבר קיימת.');
        return;
      }
      const updatedLibraries = { ...libraries };
      updatedLibraries[newName] = updatedLibraries[oldName];
      delete updatedLibraries[oldName];
      setLibraries(updatedLibraries);
      if (currentLibrary === oldName) {
        setCurrentLibrary(newName);
        setMediaItems(updatedLibraries[newName] ? sortMediaItems([...updatedLibraries[newName]]) : []);
      }
      if (user) {
        try {
          const oldDocRef = doc(db, 'users', user.uid, 'libraries', oldName);
          const newDocRef = doc(db, 'users', user.uid, 'libraries', newName);
          const oldDocSnap = await getDoc(oldDocRef);
          if (oldDocSnap.exists()) {
            await setDoc(newDocRef, oldDocSnap.data(), { merge: true });
            await deleteDoc(oldDocRef);
          }
        } catch (error) {
          console.error(`Error renaming library from ${oldName} to ${newName} in Firestore:`, error);
        }
      }
    }
  };

  const handleDeleteLibrary = async (libName) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את הספרייה "${libName}"?`)) {
      const updatedLibraries = { ...libraries };
      delete updatedLibraries[libName];
      setLibraries(updatedLibraries);
      if (currentLibrary === libName) {
        setCurrentLibrary('חיפוש מדיה חכם');
        const mainItems = updatedLibraries['חיפוש מדיה חכם'] || [];
        setMediaItems(sortMediaItems([...mainItems]));
      }
      if (user) {
        try {
          const libDocRef = doc(db, 'users', user.uid, 'libraries', libName);
          await deleteDoc(libDocRef);
        } catch (error) {
          console.error(`Error deleting library ${libName} from Firestore:`, error);
        }
      }
    }
  };

  return (
    <>
      <div className={isOpen ? 'sidebar active' : 'sidebar'} id="sidebar">
        <ul id="library-list">
          {Object.keys(libraries).map((libName) =>
            libName === 'חיפוש מדיה חכם' ? null : (
              <li key={libName}>
                <span className="library-name" onClick={() => handleLibraryClick(libName)}>
                  {libName}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRenameLibrary(libName);
                  }}
                  title="שנה שם"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm18.71-13.04a1.003 1.003 0 0 0 0-1.42l-2.54-2.54a1.003 1.003 0 0 0-1.42 0l-2.12 2.12 3.75 3.75 2.33-2.33z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLibrary(libName);
                  }}
                  title="מחק ספרייה"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zm3.46-9.12l1.42-1.42L12 11.59l1.12-1.13 1.42 1.42L13.41 13l1.13 1.12-1.42 1.42L12 14.41l-1.12 1.13-1.42-1.42L10.59 13l-1.13-1.12zM15.5 4l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
              </li>
            )
          )}
        </ul>

        <div className="add-library" id="add-library" onClick={handleCreateLibrary}>
          <svg viewBox="0 0 24 24">
            <path
              d="M12 5v14M5 12h14"
              stroke="#ffcc00"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span>צור ספרייה חדשה</span>
        </div>

        <div
          className="add-library"
          id="smart-search"
          onClick={() => handleLibraryClick('חיפוש מדיה חכם')}
        >
          <svg viewBox="0 0 24 24">
            <path d="M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
          </svg>
          <span>חיפוש חכם</span>
        </div>
      </div>

      {isOpen && <div className="overlay active" onClick={onClose} />}
    </>
  );
}

export default Sidebar;
