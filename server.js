import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import OpenAI from "openai";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const SESSION_COOKIE = "nexus_session";
const SESSION_DAYS = 30;

/* =========================================================
   EXPRESS
========================================================= */

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DATABASE
========================================================= */

function createDefaultDB() {
  return {
    users: [],
    sessions: [],
    history: [],
    saved: [],
    settings: {
      maintenance: false,
      maintenanceTitle: "NEXUS is temporarily unavailable",
      maintenanceMessage:
        "The website is currently undergoing maintenance."
    }
  };
}

function ensureDatabase() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, {
        recursive: true
      });
    }

    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(createDefaultDB(), null, 2),
        "utf8"
      );

      console.log("Created NEXUS database.");
    }
  } catch (error) {
    console.error("Could not create database:", error);
  }
}

function loadDatabase() {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(
      DB_FILE,
      "utf8"
    );

    const parsed = JSON.parse(raw);
    const defaults = createDefaultDB();

    return {
      users: Array.isArray(parsed.users)
        ? parsed.users
        : [],

      sessions: Array.isArray(parsed.sessions)
        ? parsed.sessions
        : [],

      history: Array.isArray(parsed.history)
        ? parsed.history
        : [],

      saved: Array.isArray(parsed.saved)
        ? parsed.saved
        : [],

      settings: {
        ...defaults.settings,
        ...(parsed.settings || {})
      }
    };
  } catch (error) {
    console.error(
      "Database could not be read. Creating a fresh database."
    );

    const fresh = createDefaultDB();

    try {
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(fresh, null, 2),
        "utf8"
      );
    } catch (writeError) {
      console.error(
        "Could not create fresh database:",
        writeError
      );
    }

    return fresh;
  }
}

let db = loadDatabase();

function saveDatabase() {
  ensureDatabase();

  try {
    const tempFile = `${DB_FILE}.tmp`;

    fs.writeFileSync(
      tempFile,
      JSON.stringify(db, null, 2),
      "utf8"
    );

    fs.renameSync(
      tempFile,
      DB_FILE
    );

    return true;
  } catch (error) {
    console.error(
      "Database save failed:",
      error
    );

    return false;
  }
}

/* =========================================================
   PASSWORD HASHING
========================================================= */

function hashPassword(password) {
  const salt = crypto
    .randomBytes(16)
    .toString("hex");

  const hash = crypto
    .scryptSync(
      password,
      salt,
      64
    )
    .toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  try {
    if (
      typeof storedHash !== "string" ||
      !storedHash.includes(":")
    ) {
      return false;
    }

    const parts = storedHash.split(":");

    if (parts.length !== 2) {
      return false;
    }

    const salt = parts[0];
    const originalHash = parts[1];

    const calculatedHash = crypto
      .scryptSync(
        password,
        salt,
        64
      )
      .toString("hex");

    const a = Buffer.from(
      originalHash,
      "hex"
    );

    const b = Buffer.from(
      calculatedHash,
      "hex"
    );

    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      a,
      b
    );
  } catch {
    return false;
  }
}

/* =========================================================
   USERS
========================================================= */

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function findUser(username) {
  const normalized =
    normalizeUsername(username);

  return db.users.find(
    user =>
      normalizeUsername(
        user.username
      ) === normalized
  );
}

function getPublicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    isAdmin:
      normalizeUsername(
        user.username
      ) === "calsgc"
  };
}

/* =========================================================
   COOKIES
========================================================= */

function parseCookies(header) {
  const cookies = {};

  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = part
      .slice(0, index)
      .trim();

    const value = part
      .slice(index + 1)
      .trim();

    try {
      cookies[key] =
        decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }

  return cookies;
}

function setSessionCookie(res, token) {
  const secure =
    process.env.NODE_ENV === "production"
      ? "; Secure"
      : "";

  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(
      token
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
      SESSION_DAYS * 24 * 60 * 60
    }${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

/* =========================================================
   SESSIONS
========================================================= */

function hashSessionToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function createSession(userId) {
  const token =
    crypto.randomBytes(48).toString("hex");

  const now = Date.now();

  db.sessions.push({
    id: crypto.randomUUID(),
    userId,
    tokenHash:
      hashSessionToken(token),
    createdAt: now,
    expiresAt:
      now +
      SESSION_DAYS *
        24 *
        60 *
        60 *
        1000
  });

  saveDatabase();

  return token;
}

function getSession(req) {
  const cookies = parseCookies(
    req.headers.cookie || ""
  );

  const token =
    cookies[SESSION_COOKIE];

  if (!token) {
    return null;
  }

  const tokenHash =
    hashSessionToken(token);

  const session =
    db.sessions.find(
      item =>
        item.tokenHash === tokenHash
    );

  if (!session) {
    return null;
  }

  if (
    !session.expiresAt ||
    session.expiresAt <= Date.now()
  ) {
    db.sessions =
      db.sessions.filter(
        item =>
          item.id !== session.id
      );

    saveDatabase();

    return null;
  }

  return session;
}

function getCurrentUser(req) {
  const session =
    getSession(req);

  if (!session) {
    return null;
  }

  return (
    db.users.find(
      user =>
        user.id === session.userId
    ) || null
  );
}

function requireAuth(req, res, next) {
  const user =
    getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      error: "You must be logged in."
    });
  }

  req.user = user;

  next();
}

function requireAdmin(req, res, next) {
  const user =
    getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      error: "You must be logged in."
    });
  }

  if (
    normalizeUsername(
      user.username
    ) !== "calsgc"
  ) {
    return res.status(403).json({
      error: "Admin access required."
    });
  }

  req.user = user;

  next();
}

/* =========================================================
   MAINTENANCE
========================================================= */

function maintenanceAllowed(req) {
  const allowed = new Set([
    "/api/login",
    "/api/register",
    "/api/me",
    "/api/logout",
    "/api/maintenance",
    "/api/admin/status",
    "/api/admin/reset-password",
    "/api/health"
  ]);

  return allowed.has(req.path);
}

app.use((req, res, next) => {
  if (!db.settings.maintenance) {
    return next();
  }

  if (maintenanceAllowed(req)) {
    return next();
  }

  const user =
    getCurrentUser(req);

  if (
    user &&
    normalizeUsername(
      user.username
    ) === "calsgc"
  ) {
    return next();
  }

  if (req.path.startsWith("/api/")) {
    return res.status(503).json({
      error:
        db.settings.maintenanceMessage ||
        "NEXUS is currently under maintenance."
    });
  }

  return res
    .status(503)
    .sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
});

/* =========================================================
   REGISTER
========================================================= */

app.post(
  "/api/register",
  (req, res) => {
    const username =
      String(
        req.body?.username ||
          req.body?.user ||
          ""
      ).trim();

    const password =
      String(
        req.body?.password ||
          ""
      );

    if (
      !/^[a-zA-Z0-9_]{3,32}$/.test(
        username
      )
    ) {
      return res.status(400).json({
        error:
          "Username must be 3-32 characters and use only letters, numbers, and underscores."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters."
      });
    }

    if (findUser(username)) {
      return res.status(409).json({
        error:
          "That username is already registered."
      });
    }

    const user = {
      id: crypto.randomUUID(),
      username,
      passwordHash:
        hashPassword(password),
      createdAt: Date.now()
    };

    db.users.push(user);

    if (!saveDatabase()) {
      db.users =
        db.users.filter(
          item =>
            item.id !== user.id
        );

      return res.status(500).json({
        error:
          "Could not save your account."
      });
    }

    const token =
      createSession(user.id);

    setSessionCookie(
      res,
      token
    );

    return res.json({
      success: true,
      user:
        getPublicUser(user)
    });
  }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/login",
  (req, res) => {
    const username =
      String(
        req.body?.username ||
          req.body?.user ||
          req.body?.login ||
          ""
      ).trim();

    const password =
      String(
        req.body?.password ||
          req.body?.pass ||
          ""
      );

    if (!username) {
      return res.status(400).json({
        error:
          "Please enter your username."
      });
    }

    if (!password) {
      return res.status(400).json({
        error:
          "Please enter your password."
      });
    }

    const user =
      findUser(username);

    if (!user) {
      return res.status(401).json({
        error:
          "Invalid username or password."
      });
    }

    if (
      !verifyPassword(
        password,
        user.passwordHash
      )
    ) {
      return res.status(401).json({
        error:
          "Invalid username or password."
      });
    }

    /*
      Remove previous sessions for
      this account.
    */

    db.sessions =
      db.sessions.filter(
        session =>
          session.userId !==
          user.id
      );

    const token =
      createSession(user.id);

    setSessionCookie(
      res,
      token
    );

    return res.json({
      success: true,
      user:
        getPublicUser(user)
    });
  }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/logout",
  (req, res) => {
    const session =
      getSession(req);

    if (session) {
      db.sessions =
        db.sessions.filter(
          item =>
            item.id !==
            session.id
        );

      saveDatabase();
    }

    clearSessionCookie(res);

    return res.json({
      success: true
    });
  }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  "/api/me",
  (req, res) => {
    const user =
      getCurrentUser(req);

    return res.json({
      loggedIn: Boolean(user),
      user:
        getPublicUser(user)
    });
  }
);

/* =========================================================
   ADMIN PASSWORD RESET
========================================================= */

app.post(
  "/api/admin/reset-password",
  (req, res) => {
    const currentUser =
      getCurrentUser(req);

    const suppliedKey =
      String(
        req.headers[
          "x-nexus-reset-key"
        ] ||
          req.body?.resetKey ||
          ""
      );

    const configuredKey =
      String(
        process.env
          .NEXUS_ADMIN_RESET_KEY ||
          ""
      );

    const isAdmin =
      currentUser &&
      normalizeUsername(
        currentUser.username
      ) === "calsgc";

    const validEmergencyKey =
      configuredKey.length > 0 &&
      suppliedKey.length > 0 &&
      suppliedKey ===
        configuredKey;

    if (
      !isAdmin &&
      !validEmergencyKey
    ) {
      return res.status(403).json({
        error: "Not authorized."
      });
    }

    const username =
      String(
        req.body?.username ||
          ""
      ).trim();

    const newPassword =
      String(
        req.body?.newPassword ||
          ""
      );

    if (!username) {
      return res.status(400).json({
        error:
          "Username is required."
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error:
          "New password must be at least 8 characters."
      });
    }

    const user =
      findUser(username);

    if (!user) {
      return res.status(404).json({
        error:
          "User not found."
      });
    }

    user.passwordHash =
      hashPassword(
        newPassword
      );

    db.sessions =
      db.sessions.filter(
        session =>
          session.userId !==
          user.id
      );

    saveDatabase();

    return res.json({
      success: true,
      message:
        "Password reset successfully."
    });
  }
);

/* =========================================================
   SEARCH UTILITIES
========================================================= */

function cleanQuery(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function getQueryTerms(query) {
  return normalizeText(query)
    .split(" ")
    .filter(
      term =>
        term.length >= 2
    );
}

function stripHTML(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&quot;/g,
      '"'
    )
    .replace(
      /&#039;/g,
      "'"
    )
    .replace(
      /&amp;/g,
      "&"
    )
    .replace(
      /&lt;/g,
      "<"
    )
    .replace(
      /&gt;/g,
      ">"
    );
}

/*
  STRICT relevance check.

  This is the important part.

  A result must actually contain
  meaningful parts of the user's
  query before it is allowed through.
*/

function isRelevant(query, item) {
  const normalizedQuery =
    normalizeText(query);

  const terms =
    getQueryTerms(query);

  const title =
    normalizeText(
      item.title
    );

  const description =
    normalizeText(
      item.description ||
        ""
    );

  if (!title && !description) {
    return false;
  }

  if (
    title.includes(
      normalizedQuery
    )
  ) {
    return true;
  }

  if (
    description.includes(
      normalizedQuery
    )
  ) {
    return true;
  }

  if (terms.length === 1) {
    const term = terms[0];

    return (
      title.includes(term) ||
      description.includes(term)
    );
  }

  const matching =
    terms.filter(
      term =>
        title.includes(term) ||
        description.includes(term)
    );

  /*
    For multi-word queries,
    require at least half the
    meaningful words.
  */

  return (
    matching.length /
      terms.length >=
    0.5
  );
}

function calculateRelevance(
  query,
  item
) {
  const q =
    normalizeText(query);

  const title =
    normalizeText(
      item.title
    );

  const description =
    normalizeText(
      item.description ||
        ""
    );

  let score = 0;

  if (title === q) {
    score += 5000;
  }

  if (title.includes(q)) {
    score += 2500;
  }

  if (description.includes(q)) {
    score += 1000;
  }

  const terms =
    getQueryTerms(query);

  for (const term of terms) {
    if (
      title.includes(term)
    ) {
      score += 500;
    }

    if (
      description.includes(
        term
      )
    ) {
      score += 100;
    }
  }

  /*
    Educational/general knowledge
    pages get a small boost when
    Wikipedia is the source.
  */

  if (
    item.source ===
    "Wikipedia"
  ) {
    score += 25;
  }

  return score;
}

function deduplicate(results) {
  const seen =
    new Set();

  return results.filter(
    result => {
      const url =
        String(
          result.url || ""
        )
          .trim()
          .toLowerCase()
          .replace(
            /\/$/,
            ""
          );

      if (!url) {
        return false;
      }

      if (seen.has(url)) {
        return false;
      }

      seen.add(url);

      return true;
    }
  );
}

/* =========================================================
   WIKIPEDIA
========================================================= */

async function searchWikipedia(
  query,
  limit = 30
) {
  const params =
    new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srnamespace: "0",
      srlimit: String(limit),
      srsort: "relevance",
      srprop:
        "snippet|timestamp|size",
      format: "json",
      formatversion: "2"
    });

  const response =
    await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      {
        headers: {
          "User-Agent":
            "NEXUS/1.0"
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `Wikipedia HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  return (
    data?.query?.search ||
    []
  ).map(item => ({
    title:
      item.title || "",
    description:
      stripHTML(
        item.snippet || ""
      ),
    url:
      `https://en.wikipedia.org/wiki/${encodeURIComponent(
        String(
          item.title || ""
        ).replace(
          / /g,
          "_"
        )
      )}`,
    source:
      "Wikipedia",
    type: "web"
  }));
}

/* =========================================================
   BRAVE WEB SEARCH
========================================================= */

async function searchBrave(
  query,
  limit = 20
) {
  const apiKey =
    process.env
      .BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    return [];
  }

  const params =
    new URLSearchParams({
      q: query,
      count: String(limit),
      safesearch: "strict",
      search_lang: "en"
    });

  const response =
    await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params}`,
      {
        headers: {
          Accept:
            "application/json",
          "X-Subscription-Token":
            apiKey
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `Brave HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  return (
    data?.web?.results ||
    []
  ).map(item => ({
    title:
      item.title || "",
    description:
      item.description ||
      item.snippet ||
      "",
    url:
      item.url || "",
    source:
      "Web",
    type:
      "web"
  }));
}

/* =========================================================
   MAIN WEB SEARCH
========================================================= */

app.get(
  "/api/search",
  requireAuth,
  async (req, res) => {
    const query =
      cleanQuery(
        req.query.q
      );

    if (!query) {
      return res.status(400).json({
        error:
          "Search query is required."
      });
    }

    try {
      let results = [];

      /*
        Real web search if a Brave key
        exists.
      */

      const braveResults =
        await searchBrave(
          query,
          25
        );

      results.push(
        ...braveResults
      );

      /*
        Wikipedia fallback/additional
        knowledge results.
      */

      const wikiResults =
        await searchWikipedia(
          query,
          25
        );

      results.push(
        ...wikiResults
      );

      /*
        HARD FILTER:
        unrelated results are removed.
      */

      results =
        results.filter(
          result =>
            isRelevant(
              query,
              result
            )
        );

      /*
        Remove duplicates.
      */

      results =
        deduplicate(
          results
        );

      /*
        Rank results ourselves.
      */

      results =
        results
          .map(result => ({
            ...result,
            relevance:
              calculateRelevance(
                query,
                result
              )
          }))
          .sort(
            (a, b) =>
              b.relevance -
              a.relevance
          )
          .slice(0, 20)
          .map(
            ({
              relevance,
              ...result
            }) => result
          );

      /*
        Save history.
      */

      db.history.push({
        id:
          crypto.randomUUID(),
        userId:
          req.user.id,
        query,
        tab: "web",
        createdAt:
          Date.now()
      });

      /*
        Keep only the latest
        100 searches per account.
      */

      const userHistory =
        db.history
          .filter(
            item =>
              item.userId ===
              req.user.id
          )
          .sort(
            (a, b) =>
              b.createdAt -
              a.createdAt
          )
          .slice(0, 100);

      const otherHistory =
        db.history.filter(
          item =>
            item.userId !==
            req.user.id
        );

      db.history = [
        ...otherHistory,
        ...userHistory
      ];

      saveDatabase();

      return res.json({
        query,
        results,
        provider:
          process.env
            .BRAVE_SEARCH_API_KEY
            ? "web"
            : "wikipedia"
      });
    } catch (error) {
      console.error(
        "Search error:",
        error
      );

      return res.status(500).json({
        error:
          "Search temporarily failed."
      });
    }
  }
);

/* =========================================================
   NEWS
========================================================= */

app.get(
  "/api/news",
  requireAuth,
  async (req, res) => {
    const query =
      cleanQuery(
        req.query.q
      );

    if (!query) {
      return res.status(400).json({
        error:
          "Search query is required."
      });
    }

    try {
      const params =
        new URLSearchParams({
          query,
          mode: "artlist",
          format: "json",
          maxrecords: "20",
          sort: "HybridRel"
        });

      const response =
        await fetch(
          `https://api.gdeltproject.org/api/v2/doc/doc?${params}`
        );

      if (!response.ok) {
        throw new Error(
          `GDELT HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const results =
        (
          data?.articles ||
          []
        )
          .map(article => ({
            title:
              article.title ||
              "Untitled",
            description:
              article.seendate
                ? `Published ${article.seendate}`
                : "",
            url:
              article.url ||
              "",
            source:
              article.domain ||
              "News",
            type:
              "news",
            image:
              article.socialimage ||
              null
          }))
          .filter(
            item =>
              item.url
          );

      return res.json({
        query,
        results
      });
    } catch (error) {
      console.error(
        "News search error:",
        error
      );

      return res.status(500).json({
        error:
          "News search temporarily failed."
      });
    }
  }
);

/* =========================================================
   IMAGES
========================================================= */

app.get(
  "/api/images",
  requireAuth,
  async (req, res) => {
    const query =
      cleanQuery(
        req.query.q
      );

    if (!query) {
      return res.status(400).json({
        error:
          "Search query is required."
      });
    }

    try {
      const params =
        new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch: query,
          gsrnamespace: "6",
          gsrlimit: "30",
          prop: "imageinfo",
          iiprop:
            "url|extmetadata",
          iiurlwidth: "600",
          format: "json",
          origin: "*"
        });

      const response =
        await fetch(
          `https://commons.wikimedia.org/w/api.php?${params}`
        );

      if (!response.ok) {
        throw new Error(
          `Wikimedia HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const pages =
        Object.values(
          data?.query?.pages ||
            {}
        );

      const results =
        pages
          .map(page => {
            const info =
              page.imageinfo?.[0];

            if (!info) {
              return null;
            }

            const title =
              String(
                page.title ||
                  "Image"
              ).replace(
                /^File:/,
                ""
              );

            return {
              title,
              description:
                info.extmetadata
                  ?.ImageDescription
                  ?.value ||
                "",
              url:
                info.descriptionurl ||
                `https://commons.wikimedia.org/wiki/${encodeURIComponent(
                  page.title
                )}`,
              image:
                info.thumburl ||
                info.url ||
                "",
              source:
                "Wikimedia Commons",
              type:
                "image"
            };
          })
          .filter(Boolean)
          .filter(
            result =>
              isRelevant(
                query,
                result
              )
          );

      return res.json({
        query,
        results
      });
    } catch (error) {
      console.error(
        "Image search error:",
        error
      );

      return res.status(500).json({
        error:
          "Image search temporarily failed."
      });
    }
  }
);

/* =========================================================
   VIDEOS
========================================================= */

app.get(
  "/api/videos",
  requireAuth,
  async (req, res) => {
    const query =
      cleanQuery(
        req.query.q
      );

    if (!query) {
      return res.status(400).json({
        error:
          "Search query is required."
      });
    }

    try {
      const params =
        new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch:
            `${query} filetype:video`,
          gsrnamespace: "6",
          gsrlimit: "20",
          prop: "imageinfo",
          iiprop:
            "url|extmetadata",
          format: "json",
          origin: "*"
        });

      const response =
        await fetch(
          `https://commons.wikimedia.org/w/api.php?${params}`
        );

      if (!response.ok) {
        throw new Error(
          `Wikimedia HTTP ${response.status}`
        );
      }

      const data =
        await response.json();

      const pages =
        Object.values(
          data?.query?.pages ||
            {}
        );

      const results =
        pages
          .map(page => {
            const info =
              page.imageinfo?.[0];

            if (!info) {
              return null;
            }

            const title =
              String(
                page.title ||
                  "Video"
              ).replace(
                /^File:/,
                ""
              );

            const lower =
              title.toLowerCase();

            const videoFile =
              lower.endsWith(".mp4") ||
              lower.endsWith(".webm") ||
              lower.endsWith(".ogv") ||
              lower.endsWith(".ogg");

            if (!videoFile) {
              return null;
            }

            return {
              title,
              description:
                info.extmetadata
                  ?.ImageDescription
                  ?.value ||
                "",
              url:
                info.descriptionurl ||
                info.url ||
                "",
              video:
                info.url ||
                "",
              source:
                "Wikimedia Commons",
              type:
                "video"
            };
          })
          .filter(Boolean)
          .filter(
            result =>
              isRelevant(
                query,
                result
              )
          );

      return res.json({
        query,
        results
      });
    } catch (error) {
      console.error(
        "Video search error:",
        error
      );

      return res.status(500).json({
        error:
          "Video search temporarily failed."
      });
    }
  }
);

/* =========================================================
   AI
========================================================= */

app.post(
  "/api/ai",
  requireAuth,
  async (req, res) => {
    const prompt =
      String(
        req.body?.prompt ||
          ""
      ).trim();

    if (!prompt) {
      return res.status(400).json({
        error:
          "Prompt is required."
      });
    }

    if (
      !process.env.OPENAI_API_KEY
    ) {
      return res.status(503).json({
        error:
          "AI is not configured yet."
      });
    }

    try {
      const client =
        new OpenAI({
          apiKey:
            process.env
              .OPENAI_API_KEY
        });

      const response =
        await client.responses.create(
          {
            model:
              process.env
                .OPENAI_MODEL ||
              "gpt-5.6-luna",
            input: prompt
          }
        );

      return res.json({
        answer:
          response.output_text ||
          "No response generated."
      });
    } catch (error) {
      console.error(
        "AI error:",
        error
      );

      return res.status(500).json({
        error:
          "AI request failed."
      });
    }
  }
);

/* =========================================================
   HISTORY
========================================================= */

app.get(
  "/api/history",
  requireAuth,
  (req, res) => {
    const history =
      db.history
        .filter(
          item =>
            item.userId ===
            req.user.id
        )
        .sort(
          (a, b) =>
            b.createdAt -
            a.createdAt
        );

    res.json({
      history
    });
  }
);

app.delete(
  "/api/history",
  requireAuth,
  (req, res) => {
    db.history =
      db.history.filter(
        item =>
          item.userId !==
          req.user.id
      );

    saveDatabase();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   SAVED
========================================================= */

app.get(
  "/api/saved",
  requireAuth,
  (req, res) => {
    const saved =
      db.saved
        .filter(
          item =>
            item.userId ===
            req.user.id
        )
        .sort(
          (a, b) =>
            b.createdAt -
            a.createdAt
        );

    res.json({
      saved
    });
  }
);

app.post(
  "/api/saved",
  requireAuth,
  (req, res) => {
    const item =
      req.body?.item;

    if (
      !item ||
      !item.url
    ) {
      return res.status(400).json({
        error:
          "A valid result is required."
      });
    }

    const existing =
      db.saved.find(
        saved =>
          saved.userId ===
            req.user.id &&
          saved.url ===
            item.url
      );

    if (existing) {
      return res.json({
        success: true,
        saved: existing
      });
    }

    const saved = {
      id:
        crypto.randomUUID(),
      userId:
        req.user.id,
      title:
        String(
          item.title || ""
        ).slice(0, 500),
      description:
        String(
          item.description ||
            ""
        ).slice(0, 2000),
      url:
        String(
          item.url
        ).slice(0, 2000),
      source:
        String(
          item.source || ""
        ).slice(0, 200),
      image:
        item.image
          ? String(
              item.image
            ).slice(0, 2000)
          : null,
      createdAt:
        Date.now()
    };

    db.saved.push(
      saved
    );

    saveDatabase();

    res.json({
      success: true,
      saved
    });
  }
);

app.delete(
  "/api/saved/:id",
  requireAuth,
  (req, res) => {
    const before =
      db.saved.length;

    db.saved =
      db.saved.filter(
        item =>
          !(
            item.id ===
              req.params.id &&
            item.userId ===
              req.user.id
          )
      );

    saveDatabase();

    res.json({
      success: true,
      deleted:
        db.saved.length !==
        before
    });
  }
);

app.delete(
  "/api/saved",
  requireAuth,
  (req, res) => {
    db.saved =
      db.saved.filter(
        item =>
          item.userId !==
          req.user.id
      );

    saveDatabase();

    res.json({
      success: true
    });
  }
);

/* =========================================================
   ADMIN STATUS
========================================================= */

app.get(
  "/api/admin/status",
  requireAdmin,
  (req, res) => {
    res.json({
      maintenance:
        Boolean(
          db.settings
            .maintenance
        ),
      title:
        db.settings
          .maintenanceTitle,
      message:
        db.settings
          .maintenanceMessage,
      users:
        db.users.length,
      sessions:
        db.sessions.length
    });
  }
);

/* =========================================================
   ADMIN LOCK
========================================================= */

app.post(
  "/api/admin/lock",
  requireAdmin,
  (req, res) => {
    db.settings.maintenance =
      true;

    if (
      req.body?.title
    ) {
      db.settings
        .maintenanceTitle =
        String(
          req.body.title
        ).slice(0, 200);
    }

    if (
      req.body?.message
    ) {
      db.settings
        .maintenanceMessage =
        String(
          req.body.message
        ).slice(0, 1000);
    }

    saveDatabase();

    res.json({
      success: true,
      maintenance: true
    });
  }
);

/* =========================================================
   ADMIN UNLOCK
========================================================= */

app.post(
  "/api/admin/unlock",
  requireAdmin,
  (req, res) => {
    db.settings.maintenance =
      false;

    saveDatabase();

    res.json({
      success: true,
      maintenance: false
    });
  }
);

/* =========================================================
   MAINTENANCE STATUS
========================================================= */

app.get(
  "/api/maintenance",
  (req, res) => {
    res.json({
      maintenance:
        Boolean(
          db.settings
            .maintenance
        ),
      title:
        db.settings
          .maintenanceTitle,
      message:
        db.settings
          .maintenanceMessage
    });
  }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "NEXUS",
      time:
        new Date().toISOString(),
      users:
        db.users.length
    });
  }
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* =========================================================
   SPA FALLBACK
========================================================= */

app.get(
  "/{*splat}",
  (req, res) => {
    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {
    console.error(
      "Unhandled error:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      error:
        "Internal server error."
    });
  }
);

/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "================================="
    );

    console.log(
      "        NEXUS IS ONLINE"
    );

    console.log(
      "================================="
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Users: ${db.users.length}`
    );

    console.log(
      `Maintenance: ${
        db.settings.maintenance
      }`
    );

    console.log(
      `Web search provider: ${
        process.env
          .BRAVE_SEARCH_API_KEY
          ? "Brave + Wikipedia"
          : "Wikipedia fallback"
      }`
    );

    console.log(
      `Database: ${DB_FILE}`
    );

    console.log(
      "================================="
    );
  }
);
