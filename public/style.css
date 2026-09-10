const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchButton = document.getElementById("searchButton");
const searchButtonText = document.getElementById("searchButtonText");
const spinner = document.getElementById("spinner");

const resultsSection = document.getElementById("resultsSection");
const resultsTitle = document.getElementById("resultsTitle");
const results = document.getElementById("results");

const answerBox = document.getElementById("answerBox");

const googleFallback = document.getElementById("googleFallback");
const googleLink = document.getElementById("googleLink");

const historySection = document.getElementById("historySection");
const historyContainer = document.getElementById("history");

const clearButton = document.getElementById("clearButton");
const themeButton = document.getElementById("themeButton");

const quickButtons =
  document.querySelectorAll(".quick-searches button");

let history = JSON.parse(
  localStorage.getItem("nexus-history") || "[]"
);

function setLoading(loading) {
  searchButton.disabled = loading;

  if (loading) {
    searchButtonText.classList.add("hidden");
    spinner.classList.remove("hidden");
  } else {
    searchButtonText.classList.remove("hidden");
    spinner.classList.add("hidden");
  }
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveHistory(query) {
  history = [
    query,
    ...history.filter(item => item !== query)
  ].slice(0, 10);

  localStorage.setItem(
    "nexus-history",
    JSON.stringify(history)
  );

  renderHistory();
}

function renderHistory() {
  if (!history.length) {
    historySection.classList.add("hidden");
    return;
  }

  historySection.classList.remove("hidden");

  historyContainer.innerHTML = history
    .map(query => `
      <button
        class="history-item"
        data-history="${escapeHTML(query)}"
      >
        ${escapeHTML(query)}
      </button>
    `)
    .join("");

  document
    .querySelectorAll(".history-item")
    .forEach(button => {
      button.addEventListener("click", () => {
        searchInput.value =
          button.dataset.history;

        searchForm.requestSubmit();
      });
    });
}

function showError(message, googleURL) {
  resultsSection.classList.remove("hidden");

  resultsTitle.textContent = "Something went wrong";

  answerBox.classList.remove("hidden");

  answerBox.innerHTML = `
    <div class="answer-label">NEXUS ERROR</div>
    <h3>Search unavailable</h3>
    <p>${escapeHTML(message)}</p>
  `;

  results.innerHTML = "";

  if (googleURL) {
    googleFallback.classList.remove("hidden");
    googleLink.href = googleURL;
  }
}

async function search(query) {
  query = query.trim();

  if (!query) {
    searchInput.focus();
    return;
  }

  setLoading(true);

  resultsSection.classList.remove("hidden");

  resultsTitle.textContent = query;

  answerBox.classList.add("hidden");
  googleFallback.classList.add("hidden");

  results.innerHTML = `
    <div class="answer-box">
      <div class="answer-label">NEXUS</div>
      <h3>Searching...</h3>
      <p>Finding relevant information.</p>
    </div>
  `;

  saveHistory(query);

  try {
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(
        data.error || "Search failed."
      );
    }

    results.innerHTML = "";

    if (data.found && data.results.length) {

      const first = data.results[0];

      answerBox.classList.remove("hidden");

      answerBox.innerHTML = `
        <div class="answer-label">QUICK ANSWER</div>
        <h3>${escapeHTML(first.title)}</h3>
        <p>
          ${escapeHTML(first.excerpt)}
        </p>
      `;

      data.results.forEach(item => {

        const card = document.createElement("a");

        card.className = "result-card";

        card.href = item.url;

        card.target = "_blank";

        card.rel = "noopener noreferrer";

        card.innerHTML = `
          <h3>${escapeHTML(item.title)}</h3>

          <div class="description">
            ${escapeHTML(item.description)}
          </div>

          <div class="excerpt">
            ${escapeHTML(item.excerpt)}
          </div>

          <span class="result-url">
            ${escapeHTML(item.url)}
          </span>
        `;

        results.appendChild(card);
      });

      googleFallback.classList.remove("hidden");
      googleLink.href = data.googleURL;

    } else {

      answerBox.classList.remove("hidden");

      answerBox.innerHTML = `
        <div class="answer-label">NEXUS</div>
        <h3>No direct answer found</h3>
        <p>
          NEXUS couldn't find a useful result in its
          current knowledge source.
        </p>
      `;

      googleFallback.classList.remove("hidden");

      googleLink.href = data.googleURL;
    }

  } catch (error) {

    console.error(error);

    showError(
      error.message ||
      "An unexpected error occurred.",
      `https://www.google.com/search?q=${encodeURIComponent(query)}`
    );

  } finally {
    setLoading(false);
  }
}

searchForm.addEventListener("submit", event => {
  event.preventDefault();

  search(searchInput.value);
});

quickButtons.forEach(button => {
  button.addEventListener("click", () => {
    searchInput.value = button.dataset.query;

    searchForm.requestSubmit();
  });
});

clearButton.addEventListener("click", () => {
  resultsSection.classList.add("hidden");

  answerBox.classList.add("hidden");

  results.innerHTML = "";

  searchInput.focus();
});

themeButton.addEventListener("click", () => {
  document.body.classList.toggle("light");

  localStorage.setItem(
    "nexus-theme",
    document.body.classList.contains("light")
      ? "light"
      : "dark"
  );
});

if (localStorage.getItem("nexus-theme") === "light") {
  document.body.classList.add("light");
}

renderHistory();

searchInput.focus();
