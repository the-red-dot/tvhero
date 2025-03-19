from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from hdrezka import Search
from HdRezkaApi import HdRezkaApi
import logging

app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "https://tvhero.vercel.app",
        "https://tvhero-git-main-geras-projects-5ef45cdd.vercel.app",
        "https://f688-2a10-8012-1-e449-1c0e-f70a-cff8-2d58.ngrok-free.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/fetch_stream")
async def fetch_stream(
    request: Request,
    title: str = Query(None),  # Make title optional
    season: int = Query(None),
    episode: int = Query(None),
):
    # Manually enforce title requirement for GET requests
    if request.method == "GET" and not title:
        raise HTTPException(status_code=400, detail="Title is required")

    try:
        logger.info(f"Request headers: {request.headers}")
        logger.info(
            f"Fetching stream for title: {title}, season: {season}, episode: {episode}"
        )
        # Perform a search for the given title
        search_results = await Search(title).get_page(1)
        if not search_results:
            logger.warning("No results found.")
            return {"error": "אין דיבובים זמינים לתוכן זה."}

        media = search_results[0]
        rezka = HdRezkaApi(media.url)
        available_translators = list(rezka.translators.keys())
        logger.info(f"Available translators: {available_translators}")
        logger.info(f"Media type: {rezka.type}")

        # Preferred translators list
        preferred_translators = ["Оригинал (+субтитры)"]
        selected_translator = None
        for translator in preferred_translators:
            if translator in available_translators:
                selected_translator = translator
                break

        warning_message = None
        if not selected_translator:
            if available_translators:
                selected_translator = available_translators[0]
                logger.info(
                    f"No preferred translator available. Falling back to '{selected_translator}'."
                )
                warning_message = "לא נמצא דיבוב באנגלית"
            else:
                logger.error("No translators available.")
                return {"error": "אין דיבובים זמינים לתוכן זה."}

        logger.info(f"Selected translator: {selected_translator}")
        translator_id = rezka.translators.get(selected_translator)
        logger.info(f"Translator ID for '{selected_translator}': {translator_id}")

        # Fetch the stream URLs based on media type
        stream_urls = {}
        try:
            if rezka.type == "tv_series":
                if season is None or episode is None:
                    logger.warning("Season and episode required for TV series.")
                    return {"error": "שנה ופרק נדרשים לסדרת טלוויזיה."}
                stream = rezka.getStream(
                    season=season, episode=episode, translation=selected_translator
                )
            else:
                stream = rezka.getStream(translation=selected_translator)

            available_resolutions = stream.videos.keys()
            logger.info(f"Available resolutions: {available_resolutions}")

            for resolution in available_resolutions:
                try:
                    stream_url = stream(resolution)
                    if stream_url:
                        stream_urls[resolution] = (
                            stream_url[0]
                            if isinstance(stream_url, list)
                            else stream_url
                        )
                        logger.info(
                            f"Stream URL for {resolution}: {stream_urls[resolution]}"
                        )
                except Exception as e:
                    logger.error(f"Error fetching stream URL for {resolution}: {e}")
                    stream_urls[resolution] = None

            if not stream_urls:
                logger.warning("No stream URLs found.")
                return {"error": "הזרם לא נמצא."}

            response = {"stream_urls": stream_urls}
            if warning_message:
                response["warning"] = warning_message
            return response

        except Exception as e:
            if rezka.type == "tv_series":
                logger.error(f"Error fetching stream URL for TV series: {e}")
                return {"error": "שגיאה בטעינת הזרם לסדרת הטלוויזיה."}
            else:
                logger.error(f"Error fetching stream URL for movie: {e}")
                return {"error": "שגיאה בטעינת הזרם לסרט."}

    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        logger.exception("Exception details:")
        raise HTTPException(status_code=500, detail="שגיאה פנימית בשרת.")
