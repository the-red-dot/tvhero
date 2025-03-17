import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMediaDetails } from '../utils/trailerManager';

function MediaDetails() {
  const [searchParams] = useSearchParams();
  const tmdbId = searchParams.get('tmdbId');
  const type = searchParams.get('type') || 'movie';
  const [mediaData, setMediaData] = useState(null);

  useEffect(() => {
    async function fetchDetails() {
      if (tmdbId) {
        const details = await getMediaDetails(tmdbId, type);
        setMediaData(details);
      }
    }
    fetchDetails();
  }, [tmdbId, type]);

  if (!tmdbId) return <div>לא סופק מזהה מדיה.</div>;

  return (
    <div className="media-details-container">
      {mediaData ? (
        <>
          <header>
            <h1 id="media-title" dangerouslySetInnerHTML={{ __html: mediaData.titleHTML }}></h1>
          </header>
          <div className="media-details">
            <div className="poster-container">
              <img id="media-poster" src={mediaData.poster} alt="Media Poster" draggable="false" />
            </div>
            <div className="details-container">
              <div id="media-description" dangerouslySetInnerHTML={{ __html: mediaData.descriptionHTML }}></div>
              <div className="rating-status-container">
                <div className="rating" id="rating">
                  {mediaData.ratingComponent}
                </div>
                <button id="status-button" className="status-button" onClick={mediaData.toggleStatus}>
                  {mediaData.statusText}
                </button>
              </div>
              <div className="trailer-container">
                {mediaData.trailerUrl && (
                  <iframe id="media-trailer" src={mediaData.trailerUrl} allowFullScreen></iframe>
                )}
              </div>
            </div>
          </div>
          {/* (Additional sections for movie stream, season/episode selection, subtitles, etc. can be added here.) */}
        </>
      ) : (
        <div id="loader" className="loader">Loading...</div>
      )}
    </div>
  );
}

export default MediaDetails;
