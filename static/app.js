const state = { jobs: [], screenings: [], stats: {}, roleQuery: "", category: "", historyQuery: "", sourceFile: "" };
const $ = (id) => document.getElementById(id);
const form = $("screeningForm"), resumeText = $("resumeText"), resumeFile = $("resumeFile"), formMessage = $("formMessage");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const escapeHtml = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.message || "Request failed");
  return data;
}
const chips = (items) => (items || []).map((x) => `<span>${escapeHtml(x)}</span>`).join("") || "<span>None</span>";
const salary = (job) => `${money.format(job.salaryMin)} – ${money.format(job.salaryMax)}`;

function renderStats() {
  const cards = [["Resume screenings", state.stats.totalScreenings || 0, "↗"], ["Average match", `${state.stats.averageScore || 0}%`, "◎"], ["Candidates shortlisted", state.stats.shortlisted || 0, "✓"], ["Software roles", state.stats.jobCount || 32, "⌘"]];
  $("stats").innerHTML = cards.map(([label,value,icon], i) => `<article style="--delay:${i*.08}s"><i>${icon}</i><div><strong>${escapeHtml(value)}</strong><span>${label}</span></div></article>`).join("");
}

function renderJobs() {
  const q = state.roleQuery.toLowerCase();
  const jobs = state.jobs.filter((j) => (!state.category || j.category === state.category) && (!q || `${j.title} ${j.category} ${j.skills.join(" ")}`.toLowerCase().includes(q)));
  $("roleGrid").innerHTML = jobs.map((j, i) => `<article class="job-card" style="--delay:${(i%8)*.04}s" data-job="${j.id}">
    <div><span class="job-icon">${j.title.slice(0,2).toUpperCase()}</span><span class="level">${escapeHtml(j.level)}</span></div>
    <small>${escapeHtml(j.category)}</small><h3>${escapeHtml(j.title)}</h3>
    <p>${escapeHtml(j.skills.slice(0,5).join(" · "))}</p>
    <div class="job-salary"><span>Salary range</span><strong>${salary(j)}</strong></div>
    <footer><span>${j.experience}+ yrs</span><button type="button">Match this role →</button></footer>
  </article>`).join("") || `<div class="no-results">No matching jobs. Try a broader search.</div>`;
}

function renderHistory() {
  const q = state.historyQuery.toLowerCase();
  const rows = state.screenings.filter((x) => !q || `${x.candidateName} ${x.role} ${x.decision}`.toLowerCase().includes(q));
  $("historyRows").innerHTML = rows.map((x) => `<article class="history-card"><div class="history-score">${x.finalScore}<small>%</small></div><div><span>${escapeHtml(x.decision)}</span><h3>${escapeHtml(x.candidateName)}</h3><p>${escapeHtml(x.role)} · ${escapeHtml(x.detectedExperience)} yrs</p></div><strong>${money.format(x.salaryMin)}–${money.format(x.salaryMax)}</strong></article>`).join("") || `<div class="no-results">No screenings yet. Your first result will appear here.</div>`;
}

function updateSelectedJob() {
  const job = state.jobs.find((x) => x.id === $("jobSelect").value);
  if (!job) return;
  $("minExperience").value = job.experience;
  $("selectedSalary").innerHTML = `<span>Expected salary for ${escapeHtml(job.title)}</span><strong>${salary(job)}</strong><small>${escapeHtml(job.level)} · India market estimate</small>`;
}

function renderClassification(c) {
  $("classification").classList.remove("hidden");
  $("classification").innerHTML = `<div><span>Resume type</span><strong>${escapeHtml(c.resumeType)}</strong></div><div><span>Career level</span><strong>${escapeHtml(c.careerLevel)}</strong></div><div><span>Primary domain</span><strong>${escapeHtml(c.primaryDomain)}</strong></div><div><span>Words scanned</span><strong>${c.wordCount}</strong></div>`;
  if (c.recommendedJobs?.[0]) {
    $("jobSelect").value = c.recommendedJobs[0].id;
    updateSelectedJob();
  }
}

function renderResult(x) {
  $("emptyResult").classList.add("hidden"); $("resultCard").classList.remove("hidden");
  $("scoreValue").textContent = `${x.finalScore}%`; $("scoreDial").style.setProperty("--score", `${x.finalScore * 3.6}deg`);
  $("decision").textContent = x.decision; $("resultRole").textContent = x.role; $("recommendation").textContent = x.recommendation;
  $("salaryRange").textContent = `${money.format(x.salaryMin)} – ${money.format(x.salaryMax)}`;
  $("skillScore").textContent = `${x.skillScore}%`; $("keywordScore").textContent = `${x.keywordScore}%`; $("experienceScore").textContent = `${x.experienceScore}%`;
  $("matchedSkills").innerHTML = chips(x.matchedSkills); $("missingSkills").innerHTML = chips(x.missingSkills);
  $("strengths").innerHTML = (x.strengths || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("");
}

async function extractFile(file) {
  const body = new FormData(); body.append("resume", file);
  $("fileStatus").textContent = `Scanning ${file.name}…`; $("dropzone").classList.add("loading");
  try {
    const data = await api("/api/resume/extract", { method: "POST", body });
    resumeText.value = data.text; state.sourceFile = data.fileName; renderClassification(data.classification);
    $("fileStatus").textContent = `✓ ${file.name} · ${data.classification.wordCount} words extracted`;
    $("dropzone").classList.add("complete");
  } catch (e) {
    $("fileStatus").textContent = e.message; $("dropzone").classList.add("error"); throw e;
  } finally { $("dropzone").classList.remove("loading"); }
}

resumeFile.addEventListener("change", () => resumeFile.files[0] && extractFile(resumeFile.files[0]).catch(() => {}));
["dragenter","dragover"].forEach((e) => $("dropzone").addEventListener(e, (event) => { event.preventDefault(); $("dropzone").classList.add("dragging"); }));
["dragleave","drop"].forEach((e) => $("dropzone").addEventListener(e, (event) => { event.preventDefault(); $("dropzone").classList.remove("dragging"); }));
$("dropzone").addEventListener("drop", (event) => event.dataTransfer.files[0] && extractFile(event.dataTransfer.files[0]).catch(() => {}));

form.addEventListener("submit", async (event) => {
  event.preventDefault(); formMessage.textContent = "Reading signals and matching skills…"; formMessage.className = "form-message";
  const payload = Object.fromEntries(new FormData(form).entries()); payload.sourceFile = state.sourceFile;
  try {
    const data = await api("/api/screen", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
    renderResult(data.screening); renderClassification(data.screening.classification);
    formMessage.textContent = "✓ Analysis complete and screening saved."; formMessage.className = "form-message ok";
    await refresh(); $("resultCard").scrollIntoView({ behavior:"smooth", block:"center" });
  } catch (e) { formMessage.textContent = e.message; formMessage.className = "form-message bad"; }
});

$("jobSelect").addEventListener("change", updateSelectedJob);
$("roleSearch").addEventListener("input", (e) => { state.roleQuery = e.target.value; renderJobs(); });
$("categoryFilter").addEventListener("change", (e) => { state.category = e.target.value; renderJobs(); });
$("historySearch").addEventListener("input", (e) => { state.historyQuery = e.target.value; renderHistory(); });
$("roleGrid").addEventListener("click", (e) => { const card = e.target.closest("[data-job]"); if (!card || !e.target.closest("button")) return; $("jobSelect").value = card.dataset.job; updateSelectedJob(); $("screen").scrollIntoView({behavior:"smooth"}); });

async function refresh() {
  const [m,s,h] = await Promise.all([api("/api/metadata"), api("/api/stats"), api("/api/screenings")]);
  state.jobs = m.jobs; state.stats = s.stats; state.screenings = h.screenings;
  const categories = [...new Set(state.jobs.map((j) => j.category))];
  $("categoryFilter").innerHTML = `<option value="">All categories</option>${categories.map((c) => `<option>${escapeHtml(c)}</option>`).join("")}`;
  renderStats(); renderJobs(); renderHistory(); updateSelectedJob();
}

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("visible")), {threshold:.08});
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
refresh().catch((e) => { formMessage.textContent = e.message; formMessage.className = "form-message bad"; });
