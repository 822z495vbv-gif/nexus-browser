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
      throw new Error(`Search service returned ${response.status}`);
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
      const title = page.title || "Untitled";
      const key = page.key || title;

      return {
        title,
        description:
          page.description ||
          "No description available.",
        excerpt:
          page.excerpt ||
          "No additional information available.",
        url:
          "https://en.wikipedia.org/wiki/" +
          encodeURIComponent(key)
      };
    });

    res.json({
      ok: true,
      found: true,
      query,
      results,
      googleURL
    });

  } catch (error) {
    console.error("Search error:", error);

    res.status(500).json({
      ok: false,
      error: "NEXUS could not complete the search.",
      googleURL
    });
  }
});

app.get("*splat", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.listen(PORT, () => {
  console.log(`NEXUS running on port ${PORT}`);
});
