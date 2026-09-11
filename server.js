import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import OpenAI from "openai";

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_USERNAME = "CALSGC";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

/* =========================
   OPENAI
========================= */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const AI_MODEL =
  process.env.OPENAI_MODEL || "gpt-5.6-luna";

const openai = OPENAI_API_KEY
  ? new OpenAI({
      apiKey: OPENAI_API_KEY
    })
  : null;

/* =========================
   APP
========================= */

app.use(
  express.json({
    limit: "1mb"
  })
);

app.use(
  express.urlencoded({
    extended: false
  })
);

/* =========================
   DATABASE
========================= */

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, {
    recursive: true
  });
}

function defaultDatabase() {
  return {
    users: [],
    sessions: {},
    history: {},
    saved: {},
    maintenance: {
      enabled: false,
      title: "NEXUS is temporarily offline",
      message:
        "The website is currently undergoing maintenance."
    }
  };
}

function loadDatabase() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const fresh = defaultDatabase();

      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(fresh, null, 2)
      );

      return fresh;
    }

    const raw = fs.readFileSync(
      DB_FILE,
      "utf8"
    );

    const parsed = JSON.parse(raw);

    return {
      ...defaultDatabase(),
      ...parsed,
      users: Array.isArray(parsed.users)
        ? parsed.users
        : [],
      sessions: parsed.sessions || {},
      history: parsed.history || {},
      saved: parsed.saved || {}
    };
  } catch {
    return defaultDatabase();
  }
}

let db = loadDatabase();

function saveDatabase() {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2)
  );
}

/* =========================
   HELPERS
========================= */

function cleanText(value, max = 5000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stripHTML(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    isAdmin:
      user.username.toLowerCase() ===
      ADMIN_USERNAME.toLowerCase()
  };
}

function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString("hex")
) {
  const hash =
    crypto.scryptSync(
      password,
      salt,
      64
    ).toString("hex");

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
    const hash =
      crypto
        .scryptSync(
          password,
          salt,
          64
        )
        .toString("hex");

    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}

function createSession(userId) {
  const token =
    crypto.randomBytes(48).toString("hex");

  const tokenHash =
    crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

  db.sessions[tokenHash] = {
    userId,
    createdAt: Date.now(),
    expiresAt:
      Date.now() +
      1000 * 60 * 60 * 24 * 30
  };

  saveDatabase();

  return token;
}

function getCookie(req, name) {
  const cookies =
    req.headers.cookie;

  if (!cookies) {
    return null;
  }

  const parts =
    cookies.split(";");

  for (const part of parts) {
    const [key, ...rest] =
      part.trim().split("=");

    if (key === name) {
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

function getCurrentUser(req) {
  const token =
    getCookie(
      req,
      "nexus_session"
    );

  if (!token) {
    return null;
  }

  const tokenHash =
    crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

  const session =
    db.sessions[tokenHash];

  if (!session) {
    return null;
  }

  if (
    session.expiresAt &&
    session.expiresAt < Date.now()
  ) {
    delete db.sessions[tokenHash];
    saveDatabase();
    return null;
  }

  return (
    db.users.find(
      user =>
        user.id ===
        session.userId
    ) || null
  );
}

function setSessionCookie(
  res,
  token
) {
  res.setHeader(
    "Set-Cookie",
    [
      `nexus_session=${encodeURIComponent(
        token
      )}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${60 * 60 * 24 * 30}`,
      process.env.NODE_ENV ===
      "production"
        ? "Secure"
        : ""
    ]
      .filter(Boolean)
      .join("; ")
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    [
      "nexus_session=",
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
      process.env.NODE_ENV ===
      "production"
        ? "Secure"
        : ""
    ]
      .filter(Boolean)
      .join("; ")
  );
}

function requireAuth(
  req,
  res,
  next
) {
  const user =
    getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      error:
        "You must be signed in."
    });
  }

  req.user = user;

  next();
}

function requireAdmin(
  req,
  res,
  next
) {
  const user =
    getCurrentUser(req);

  if (!user) {
    return res.status(401).json({
      error:
        "You must be signed in."
    });
  }

  if (
    user.username.toLowerCase() !==
    ADMIN_USERNAME.toLowerCase()
  ) {
    return res.status(403).json({
      error:
        "Admin access required."
    });
  }

  req.user = user;

  next();
}

/* =========================
   HISTORY HELPER
========================= */

function addHistory(
  userId,
  data
) {
  db.history[userId] ||= [];

  db.history[userId].unshift({
    id: crypto.randomUUID(),
    query: cleanText(
      data.query,
      500
    ),
    title: cleanText(
      data.title || data.query,
      500
    ),
    url: safeURL(data.url) || "",
    type:
      cleanText(
        data.type || "web",
        30
      ),
    createdAt: Date.now()
  });

  db.history[userId] =
    db.history[userId].slice(
      0,
      100
    );

  saveDatabase();
}

/* =========================
   MAINTENANCE
========================= */

app.use(
  (req, res, next) => {
    const publicPaths = [
      "/api/login",
      "/api/register",
      "/api/me",
      "/api/logout",
      "/api/maintenance",
      "/api/admin/status"
    ];

    if (
      db.maintenance.enabled &&
      !publicPaths.includes(req.path)
    ) {
      const user =
        getCurrentUser(req);

      const isAdminUser =
        user &&
        user.username.toLowerCase() ===
          ADMIN_USERNAME.toLowerCase();

      if (!isAdminUser) {
        if (
          req.path.startsWith(
            "/api/"
          )
        ) {
          return res.status(503).json({
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
              body {
                margin:0;
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#08080c;
                color:#fff;
                font-family:Arial,sans-serif;
                padding:24px;
                box-sizing:border-box;
              }

              .box {
                width:min(600px,100%);
                text-align:center;
                padding:40px;
                border:1px solid #262630;
                border-radius:24px;
                background:#111118;
                box-shadow:0 20px 70px rgba(0,0,0,.4);
              }

              h1 {
                margin:0 0 12px;
              }

              p {
                color:#aaa;
                line-height:1.6;
              }
            </style>
          </head>
          <body>
            <div class="box">
              <h1>${escapeHTML(
                db.maintenance.title
              )}</h1>
              <p>${escapeHTML(
                db.maintenance.message
              )}</p>
            </div>
          </body>
          </html>
        `);
      }
    }

    next();
  }
);

/* =========================
   AUTH
========================= */

app.post(
  "/api/register",
  (req, res) => {
    const username =
      cleanText(
        req.body.username,
        32
      );

    const password =
      String(
        req.body.password || ""
      );

    if (
      !/^[a-zA-Z0-9_]{3,32}$/.test(
        username
      )
    ) {
      return res.status(400).json({
        error:
          "Username must be 3-32 characters and use only letters, numbers, or underscores."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters."
      });
    }

    const exists =
      db.users.some(
        user =>
          user.username.toLowerCase() ===
          username.toLowerCase()
      );

    if (exists) {
      return res.status(409).json({
        error:
          "That username is already taken."
      });
    }

    const {
      salt,
      hash
    } =
      hashPassword(password);

    const user = {
      id:
        crypto.randomUUID(),
      username,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: Date.now()
    };

    db.users.push(user);

    db.history[user.id] ||= [];
    db.saved[user.id] ||= [];

    const token =
      createSession(user.id);

    saveDatabase();

    setSessionCookie(
      res,
      token
    );

    res.json({
      user: publicUser(user)
    });
  }
);

app.post(
  "/api/login",
  (req, res) => {
    const username =
      cleanText(
        req.body.username,
        32
      );

    const password =
      String(
        req.body.password || ""
      );

    const user =
      db.users.find(
        item =>
          item.username.toLowerCase() ===
          username.toLowerCase()
      );

    if (
      !user ||
      !verifyPassword(
        password,
        user.passwordHash,
        user.passwordSalt
      )
    ) {
      return res.status(401).json({
        error:
          "Invalid username or password."
      });
    }

    const token =
      createSession(user.id);

    setSessionCookie(
      res,
      token
    );

    res.json({
      user: publicUser(user)
    });
  }
);

app.post(
  "/api/logout",
  (req, res) => {
    const token =
      getCookie(
        req,
        "nexus_session"
      );

    if (token) {
      const tokenHash =
        crypto
          .createHash("sha256")
          .update(token)
          .digest("hex");

      delete db.sessions[
        tokenHash
      ];

      saveDatabase();
    }

    clearSessionCookie(res);

    res.json({
      success: true
    });
  }
);

app.get(
  "/api/me",
  (req, res) => {
    const user =
      getCurrentUser(req);

    if (!user) {
      return res.status(401).json({
        error:
          "Not signed in."
      });
    }

    res.json({
      user: publicUser(user)
    });
  }
);

/* =========================
   AI
========================= */

app.post(
  "/api/ai",
  requireAuth,
  async (req, res) => {
    try {
      if (!openai) {
        return res.status(503).json({
          error:
            "NEXUS AI is not configured. Add OPENAI_API_KEY to your Railway environment variables."
        });
      }

      const query =
        cleanText(
          req.body.query,
          8000
        );

      if (!query) {
        return res.status(400).json({
          error:
            "Please enter a question."
        });
      }

      const response =
        await openai.responses.create({
          model: AI_MODEL,

          instructions:
            "You are NEXUS AI, the built-in assistant for the NEXUS search engine. Give clear, useful, accurate answers. Be concise unless the user asks for detail. Use simple formatting with short paragraphs and bullet points when useful. Do not claim to have searched the web unless a web-search tool is actually enabled.",

          input: query,

          store: false
        });

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
            )}`,
          type: "ai"
        }
      );

      res.json({
        answer,
        model: AI_MODEL
      });
    } catch (error) {
      console.error(
        "NEXUS AI ERROR:",
        error
      );

      res.status(500).json({
        error:
          "NEXUS AI couldn't respond right now."
      });
    }
  }
);

/* =========================
   WEB SEARCH
   WIKIPEDIA
========================= */

app.get(
  "/api/search",
  requireAuth,
  async (req, res) => {
    const query =
      cleanText(
        req.query.q,
        300
      );

    if (!query) {
      return res.status(400).json({
        error:
          "Search query is required."
      });
    }

    try {
      const apiURL =
        "https://en.wikipedia.org/w/api.php" +
        `?action=query` +
        `&list=search` +
        `&srsearch=${encodeURIComponent(
          query
        )}` +
        `&format=json` +
        `&utf8=1` +
        `&srlimit=12` +
        `&origin=*`;

      const response =
        await fetch(apiURL, {
          headers: {
            "User-Agent":
              "NEXUS/1.0"
          }
        });

      if (!response.ok) {
        throw new Error(
          `Wikipedia returned ${response.status}`
        );
      }

      const data =
        await response.json();

      const pages =
        data?.query?.search || [];

      const results =
        pages.map(item => {
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
        });

      if (!results.length) {
        return res.json({
          mode: "results",
          results: [],
          query
        });
      }

      addHistory(
        req.user.id,
        {
          query,
          title:
            results[0].title,
          url:
            results[0].url,
          type: "web"
        }
      );

      return res.json({
        mode: "results",
        results,
        query
      });
    } catch (error) {
      console.error(
        "WEB SEARCH ERROR:",
        error
      );

      return res.status(502).json({
        error:
          "NEXUS could not reach its web search provider right now."
      });
    }
  }
);

/* =========================
   NEWS SEARCH
   GDELT
========================= */

app.get(
  "/api/news",
  requireAuth,
  async (req, res) => {
    const query =
      cleanText(
        req.query.q,
        300
      );

    if (!query) {
      return res.status(400).json({
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
        `&mode=ArtList` +
        `&maxrecords=20` +
        `&format=json` +
        `&sort=HybridRel`;

      const response =
        await fetch(apiURL, {
          headers: {
            "User-Agent":
              "NEXUS/1.0"
          }
        });

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
          .map(article => {
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
                cleanText(
                  article.seendate
                    ? `Published ${formatGDELTDate(
                        article.seendate
                      )}`
                    : "News article",
                  1000
                ),

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
          })
          .filter(Boolean);

      if (results.length) {
        addHistory(
          req.user.id,
          {
            query,
            title:
              results[0].title,
            url:
              results[0].url,
            type: "news"
          }
        );
      } else {
        addHistory(
          req.user.id,
          {
            query,
            title:
              `News: ${query}`,
            url:
              `${req.protocol}://${req.get(
                "host"
              )}/`,
            type: "news"
          }
        );
      }

      res.json({
        mode: "results",
        results,
        query
      });
    } catch (error) {
      console.error(
        "NEWS SEARCH ERROR:",
        error
      );

      res.status(502).json({
        error:
          "NEXUS could not reach its news provider right now."
      });
    }
  }
);

function formatGDELTDate(value) {
  const text =
    String(value || "");

  if (text.length < 8) {
    return text;
  }

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
  ] = match;

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/* =========================
   IMAGE SEARCH
   WIKIMEDIA COMMONS
========================= */

app.get(
  "/api/images",
  requireAuth,
  async (req, res) => {
    const query =
      cleanText(
        req.query.q,
        300
      );

    if (!query) {
      return res.status(400).json({
        error:
          "Search query is required."
      });
    }

    try {
      const apiURL =
        "https://commons.wikimedia.org/w/api.php" +
        `?action=query` +
        `&generator=search` +
        `&gsrsearch=${encodeURIComponent(
          query
        )}` +
        `&gsrnamespace=6` +
        `&gsrlimit=30` +
        `&prop=imageinfo` +
        `&iiprop=url|mime|size|extmetadata` +
        `&iiurlwidth=700` +
        `&format=json` +
        `&origin=*`;

      const response =
        await fetch(apiURL, {
          headers: {
            "User-Agent":
              "NEXUS/1.0"
          }
        });

      if (!response.ok) {
        throw new Error(
          `Commons returned ${response.status}`
        );
      }

      const data =
        await response.json();

      const pages =
        Object.values(
          data?.query?.pages || {}
        );

      const results =
        pages
          .map(page => {
            const info =
              page.imageinfo?.[0];

            if (!info) {
              return null;
            }

            const mime =
              String(
                info.mime || ""
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
              info.extmetadata || {};

            const artist =
              stripHTML(
                metadata.Artist?.value ||
                  ""
              );

            return {
              title:
                cleanText(
                  page.title?.replace(
                    /^File:/,
                    ""
                  ) ||
                    "Image",
                  500
                ),

              url: imageURL,

              source:
                sourceURL,

              width:
                info.width || null,

              height:
                info.height || null,

              artist:
                cleanText(
                  artist,
                  300
                )
            };
          })
          .filter(Boolean);

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
          type: "images"
        }
      );

      res.json({
        mode: "results",
        results,
        query
      });
    } catch (error) {
      console.error(
        "IMAGE SEARCH ERROR:",
        error
      );

      res.status(502).json({
        error:
          "NEXUS could not reach its image provider right now."
      });
    }
  }
);

/* =========================
   VIDEO SEARCH
   WIKIMEDIA COMMONS
========================= */

app.get(
  "/api/videos",
  requireAuth,
  async (req, res) => {
    const query =
      cleanText(
        req.query.q,
        300
      );

    if (!query) {
      return res.status(400).json({
        error:
          "Search query is required."
      });
    }

    try {
      const searchQuery =
        `${query} filetype:video`;

      const apiURL =
        "https://commons.wikimedia.org/w/api.php" +
        `?action=query` +
        `&generator=search` +
        `&gsrsearch=${encodeURIComponent(
          searchQuery
        )}` +
        `&gsrnamespace=6` +
        `&gsrlimit=30` +
        `&prop=imageinfo` +
        `&iiprop=url|mime|size|extmetadata` +
        `&iiurlwidth=640` +
        `&format=json` +
        `&origin=*`;

      const response =
        await fetch(apiURL, {
          headers: {
            "User-Agent":
              "NEXUS/1.0"
          }
        });

      if (!response.ok) {
        throw new Error(
          `Commons returned ${response.status}`
        );
      }

      const data =
        await response.json();

      const pages =
        Object.values(
          data?.query?.pages || {}
        );

      const results =
        pages
          .map(page => {
            const info =
              page.imageinfo?.[0];

            if (!info) {
              return null;
            }

            const mime =
              String(
                info.mime || ""
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

            const poster =
              safeURL(
                info.thumburl
              );

            const source =
              safeURL(
                info.descriptionurl
              );

            return {
              title:
                cleanText(
                  page.title?.replace(
                    /^File:/,
                    ""
                  ) ||
                    "Video",
                  500
                ),

              url:
                videoURL,

              poster:
                poster,

              source:
                source ||
                videoURL,

              mime,

              width:
                info.width || null,

              height:
                info.height || null
            };
          })
          .filter(Boolean);

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
          type: "videos"
        }
      );

      res.json({
        mode: "results",
        results,
        query
      });
    } catch (error) {
      console.error(
        "VIDEO SEARCH ERROR:",
        error
      );

      res.status(502).json({
        error:
          "NEXUS could not reach its video provider right now."
      });
    }
  }
);

/* =========================
   HISTORY
========================= */

app.get(
  "/api/history",
  requireAuth,
  (req, res) => {
    res.json({
      history:
        db.history[
          req.user.id
        ] || []
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

    res.json({
      success: true
    });
  }
);

/* =========================
   SAVED
========================= */

app.get(
  "/api/saved",
  requireAuth,
  (req, res) => {
    res.json({
      saved:
        db.saved[
          req.user.id
        ] || []
    });
  }
);

app.post(
  "/api/saved",
  requireAuth,
  (req, res) => {
    const title =
      cleanText(
        req.body.title,
        500
      );

    const url =
      safeURL(
        req.body.url
      );

    if (!title || !url) {
      return res.status(400).json({
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
          item.url === url
      );

    if (exists) {
      return res.json({
        success: true,
        alreadySaved: true
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
        200
      );

    saveDatabase();

    res.json({
      success: true
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

    res.json({
      success: true
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

    res.json({
      success: true
    });
  }
);

/* =========================
   ADMIN
========================= */

app.get(
  "/api/admin/status",
  requireAdmin,
  (req, res) => {
    res.json({
      maintenance:
        db.maintenance.enabled,

      title:
        db.maintenance.title,

      message:
        db.maintenance.message,

      users:
        db.users.length,

      sessions:
        Object.keys(
          db.sessions
        ).length
    });
  }
);

app.post(
  "/api/admin/lock",
  requireAdmin,
  (req, res) => {
    db.maintenance = {
      enabled: true,

      title:
        cleanText(
          req.body.title,
          200
        ) ||
        "NEXUS is temporarily offline",

      message:
        cleanText(
          req.body.message,
          1000
        ) ||
        "The website is currently undergoing maintenance."
    };

    saveDatabase();

    res.json({
      success: true
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

    res.json({
      success: true
    });
  }
);

/* =========================
   PUBLIC MAINTENANCE
========================= */

app.get(
  "/api/maintenance",
  (req, res) => {
    res.json({
      enabled:
        db.maintenance.enabled,

      title:
        db.maintenance.title,

      message:
        db.maintenance.message
    });
  }
);

/* =========================
   STATIC FILES
========================= */

app.use(
  express.static(
    PUBLIC_DIR
  )
);

/* =========================
   EXPRESS 5 FALLBACK
========================= */

app.get(
  "*splat",
  (req, res) => {
    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );
  }
);

/* =========================
   START
========================= */

app.listen(
  PORT,
  () => {
    console.log(
      `NEXUS running on port ${PORT}`
    );

    console.log(
      `AI backend: ${
        openai
          ? `enabled (${AI_MODEL})`
          : "disabled - missing OPENAI_API_KEY"
      }`
    );
  }
);
