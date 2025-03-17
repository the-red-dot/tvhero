export default async function handler(req, res) {
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    const { query } = req.query;
  
    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`
      );
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      console.error("Error fetching YouTube API:", error);
      res.status(500).json({ error: "Error fetching YouTube API" });
    }
  }
  