import React, { useState, useEffect, useRef, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { LibraryContext } from '../utils/LibraryContext';
import Hls from 'hls.js';
import { fetchTrailerUrl } from '../utils/trailerManager';
import { db, doc, getDoc, updateDoc, deleteField } from '../utils/firebase';
import JSZip from 'jszip';
import '../styles/media.css';

function MediaDetails() {
  const { user } = useContext(LibraryContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tmdbId = searchParams.get('tmdbId');
  const [mediaType, setMediaType] = useState(searchParams.get('type') || 'movie');

  const [mediaData, setMediaData] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState('');
  const [seasons, setSeasons] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedEpisode, setSelectedEpisode] = useState('');
  const [currentStreamUrls, setCurrentStreamUrls] = useState(null);
  const [episodeDescription, setEpisodeDescription] = useState('');
  const [showSubtitleControls, setShowSubtitleControls] = useState(false);
  const [availableSubtitles, setAvailableSubtitles] = useState([]);
  const [fontSize, setFontSize] = useState(60);
  const [subtitleColor, setSubtitleColor] = useState('#FFFFFF');
  const [subtitlePosition, setSubtitlePosition] = useState(10);
  const [timingOffset, setTimingOffset] = useState(0);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [shouldFlipPunctuation, setShouldFlipPunctuation] = useState(true);
  const [selectedResolution, setSelectedResolution] = useState('');
  const [imdbIdGlobal, setImdbIdGlobal] = useState(null);
  const [segmentCount, setSegmentCount] = useState(0);

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const seasonsCache = useRef(new Map());
  const episodesCache = useRef(new Map());
  const creditsCache = useRef(new Map());
  const subtitleContentRef = useRef('');

  // **Authentication Check**
  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  // **Utility Functions**
  function showErrorPopup(message) {
    // Instead of alerting repeatedly, log to console.
    console.error(message);
    // Uncomment the next line if you want to show an alert occasionally.
    // alert(message);
  }

  // **fetchVideoStreams with 'Referer' header**
  async function fetchVideoStreams(title, season = null, episode = null) {
    try {
      let url = `https://ac8b-2a10-8012-21-b22a-519d-24cf-fa98-988a.ngrok-free.app/fetch_stream?title=${encodeURIComponent(title)}`;
      if (season !== null && episode !== null) {
        url += `&season=${season}&episode=${episode}`;
      }
      console.log(`Fetching stream for title: '${title}', season: ${season}, episode: ${episode}`);
      console.log(`Request URL: ${url}`);
      const response = await fetch(url, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'Referer': 'https://ac8b-2a10-8012-21-b22a-519d-24cf-fa98-988a.ngrok-free.app'
        }
      });
      const data = await response.json();
      console.log(`Backend response:`, data);
      if (data.error) {
        console.error(`Error from backend: ${data.error}`);
        showErrorPopup(data.error);
        return null;
      }
      if (data.warning) {
        console.warn(`Warning from backend: ${data.warning}`);
        // Optionally log the warning without an alert:
        // showErrorPopup(data.warning);
      }
      console.log(`Stream URLs received:`, data.stream_urls);
      return data.stream_urls || null;
    } catch (error) {
      console.error(`Fetch error: ${error.message}`);
      showErrorPopup('שגיאה בטעינת הזרם. נסה שוב מאוחר יותר.');
      return null;
    }
  }

  async function toggleMediaStatus(_tmdbId) {
    if (!user) {
      showErrorPopup('יש להתחבר כדי לעדכן את סטטוס הפריט.');
      return;
    }
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      let currentStatus = null;
      if (docSnap.exists()) {
        currentStatus = docSnap.data().statuses?.[_tmdbId] || null;
      }
      if (currentStatus === 'watched') {
        await updateDoc(userDocRef, { [`statuses.${_tmdbId}`]: 'to-watch' });
      } else if (currentStatus === 'to-watch') {
        await updateDoc(userDocRef, { [`statuses.${_tmdbId}`]: deleteField() });
      } else {
        await updateDoc(userDocRef, { [`statuses.${_tmdbId}`]: 'watched' });
      }
      fetchStatus(_tmdbId);
    } catch (error) {
      showErrorPopup('שגיאה בעדכון סטטוס הפריט.');
    }
  }

  async function fetchStatus(_tmdbId) {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        setStatus(docSnap.data().statuses?.[_tmdbId] || null);
      }
    } catch (error) {
      showErrorPopup('שגיאה בקבלת סטטוס הפריט.');
    }
  }

  async function getMediaDetails(_tmdbId, mType) {
    try {
      const heResp = await fetch(`/api/tmdb?url=/${mType}/${_tmdbId}&type=${mType}&id=${_tmdbId}&language=he`);
      const heData = await heResp.json();
      if (!heData) throw new Error('No Hebrew data.');
      const enResp = await fetch(`/api/tmdb?url=/${mType}/${_tmdbId}&type=${mType}&id=${_tmdbId}&language=en-US`);
      const enData = await enResp.json();
      if (!enData) throw new Error('No English data.');
      const extResp = await fetch(`/api/tmdb?url=/${mType}/${_tmdbId}/external_ids&type=${mType}&id=${_tmdbId}&language=en-US`);
      const extData = await extResp.json();
      const imdb = extData?.imdb_id || 'N/A';
      setImdbIdGlobal(imdb);

      const releaseYear =
        mType === 'movie'
          ? heData.release_date
            ? new Date(heData.release_date).getFullYear()
            : 'N/A'
          : heData.first_air_date
          ? new Date(heData.first_air_date).getFullYear()
            : 'N/A';

      let cast = 'אין מידע';
      if (!creditsCache.current.has(_tmdbId)) {
        const creditsResp = await fetch(`/api/tmdb?url=/${mType}/${_tmdbId}/credits&type=credits&id=${_tmdbId}&language=he`);
        const creditsData = await creditsResp.json();
        if (creditsData?.cast) creditsCache.current.set(_tmdbId, creditsData);
      }
      const cachedCredits = creditsCache.current.get(_tmdbId);
      if (cachedCredits?.cast?.length > 0) {
        cast = cachedCredits.cast.slice(0, 5).map(member => member.name).join(', ');
      }

      const combinedData = {
        hebrewTitle: heData.title || heData.name || 'אין כותרת בעברית',
        englishTitle: enData.title || enData.name || 'No English Title',
        releaseYear,
        poster: heData.poster_path
          ? `https://image.tmdb.org/t/p/w500${heData.poster_path}`
          : 'https://via.placeholder.com/300x450?text=No+Image',
        overview: heData.overview || 'תיאור לא זמין',
        rating: heData.vote_average?.toFixed(1) || 'N/A',
        genres: heData.genres?.map(g => g.name).join(', ') || 'N/A',
        imdbId: imdb,
        cast,
        type: mType,
      };
      setMediaData(combinedData);
      setTrailerUrl(await fetchTrailerUrl(_tmdbId, combinedData.hebrewTitle, releaseYear, mType));

      if (mType === 'tv') {
        setSeasons(heData.seasons?.filter(s => s.season_number !== 0) || []);
      } else {
        const fullTitleWithYear = `${enData.title || enData.name} ${releaseYear}`;
        const streamUrls = await fetchVideoStreams(fullTitleWithYear);
        if (streamUrls) {
          setCurrentStreamUrls(streamUrls);
          setShowSubtitleControls(true);
        }
      }
    } catch (err) {
      setError('שגיאה בטעינת פרטי המדיה.');
    }
  }

  async function fetchAndPopulateEpisodes(_tmdbId, seasonNumber) {
    const cacheKey = `${_tmdbId}-season-${seasonNumber}`;
    let seasonData = episodesCache.current.get(cacheKey);
    if (!seasonData) {
      const resp = await fetch(`/api/tmdb?url=tv/${_tmdbId}/season/${seasonNumber}&type=tv&id=${_tmdbId}&season=${seasonNumber}&language=he`);
      seasonData = await resp.json();
      if (seasonData?.episodes) episodesCache.current.set(cacheKey, seasonData);
    }
    setEpisodes(seasonData?.episodes || []);
  }

  // Updated: Build full title (with year) for TV series when fetching episode stream URLs
  async function displayEpisodeDetails(seasonNumber, episodeNumber) {
    const cacheKey = `${tmdbId}-season-${seasonNumber}`;
    const seasonData = episodesCache.current.get(cacheKey);
    if (!seasonData) return;

    const episode = seasonData.episodes.find(ep => ep.episode_number === parseInt(episodeNumber, 10));
    if (episode) {
      setEpisodeDescription(`פרק ${episode.episode_number}: ${episode.name || 'אין כותרת'} - ${episode.overview || 'תיאור לא זמין'}`);
      // Build full title including release year for TV series as well
      const fullTitleWithYear = `${mediaData.englishTitle} ${mediaData.releaseYear}`;
      const streamUrls = await fetchVideoStreams(fullTitleWithYear, seasonNumber, episodeNumber);
      if (streamUrls) {
        setCurrentStreamUrls(streamUrls);
        setShowSubtitleControls(true);
      } else {
        setCurrentStreamUrls(null);
      }
    } else {
      setEpisodeDescription('פרק לא נמצא.');
      setCurrentStreamUrls(null);
    }
  }

  // **Subtitle Utility Functions**
  function timeStringToSeconds(timeStr) {
    const [hours, minutes, rest] = timeStr.split(':');
    const [seconds, milliseconds] = rest.split('.');
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(milliseconds) / 1000;
  }

  function secondsToTimeString(seconds) {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toFixed(3).toString().padStart(6, '0');
    return `${hrs}:${mins}:${secs}`;
  }

  function flipPunctuation(subtitleText) {
    const punctuationMarks = ['?', '.', '!', ':', ',', '-', '"'];
    const lines = subtitleText.split('\n');
    return lines.map(line => {
      const trimmed = line.trim();
      if (/^\d+$/.test(trimmed) || line.includes('-->') || !trimmed) return line;
      let trimmedLine = line.trimStart();
      let punctuationPrefix = '';
      while (trimmedLine && punctuationMarks.includes(trimmedLine[0])) {
        punctuationPrefix += trimmedLine[0];
        trimmedLine = trimmedLine.substring(1);
      }
      return punctuationPrefix ? `${trimmedLine.trim()}${punctuationPrefix}` : line;
    }).join('\n');
  }

  function parseAndAdjustSubtitle(subtitleText, offset, shouldFlip) {
    let processedText = shouldFlip ? flipPunctuation(subtitleText) : subtitleText;
    return processedText.split('\n').map(line => {
      const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
      if (timeMatch) {
        let start = timeStringToSeconds(timeMatch[1].replace(',', '.')) + offset;
        let end = timeStringToSeconds(timeMatch[2].replace(',', '.')) + offset;
        if (start < 0) start = 0;
        if (end < 0) end = 0;
        return `${secondsToTimeString(start)} --> ${secondsToTimeString(end)}`;
      }
      return line;
    }).join('\n');
  }

  function convertSRTtoVTT(srt) {
    return 'WEBVTT\n\n' + srt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  }

  function applySubtitleSettings() {
    if (!videoRef.current || !subtitleContentRef.current) return;
    const adjustedContent = parseAndAdjustSubtitle(subtitleContentRef.current || 'WEBVTT\n\n', timingOffset, shouldFlipPunctuation);
    const blob = new Blob([adjustedContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);

    const existingTrack = videoRef.current.querySelector('track');
    if (existingTrack) videoRef.current.removeChild(existingTrack);

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = 'User Subtitles';
    track.srclang = 'en';
    track.default = true;
    track.src = url;
    videoRef.current.appendChild(track);

    track.onload = () => {
      const textTracks = videoRef.current.textTracks;
      for (let i = 0; i < textTracks.length; i++) {
        if (textTracks[i].label === 'User Subtitles') {
          textTracks[i].mode = 'showing';
          break;
        }
      }
    };

    let style = document.getElementById('custom-subtitle-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'custom-subtitle-style';
      document.head.appendChild(style);
    }
    style.innerHTML = `
      video::-webkit-media-text-track-display { background: transparent; }
      ::cue {
        font-size: ${fontSize}px;
        color: ${subtitleColor};
        font-family: ${fontFamily}, sans-serif;
        bottom: ${subtitlePosition}%;
        background: rgba(0,0,0,0.6);
      }
    `;
  }

  async function fetchAndDisplayAvailableSubtitles(imdbId, season = null, episode = null) {
    try {
      const resp = await fetch(`https://wizdom.xyz/api/releases/${imdbId}`);
      if (!resp.ok) throw new Error('Subtitles not found.');
      const data = await resp.json();
      const allSubs = data.subs;
      let subtitlesList = [];
      if (Array.isArray(allSubs)) {
        subtitlesList = allSubs;
      } else if (season && episode && allSubs[season]?.[episode]) {
        subtitlesList = allSubs[season][episode];
      }
      setAvailableSubtitles(subtitlesList.map(sub => ({
        id: sub.id,
        label: `${sub.version} (${sub.date ? new Date(sub.date).getFullYear() : 'N/A'}) [${sub.release_group || '-'}]`,
      })));
    } catch (error) {
      setAvailableSubtitles([{ id: '', label: 'שגיאה בטעינת כתוביות' }]);
    }
  }

  async function downloadAndLoadSelectedSubtitle(subId) {
    try {
      const resp = await fetch(`https://wizdom.xyz/api/files/sub/${subId}`);
      if (!resp.ok) throw new Error('Failed to download subtitles.');
      const blob = await resp.blob();
      const zip = new JSZip();
      const zipData = await zip.loadAsync(blob);
      const fileName = Object.keys(zipData.files)[0];
      const content = await zipData.files[fileName].async('string');
      subtitleContentRef.current = content.startsWith('WEBVTT') ? content : convertSRTtoVTT(content);
      applySubtitleSettings();
    } catch (error) {
      showErrorPopup('שגיאה בהורדה/פתיחת הכתוביות.');
    }
  }

  // **Effects**
  useEffect(() => {
    if (!tmdbId) {
      setError('לא סופק מזהה מדיה.');
      return;
    }
    if (user) {
      getMediaDetails(tmdbId, mediaType);
    }
  }, [tmdbId, mediaType, user]);

  useEffect(() => {
    if (mediaData && user) fetchStatus(tmdbId);
  }, [mediaData, user, tmdbId]);

  useEffect(() => {
    if (mediaType === 'tv' && selectedSeason) fetchAndPopulateEpisodes(tmdbId, selectedSeason);
  }, [selectedSeason, mediaType, tmdbId]);

  useEffect(() => {
    if (mediaType === 'tv' && selectedEpisode) displayEpisodeDetails(selectedSeason, selectedEpisode);
  }, [selectedEpisode, mediaType, tmdbId, selectedSeason]);

  // **Handle Video Source Setup with hls.js**
  useEffect(() => {
    if (!currentStreamUrls || !selectedResolution || !videoRef.current) return;

    const videoSrc = currentStreamUrls[selectedResolution];
    const currentTime = videoRef.current.currentTime || 0;

    // Clean up any existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        maxBufferLength: 480, // Buffer up to 8 minutes ahead
      });
      hlsRef.current.loadSource(videoSrc);
      hlsRef.current.attachMedia(videoRef.current);

      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
        if (hlsRef.current.levels && hlsRef.current.currentLevel >= 0 && hlsRef.current.levels[hlsRef.current.currentLevel]?.details) {
          const playlist = hlsRef.current.levels[hlsRef.current.currentLevel].details;
          setSegmentCount(playlist.fragments.length);
        } else {
          setSegmentCount(0); // Default to 0 if details are unavailable
        }
        videoRef.current.currentTime = currentTime;
        // Log error instead of showing an alert if play fails
        videoRef.current.play().catch(err => console.error("Play error:", err));
      });

      hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              showErrorPopup('שגיאת רשת: לא ניתן לטעון את הווידאו.');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              // Try to recover from media error instead of showing popup
              hlsRef.current.recoverMediaError();
              break;
            default:
              logger.error("Unknown fatal error:", data);
              // Optionally show popup for unknown fatal errors:
              // showErrorPopup('שגיאה לא ידועה בניגון הווידאו.');
          }
        }
        // Non-fatal errors are silently ignored
      });
    } else {
      videoRef.current.src = videoSrc;
      videoRef.current.load();
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current.currentTime = currentTime;
        videoRef.current.play().catch(err => console.error("Play error:", err));
      }, { once: true });
      setSegmentCount(0);
    }

    // Fetch subtitles if available
    if (imdbIdGlobal) {
      fetchAndDisplayAvailableSubtitles(imdbIdGlobal, mediaType === 'tv' ? selectedSeason : null, mediaType === 'tv' ? selectedEpisode : null);
    }
    const emptyVTT = 'WEBVTT\n\n';
    subtitleContentRef.current = emptyVTT;
    applySubtitleSettings();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentStreamUrls, selectedResolution, imdbIdGlobal, mediaType, selectedSeason, selectedEpisode]);

  useEffect(() => {
    if (currentStreamUrls) {
      const resolutions = Object.keys(currentStreamUrls);
      const defaultResolution = resolutions.includes('480p') ? '480p' : resolutions[0];
      setSelectedResolution(defaultResolution);
    }
  }, [currentStreamUrls]);

  // **Render Logic**
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
              <strong>שנה:</strong> {mediaData.releaseYear}<br />
              <strong>IMDb ID:</strong> {mediaData.imdbId}<br />
              <strong>דירוג:</strong> {mediaData.rating}<br />
              <strong>ז'אנרים:</strong> {mediaData.genres}<br />
              <strong>שחקנים:</strong> {mediaData.cast}
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
            <iframe id="media-trailer" src={trailerUrl} allowFullScreen style={{ display: trailerUrl ? 'block' : 'none' }} />
          </div>
        </div>
      </div>

      {mediaType === 'movie' && currentStreamUrls && (
        <div id="movie-stream" className="movie-stream-container">
          <div>
            <label htmlFor="resolution-select">בחר רזולוציה:</label>
            <select
              id="resolution-select"
              value={selectedResolution}
              onChange={e => setSelectedResolution(e.target.value)}
            >
              <option value="">בחר רזולוציה</option>
              {Object.keys(currentStreamUrls).map(res => (
                <option key={res} value={res}>{res}</option>
              ))}
            </select>
            <video ref={videoRef} controls className="media-video" />
          </div>
        </div>
      )}

      {mediaType === 'tv' && (
        <div className="season-episode-container">
          <h2>בחר עונה ופרק</h2>
          <div className="selectors">
            <label htmlFor="season-select">עונה:</label>
            <select value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}>
              <option value="">בחר עונה</option>
              {seasons.map(season => (
                <option key={season.season_number} value={season.season_number}>
                  עונה {season.season_number} - {season.name || ''}
                </option>
              ))}
            </select>
            <label htmlFor="episode-select">פרק:</label>
            <select
              value={selectedEpisode}
              onChange={e => setSelectedEpisode(e.target.value)}
              disabled={!selectedSeason}
            >
              <option value="">בחר פרק</option>
              {episodes.map(episode => (
                <option key={episode.episode_number} value={episode.episode_number}>
                  פרק {episode.episode_number} - {episode.name || ''}
                </option>
              ))}
            </select>
          </div>
          {episodeDescription && currentStreamUrls && (
            <div className="episode-details">
              <h3>{episodeDescription}</h3>
              <div>
                <label htmlFor="resolution-select">בחר רזולוציה:</label>
                <select
                  id="resolution-select"
                  value={selectedResolution}
                  onChange={e => setSelectedResolution(e.target.value)}
                >
                  <option value="">בחר רזולוציה</option>
                  {Object.keys(currentStreamUrls).map(res => (
                    <option key={res} value={res}>{res}</option>
                  ))}
                </select>
                <video ref={videoRef} controls className="media-video" />
              </div>
            </div>
          )}
        </div>
      )}

      {showSubtitleControls && (
        <div className="subtitle-controls-container">
          <h2>הגדרות כתוביות</h2>
          <div className="subtitle-controls">
            <div className="control-group">
              <label htmlFor="subtitle-upload">העלה קובץ כתוביות:</label>
              <input
                type="file"
                id="subtitle-upload"
                accept=".srt, .vtt"
                onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                  if (!['.srt', '.vtt'].includes(ext)) {
                    showErrorPopup('יש להעלות קובץ כתוביות בפורמט .srt או .vtt');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = ev => {
                    let content = ev.target.result;
                    subtitleContentRef.current = ext === '.vtt' ? content : convertSRTtoVTT(content);
                    applySubtitleSettings();
                  };
                  reader.onerror = () => showErrorPopup('שגיאה בטעינת קובץ הכתוביות.');
                  reader.readAsText(file);
                }}
              />
            </div>
            <div className="control-group">
              <label htmlFor="font-size">גודל גופן (px):</label>
              <input
                type="number"
                id="font-size"
                value={fontSize}
                min="10"
                max="100"
                onChange={e => setFontSize(parseInt(e.target.value))}
              />
            </div>
            <div className="control-group">
              <label htmlFor="subtitle-color">צבע כתוביות:</label>
              <input
                type="color"
                id="subtitle-color"
                value={subtitleColor}
                onChange={e => setSubtitleColor(e.target.value)}
              />
            </div>
            <div className="control-group">
              <label htmlFor="subtitle-position">מיקום כתוביות (%):</label>
              <input
                type="number"
                id="subtitle-position"
                value={subtitlePosition}
                min="0"
                max="100"
                onChange={e => setSubtitlePosition(parseInt(e.target.value))}
              />
            </div>
            <div className="control-group">
              <label htmlFor="timing-offset">הסטת תזמון (שניות):</label>
              <input
                type="number"
                id="timing-offset"
                value={timingOffset}
                step="0.1"
                onChange={e => setTimingOffset(parseFloat(e.target.value))}
              />
            </div>
            <div className="control-group">
              <label htmlFor="font-family">משפחת גופן:</label>
              <select id="font-family" value={fontFamily} onChange={e => setFontFamily(e.target.value)}>
                <option value="Arial">Arial</option>
                <option value="Verdana">Verdana</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>
            <div className="control-group">
              <input
                type="checkbox"
                id="flip-punctuation"
                checked={shouldFlipPunctuation}
                onChange={e => setShouldFlipPunctuation(e.target.checked)}
              />
              <label htmlFor="flip-punctuation">הפוך סימני פיסוק</label>
            </div>
            <div className="control-group">
              <label htmlFor="available-subtitles">כתוביות זמינות:</label>
              <select id="available-subtitles">
                <option value="">בחר כתוביות...</option>
                {availableSubtitles.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.label}</option>
                ))}
              </select>
              <button
                id="load-selected-subtitles"
                className="action-button"
                onClick={() => {
                  const subId = document.getElementById('available-subtitles').value;
                  if (!subId) showErrorPopup('לא נבחרו כתוביות.');
                  else downloadAndLoadSelectedSubtitle(subId);
                }}
              >
                טען כתוביות נבחרות
              </button>
            </div>
            <div className="button-group">
              <button id="apply-settings" className="action-button" onClick={applySubtitleSettings}>
                החל הגדרות
              </button>
              <button
                id="reset-settings"
                className="action-button"
                onClick={() => {
                  setFontSize(60);
                  setSubtitleColor('#FFFFFF');
                  setSubtitlePosition(10);
                  setTimingOffset(0);
                  setFontFamily('Arial');
                  setShouldFlipPunctuation(true);
                  applySubtitleSettings();
                }}
              >
                אפס הגדרות
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaDetails;
