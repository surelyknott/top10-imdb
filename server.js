const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const cors = require('cors');
const movies = require('./movies.json');

loadEnvFile();

const PORT = process.env.PORT || 3000;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

app.use(express.static(__dirname));

app.use(cors());
app.use(express.json()); 

app.get('/movies', (req, res) => {
    res.json(movies);
});

app.get('/movies/:id/poster', async (req, res) => {
    const movieId = Number(req.params.id);
    const movie = findMovieById(movieId);

    if (!movie) {
        return res.status(404).json({ error: 'Movie not found.' });
    }

    if (!TMDB_API_KEY) {
        return res.status(500).json({ error: 'TMDB_API_KEY is missing.' });
    }

    try {
        const posterPath = movie.tmdbId
            ? await fetchPosterPathByTmdbId(movie.tmdbId)
            : await fetchPosterPathBySearch(movie);

        if (!posterPath) {
            return res.status(404).json({ error: 'Poster not found.' });
        }

        return res.json({
            posterUrl: buildPosterUrl(posterPath)
        });
    } catch (error) {
        if (error.message === 'TMDB_REQUEST_FAILED') {
            return res.status(502).json({ error: 'TMDB request failed.' });
        }

        return res.status(500).json({ error: 'Unable to fetch poster from TMDB.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 

function loadEnvFile() {
    const envPath = path.join(__dirname, '.env');

    if (!fs.existsSync(envPath)) {
        return;
    }

    const envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

    envLines.forEach(line => {
        if (!line || line.startsWith('#')) {
            return;
        }

        const equalsIndex = line.indexOf('=');

        if (equalsIndex === -1) {
            return;
        }

        const key = line.slice(0, equalsIndex).trim();
        const value = line.slice(equalsIndex + 1).trim();

        if (key && !process.env[key]) {
            process.env[key] = value;
        }
    });
}

function findMovieById(movieId) {
    return movies.movies.find(entry => entry.id === movieId);
}

async function fetchPosterPathBySearch(movie) {
    const searchQueries = getTmdbSearchQueries(movie);

    for (const query of searchQueries) {
        const searchParams = new URLSearchParams({
            query,
            include_adult: 'false',
            year: String(movie.year)
        });

        const tmdbResponse = await fetch(
            `https://api.themoviedb.org/3/search/movie?${searchParams.toString()}`,
            {
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${TMDB_API_KEY}`
                }
            }
        );

        if (!tmdbResponse.ok) {
            throw new Error('TMDB_REQUEST_FAILED');
        }

        const tmdbData = await tmdbResponse.json();
        const bestMatch = findPosterMatch(tmdbData, movie);

        if (bestMatch) {
            return bestMatch.poster_path;
        }
    }

    return null;
}

async function fetchPosterPathByTmdbId(tmdbId) {
    const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}`,
        {
            headers: {
                accept: 'application/json',
                Authorization: `Bearer ${TMDB_API_KEY}`
            }
        }
    );

    if (!tmdbResponse.ok) {
        throw new Error('TMDB_REQUEST_FAILED');
    }

    const tmdbData = await tmdbResponse.json();

    return tmdbData.poster_path || null;
}

function findPosterMatch(tmdbData, movie) {
    const resultsWithPosters = tmdbData.results?.filter(result => result.poster_path) || [];

    return resultsWithPosters
        .map(result => ({
            result,
            score: getTmdbMatchScore(result, movie)
        }))
        .sort((a, b) => b.score - a.score)[0]?.result;
}

function buildPosterUrl(posterPath) {
    return `https://image.tmdb.org/t/p/w500${posterPath}`;
}

function getTmdbSearchQueries(movie) {
    const fallbackQueries = {
        Se7en: ['Seven']
    };

    return [movie.title, ...(fallbackQueries[movie.title] || [])];
}

function getTmdbMatchScore(result, movie) {
    let score = 0;
    const normalizedMovieTitle = normalizeMovieTitle(movie.title);
    const normalizedResultTitle = normalizeMovieTitle(result.title || '');
    const releaseYear = result.release_date?.slice(0, 4);

    if (normalizedResultTitle === normalizedMovieTitle) {
        score += 100;
    }

    if (normalizedResultTitle.includes(normalizedMovieTitle) || normalizedMovieTitle.includes(normalizedResultTitle)) {
        score += 40;
    }

    if (releaseYear === String(movie.year)) {
        score += 30;
    }

    if (Array.isArray(result.genre_ids) && result.genre_ids.length > 0) {
        score += 5;
    }

    return score;
}

function normalizeMovieTitle(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .replace(/\bthe\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
