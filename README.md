# TalentLens AI — Resume Screening System

Animated Flask + MongoDB resume intelligence application that reads pasted text, PDF, DOCX and TXT resumes, classifies candidate profiles, and matches them against 32 software careers with salary insights.

## Features

- Server-side PDF, Microsoft Word (`.docx`) and text extraction
- Paste-to-analyze workflow with drag-and-drop upload
- Resume classification: type, career level, primary domain, sections and word count
- 32 software job profiles across development, data/AI, cloud, security, QA, design and IT
- Required-skill matching, evidence keywords, experience and resume-quality scoring
- Indian annual salary ranges and experience requirements for every role
- Automatic role recommendations based on resume contents
- MongoDB screening history with in-memory local fallback
- Responsive animated UI with reduced-motion accessibility support
- File validation and 8 MB upload limit

## Local setup

### Recommended on Windows

Double-click `setup.bat` once, then use `run.bat` whenever you want to start the application. These scripts create an isolated `.venv`, install every required package, and avoid global Python package conflicts.

### Manual setup

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`.

If `ModuleNotFoundError` appears, the dependencies were installed into a different Python environment. Run:

```bash
python -m pip install -r requirements.txt
```

Using `python -m pip` ensures pip installs into the same Python used by `python app.py`.

## Environment variables

- `MONGO_URI`: MongoDB Atlas or local connection string
- `MONGO_DB_NAME`: defaults to `ai_resume_screening`
- `PORT`: defaults to `5000`

Uploaded source documents are processed in memory. The application stores the screening result and a short text preview, not the original file.

## API

- `GET /api/health`
- `GET /api/metadata`
- `GET /api/stats`
- `GET /api/screenings`
- `POST /api/resume/extract` — multipart field `resume`
- `POST /api/screen`
- `DELETE /api/screenings/<id>`

## Tests

```bash
pytest -q
```

The test suite covers scoring, job metadata, salary data, TXT/DOCX extraction and file validation.
