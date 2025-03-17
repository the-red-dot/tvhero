import React, { useState } from 'react';
import { isHebrew } from '../utils/helpers';
import { db, doc, setDoc } from '../utils/firebase';

const SMART_LIBRARY = 'חיפוש מדיה חכם';

function SmartSearchBar({ user, libraries, setLibraries, setMediaItems }) {
  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState('all');
  const [loading, setLoading] = useState(false);

  async function fetchFullMediaDetails(tmdbId, fallbackType) {
    const heUrl = `/${fallbackType}/${tmdbId}?language=he`;
    const heEncoded = encodeURIComponent(heUrl);
    const heResp = await fetch(`/api/tmdb?url=${heEncoded}&type=${fallbackType}&id=${tmdbId}&season=&language=he`);
    const heData = await heResp.json();

    const enUrl = `/${fallbackType}/${tmdbId}?language=en-US`;
    const enEncoded = encodeURIComponent(enUrl);
    const enResp = await fetch(`/api/tmdb?url=${enEncoded}&type=${fallbackType}&id=${tmdbId}&season=&language=en-US`);
    const enData = await enResp.json();

    const poster = heData.poster_path
      ? `https://image.tmdb.org/t/p/w500${heData.poster_path}`
      : 'https://placehold.co/300x450?text=No+Image';

    const hebrewTitle = heData.title || heData.name || 'אין כותרת בעברית';
    const englishTitle = enData.title || enData.name || 'אין כותרת באנגלית';

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

      // 4) For each name => doSingleNameTMDBSearch => pick top => fetch full details
      const finalMediaItems = [];
      for (const name of mediaNames) {
        const results = await doSingleNameTMDBSearch(name, mediaType);
        if (results.length > 0) {
          const top = results[0];
          const fallbackType = top.type || (top.title ? 'movie' : 'tv');
          const full = await fetchFullMediaDetails(top.id, fallbackType);
          finalMediaItems.push(full);
        }
      }

      // 5) Update local state and libraries
      setMediaItems(finalMediaItems);
      const finalLibs = { ...updatedLibs, [SMART_LIBRARY]: finalMediaItems };
      setLibraries(finalLibs);

      // 6) Update Firestore for SMART_LIBRARY
      if (user) {
        const libDocRef = doc(db, 'users', user.uid, 'libraries', SMART_LIBRARY);
        await setDoc(libDocRef, { media: finalMediaItems }, { merge: true });
      }

      // 7) Save to localStorage (if desired)
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
