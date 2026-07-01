use("ai_resume_screening");

db.screenings.createIndex({ createdAt: -1 });
db.screenings.createIndex({ role: 1, finalScore: -1 });

db.screenings.insertOne({
  candidateName: "Demo Candidate",
  email: "candidate@example.com",
  phone: "9999999999",
  role: "Python Developer",
  minExperience: 1,
  detectedExperience: 2,
  requiredSkills: ["python", "flask", "mongodb", "sql", "git"],
  matchedSkills: ["python", "flask", "mongodb", "sql", "git"],
  missingSkills: [],
  keywordHits: ["backend", "api", "database"],
  skillScore: 100,
  keywordScore: 80,
  experienceScore: 100,
  resumeQualityScore: 86,
  finalScore: 95,
  decision: "Strong Match",
  recommendation: "Shortlist for technical interview.",
  strengths: ["Matched required skills", "Project work mentioned"],
  resumePreview: "Demo resume text",
  notes: "Demo screening document",
  createdAt: new Date(),
  updatedAt: new Date()
});
