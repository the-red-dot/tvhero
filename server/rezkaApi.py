from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from hdrezka import Search
from HdRezkaApi import HdRezkaApi
import logging

app = FastAPI()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://localhost:8000",
        "https://tvhero.vercel.app",
        "https://tvhero-git-main-geras-projects-5ef45cdd.vercel.app",
        "https://f8fe-2a10-8012-1-e449-1c0e-f70a-cff8-2d58.ngrok-free.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/fetch_stream")
async def fetch_stream(
    request: Request,
    title: str = Query(None),
    season: int = Query(None),
    episode: int = Query(None),
):
    if request.method == "GET" and not title:
        logger.error("Title is required but not provided.")
        raise HTTPException(status_code=400, detail="Title is required")

    try:
        logger.info(
            f"Fetching stream for title: '{title}', season: {season}, episode: {episode}"
        )
        logger.info(f"Request headers: {request.headers}")

        # Search for the title
        search_results = await Search(title).get_page(1)
        if not search_results:
            logger.warning(f"No search results found for title: '{title}'")
            return {"error": "אין דיבובים זמינים לתוכן זה."}

        media = search_results[0]
        logger.info(f"Selected media URL: {media.url}")
        rezka = HdRezkaApi(media.url)
        logger.info(f"Media type detected: {rezka.type}")

        # Log available translators
        available_translators = list(rezka.translators.keys())
        logger.info(f"Available translators: {available_translators}")

        # Select translator
        preferred_translators = ["Оригинал (+субтитры)"]
        selected_translator = next(
            (t for t in preferred_translators if t in available_translators), None
        )
        warning_message = None
        if not selected_translator:
            if available_translators:
                selected_translator = available_translators[0]
                logger.info(
                    f"No preferred translator found. Falling back to: '{selected_translator}'"
                )
                warning_message = "לא נמצא דיבוב באנגלית"
            else:
                logger.error("No translators available for this media.")
                return {"error": "אין דיבובים זמינים לתוכן זה."}

        logger.info(f"Selected translator: '{selected_translator}'")
        translator_id = rezka.translators.get(selected_translator)
        logger.info(f"Translator ID: {translator_id}")

        # Fetch stream URLs
        stream_urls = {}
        try:
            if rezka.type == "tv_series":
                if season is None or episode is None:
                    logger.warning(
                        "Season and episode are required for TV series but not provided."
                    )
                    return {"error": "שנה ופרק נדרשים לסדרת טלוויזיה."}
                logger.info(f"Fetching stream for season {season}, episode {episode}")
                stream = rezka.getStream(
                    season=season, episode=episode, translation=selected_translator
                )
            else:
                logger.info("Fetching stream for movie")
                stream = rezka.getStream(translation=selected_translator)

            available_resolutions = stream.videos.keys()
            logger.info(f"Available resolutions: {list(available_resolutions)}")

            for resolution in available_resolutions:
                try:
                    stream_url = stream(resolution)
                    if stream_url:
                        mp4_url = (
                            stream_url[0]
                            if isinstance(stream_url, list)
                            else stream_url
                        )
                        hls_url = mp4_url + ":hls:manifest.m3u8"
                        stream_urls[resolution] = hls_url
                        logger.info(f"Stream URL for {resolution}: {hls_url}")
                    else:
                        logger.warning(
                            f"No stream URL returned for resolution {resolution}"
                        )
                        stream_urls[resolution] = None
                except Exception as e:
                    logger.error(
                        f"Error fetching stream URL for {resolution}: {str(e)}"
                    )
                    stream_urls[resolution] = None

            if not any(stream_urls.values()):
                logger.warning("No valid stream URLs found.")
                return {"error": "הזרם לא נמצא."}

            response = {"stream_urls": stream_urls}
            if warning_message:
                response["warning"] = warning_message
            logger.info(f"Returning response: {response}")
            return response

        except Exception as e:
            if rezka.type == "tv_series":
                logger.error(f"Failed to fetch stream for TV series: {str(e)}")
                return {"error": "שגיאה בטעינת הזרם לסדרת הטלוויזיה."}
            else:
                logger.error(f"Failed to fetch stream for movie: {str(e)}")
                return {"error": "שגיאה בטעינת הזרם לסרט."}

    except Exception as e:
        logger.error(f"Unhandled exception: {str(e)}")
        logger.exception("Full exception traceback:")
        raise HTTPException(status_code=500, detail="שגיאה פנימית בשרת.")
