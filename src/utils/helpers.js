// src/utils/helpers.js
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

export function cloneMediaArray(mediaArray) {
  return mediaArray.map((media) => cloneMedia(media));
}

// Add your isHebrew helper as a named export:
export function isHebrew(text) {
  return /[\u0590-\u05FF]/.test(text);
}
