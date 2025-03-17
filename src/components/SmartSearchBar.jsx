// src/components/SmartSearchBar.jsx
import React, { useState } from 'react';

function SmartSearchBar({ user, setMediaItems }) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [loading, setLoading] = useState(false);

  const handleSmartSearch = async () => {
    if (query.trim().length <= 2) return;
    if (!user) {
      alert('אנא התחבר כדי להשתמש בחיפוש חכם.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: query, mediaType })
      });
      const data = await response.json();
      if (data.error) {
        alert("שגיאה בחיפוש חכם");
        setLoading(false);
        return;
      }
      // Expecting a response with a choices array from OpenAI
      const aiResponse = data.choices[0].message.content;
      const mediaNames = aiResponse.split(',').map(name => name.trim()).filter(name => name !== '');
      const newItems = mediaNames.map(name => ({
        title: name,
        hebrewTitle: name,
        year: 'N/A',
        tmdbId: Math.random(), // Temporary unique ID; replace with actual data if needed
        type: mediaType === 'all' ? 'movie' : mediaType,
        poster: 'https://via.placeholder.com/300x450?text=No+Image'
      }));
      setMediaItems(prev => [...prev, ...newItems]);
      setQuery('');
    } catch (error) {
      console.error("Error with AI Search:", error);
      alert("שגיאה בחיפוש חכם");
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
