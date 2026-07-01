const state = {
  roles: {},
  screenings: [],
  stats: {},
  roleQuery: "",
  historyQuery: "",
};

const screeningForm = document.getElementById("screeningForm");
const resumeText = document.getElementById("resumeText");
const resumeFile = document.getElementById("resumeFile");
const formMessage = document.getElementById("formMessage");
const statsEl = document.getElementById("stats");
const roleGrid = document.getElementById("roleGrid");
const historyRows = document.getElementById("historyRows");
const resultCard = document.getElementById("resultCard");
const emptyResult = document.getElementById("emptyResult");
const decision = document.getElementById("decision");
const scoreValue = document.getElementById("scoreValue");
const recommendation = document.getElementById("recommendation");
const skillScore = document.getElementById("skillScore");
const keywordScore = document.getElementById("keywordScore");
const experienceScore = document.getElementById("experienceScore");
const matchedSkills = document.getElementById("matchedSkills");
const missingSkills = document.getElementById("missingSkills");
const strengths = document.getElementById("strengths");
const roleSearch = document.getElementById("roleSearch");
const historySearch = document.getElementById("historySearch");
const modeCard = document.getElementById("modeCard");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

function chips(items) {
  return (items || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("") || "<span>None</span>";
}

function renderStats() {
  const cards = [
    ["Screenings", state.stats.totalScreenings || 0],
    ["Average Score", `${state.stats.averageScore || 0}%`],
    ["Shortlisted", state.stats.shortlisted || 0],
    ["Database", state.stats.databaseReady ? "MongoDB" : "Memory"],
  ];
  statsEl.innerHTML = cards.map(([label, value]) => `
    <article class="stat">
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `).join("");
  modeCard.querySelector("strong").textContent = state.stats.databaseReady ? "MongoDB connected" : "Demo mode active";
}

function renderRoles() {
  const query = state.roleQuery.toLowerCase();
  roleGrid.innerHTML = Object.entries(state.roles)
    .filter(([role]) => !query || role.toLowerCase().includes(query))
    .map(([role, profile]) => `
      <article class="role-card">
        <strong>${escapeHtml(role)}</strong>
        <p>${escapeHtml(profile.skills.slice(0, 6).join(", "))}</p>
        <div class="chips">${chips(profile.keywords)}</div>
      </article>
    `).join("") || `<article class="role-card"><strong>No role found</strong><p>Try another search.</p></article>`;
}

function renderResult(screening) {
  emptyResult.classList.add("hidden");
  resultCard.classList.remove("hidden");
  decision.textContent = screening.decision;
  scoreValue.textContent = `${screening.finalScore}%`;
  recommendation.textContent = screening.recommendation;
  skillScore.textContent = `${screening.skillScore}%`;
  keywordScore.textContent = `${screening.keywordScore}%`;
  experienceScore.textContent = `${screening.experienceScore}%`;
  matchedSkills.innerHTML = chips(screening.matchedSkills);
  missingSkills.innerHTML = chips(screening.missingSkills);
  strengths.innerHTML = (screening.strengths || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderHistory() {
  const query = state.historyQuery.toLowerCase();
  const rows = state.screenings.filter((item) => {
    const text = [item.candidateName, item.email, item.phone, item.role, item.decision, ...(item.matchedSkills || [])].join(" ").toLowerCase();
    return !query || text.includes(query);
  });
  historyRows.innerHTML = rows.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.candidateName)}</strong><br>${escapeHtml(item.email || "-")} | ${escapeHtml(item.phone || "-")}</td>
      <td>${escapeHtml(item.role)}<br>${escapeHtml(item.detectedExperience)} years detected</td>
      <td><strong>${escapeHtml(item.finalScore)}%</strong><br>Skill ${escapeHtml(item.skillScore)}%</td>
      <td><strong>Matched:</strong> ${escapeHtml((item.matchedSkills || []).join(", ") || "None")}<br><strong>Missing:</strong> ${escapeHtml((item.missingSkills || []).slice(0, 5).join(", ") || "None")}</td>
      <td><span class="status">${escapeHtml(item.decision)}</span><br>${escapeHtml(item.recommendation)}</td>
    </tr>
  `).join("") || `<tr><td colspan="5">No screenings yet.</td></tr>`;
}

async function refresh() {
  const [metadataData, statsData, screeningsData] = await Promise.all([
    api("/api/metadata"),
    api("/api/stats"),
    api("/api/screenings"),
  ]);
  state.roles = metadataData.roles || {};
  state.stats = statsData.stats || {};
  state.screenings = screeningsData.screenings || [];
  renderStats();
  renderRoles();
  renderHistory();
}

screeningForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "Screening resume...";
  formMessage.className = "form-message";
  const payload = Object.fromEntries(new FormData(screeningForm).entries());
  try {
    const data = await api("/api/screen", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    renderResult(data.screening);
    formMessage.textContent = "Screening saved successfully.";
    formMessage.className = "form-message ok";
    await refresh();
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.className = "form-message bad";
  }
});

resumeFile.addEventListener("change", async () => {
  const file = resumeFile.files[0];
  if (!file) return;
  resumeText.value = await file.text();
});

roleSearch.addEventListener("input", () => {
  state.roleQuery = roleSearch.value;
  renderRoles();
});

historySearch.addEventListener("input", () => {
  state.historyQuery = historySearch.value;
  renderHistory();
});

refresh().catch((error) => {
  statsEl.innerHTML = `<article class="stat"><strong>!</strong><span>${escapeHtml(error.message)}</span></article>`;
});
