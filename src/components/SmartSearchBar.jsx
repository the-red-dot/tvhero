// src/components/SmartSearchBar.jsx
import React, { useState } from 'react';
import { isHebrew } from '../utils/helpers';

const SMART_LIBRARY = 'חיפוש מדיה חכם';

function SmartSearchBar({ user, libraries, setLibraries, setMediaItems }) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [loading, setLoading] = useState(false);

  // A helper that calls our /api/tmdb for Hebrew + English details
  async function fetchFullMediaDetails(tmdbId, fallbackType) {
    // fallbackType is "tv" or "movie"
    // 1) Hebrew fetch
    const heUrl = `/${fallbackType}/${tmdbId}?language=he`;
    const heEncoded = encodeURIComponent(heUrl);
    const heResp = await fetch(`/api/tmdb?url=${heEncoded}&type=${fallbackType}&id=${tmdbId}&season=&language=he`);
    const heData = await heResp.json();

    // 2) English fetch
    const enUrl = `/${fallbackType}/${tmdbId}?language=en-US`;
    const enEncoded = encodeURIComponent(enUrl);
    const enResp = await fetch(`/api/tmdb?url=${enEncoded}&type=${fallbackType}&id=${tmdbId}&season=&language=en-US`);
    const enData = await enResp.json();

    // Poster
    const poster = heData.poster_path
      ? `https://image.tmdb.org/t/p/w500${heData.poster_path}`
      : 'https://placehold.co/300x450?text=No+Image';

    // Titles
    const hebrewTitle = heData.title || heData.name || 'אין כותרת בעברית';
    const englishTitle = enData.title || enData.name || 'אין כותרת באנגלית';

    // Year
    const rawDate = heData.release_date || heData.first_air_date || enData.release_date || enData.first_air_date;
    const year = rawDate ? new Date(rawDate).getFullYear() : 'N/A';

    return {
      title: englishTitle,
      hebrewTitle,
      year,
      tmdbId,
      type: fallbackType,
      poster,
    };
  }

  // For each name from OpenAI, do a minimal TMDB search (like "top result")
  async function doSingleNameTMDBSearch(name, type) {
    const language = isHebrew(name) ? 'he' : 'en-US';
    let tvData = [];
    let movieData = [];

    if (type === 'tv' || type === 'all') {
      const tvResults = await tmdbSearch('tv', name, language);
      tvData = tvResults.map((it) => ({ ...it, type: 'tv' }));
    }
    if (type === 'movie' || type === 'all') {
      const movieResults = await tmdbSearch('movie', name, language);
      movieData = movieResults.map((it) => ({ ...it, type: 'movie' }));
    }
    return [...tvData, ...movieData];
  }

  // Minimal search call to /api/tmdb
  async function tmdbSearch(t, q, lang) {
    const encodedQuery = encodeURIComponent(q);
    const tmdbUrl = `/search/${t}?language=${lang}&query=${encodedQuery}`;
    const encodedUrl = encodeURIComponent(tmdbUrl);
    try {
      const resp = await fetch(`/api/tmdb?url=${encodedUrl}&type=${t}&id=&season=&language=${lang}`);
      const data = await resp.json();
      if (!data || !data.results) return [];
      return data.results;
    } catch (error) {
      console.error('Error in tmdbSearch for SmartSearchBar:', error);
      return [];
    }
  }

  const handleSmartSearch = async () => {
    if (query.trim().length <= 2) return;
    if (!user) {
      alert('אנא התחבר כדי להשתמש בחיפוש חכם.');
      return;
    }
    setLoading(true);

    try {
      // 1) Clear old results from the SMART_LIBRARY
      const updatedLibs = { ...libraries, [SMART_LIBRARY]: [] };
      setLibraries(updatedLibs);
      setMediaItems([]);

      // 2) Call /api/openai
      const resp = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, mediaType }),
      });
      const data = await resp.json();
      if (data.error) {
        alert('שגיאה בחיפוש חכם');
        setLoading(false);
        return;
      }

      // 3) Extract AI names
      const aiResponse = data.choices[0].message.content;
      const mediaNames = aiResponse.split(',')
        .map((n) => n.trim())
        .filter((n) => n !== '');
      console.log('AI media names:', mediaNames);

      // 4) For each name => doSingleNameTMDBSearch => pick top => fetchFullMediaDetails
      const finalMediaItems = [];
      for (const name of mediaNames) {
        const results = await doSingleNameTMDBSearch(name, mediaType);
        if (results.length > 0) {
          // pick top result
          const top = results[0];
          const fallbackType = top.type || (top.title ? 'movie' : 'tv');
          // fetch full Hebrew + English details
          const full = await fetchFullMediaDetails(top.id, fallbackType);
          finalMediaItems.push(full);
        }
      }

      // 5) Update state
      setMediaItems(finalMediaItems);
      const finalLibs = { ...updatedLibs, [SMART_LIBRARY]: finalMediaItems };
      setLibraries(finalLibs);

      // 6) Save to localStorage
      localStorage.setItem('smartSearchResults', JSON.stringify(finalMediaItems));

      setQuery('');
    } catch (error) {
      console.error('Error with AI Search:', error);
      alert('שגיאה בחיפוש חכם');
    }
    setLoading(false);
  };

  return (
    <div className="search-container">
      <select
        className="media-type-select"
        value={mediaType}
        onChange={(e) => setMediaType(e.target.value)}
      >
        <option value="all">הכל</option>
        <option value="movie">סרטים</option>
        <option value="tv">סדרות</option>
      </select>

      <input
        type="text"
        className="smart-search-input"
        placeholder="הקלד את הבקשה שלך..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <button onClick={handleSmartSearch} disabled={loading}>
        {loading ? 'מחפש...' : 'חיפוש חכם'}
      </button>
    </div>
  );
}

export default SmartSearchBar;
