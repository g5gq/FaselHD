const baseUrl = "https://www.faselhds.xyz";

/**
 * Custom fetch function using proxy.
 */
async function fetchV2(url) {
    try {
        const proxyUrl = `https://faseldhdproxy-hq1a.vercel.app/?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': baseUrl
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${url} (status: ${response.status})`);
        }
        return await response.text();
    } catch (error) {
        console.error("Error in fetchV2:", error);
        throw error;
    }
}

/**
 * Search for movies and shows on faselhds.xyz.
 */
async function search(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log("Searching URL:", url);
    try {
        const html = await fetchV2(url);
        const results = searchResults(html);
        console.log(`Found ${results.length} results.`);
        return results;
    } catch (err) {
        console.error("Search error:", err);
        return [];
    }
}

/**
 * Parse search result HTML.
 */
function searchResults(html) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('div.postDiv');

    items.forEach(item => {
        const a = item.querySelector('a');
        const img = item.querySelector('img');
        const titleDiv = item.querySelector('div.h1');

        let href = a?.getAttribute('href') || '';
        let image = img?.getAttribute('src') || '';
        const title = titleDiv ? titleDiv.textContent.trim() : '';

        if (href.startsWith('/')) href = baseUrl + href;
        else if (!href.startsWith('http')) href = baseUrl + '/' + href;

        if (image.startsWith('/')) image = baseUrl + image;

        if (title && href) {
            results.push({ title, image, href });
        }
    });

    return results;
}

/**
 * Extract movie/show details.
 */
function extractDetails(html) {
    const details = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const descEl = doc.querySelector('div.singleDesc');
    const description = descEl ? descEl.textContent.trim() : '';

    let airdate = '';
    const yearIcon = doc.querySelector('i.far.fa-calendar-alt');
    if (yearIcon && yearIcon.parentElement) {
        const yearText = yearIcon.parentElement.textContent;
        const match = yearText.match(/\d{4}/);
        airdate = match ? match[0] : '';
    }

    if (description) {
        details.push({
            description,
            aliases: '',
            airdate
        });
    }

    return details;
}

/**
 * Extract episodes from a season/show page.
 */
function extractEpisodes(html) {
    const episodes = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const anchors = doc.querySelectorAll('a');
    anchors.forEach(a => {
        const text = a.textContent.trim();
        const match = text.match(/^الحلقة\s*(\d+)$/);
        if (match) {
            let href = a.getAttribute('href') || '';
            if (href.startsWith('/')) href = baseUrl + href;
            else if (!href.startsWith('http')) href = baseUrl + '/' + href;
            episodes.push({ href, number: match[1] });
        }
    });

    episodes.reverse();
    return episodes;
}

/**
 * Extract actual .m3u8 stream URL.
 */
async function extractStreamUrl(html) {
    if (!html.includes('file:')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const liTabs = doc.querySelectorAll('ul.tabs-ul li');
        for (const li of liTabs) {
            const onclick = li.getAttribute('onclick');
            if (onclick && onclick.includes('/video_player')) {
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
