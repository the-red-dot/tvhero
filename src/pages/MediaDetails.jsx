import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchTrailerUrl } from '../utils/trailerManager';
import { db, doc, getDoc, updateDoc, deleteField } from '../utils/firebase';
import { currentUser } from '../utils/auth';
import { createRating, getSavedRating, updateStars } from '../utils/ratingsManager';
import '../styles/media.css'; // Your old media.css
import JSZip from 'jszip';

function MediaDetails() {
  // Read ?tmdbId=xxx&type=yyy from the URL
  const [searchParams] = useSearchParams();
  const tmdbId = searchParams.get('tmdbId');
  const [mediaType, setMediaType] = useState(searchParams.get('type') || 'movie');

  const [mediaData, setMediaData] = useState(null);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('לסימון');
  const [ratingElement, setRatingElement] = useState(null);

  // For subtitles, resolution, etc.
  const [showSubtitleControls, setShowSubtitleControls] = useState(false);
  const [streams, setStreams] = useState(null);
  const videoRef = useRef(null); // We'll reference the <video> element if needed

  // Some caches from your old code
  const seasonsCache = useRef(new Map());
  const episodesCache = useRef(new Map());
  const creditsCache = useRef(new Map());

  // For storing the external IMDb ID
  const [imdbIdGlobal, setImdbIdGlobal] = useState(null);

  // On mount, fetch the media details
  useEffect(() => {
    if (!tmdbId) {
      setError('לא סופק מזהה מדיה.');
      return;
    }
    getMediaDetails(tmdbId, mediaType);
  }, [tmdbId, mediaType]);

  // -----------
  // Main fetch function replicating your old getMediaDetails
  // -----------
  async function getMediaDetails(_tmdbId, mType) {
    try {
      // 1) Hebrew fetch
      const heUrl = `/${mType}/${_tmdbId}`;
      const heResp = await fetch(
        `/api/tmdb?url=${encodeURIComponent(heUrl)}&type=${mType}&id=${_tmdbId}&language=he`
      );
      const heData = await heResp.json();
      if (!heData) throw new Error('No Hebrew data.');

      // 2) English fetch
      const enUrl = `/${mType}/${_tmdbId}`;
      const enResp = await fetch(
        `/api/tmdb?url=${encodeURIComponent(enUrl)}&type=${mType}&id=${_tmdbId}&language=en-US`
      );
      const enData = await enResp.json();
      if (!enData) throw new Error('No English data.');

      // 3) External IDs to get IMDb
      const externalIdsUrl = `/${mType}/${_tmdbId}/external_ids`;
      const extResp = await fetch(
        `/api/tmdb?url=${encodeURIComponent(externalIdsUrl)}&type=${mType}&id=${_tmdbId}&language=en-US`
      );
      const extData = await extResp.json();
      const imdb = extData && extData.imdb_id ? extData.imdb_id : 'N/A';
      setImdbIdGlobal(imdb);

      // Build your final data object
      const releaseYear =
        mType === 'movie'
          ? (heData.release_date ? new Date(heData.release_date).getFullYear() : 'N/A')
          : (heData.first_air_date ? new Date(heData.first_air_date).getFullYear() : 'N/A');

      // We'll store everything in state
      const combinedData = {
        hebrewTitle: heData.title || heData.name || 'אין כותרת בעברית',
        englishTitle: enData.title || enData.name || 'No English Title',
        releaseYear,
        poster: heData.poster_path
          ? `https://image.tmdb.org/t/p/w500${heData.poster_path}`
          : 'https://via.placeholder.com/300x450?text=No+Image',
        overview: heData.overview || 'תיאור לא זמין',
        rating: heData.vote_average ? heData.vote_average.toFixed(1) : 'N/A',
        genres: heData.genres ? heData.genres.map(g => g.name).join(', ') : 'N/A',
        imdbId: imdb,
        type: mType
      };
      setMediaData(combinedData);

      // 4) Load the trailer
      const trailerUrl = await fetchTrailerUrl(
        _tmdbId,
        combinedData.hebrewTitle,
        releaseYear !== 'N/A' ? releaseYear : '',
        mType
      );
      // We'll store the trailer in state, or just do it directly in the DOM
      const trailerIframe = document.getElementById('media-trailer');
      if (trailerIframe) {
        if (trailerUrl) {
          trailerIframe.src = trailerUrl;
          trailerIframe.style.display = 'block';
        } else {
          trailerIframe.style.display = 'none';
        }
      }

      // 5) Update the status button
      const statusBtn = document.getElementById('status-button');
      if (statusBtn) {
        updateStatusButton(statusBtn, _tmdbId);
      }

      // 6) Create the rating
      const ratingDiv = document.getElementById('rating');
      if (ratingDiv) {
        ratingDiv.innerHTML = '';
        const ratingEl = await createRating(_tmdbId);
        ratingDiv.appendChild(ratingEl);
        const saved = await getSavedRating(_tmdbId) || 0;
        await updateStars(ratingEl, saved);
        setRatingElement(ratingEl);
      }

      // 7) If TV, show the season/episode container
      if (mType === 'tv') {
        document.querySelector('.season-episode-container').style.display = 'block';
        const movieStreamSection = document.getElementById('movie-stream');
        if (movieStreamSection) movieStreamSection.style.display = 'none';

        // Populate seasons, etc. (like your old code)
        populateSeasons(heData, _tmdbId);
      } else {
        // It's a movie
        const seasonEpisodeContainer = document.querySelector('.season-episode-container');
        if (seasonEpisodeContainer) {
          seasonEpisodeContainer.style.display = 'none';
        }
        // Attempt to fetch rezka streams
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

  // -----------
  // TV: Populate seasons
  // -----------
  async function populateSeasons(heData, _tmdbId) {
    const seasonSelect = document.getElementById('season-select');
    const episodeSelect = document.getElementById('episode-select');
    if (!seasonSelect || !episodeSelect) return;

    seasonSelect.innerHTML = '<option value="">בחר עונה</option>';
    const cachedSeasons = seasonsCache.current.get(_tmdbId) || heData.seasons || [];
    seasonsCache.current.set(_tmdbId, cachedSeasons);

    cachedSeasons.forEach(season => {
      if (season.season_number === 0) return; // skip specials
      const opt = document.createElement('option');
      opt.value = season.season_number;
      opt.textContent = `עונה ${season.season_number} - ${season.name || ''}`;
      seasonSelect.appendChild(opt);
    });

    if (cachedSeasons.length > 0) {
      seasonSelect.disabled = false;
      document.querySelector('.season-episode-container').style.display = 'block';
    } else {
      seasonSelect.disabled = true;
      document.querySelector('.season-episode-container').style.display = 'none';
    }

    seasonSelect.onchange = () => {
      const val = seasonSelect.value;
      if (val) {
        fetchAndPopulateEpisodes(_tmdbId, val);
      } else {
        episodeSelect.innerHTML = '<option value="">בחר פרק</option>';
        episodeSelect.disabled = true;
        document.getElementById('episode-details').innerHTML = '';
      }
    };
  }

  // -----------
  // TV: fetch episodes for a given season
  // -----------
  async function fetchAndPopulateEpisodes(_tmdbId, seasonNumber) {
    const episodeSelect = document.getElementById('episode-select');
    const epCacheKey = `${_tmdbId}-season-${seasonNumber}`;
    let seasonData = episodesCache.current.get(epCacheKey);

    if (!seasonData) {
      try {
        const resp = await fetch(
          `/api/tmdb?url=tv/${_tmdbId}/season/${seasonNumber}&type=tv&id=${_tmdbId}&season=${seasonNumber}&language=he`
        );
        const data = await resp.json();
        if (!data || !data.episodes) throw new Error('No episodes data received.');
        episodesCache.current.set(epCacheKey, data);
        seasonData = data;
      } catch (err) {
        console.error('Error fetching episodes:', err);
        return;
      }
    }

    episodeSelect.innerHTML = '<option value="">בחר פרק</option>';
    seasonData.episodes.forEach(ep => {
      const opt = document.createElement('option');
      opt.value = ep.episode_number;
      opt.textContent = `פרק ${ep.episode_number} - ${ep.name || ''}`;
      episodeSelect.appendChild(opt);
    });

    episodeSelect.disabled = false;
    episodeSelect.onchange = () => {
      const val = episodeSelect.value;
      if (val) {
        displayEpisodeDetails(seasonData.episodes, val, seasonNumber);
      } else {
        document.getElementById('episode-details').innerHTML = '';
      }
    };
  }

  // -----------
  // TV: display an episode’s stream
  // -----------
  async function displayEpisodeDetails(episodes, episodeNumber, seasonNumber) {
    const episodeDetailsEl = document.getElementById('episode-details');
    const ep = episodes.find(e => e.episode_number === parseInt(episodeNumber, 10));
    if (!ep) {
      episodeDetailsEl.innerHTML = '<p>פרק לא נמצא.</p>';
      return;
    }
    episodeDetailsEl.innerHTML = `
      <h3>פרק ${ep.episode_number}: ${ep.name || 'אין כותרת'}</h3>
      <p>${ep.overview || 'תיאור לא זמין'}</p>
    `;
    // Rezka stream
    const englishTitle = mediaData ? mediaData.englishTitle : 'Unknown Title';
    const streams = await fetchVideoStreams(englishTitle, seasonNumber, episodeNumber);
    if (streams) {
      // Insert a video and resolution selector
      addVideoPlayerWithResolution(episodeDetailsEl, streams);
    } else {
      episodeDetailsEl.innerHTML += '<p>לא ניתן לטעון את הזרם.</p>';
    }
  }

  // -----------
  // Movies: fetch Rezka streams
  // -----------
  async function fetchMovieStreams(fullTitleWithYear) {
    const container = document.getElementById('movie-stream');
    const descriptionEl = document.getElementById('media-description');
    if (!container || !descriptionEl) return;

    const result = await fetchVideoStreams(fullTitleWithYear, null, null);
    if (result) {
      container.style.display = 'block';
      container.innerHTML = `
        <div>
          <label for="resolution-select">בחר רזולוציה:</label>
          <select id="resolution-select" class="resolution-select">
            <option value="">בחר רזולוציה</option>
            ${Object.keys(result).map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <video controls class="media-video"></video>
      `;
      const video = container.querySelector('video.media-video');
      const resolutionSelect = container.querySelector('#resolution-select');
      resolutionSelect.onchange = () => {
        const val = resolutionSelect.value;
        if (val && result[val]) {
          video.src = result[val];
          video.load();
          video.play().catch(err => console.error('Error playing video:', err));
        }
      };
      // default
      const defaultRes = result['720p'] ? '720p' : Object.keys(result)[0];
      if (defaultRes) {
        resolutionSelect.value = defaultRes;
        video.src = result[defaultRes];
        video.load();
        video.play().catch(err => console.error('Error playing video:', err));
      }
    } else {
      container.style.display = 'none';
    }
  }

  // -----------
  // Rezka fetch
  // -----------
  async function fetchVideoStreams(title, season = null, episode = null) {
    try {
      let url = `https://d5aa-2a10-8012-f-9d50-11c9-3f56-bee5-590c.ngrok-free.app/fetch_stream?title=${encodeURIComponent(title)}`;
      if (season !== null && episode !== null) {
        url += `&season=${season}&episode=${episode}`;
      }
      const resp = await fetch(url, {
        headers: {
          'ngrok-skip-browser-warning': 'true'
        }
      });
      const data = await resp.json();
      if (data.error) {
        console.error('Error from Rezka:', data.error);
        alert(data.error);
        return null;
      }
      if (data.warning) {
        console.warn('Rezka warning:', data.warning);
        alert(data.warning);
      }
      return data.stream_urls || null;
    } catch (err) {
      console.error('Error fetching Rezka streams:', err);
      return null;
    }
  }

  // -----------
  // Insert a video + resolution selector in an element
  // -----------
  function addVideoPlayerWithResolution(containerEl, streamUrls) {
    containerEl.innerHTML += `
      <div class="resolution-selector-container">
        <label for="resolution-select">בחר רזולוציה:</label>
        <select id="resolution-select" class="resolution-select">
          <option value="">בחר רזולוציה</option>
          ${Object.keys(streamUrls).map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <video controls class="media-video"></video>
    `;
    const videoEl = containerEl.querySelector('video.media-video');
    const selectEl = containerEl.querySelector('#resolution-select');
    selectEl.onchange = () => {
      const val = selectEl.value;
      if (val && streamUrls[val]) {
        videoEl.src = streamUrls[val];
        videoEl.load();
        videoEl.play().catch(err => console.error('Error playing video:', err));
      }
    };
    const defaultRes = streamUrls['720p'] ? '720p' : Object.keys(streamUrls)[0];
    if (defaultRes) {
      selectEl.value = defaultRes;
      videoEl.src = streamUrls[defaultRes];
      videoEl.load();
      videoEl.play().catch(err => console.error('Error playing video:', err));
    }
  }

  // -----------
  // Toggling watched/to-watch
  // -----------
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
    } catch (err) {
      console.error('Error updating status:', err);
      alert('שגיאה בעדכון סטטוס הפריט.');
    }
  }

  // -----------
  // Updating the status button text
  // -----------
  async function updateStatusButton(button, _tmdbId) {
    if (!currentUser) {
      button.textContent = 'לסימון';
      button.classList.remove('watched', 'to-watch');
      return;
    }
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const status = data.statuses && data.statuses[_tmdbId] ? data.statuses[_tmdbId] : null;
        if (status === 'watched') {
          button.textContent = 'נצפה';
          button.classList.remove('to-watch');
          button.classList.add('watched');
        } else if (status === 'to-watch') {
          button.textContent = 'לצפייה';
          button.classList.remove('watched');
          button.classList.add('to-watch');
        } else {
          button.textContent = 'לסימון';
          button.classList.remove('watched', 'to-watch');
        }
      }
    } catch (err) {
      console.error('Error getting media status:', err);
      alert('שגיאה בעדכון כפתור הסטטוס.');
    }
  }

  // -----------
  // Subtitles: If you want to replicate your old “subtitle controls,” do so here
  // -----------
  function initializeSubtitleControls() {
    setShowSubtitleControls(true);
    // You can replicate your old logic or handle it in a simpler manner
  }

  // -----------
  // Render
  // -----------
  if (error) {
    return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;
  }
  if (!tmdbId) {
    return <div style={{ color: 'red', padding: '20px' }}>לא סופק מזהה מדיה.</div>;
  }
  if (!mediaData) {
    return <div className="loader" />;
  }

  return (
    <div className="media-details-container">
      <header>
        <h1 id="media-title">
          <strong>{mediaData.hebrewTitle} ({mediaData.releaseYear})</strong><br />
          <em>{mediaData.englishTitle} ({mediaData.releaseYear})</em>
        </h1>
      </header>

      {/* Optional loader or error div */}
      <div id="error-message" className="error-message" style={{ display: 'none' }} />

      <div className="media-details">
        {/* Poster */}
        <div className="poster-container">
          <img id="media-poster" src={mediaData.poster} alt="Media Poster" />
        </div>

        {/* Details + Trailer */}
        <div className="details-container">
          {/* Description */}
          <div id="media-description">
            <p>{mediaData.overview}</p>
            <p>
              <strong>שנה:</strong> {mediaData.releaseYear}<br />
              <strong>IMDb ID:</strong> {mediaData.imdbId}<br />
              <strong>דירוג:</strong> {mediaData.rating}<br />
              <strong>ז'אנרים:</strong> {mediaData.genres}<br />
              {/* Cast, etc. if you want */}
            </p>
          </div>

          {/* Rating + Status */}
          <div className="rating-status-container">
            <div className="rating" id="rating" />
            <button
              id="status-button"
              className="status-button"
              onClick={() => {
                toggleMediaStatus(tmdbId).then(() => {
                  const btn = document.getElementById('status-button');
                  if (btn) updateStatusButton(btn, tmdbId);
                });
              }}
            >
              {statusText}
            </button>
          </div>

          {/* Trailer */}
          <div className="trailer-container">
            <iframe id="media-trailer" src="" allowFullScreen style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      {/* Movie stream container */}
      <div id="movie-stream" className="movie-stream-container" style={{ display: 'none' }} />

      {/* Season/Episode selection for TV */}
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

      {/* Subtitle controls container */}
      {showSubtitleControls && (
        <div className="subtitle-controls-container">
          <h2>הגדרות כתוביות</h2>
          <div className="subtitle-controls">
            {/* replicate your old UI for uploading subtitles, etc. */}
            {/* or keep it simpler if you want */}
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaDetails;
