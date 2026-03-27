// Track the player's total score across all movie rows.
let score = 0;
let completedMovies = 0;

function normalizeGuess(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\bthe\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function getAcceptedAnswers(title) {
    const acceptedAnswers = [normalizeGuess(title)];

    if (title.includes(':')) {
        title.split(':').forEach(part => {
            const normalizedPart = normalizeGuess(part);

            if (normalizedPart) {
                acceptedAnswers.push(normalizedPart);
            }
        });
    }

    return acceptedAnswers;
}

// Fetch movies from the API and build one game row per movie.
fetch('/movies')
    .then(response => response.json())
    .then(data => {
        const gameContainer = document.getElementById('game-container');
        const scoreDisplay = document.getElementById('score-display');
        const endMessage = document.getElementById('end-message');
        const resetButton = document.getElementById('reset-button');

        resetButton.addEventListener('click', () => {
            window.location.reload();
        });

        data.movies.forEach(movie => {
            const movieItem = document.createElement('div');
            movieItem.classList.add('movie-item');
            const movieControls = document.createElement('div');
            movieControls.classList.add('movie-controls');
            let hintsUsed = 0;
            let moviePoints = 10;
            let isResolved = false;

            const rankLabel = document.createElement('h2');
            rankLabel.textContent = `#${movie.id}`;

            const guessInput = document.createElement('input');
            guessInput.type = 'text';
            guessInput.placeholder = 'Type your guess';

            const checkButton = document.createElement('button');
            checkButton.textContent = 'Check';

            const hintButton = document.createElement('button');
            hintButton.textContent = 'Hint';

            const hintText = document.createElement('p');
            hintText.classList.add('hint-text');

            const statusText = document.createElement('p');
            statusText.classList.add('status-text');

            const posterImage = document.createElement('img');
            posterImage.classList.add('poster-image');
            posterImage.alt = `${movie.title} poster`;
            posterImage.hidden = true;
            posterImage.loading = 'lazy';

            function finishMovie(statusMessage) {
                if (isResolved) {
                    return;
                }

                isResolved = true;
                completedMovies += 1;
                guessInput.disabled = true;
                checkButton.disabled = true;
                hintButton.disabled = true;
                statusText.textContent = statusMessage;

                if (completedMovies === data.movies.length) {
                    endMessage.textContent = `Game over. Your final score is ${score}.`;
                    resetButton.style.display = 'inline-block';
                }
            }

            async function showPoster() {
                if (posterImage.dataset.loaded === 'true') {
                    posterImage.hidden = false;
                    return;
                }

                try {
                    const response = await fetch(`/movies/${movie.id}/poster`);

                    if (!response.ok) {
                        throw new Error('Poster request failed.');
                    }

                    const posterData = await response.json();

                    posterImage.src = posterData.posterUrl;
                    posterImage.hidden = false;
                    posterImage.dataset.loaded = 'true';
                } catch (error) {
                    console.error(error);
                }
            }

            checkButton.addEventListener('click', () => {
                const userGuess = normalizeGuess(guessInput.value);
                const acceptedAnswers = getAcceptedAnswers(movie.title);

                if (acceptedAnswers.includes(userGuess)) {
                    guessInput.value = movie.title;
                    score += moviePoints;
                    scoreDisplay.textContent = `Score: ${score}`;
                    finishMovie('Correct!');
                    showPoster();
                } else {
                    statusText.textContent = 'Incorrect. Try again or use a hint.';
                }
            });

            hintButton.addEventListener('click', () => {
                if (hintsUsed === 0) {
                    hintText.textContent = `Hint 1: Year - ${movie.year}`;
                } else if (hintsUsed === 1) {
                    hintText.textContent = `Hint 2: Director - ${movie.director}`;
                } else if (hintsUsed === 2) {
                    hintText.textContent = `Hint 3: Quote - ${movie.quoteHint}`;
                    hintButton.textContent = 'Show Answer';
                } else {
                    guessInput.value = movie.title;
                    finishMovie('Answer revealed.');
                    showPoster();
                    return;
                }

                hintsUsed += 1;
                moviePoints -= 2;
            });

            movieControls.append(rankLabel, guessInput, checkButton, hintButton, hintText, statusText);
            movieItem.append(movieControls, posterImage);
            gameContainer.appendChild(movieItem);
        });
    })
    .catch(error => console.error('Error fetching movies:', error));
