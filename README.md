# KCDS AI Resume Screening Systems

Excellent UI Flask + MongoDB project for screening resumes against job roles using skill matching, keyword scoring, experience detection and recruiter-ready recommendations.

## Features

- Responsive HTML, CSS and JavaScript frontend.
- Flask REST API with validation.
- MongoDB screening history using `MONGO_URI`.
- In-memory fallback when MongoDB is not configured.
- Role templates for Python Developer, Data Analyst, ML Engineer, Frontend Developer and Full Stack Developer.
- Match score, skill score, keyword score, experience score, matched skills, missing skills and hiring decision.
- TXT resume upload helper in the browser.
- Render deployment configuration and GitHub Actions CI.

## Local Setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`.

## Environment Variables

- `MONGO_URI`: MongoDB Atlas or local MongoDB connection string.
- `MONGO_DB_NAME`: database name, default `ai_resume_screening`.
- `PORT`: server port, provided automatically by Render.

## API Endpoints

- `GET /api/health`
- `GET /api/metadata`
- `GET /api/stats`
- `GET /api/screenings`
- `POST /api/screen`
- `DELETE /api/screenings/<id>`

## Deploy on Render

Use `render.yaml`, connect this GitHub repository, and set `MONGO_URI` in Render environment variables.

## Tests

```bash
pytest -q
```
