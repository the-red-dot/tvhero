// src/utils/helpers.js

// 1) Clones a single media object
export function cloneMedia(media) {
  return {
    title: media.title,
    hebrewTitle: media.hebrewTitle,
    year: media.year,
    tmdbId: media.tmdbId,
    type: media.type,
    poster: media.poster,
  };
}

// 2) Clones an array of media objects
export function cloneMediaArray(mediaArray) {
  return mediaArray.map((media) => cloneMedia(media));
}

// 3) Checks if text has Hebrew characters
export function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}
