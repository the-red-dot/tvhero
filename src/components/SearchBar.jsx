import React, { useState, useEffect } from 'react';

// Utility function to detect if a query is Hebrew (for setting TMDB language)
function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}

function SearchBar({
  currentLibrary,
  setMediaItems,
  libraries,
  setLibraries,
  user
}) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [searchResults, setSearchResults] = useState([]); // For standard search results
  const [isLoading, setIsLoading] = useState(false);

  // --- 1) Smart Search (OpenAI) via Magic Button ---
  const handleMagicSearch = async () => {
    if (!user) {
      alert('אנא התחבר כדי להשתמש בחיפוש החכם.');
      return;
    }
    if (query.trim().length < 3) {
      alert('אנא הזן לפחות 3 תווים עבור החיפוש.');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, mediaType })
      });
      const data = await response.json();
      if (data.error) {
        alert('שגיאה בחיפוש AI');
        console.error('OpenAI error:', data.error);
        setIsLoading(false);
        return;
      }
      // data.choices[0].message.content => CSV of media names
      const aiResponse = data.choices?.[0]?.message?.content || '';
      const mediaNames = aiResponse
        .split(',')
        .map(name => name.trim())
        .filter(name => name !== '');

      // For demonstration, add placeholder items to current library:
      const updated = [...(libraries[currentLibrary] || [])];
      mediaNames.forEach(name => {
        // Check if already exists by title, or you might use a different check
        if (!updated.some(m => m.title === name)) {
          updated.push({
            title: name,
            hebrewTitle: name,
            year: 'N/A',
            tmdbId: Math.random(),
            type: mediaType === 'all' ? 'movie' : mediaType,
            poster: 'https://via.placeholder.com/300x450?text=No+Image'
          });
        }
      });
      setLibraries(prev => ({ ...prev, [currentLibrary]: updated }));
      setMediaItems(updated);
      setQuery('');
    } catch (error) {
      console.error('Error with AI Search:', error);
      alert('שגיאה בחיפוש AI');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 2) Standard Search (TMDB) for non-main libraries ---
  useEffect(() => {
    if (!user) return; // or skip if user not logged in
    if (currentLibrary === 'חיפוש מדיה חכם') {
      // Clear results if we are in main library
      setSearchResults([]);
      return;
    }
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    const timeoutId = setTimeout(() => {
      standardSearch(query, mediaType);
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mediaType, currentLibrary]);

  // Standard search function
  const standardSearch = async (q, mType) => {
    setIsLoading(true);
    try {
      // Detect if query is Hebrew => use 'he' or 'en-US'
      const language = isHebrew(q) ? 'he' : 'en-US';
      let tvData = { results: [] };
      let moviesData = { results: [] };

      // We'll fetch both if mediaType is "all", or one if it's "movie"/"tv"
      const fetchTV = async () => {
        const tvUrl = `/search/tv?language=${language}&query=${encodeURIComponent(q)}`;
        const encodedUrl = encodeURIComponent(tvUrl);
        const res = await fetch(`/api/tmdb?url=${encodedUrl}&type=tv&id=&season=&language=${language}`);
        return res.json();
      };
      const fetchMovie = async () => {
        const movieUrl = `/search/movie?language=${language}&query=${encodeURIComponent(q)}`;
        const encodedUrl = encodeURIComponent(movieUrl);
        const res = await fetch(`/api/tmdb?url=${encodedUrl}&type=movie&id=&season=&language=${language}`);
        return res.json();
      };

      if (mType === 'tv') {
        tvData = await fetchTV();
      } else if (mType === 'movie') {
        moviesData = await fetchMovie();
      } else {
        // mType = "all"
        [tvData, moviesData] = await Promise.all([fetchTV(), fetchMovie()]);
      }

      const results = [];
      if (tvData.results && tvData.results.length > 0) {
        tvData.results.forEach(tv => {
          results.push({
            tmdbId: tv.id,
            type: 'tv',
            title: tv.name || '',
            hebrewTitle: tv.name || '',
            year: tv.first_air_date
              ? new Date(tv.first_air_date).getFullYear()
              : 'N/A',
            poster: tv.poster_path
              ? `https://image.tmdb.org/t/p/w500${tv.poster_path}`
              : 'https://via.placeholder.com/300x450?text=No+Image'
          });
        });
      }
      if (moviesData.results && moviesData.results.length > 0) {
        moviesData.results.forEach(movie => {
          results.push({
            tmdbId: movie.id,
            type: 'movie',
            title: movie.title || '',
            hebrewTitle: movie.title || '',
            year: movie.release_date
              ? new Date(movie.release_date).getFullYear()
              : 'N/A',
            poster: movie.poster_path
              ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
              : 'https://via.placeholder.com/300x450?text=No+Image'
          });
        });
      }
      // Limit to 10 results for the dropdown
      setSearchResults(results.slice(0, 10));
    } catch (error) {
      console.error('Error searching TMDB:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Called when user clicks on a search result
  const handleSearchResultClick = (mediaData) => {
    // If it already exists in the current library, skip
    const currentLibItems = libraries[currentLibrary] || [];
    if (currentLibItems.some(m => m.tmdbId === mediaData.tmdbId)) {
      alert('הפריט כבר קיים בספרייה זו');
      return;
    }
    // Otherwise, add it
    const updated = [...currentLibItems, mediaData];
    setLibraries(prev => ({ ...prev, [currentLibrary]: updated }));
    setMediaItems(updated);
    setSearchResults([]); // Hide search results
    setQuery(''); // Clear input
  };

  const handleSearchChange = (e) => {
    setQuery(e.target.value);
  };

  return (
    <div className="search-container">
      <select
        id="media-type-select"
        className="media-type-select"
        aria-label="Select Media Type"
        value={mediaType}
        onChange={(e) => setMediaType(e.target.value)}
      >
        <option value="all">הכל</option>
        <option value="movie">סרטים</option>
        <option value="tv">סדרות</option>
      </select>

      <input
        type="text"
        id="media-search"
        placeholder={
          currentLibrary === 'חיפוש מדיה חכם'
            ? 'חיפוש חכם או חיפוש רגיל...'
            : 'הקלד לחיפוש...'
        }
        value={query}
        onChange={handleSearchChange}
      />

      {/* Magic button only shown if user is logged in & current library is main */}
      {user && currentLibrary === 'חיפוש מדיה חכם' && (
        <button
          id="magic-button"
          aria-label="Execute AI Search"
          onClick={handleMagicSearch}
          disabled={isLoading}
        >
          <svg viewBox="0 0 24 24">
            <path d="M2 17.25L9.95 9.3l4.75 4.75L6.75 22H2v-4.75zM22 2l-2.75 2.75-4.75-4.75L17.25 2 22 2zm-5.75 5.75L14.5 8.5l-4.75-4.75L11.5 3l4.75 4.75zM4.75 14.5L3 16.25 7.75 21l1.75-1.75L4.75 14.5z"/>
          </svg>
        </button>
      )}

      {/* Standard search results dropdown */}
      {searchResults.length > 0 && (
        <div id="search-results" className="search-results">
          {searchResults.map((item) => (
            <div
              key={item.tmdbId}
              className="search-result-item"
              onClick={() => handleSearchResultClick(item)}
            >
              {item.title} ({item.year}) {item.type === 'tv' ? '[TV]' : '[Movie]'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
