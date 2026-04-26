import ast
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, render_template, request
# new
import random, json, os
from urllib import error, parse, request as urllib_request

app = Flask(__name__)
# 2
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "dataset" / "tmdb_5000_movies.csv"

MOOD_TO_GENRES = {
    "Happy": ["Comedy", "Family"],
    "Emotional": ["Drama", "Romance"],
    "Thrilling": ["Action", "Thriller"],
    "Chill": ["Animation", "Comedy"],
}


def parse_genres(raw_value):
    """Convert the TMDB JSON-like string into a list of genre names."""
    if pd.isna(raw_value):
        return []

    try:
        parsed = ast.literal_eval(raw_value)
        return [item["name"] for item in parsed if "name" in item]
    except (ValueError, SyntaxError, TypeError):
        return []


def load_movies():
    """Load and clean the dataset once when the app starts."""
    movies = pd.read_csv(DATA_PATH)
    movies = movies[
        ["id", "title", "genres", "overview", "runtime", "popularity", "vote_average", "vote_count"]
    ].copy()

    movies["genre_list"] = movies["genres"].apply(parse_genres)
    movies["genre_text"] = movies["genre_list"].apply(lambda items: ", ".join(items))
    movies["overview"] = movies["overview"].fillna("No overview is available for this movie yet.")
    movies["runtime"] = movies["runtime"].fillna(0)
    movies["popularity"] = movies["popularity"].fillna(0)
    movies["vote_average"] = movies["vote_average"].fillna(0)
    movies["vote_count"] = movies["vote_count"].fillna(0)

    # Keep rows that are useful for recommendations.
    movies = movies[movies["title"].notna()]
    movies = movies[movies["genre_list"].map(bool)]
    return movies.reset_index(drop=True)


MOVIES = load_movies()


def contains_genre(genre_names, target):
    return target in genre_names


def matches_any_genre(genre_names, target_genres):
    return any(genre in genre_names for genre in target_genres)


def apply_time_filter(movies, time_choice):
    if time_choice == "Short":
        return movies[movies["runtime"] < 120]
    if time_choice == "Long":
        return movies[movies["runtime"] >= 120]
    return movies


def sort_movies(movies, preference):
    if preference == "Underrated":
        underrated = movies[movies["vote_count"] >= 50].copy()
        return underrated.sort_values(
            by=["vote_average", "popularity", "vote_count"],
            ascending=[False, True, False],
        )

    return movies.sort_values(
        by=["popularity", "vote_average", "vote_count"],
        ascending=[False, False, False],
    )


def build_reason(movie, selected_genre, mood, time_choice, preference, mood_genres):
    time_label = "under 2 hours" if time_choice == "Short" else "over 2 hours"
    popularity_label = "a crowd-favorite pick" if preference == "Popular" else "a hidden gem vibe"
    matching_mood_genres = [genre for genre in movie["genre_list"] if genre in mood_genres]
    mood_text = ", ".join(matching_mood_genres) if matching_mood_genres else ", ".join(mood_genres)

    return (
        f"We picked this because it blends your love for {selected_genre} with a {mood.lower()} mood "
        f"through {mood_text}. It also matches your {time_label} runtime preference and leans into "
        f"{popularity_label}."
    )

# 3
def get_trailer(movie_id):
    """Fetch the first YouTube trailer embed URL from TMDB."""
    if not TMDB_API_KEY or pd.isna(movie_id):
        return None

    url = (
        f"https://api.themoviedb.org/3/movie/{int(movie_id)}/videos?"
        + parse.urlencode({"api_key": TMDB_API_KEY})
    )

    try:
        with urllib_request.urlopen(url, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (error.URLError, error.HTTPError, TimeoutError, ValueError):
        return None

    for video in payload.get("results", []):
        if video.get("type") == "Trailer" and video.get("site") == "YouTube" and video.get("key"):
            return f"https://www.youtube.com/embed/{video['key']}?autoplay=1"

    return None



def recommend_movie(genre, mood, time_choice, preference):
    mood_genres = MOOD_TO_GENRES.get(mood, [])
    working_set = apply_time_filter(MOVIES, time_choice)

    exact_match = working_set[
        working_set["genre_list"].apply(lambda items: contains_genre(items, genre))
        & working_set["genre_list"].apply(lambda items: matches_any_genre(items, mood_genres))
    ]

    if exact_match.empty:
        exact_match = working_set[
            working_set["genre_list"].apply(lambda items: contains_genre(items, genre))
        ]

    if exact_match.empty:
        exact_match = working_set[
            working_set["genre_list"].apply(lambda items: matches_any_genre(items, mood_genres))
        ]

    if exact_match.empty:
        exact_match = working_set

    ranked_movies = sort_movies(exact_match, preference)

    if ranked_movies.empty:
        return {
            "title": "No movie found",
            "genres": "N/A",
            "overview": "We could not find a movie that matches those settings yet.",
            "reason": "Try switching your time or popularity preference for a broader match.",
            # 4
            "trailer": None,
        }

    movie = ranked_movies.iloc[0]
    # 5
    trailer_url = get_trailer(movie["id"]) if "id" in movie else None
    return {
        "title": movie["title"],
        "genres": movie["genre_text"],
        "overview": movie["overview"],
        "reason": build_reason(movie, genre, mood, time_choice, preference, mood_genres),
        "runtime": int(movie["runtime"]) if movie["runtime"] else None,
        "rating": round(float(movie["vote_average"]), 1),
        # 4
         "trailer": trailer_url,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/recommend", methods=["POST"])
def recommend():
    payload = request.get_json(silent=True) or {}

    genre = payload.get("genre", "").strip()
    mood = payload.get("mood", "").strip()
    time_choice = payload.get("time", "").strip()
    preference = payload.get("preference", "").strip()

    if not all([genre, mood, time_choice, preference]):
        return jsonify({"error": "Please answer every question before requesting a recommendation."}), 400

    result = recommend_movie(genre, mood, time_choice, preference)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)