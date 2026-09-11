import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import OpenAI from "openai";

/* =========================================================
   NEXUS SERVER
   ========================================================= */

const app = express();

const PORT =
  Number(process.env.PORT) || 3000;

const ADMIN_USERNAME =
  "CALSGC";

const PUBLIC_DIR =
  path.join(
    process.cwd(),
    "public"
  );

const DATA_DIR =
  path.join(
    process.cwd(),
    "data"
  );

const DB_FILE =
  path.join(
    DATA_DIR,
    "db.json"
  );

const SESSION_DAYS =
  30;

const SESSION_MAX_AGE =
  1000 *
  60 *
  60 *
  24 *
  SESSION_DAYS;

const MAX_HISTORY =
  100;

const MAX_SAVED =
  200;

/* =========================================================
   ENVIRONMENT
   ========================================================= */

const OPENAI_API_KEY =
  String(
    process.env.OPENAI_API_KEY ||
      ""
  ).trim();

const AI_MODEL =
  String(
    process.env.OPENAI_MODEL ||
      "gpt-5.6-luna"
  ).trim();

const ADMIN_RESET_KEY =
  String(
    process.env.NEXUS_ADMIN_RESET_KEY ||
      ""
  );

const openai =
  OPENAI_API_KEY
    ? new OpenAI({
        apiKey:
          OPENAI_API_KEY
      })
    : null;

/* =========================================================
   EXPRESS
   ========================================================= */

app.disable(
  "x-powered-by"
);

app.use(
  express.json({
    limit:
      "1mb"
  })
);

app.use(
  express.urlencoded({
    extended:
      false,
    limit:
      "1mb"
  })
);

/* =========================================================
   DATABASE
   ========================================================= */

if (
  !fs.existsSync(
    DATA_DIR
  )
) {
  fs.mkdirSync(
    DATA_DIR,
    {
      recursive:
        true
    }
  );
}

function defaultDatabase() {
  return {
    users: [],
    sessions: {},
    history: {},
    saved: {},
    maintenance: {
      enabled:
        false,
      title:
        "NEXUS is temporarily offline",
      message:
        "The website is currently undergoing maintenance."
    }
  };
}

function normalizeDatabase(
  data
) {
  const defaults =
    defaultDatabase();

  const source =
    data &&
    typeof data ===
      "object"
      ? data
      : {};

  return {
    ...defaults,
    ...source,

    users:
      Array.isArray(
        source.users
      )
        ? source.users
        : [],

    sessions:
      source.sessions &&
      typeof source.sessions ===
        "object"
        ? source.sessions
        : {},

    history:
      source.history &&
      typeof source.history ===
        "object"
        ? source.history
        : {},

    saved:
      source.saved &&
      typeof source.saved ===
        "object"
        ? source.saved
        : {},

    maintenance: {
      ...defaults.maintenance,
      ...(source.maintenance &&
      typeof source.maintenance ===
        "object"
        ? source.maintenance
        : {})
    }
  };
}

function loadDatabase() {
  try {
    if (
      !fs.existsSync(
        DB_FILE
      )
    ) {
      const fresh =
        defaultDatabase();

      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(
          fresh,
          null,
          2
        ),
        "utf8"
      );

      return fresh;
    }

    const raw =
      fs.readFileSync(
        DB_FILE,
        "utf8"
      );

    return normalizeDatabase(
      JSON.parse(
        raw
      )
    );
  } catch (error) {
    console.error(
      "DATABASE LOAD ERROR:",
      error
    );

    return defaultDatabase();
  }
}

let db =
  loadDatabase();

let saveTimer =
  null;

function saveDatabaseNow() {
  const temporaryFile =
    `${DB_FILE}.tmp`;

  try {
    fs.writeFileSync(
      temporaryFile,
      JSON.stringify(
        db,
        null,
        2
      ),
      "utf8"
    );

    fs.renameSync(
      temporaryFile,
      DB_FILE
    );
  } catch (error) {
    console.error(
      "DATABASE SAVE ERROR:",
      error
    );

    try {
      if (
        fs.existsSync(
          temporaryFile
        )
      ) {
        fs.unlinkSync(
          temporaryFile
        );
      }
    } catch {}
  }
}

function saveDatabase() {
  if (saveTimer) {
    clearTimeout(
      saveTimer
    );
  }

  saveTimer =
    setTimeout(
      () => {
        saveTimer =
          null;

        saveDatabaseNow();
      },
      50
    );
}

function flushDatabase() {
  if (saveTimer) {
    clearTimeout(
      saveTimer
    );

    saveTimer =
      null;
  }

  saveDatabaseNow();
}

process.on(
  "SIGTERM",
  () => {
    flushDatabase();
    process.exit(0);
  }
);

process.on(
  "SIGINT",
  () => {
    flushDatabase();
    process.exit(0);
  }
);

/* =========================================================
   HELPERS
   ========================================================= */

function cleanText(
  value,
  max = 5000
) {
  return String(
    value ?? ""
  )
    .trim()
    .slice(
      0,
      max
    );
}

function normalizeUsername(
  value
) {
  return cleanText(
    value,
    32
  ).toLowerCase();
}

function escapeHTML(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function stripHTML(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /<[^>]*>/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function safeURL(
  value
) {
  try {
    const url =
      new URL(
        String(
          value
        )
      );

    if (
      url.protocol !==
        "https:" &&
      url.protocol !==
        "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

/* =========================================================
   FETCH TIMEOUT
   ========================================================= */

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 15000
) {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () =>
        controller.abort(),
      timeout
    );

  try {
    return await fetch(
      url,
      {
        ...options,
        signal:
          controller.signal
      }
    );
  } finally {
    clearTimeout(
      timer
    );
  }
}

/* =========================================================
   PASSWORDS
   ========================================================= */

function hashPassword(
  password,
  salt = crypto
    .randomBytes(
      16
    )
    .toString(
      "hex"
    )
) {
  const hash =
    crypto
      .scryptSync(
        password,
        salt,
        64
      )
      .toString(
        "hex"
      );

  return {
    salt,
    hash
  };
}

function verifyPassword(
  password,
  storedHash,
  salt
) {
  try {
    if (
      typeof password !==
        "string" ||
      typeof storedHash !==
        "string" ||
      typeof salt !==
        "string"
    ) {
      return false;
    }

    const calculated =
      crypto
        .scryptSync(
          password,
          salt,
          64
        )
        .toString(
          "hex"
        );

    const actual =
      Buffer.from(
        calculated,
        "hex"
      );

    const expected =
      Buffer.from(
        storedHash,
        "hex"
      );

    if (
      actual.length !==
      expected.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      actual,
      expected
    );
  } catch {
    return false;
  }
}

/* =========================================================
   USERS
   ========================================================= */

function findUser(
  username
) {
  const normalized =
    normalizeUsername(
      username
    );

  return db.users.find(
    user =>
      normalizeUsername(
        user.username
      ) ===
      normalized
  );
}

function isAdmin(
  user
) {
  return Boolean(
    user &&
    normalizeUsername(
      user.username
    ) ===
      normalizeUsername(
        ADMIN_USERNAME
      )
  );
}

function publicUser(
  user
) {
  return {
    id:
      user.id,
    username:
      user.username,
    isAdmin:
      isAdmin(
        user
      )
  };
}

/* =========================================================
   SESSIONS
   ========================================================= */

function hashSessionToken(
  token
) {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      token
    )
    .digest(
      "hex"
    );
}

function createSession(
  userId
) {
  const token =
    crypto
      .randomBytes(
        48
      )
      .toString(
        "hex"
      );

  const tokenHash =
    hashSessionToken(
      token
    );

  db.sessions[
    tokenHash
  ] = {
    userId,
    createdAt:
      Date.now(),
    expiresAt:
      Date.now() +
      SESSION_MAX_AGE
  };

  saveDatabase();

  return token;
}

function deleteUserSessions(
  userId
) {
  let changed =
    false;

  for (
    const [
      tokenHash,
      session
    ] of Object.entries(
      db.sessions
    )
  ) {
    if (
      session?.userId ===
      userId
    ) {
      delete db.sessions[
        tokenHash
      ];

      changed =
        true;
    }
  }

  if (changed) {
    saveDatabase();
  }
}

function cleanupExpiredSessions() {
  const now =
    Date.now();

  let changed =
    false;

  for (
    const [
      tokenHash,
      session
    ] of Object.entries(
      db.sessions
    )
  ) {
    if (
      !session ||
      !session.userId ||
      (
        session.expiresAt &&
        session.expiresAt <
          now
      )
    ) {
      delete db.sessions[
        tokenHash
      ];

      changed =
        true;
    }
  }

  if (changed) {
    saveDatabase();
  }
}

function getCookie(
  req,
  name
) {
  const cookies =
    req.headers.cookie;

  if (!cookies) {
    return null;
  }

  for (
    const part of cookies.split(";")
  ) {
    const [
      key,
      ...rest
    ] =
      part
        .trim()
        .split("=");

    if (
      key ===
      name
    ) {
      try {
        return decodeURIComponent(
          rest.join("=")
        );
      } catch {
        return null;
      }
    }
  }

  return null;
}

function getCurrentUser(
  req
) {
  const token =
    getCookie(
      req,
      "nexus_session"
    );

  if (!token) {
    return null;
  }

  const tokenHash =
    hashSessionToken(
      token
    );

  const session =
    db.sessions[
      tokenHash
    ];

  if (!session) {
    return null;
  }

  if (
    session.expiresAt &&
    session.expiresAt <
      Date.now()
  ) {
    delete db.sessions[
      tokenHash
    ];

    saveDatabase();

    return null;
  }

  const user =
    db.users.find(
      item =>
        item.id ===
        session.userId
    );

  if (!user) {
    delete db.sessions[
      tokenHash
    ];

    saveDatabase();

    return null;
  }

  return user;
}

function setSessionCookie(
  res,
  token
) {
  const cookie = [
    `nexus_session=${encodeURIComponent(
      token
    )}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(
      SESSION_MAX_AGE /
        1000
    )}`
  ];

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    cookie.push(
      "Secure"
    );
  }

  res.setHeader(
    "Set-Cookie",
    cookie.join(
      "; "
    )
  );
}

function clearSessionCookie(
  res
) {
  const cookie = [
    "nexus_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];

  if (
    process.env.NODE_ENV ===
    "production"
  ) {
    cookie.push(
      "Secure"
    );
  }

  res.setHeader(
    "Set-Cookie",
    cookie.join(
      "; "
    )
  );
}

/* =========================================================
   AUTH MIDDLEWARE
   ========================================================= */

function requireAuth(
  req,
  res,
  next
) {
  const user =
    getCurrentUser(
      req
    );

  if (!user) {
    return res
      .status(401)
      .json({
        error:
          "You must be signed in."
      });
  }

  req.user =
    user;

  next();
}

function requireAdmin(
  req,
  res,
  next
) {
  const user =
    getCurrentUser(
      req
    );

  if (!user) {
    return res
      .status(401)
      .json({
        error:
          "You must be signed in."
      });
  }

  if (!isAdmin(user)) {
    return res
      .status(403)
      .json({
        error:
          "Admin access required."
      });
  }

  req.user =
    user;

  next();
}

/* =========================================================
   HISTORY
   ========================================================= */

function addHistory(
  userId,
  data
) {
  db.history[
    userId
  ] ||= [];

  const query =
    cleanText(
      data.query,
      500
    );

  if (!query) {
    return;
  }

  const type =
    cleanText(
      data.type ||
        "web",
      30
    );

  const url =
    safeURL(
      data.url
    ) || "";

  const previous =
    db.history[
      userId
    ][0];

  if (
    previous &&
    previous.query ===
      query &&
    previous.type ===
      type &&
    Date.now() -
      Number(
        previous.createdAt ||
          0
      ) <
      5000
  ) {
    return;
  }

  db.history[
    userId
  ].unshift({
    id:
      crypto.randomUUID(),

    query,

    title:
      cleanText(
        data.title ||
          query,
        500
      ),

    url,

    type,

    createdAt:
      Date.now()
  });

  db.history[
    userId
  ] =
    db.history[
      userId
    ].slice(
      0,
      MAX_HISTORY
    );

  saveDatabase();
}

/* =========================================================
   MAINTENANCE
   ========================================================= */

const maintenanceAllowed =
  new Set([
    "/api/login",
    "/api/register",
    "/api/me",
    "/api/logout",
    "/api/maintenance",
    "/api/admin/status",
    "/api/admin/reset-password",
    "/api/health"
  ]);

app.use(
  (req, res, next) => {
    if (
      !db.maintenance.enabled
    ) {
      return next();
    }

    if (
      maintenanceAllowed.has(
        req.path
      )
    ) {
      return next();
    }

    const user =
      getCurrentUser(
        req
      );

    if (
      isAdmin(user)
    ) {
      return next();
    }

    if (
      req.path.startsWith(
        "/api/"
      )
    ) {
      return res
        .status(503)
        .json({
          error:
            "NEXUS is currently under maintenance."
        });
    }

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1"
        >
        <title>${escapeHTML(
          db.maintenance.title
        )}</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background:
              radial-gradient(
                circle at top,
                #17172a,
                #08080c 60%
              );
            color: white;
            font-family:
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .box {
            width: min(620px,100%);
            padding: 42px 32px;
            text-align: center;
            border: 1px solid rgba(255,255,255,.1);
            border-radius: 28px;
            background: rgba(20,20,30,.9);
            box-shadow:
              0 30px 100px
              rgba(0,0,0,.5);
          }

          .icon {
            font-size: 48px;
            margin-bottom: 18px;
          }

          h1 {
            margin: 0 0 12px;
          }

          p {
            margin: 0;
            color: #aaa;
            line-height: 1.7;
          }
        </style>
      </head>

      <body>
        <main class="box">
          <div class="icon">✦</div>

          <h1>
            ${escapeHTML(
              db.maintenance.title
            )}
          </h1>

          <p>
            ${escapeHTML(
              db.maintenance.message
            )}
          </p>
        </main>
      </body>
      </html>
    `);
  }
);

/* =========================================================
   REGISTER
   ========================================================= */

app.post(
  "/api/register",
  (req, res) => {
    const username =
      cleanText(
        req.body?.username,
        32
      );

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
      return res
        .status(400)
        .json({
          error:
            "Username must be 3-32 characters and use only letters, numbers, or underscores."
        });
    }

    if (
      password.length <
      8
    ) {
      return res
        .status(400)
        .json({
          error:
            "Password must be at least 8 characters."
        });
    }

    if (
      password.length >
      256
    ) {
      return res
        .status(400)
        .json({
          error:
            "Password is too long."
        });
    }

    if (
      findUser(
        username
      )
    ) {
      return res
        .status(409)
        .json({
          error:
            "That username is already taken."
        });
    }

    const {
      salt,
      hash
    } =
      hashPassword(
        password
      );

    const user = {
      id:
        crypto.randomUUID(),

      username,

      passwordHash:
        hash,

      passwordSalt:
        salt,

      passwordVersion:
        1,

      createdAt:
        Date.now()
    };

    db.users.push(
      user
    );

    db.history[
      user.id
    ] ||= [];

    db.saved[
      user.id
    ] ||= [];

    const token =
      createSession(
        user.id
      );

    saveDatabase();

    setSessionCookie(
      res,
      token
    );

    return res.json({
      user:
        publicUser(
          user
        )
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
      cleanText(
        req.body?.username,
        32
      );

    const password =
      String(
        req.body?.password ||
          ""
      );

    if (!username) {
      return res
        .status(400)
        .json({
          error:
            "Please enter your username."
        });
    }

    if (!password) {
      return res
        .status(400)
        .json({
          error:
            "Please enter your password."
        });
    }

    const user =
      findUser(
        username
      );

    if (
      !user ||
      !verifyPassword(
        password,
        user.passwordHash,
        user.passwordSalt
      )
    ) {
      return res
        .status(401)
        .json({
          error:
            "Invalid username or password."
        });
    }

    const token =
      createSession(
        user.id
      );

    setSessionCookie(
      res,
      token
    );

    return res.json({
      user:
        publicUser(
          user
        )
    });
  }
);

/* =========================================================
   LOGOUT
   ========================================================= */

app.post(
  "/api/logout",
  (req, res) => {
    const token =
      getCookie(
        req,
        "nexus_session"
      );

    if (token) {
      const hash =
        hashSessionToken(
          token
        );

      delete db.sessions[
        hash
      ];

      saveDatabase();
    }

    clearSessionCookie(
      res
    );

    return res.json({
      success:
        true
    });
  }
);

/* =========================================================
   ME
   ========================================================= */

app.get(
  "/api/me",
  (req, res) => {
    const user =
      getCurrentUser(
        req
      );

    if (!user) {
      return res
        .status(401)
        .json({
          error:
            "Not signed in."
        });
    }

    return res.json({
      user:
        publicUser(
          user
        )
    });
  }
);

/* =========================================================
   ADMIN PASSWORD RESET
   ========================================================= */

function safeCompare(
  a,
  b
) {
  try {
    const left =
      Buffer.from(
        String(a || ""),
        "utf8"
      );

    const right =
      Buffer.from(
        String(b || ""),
        "utf8"
      );

    if (
      left.length !==
      right.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      left,
      right
    );
  } catch {
    return false;
  }
}

app.post(
  "/api/admin/reset-password",
  async (req, res) => {
    const username =
      cleanText(
        req.body?.username,
        32
      );

    const newPassword =
      String(
        req.body?.newPassword ||
          ""
      );

    const resetKey =
      String(
        req.body?.resetKey ||
          ""
      );

    const loggedInUser =
      getCurrentUser(
        req
      );

    const authenticatedAdmin =
      isAdmin(
        loggedInUser
      );

    const emergencyValid =
      Boolean(
        ADMIN_RESET_KEY &&
        safeCompare(
          resetKey,
          ADMIN_RESET_KEY
        )
      );

    if (
      !authenticatedAdmin &&
      !emergencyValid
    ) {
      return res
        .status(403)
        .json({
          error:
            "Admin authentication or a valid NEXUS_ADMIN_RESET_KEY is required."
        });
    }

    if (
      !/^[a-zA-Z0-9_]{3,32}$/.test(
        username
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Invalid username."
        });
    }

    if (
      newPassword.length <
      8
    ) {
      return res
        .status(400)
        .json({
          error:
            "New password must be at least 8 characters."
        });
    }

    if (
      newPassword.length >
      256
    ) {
      return res
        .status(400)
        .json({
          error:
            "New password is too long."
        });
    }

    const user =
      findUser(
        username
      );

    if (!user) {
      return res
        .status(404)
        .json({
          error:
            "User not found."
        });
    }

    const {
      salt,
      hash
    } =
      hashPassword(
        newPassword
      );

    user.passwordHash =
      hash;

    user.passwordSalt =
      salt;

    user.passwordVersion =
      1;

    user.passwordChangedAt =
      Date.now();

    deleteUserSessions(
      user.id
    );

    saveDatabase();

    return res.json({
      success:
        true,

      message:
        `Password reset successfully for ${user.username}.`,

      username:
        user.username
    });
  }
);

/* =========================================================
   AI
   ========================================================= */

app.post(
  "/api/ai",
  requireAuth,
  async (req, res) => {
    try {
      if (!openai) {
        return res
          .status(503)
          .json({
            error:
              "NEXUS AI is not configured. Add OPENAI_API_KEY to your Railway environment variables."
          });
      }

      const query =
        cleanText(
          req.body?.query,
          8000
        );

      if (!query) {
        return res
          .status(400)
          .json({
            error:
              "Please enter a question."
          });
      }

      const response =
        await openai.responses.create(
          {
            model:
              AI_MODEL,

            instructions:
              "You are NEXUS AI, the built-in assistant for the NEXUS search engine. Give clear, useful and accurate answers. Be concise unless the user asks for detail. Use short paragraphs and bullet points when useful. Do not claim to have searched the web unless a web-search tool is actually enabled.",

            input:
              query,

            store:
              false
          }
        );

      const answer =
        response.output_text ||
        "I couldn't generate an answer.";

      addHistory(
        req.user.id,
        {
          query,

          title:
            `AI: ${query}`,

          url:
            `${req.protocol}://${req.get(
              "host"
            )}/?q=${encodeURIComponent(
              query
            )}&tab=ai`,

          type:
            "ai"
        }
      );

      return res.json({
        answer,
        model:
          AI_MODEL
      });
    } catch (error) {
      console.error(
        "NEXUS AI ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "NEXUS AI couldn't respond right now."
        });
    }
  }
);

/* =========================================================
   WEB SEARCH
   ========================================================= */

app.get(
  "/api/search",
  requireAuth,
  async (req, res) => {
    const query =
      cleanText(
        req.query?.q,
        300
      );

    if (!query) {
      return res
        .status(400)
        .json({
          error:
            "Search query is required."
        });
    }

    try {
      const apiURL =
        "https://en.wikipedia.org/w/api.php" +
        "?action=query" +
        "&list=search" +
        `&srsearch=${encodeURIComponent(
          query
        )}` +
        "&format=json" +
        "&utf8=1" +
        "&srlimit=12" +
        "&origin=*";

      const response =
        await fetchWithTimeout(
          apiURL,
          {
            headers: {
              "User-Agent":
                "NEXUS/1.0"
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          `Wikipedia returned ${response.status}`
        );
      }

      const data =
        await response.json();

      const pages =
        data?.query?.search ||
        [];

      const results =
        pages
          .map(
            item => {
              const title =
                stripHTML(
                  item.title
                );

              const url =
                `https://en.wikipedia.org/wiki/${encodeURIComponent(
                  title.replaceAll(
                    " ",
                    "_"
                  )
                )}`;

              return {
                title,

                description:
                  stripHTML(
                    item.snippet ||
                      "No description available."
                  ),

                url,

                source:
                  "Wikipedia"
              };
            }
          )
          .filter(
            item =>
              safeURL(
                item.url
              )
          );

      addHistory(
        req.user.id,
        {
          query,

          title:
            results[0]?.title ||
            query,

          url:
            results[0]?.url ||
            `${req.protocol}://${req.get(
              "host"
            )}/`,

          type:
            "web"
        }
      );

      return res.json({
        mode:
          "results",

        results,

        query
      });
    } catch (error) {
      console.error(
        "WEB SEARCH ERROR:",
        error
      );

      return res
        .status(502)
        .json({
          error:
            "NEXUS could not reach its web search provider right now."
        });
    }
  }
);

/* =========================================================
   NEWS SEARCH
   ========================================================= */

app.get(
  "/api/news",
  requireAuth,
  async (req, res) => {
    const query =
      cleanText(
        req.query?.q,
        300
      );

    if (!query) {
      return res
        .status(400)
        .json({
          error:
            "Search query is required."
        });
    }

    try {
      const apiURL =
        "https://api.gdeltproject.org/api/v2/doc/doc" +
        `?query=${encodeURIComponent(
          query
        )}` +
        "&mode=ArtList" +
        "&maxrecords=20" +
        "&format=json" +
        "&sort=HybridRel";

      const response =
        await fetchWithTimeout(
          apiURL,
          {
            headers: {
              "User-Agent":
                "NEXUS/1.0"
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          `GDELT returned ${response.status}`
        );
      }

      const data =
        await response.json();

      const articles =
        Array.isArray(
          data?.articles
        )
          ? data.articles
          : [];

      const results =
        articles
          .map(
            article => {
              const url =
                safeURL(
                  article.url
                );

              if (!url) {
                return null;
              }

              return {
                title:
                  cleanText(
                    article.title ||
                      "Untitled article",
                    500
                  ),

                description:
                  article.seendate
                    ? `Published ${formatGDELTDate(
                        article.seendate
                      )}`
                    : "News article",

                url,

                source:
                  cleanText(
                    article.domain ||
                      article.sourcecountry ||
                      "News source",
                    200
                  ),

                image:
                  safeURL(
                    article.socialimage
                  ) || null,

                date:
                  article.seendate ||
                  null
              };
            }
          )
          .filter(
            Boolean
          );

      addHistory(
        req.user.id,
        {
          query,

          title:
            results[0]?.title ||
            `News: ${query}`,

          url:
            results[0]?.url ||
            `${req.protocol}://${req.get(
              "host"
            )}/`,

          type:
            "news"
        }
      );

      return res.json({
        mode:
          "results",

        results,

        query
      });
    } catch (error) {
      console.error(
        "NEWS SEARCH ERROR:",
        error
      );

      return res
        .status(502)
        .json({
          error:
            "NEXUS could not reach its news provider right now."
        });
    }
  }
);

function formatGDELTDate(
  value
) {
  const text =
    String(
      value || ""
    );

  const match =
    text.match(
      /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/
    );

  if (!match) {
    return text;
  }

  const [
    ,
    year,
    month,
    day,
    hour,
    minute
  ] =
    match;

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/* =========================================================
   IMAGE SEARCH
   ========================================================= */

app.get(
  "/api/images",
  requireAuth,
  async (req, res) => {
    const query =
      cleanText(
        req.query?.q,
        300
      );

    if (!query) {
      return res
        .status(400)
        .json({
          error:
            "Search query is required."
        });
    }

    try {
      const apiURL =
        "https://commons.wikimedia.org/w/api.php" +
        "?action=query" +
        "&generator=search" +
        `&gsrsearch=${encodeURIComponent(
          query
        )}` +
        "&gsrnamespace=6" +
        "&gsrlimit=30" +
        "&prop=imageinfo" +
        "&iiprop=url|mime|size|extmetadata" +
        "&iiurlwidth=700" +
        "&format=json" +
        "&origin=*";

      const response =
        await fetchWithTimeout(
          apiURL,
          {
            headers: {
              "User-Agent":
                "NEXUS/1.0"
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          `Commons returned ${response.status}`
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
          .map(
            page => {
              const info =
                page.imageinfo?.[0];

              if (!info) {
                return null;
              }

              const mime =
                String(
                  info.mime ||
                    ""
                ).toLowerCase();

              if (
                !mime.startsWith(
                  "image/"
                )
              ) {
                return null;
              }

              const imageURL =
                safeURL(
                  info.thumburl ||
                    info.url
                );

              const sourceURL =
                safeURL(
                  info.descriptionurl
                );

              if (
                !imageURL ||
                !sourceURL
              ) {
                return null;
              }

              const metadata =
                info.extmetadata ||
                {};

              return {
                title:
                  cleanText(
                    page.title
                      ?.replace(
                        /^File:/,
                        ""
                      ) ||
                      "Image",
                    500
                  ),

                url:
                  imageURL,

                source:
                  sourceURL,

                width:
                  info.width ||
                  null,

                height:
                  info.height ||
                  null,

                artist:
                  cleanText(
                    stripHTML(
                      metadata
                        .Artist
                        ?.value ||
                        ""
                    ),
                    300
                  )
              };
            }
          )
          .filter(
            Boolean
          );

      addHistory(
        req.user.id,
        {
          query,

          title:
            `Images: ${query}`,

          url:
            results[0]?.source ||
            `${req.protocol}://${req.get(
              "host"
            )}/`,

          type:
            "images"
        }
      );

      return res.json({
        mode:
          "results",

        results,

        query
      });
    } catch (error) {
      console.error(
        "IMAGE SEARCH ERROR:",
        error
      );

      return res
        .status(502)
        .json({
          error:
            "NEXUS could not reach its image provider right now."
        });
    }
  }
);

/* =========================================================
   VIDEO SEARCH
   ========================================================= */

app.get(
  "/api/videos",
  requireAuth,
  async (req, res) => {
    const query =
      cleanText(
        req.query?.q,
        300
      );

    if (!query) {
      return res
        .status(400)
        .json({
          error:
            "Search query is required."
        });
    }

    try {
      const searchQuery =
        `${query} filetype:video`;

      const apiURL =
        "https://commons.wikimedia.org/w/api.php" +
        "?action=query" +
        "&generator=search" +
        `&gsrsearch=${encodeURIComponent(
          searchQuery
        )}` +
        "&gsrnamespace=6" +
        "&gsrlimit=30" +
        "&prop=imageinfo" +
        "&iiprop=url|mime|size|extmetadata" +
        "&iiurlwidth=640" +
        "&format=json" +
        "&origin=*";

      const response =
        await fetchWithTimeout(
          apiURL,
          {
            headers: {
              "User-Agent":
                "NEXUS/1.0"
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          `Commons returned ${response.status}`
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
          .map(
            page => {
              const info =
                page.imageinfo?.[0];

              if (!info) {
                return null;
              }

              const mime =
                String(
                  info.mime ||
                    ""
                ).toLowerCase();

              if (
                !mime.startsWith(
                  "video/"
                )
              ) {
                return null;
              }

              const videoURL =
                safeURL(
                  info.url
                );

              if (!videoURL) {
                return null;
              }

              return {
                title:
                  cleanText(
                    page.title
                      ?.replace(
                        /^File:/,
                        ""
                      ) ||
                      "Video",
                    500
                  ),

                url:
                  videoURL,

                poster:
                  safeURL(
                    info.thumburl
                  ),

                source:
                  safeURL(
                    info.descriptionurl
                  ) ||
                  videoURL,

                mime,

                width:
                  info.width ||
                  null,

                height:
                  info.height ||
                  null
              };
            }
          )
          .filter(
            Boolean
          );

      addHistory(
        req.user.id,
        {
          query,

          title:
            `Videos: ${query}`,

          url:
            results[0]?.source ||
            `${req.protocol}://${req.get(
              "host"
            )}/`,

          type:
            "videos"
        }
      );

      return res.json({
        mode:
          "results",

        results,

        query
      });
    } catch (error) {
      console.error(
        "VIDEO SEARCH ERROR:",
        error
      );

      return res
        .status(502)
        .json({
          error:
            "NEXUS could not reach its video provider right now."
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
    return res.json({
      history:
        Array.isArray(
          db.history[
            req.user.id
          ]
        )
          ? db.history[
              req.user.id
            ]
          : []
    });
  }
);

app.delete(
  "/api/history",
  requireAuth,
  (req, res) => {
    db.history[
      req.user.id
    ] = [];

    saveDatabase();

    return res.json({
      success:
        true
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
    return res.json({
      saved:
        Array.isArray(
          db.saved[
            req.user.id
          ]
        )
          ? db.saved[
              req.user.id
            ]
          : []
    });
  }
);

app.post(
  "/api/saved",
  requireAuth,
  (req, res) => {
    const title =
      cleanText(
        req.body?.title,
        500
      );

    const url =
      safeURL(
        req.body?.url
      );

    if (
      !title ||
      !url
    ) {
      return res
        .status(400)
        .json({
          error:
            "A valid title and URL are required."
        });
    }

    db.saved[
      req.user.id
    ] ||= [];

    const exists =
      db.saved[
        req.user.id
      ].some(
        item =>
          item.url ===
          url
      );

    if (exists) {
      return res.json({
        success:
          true,

        alreadySaved:
          true
      });
    }

    db.saved[
      req.user.id
    ].unshift({
      id:
        crypto.randomUUID(),

      title,

      url,

      createdAt:
        Date.now()
    });

    db.saved[
      req.user.id
    ] =
      db.saved[
        req.user.id
      ].slice(
        0,
        MAX_SAVED
      );

    saveDatabase();

    return res.json({
      success:
        true,

      alreadySaved:
        false
    });
  }
);

app.delete(
  "/api/saved",
  requireAuth,
  (req, res) => {
    db.saved[
      req.user.id
    ] = [];

    saveDatabase();

    return res.json({
      success:
        true
    });
  }
);

app.delete(
  "/api/saved/:id",
  requireAuth,
  (req, res) => {
    db.saved[
      req.user.id
    ] ||= [];

    db.saved[
      req.user.id
    ] =
      db.saved[
        req.user.id
      ].filter(
        item =>
          item.id !==
          req.params.id
      );

    saveDatabase();

    return res.json({
      success:
        true
    });
  }
);

/* =========================================================
   ADMIN
   ========================================================= */

app.get(
  "/api/admin/status",
  requireAdmin,
  (req, res) => {
    cleanupExpiredSessions();

    return res.json({
      maintenance:
        Boolean(
          db.maintenance
            ?.enabled
        ),

      title:
        db.maintenance
          ?.title ||
        "NEXUS is temporarily offline",

      message:
        db.maintenance
          ?.message ||
        "The website is currently undergoing maintenance.",

      users:
        db.users.length,

      sessions:
        Object.keys(
          db.sessions
        ).length,

      passwordReset:
        Boolean(
          ADMIN_RESET_KEY
        )
    });
  }
);

app.post(
  "/api/admin/lock",
  requireAdmin,
  (req, res) => {
    db.maintenance = {
      enabled:
        true,

      title:
        cleanText(
          req.body?.title,
          200
        ) ||
        "NEXUS is temporarily offline",

      message:
        cleanText(
          req.body?.message,
          1000
        ) ||
        "The website is currently undergoing maintenance."
    };

    saveDatabase();

    return res.json({
      success:
        true
    });
  }
);

app.post(
  "/api/admin/unlock",
  requireAdmin,
  (req, res) => {
    db.maintenance.enabled =
      false;

    saveDatabase();

    return res.json({
      success:
        true
    });
  }
);

/* =========================================================
   MAINTENANCE STATUS
   ========================================================= */

app.get(
  "/api/maintenance",
  (req, res) => {
    return res.json({
      enabled:
        Boolean(
          db.maintenance
            ?.enabled
        ),

      title:
        db.maintenance
          ?.title ||
        "NEXUS is temporarily offline",

      message:
        db.maintenance
          ?.message ||
        "The website is currently undergoing maintenance."
    });
  }
);

/* =========================================================
   HEALTH
   ========================================================= */

app.get(
  "/api/health",
  (req, res) => {
    return res.json({
      ok:
        true,

      app:
        "NEXUS",

      uptime:
        process.uptime(),

      timestamp:
        Date.now()
    });
  }
);

/* =========================================================
   STATIC FILES
   ========================================================= */

app.use(
  express.static(
    PUBLIC_DIR,
    {
      extensions:
        ["html"],

      maxAge:
        process.env.NODE_ENV ===
        "production"
          ? "1h"
          : 0
    }
  )
);

/* =========================================================
   EXPRESS 5 SPA FALLBACK
   ========================================================= */

app.get(
  "*splat",
  (req, res) => {
    const indexPath =
      path.join(
        PUBLIC_DIR,
        "index.html"
      );

    if (
      !fs.existsSync(
        indexPath
      )
    ) {
      return res
        .status(500)
        .send(
          "NEXUS frontend is missing."
        );
    }

    return res.sendFile(
      indexPath
    );
  }
);

/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "UNHANDLED SERVER ERROR:",
      error
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    return res
      .status(500)
      .json({
        error:
          "NEXUS encountered an unexpected server error."
      });
  }
);

/* =========================================================
   SESSION CLEANUP
   ========================================================= */

cleanupExpiredSessions();

setInterval(
  () => {
    cleanupExpiredSessions();
  },
  1000 *
    60 *
    60
).unref();

/* =========================================================
   START
   ========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      "===================================="
    );

    console.log(
      "       NEXUS SERVER ONLINE"
    );

    console.log(
      "===================================="
    );

    console.log(
      `Port: ${PORT}`
    );

    console.log(
      `Environment: ${
        process.env.NODE_ENV ||
        "development"
      }`
    );

    console.log(
      `AI backend: ${
        openai
          ? `ENABLED (${AI_MODEL})`
          : "DISABLED"
      }`
    );

    console.log(
      `Admin username: ${ADMIN_USERNAME}`
    );

    console.log(
      `Admin recovery: ${
        ADMIN_RESET_KEY
          ? "ENABLED"
          : "DISABLED"
      }`
    );

    console.log(
      `Maintenance: ${
        db.maintenance.enabled
          ? "LOCKED"
          : "ONLINE"
      }`
    );

    console.log(
      `Users: ${db.users.length}`
    );

    console.log(
      "===================================="
    );
  }
);
