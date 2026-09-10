const resultsTitle = document.getElementById("resultsTitle");
const results = document.getElementById("results");

const answerBox = document.getElementById("answerBox");

const googleFallback =
  document.getElementById("googleFallback");

const googleLink =
  document.getElementById("googleLink");

const clearButton =
  document.getElementById("clearButton");

const themeButton =
  document.getElementById("themeButton");

const modalThemeButton =
  document.getElementById("modalThemeButton");

const menuButton =
  document.getElementById("menuButton");

const closeSidebar =
  document.getElementById("closeSidebar");

const sidebar =
  document.getElementById("sidebar");

const sidebarOverlay =
  document.getElementById("sidebarOverlay");

const profileButton =
  document.getElementById("profileButton");

const topProfileButton =
  document.getElementById("topProfileButton");

const profileModal =
  document.getElementById("profileModal");

const settingsModal =
  document.getElementById("settingsModal");

const settingsButton =
  document.getElementById("settingsButton");

const profileInput =
  document.getElementById("profileInput");

const saveProfile =
  document.getElementById("saveProfile");

const profileName =
  document.getElementById("profileName");

const profileEmail =
  document.getElementById("profileEmail");

const profileAvatar =
  document.getElementById("profileAvatar");

const clearHistory =
  document.getElementById("clearHistory");

const fullHistory =
  document.getElementById("fullHistory");

const savedContainer =
  document.getElementById("savedContainer");

const searchView =
  document.getElementById("searchView");

const historyView =
  document.getElementById("historyView");

const savedView =
  document.getElementById("savedView");

const navItems =
  document.querySelectorAll(".nav-item");

const suggestionButtons =
  document.querySelectorAll(".suggestions button");


/* =========================================
   LOCAL DATA
========================================= */

let history = JSON.parse(
  localStorage.getItem("nexus-history") || "[]"
);

let profile = JSON.parse(
  localStorage.getItem("nexus-profile") || "null"
);

let saved = JSON.parse(
  localStorage.getItem("nexus-saved") || "[]"
);


/* =========================================
   HELPERS
========================================= */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


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


function updateClearButton() {
  if (searchInput.value.trim()) {
    clearInput.classList.remove("hidden");
  } else {
    clearInput.classList.add("hidden");
  }
}


function getInitial(name) {
  return (
    String(name || "G")
      .trim()
      .charAt(0)
      .toUpperCase() || "G"
  );
}


/* =========================================
   PROFILE
========================================= */

function renderProfile() {
  const name = profile?.name || "Guest";
  const initial = getInitial(name);

  profileName.textContent = name;
  profileEmail.textContent = "Local profile";

  profileAvatar.textContent = initial;
  topProfileButton.textContent = initial;
}


function openProfile() {
  profileInput.value = profile?.name || "";

  profileModal.classList.remove("hidden");

  setTimeout(() => {
    profileInput.focus();
  }, 50);
}


function saveUserProfile() {
  const name = profileInput.value.trim();

  if (!name) {
    profile = null;

    localStorage.removeItem(
      "nexus-profile"
    );
  } else {
    profile = {
      name
    };

    localStorage.setItem(
      "nexus-profile",
      JSON.stringify(profile)
    );
  }

  renderProfile();

  profileModal.classList.add("hidden");
}


profileButton.addEventListener(
  "click",
  openProfile
);


topProfileButton.addEventListener(
  "click",
  openProfile
);


saveProfile.addEventListener(
  "click",
  saveUserProfile
);


/* =========================================
   MODALS
========================================= */

function openModal(modal) {
  modal.classList.remove("hidden");
}


function closeModals() {
  profileModal.classList.add("hidden");
  settingsModal.classList.add("hidden");
}


document
  .querySelectorAll("[data-close-modal]")
  .forEach(button => {
    button.addEventListener(
      "click",
      closeModals
    );
  });


document
  .querySelectorAll(".modal-backdrop")
  .forEach(backdrop => {
    backdrop.addEventListener(
      "click",
      closeModals
    );
  });


settingsButton.addEventListener(
  "click",
  () => {
    openModal(settingsModal);
  }
);


/* =========================================
   THEME
========================================= */

function setTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light");

    localStorage.setItem(
      "nexus-theme",
      "light"
    );
  } else {
    document.body.classList.remove("light");

    localStorage.setItem(
      "nexus-theme",
      "dark"
    );
  }
}


function toggleTheme() {
  const isLight =
    document.body.classList.contains("light");

  setTheme(
    isLight ? "dark" : "light"
  );
}


themeButton.addEventListener(
  "click",
  toggleTheme
);


modalThemeButton.addEventListener(
  "click",
  toggleTheme
);


if (
  localStorage.getItem("nexus-theme") ===
  "light"
) {
  setTheme("light");
}


/* =========================================
   SIDEBAR
========================================= */

function closeMenu() {
  sidebar.classList.remove("open");
}


menuButton.addEventListener(
  "click",
  () => {
    sidebar.classList.add("open");
  }
);


closeSidebar.addEventListener(
  "click",
  closeMenu
);


sidebarOverlay.addEventListener(
  "click",
  closeMenu
);


/* =========================================
   NAVIGATION
========================================= */

function switchView(section) {
  searchView.classList.add("hidden");
  historyView.classList.add("hidden");
  savedView.classList.add("hidden");

  navItems.forEach(item => {
    item.classList.remove("active");
  });

  const selected =
    document.querySelector(
      `[data-section="${section}"]`
    );

  if (selected) {
    selected.classList.add("active");
  }

  if (section === "search") {
    searchView.classList.remove("hidden");
  }

  if (section === "history") {
    historyView.classList.remove("hidden");
    renderFullHistory();
  }

  if (section === "saved") {
    savedView.classList.remove("hidden");
    renderSaved();
  }

  closeMenu();
}


navItems.forEach(item => {
  item.addEventListener(
    "click",
    () => {
      const section = item.dataset.section;

      if (section) {
        switchView(section);
      }
    }
  );
});


/* =========================================
   HISTORY
========================================= */

function saveHistory(query) {
  history = [
    query,
    ...history.filter(
      item => item !== query
    )
  ].slice(0, 30);

  localStorage.setItem(
    "nexus-history",
    JSON.stringify(history)
  );
}


function renderFullHistory() {
  if (!history.length) {
    fullHistory.innerHTML = `
      <div class="empty-workspace">
        <div class="empty-icon">◷</div>

        <h3>No search history</h3>

        <p>
          Searches you make will appear here.
        </p>
      </div>
    `;

    return;
  }

  fullHistory.innerHTML =
    history
      .map((query, index) => `
        <button
          class="history-item"
          data-query="${escapeHTML(query)}"
          type="button"
        >
          <small>
            SEARCH
            ${String(index + 1).padStart(2, "0")}
          </small>

          <strong>
            ${escapeHTML(query)}
          </strong>
        </button>
      `)
      .join("");

  fullHistory
    .querySelectorAll(".history-item")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const query =
            button.dataset.query;

          searchInput.value = query;

          updateClearButton();

          switchView("search");

          search(query);
        }
      );
    });
}


/* =========================================
   SAVED SEARCHES
========================================= */

function isSaved(query) {
  return saved.includes(query);
}


function saveSearch(query) {
  if (!query) return;

  if (!saved.includes(query)) {
    saved.unshift(query);
  }

  saved =
    saved.slice(0, 30);

  localStorage.setItem(
    "nexus-saved",
    JSON.stringify(saved)
  );

  renderSaved();
}


function removeSavedSearch(query) {
  saved =
    saved.filter(
      item => item !== query
    );

  localStorage.setItem(
    "nexus-saved",
    JSON.stringify(saved)
  );

  renderSaved();
}


function toggleSaved(query) {
  if (isSaved(query)) {
    removeSavedSearch(query);
  } else {
    saveSearch(query);
  }

  updateSaveButtons(query);
}


function updateSaveButtons(query) {
  document
    .querySelectorAll(
      `[data-save-query="${CSS.escape(query)}"]`
    )
    .forEach(button => {
      const savedNow =
        isSaved(query);

      button.textContent =
        savedNow
          ? "★ Saved"
          : "☆ Save";

      button.classList.toggle(
        "saved",
        savedNow
      );
    });
}


function renderSaved() {
  if (!saved.length) {
    savedContainer.innerHTML = `
      <div class="empty-icon">☆</div>

      <h3>No saved searches</h3>

      <p>
        Save searches here when you find
        something worth keeping.
      </p>
    `;

    return;
  }

  savedContainer.innerHTML =
    saved
      .map(query => `
        <button
          class="history-item"
          data-saved="${escapeHTML(query)}"
          type="button"
        >
          <small>SAVED</small>

          <strong>
            ${escapeHTML(query)}
          </strong>
        </button>
      `)
      .join("");

  savedContainer
    .querySelectorAll("[data-saved]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const query =
            button.dataset.saved;

          searchInput.value = query;

          updateClearButton();

          switchView("search");

          search(query);
        }
      );
    });
}


/* =========================================
   SEARCH
========================================= */

async function search(query) {
  query = query.trim();

  if (!query) {
    searchInput.focus();
    return;
  }

  setLoading(true);

  resultsSection.classList.remove(
    "hidden"
  );

  resultsTitle.textContent = query;

  answerBox.classList.add(
    "hidden"
  );

  googleFallback.classList.add(
    "hidden"
  );

  results.innerHTML = `
    <div class="ai-card">
      <div class="answer-label">
        NEXUS
      </div>

      <h3>
        Searching the knowledge layer...
      </h3>

      <p>
        Finding relevant information.
      </p>
    </div>
  `;

  saveHistory(query);

  try {
    const response =
      await fetch(
        `/api/search?q=${encodeURIComponent(query)}`
      );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The server returned an invalid response."
      );
    }

    if (
      !response.ok ||
      !data.ok
    ) {
      throw new Error(
        data.error ||
        "Search failed."
      );
    }

    results.innerHTML = "";

    if (
      data.found &&
      Array.isArray(data.results) &&
      data.results.length
    ) {
      const first =
        data.results[0];

      answerBox.classList.remove(
        "hidden"
      );

      answerBox.innerHTML = `
        <div class="answer-label">
          ✦ NEXUS QUICK ANSWER
        </div>

        <h3>
          ${escapeHTML(first.title)}
        </h3>

        <p>
          ${escapeHTML(first.excerpt)}
        </p>
      `;

      data.results.forEach(item => {
        const card =
          document.createElement("div");

        card.className =
          "result-card";

        const title =
          escapeHTML(item.title);

        const description =
          escapeHTML(item.description);

        const excerpt =
          escapeHTML(item.excerpt);

        const url =
          escapeHTML(item.url);

        const queryAttribute =
          escapeHTML(query);

        card.innerHTML = `
          <a
            href="${url}"
            target="_blank"
            rel="noopener noreferrer"
            class="result-link"
          >
            <h3>
              ${title}
            </h3>

            <div class="description">
              ${description}
            </div>

            <div class="excerpt">
              ${excerpt}
            </div>

            <span class="result-url">
              ${url}
            </span>
          </a>

          <div class="result-actions">

            <button
              class="save-result"
              data-save-query="${queryAttribute}"
              type="button"
            >
              ${
                isSaved(query)
                  ? "★ Saved"
                  : "☆ Save"
              }
            </button>

          </div>
        `;

        const saveButton =
          card.querySelector(".save-result");

        if (isSaved(query)) {
          saveButton.classList.add(
            "saved"
          );
        }

        saveButton.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            toggleSaved(query);
          }
        );

        results.appendChild(card);
      });

      googleFallback.classList.remove(
        "hidden"
      );

      googleLink.href =
        data.googleURL;
    } else {
      answerBox.classList.remove(
        "hidden"
      );

      answerBox.innerHTML = `
        <div class="answer-label">
          NEXUS
        </div>

        <h3>
          No direct answer found
        </h3>

        <p>
          NEXUS couldn't find a useful
          result in its current sources.
        </p>
      `;

      googleFallback.classList.remove(
        "hidden"
      );

      googleLink.href =
        data.googleURL;
    }
  } catch (error) {
    console.error(
      "NEXUS search error:",
      error
    );

    answerBox.classList.remove(
      "hidden"
    );

    answerBox.innerHTML = `
      <div class="answer-label">
        NEXUS
      </div>

      <h3>
        Search temporarily unavailable
      </h3>

      <p>
        ${escapeHTML(
          error.message ||
          "Something went wrong."
        )}
      </p>
    `;

    results.innerHTML = "";

    googleFallback.classList.remove(
      "hidden"
    );

    googleLink.href =
      `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  } finally {
    setLoading(false);
  }
}


/* =========================================
   SEARCH EVENTS
========================================= */

searchForm.addEventListener(
  "submit",
  event => {
    event.preventDefault();

    search(
      searchInput.value
    );
  }
);


searchInput.addEventListener(
  "input",
  updateClearButton
);


clearInput.addEventListener(
  "click",
  () => {
    searchInput.value = "";

    updateClearButton();

    searchInput.focus();
  }
);


clearButton.addEventListener(
  "click",
  () => {
    resultsSection.classList.add(
      "hidden"
    );

    answerBox.classList.add(
      "hidden"
    );

    googleFallback.classList.add(
      "hidden"
    );

    results.innerHTML = "";

    searchInput.focus();
  }
);


suggestionButtons.forEach(
  button => {
    button.addEventListener(
      "click",
      () => {
        const query =
          button.dataset.query;

        searchInput.value = query;

        updateClearButton();

        search(query);
      }
    );
  }
);


/* =========================================
   CLEAR HISTORY
========================================= */

clearHistory.addEventListener(
  "click",
  () => {
    history = [];

    localStorage.removeItem(
      "nexus-history"
    );

    renderFullHistory();
  }
);


/* =========================================
   KEYBOARD
========================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "/" &&
      document.activeElement !== searchInput &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();

      searchInput.focus();
    }

    if (
      event.key === "Escape"
    ) {
      closeModals();
      closeMenu();
    }

    if (
      event.key === "Enter" &&
      document.activeElement === profileInput
    ) {
      event.preventDefault();

      saveUserProfile();
    }
  }
);


/* =========================================
   INIT
========================================= */

renderProfile();
renderFullHistory();
renderSaved();
updateClearButton();

searchInput.focus();
