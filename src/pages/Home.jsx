// src/pages/Home.jsx
import React, { useContext, useState } from 'react';
import { LibraryContext } from '../utils/LibraryContext';
import SmartSearchBar from '../components/SmartSearchBar';
import StandardSearchBar from '../components/StandardSearchBar';
import MediaGrid from '../components/MediaGrid';
import AddPopup from '../components/AddPopup';
import { db, doc, setDoc } from '../utils/firebase';

function Home() {
  // Access shared state from LibraryContext
  const { libraries, setLibraries, currentLibrary, mediaItems, setMediaItems, user } =
    useContext(LibraryContext);

  // Local state for managing the AddPopup
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);
  const [mediaToAdd, setMediaToAdd] = useState(null);

  // Hebrew collator for sorting media items by Hebrew title
  const hebrewCollator = new Intl.Collator('he');
  const sortMediaItems = (items) =>
    items.sort((a, b) => hebrewCollator.compare(a.hebrewTitle || '', b.hebrewTitle || ''));

  // Handle clicking "הוספה" from a MediaCard
  const handleMediaAdd = (media) => {
    setMediaToAdd(media);
    setIsAddPopupOpen(true);
  };

  // Add media to selected libraries when confirmed in AddPopup
  const handleAddMediaToLibraries = async (selectedLibraries) => {
    if (!mediaToAdd || !user) return;

    for (const libName of selectedLibraries) {
      const libMedia = libraries[libName] ? [...libraries[libName]] : [];
      // Only add if the media doesn't already exist in the library
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

  // Remove a media item from the current library
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
      {/* Render SmartSearchBar or StandardSearchBar based on currentLibrary */}
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

      {/* Display the media items in a grid */}
      <MediaGrid
        mediaItems={mediaItems}
        onRemoveMedia={handleRemoveMedia}
        onAddMedia={handleMediaAdd}
      />

      {/* Popup for adding media to libraries */}
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
    </div>
  );
}

export default Home;