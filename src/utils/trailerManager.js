export async function fetchTrailerUrl(tmdbId, title, year, type) {
    try {
      const mediaType = type === "movie" ? "movie" : "tv";
      const tmdbUrl = `/${mediaType}/${tmdbId}/videos?language=he`;
      const encodedTmdbUrl = encodeURIComponent(tmdbUrl);
      const tmdbResponse = await fetch(`/api/tmdb?url=${encodedTmdbUrl}`);
      const tmdbData = await tmdbResponse.json();
      const trailer = tmdbData.results.find(
        (video) => video.type === "Trailer" && video.site === "YouTube"
      );
      if (trailer) {
        const trailerUrl = `https://www.youtube.com/embed/${trailer.key}`;
        console.log(`Trailer found on TMDB: ${trailerUrl}`);
        return trailerUrl;
      } else {
        console.log(`No trailer found on TMDB for "${title}". Searching YouTube...`);
        const youtubeUrl = await searchYouTubeTrailer(title, year);
        return youtubeUrl;
      }
    } catch (error) {
      console.error("Error fetching trailer from TMDB:", error);
      try {
        const youtubeUrl = await searchYouTubeTrailer(title, year);
        return youtubeUrl;
      } catch (err) {
        console.error("Error searching YouTube trailer:", err);
        return null;
      }
    }
  }
  
  async function searchYouTubeTrailer(title, year) {
    const query = `${title} ${year} trailer`;
    console.log(`Searching YouTube for trailer with query: "${query}".`);
    try {
      const response = await fetch(`/api/youtube?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        const videoId = data.items[0].id.videoId;
        const trailerUrl = `https://www.youtube.com/embed/${videoId}`;
        console.log(`Trailer found on YouTube: ${trailerUrl}`);
        return trailerUrl;
      } else {
        console.log("No trailer found on YouTube.");
        return null;
      }
    } catch (error) {
      console.error("Error searching YouTube trailer:", error);
      return null;
    }
  }
  
  export async function getMediaDetails(tmdbId, mType) {
    try {
      const heTmdbUrl = `/${mType}/${tmdbId}`;
      const heResponse = await fetch(
        `/api/tmdb?url=${encodeURIComponent(heTmdbUrl)}&type=${mType}&id=${tmdbId}&language=he`
      );
      const heData = await heResponse.json();
  
      const enTmdbUrl = `/${mType}/${tmdbId}`;
      const enResponse = await fetch(
        `/api/tmdb?url=${encodeURIComponent(enTmdbUrl)}&type=${mType}&id=${tmdbId}&language=en-US`
      );
      const enData = await enResponse.json();
  
      const externalIdsUrl = `/${mType}/${tmdbId}/external_ids`;
      const externalIdsResponse = await fetch(
        `/api/tmdb?url=${encodeURIComponent(externalIdsUrl)}&type=${mType}&id=${tmdbId}&language=en-US`
      );
      const externalIdsData = await externalIdsResponse.json();
  
      const imdbId = externalIdsData && externalIdsData.imdb_id ? externalIdsData.imdb_id : "N/A";
  
      const releaseYear =
        mType === "movie"
          ? heData.release_date
            ? new Date(heData.release_date).getFullYear()
            : "N/A"
          : heData.first_air_date
          ? new Date(heData.first_air_date).getFullYear()
          : "N/A";
  
      const titleHTML = `<strong>${
        heData.title || heData.name || "אין כותרת בעברית"
      } (${releaseYear})</strong><br><em>${
        enData.title || enData.name || "No English Title"
      } (${releaseYear})</em>`;
      const ratingComponent = "Rating Component Placeholder"; // Replace with your rating component if needed
      const trailerUrl = await fetchTrailerUrl(tmdbId, heData.title || heData.name, releaseYear, mType);
  
      return {
        titleHTML,
        poster: heData.poster_path
          ? `https://image.tmdb.org/t/p/w500${heData.poster_path}`
          : "https://via.placeholder.com/300x450?text=No+Image",
        descriptionHTML: `<p>${heData.overview || "תיאור לא זמין"}</p>`,
        trailerUrl,
        ratingComponent,
        statusText: "לסימון",
        toggleStatus: () => {
          console.log("Toggle status clicked");
        },
      };
    } catch (error) {
      console.error("Error fetching media details:", error);
      return null;
    }
  }
  