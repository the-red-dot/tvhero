// src/components/StandardSearchBar.jsx
import React, { useState, useEffect } from 'react';
import { isHebrew } from '../utils/helpers';

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

  // For a single TMDB search
  async function doTMDBSearch(q, mt) {
    try {
      setSearchResults([{ id: 'loading', title: 'מחפש...' }]);
      const language = isHebrew(q) ? 'he' : 'en-US';

      // Possibly do TV + Movie if mt === 'all'
      const tvData = (mt === 'tv' || mt === 'all') ? await tmdbSearch('tv', q, language) : [];
      const movieData = (mt === 'movie' || mt === 'all') ? await tmdbSearch('movie', q, language) : [];

      const combined = [
        ...tvData.map((it) => ({ ...it, type: 'tv' })),
        ...movieData.map((it) => ({ ...it, type: 'movie' })),
      ];
      setSearchResults(combined.slice(0, 10));
    } catch (error) {
      console.error('Error searching TMDB:', error);
      setSearchResults([]);
    }
  }

  // Minimal search call
  async function tmdbSearch(t, q, lang) {
    const encodedQuery = encodeURIComponent(q);
    const tmdbUrl = `/search/${t}?language=${lang}&query=${encodedQuery}`;
    const encodedUrl = encodeURIComponent(tmdbUrl);
    const resp = await fetch(`/api/tmdb?url=${encodedUrl}&type=${t}&id=&season=&language=${lang}`);
    const data = await resp.json();
    if (!data || !data.results) return [];
    return data.results;
  }

  // We fetch the final Hebrew+English details after user clicks a single result
  async function fetchFullMediaDetails(tmdbId, fallbackType) {
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

  // On user selecting a single result
  async function handleSearchResultClick(item) {
    const fallbackType = item.type || (item.title ? 'movie' : 'tv');
    const details = await fetchFullMediaDetails(item.id, fallbackType);

    // Add final details to mediaItems
    setMediaItems((prev) => [...prev, details]);

    // Clear search
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
              const releaseDate = item.release_date || item.first_air_date;
              const releaseYear = releaseDate
                ? new Date(releaseDate).getFullYear()
                : 'N/A';
              const displayTitle = item.title || item.name || '';
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
