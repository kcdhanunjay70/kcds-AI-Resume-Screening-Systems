import os
import re
from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from bson import ObjectId
from flask import Flask, jsonify, render_template, request
from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError


ROLE_PROFILES = {
    "Python Developer": {
        "skills": ["python", "flask", "django", "rest api", "mongodb", "sql", "git", "testing", "oops"],
        "keywords": ["backend", "api", "database", "debugging", "deployment"],
    },
    "Data Analyst": {
        "skills": ["python", "sql", "excel", "power bi", "tableau", "statistics", "pandas", "dashboard"],
        "keywords": ["reporting", "insights", "visualization", "cleaning", "analysis"],
    },
    "Machine Learning Engineer": {
        "skills": ["python", "machine learning", "scikit-learn", "pandas", "numpy", "model deployment", "mongodb"],
        "keywords": ["classification", "regression", "training", "features", "accuracy"],
    },
    "Frontend Developer": {
        "skills": ["html", "css", "javascript", "react", "responsive design", "api integration", "git"],
        "keywords": ["ui", "components", "browser", "accessibility", "performance"],
    },
    "Full Stack Developer": {
        "skills": ["html", "css", "javascript", "python", "flask", "mongodb", "rest api", "deployment", "git"],
        "keywords": ["frontend", "backend", "authentication", "database", "testing"],
    },
}

EXPERIENCE_WORDS = {
    "internship": 5,
    "project": 4,
    "deployed": 5,
    "production": 5,
    "certification": 3,
    "lead": 4,
    "team": 2,
    "client": 3,
    "github": 4,
}


def utc_now():
    return datetime.now(timezone.utc)


def clean(value, max_length=500):
    return str(value or "").strip()[:max_length]


def serialize(document):
    item = dict(document)
    if "_id" in item:
        item["id"] = str(item.pop("_id"))
    for key in ("createdAt", "updatedAt"):
        if isinstance(item.get(key), datetime):
            item[key] = item[key].isoformat()
    return item


def tokens(text):
    return re.findall(r"[a-z0-9+#.]+", str(text or "").lower())


def contains_phrase(text, phrase):
    return phrase.lower() in text.lower()


def parse_required_skills(role, custom_skills):
    role_profile = ROLE_PROFILES.get(role, ROLE_PROFILES["Full Stack Developer"])
    skills = list(role_profile["skills"])
    for item in re.split(r"[,|\n]", custom_skills or ""):
        skill = item.strip().lower()
        if skill and skill not in skills:
            skills.append(skill)
    return skills, role_profile["keywords"]


def score_resume(payload):
    candidate_name = clean(payload.get("candidateName"), 80) or "Candidate"
    role = clean(payload.get("role"), 80) or "Full Stack Developer"
    resume_text = clean(payload.get("resumeText"), 12000)
    custom_skills = clean(payload.get("requiredSkills"), 1000)
    min_experience = int(float(payload.get("minExperience") or 0))

    if role not in ROLE_PROFILES:
        raise ValueError("Unsupported role")
    if len(resume_text) < 80:
        raise ValueError("Resume text must contain at least 80 characters")
    if min_experience < 0 or min_experience > 20:
        raise ValueError("Minimum experience must be between 0 and 20 years")

    required_skills, keywords = parse_required_skills(role, custom_skills)
    resume_lower = resume_text.lower()
    word_counts = Counter(tokens(resume_text))
    matched_skills = [skill for skill in required_skills if contains_phrase(resume_lower, skill)]
    missing_skills = [skill for skill in required_skills if skill not in matched_skills]
    keyword_hits = [keyword for keyword in keywords if contains_phrase(resume_lower, keyword)]

    years_found = [float(value) for value in re.findall(r"(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs|year)", resume_lower)]
    detected_experience = max(years_found) if years_found else 0
    experience_score = 100 if detected_experience >= min_experience else max(30, int((detected_experience / max(min_experience, 1)) * 100))

    skill_score = int((len(matched_skills) / max(len(required_skills), 1)) * 100)
    keyword_score = int((len(keyword_hits) / max(len(keywords), 1)) * 100)
    quality_score = min(100, 45 + len(resume_text) // 45 + sum(EXPERIENCE_WORDS.get(word, 0) for word in word_counts))
    final_score = round(skill_score * 0.52 + keyword_score * 0.18 + experience_score * 0.18 + quality_score * 0.12)

    if final_score >= 82:
        decision = "Strong Match"
        recommendation = "Shortlist for technical interview."
    elif final_score >= 65:
        decision = "Good Match"
        recommendation = "Review projects and conduct a screening call."
    elif final_score >= 48:
        decision = "Average Match"
        recommendation = "Keep as backup and ask for missing skill proof."
    else:
        decision = "Low Match"
        recommendation = "Not recommended for this role right now."

    strengths = []
    if matched_skills:
        strengths.append(f"Matched {len(matched_skills)} required skills")
    if keyword_hits:
        strengths.append(f"Relevant role keywords found: {', '.join(keyword_hits[:4])}")
    if detected_experience:
        strengths.append(f"Detected {detected_experience:g} years experience")
    if "project" in word_counts or "projects" in word_counts:
        strengths.append("Project work mentioned")

    return {
        "candidateName": candidate_name,
        "role": role,
        "minExperience": min_experience,
        "detectedExperience": detected_experience,
        "requiredSkills": required_skills,
        "matchedSkills": matched_skills,
        "missingSkills": missing_skills,
        "keywordHits": keyword_hits,
        "skillScore": skill_score,
        "keywordScore": keyword_score,
        "experienceScore": experience_score,
        "resumeQualityScore": quality_score,
        "finalScore": final_score,
        "decision": decision,
        "recommendation": recommendation,
        "strengths": strengths or ["Readable resume text submitted"],
        "resumePreview": resume_text[:700],
    }


class ScreeningStore:
    def __init__(self):
        self.client = None
        self.db = None
        self.mode = "memory"
        self.error = ""
        self.memory_screenings = []

        mongo_uri = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI")
        db_name = os.getenv("MONGO_DB_NAME", "ai_resume_screening")
        if mongo_uri:
            try:
                self.client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2500)
                self.client.admin.command("ping")
                self.db = self.client[db_name]
                self.mode = "mongodb"
                self.screenings.create_index("createdAt")
                self.screenings.create_index([("role", 1), ("finalScore", -1)])
            except (PyMongoError, ServerSelectionTimeoutError) as exc:
                self.error = str(exc)

    @property
    def screenings(self):
        return self.db["screenings"] if self.db is not None else None

    def create_screening(self, payload):
        result = score_resume(payload)
        now = utc_now()
        document = {
            **result,
            "email": clean(payload.get("email"), 120),
            "phone": clean(payload.get("phone"), 20),
            "notes": clean(payload.get("notes"), 500),
            "createdAt": now,
            "updatedAt": now,
        }
        if self.mode == "mongodb":
            inserted = self.screenings.insert_one(document)
            document["_id"] = inserted.inserted_id
        else:
            document["id"] = str(uuid4())
            self.memory_screenings.insert(0, document)
        return serialize(document)

    def list_screenings(self, limit=20):
        if self.mode == "mongodb":
            items = self.screenings.find({}).sort("createdAt", -1).limit(limit)
            return [serialize(item) for item in items]
        return [serialize(item) for item in self.memory_screenings[:limit]]

    def delete_screening(self, screening_id):
        if self.mode == "mongodb":
            if not ObjectId.is_valid(screening_id):
                raise LookupError("Screening not found")
            result = self.screenings.delete_one({"_id": ObjectId(screening_id)})
            if result.deleted_count == 0:
                raise LookupError("Screening not found")
            return
        before = len(self.memory_screenings)
        self.memory_screenings = [item for item in self.memory_screenings if item["id"] != screening_id]
        if len(self.memory_screenings) == before:
            raise LookupError("Screening not found")

    def stats(self):
        screenings = self.list_screenings(250)
        average = round(sum(item["finalScore"] for item in screenings) / len(screenings), 1) if screenings else 0
        shortlisted = len([item for item in screenings if item["decision"] in {"Strong Match", "Good Match"}])
        return {
            "totalScreenings": len(screenings),
            "averageScore": average,
            "shortlisted": shortlisted,
            "roleCount": len({item["role"] for item in screenings}),
            "databaseReady": self.mode == "mongodb",
            "mode": self.mode,
            "databaseError": self.error,
        }


def create_app():
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    store = ScreeningStore()

    @app.get("/")
    def home():
        return render_template("index.html", roles=ROLE_PROFILES.keys())

    @app.get("/api/health")
    def health():
        return jsonify({"success": True, "status": "ok", "storeMode": store.mode})

    @app.get("/api/metadata")
    def metadata():
        return jsonify({"success": True, "roles": ROLE_PROFILES})

    @app.get("/api/stats")
    def stats():
        return jsonify({"success": True, "stats": store.stats()})

    @app.get("/api/screenings")
    def screenings():
        return jsonify({"success": True, "screenings": store.list_screenings()})

    @app.post("/api/screen")
    def screen():
        try:
            screening = store.create_screening(request.get_json(silent=True) or {})
            return jsonify({"success": True, "screening": screening}), 201
        except ValueError as exc:
            return jsonify({"success": False, "message": str(exc)}), 400
        except PyMongoError as exc:
            return jsonify({"success": False, "message": f"Database error: {exc}"}), 502

    @app.delete("/api/screenings/<screening_id>")
    def delete(screening_id):
        try:
            store.delete_screening(screening_id)
            return jsonify({"success": True})
        except LookupError as exc:
            return jsonify({"success": False, "message": str(exc)}), 404

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG") == "1")
