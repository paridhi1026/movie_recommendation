const screens = {
    landing: document.getElementById("landing-screen"),
    question: document.getElementById("question-screen"),
    loading: document.getElementById("loading-screen"),
    result: document.getElementById("result-screen"),
};

const startButton = document.getElementById("start-button");
const backButton = document.getElementById("back-button");
const retryButton = document.getElementById("retry-button");
const questionTitle = document.getElementById("question-title");
const questionCount = document.getElementById("question-count");
const optionsContainer = document.getElementById("question-options");
const progressBar = document.getElementById("progress-bar");

const resultElements = {
    title: document.getElementById("movie-title"),
    genres: document.getElementById("movie-genres"),
    overview: document.getElementById("movie-overview"),
    reason: document.getElementById("movie-reason"),
    runtime: document.getElementById("movie-runtime"),
    rating: document.getElementById("movie-rating"),
    poster: document.getElementById("poster-emoji"),

    // NEW CHANGE: trailer-related DOM elements
    trailer: document.getElementById("trailer"),
    trailerSection: document.getElementById("trailer-section"),
    trailerMessage: document.getElementById("trailer-message"),
};

const questions = [
    {
        key: "genre",
        title: "What kind of genre are you in the mood for?",
        options: [
            { label: "Action", description: "Fast-paced, energetic, and big on adrenaline." },
            { label: "Romance", description: "Heartfelt stories, chemistry, and emotional warmth." },
            { label: "Comedy", description: "Light, witty, and easy to enjoy." },
            { label: "Drama", description: "Character-driven stories with emotional depth." },
            { label: "Thriller", description: "Tension, twists, and edge-of-your-seat moments." },
            { label: "Animation", description: "Imaginative worlds and playful storytelling." },
            { label: "Science Fiction", description: "Futuristic ideas, scale, and wonder." },
            { label: "Family", description: "Comfortable picks that feel warm and welcoming." },
        ],
    },
    {
        key: "mood",
        title: "Pick the vibe you want tonight.",
        options: [
            { label: "Happy", description: "Uplifting energy and feel-good moments." },
            { label: "Emotional", description: "A moving story that sticks with you." },
            { label: "Thrilling", description: "Sharp suspense and cinematic intensity." },
            { label: "Chill", description: "Easygoing, cozy, and effortlessly watchable." },
        ],
    },
    {
        key: "time",
        title: "How much time do you have?",
        options: [
            { label: "Short", description: "Under 2 hours for a tighter watch." },
            { label: "Long", description: "Over 2 hours if you want a bigger journey." },
        ],
    },
    {
        key: "preference",
        title: "Do you want a crowd favorite or something underrated?",
        options: [
            { label: "Popular", description: "Widely loved and easy to jump into." },
            { label: "Underrated", description: "A quieter gem with strong quality." },
        ],
    },
];

let currentStep = 0;
let answers = {};

function showScreen(target) {
    Object.values(screens).forEach((screen) => screen.classList.remove("active"));
    target.classList.add("active");
}

function renderQuestion() {
    const currentQuestion = questions[currentStep];
    questionTitle.textContent = currentQuestion.title;
    questionCount.textContent = `${currentStep + 1} / ${questions.length}`;
    progressBar.style.width = `${((currentStep + 1) / questions.length) * 100}%`;
    backButton.style.visibility = currentStep === 0 ? "hidden" : "visible";

    optionsContainer.innerHTML = "";

    currentQuestion.options.forEach((option) => {
        const button = document.createElement("button");
        button.className = "option-card";
        button.type = "button";

        if (answers[currentQuestion.key] === option.label) {
            button.classList.add("selected");
        }

        button.innerHTML = `
            <span class="option-title">${option.label}</span>
            <span class="option-description">${option.description}</span>
        `;

        button.addEventListener("click", () => {
            answers[currentQuestion.key] = option.label;
            button.classList.add("selected");

            setTimeout(() => {
                if (currentStep < questions.length - 1) {
                    currentStep += 1;
                    renderQuestion();
                } else {
                    fetchRecommendation();
                }
            }, 180);
        });

        optionsContainer.appendChild(button);
    });
}

// NEW CHANGE: helper to safely reset/hide trailer when moving between states
function resetTrailer() {
    if (!resultElements.trailer || !resultElements.trailerSection || !resultElements.trailerMessage) {
        return;
    }

    resultElements.trailer.src = "";
    resultElements.trailer.style.display = "none";
    resultElements.trailerSection.style.display = "none";
    resultElements.trailerMessage.style.display = "none";
}

function resetFlow() {
    currentStep = 0;
    answers = {};

    // NEW CHANGE: stop any playing trailer before restarting flow
    resetTrailer();

    renderQuestion();
    showScreen(screens.question);
}

function updateResults(movie) {
    resultElements.title.textContent = movie.title;
    resultElements.overview.textContent = movie.overview;
    resultElements.reason.textContent = movie.reason;
    resultElements.runtime.textContent = movie.runtime ? `${movie.runtime} min` : "N/A";
    resultElements.rating.textContent = movie.rating ? `${movie.rating} / 10` : "N/A";

    resultElements.genres.innerHTML = "";
    const genres = movie.genres ? movie.genres.split(",").map((item) => item.trim()) : [];

    genres.forEach((genre) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = genre;
        resultElements.genres.appendChild(tag);
    });

    resultElements.poster.textContent = pickPosterEmoji(genres);

    // NEW CHANGE: trailer handling
    if (resultElements.trailer && resultElements.trailerSection && resultElements.trailerMessage) {
        resultElements.trailerSection.style.display = "block";

        if (movie.trailer) {
            resultElements.trailer.src = movie.trailer;
            resultElements.trailer.style.display = "block";
            resultElements.trailerMessage.style.display = "none";
        } else {
            resultElements.trailer.src = "";
            resultElements.trailer.style.display = "none";
            resultElements.trailerMessage.style.display = "block";
            resultElements.trailerMessage.textContent = "Trailer not available.";
        }
    }
}

function pickPosterEmoji(genres) {
    if (genres.includes("Romance")) return "💘";
    if (genres.includes("Comedy")) return "😂";
    if (genres.includes("Thriller")) return "🕵️";
    if (genres.includes("Animation")) return "✨";
    if (genres.includes("Action")) return "🔥";
    if (genres.includes("Science Fiction")) return "🚀";
    return "🎞️";
}

async function fetchRecommendation() {
    showScreen(screens.loading);

    // NEW CHANGE: clear old trailer before loading a new recommendation
    resetTrailer();

    try {
        const response = await fetch("/recommend", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(answers),
        });

        const movie = await response.json();

        if (!response.ok) {
            throw new Error(movie.error || "Something went wrong.");
        }

        updateResults(movie);
        setTimeout(() => showScreen(screens.result), 900);
    } catch (error) {
        updateResults({
            title: "Recommendation unavailable",
            genres: "Try a different combination",
            overview: "The app could not find a movie right now.",
            reason: error.message,
            runtime: null,
            rating: null,

            // NEW CHANGE: fallback value for trailer
            trailer: null,
        });
        setTimeout(() => showScreen(screens.result), 900);
    }
}

startButton.addEventListener("click", () => {
    renderQuestion();
    showScreen(screens.question);
});

backButton.addEventListener("click", () => {
    if (currentStep === 0) {
        showScreen(screens.landing);
        return;
    }

    currentStep -= 1;
    renderQuestion();
});

retryButton.addEventListener("click", resetFlow);
