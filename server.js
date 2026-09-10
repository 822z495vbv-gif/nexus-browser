const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function cleanQuery(query) {
  return String(query || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

/*
|--------------------------------------------------------------------------
| REMOVE HTML FROM WIKIPEDIA TEXT
|--------------------------------------------------------------------------
*/

function stripHTML(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/*
|--------------------------------------------------------------------------
| SEARCH
|--------------------------------------------------------------------------
*/

app.get("/api/search", async (req, res) => {
  const query = cleanQuery(req.query.q);

  if (!query) {
    return res.status(400).json({
      ok: false,
      error: "Please enter a search query."
    });
  }

  const googleURL =
    "https://www.google.com/search?q=" +
    encodeURIComponent(query);

  try {
    const url =
      "https://en.wikipedia.org/w/rest.php/v1/search/page?q=" +
      encodeURIComponent(query) +
      "&limit=5";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "NEXUS-Search/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(
        `Search service returned ${response.status}`
      );
    }

    const data = await response.json();

    const pages = Array.isArray(data.pages)
      ? data.pages
      : [];

    if (pages.length === 0) {
      return res.json({
        ok: true,
        found: false,
        query,
        googleURL
      });
    }

    const results = pages.map(page => {
      const title = stripHTML(
        page.title || "Untitled"
      );

      const key =
        page.key ||
        page.title ||
        "Untitled";

      const description =
        stripHTML(
          page.description ||
          "No description available."
        );

      const excerpt =
        stripHTML(
          page.excerpt ||
          "No additional information available."
        );

      return {
        title,
        description,
        excerpt,
        url:
          "https://en.wikipedia.org/wiki/" +
          encodeURIComponent(key)
      };
    });

    return res.json({
      ok: true,
      found: true,
      query,
      results,
      googleURL
    });

  } catch (error) {
    console.error(
      "Search error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        "NEXUS could not complete the search.",
      googleURL
    });
  }
});

/*
|--------------------------------------------------------------------------
| FRONTEND FALLBACK
|--------------------------------------------------------------------------
*/

app.get("*splat", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

/*
|--------------------------------------------------------------------------
| START
|--------------------------------------------------------------------------
*/

app.listen(PORT, () => {
  console.log(
    `NEXUS running on port ${PORT}`
  );
});
