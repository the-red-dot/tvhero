// src/components/MediaGrid.jsx

import React from 'react';
import MediaCard from './MediaCard';

function MediaGrid({ mediaItems, onRemoveMedia, onAddMedia, onStatusChanged }) {
  return (
    <div className="media-grid large-view">
      {mediaItems.map((media) => (
        <MediaCard
          key={media.tmdbId}
          media={media}
          onRemove={onRemoveMedia}
          onAdd={onAddMedia}
          onStatusChange={onStatusChanged}
        />
      ))}
    </div>
  );
}

export default MediaGrid;
