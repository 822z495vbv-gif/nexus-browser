"use strict";

/*
|--------------------------------------------------------------------------
| NEXUS FRONTEND
|--------------------------------------------------------------------------
| Clean client-side application.
| No external JavaScript libraries.
|--------------------------------------------------------------------------
*/

const $ = (selector) => document.querySelector(selector);

const searchForm = $("#searchForm");
const searchInput = $("#searchInput");
const searchButton = $("#searchButton");
const searchButtonText = $("#searchButtonText");
const searchSpinner = $("#searchSpinner");
const clearSearch = $("#clearSearch");

const searchView = $("#searchView");
const historyView = $("#historyView");
const savedView = $("#savedView");

const resultsSection = $("#resultsSection");
const resultsCount = $("#resultsCount");
const answerBox = $("#answerBox");
const resultsList = $("#resultsList");
const fallbackBox = $("#fallbackBox");

const historyList = $("#historyList");
const savedList = $("#savedList");

const themeButton = $("#themeButton");
const profileButton = $("#profileButton");

const profileModal = $("#profileModal");
const settingsModal = $("#settingsModal");

const profileNameInput = $("#profileName");
const profileSave = $("#profileSave");

const profileAvatar = $("#profileAvatar");
const topAvatar = $("#topAvatar");

const appearanceSelect = $("#appearanceSelect");
const clearHistoryButton = $("#clearHistoryButton");

const sidebar = $("#sidebar");
const sidebarOverlay = $("#sidebarOverlay");
const mobileMenuButton = $("#mobileMenuButton");
const closeSidebarButton = $("#closeSidebarButton");

const navButtons =
  document.querySelectorAll("[data-view]");

const suggestionButtons =
  document.querySelectorAll(".suggestion");

const STORAGE_KEYS = {
  history: "nexus_history",
  saved: "nexus_saved",
  profile: "nexus_profile",
  theme: "nexus_theme"
};

/*
|--------------------------------------------------------------------------
| STORAGE
|--------------------------------------------------------------------------
*/

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);

    return parsed;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    console.warn(
      "NEXUS could not save local data."
    );
  }
}

let history = readStorage(
  STORAGE_KEYS.history,
  []
);

let saved = readStorage(
  STORAGE_KEYS.saved,
  []
);

let profile = readStorage(
  STORAGE_KEYS.profile,
  {
    name: "NEXUS User"
  }
);

if (!Array.isArray(history)) {
  history = [];
}

if (!Array.isArray(saved)) {
  saved = [];
}

if (
  !profile ||
  typeof profile !== "object"
) {
  profile = {
    name: "NEXUS User"
  };
}

/*
|--------------------------------------------------------------------------
| SAFE HTML
|--------------------------------------------------------------------------
*/

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeURL(value) {
  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return "#";
    }

    return url.href;
  } catch {
    return "#";
  }
}

/*
|--------------------------------------------------------------------------
| THEME
|--------------------------------------------------------------------------
*/

function applyTheme(theme) {
  const selected =
    theme === "light"
      ? "light"
      : "dark";

  document.documentElement.dataset.theme =
    selected;

  document.documentElement.classList.toggle(
    "light",
    selected === "light"
  );

  writeStorage(
    STORAGE_KEYS.theme,
    selected
  );

  if (appearanceSelect) {
    appearanceSelect.value =
      selected;
  }

  if (themeButton) {
    themeButton.textContent =
      selected === "dark"
        ? "☀️"
        : "🌙";
  }
}

applyTheme(
  localStorage.getItem(
    STORAGE_KEYS.theme
  ) || "dark"
);

themeButton?.addEventListener(
  "click",
  () => {
    const current =
      document.documentElement.dataset.theme;

    applyTheme(
      current === "dark"
        ? "light"
        : "dark"
    );
  }
);

/*
|--------------------------------------------------------------------------
| PROFILE
|--------------------------------------------------------------------------
*/

function updateProfile() {
  const name =
    String(profile.name || "NEXUS User")
      .trim()
      .slice(0, 40) ||
    "NEXUS User";

  profile.name = name;

  const firstLetter =
    name.charAt(0).toUpperCase();

  if (profileNameInput) {
    profileNameInput.value =
      name;
  }

  if (profileAvatar) {
    profileAvatar.textContent =
      firstLetter;
  }

  if (topAvatar) {
    topAvatar.textContent =
      firstLetter;
  }
}

updateProfile();

profileButton?.addEventListener(
  "click",
  () => {
    updateProfile();
    openModal(profileModal);
  }
);

profileSave?.addEventListener(
  "click",
  () => {
    const name =
      profileNameInput?.value
        .trim()
        .slice(0, 40) ||
      "NEXUS User";

    profile = {
      name
    };

    writeStorage(
      STORAGE_KEYS.profile,
      profile
    );

    updateProfile();

    closeModal(profileModal);
  }
);

/*
|--------------------------------------------------------------------------
| MODALS
|--------------------------------------------------------------------------
*/

function openModal(modal) {
  if (!modal) return;

  modal.classList.add("open");

  modal.setAttribute(
    "aria-hidden",
    "false"
  );
}

function closeModal(modal) {
  if (!modal) return;

  modal.classList.remove("open");

  modal.setAttribute(
    "aria-hidden",
    "true"
  );
}

document
  .querySelectorAll("[data-close-modal]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        closeModal(
          button.closest(".modal")
        );
      }
    );
  });

document
  .querySelectorAll(".modal")
  .forEach((modal) => {
    modal.addEventListener(
      "click",
      (event) => {
        if (
          event.target === modal
        ) {
          closeModal(modal);
        }
      }
    );
  });

/*
|--------------------------------------------------------------------------
| SETTINGS
|--------------------------------------------------------------------------
*/

document
  .querySelector("[data-open-settings]")
  ?.addEventListener(
    "click",
    () => {
      openModal(settingsModal);
    }
  );

appearanceSelect?.addEventListener(
  "change",
  () => {
    applyTheme(
      appearanceSelect.value
    );
  }
);

clearHistoryButton?.addEventListener(
  "click",
  () => {
    history = [];

    writeStorage(
      STORAGE_KEYS.history,
      history
    );

    renderHistory();

    clearHistoryButton.textContent =
      "Cleared";

    setTimeout(() => {
      clearHistoryButton.textContent =
        "Clear History";
    }, 1200);
  }
);

/*
|--------------------------------------------------------------------------
| SIDEBAR
|--------------------------------------------------------------------------
*/

function openSidebar() {
  sidebar?.classList.add("open");
  sidebarOverlay?.classList.add("open");
}

function closeSidebar() {
  sidebar?.classList.remove("open");
  sidebarOverlay?.classList.remove("open");
}

mobileMenuButton?.addEventListener(
  "click",
  openSidebar
);

closeSidebarButton?.addEventListener(
  "click",
  closeSidebar
);

sidebarOverlay?.addEventListener(
  "click",
  closeSidebar
);

/*
|--------------------------------------------------------------------------
| VIEWS
|--------------------------------------------------------------------------
*/

function showView(view) {
  searchView?.classList.toggle(
    "hidden",
    view !== "search"
  );

  historyView?.classList.toggle(
    "hidden",
    view !== "history"
  );

  savedView?.classList.toggle(
    "hidden",
    view !== "saved"
  );

  navButtons.forEach(
    (button) => {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    }
  );

  if (view === "history") {
    renderHistory();
  }

  if (view === "saved") {
    renderSaved();
  }

  closeSidebar();
}

navButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        showView(
          button.dataset.view
        );
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| LOADING
|--------------------------------------------------------------------------
*/

function setLoading(isLoading) {
  if (searchButton) {
    searchButton.disabled =
      isLoading;
  }

  if (searchSpinner) {
    searchSpinner.classList.toggle(
      "hidden",
      !isLoading
    );
  }

  if (searchButtonText) {
    searchButtonText.textContent =
      isLoading
        ? "Searching..."
        : "Search";
  }
}

/*
|--------------------------------------------------------------------------
| HISTORY
|--------------------------------------------------------------------------
*/

function addHistory(query) {
  const clean =
    String(query)
      .trim()
      .replace(/\s+/g, " ");

  if (!clean) {
    return;
  }

  history = history.filter(
    (item) =>
      item.toLowerCase() !==
      clean.toLowerCase()
  );

  history.unshift(clean);

  history =
    history.slice(0, 50);

  writeStorage(
    STORAGE_KEYS.history,
    history
  );
}

function renderHistory() {
  if (!historyList) {
    return;
  }

  if (!history.length) {
    historyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◷</div>
        <h3>No search history</h3>
        <p>Your recent searches will appear here.</p>
      </div>
    `;

    return;
  }

  historyList.innerHTML =
    history
      .map(
        (query) => `
          <button
            class="history-item"
            type="button"
            data-history-index="${history.indexOf(query)}"
          >
            <span class="history-icon">⌕</span>

            <span class="history-query">
              ${escapeHTML(query)}
            </span>

            <span class="history-arrow">
              →
            </span>
          </button>
        `
      )
      .join("");

  historyList
    .querySelectorAll(
      "[data-history-index]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const index =
              Number(
                button.dataset
                  .historyIndex
              );

            const query =
              history[index];

            if (!query) return;

            searchInput.value =
              query;

            showView("search");

            performSearch(query);
          }
        );
      }
    );
}

/*
|--------------------------------------------------------------------------
| SAVED
|--------------------------------------------------------------------------
*/

function isSaved(query) {
  return saved.some(
    (item) =>
      item.toLowerCase() ===
      query.toLowerCase()
  );
}

function toggleSaved(query) {
  if (isSaved(query)) {
    saved = saved.filter(
      (item) =>
        item.toLowerCase() !==
        query.toLowerCase()
    );
  } else {
    saved.unshift(query);
  }

  saved =
    saved.slice(0, 50);

  writeStorage(
    STORAGE_KEYS.saved,
    saved
  );

  renderSaved();

  document
    .querySelectorAll(
      ".save-result"
    )
    .forEach(
      (button) => {
        if (
          button.dataset.query ===
          query
        ) {
          updateSaveButton(
            button,
            query
          );
        }
      }
    );
}

function updateSaveButton(
  button,
  query
) {
  const state =
    isSaved(query);

  button.classList.toggle(
    "saved",
    state
  );

  button.textContent =
    state
      ? "★ Saved"
      : "☆ Save";
}

function renderSaved() {
  if (!savedList) {
    return;
  }

  if (!saved.length) {
    savedList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">☆</div>
        <h3>No saved searches</h3>
        <p>Save searches to quickly access them later.</p>
      </div>
    `;

    return;
  }

  savedList.innerHTML =
    saved
      .map(
        (query, index) => `
          <div class="saved-item">

            <button
              class="saved-open"
              type="button"
              data-saved-index="${index}"
            >
              <span class="saved-icon">
                ★
              </span>

              <span>
                ${escapeHTML(query)}
              </span>
            </button>

            <button
              class="saved-remove"
              type="button"
              data-remove-index="${index}"
              aria-label="Remove saved search"
            >
              ×
            </button>

          </div>
        `
      )
      .join("");

  savedList
    .querySelectorAll(
      "[data-saved-index]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const index =
              Number(
                button.dataset
                  .savedIndex
              );

            const query =
              saved[index];

            if (!query) return;

            searchInput.value =
              query;

            showView("search");

            performSearch(query);
          }
        );
      }
    );

  savedList
    .querySelectorAll(
      "[data-remove-index]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const index =
              Number(
                button.dataset
                  .removeIndex
              );

            const query =
              saved[index];

            if (!query) return;

            saved =
              saved.filter(
                (_, i) =>
                  i !== index
              );

            writeStorage(
              STORAGE_KEYS.saved,
              saved
            );

            renderSaved();
          }
        );
      }
    );
}

/*
|--------------------------------------------------------------------------
| RESULTS
|--------------------------------------------------------------------------
*/

function renderResults(data) {
  if (!resultsList) {
    return;
  }

  const results =
    Array.isArray(data.results)
      ? data.results
      : [];

  if (resultsCount) {
    resultsCount.textContent =
      `${results.length} result${
        results.length === 1
          ? ""
          : "s"
      }`;
  }

  if (
    answerBox &&
    results.length > 0
  ) {
    const first =
      results[0];

    answerBox.innerHTML = `
      <div class="answer-label">
        NEXUS ANSWER
      </div>

      <h2>
        ${escapeHTML(
          first.title ||
          "Information found"
        )}
      </h2>

      <p>
        ${escapeHTML(
          first.description ||
          first.excerpt ||
          "Information found."
        )}
      </p>
    `;

    answerBox.classList.remove(
      "hidden"
    );
  }

  resultsList.innerHTML =
    results
      .map(
        (result) => {
          const title =
            result.title ||
            "Untitled";

          const description =
            result.description ||
            "No description available.";

          const excerpt =
            result.excerpt ||
            "";

          const url =
            safeURL(
              result.url
            );

          const query =
            String(
              data.query || ""
            );

          const savedState =
            isSaved(query);

          return `
            <article class="result-card">

              <div class="result-top">

                <div class="result-source">
                  <span class="source-dot"></span>
                  Wikipedia
                </div>

                <button
                  class="save-result ${
                    savedState
                      ? "saved"
                      : ""
                  }"
                  type="button"
                  data-query="${escapeHTML(
                    query
                  )}"
                >
                  ${
                    savedState
                      ? "★ Saved"
                      : "☆ Save"
                  }
                </button>

              </div>

              <h3>
                ${escapeHTML(title)}
              </h3>

              <p class="result-description">
                ${escapeHTML(
                  description
                )}
              </p>

              ${
                excerpt
                  ? `
                    <p class="result-excerpt">
                      ${escapeHTML(
                        excerpt
                      )}
                    </p>
                  `
                  : ""
              }

              <div class="result-bottom">

                <a
                  class="result-link"
                  href="${url}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source
                  <span>↗</span>
                </a>

              </div>

            </article>
          `;
        }
      )
      .join("");

  resultsList
    .querySelectorAll(
      ".save-result"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const query =
              button.dataset.query;

            toggleSaved(query);
          }
        );
      }
    );
}

/*
|--------------------------------------------------------------------------
| GOOGLE FALLBACK
|--------------------------------------------------------------------------
*/

function renderFallback(data) {
  if (!fallbackBox) {
    return;
  }

  if (!data.googleURL) {
    fallbackBox.classList.add(
      "hidden"
    );

    return;
  }

  const url =
    safeURL(
      data.googleURL
    );

  fallbackBox.innerHTML = `
    <div class="fallback-content">

      <div class="fallback-icon">
        ↗
      </div>

      <div>
        <strong>
          Need broader results?
        </strong>

        <p>
          NEXUS could not find enough
          information in its current search index.
        </p>
      </div>

      <a
        class="fallback-button"
        href="${url}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Continue to Google
        ↗
      </a>

    </div>
  `;

  fallbackBox.classList.remove(
    "hidden"
  );
}

/*
|--------------------------------------------------------------------------
| SEARCH
|--------------------------------------------------------------------------
*/

async function performSearch(query) {
  const cleanQuery =
    String(query || "")
      .trim()
      .replace(/\s+/g, " ");

  if (!cleanQuery) {
    searchInput?.focus();
    return;
  }

  showView("search");

  addHistory(
    cleanQuery
  );

  setLoading(true);

  resultsSection?.classList.add(
    "visible"
  );

  answerBox?.classList.add(
    "hidden"
  );

  fallbackBox?.classList.add(
    "hidden"
  );

  if (resultsList) {
    resultsList.innerHTML = `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <span>
          Searching the NEXUS...
        </span>
      </div>
    `;
  }

  try {
    const response =
      await fetch(
        `/api/search?q=${encodeURIComponent(
          cleanQuery
        )}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.ok
    ) {
      throw new Error(
        data.error ||
        "Search failed."
      );
    }

    if (
      data.found &&
      Array.isArray(
        data.results
      ) &&
      data.results.length > 0
    ) {
      renderResults(data);
    } else {
      if (resultsCount) {
        resultsCount.textContent =
          "0 results";
      }

      if (answerBox) {
        answerBox.innerHTML = `
          <div class="answer-label">
            NO STRONG MATCH
          </div>

          <h2>
            Nothing useful was found
          </h2>

          <p>
            NEXUS could not find a strong
            result for
            <strong>
              ${escapeHTML(
                cleanQuery
              )}
            </strong>.
          </p>
        `;

        answerBox.classList.remove(
          "hidden"
        );
      }

      if (resultsList) {
        resultsList.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">⌕</div>

            <h3>
              No results found
            </h3>

            <p>
              Try a different search query.
            </p>
          </div>
        `;
      }
    }

    renderFallback(data);

  } catch (error) {
    console.error(
      "NEXUS search error:",
      error
    );

    if (resultsList) {
      resultsList.innerHTML = `
        <div class="empty-state">

          <div class="empty-icon">
            !
          </div>

          <h3>
            Search unavailable
          </h3>

          <p>
            NEXUS could not reach the search service.
          </p>

          <button
            id="retrySearch"
            class="retry-button"
            type="button"
          >
            Try again
          </button>

        </div>
      `;

      $("#retrySearch")?.addEventListener(
        "click",
        () => {
          performSearch(
            cleanQuery
          );
        }
      );
    }
  } finally {
    setLoading(false);
  }
}

/*
|--------------------------------------------------------------------------
| SEARCH EVENTS
|--------------------------------------------------------------------------
*/

searchForm?.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();

    performSearch(
      searchInput.value
    );
  }
);

clearSearch?.addEventListener(
  "click",
  () => {
    searchInput.value = "";

    clearSearch.classList.add(
      "hidden"
    );

    searchInput.focus();
  }
);

searchInput?.addEventListener(
  "input",
  () => {
    clearSearch?.classList.toggle(
      "hidden",
      !searchInput.value
    );
  }
);

/*
|--------------------------------------------------------------------------
| SUGGESTIONS
|--------------------------------------------------------------------------
*/

suggestionButtons.forEach(
  (button) => {
    button.addEventListener(
      "click",
      () => {
        const query =
          button.dataset.query ||
          button.textContent.trim();

        searchInput.value =
          query;

        clearSearch?.classList.remove(
          "hidden"
        );

        performSearch(query);
      }
    );
  }
);

/*
|--------------------------------------------------------------------------
| KEYBOARD
|--------------------------------------------------------------------------
*/

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "/" &&
      document.activeElement !==
        searchInput &&
      document.activeElement?.tagName !==
        "INPUT" &&
      document.activeElement?.tagName !==
        "TEXTAREA"
    ) {
      event.preventDefault();

      searchInput?.focus();
    }

    if (
      event.key === "Escape"
    ) {
      closeModal(profileModal);
      closeModal(settingsModal);
      closeSidebar();
    }

  }
);

/*
|--------------------------------------------------------------------------
| INITIALIZE
|--------------------------------------------------------------------------
*/

renderHistory();
renderSaved();
showView("search");

console.log(
  "NEXUS frontend loaded successfully."
);
