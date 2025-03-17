export default async function handler(req, res) {
  const TMDB_API_KEY = process.env.TMDB_API_KEY; // from Vercel env vars
  const { url, type, id, season, language } = req.query;

  try {
    let apiUrl;

    if (type === "tv" && id && season) {
      const seasonNum = parseInt(season, 10);
      if (isNaN(seasonNum) || seasonNum < 1) {
        console.error('Invalid "season" parameter.');
        res.status(400).json({ error: 'Invalid "season" parameter.' });
        return;
      }
      apiUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}&language=${language || "he"}`;
    } else if (type === "tv" && url && url.includes("/external_ids") && id) {
      apiUrl = `https://api.themoviedb.org/3/tv/${id}/external_ids?api_key=${TMDB_API_KEY}&language=${language || "en-US"}`;
    } else if (type === "tv" && id) {
      apiUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&language=${language || "he"}`;
    } else if (type === "movie" && url && url.includes("/external_ids") && id) {
      apiUrl = `https://api.themoviedb.org/3/movie/${id}/external_ids?api_key=${TMDB_API_KEY}&language=${language || "en-US"}`;
    } else if (type === "movie" && id) {
      apiUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_API_KEY}&language=${language || "he"}`;
    } else {
      // Fallback for any /search/ or other endpoints
      const separator = url && url.includes("?") ? "&" : "?";
      apiUrl = `https://api.themoviedb.org/3${url}${separator}api_key=${TMDB_API_KEY}&language=${language || "he"}`;
    }

    console.log(`Fetching TMDb API URL: ${apiUrl}`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        `TMDb API Error: ${errorData.status_message} (Code: ${errorData.status_code})`
      );
      res
        .status(response.status)
        .json({ error: `TMDb API Error: ${errorData.status_message}` });
      return;
    }

    const data = await response.json();
    console.log("TMDb API Response:", data);

    // Additional validation if fetching episodes, etc.
    if (type === "tv" && id && season) {
      if (!data || !data.episodes) {
        console.error("No episodes data received from TMDB.");
        res.status(404).json({ error: "No episodes data received from TMDB." });
        return;
      }
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching TMDb API:", error);
    res.status(500).json({ error: "Error fetching TMDb API" });
  }
}
