async function searchResults(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log("🔍 Search URL:", url);

    const html = await soraFetch(url);
    if (!html) {
        console.log("❌ Failed to fetch HTML");
        return [];
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = doc.querySelectorAll("div.col-xs-12.col-sm-6.col-md-3");
    console.log("✅ Found items:", items.length);

    const results = [];

    items.forEach(item => {
        const a = item.querySelector("a");
        const title = item.querySelector("div.post-title")?.textContent.trim();
        const styleDiv = item.querySelector("div.post");

        let image = "";
        if (styleDiv) {
            const style = styleDiv.getAttribute("style");
            const match = style?.match(/url\(['"]?(.*?)['"]?\)/);
            if (match) image = match[1];
        }

        if (a && a.href && title) {
            results.push({
                title,
                href: a.href,
                image
            });
        }
    });

    console.log("🎯 Final search results:", results);
    return results;
}
