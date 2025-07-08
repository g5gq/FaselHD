const baseUrl = "https://www.faselhds.xyz";

async function soraFetch(url, options = {}) {
    try {
        return await fetchV2(
            url,
            options.headers ?? {},
            options.method ?? "GET",
            options.body ?? null
        );
    } catch (err) {
        console.error("soraFetch error:", err);
        return null;
    }
}

async function searchResults(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    const html = await soraFetch(url);
    if (!html) return [];

    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = doc.querySelectorAll("div.postDiv");
    const results = [];

    items.forEach(item => {
        const a = item.querySelector("a");
        if (!a) return;

        let href = a.getAttribute("href") || "";
        if (href.startsWith("/")) href = baseUrl + href;

        const imgEl = item.querySelector("div.imgdiv-class img");
        let image = imgEl?.getAttribute("src") ?? "";
        if (image.startsWith("/")) image = baseUrl + image;

        const titleEl = item.querySelector("div.h1");
        const title = titleEl?.textContent.trim() ?? "";

        if (href && title) {
            results.push({ title, href, image });
        }
    });

    return results;
}

async function extractDetails(url) {
    const html = await soraFetch(url);
    if (!html) return null;

    const doc = new DOMParser().parseFromString(html, "text/html");

    const title = doc.querySelector("div.h1.title")?.textContent.trim() ?? "";
    const description = doc.querySelector(".singleDesc p")?.textContent.trim() ?? "";
    const imgEl = doc.querySelector("div.posterImg img");
    let image = imgEl?.getAttribute("src") ?? "";
    if (image.startsWith("/")) image = baseUrl + image;

    return { title, description, image };
}

async function extractEpisodes(url) {
    // faselhds.xyz does not expose episode lists in a consistent HTML structure
    // Episodes are not supported in this version
    return [];
}

async function extractStreamUrl(url) {
    const html = await soraFetch(url);
    if (!html) return [];

    const doc = new DOMParser().parseFromString(html, "text/html");
    const servers = doc.querySelectorAll("ul.tabs-ul li");
    const sources = [];

    for (const li of servers) {
        const onclick = li.getAttribute("onclick") || "";
        const m = onclick.match(/'(\/video_player\?[^']+)'/);
        if (!m) continue;

        let playerUrl = m[1];
        if (!playerUrl.startsWith("http")) playerUrl = baseUrl + playerUrl;

        const playerHtml = await soraFetch(playerUrl);
        if (!playerHtml) continue;

        // Try to extract .m3u8 from JWPlayer config
        const fileMatch = playerHtml.match(/file:\s*"([^"]+\.m3u8)"/);
        if (fileMatch) {
            sources.push({ url: fileMatch[1], isM3U8: true });
            break;
        }

        // Fallback: look for a <video> tag
        const vdoc = new DOMParser().parseFromString(playerHtml, "text/html");
        const videoEl = vdoc.querySelector("video");
        const src = videoEl?.getAttribute("src") ?? "";
        if (src && !src.startsWith("blob:")) {
            sources.push({ url: src, isM3U8: src.includes(".m3u8") });
            break;
        }
    }

    return sources;
}
