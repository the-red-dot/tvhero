// src/components/StandardSearchBar.jsx
import React, { useState, useEffect } from 'react';

function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

function StandardSearchBar({ user, setMediaItems }) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!user) return;
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      doTMDBSearch(query, mediaType);
    }, 500);
    return () => clearTimeout(timer);
  }, [query, mediaType, user]);

  async function doTMDBSearch(q, mt) {
    try {
      setSearchResults([{ id: 'loading', title: 'מחפש...' }]);
      const language = isHebrew(q) ? 'he' : 'en-US';
      const tvData = (mt === 'tv' || mt === 'all') ? await tmdbFetch('tv', q, language) : [];
      const movieData = (mt === 'movie' || mt === 'all') ? await tmdbFetch('movie', q, language) : [];
      const combined = [
        ...tvData.map((item) => ({ ...item, type: 'tv' })),
        ...movieData.map((item) => ({ ...item, type: 'movie' }))
      ];
      setSearchResults(combined.slice(0, 10));
    } catch (error) {
      console.error('Error searching TMDB:', error);
      setSearchResults([]);
    }
  }

  async function tmdbFetch(type, q, language) {
    const encodedQuery = encodeURIComponent(q);
    const tmdbUrl = `/search/${type}?language=${language}&query=${encodedQuery}`;
    const encodedUrl = encodeURIComponent(tmdbUrl);
    const response = await fetch(`/api/tmdb?url=${encodedUrl}&type=${type}&id=&season=&language=${language}`);
    const data = await response.json();
    if (!data || !data.results) return [];
    return data.results;
  }

  function handleSearchResultClick(item) {
    const releaseYear = item.release_date || item.first_air_date
      ? new Date(item.release_date || item.first_air_date).getFullYear()
      : 'N/A';
    const newMedia = {
      title: item.title || item.name || '',
      hebrewTitle: '', // Can be updated later with more details
      year: releaseYear,
      tmdbId: item.id,
      type: item.type || 'movie',
      poster: item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : 'https://via.placeholder.com/300x450?text=No+Image'
    };
    setMediaItems((prev) => [...prev, newMedia]);
    setSearchResults([]);
    setQuery('');
  }

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
        className="standard-search-input"
        placeholder="הקלד את הבקשה שלך..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {searchResults.length > 0 && (
        <div className="search-results">
          {searchResults[0].id === 'loading' ? (
            <div className="search-result-item">מחפש...</div>
          ) : (
            searchResults.map((item) => {
              const releaseYear = item.release_date || item.first_air_date
                ? new Date(item.release_date || item.first_air_date).getFullYear()
                : 'N/A';
              const displayTitle = item.title || item.name;
              return (
                <div
                  key={`${item.id}-${item.type}`}
                  className="search-result-item"
                  onClick={() => handleSearchResultClick(item)}
                >
                  {`${displayTitle} (${releaseYear}) [${item.type === 'tv' ? 'TV' : 'Movie'}]`}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default StandardSearchBar;
