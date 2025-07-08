const baseUrl = "https://www.faselhds.xyz";

async function soraFetch(url, options = {}) {
    try {
        return await fetchV2(url, options.headers ?? {}, options.method ?? "GET", options.body ?? null);
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
    const items = doc.querySelectorAll("div.col-xs-12.col-sm-6.col-md-3");
    const results = [];

    items.forEach(item => {
        const a = item.querySelector("a");
        if (!a) return;

        const href = a.getAttribute("href");
        const title = item.querySelector("div.post-title")?.textContent.trim();
        const styleDiv = item.querySelector("div.post");

        let image = "";
        if (styleDiv) {
            const style = styleDiv.getAttribute("style");
            const match = style?.match(/url\(['"]?(.*?)['"]?\)/);
            if (match) image = match[1];
        }

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

    const title = doc.querySelector("div.title")?.textContent.trim() ?? "";
    const desc = doc.querySelector(".singleDesc p")?.textContent.trim() ?? "";
    const img = doc.querySelector("div.posterImg img")?.getAttribute("src") ?? "";

    return {
        title,
        description: desc,
        image: img
    };
}

async function extractStreamUrl(url) {
    const html = await soraFetch(url);
    if (!html) return [];

    const doc = new DOMParser().parseFromString(html, "text/html");

    const servers = doc.querySelectorAll("ul.tabs-ul li");
    const sources = [];

    for (const server of servers) {
        const onclick = server.getAttribute("onclick");
        if (!onclick) continue;

        const match = onclick.match(/href\s*=\s*'([^']+)'/);
        if (!match) continue;

        const videoPageUrl = match[1].startsWith("http") ? match[1] : baseUrl + match[1];

        const videoHtml = await soraFetch(videoPageUrl);
        if (!videoHtml) continue;

        const videoDoc = new DOMParser().parseFromString(videoHtml, "text/html");
        const video = videoDoc.querySelector("video");

        if (video) {
            const src = video.getAttribute("src");
            if (src && !src.startsWith("blob:")) {
                sources.push({
                    url: src,
                    quality: "auto",
                    isM3U8: src.includes(".m3u8")
                });
            }
        }

        if (sources.length > 0) break;
    }

    return sources;
}
