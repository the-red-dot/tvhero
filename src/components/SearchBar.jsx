import React, { useState } from 'react';

function SearchBar({ currentLibrary, setMediaItems, libraries, setLibraries, user }) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');

  const handleMagicSearch = async () => {
    if (query.trim().length > 2) {
      try {
        const response = await fetch('/api/openai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: query, mediaType }),
        });
        const data = await response.json();
        if (data.error) {
          alert("שגיאה בחיפוש");
          return;
        }
        const aiResponse = data.choices[0].message.content;
        const mediaNames = aiResponse.split(',').map(name => name.trim()).filter(name => name !== '');
        // For demonstration, add placeholder media items
        mediaNames.forEach(name => {
          setMediaItems(prev => [
            ...prev,
            {
              title: name,
              hebrewTitle: name,
              year: 'N/A',
              tmdbId: Math.random(),
              type: mediaType === 'all' ? 'movie' : mediaType,
              poster: 'https://via.placeholder.com/300x450?text=No+Image',
            },
          ]);
        });
        setQuery('');
      } catch (error) {
        console.error("Error with AI Search:", error);
      }
    }
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
        placeholder="הקלד את הבקשה שלך..."
        value={query}
        onChange={handleSearchChange}
      />
      {user && (
        <button id="magic-button" aria-label="Execute AI Search" onClick={handleMagicSearch}>
          <svg viewBox="0 0 24 24">
            <path d="M2 17.25L9.95 9.3l4.75 4.75L6.75 22H2v-4.75zM22 2l-2.75 2.75-4.75-4.75L17.25 2 22 2zm-5.75 5.75L14.5 8.5l-4.75-4.75L11.5 3l4.75 4.75zM4.75 14.5L3 16.25 7.75 21l1.75-1.75L4.75 14.5z"/>
          </svg>
        </button>
      )}
      <div id="search-results" className="search-results"></div>
    </div>
  );
}

export default SearchBar;
