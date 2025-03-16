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
  