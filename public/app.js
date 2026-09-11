/* =========================================================
   NEXUS APP.JS
   Complete frontend controller
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* =======================================================
     DOM HELPERS
     ======================================================= */

  const $ = (selector) =>
    document.querySelector(selector);

  const $$ = (selector) =>
    [...document.querySelectorAll(selector)];

  /* =======================================================
     ELEMENTS
     ======================================================= */

  const authScreen = $("#authScreen");
  const app = $("#app");

  const loginBox = $("#loginBox");
  const registerBox = $("#registerBox");

  const loginForm = $("#loginForm");
  const loginUsername = $("#loginUsername");
  const loginPassword = $("#loginPassword");
  const loginError = $("#loginError");
  const loginBtn = $("#loginBtn");

  const registerForm = $("#registerForm");
  const registerUsername = $("#registerUsername");
  const registerPassword = $("#registerPassword");
  const confirmPassword = $("#confirmPassword");
  const registerError = $("#registerError");
  const registerBtn = $("#registerBtn");

  const showRegister = $("#showRegister");
  const showLogin = $("#showLogin");

  const strengthBar = $("#strengthBar");
  const strengthText = $("#strengthText");

  const searchForm = $("#searchForm");
  const searchInput = $("#searchInput");
  const clearBtn = $("#clearBtn");
  const suggestions = $("#suggestions");

  const searchTabs = $("#searchTabs");
  const tabs = $$(".tab");

  const spinner = $("#spinner");
  const searchText = $("#searchText");
  const results = $("#results");

  const historyList = $("#historyList");
  const clearHistoryBtn = $("#clearHistoryBtn");

  const savedList = $("#savedList");
  const clearSavedBtn = $("#clearSavedBtn");

  const themeBtn = $("#themeBtn");

  const settingsAccount = $("#settingsAccount");
  const settingsLogout = $("#settingsLogout");

  const profileBtn = $("#profileBtn");
  const accountMenu = $("#accountMenu");
  const accountLogout = $("#accountLogout");

  const accountInitial = $("#accountInitial");
  const profileInitial = $("#profileInitial");
  const accountAvatar = $("#accountAvatar");

  const accountName = $("#accountName");
  const accountName2 = $("#accountName2");
  const accountMenuName = $("#accountMenuName");

  const menuBtn = $("#menuBtn");
  const sidebar = $("#sidebar");
  const overlay = $("#overlay");

  const adminNav = $("#adminNav");

  const adminStatusText = $("#adminStatusText");
  const adminStatusBadge = $("#adminStatusBadge");
  const adminUsers = $("#adminUsers");
  const adminSessions = $("#adminSessions");

  const maintenanceTitle = $("#maintenanceTitle");
  const maintenanceMessage = $("#maintenanceMessage");

  const lockWebsite = $("#lockWebsite");
  const unlockWebsite = $("#unlockWebsite");
  const adminMessage = $("#adminMessage");

  /* =======================================================
     STATE
     ======================================================= */

  const state = {
    user: null,
    tab: "web",
    query: "",
    results: [],
    requestId: 0,
    controller: null,
    loggedOut: false,
    currentView: "search",
    theme: "dark",
    booted: false
  };

  /* =======================================================
     BASIC HELPERS
     ======================================================= */

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
      const url = new URL(String(value));

      if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
      ) {
        return null;
      }

      return url.toString();
    } catch {
      return null;
    }
  }

  function initials(username) {
    const value = String(username || "N")
      .trim();

    if (!value) {
      return "N";
    }

    return value
      .slice(0, 2)
      .toUpperCase();
  }

  function setText(element, text) {
    if (element) {
      element.textContent = text;
    }
  }

  function show(element) {
    if (element) {
      element.classList.remove("hidden");
    }
  }

  function hide(element) {
    if (element) {
      element.classList.add("hidden");
    }
  }

  function setButtonLoading(
    button,
    loading,
    normalText
  ) {
    if (!button) {
      return;
    }

    button.disabled = loading;

    if (loading) {
      button.dataset.originalText =
        button.textContent;

      button.textContent =
        "Please wait...";
    } else {
      button.textContent =
        normalText ||
        button.dataset.originalText ||
        button.textContent;

      delete button.dataset.originalText;
    }
  }

  function setError(element, message) {
    if (!element) {
      return;
    }

    element.textContent =
      message || "";

    element.classList.toggle(
      "visible",
      Boolean(message)
    );
  }

  /* =======================================================
     API
     ======================================================= */

  async function api(
    url,
    options = {}
  ) {
    const config = {
      credentials: "same-origin",
      ...options
    };

    if (
      config.body &&
      typeof config.body !== "string"
    ) {
      config.headers = {
        ...(config.headers || {}),
        "Content-Type":
          "application/json"
      };

      config.body =
        JSON.stringify(config.body);
    }

    const response =
      await fetch(
        url,
        config
      );

    let data = null;

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      try {
        data =
          await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        data =
          await response.text();
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const error =
        new Error(
          data?.error ||
          `Request failed (${response.status})`
        );

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }

    return data;
  }

  /* =======================================================
     AUTH UI
     ======================================================= */

  function showAuth() {
    state.user = null;

    hide(app);
    show(authScreen);

    state.loggedOut = false;

    if (loginUsername) {
      loginUsername.focus();
    }
  }

  function showApp() {
    hide(authScreen);
    show(app);

    updateAccountUI();

    state.loggedOut = false;
  }

  function updateAccountUI() {
    if (!state.user) {
      return;
    }

    const username =
      state.user.username ||
      "Account";

    const short =
      initials(username);

    setText(
      accountName,
      username
    );

    setText(
      accountName2,
      username
    );

    setText(
      accountMenuName,
      username
    );

    setText(
      settingsAccount,
      username
    );

    setText(
      accountInitial,
      short
    );

    setText(
      profileInitial,
      short
    );

    setText(
      accountAvatar,
      short
    );

    if (
      state.user.isAdmin
    ) {
      show(adminNav);
    } else {
      hide(adminNav);
    }
  }

  /* =======================================================
     AUTH BOX SWITCHING
     ======================================================= */

  function openLogin() {
    show(loginBox);
    hide(registerBox);

    setError(
      loginError,
      ""
    );

    setError(
      registerError,
      ""
    );

    if (loginUsername) {
      loginUsername.focus();
    }
  }

  function openRegister() {
    hide(loginBox);
    show(registerBox);

    setError(
      loginError,
      ""
    );

    setError(
      registerError,
      ""
    );

    if (registerUsername) {
      registerUsername.focus();
    }
  }

  /* =======================================================
     LOGIN
     ======================================================= */

  async function handleLogin(event) {
    event.preventDefault();

    setError(
      loginError,
      ""
    );

    const username =
      String(
        loginUsername?.value || ""
      ).trim();

    const password =
      String(
        loginPassword?.value || ""
      );

    if (!username) {
      setError(
        loginError,
        "Please enter your username."
      );
      return;
    }

    if (!password) {
      setError(
        loginError,
        "Please enter your password."
      );
      return;
    }

    setButtonLoading(
      loginBtn,
      true,
      "Sign in"
    );

    try {
      const data =
        await api(
          "/api/login",
          {
            method: "POST",
            body: {
              username,
              password
            }
          }
        );

      if (
        !data ||
        !data.user
      ) {
        throw new Error(
          "Login succeeded but the server returned no account."
        );
      }

      state.user =
        data.user;

      state.loggedOut = false;

      if (loginForm) {
        loginForm.reset();
      }

      showApp();

      await loadInitialAppData();

    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      if (
        error.status === 503
      ) {
        setError(
          loginError,
          "NEXUS is currently under maintenance."
        );
      } else {
        setError(
          loginError,
          error.message ||
            "Unable to sign in."
        );
      }

    } finally {
      setButtonLoading(
        loginBtn,
        false,
        "Sign in"
      );
    }
  }

  /* =======================================================
     REGISTER
     ======================================================= */

  async function handleRegister(event) {
    event.preventDefault();

    setError(
      registerError,
      ""
    );

    const username =
      String(
        registerUsername?.value || ""
      ).trim();

    const password =
      String(
        registerPassword?.value || ""
      );

    const confirm =
      String(
        confirmPassword?.value || ""
      );

    if (
      !/^[a-zA-Z0-9_]{3,32}$/.test(
        username
      )
    ) {
      setError(
        registerError,
        "Username must be 3-32 characters using only letters, numbers, or underscores."
      );
      return;
    }

    if (
      password.length < 8
    ) {
      setError(
        registerError,
        "Password must be at least 8 characters."
      );
      return;
    }

    if (
      password !== confirm
    ) {
      setError(
        registerError,
        "Passwords do not match."
      );
      return;
    }

    setButtonLoading(
      registerBtn,
      true,
      "Create account"
    );

    try {
      const data =
        await api(
          "/api/register",
          {
            method: "POST",
            body: {
              username,
              password
            }
          }
        );

      if (
        !data ||
        !data.user
      ) {
        throw new Error(
          "Account was created but the server returned no account."
        );
      }

      state.user =
        data.user;

      state.loggedOut = false;

      if (registerForm) {
        registerForm.reset();
      }

      resetPasswordStrength();

      showApp();

      await loadInitialAppData();

    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error
      );

      setError(
        registerError,
        error.message ||
          "Unable to create your account."
      );

    } finally {
      setButtonLoading(
        registerBtn,
        false,
        "Create account"
      );
    }
  }

  /* =======================================================
     PASSWORD STRENGTH
     ======================================================= */

  function passwordStrength(
    password
  ) {
    let score = 0;

    if (
      password.length >= 8
    ) {
      score++;
    }

    if (
      password.length >= 12
    ) {
      score++;
    }

    if (
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password)
    ) {
      score++;
    }

    if (
      /\d/.test(password)
    ) {
      score++;
    }

    if (
      /[^A-Za-z0-9]/.test(password)
    ) {
      score++;
    }

    return score;
  }

  function updatePasswordStrength() {
    if (
      !registerPassword ||
      !strengthBar ||
      !strengthText
    ) {
      return;
    }

    const password =
      registerPassword.value;

    if (!password) {
      strengthBar.style.width =
        "0%";

      strengthText.textContent =
        "Password strength";

      return;
    }

    const score =
      passwordStrength(
        password
      );

    const percent =
      Math.min(
        100,
        score * 20
      );

    strengthBar.style.width =
      `${percent}%`;

    if (score <= 1) {
      strengthText.textContent =
        "Weak password";
    } else if (score <= 3) {
      strengthText.textContent =
        "Moderate password";
    } else if (score === 4) {
      strengthText.textContent =
        "Strong password";
    } else {
      strengthText.textContent =
        "Very strong password";
    }
  }

  function resetPasswordStrength() {
    if (strengthBar) {
      strengthBar.style.width =
        "0%";
    }

    if (strengthText) {
      strengthText.textContent =
        "Password strength";
    }
  }

  /* =======================================================
     LOGOUT
     ======================================================= */

  async function logout() {
    state.loggedOut = true;

    try {
      await api(
        "/api/logout",
        {
          method: "POST"
        }
      );
    } catch (error) {
      console.error(
        "LOGOUT ERROR:",
        error
      );
    }

    if (state.controller) {
      state.controller.abort();
      state.controller = null;
    }

    state.user = null;
    state.query = "";
    state.results = [];

    closeAccountMenu();
    closeMobileSidebar();

    if (searchInput) {
      searchInput.value = "";
    }

    if (results) {
      results.innerHTML = "";
    }

    if (searchText) {
      searchText.textContent =
        "";
    }

    showAuth();
  }

  /* =======================================================
     SESSION CHECK
     ======================================================= */

  async function checkSession() {
    try {
      const data =
        await api(
          "/api/me"
        );

      if (
        data &&
        data.user
      ) {
        state.user =
          data.user;

        showApp();

        return true;
      }

      showAuth();

      return false;

    } catch (error) {
      if (
        error.status !== 401
      ) {
        console.error(
          "SESSION CHECK ERROR:",
          error
        );
      }

      showAuth();

      return false;
    }
  }

  /* =======================================================
     INITIAL DATA
     ======================================================= */

  async function loadInitialAppData() {
    updateAccountUI();

    await Promise.allSettled([
      loadHistory(),
      loadSaved()
    ]);

    if (
      state.user?.isAdmin
    ) {
      await loadAdminStatus();
    }

    renderEmptySearch();
  }

  /* =======================================================
     SEARCH TABS
     ======================================================= */

  function setTab(tab) {
    const validTabs = [
      "web",
      "news",
      "images",
      "videos",
      "ai"
    ];

    if (
      !validTabs.includes(tab)
    ) {
      tab = "web";
    }

    state.tab =
      tab;

    tabs.forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset.tab ===
            tab
        );
      }
    );

    if (
      state.query
    ) {
      performSearch(
        state.query
      );
    }
  }

  /* =======================================================
     SEARCH
     ======================================================= */

  async function performSearch(
    query
  ) {
    const cleanQuery =
      String(
        query || ""
      ).trim();

    if (!cleanQuery) {
      renderEmptySearch();
      return;
    }

    state.query =
      cleanQuery;

    hide(suggestions);

    if (searchInput) {
      searchInput.value =
        cleanQuery;
    }

    if (clearBtn) {
      show(clearBtn);
    }

    const requestId =
      ++state.requestId;

    if (state.controller) {
      state.controller.abort();
    }

    const controller =
      new AbortController();

    state.controller =
      controller;

    show(spinner);

    setText(
      searchText,
      `Searching for “${cleanQuery}”…`
    );

    if (results) {
      results.innerHTML =
        "";
    }

    try {
      if (
        state.tab === "ai"
      ) {
        await performAISearch(
          cleanQuery,
          requestId,
          controller
        );
      } else {
        await performNormalSearch(
          cleanQuery,
          requestId,
          controller
        );
      }

    } catch (error) {
      if (
        error.name ===
        "AbortError"
      ) {
        return;
      }

      console.error(
        "SEARCH ERROR:",
        error
      );

      if (
        requestId !==
        state.requestId
      ) {
        return;
      }

      hide(spinner);

      if (
        error.status ===
        401
      ) {
        showAuth();
        return;
      }

      if (results) {
        results.innerHTML = `
          <div class="result-empty">
            <div class="result-empty-icon">!</div>
            <h3>Search failed</h3>
            <p>${escapeHTML(
              error.message ||
              "NEXUS could not complete the search."
            )}</p>
          </div>
        `;
      }

      setText(
        searchText,
        ""
      );

    } finally {
      if (
        requestId ===
        state.requestId
      ) {
        hide(spinner);
      }
    }
  }

  async function performNormalSearch(
    query,
    requestId,
    controller
  ) {
    const endpoint =
      `/api/${state.tab}?q=${encodeURIComponent(
        query
      )}`;

    const response =
      await fetch(
        endpoint,
        {
          credentials:
            "same-origin",
          signal:
            controller.signal
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error =
        new Error(
          data?.error ||
          `Search failed (${response.status})`
        );

      error.status =
        response.status;

      throw error;
    }

    if (
      requestId !==
      state.requestId
    ) {
      return;
    }

    const items =
      Array.isArray(
        data?.results
      )
        ? data.results
        : [];

    state.results =
      items;

    renderResults(
      items,
      query,
      state.tab
    );
  }

  async function performAISearch(
    query,
    requestId,
    controller
  ) {
    const response =
      await fetch(
        "/api/ai",
        {
          method: "POST",
          credentials:
            "same-origin",
          headers: {
            "Content-Type":
              "application/json"
          },
          body:
            JSON.stringify({
              query
            }),
          signal:
            controller.signal
        }
      );

    let data = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error =
        new Error(
          data?.error ||
          `AI request failed (${response.status})`
        );

      error.status =
        response.status;

      throw error;
    }

    if (
      requestId !==
      state.requestId
    ) {
      return;
    }

    renderAIResult(
      data?.answer ||
        "NEXUS AI did not return an answer.",
      query
    );
  }

  /* =======================================================
     RESULT RENDERING
     ======================================================= */

  function renderResults(
    items,
    query,
    type
  ) {
    hide(spinner);

    setText(
      searchText,
      items.length
        ? `${items.length} result${
            items.length === 1
              ? ""
              : "s"
          } for “${query}”`
        : `No results found for “${query}”`
    );

    if (!results) {
      return;
    }

    if (!items.length) {
      results.innerHTML = `
        <div class="result-empty">
          <div class="result-empty-icon">⌕</div>
          <h3>No results found</h3>
          <p>
            Try a different search query.
          </p>
        </div>
      `;

      return;
    }

    if (
      type === "images"
    ) {
      renderImageResults(
        items
      );
      return;
    }

    if (
      type === "videos"
    ) {
      renderVideoResults(
        items
      );
      return;
    }

    results.innerHTML =
      items
        .map(
          (item, index) =>
            renderStandardResult(
              item,
              index
            )
        )
        .join("");
  }

  function renderStandardResult(
    item,
    index
  ) {
    const url =
      safeURL(item.url);

    if (!url) {
      return "";
    }

    const title =
      escapeHTML(
        item.title ||
        "Untitled result"
      );

    const description =
      escapeHTML(
        item.description ||
        "No description available."
      );

    const source =
      escapeHTML(
        item.source ||
        new URL(url).hostname
      );

    return `
      <article class="result-card">
        <div class="result-number">
          ${index + 1}
        </div>

        <div class="result-content">

          <div class="result-source">
            ${source}
          </div>

          <a
            class="result-title"
            href="${escapeHTML(url)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            ${title}
          </a>

          <p class="result-description">
            ${description}
          </p>

          <div class="result-actions">

            <a
              href="${escapeHTML(url)}"
              target="_blank"
              rel="noopener noreferrer"
              class="result-open"
            >
              Open result ↗
            </a>

            <button
              type="button"
              class="result-save"
              data-action="save"
              data-title="${escapeHTML(
                item.title ||
                "Untitled result"
              )}"
              data-url="${escapeHTML(url)}"
            >
              ☆ Save
            </button>

          </div>

        </div>
      </article>
    `;
  }

  function renderImageResults(
    items
  ) {
    if (!results) {
      return;
    }

    results.innerHTML = `
      <div class="image-grid">
        ${items
          .map(
            (item) => {
              const image =
                safeURL(
                  item.url
                );

              const source =
                safeURL(
                  item.source
                );

              if (!image) {
                return "";
              }

              return `
                <article class="image-result">

                  <a
                    href="${escapeHTML(
                      source ||
                      image
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="image-result-image"
                  >
                    <img
                      src="${escapeHTML(
                        image
                      )}"
                      alt="${escapeHTML(
                        item.title ||
                        "Image"
                      )}"
                      loading="lazy"
                    >
                  </a>

                  <div class="image-result-info">

                    <strong>
                      ${escapeHTML(
                        item.title ||
                        "Image"
                      )}
                    </strong>

                    ${
                      item.artist
                        ? `
                          <span>
                            ${escapeHTML(
                              item.artist
                            )}
                          </span>
                        `
                        : ""
                    }

                    <div class="result-actions">

                      ${
                        source
                          ? `
                            <a
                              href="${escapeHTML(
                                source
                              )}"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="result-open"
                            >
                              Source ↗
                            </a>
                          `
                          : ""
                      }

                      <button
                        type="button"
                        class="result-save"
                        data-action="save"
                        data-title="${escapeHTML(
                          item.title ||
                          "Image"
                        )}"
                        data-url="${escapeHTML(
                          source ||
                          image
                        )}"
                      >
                        ☆ Save
                      </button>

                    </div>

                  </div>

                </article>
              `;
            }
          )
          .join("")}
      </div>
    `;
  }

  function renderVideoResults(
    items
  ) {
    if (!results) {
      return;
    }

    results.innerHTML =
      items
        .map(
          (item) => {
            const video =
              safeURL(
                item.url
              );

            const source =
              safeURL(
                item.source
              );

            if (!video) {
              return "";
            }

            const poster =
              safeURL(
                item.poster
              );

            return `
              <article class="video-result">

                <div class="video-player">

                  <video
                    controls
                    preload="metadata"
                    ${
                      poster
                        ? `poster="${escapeHTML(
                            poster
                          )}"`
                        : ""
                    }
                  >
                    <source
                      src="${escapeHTML(
                        video
                      )}"
                      type="${escapeHTML(
                        item.mime ||
                        ""
                      )}"
                    >
                  </video>

                </div>

                <div class="video-info">

                  <strong>
                    ${escapeHTML(
                      item.title ||
                      "Video"
                    )}
                  </strong>

                  <div class="result-actions">

                    ${
                      source
                        ? `
                          <a
                            href="${escapeHTML(
                              source
                            )}"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="result-open"
                          >
                            Source ↗
                          </a>
                        `
                        : ""
                    }

                    <button
                      type="button"
                      class="result-save"
                      data-action="save"
                      data-title="${escapeHTML(
                        item.title ||
                        "Video"
                      )}"
                      data-url="${escapeHTML(
                        source ||
                        video
                      )}"
                    >
                      ☆ Save
                    </button>

                  </div>

                </div>

              </article>
            `;
          }
        )
        .join("");
  }

  function renderAIResult(
    answer,
    query
  ) {
    hide(spinner);

    setText(
      searchText,
      `NEXUS AI · “${query}”`
    );

    if (!results) {
      return;
    }

    const safeAnswer =
      escapeHTML(answer);

    const formatted =
      safeAnswer
        .replace(
          /\*\*(.*?)\*\*/g,
          "<strong>$1</strong>"
        )
        .replace(
          /\n\n+/g,
          "</p><p>"
        )
        .replace(
          /\n/g,
          "<br>"
        );

    results.innerHTML = `
      <article class="ai-result-card">

        <div class="ai-result-header">
          <span class="ai-badge">
            ✦ NEXUS AI
          </span>

          <span class="ai-query">
            ${escapeHTML(query)}
          </span>
        </div>

        <div class="ai-answer">
          <p>${formatted}</p>
        </div>

      </article>
    `;
  }

  function renderEmptySearch() {
    hide(spinner);

    if (searchText) {
      searchText.textContent =
        "";
    }

    if (!results) {
      return;
    }

    results.innerHTML = `
      <div class="result-empty">
        <div class="result-empty-icon">✦</div>
        <h3>Search beyond.</h3>
        <p>
          Enter something above to begin your NEXUS search.
        </p>
      </div>
    `;
  }

  /* =======================================================
     SEARCH FORM
     ======================================================= */

  async function handleSearch(event) {
    event.preventDefault();

    const query =
      String(
        searchInput?.value || ""
      ).trim();

    if (!query) {
      if (searchInput) {
        searchInput.focus();
      }

      return;
    }

    await performSearch(
      query
    );
  }

  function updateSearchInput() {
    const value =
      String(
        searchInput?.value || ""
      );

    if (clearBtn) {
      clearBtn.classList.toggle(
        "hidden",
        !value
      );
    }

    if (
      value.trim().length >= 2
    ) {
      showSuggestions(
        value.trim()
      );
    } else {
      hide(suggestions);
    }
  }

  function showSuggestions(
    query
  ) {
    if (!suggestions) {
      return;
    }

    const suggestionsList = [
      `latest ${query}`,
      `${query} explained`,
      `${query} news`,
      `${query} guide`,
      `${query} wikipedia`
    ];

    suggestions.innerHTML =
      suggestionsList
        .map(
          (item) => `
            <button
              type="button"
              data-action="suggestion"
              data-query="${escapeHTML(
                item
              )}"
            >
              ⌕ ${escapeHTML(item)}
            </button>
          `
        )
        .join("");

    show(suggestions);
  }

  function clearSearch() {
    if (state.controller) {
      state.controller.abort();
      state.controller = null;
    }

    state.query =
      "";

    if (searchInput) {
      searchInput.value =
        "";
      searchInput.focus();
    }

    hide(clearBtn);
    hide(suggestions);

    renderEmptySearch();
  }

  /* =======================================================
     HISTORY
     ======================================================= */

  async function loadHistory() {
    if (
      !state.user ||
      !historyList
    ) {
      return;
    }

    try {
      const data =
        await api(
          "/api/history"
        );

      const history =
        Array.isArray(
          data?.history
        )
          ? data.history
          : [];

      renderHistory(
        history
      );

    } catch (error) {
      console.error(
        "HISTORY ERROR:",
        error
      );

      if (
        error.status ===
        401
      ) {
        showAuth();
      }
    }
  }

  function renderHistory(
    history
  ) {
    if (!historyList) {
      return;
    }

    if (!history.length) {
      historyList.innerHTML = `
        <div class="result-empty">
          <div class="result-empty-icon">◷</div>
          <h3>No history yet.</h3>
          <p>
            Your searches will appear here.
          </p>
        </div>
      `;

      return;
    }

    historyList.innerHTML =
      history
        .map(
          (item) => {
            const url =
              safeURL(
                item.url
              );

            const type =
              String(
                item.type ||
                "web"
              ).toUpperCase();

            return `
              <article
                class="history-item"
              >

                <div class="history-icon">
                  ${getTypeIcon(
                    item.type
                  )}
                </div>

                <div class="history-content">

                  <strong>
                    ${escapeHTML(
                      item.query ||
                      item.title ||
                      "Search"
                    )}
                  </strong>

                  <span>
                    ${escapeHTML(
                      type
                    )}
                  </span>

                </div>

                <div class="history-actions">

                  ${
                    url
                      ? `
                        <a
                          href="${escapeHTML(
                            url
                          )}"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open ↗
                        </a>
                      `
                      : ""
                  }

                  <button
                    type="button"
                    data-action="history-search"
                    data-query="${escapeHTML(
                      item.query ||
                      ""
                    )}"
                    data-type="${escapeHTML(
                      item.type ||
                      "web"
                    )}"
                  >
                    Search
                  </button>

                </div>

              </article>
            `;
          }
        )
        .join("");
  }

  async function clearHistory() {
    if (
      !confirm(
        "Clear your entire search history?"
      )
    ) {
      return;
    }

    try {
      await api(
        "/api/history",
        {
          method: "DELETE"
        }
      );

      await loadHistory();

    } catch (error) {
      console.error(
        "CLEAR HISTORY ERROR:",
        error
      );

      alert(
        error.message ||
        "Could not clear history."
      );
    }
  }

  /* =======================================================
     SAVED
     ======================================================= */

  async function loadSaved() {
    if (
      !state.user ||
      !savedList
    ) {
      return;
    }

    try {
      const data =
        await api(
          "/api/saved"
        );

      const saved =
        Array.isArray(
          data?.saved
        )
          ? data.saved
          : [];

      renderSaved(
        saved
      );

    } catch (error) {
      console.error(
        "SAVED ERROR:",
        error
      );

      if (
        error.status ===
        401
      ) {
        showAuth();
      }
    }
  }

  function renderSaved(
    saved
  ) {
    if (!savedList) {
      return;
    }

    if (!saved.length) {
      savedList.innerHTML = `
        <div class="result-empty">
          <div class="result-empty-icon">☆</div>
          <h3>Nothing saved yet.</h3>
          <p>
            Save useful results and they'll appear here.
          </p>
        </div>
      `;

      return;
    }

    savedList.innerHTML =
      saved
        .map(
          (item) => {
            const url =
              safeURL(
                item.url
              );

            if (!url) {
              return "";
            }

            return `
              <article
                class="saved-item"
              >

                <div class="saved-icon">
                  ☆
                </div>

                <div class="saved-content">

                  <a
                    href="${escapeHTML(
                      url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ${escapeHTML(
                      item.title ||
                      "Saved page"
                    )}
                  </a>

                  <span>
                    ${escapeHTML(
                      url
                    )}
                  </span>

                </div>

                <button
                  type="button"
                  data-action="delete-saved"
                  data-id="${escapeHTML(
                    item.id
                  )}"
                >
                  ×
                </button>

              </article>
            `;
          }
        )
        .join("");
  }

  async function saveResult(
    title,
    url
  ) {
    const safe =
      safeURL(url);

    if (!safe) {
      return;
    }

    try {
      const data =
        await api(
          "/api/saved",
          {
            method: "POST",
            body: {
              title:
                title ||
                "Saved result",
              url: safe
            }
          }
        );

      if (
        data?.alreadySaved
      ) {
        alert(
          "This page is already saved."
        );
      } else {
        alert(
          "Saved to your NEXUS library."
        );
      }

      await loadSaved();

    } catch (error) {
      console.error(
        "SAVE ERROR:",
        error
      );

      if (
        error.status ===
        401
      ) {
        showAuth();
        return;
      }

      alert(
        error.message ||
        "Could not save this result."
      );
    }
  }

  async function deleteSaved(
    id
  ) {
    if (!id) {
      return;
    }

    try {
      await api(
        `/api/saved/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE"
        }
      );

      await loadSaved();

    } catch (error) {
      console.error(
        "DELETE SAVED ERROR:",
        error
      );

      alert(
        error.message ||
        "Could not remove saved page."
      );
    }
  }

  async function clearSaved() {
    if (
      !confirm(
        "Clear all saved pages?"
      )
    ) {
      return;
    }

    try {
      await api(
        "/api/saved",
        {
          method: "DELETE"
        }
      );

      await loadSaved();

    } catch (error) {
      console.error(
        "CLEAR SAVED ERROR:",
        error
      );

      alert(
        error.message ||
        "Could not clear saved pages."
      );
    }
  }

  /* =======================================================
     TYPE ICON
     ======================================================= */

  function getTypeIcon(
    type
  ) {
    switch (
      String(type || "").toLowerCase()
    ) {
      case "news":
        return "◉";

      case "images":
        return "▧";

      case "videos":
        return "▶";

      case "ai":
        return "✦";

      default:
        return "⌕";
    }
  }

  /* =======================================================
     VIEWS
     ======================================================= */

  function setView(view) {
    const validViews = [
      "search",
      "history",
      "saved",
      "settings",
      "admin"
    ];

    if (
      !validViews.includes(
        view
      )
    ) {
      view = "search";
    }

    if (
      view === "admin" &&
      !state.user?.isAdmin
    ) {
      view = "search";
    }

    state.currentView =
      view;

    $$(".view").forEach(
      (section) => {
        section.classList.toggle(
          "active-view",
          section.id ===
            `${view}View`
        );
      }
    );

    $$(".nav").forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset.view ===
            view
        );
      }
    );

    closeMobileSidebar();

    if (
      view === "history"
    ) {
      loadHistory();
    }

    if (
      view === "saved"
    ) {
      loadSaved();
    }

    if (
      view === "admin"
    ) {
      loadAdminStatus();
    }
  }

  /* =======================================================
     THEME
     ======================================================= */

  function loadTheme() {
    let saved =
      localStorage.getItem(
        "nexus_theme"
      );

    if (
      saved !== "light" &&
      saved !== "dark"
    ) {
      saved = "dark";
    }

    state.theme =
      saved;

    applyTheme();
  }

  function applyTheme() {
    document.documentElement.dataset.theme =
      state.theme;

    document.body.dataset.theme =
      state.theme;

    localStorage.setItem(
      "nexus_theme",
      state.theme
    );
  }

  function toggleTheme() {
    state.theme =
      state.theme ===
      "dark"
        ? "light"
        : "dark";

    applyTheme();
  }

  /* =======================================================
     ACCOUNT MENU
     ======================================================= */

  function closeAccountMenu() {
    hide(accountMenu);
  }

  function toggleAccountMenu(
    event
  ) {
    event?.stopPropagation();

    if (!accountMenu) {
      return;
    }

    accountMenu.classList.toggle(
      "hidden"
    );
  }

  /* =======================================================
     MOBILE SIDEBAR
     ======================================================= */

  function openMobileSidebar() {
    if (sidebar) {
      sidebar.classList.add(
        "open"
      );
    }

    if (overlay) {
      overlay.classList.add(
        "show"
      );
    }
  }

  function closeMobileSidebar() {
    if (sidebar) {
      sidebar.classList.remove(
        "open"
      );
    }

    if (overlay) {
      overlay.classList.remove(
        "show"
      );
    }
  }

  function toggleMobileSidebar() {
    if (
      sidebar?.classList.contains(
        "open"
      )
    ) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }
  }

  /* =======================================================
     ADMIN
     ======================================================= */

  async function loadAdminStatus() {
    if (
      !state.user?.isAdmin
    ) {
      return;
    }

    try {
      const data =
        await api(
          "/api/admin/status"
        );

      updateAdminStatus(
        data
      );

    } catch (error) {
      console.error(
        "ADMIN STATUS ERROR:",
        error
      );

      if (
        error.status ===
        403 ||
        error.status ===
        401
      ) {
        hide(adminNav);
        return;
      }

      setAdminMessage(
        error.message ||
        "Could not load admin status.",
        true
      );
    }
  }

  function updateAdminStatus(
    data
  ) {
    const locked =
      Boolean(
        data?.maintenance
      );

    if (adminStatusText) {
      adminStatusText.textContent =
        locked
          ? "NEXUS is currently under maintenance."
          : "NEXUS is online.";
    }

    if (adminStatusBadge) {
      adminStatusBadge.textContent =
        locked
          ? "● LOCKED"
          : "● ONLINE";

      adminStatusBadge.classList.toggle(
        "offline",
        locked
      );
    }

    if (adminUsers) {
      adminUsers.textContent =
        String(
          data?.users ?? "—"
        );
    }

    if (adminSessions) {
      adminSessions.textContent =
        String(
          data?.sessions ?? "—"
        );
    }

    if (
      maintenanceTitle &&
      !maintenanceTitle.value
    ) {
      maintenanceTitle.value =
        data?.title ||
        "NEXUS is temporarily offline";
    }

    if (
      maintenanceMessage &&
      !maintenanceMessage.value
    ) {
      maintenanceMessage.value =
        data?.message ||
        "The website is currently undergoing maintenance.";
    }
  }

  function setAdminMessage(
    message,
    error = false
  ) {
    if (!adminMessage) {
      return;
    }

    adminMessage.textContent =
      message || "";

    adminMessage.classList.toggle(
      "error",
      Boolean(error)
    );
  }

  async function lockNexus() {
    const title =
      String(
        maintenanceTitle?.value ||
        "NEXUS is temporarily offline"
      ).trim();

    const message =
      String(
        maintenanceMessage?.value ||
        "The website is currently undergoing maintenance."
      ).trim();

    if (
      !confirm(
        "Lock NEXUS for maintenance?"
      )
    ) {
      return;
    }

    setAdminMessage(
      "Locking NEXUS..."
    );

    try {
      await api(
        "/api/admin/lock",
        {
          method: "POST",
          body: {
            title,
            message
          }
        }
      );

      setAdminMessage(
        "NEXUS has been locked for maintenance."
      );

      await loadAdminStatus();

    } catch (error) {
      console.error(
        "LOCK ERROR:",
        error
      );

      setAdminMessage(
        error.message ||
        "Could not lock NEXUS.",
        true
      );
    }
  }

  async function unlockNexus() {
    if (
      !confirm(
        "Unlock NEXUS and return it online?"
      )
    ) {
      return;
    }

    setAdminMessage(
      "Unlocking NEXUS..."
    );

    try {
      await api(
        "/api/admin/unlock",
        {
          method: "POST"
        }
      );

      setAdminMessage(
        "NEXUS is back online."
      );

      await loadAdminStatus();

    } catch (error) {
      console.error(
        "UNLOCK ERROR:",
        error
      );

      setAdminMessage(
        error.message ||
        "Could not unlock NEXUS.",
        true
      );
    }
  }

  /* =======================================================
     GLOBAL CLICK HANDLER
     ======================================================= */

  document.addEventListener(
    "click",
    async (event) => {
      const target =
        event.target.closest(
          "[data-action]"
        );

      if (!target) {
        return;
      }

      const action =
        target.dataset.action;

      if (
        action ===
        "suggestion"
      ) {
        const query =
          target.dataset.query ||
          "";

        if (searchInput) {
          searchInput.value =
            query;
        }

        hide(suggestions);

        await performSearch(
          query
        );

        return;
      }

      if (
        action ===
        "save"
      ) {
        await saveResult(
          target.dataset.title ||
            "Saved result",
          target.dataset.url ||
            ""
        );

        return;
      }

      if (
        action ===
        "delete-saved"
      ) {
        await deleteSaved(
          target.dataset.id ||
            ""
        );

        return;
      }

      if (
        action ===
        "history-search"
      ) {
        const query =
          target.dataset.query ||
          "";

        const type =
          target.dataset.type ||
          "web";

        setTab(type);

        if (searchInput) {
          searchInput.value =
            query;
        }

        setView("search");

        await performSearch(
          query
        );
      }
    }
  );

  /* =======================================================
     NAVIGATION EVENTS
     ======================================================= */

  $$(".nav").forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          setView(
            button.dataset.view
          );
        }
      );
    }
  );

  tabs.forEach(
    (button) => {
      button.addEventListener(
        "click",
        () => {
          setTab(
            button.dataset.tab
          );
        }
      );
    }
  );

  /* =======================================================
     AUTH EVENTS
     ======================================================= */

  loginForm?.addEventListener(
    "submit",
    handleLogin
  );

  registerForm?.addEventListener(
    "submit",
    handleRegister
  );

  showRegister?.addEventListener(
    "click",
    openRegister
  );

  showLogin?.addEventListener(
    "click",
    openLogin
  );

  registerPassword?.addEventListener(
    "input",
    updatePasswordStrength
  );

  /* =======================================================
     SEARCH EVENTS
     ======================================================= */

  searchForm?.addEventListener(
    "submit",
    handleSearch
  );

  searchInput?.addEventListener(
    "input",
    updateSearchInput
  );

  clearBtn?.addEventListener(
    "click",
    clearSearch
  );

  /* =======================================================
     HISTORY / SAVED
     ======================================================= */

  clearHistoryBtn?.addEventListener(
    "click",
    clearHistory
  );

  clearSavedBtn?.addEventListener(
    "click",
    clearSaved
  );

  /* =======================================================
     SETTINGS
     ======================================================= */

  themeBtn?.addEventListener(
    "click",
    toggleTheme
  );

  settingsLogout?.addEventListener(
    "click",
    logout
  );

  accountLogout?.addEventListener(
    "click",
    logout
  );

  /* =======================================================
     ACCOUNT MENU
     ======================================================= */

  profileBtn?.addEventListener(
    "click",
    toggleAccountMenu
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        accountMenu &&
        !accountMenu.classList.contains(
          "hidden"
        ) &&
        !accountMenu.contains(
          event.target
        ) &&
        !profileBtn?.contains(
          event.target
        )
      ) {
        closeAccountMenu();
      }
    }
  );

  /* =======================================================
     MOBILE MENU
     ======================================================= */

  menuBtn?.addEventListener(
    "click",
    toggleMobileSidebar
  );

  overlay?.addEventListener(
    "click",
    closeMobileSidebar
  );

  /* =======================================================
     ADMIN EVENTS
     ======================================================= */

  lockWebsite?.addEventListener(
    "click",
    lockNexus
  );

  unlockWebsite?.addEventListener(
    "click",
    unlockNexus
  );

  /* =======================================================
     KEYBOARD SHORTCUTS
     ======================================================= */

  document.addEventListener(
    "keydown",
    (event) => {
      const tag =
        event.target?.tagName;

      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT";

      /* Escape */

      if (
        event.key ===
        "Escape"
      ) {
        hide(suggestions);
        closeAccountMenu();
        closeMobileSidebar();
      }

      /* / = focus search */

      if (
        event.key === "/" &&
        !typing
      ) {
        event.preventDefault();

        setView("search");

        searchInput?.focus();
      }

      /* Ctrl/Cmd + K */

      if (
        (event.ctrlKey ||
          event.metaKey) &&
        event.key.toLowerCase() ===
          "k"
      ) {
        event.preventDefault();

        setView("search");

        searchInput?.focus();

        searchInput?.select();
      }
    }
  );

  /* =======================================================
     HANDLE BROWSER BACK/FORWARD
     ======================================================= */

  window.addEventListener(
    "popstate",
    () => {
      const params =
        new URLSearchParams(
          window.location.search
        );

      const query =
        params.get("q") ||
        "";

      const tab =
        params.get("tab") ||
        "web";

      if (
        query
      ) {
        setTab(tab);

        if (searchInput) {
          searchInput.value =
            query;
        }

        setView("search");

        performSearch(
          query
        );
      }
    }
  );

  /* =======================================================
     UPDATE URL
     ======================================================= */

  function updateURL(
    query,
    tab
  ) {
    try {
      const url =
        new URL(
          window.location.href
        );

      if (query) {
        url.searchParams.set(
          "q",
          query
        );
      } else {
        url.searchParams.delete(
          "q"
        );
      }

      if (tab) {
        url.searchParams.set(
          "tab",
          tab
        );
      } else {
        url.searchParams.delete(
          "tab"
        );
      }

      window.history.pushState(
        {},
        "",
        url
      );
    } catch {
      /* Ignore URL errors */
    }
  }

  /* =======================================================
     PATCH SEARCH URL UPDATE
     ======================================================= */

  const originalPerformSearch =
    performSearch;

  performSearch =
    async function patchedSearch(
      query
    ) {
      updateURL(
        query,
        state.tab
      );

      return originalPerformSearch(
        query
      );
    };

  /* =======================================================
     ADD ACCOUNT
     ======================================================= */

  $("#addAccount")?.addEventListener(
    "click",
    () => {
      closeAccountMenu();

      state.user = null;

      if (searchInput) {
        searchInput.value =
          "";
      }

      showAuth();
    }
  );

  /* =======================================================
     LOAD URL SEARCH
     ======================================================= */

  function loadURLSearch() {
    try {
      const params =
        new URLSearchParams(
          window.location.search
        );

      const query =
        params.get("q");

      const tab =
        params.get("tab");

      if (
        tab &&
        [
          "web",
          "news",
          "images",
          "videos",
          "ai"
        ].includes(tab)
      ) {
        state.tab =
          tab;

        tabs.forEach(
          (button) => {
            button.classList.toggle(
              "active",
              button.dataset.tab ===
                tab
            );
          }
        );
      }

      if (query) {
        state.query =
          query;

        if (searchInput) {
          searchInput.value =
            query;
        }
      }

      return Boolean(
        query
      );

    } catch {
      return false;
    }
  }

  /* =======================================================
     MAINTENANCE CHECK
     ======================================================= */

  async function checkMaintenance() {
    try {
      const data =
        await api(
          "/api/maintenance"
        );

      if (
        data?.enabled &&
        !state.user?.isAdmin
      ) {
        return true;
      }

      return false;

    } catch {
      return false;
    }
  }

  /* =======================================================
     BOOT
     ======================================================= */

  async function boot() {
    if (state.booted) {
      return;
    }

    state.booted =
      true;

    loadTheme();

    openLogin();

    const loggedIn =
      await checkSession();

    if (!loggedIn) {
      return;
    }

    loadURLSearch();

    await loadInitialAppData();

    if (state.query) {
      await performSearch(
        state.query
      );
    }
  }

  /* =======================================================
     START
     ======================================================= */

  boot();
});
