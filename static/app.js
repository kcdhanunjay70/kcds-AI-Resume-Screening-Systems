const state = { jobs: [], screenings: [], stats: {}, roleQuery: "", category: "", historyQuery: "", sourceFile: "" };
const $ = (id) => document.getElementById(id);
const form = $("screeningForm");
const resumeText = $("resumeText");
const resumeFile = $("resumeFile");
const formMessage = $("formMessage");
const formatInr = (value) => `INR ${Number(value || 0).toLocaleString("en-IN")}`;
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || "Request failed");
  return data;
}

const chips = (items) => (items || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("") || "<span>None</span>";
const salary = (job) => `${formatInr(job.salaryMin)} - ${formatInr(job.salaryMax)}`;

function renderStats() {
  const cards = [
    ["Resume screenings", state.stats.totalScreenings || 0, "CV"],
    ["Average match", `${state.stats.averageScore || 0}%`, "%"],
    ["Candidates shortlisted", state.stats.shortlisted || 0, "OK"],
    ["Software roles", state.stats.jobCount || 32, "32"]
  ];
  $("stats").innerHTML = cards.map(([label, value, icon], index) => `
    <article style="--delay:${index * 0.08}s">
      <i>${icon}</i>
      <div><strong>${escapeHtml(value)}</strong><span>${label}</span></div>
    </article>
  `).join("");
}

function renderJobs() {
  const query = state.roleQuery.toLowerCase();
  const jobs = state.jobs.filter((job) => (
    (!state.category || job.category === state.category)
    && (!query || `${job.title} ${job.category} ${job.skills.join(" ")}`.toLowerCase().includes(query))
  ));
  $("roleGrid").innerHTML = jobs.map((job, index) => `
    <article class="job-card" style="--delay:${(index % 8) * 0.04}s" data-job="${job.id}">
      <div><span class="job-icon">${job.title.slice(0, 2).toUpperCase()}</span><span class="level">${escapeHtml(job.level)}</span></div>
      <small>${escapeHtml(job.category)}</small>
      <h3>${escapeHtml(job.title)}</h3>
      <p>${escapeHtml(job.skills.slice(0, 5).join(" / "))}</p>
      <div class="job-salary"><span>Salary range</span><strong>${salary(job)}</strong></div>
      <footer><span>${job.experience}+ yrs</span><button type="button">Match this role</button></footer>
    </article>
  `).join("") || `<div class="no-results">No matching jobs. Try a broader search.</div>`;
}

function renderHistory() {
  const query = state.historyQuery.toLowerCase();
  const rows = state.screenings.filter((item) => !query || `${item.candidateName} ${item.role} ${item.decision}`.toLowerCase().includes(query));
  $("historyRows").innerHTML = rows.map((item) => `
    <article class="history-card">
      <div class="history-score">${item.finalScore}<small>%</small></div>
      <div>
        <span>${escapeHtml(item.decision)}</span>
        <h3>${escapeHtml(item.candidateName)}</h3>
        <p>${escapeHtml(item.role)} / ${escapeHtml(item.detectedExperience)} yrs</p>
      </div>
      <strong>${formatInr(item.salaryMin)} - ${formatInr(item.salaryMax)}</strong>
    </article>
  `).join("") || `<div class="no-results">No screenings yet. Your first result will appear here.</div>`;
}

function updateSelectedJob() {
  const job = state.jobs.find((item) => item.id === $("jobSelect").value);
  if (!job) return;
  $("minExperience").value = job.experience;
  $("selectedSalary").innerHTML = `
    <span>Expected salary for ${escapeHtml(job.title)}</span>
    <strong>${salary(job)}</strong>
    <small>${escapeHtml(job.level)} / India market estimate</small>
  `;
}

function renderClassification(classification) {
  $("classification").classList.remove("hidden");
  $("classification").innerHTML = `
    <div><span>Resume type</span><strong>${escapeHtml(classification.resumeType)}</strong></div>
    <div><span>Career level</span><strong>${escapeHtml(classification.careerLevel)}</strong></div>
    <div><span>Primary domain</span><strong>${escapeHtml(classification.primaryDomain)}</strong></div>
    <div><span>Words scanned</span><strong>${classification.wordCount}</strong></div>
  `;
  if (classification.recommendedJobs?.[0]) {
    $("jobSelect").value = classification.recommendedJobs[0].id;
    updateSelectedJob();
  }
}

function renderResult(result) {
  $("emptyResult").classList.add("hidden");
  $("resultCard").classList.remove("hidden");
  $("scoreValue").textContent = `${result.finalScore}%`;
  $("scoreDial").style.setProperty("--score", `${result.finalScore * 3.6}deg`);
  $("decision").textContent = result.decision;
  $("resultRole").textContent = result.role;
  $("recommendation").textContent = result.recommendation;
  $("salaryRange").textContent = `${formatInr(result.salaryMin)} - ${formatInr(result.salaryMax)}`;
  $("skillScore").textContent = `${result.skillScore}%`;
  $("keywordScore").textContent = `${result.keywordScore}%`;
  $("experienceScore").textContent = `${result.experienceScore}%`;
  $("matchedSkills").innerHTML = chips(result.matchedSkills);
  $("missingSkills").innerHTML = chips(result.missingSkills);
  $("strengths").innerHTML = (result.strengths || []).map((strength) => `<li>${escapeHtml(strength)}</li>`).join("");
}

async function extractFile(file) {
  const body = new FormData();
  body.append("resume", file);
  $("fileStatus").textContent = `Scanning ${file.name}...`;
  $("dropzone").classList.add("loading");
  try {
    const data = await api("/api/resume/extract", { method: "POST", body });
    resumeText.value = data.text;
    state.sourceFile = data.fileName;
    renderClassification(data.classification);
    $("fileStatus").textContent = `${file.name} - ${data.classification.wordCount} words extracted`;
    $("dropzone").classList.add("complete");
  } catch (error) {
    $("fileStatus").textContent = error.message;
    $("dropzone").classList.add("error");
    throw error;
  } finally {
    $("dropzone").classList.remove("loading");
  }
}

resumeFile.addEventListener("change", () => resumeFile.files[0] && extractFile(resumeFile.files[0]).catch(() => {}));
["dragenter", "dragover"].forEach((eventName) => $("dropzone").addEventListener(eventName, (event) => {
  event.preventDefault();
  $("dropzone").classList.add("dragging");
}));
["dragleave", "drop"].forEach((eventName) => $("dropzone").addEventListener(eventName, (event) => {
  event.preventDefault();
  $("dropzone").classList.remove("dragging");
}));
$("dropzone").addEventListener("drop", (event) => event.dataTransfer.files[0] && extractFile(event.dataTransfer.files[0]).catch(() => {}));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "Reading signals and matching skills...";
  formMessage.className = "form-message";
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.sourceFile = state.sourceFile;
  try {
    const data = await api("/api/screen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    renderResult(data.screening);
    renderClassification(data.screening.classification);
    formMessage.textContent = "Analysis complete and screening saved.";
    formMessage.className = "form-message ok";
    await refresh();
    $("resultCard").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.className = "form-message bad";
  }
});

$("jobSelect").addEventListener("change", updateSelectedJob);
$("roleSearch").addEventListener("input", (event) => { state.roleQuery = event.target.value; renderJobs(); });
$("categoryFilter").addEventListener("change", (event) => { state.category = event.target.value; renderJobs(); });
$("historySearch").addEventListener("input", (event) => { state.historyQuery = event.target.value; renderHistory(); });
$("roleGrid").addEventListener("click", (event) => {
  const card = event.target.closest("[data-job]");
  if (!card || !event.target.closest("button")) return;
  $("jobSelect").value = card.dataset.job;
  updateSelectedJob();
  $("screen").scrollIntoView({ behavior: "smooth" });
});

async function refresh() {
  const [metadata, stats, history] = await Promise.all([api("/api/metadata"), api("/api/stats"), api("/api/screenings")]);
  state.jobs = metadata.jobs;
  state.stats = stats.stats;
  state.screenings = history.screenings;
  const categories = [...new Set(state.jobs.map((job) => job.category))];
  $("categoryFilter").innerHTML = `<option value="">All categories</option>${categories.map((category) => `<option>${escapeHtml(category)}</option>`).join("")}`;
  renderStats();
  renderJobs();
  renderHistory();
  updateSelectedJob();
}

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) entry.target.classList.add("visible");
}), { threshold: 0.08 });
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
refresh().catch((error) => {
  formMessage.textContent = error.message;
  formMessage.className = "form-message bad";
});
