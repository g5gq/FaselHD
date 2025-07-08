const baseUrl = "https://www.faselhds.xyz";
const proxy = "https://faseldhdproxy-hq1a.vercel.app/?url=";

/**
 * Search for movies and shows on faselhds.xyz.
 */
async function search(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log(`Searching: ${url}`);
    try {
        const html = await fetchV2(url);
        return await searchResults(html); // FIXED: searchResults is now async
    } catch (e) {
        console.error("Search failed:", e);
        return [];
    }
}

/**
 * Parses the search result HTML and returns an array of result objects.
 */
async function searchResults(html) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const items = doc.querySelectorAll("div.postDiv");

    if (items.length === 0) {
        console.log("No results found.");
    }

    items.forEach(item => {
        const a = item.querySelector("a");
        const img = item.querySelector("img");
        const titleDiv = item.querySelector("div.h1");

        let href = a?.getAttribute("href") || "";
        let image = img?.getAttribute("src") || "";
        const title = titleDiv ? titleDiv.textContent.trim() : "";

        if (href.startsWith("/")) href = baseUrl + href;
        else if (!href.startsWith("http")) href = baseUrl + "/" + href;

        if (image.startsWith("/")) image = baseUrl + image;

        if (title && href) {
            results.push({ title, image, href });
        }
    });

    console.log("Search found items:", results.length);
    return results;
}

/**
 * Fetch HTML content using the working proxy.
 */
async function fetchV2(url) {
    try {
        const finalUrl = proxy + encodeURIComponent(url);
        const res = await fetch(finalUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": baseUrl
            }
        });
        if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
        return await res.text();
    } catch (err) {
        console.error("fetchV2 error:", err);
        throw err;
    }
}

/**
 * Extract description and airdate from the detail page.
 */
function extractDetails(html) {
    const details = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const descEl = doc.querySelector("div.singleDesc");
    const description = descEl ? descEl.textContent.trim() : "";

    let airdate = "";
    const yearIcon = doc.querySelector("i.far.fa-calendar-alt");
    if (yearIcon && yearIcon.parentElement) {
        const yearText = yearIcon.parentElement.textContent;
        const match = yearText.match(/\d{4}/);
        if (match) airdate = match[0];
    }

    if (description) {
        details.push({
            description,
            aliases: "",
            airdate
        });
    }

    return details;
}

/**
 * Extract episodes (Arabic "الحلقة") from HTML.
 */
function extractEpisodes(html) {
    const episodes = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const anchors = doc.querySelectorAll("a");
    anchors.forEach(a => {
        const text = a.textContent.trim();
        const match = text.match(/^الحلقة\s*(\d+)$/);
        if (match) {
            let href = a.getAttribute("href");
            if (!href) return;

            if (href.startsWith("/")) href = baseUrl + href;
            else if (!href.startsWith("http")) href = baseUrl + "/" + href;

            episodes.push({
                href,
                number: match[1]
            });
        }
    });

    episodes.reverse();
    return episodes;
}

/**
 * Extract the final .m3u8 stream URL from video_player.
 */
async function extractStreamUrl(html) {
    if (!html.includes("file:")) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const liTabs = doc.querySelectorAll("ul.tabs-ul li");
        for (const li of liTabs) {
            const onclick = li.getAttribute("onclick");
            if (onclick?.includes("/video_player")) {
                const match = onclick.match(/\/video_player[^'"]+/);
                if (match) {
                    const videoUrl = baseUrl + match[0];
                    html = await fetchV2(videoUrl);
                    break;
                }
            }
        }
    }

    const fileMatch = html.match(/file:\s*"([^"]+\.m3u8)"/);
    return fileMatch ? fileMatch[1] : null;
}
