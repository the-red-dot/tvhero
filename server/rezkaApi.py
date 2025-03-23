from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
import logging
import requests
from HdRezkaApi import HdRezkaApi, FetchFailed
from HdRezkaApi.search import HdRezkaSearch
from HdRezkaApi.types import TVSeries, Movie
from HdRezkaApi.stream import HdRezkaStream

# Configure logging
logging.basicConfig(
    level=logging.INFO,  # Change to DEBUG for more verbose output
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
        "https://627e-2a10-8012-1-7d6-354e-ed8c-330-50ad.ngrok-free.app",
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
                raise FetchFailed("Empty response from server.")

            try:
                resp = r.json()
            except Exception as e:
                raise FetchFailed(f"JSON parse error: {e}") from e

            if not (resp.get("success") and resp.get("url")):
                raise FetchFailed("No 'url' in JSON response or success=false.")

            stream_data = resp["url"]
            arr = self.clearTrash(stream_data).split(",")
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

        if user_translation.isdigit():
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

        for tid, info in translators_dict.items():
            if info["name"].lower() == user_translation.lower():
                logger.info(
                    "User selected translator name '%s' -> ID=%d", user_translation, tid
                )
                return tid

        raise ValueError(f"No translator matches name '{user_translation}'.")


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

        # Search for the title using HdRezkaSearch
        search_results = await HdRezkaSearch(title).get_page(1)
        if not search_results:
            logger.warning(f"No search results found for title: '{title}'")
            return {"error": "אין דיבובים זמינים לתוכן זה."}

        media = search_results[0]
        logger.info(f"Selected media URL: {media.url}")
        # Instantiate our robust API subclass
        rezka = PatchedRezkaApi(media.url)
        logger.info(f"Media type detected: {rezka.type}")

        # Determine translator using preferred names
        available_translators = list(rezka.translators.keys())
        logger.info(f"Available translators: {available_translators}")
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
        # Fetch stream URLs using our patched logic
        stream = None
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

        available_resolutions = stream.videos.keys()
        logger.info(f"Available resolutions: {list(available_resolutions)}")
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
            except Exception as e:
                logger.error(f"Error fetching stream URL for {resolution}: {str(e)}")
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
