// src/components/MediaCard.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { currentUser } from '../utils/auth';
import { db, doc, getDoc, updateDoc, deleteField } from '../utils/firebase';
import '../styles/MediaCard.css';

function MediaCard({ media, onRemove, onAdd, onStatusChange }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    async function loadStatus() {
      if (!currentUser) return;
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const existingStatus =
            data.statuses && data.statuses[media.tmdbId]
              ? data.statuses[media.tmdbId]
              : null;
          setStatus(existingStatus);
        }
      } catch (error) {
        console.error('Error loading status:', error);
      }
    }
    loadStatus();
  }, [media.tmdbId]);

  const handleStatusClick = async (e) => {
    e.stopPropagation();
    if (!currentUser) {
      alert('אנא התחבר כדי לעדכן סטטוס.');
      return;
    }
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      let currentStatus = null;
      if (docSnap.exists()) {
        const data = docSnap.data();
        currentStatus =
          data.statuses && data.statuses[media.tmdbId]
            ? data.statuses[media.tmdbId]
            : null;
      }
      let newStatus;
      if (currentStatus === 'watched') {
        await updateDoc(userDocRef, {
          [`statuses.${media.tmdbId}`]: 'to-watch',
        });
        newStatus = 'to-watch';
      } else if (currentStatus === 'to-watch') {
        await updateDoc(userDocRef, {
          [`statuses.${media.tmdbId}`]: deleteField(),
        });
        newStatus = null;
      } else {
        await updateDoc(userDocRef, {
          [`statuses.${media.tmdbId}`]: 'watched',
        });
        newStatus = 'watched';
      }
      setStatus(newStatus);
      if (onStatusChange) {
        onStatusChange(media, newStatus);
      }
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) onRemove(media);
  };

  const handleAddClick = (e) => {
    e.stopPropagation();
    if (onAdd) onAdd(media);
  };

  let statusText = 'לסימון';
  if (status === 'watched') statusText = 'נצפה';
  else if (status === 'to-watch') statusText = 'לצפייה';

  const handleCardClick = () => {
    if (media.tmdbId) {
      navigate(`/media?tmdbId=${media.tmdbId}&type=${media.type || 'movie'}`);
    } else {
      alert('פרטי הפריט אינם זמינים כעת.');
    }
  };

  return (
    <div className="media-card" onClick={handleCardClick}>
      <img
        className="media-poster"
        src={media.poster}
        alt={`${media.title} Poster`}
        draggable="false"
      />
      <div className="media-title">
        <strong>{media.hebrewTitle || 'אין כותרת בעברית'}</strong>
        <p>{media.title || 'אין כותרת באנגלית'}</p>
      </div>
      <div className="media-year">{media.year}</div>
      <div className="rating">
        {/* If you have a ratings component, place it here */}
      </div>
      <div className="button-container">
        <button className={`status-button ${status || ''}`} onClick={handleStatusClick}>
          {statusText}
        </button>
        <button className="remove-button" onClick={handleRemoveClick}>
          הסר
        </button>
        <button className="add-button" onClick={handleAddClick}>
          הוספה
        </button>
      </div>
    </div>
  );
}

export default MediaCard;
