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
        const tmdbData = await searchTmdbMovie(movie);
        const posterMatch = findPosterMatch(tmdbData);

        if (!posterMatch) {
            return res.status(404).json({ error: 'Poster not found.' });
        }

        return res.json({
            posterUrl: buildPosterUrl(posterMatch.poster_path)
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

async function searchTmdbMovie(movie) {
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

        if (findPosterMatch(tmdbData)) {
            return tmdbData;
        }
    }

    return { results: [] };
}

function findPosterMatch(tmdbData) {
    return tmdbData.results?.find(result => result.poster_path);
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
