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
    const acceptedAnswers = new Set([normalizeGuess(title)]);

    if (title.includes(':')) {
        title.split(':').forEach(part => {
            const normalizedPart = normalizeGuess(part);

            if (normalizedPart) {
                acceptedAnswers.add(normalizedPart);
            }
        });
    }

    if (title === "The Godfather Part II") {
        acceptedAnswers.add(normalizeGuess('Godfather 2'));
        acceptedAnswers.add(normalizeGuess('Godfather Part 2'));
    }

    if (title === '12 Angry Men') {
        acceptedAnswers.add(normalizeGuess('Twelve Angry Men'));
    }

    if (title === "Star Wars: Episode V - The Empire Strikes Back") {
        acceptedAnswers.add(normalizeGuess('Empire Strikes Back'));
        acceptedAnswers.add(normalizeGuess('Star Wars 5'));
        acceptedAnswers.add(normalizeGuess('Episode 5'));
    }

    if (title === "One Flew Over the Cuckoo's Nest") {
        acceptedAnswers.add(normalizeGuess("Cuckoo's Nest"));
        acceptedAnswers.add(normalizeGuess("One Flew Over Cuckoo's Nest"));
        acceptedAnswers.add(normalizeGuess('One Flew Over the Cuckoos Nest'));
    }

    if (title === 'Se7en') {
        acceptedAnswers.add(normalizeGuess('Seven'));
    }

    return [...acceptedAnswers];
}

// Fetch movies from the API and build one game row per movie.
fetch('/movies')
    .then(response => response.json())
    .then(data => {
        const gameContainer = document.getElementById('game-container');
        const scoreDisplay = document.getElementById('score-display');
        const endMessage = document.getElementById('end-message');
        const resetButton = document.getElementById('reset-button');
        const movieObserver = createMovieObserver();

        resetButton.addEventListener('click', () => {
            window.location.reload();
        });

        data.movies.forEach((movie, index) => {
            const movieItem = document.createElement('div');
            movieItem.classList.add('movie-item');
            movieItem.style.setProperty('--stagger-index', index);
            const movieControls = document.createElement('div');
            movieControls.classList.add('movie-controls');
            let hintsUsed = 0;
            let moviePoints = 10;
            let isResolved = false;
            let statusTimeoutId;

            const rankLabel = document.createElement('h2');
            rankLabel.textContent = `#${movie.id}`;

            const guessInput = document.createElement('input');
            guessInput.type = 'text';
            guessInput.placeholder = 'Type your guess';
            guessInput.spellcheck = false;

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

                clearTimeout(statusTimeoutId);
                isResolved = true;
                completedMovies += 1;
                guessInput.disabled = true;
                checkButton.disabled = true;
                hintButton.disabled = true;
                statusText.classList.remove('status-floating');
                statusText.textContent = statusMessage;

                if (completedMovies === data.movies.length) {
                    endMessage.textContent = `Congratulations! Your final score is ${score}. Let me know on Discord how you did! SurelyKnott`;
                    resetButton.style.display = 'block';
                }
            }

            async function showPoster() {
                if (posterImage.dataset.loaded === 'true') {
                    posterImage.hidden = false;
                    requestAnimationFrame(() => {
                        posterImage.classList.add('is-visible');
                    });
                    return;
                }

                try {
                    posterImage.classList.remove('is-visible');
                    const response = await fetch(`/movies/${movie.id}/poster`);

                    if (!response.ok) {
                        throw new Error('Poster request failed.');
                    }

                    const posterData = await response.json();
                    await new Promise((resolve, reject) => {
                        posterImage.onload = resolve;
                        posterImage.onerror = reject;
                        posterImage.src = posterData.posterUrl;

                        if (posterImage.complete) {
                            resolve();
                        }
                    });

                    posterImage.hidden = false;
                    posterImage.dataset.loaded = 'true';

                    requestAnimationFrame(() => {
                        posterImage.classList.add('is-visible');
                    });
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
                    statusText.classList.add('status-floating');
                    statusText.textContent = 'Incorrect. Try again or use a hint.';
                    clearTimeout(statusTimeoutId);
                    statusTimeoutId = setTimeout(() => {
                        if (!isResolved) {
                            statusText.classList.remove('status-floating');
                            statusText.textContent = '';
                        }
                    }, 2500);
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
            movieObserver.observe(movieItem);
        });
    })
    .catch(error => console.error('Error fetching movies:', error));

function createMovieObserver() {
    if (!('IntersectionObserver' in window)) {
        return {
            observe(element) {
                element.classList.add('is-visible');
            }
        };
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.16,
        rootMargin: '0px 0px -6% 0px'
    });

    return observer;
}
