// src/components/SmartSearchBar.jsx
import React, { useState } from 'react';
import { isHebrew } from '../utils/helpers'; // Use named export

const SMART_LIBRARY = 'חיפוש מדיה חכם';

function SmartSearchBar({ user, libraries, setLibraries, setMediaItems }) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [loading, setLoading] = useState(false);

  // For each name from OpenAI, perform a TMDB search
  async function doSingleNameTMDBSearch(name, type) {
    const language = isHebrew(name) ? 'he' : 'en-US';
    let tvData = [];
    let movieData = [];
    if (type === 'tv' || type === 'all') {
      const tvResults = await tmdbFetch('tv', name, language);
      tvData = tvResults.map(item => ({ ...item, type: 'tv' }));
    }
    if (type === 'movie' || type === 'all') {
      const movieResults = await tmdbFetch('movie', name, language);
      movieData = movieResults.map(item => ({ ...item, type: 'movie' }));
    }
    return [...tvData, ...movieData];
  }

  // Helper to call our local /api/tmdb endpoint
  async function tmdbFetch(t, q, language) {
    const encodedQuery = encodeURIComponent(q);
    const tmdbUrl = `/search/${t}?language=${language}&query=${encodedQuery}`;
    const encodedUrl = encodeURIComponent(tmdbUrl);
    try {
      const response = await fetch(`/api/tmdb?url=${encodedUrl}&type=${t}&id=&season=&language=${language}`);
      const data = await response.json();
      if (!data || !data.results) return [];
      return data.results;
    } catch (error) {
      console.error('Error in tmdbFetch for SmartSearchBar:', error);
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
      // Clear old results from the smart library and media items
      const updatedLibraries = { ...libraries, [SMART_LIBRARY]: [] };
      setLibraries(updatedLibraries);
      setMediaItems([]);

      // Call our local /api/openai endpoint
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, mediaType })
      });
      const data = await response.json();
      if (data.error) {
        alert("שגיאה בחיפוש חכם");
        setLoading(false);
        return;
      }
      const aiResponse = data.choices[0].message.content;
      const mediaNames = aiResponse
        .split(',')
        .map(n => n.trim())
        .filter(n => n !== '');
      console.log('AI media names:', mediaNames);

      let newMediaItems = [];
      for (const name of mediaNames) {
        const results = await doSingleNameTMDBSearch(name, mediaType);
        if (results.length > 0) {
          // Choose the top result for simplicity
          const item = results[0];
          const releaseYear = item.release_date || item.first_air_date
            ? new Date(item.release_date || item.first_air_date).getFullYear()
            : 'N/A';
          const newMedia = {
            title: item.title || item.name || '',
            hebrewTitle: '', // Optionally fetch more details later
            year: releaseYear,
            tmdbId: item.id,
            type: item.type || (item.title ? 'movie' : 'tv'),
            poster: item.poster_path
              ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
              : 'https://placehold.co/300x450?text=No+Image'
          };
          newMediaItems.push(newMedia);
        }
      }
      setMediaItems(newMediaItems);
      const finalLibs = { ...updatedLibraries, [SMART_LIBRARY]: newMediaItems };
      setLibraries(finalLibs);
      // Save results to localStorage for persistence across refreshes
      localStorage.setItem('smartSearchResults', JSON.stringify(newMediaItems));
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
