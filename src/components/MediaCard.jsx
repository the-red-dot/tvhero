import React from 'react';
import { useNavigate } from 'react-router-dom';

function MediaCard({ media }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (media.tmdbId) {
      navigate(`/media?tmdbId=${media.tmdbId}&type=${media.type || 'movie'}`);
    } else {
      alert('פרטי הפריט אינם זמינים כעת.');
    }
  };

  return (
    <div className="media-card" onClick={handleClick}>
      <img className="media-poster" src={media.poster} alt={`${media.title} Poster`} draggable="false" />
      <div className="media-title">
        <strong>{media.hebrewTitle || 'אין כותרת בעברית'}</strong>
        <p>{media.title || 'אין כותרת באנגלית'}</p>
      </div>
      <div className="media-year">{media.year}</div>
      <div className="rating">
        {/* Render rating stars here (e.g. using a ratingsManager component) */}
      </div>
      <div className="button-container">
        <button className="status-button">לסימון</button>
        <button className="remove-button">הסר</button>
        <button className="add-button">הוספה</button>
      </div>
    </div>
  );
}

export default MediaCard;
