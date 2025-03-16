import React from 'react';
import MediaCard from './MediaCard';

function MediaGrid({ mediaItems }) {
  return (
    <div id="media-container" className="media-grid large-view">
      {mediaItems.map((media) => (
        <MediaCard key={media.tmdbId} media={media} />
      ))}
    </div>
  );
}

export default MediaGrid;
