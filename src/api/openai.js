export default async function handler(req, res) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const { prompt, mediaType } = req.body;
  
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // Do not change this model
          messages: [
            {
              role: "system",
              content: `Provide only the names of ${
                mediaType === "all" ? "movies and TV series" : mediaType
              } as they are listed on TMDB, separated by commas, with no numbering or extra information. If the user types their query in Hebrew, return the results in English separated by commas!.`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.75,
          max_tokens: 800,
        }),
      });
  
      const data = await response.json();
      res.status(200).json(data);
    } catch (error) {
      console.error("Error calling OpenAI API:", error);
      res.status(500).json({ error: "Error calling OpenAI API" });
    }
  }
  