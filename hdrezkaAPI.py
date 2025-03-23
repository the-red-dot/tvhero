#!/usr/bin/env python3
import time
import logging
import traceback
import requests

from HdRezkaApi import HdRezkaApi, FetchFailed
from HdRezkaApi.search import HdRezkaSearch
from HdRezkaApi.types import TVSeries, Movie
from HdRezkaApi.stream import HdRezkaStream

logging.basicConfig(
    level=logging.INFO,  # or logging.DEBUG for more detail
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)


class PatchedRezkaApi(HdRezkaApi):
    """
    A subclass that overrides getStream for TV series so it does NOT
    call episodesInfo or seriesInfo. Instead, it performs a single direct
    POST request for the chosen translator, season, and episode.
    """

    def getStream(
        self,
        season=None,
        episode=None,
        translation=None,
        priority=None,
        non_priority=None,
    ):
        """
        Overrides the library's getStream. If it's a TV series, do a single
        direct request to /ajax/get_cdn_series/ with (season, episode, translator).
        If it's a movie, use the original approach (a single get_movie request).
        """

        def single_tv_request(translator_id, season_num, episode_num):
            """
            Make exactly one POST /ajax/get_cdn_series/ call for a single translator
            without enumerating all episodes/translators behind the scenes.
            """
            payload = {
                "id": self.id,
                "translator_id": translator_id,
                "season": season_num,
                "episode": episode_num,
                "action": "get_stream",
            }
            logging.info("Direct single-episode request: %s", payload)

            # Use requests.post directly (not self.session) to avoid the AttributeError
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
                    logging.error("Error processing chunk '%s': %s", chunk, ex)
            return new_stream

        # If it's a movie, the normal approach is still a single get_movie call
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
        Helper: If user passed a translator name/ID, try to match it in self.translators.
        Otherwise, pick the library's best translator from priority.
        """
        if not self.translators:
            raise ValueError("No translators found on this page.")

        translators_dict = self.translators

        def sort_translators_by_priority():
            sorted_translators = self.sort_translators(translators_dict)
            return list(sorted_translators.keys())  # translator IDs in priority order

        if not user_translation:
            # user didn't specify, so pick the library's top priority
            best_id = sort_translators_by_priority()[0]
            logging.info("No translator specified. Using best ID: %s", best_id)
            return best_id

        # if numeric
        if user_translation.isdigit():
            tid = int(user_translation)
            if tid in translators_dict:
                logging.info(
                    "User selected translator ID: %d -> '%s'",
                    tid,
                    translators_dict[tid]["name"],
                )
                return tid
            else:
                raise ValueError(
                    f"Translator ID {tid} not found. Available: {list(translators_dict.keys())}"
                )

        # else match by name
        for tid, info in translators_dict.items():
            if info["name"].lower() == user_translation.lower():
                logging.info(
                    "User selected translator name '%s' -> ID=%d", user_translation, tid
                )
                return tid

        raise ValueError(f"No translator matches name '{user_translation}'.")


def main():
    base_url = "https://hdrezka.ag/"

    search_query = input("Enter movie or TV series name to search: ").strip()
    if not search_query:
        print("No search query entered.")
        return

    print("Searching, please wait...")
    time.sleep(1)

    searcher = HdRezkaSearch(base_url)
    try:
        results = searcher(search_query)
    except Exception as e:
        print("Search error:", e)
        traceback.print_exc()
        return

    if not results:
        print("No results found.")
        return

    print("\nSearch Results:")
    for i, r in enumerate(results, start=1):
        t = r.get("title", "???")
        rat = r.get("rating", "N/A")
        print(f"{i}. {t} (Rating: {rat})")

    choice = input("\nSelect number: ").strip()
    try:
        idx = int(choice)
        if idx < 1 or idx > len(results):
            print("Out of range.")
            return
    except:
        print("Invalid choice.")
        return

    selected = results[idx - 1]
    url = selected.get("url")
    if not url:
        print("No URL found for the selected item.")
        return

    print(f"\nSelected: {selected.get('title')} — {url}\n")
    time.sleep(1)

    rezka = PatchedRezkaApi(url)
    time.sleep(1)

    if not rezka.ok:
        print("Error loading page:", rezka.exception)
        return

    print("Name:", rezka.name)
    print("Thumbnail:", rezka.thumbnail)
    print("Rating:", rezka.rating.value, "Votes:", rezka.rating.votes)

    if rezka.type == TVSeries:
        print(
            "\nApproach C: single direct request to getStream, skipping episodesInfo."
        )
        s = input("Season number: ").strip()
        e = input("Episode number: ").strip()
        if not s.isdigit() or not e.isdigit():
            print("Invalid input for season/episode.")
            return

        translator_choice = (
            input("Translator (ID or exact name) or blank for default: ").strip()
            or None
        )
        try:
            tv_stream = rezka.getStream(
                season=s, episode=e, translation=translator_choice
            )
            time.sleep(1)
            # show results
            resolutions = list(tv_stream.videos.keys())
            print("Available resolutions:", resolutions)
            r_choice = input("Pick resolution (e.g. 720p): ").strip()
            links = tv_stream(r_choice)
            print(f"\nLinks for {r_choice}:", links)
        except FetchFailed as fe:
            print("FetchFailed error:", fe)
            traceback.print_exc()
        except Exception as ex:
            print("Other error fetching TV stream:", ex)
            traceback.print_exc()

    elif rezka.type == Movie:
        print("Detected Movie. Single call is fine.")
        try:
            movie_stream = rezka.getStream()
            time.sleep(1)
            resolutions = list(movie_stream.videos.keys())
            print("Available resolutions:", resolutions)
            r_choice = input("Pick resolution: ").strip()
            links = movie_stream(r_choice)
            print(f"\nLinks for {r_choice}:", links)
        except Exception as ex:
            print("Movie fetch error:", ex)
            traceback.print_exc()

    else:
        print("Unknown content type.")


if __name__ == "__main__":
    main()
