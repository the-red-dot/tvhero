from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
import logging
import requests
import time  # optional, only if you want to add small sleeps

from HdRezkaApi import HdRezkaApi, FetchFailed
from HdRezkaApi.search import HdRezkaSearch
from HdRezkaApi.types import TVSeries, Movie
from HdRezkaApi.stream import HdRezkaStream

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Change to DEBUG for more verbosity
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS (including your ngrok address)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://localhost:8000",
        "https://tvhero.vercel.app",
        "https://tvhero-git-main-geras-projects-5ef45cdd.vercel.app",
        "https://330a-2a10-8012-1-7d6-29e2-2138-79d8-9486.ngrok-free.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PatchedRezkaApi(HdRezkaApi):
    """
    Subclass of HdRezkaApi that overrides getStream for TV series.
    For TV series, it makes a single direct POST request to /ajax/get_cdn_series/
    instead of multiple internal calls.
    """

    def getStream(
        self,
        season=None,
        episode=None,
        translation=None,
        priority=None,
        non_priority=None,
    ):
        def single_tv_request(translator_id, season_num, episode_num):
            payload = {
                "id": self.id,
                "translator_id": translator_id,
                "season": season_num,
                "episode": episode_num,
                "action": "get_stream",
            }
            logger.info("Direct single-episode request payload: %s", payload)

            r = requests.post(
                f"{self.origin}/ajax/get_cdn_series/",
                data=payload,
                headers=self.HEADERS,
                proxies=self.proxy,
                cookies=self.cookies,
            )
            if not r.text.strip():
                raise FetchFailed  # Raise without message

            try:
                resp = r.json()
            except Exception as e:
                logger.error("JSON parse error: %s", e)
                raise FetchFailed from e

            if not (resp.get("success") and resp.get("url")):
                raise FetchFailed

            stream_data = resp["url"]
            try:
                cleaned = self.clearTrash(stream_data)
            except UnicodeDecodeError as e:
                logger.error("Unicode decode error in clearTrash: %s", e)
                # Fallback: if stream_data is bytes, decode ignoring errors; otherwise, use as is
                if isinstance(stream_data, bytes):
                    cleaned = stream_data.decode("utf-8", errors="ignore")
                else:
                    cleaned = stream_data
            arr = cleaned.split(",")
            new_stream = HdRezkaStream(
                season=season_num,
                episode=episode_num,
                name=self.name,
                translator_id=translator_id,
                subtitles={
                    "data": resp.get("subtitle", ""),
                    "codes": resp.get("subtitle_lns", ""),
                },
            )
            for chunk in arr:
                try:
                    temp = chunk.split("[")[1].split("]")
                    quality = str(temp[0])
                    links = filter(lambda x: x.endswith(".mp4"), temp[1].split(" or "))
                    for link in links:
                        new_stream.append(quality, link)
                except Exception as ex:
                    logger.error("Error processing chunk '%s': %s", chunk, ex)
            return new_stream

        if self.type == Movie:
            return super().getStream(
                season, episode, translation, priority, non_priority
            )
        elif self.type == TVSeries:
            if not (season and episode):
                raise ValueError(
                    "Season and episode must be specified for a TV series."
                )
            translator_id = self._pick_translator_id(translation)
            return single_tv_request(translator_id, int(season), int(episode))
        else:
            raise TypeError(
                "Undefined content type or not recognized as tv_series/movie."
            )

    def _pick_translator_id(self, user_translation):
        """
        Handles translator selection when user_translation is an integer or a string.
        """
        if not self.translators:
            raise ValueError("No translators found on this page.")

        translators_dict = self.translators

        def sort_translators_by_priority():
            sorted_translators = self.sort_translators(translators_dict)
            return list(sorted_translators.keys())

        if not user_translation:
            best_id = sort_translators_by_priority()[0]
            logger.info("No translator specified. Using best ID: %s", best_id)
            return best_id

        if isinstance(user_translation, int):
            tid = user_translation
            if tid in translators_dict:
                logger.info(
                    "User selected translator ID: %d -> '%s'",
                    tid,
                    translators_dict[tid]["name"],
                )
                return tid
            else:
                raise ValueError(
                    f"Translator ID {tid} not found. Available: {list(translators_dict.keys())}"
                )

        if isinstance(user_translation, str) and user_translation.isdigit():
            tid = int(user_translation)
            if tid in translators_dict:
                logger.info(
                    "User selected translator ID: %d -> '%s'",
                    tid,
                    translators_dict[tid]["name"],
                )
                return tid
            else:
                raise ValueError(
                    f"Translator ID {tid} not found. Available: {list(translators_dict.keys())}"
                )

        user_translation_lower = str(user_translation).lower()
        for tid, info in translators_dict.items():
            if info["name"].lower() == user_translation_lower:
                logger.info(
                    "User selected translator name '%s' -> ID=%d", user_translation, tid
                )
                return tid

        raise ValueError(f"No translator matches name '{user_translation}'.")


@app.get("/fetch_stream")
def fetch_stream(
    request: Request,
    title: str = Query(None),
    season: int = Query(None),
    episode: int = Query(None),
):
    """
    Searches for a movie/series by title, then fetches stream URLs
    from a single direct POST request for the chosen translator.
    Returns a dict: { "stream_urls": { "360p": "...", ... }, "warning": ... }
    """
    if request.method == "GET" and not title:
        logger.error("Title is required but not provided.")
        raise HTTPException(status_code=400, detail="Title is required")

    try:
        logger.info(
            f"Fetching stream for title: '{title}', season: {season}, episode: {episode}"
        )
        logger.info(f"Request headers: {request.headers}")

        base_url = "https://hdrezka.ag/"
        searcher = HdRezkaSearch(base_url)
        search_results = searcher(title)

        if not search_results:
            logger.warning(f"No search results found for title: '{title}'")
            return {"error": "אין דיבובים זמינים לתוכן זה."}

        # Grab the first result (a dict)
        media = search_results[0]
        media_url = media.get("url")
        if not media_url:
            logger.warning("No 'url' key found in search result.")
            return {"error": "הזרם לא נמצא או חסר כתובת מדיה."}

        logger.info(f"Selected media URL: {media_url}")
        rezka = PatchedRezkaApi(media_url)
        logger.info(f"Media type detected: {rezka.type}")

        # Set preferred translator to [238]
        available_translators = list(rezka.translators.keys())
        logger.info(f"Available translators: {available_translators}")
        preferred_translators = [238]
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

        if rezka.type == TVSeries:
            if season is None or episode is None:
                logger.warning(
                    "Season and episode are required for TV series but not provided."
                )
                return {"error": "שנה ופרק נדרשים לסדרת טלוויזיה."}
            logger.info(
                f"Fetching stream for TV series: season {season}, episode {episode}"
            )
            stream = rezka.getStream(
                season=season, episode=episode, translation=selected_translator
            )
        else:
            logger.info("Fetching stream for movie")
            stream = rezka.getStream(translation=selected_translator)

        available_resolutions = list(stream.videos.keys())
        logger.info(f"Available resolutions: {available_resolutions}")

        stream_urls = {}
        for resolution in available_resolutions:
            try:
                stream_url = stream(resolution)
                if stream_url:
                    mp4_url = (
                        stream_url[0] if isinstance(stream_url, list) else stream_url
                    )
                    hls_url = mp4_url + ":hls:manifest.m3u8"
                    stream_urls[resolution] = hls_url
                    logger.info(f"Stream URL for {resolution}: {hls_url}")
                else:
                    logger.warning(
                        f"No stream URL returned for resolution {resolution}"
                    )
                    stream_urls[resolution] = None
            except Exception as exc:
                logger.error(f"Error fetching stream URL for {resolution}: {str(exc)}")
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
        logger.error(f"Unhandled exception: {str(e)}")
        logger.exception("Full exception traceback:")
        raise HTTPException(status_code=500, detail="שגיאה פנימית בשרת.")
