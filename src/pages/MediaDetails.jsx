import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchTrailerUrl } from '../utils/trailerManager';
import { db, doc, getDoc, updateDoc, deleteField } from '../utils/firebase';
import { currentUser } from '../utils/auth';
import '../styles/media.css';
import JSZip from 'jszip';

function MediaDetails() {
  const [searchParams] = useSearchParams();
  const tmdbId = searchParams.get('tmdbId');
  const [mediaType, setMediaType] = useState(searchParams.get('type') || 'movie');

  const [mediaData, setMediaData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  const [showSubtitleControls, setShowSubtitleControls] = useState(false);
  const [streams, setStreams] = useState(null);
  const videoRef = useRef(null);

  const seasonsCache = useRef(new Map());
  const episodesCache = useRef(new Map());
  const creditsCache = useRef(new Map());

  const [imdbIdGlobal, setImdbIdGlobal] = useState(null);

  useEffect(() => {
    if (!tmdbId) {
      setError('לא סופק מזהה מדיה.');
      return;
    }
    getMediaDetails(tmdbId, mediaType);
  }, [tmdbId, mediaType]);

  useEffect(() => {
    if (mediaData && currentUser) {
      fetchStatus(tmdbId);
    }
  }, [mediaData, currentUser, tmdbId]);

  async function fetchStatus(_tmdbId) {
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentStatus = data.statuses && data.statuses[_tmdbId] ? data.statuses[_tmdbId] : null;
        setStatus(currentStatus);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  }

  async function getMediaDetails(_tmdbId, mType) {
    try {
      const heUrl = `/${mType}/${_tmdbId}`;
      const heResp = await fetch(
        `/api/tmdb?url=${encodeURIComponent(heUrl)}&type=${mType}&id=${_tmdbId}&language=he`
      );
      const heData = await heResp.json();
      if (!heData) throw new Error('No Hebrew data.');

      const enUrl = `/${mType}/${_tmdbId}`;
      const enResp = await fetch(
        `/api/tmdb?url=${encodeURIComponent(enUrl)}&type=${mType}&id=${_tmdbId}&language=en-US`
      );
      const enData = await enResp.json();
      if (!enData) throw new Error('No English data.');

      const externalIdsUrl = `/${mType}/${_tmdbId}/external_ids`;
      const extResp = await fetch(
        `/api/tmdb?url=${encodeURIComponent(externalIdsUrl)}&type=${mType}&id=${_tmdbId}&language=en-US`
      );
      const extData = await extResp.json();
      const imdb = extData && extData.imdb_id ? extData.imdb_id : 'N/A';
      setImdbIdGlobal(imdb);

      const releaseYear =
        mType === 'movie'
          ? heData.release_date
            ? new Date(heData.release_date).getFullYear()
            : 'N/A'
          : heData.first_air_date
          ? new Date(heData.first_air_date).getFullYear()
          : 'N/A';

      const combinedData = {
        hebrewTitle: heData.title || heData.name || 'אין כותרת בעברית',
        englishTitle: enData.title || enData.name || 'No English Title',
        releaseYear,
        poster: heData.poster_path
          ? `https://image.tmdb.org/t/p/w500${heData.poster_path}`
          : 'https://via.placeholder.com/300x450?text=No+Image',
        overview: heData.overview || 'תיאור לא זמין',
        rating: heData.vote_average ? heData.vote_average.toFixed(1) : 'N/A',
        genres: heData.genres ? heData.genres.map((g) => g.name).join(', ') : 'N/A',
        imdbId: imdb,
        type: mType,
      };
      setMediaData(combinedData);

      const trailerUrl = await fetchTrailerUrl(
        _tmdbId,
        combinedData.hebrewTitle,
        releaseYear !== 'N/A' ? releaseYear : '',
        mType
      );
      const trailerIframe = document.getElementById('media-trailer');
      if (trailerIframe) {
        if (trailerUrl) {
          trailerIframe.src = trailerUrl;
          trailerIframe.style.display = 'block';
        } else {
          trailerIframe.style.display = 'none';
        }
      }

      if (mType === 'tv') {
        document.querySelector('.season-episode-container').style.display = 'block';
        const movieStreamSection = document.getElementById('movie-stream');
        if (movieStreamSection) movieStreamSection.style.display = 'none';
        populateSeasons(heData, _tmdbId);
      } else {
        const seasonEpisodeContainer = document.querySelector('.season-episode-container');
        if (seasonEpisodeContainer) seasonEpisodeContainer.style.display = 'none';
        if (enData.title || enData.name) {
          const fullTitleWithYear =
            mType === 'movie' ? `${enData.title || enData.name} ${releaseYear}` : enData.title || enData.name;
          fetchMovieStreams(fullTitleWithYear);
        }
      }
    } catch (err) {
      console.error('Error fetching media details:', err);
      setError('שגיאה בטעינת פרטי המדיה.');
    }
  }

  async function toggleMediaStatus(_tmdbId) {
    if (!currentUser) {
      alert('יש להתחבר כדי לעדכן את סטטוס הפריט.');
      return;
    }
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      let currentStatus = null;
      if (docSnap.exists()) {
        const data = docSnap.data();
        currentStatus = data.statuses && data.statuses[_tmdbId] ? data.statuses[_tmdbId] : null;
      }
      if (currentStatus === 'watched') {
        await updateDoc(userDocRef, { [`statuses.${_tmdbId}`]: 'to-watch' });
      } else if (currentStatus === 'to-watch') {
        await updateDoc(userDocRef, { [`statuses.${_tmdbId}`]: deleteField() });
      } else {
        await updateDoc(userDocRef, { [`statuses.${_tmdbId}`]: 'watched' });
      }
      await fetchStatus(_tmdbId);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('שגיאה בעדכון סטטוס הפריט.');
    }
  }

  // Placeholder functions (unchanged from your original code)
  async function populateSeasons(heData, _tmdbId) {
    // Implementation remains the same
  }
  async function fetchAndPopulateEpisodes(_tmdbId, seasonNumber) {
    // Implementation remains the same
  }
  async function displayEpisodeDetails(episodes, episodeNumber, seasonNumber) {
    // Implementation remains the same
  }
  async function fetchMovieStreams(fullTitleWithYear) {
    // Implementation remains the same
  }
  async function fetchVideoStreams(title, season = null, episode = null) {
    // Implementation remains the same
  }
  function addVideoPlayerWithResolution(containerEl, streamUrls) {
    // Implementation remains the same
  }

  const statusText = status === 'watched' ? 'נצפה' : status === 'to-watch' ? 'לצפייה' : 'לסימון';

  if (error) return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;
  if (!tmdbId) return <div style={{ color: 'red', padding: '20px' }}>לא סופק מזהה מדיה.</div>;
  if (!mediaData) return <div className="loader" />;

  return (
    <div className="media-details-container">
      <header className="media-header">
        <h1 id="media-title">
          <strong>{mediaData.hebrewTitle} ({mediaData.releaseYear})</strong>
          <br />
          <em>{mediaData.englishTitle} ({mediaData.releaseYear})</em>
        </h1>
      </header>

      <div className="media-details">
        <div className="poster-container">
          <img id="media-poster" src={mediaData.poster} alt="Media Poster" />
        </div>

        <div className="details-container">
          <div id="media-description">
            <p>{mediaData.overview}</p>
            <p>
              <strong>שנה:</strong> {mediaData.releaseYear}
              <br />
              <strong>IMDb ID:</strong> {mediaData.imdbId}
              <br />
              <strong>דירוג:</strong> {mediaData.rating}
              <br />
              <strong>ז'אנרים:</strong> {mediaData.genres}
            </p>
          </div>

          <div className="rating-status-container">
            <button
              id="status-button"
              className={`detail-status-button ${status === 'watched' ? 'watched' : status === 'to-watch' ? 'to-watch' : ''}`}
              onClick={() => toggleMediaStatus(tmdbId)}
            >
              {statusText}
            </button>
          </div>

          <div className="trailer-container">
            <iframe id="media-trailer" src="" allowFullScreen style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      <div id="movie-stream" className="movie-stream-container" style={{ display: 'none' }} />

      <div className="season-episode-container" style={{ display: 'none' }}>
        <h2>בחר עונה ופרק</h2>
        <div className="selectors">
          <label htmlFor="season-select">עונה:</label>
          <select id="season-select">
            <option value="">בחר עונה</option>
          </select>
          <label htmlFor="episode-select">פרק:</label>
          <select id="episode-select" disabled>
            <option value="">בחר פרק</option>
          </select>
        </div>
        <div className="episode-details" id="episode-details"></div>
      </div>

      {showSubtitleControls && (
        <div className="subtitle-controls-container">
          <h2>הגדרות כתוביות</h2>
          <div className="subtitle-controls">{/* Add subtitle controls here */}</div>
        </div>
      )}
    </div>
  );
}

export default MediaDetails;