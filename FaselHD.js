const baseUrl = "https://www.faselhds.xyz";
const proxy = "https://faseldhdproxy-hq1a.vercel.app/?url=";

/**
 * Proxy-enabled fetch using fetchV2.
 * Automatically rewrites the URL to go through the proxy.
 */
async function fetchV2(url) {
    try {
        const proxiedUrl = proxy + encodeURIComponent(url);
        const response = await fetch(proxiedUrl);
        if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
        return await response.text();
    } catch (error) {
        console.error("Error in fetchV2:", error);
        throw error;
    }
}

async function search(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    try {
        const html = await fetchV2(url);
        return searchResults(html);
    } catch (error) {
        console.error("Search failed:", error);
        return [];
    }
}

function searchResults(html) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('div.postDiv');

    items.forEach(item => {
        const a = item.querySelector('a');
        if (!a) return;

        let href = a.getAttribute('href');
        if (!href) return;

        if (href.startsWith('/')) href = baseUrl + href;
        else if (!href.startsWith('http')) href = baseUrl + '/' + href;

        const titleDiv = item.querySelector('div.h1');
        const title = titleDiv ? titleDiv.textContent.trim() : '';

        const imgEl = item.querySelector('img');
        let image = imgEl ? imgEl.getAttribute('src') : '';
        if (image.startsWith('/')) image = baseUrl + image;

        if (title && href) {
            results.push({ title, image, href });
        }
    });

    return results;
}

function extractDetails(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const details = [];

    const descEl = doc.querySelector('div.singleDesc');
    const description = descEl ? descEl.textContent.trim() : '';

    let airdate = '';
    const yearIcon = doc.querySelector('i.far.fa-calendar-alt');
    if (yearIcon && yearIcon.parentElement) {
        const text = yearIcon.parentElement.textContent;
        const match = text.match(/\d{4}/);
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

function extractEpisodes(html) {
    const episodes = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const anchors = doc.querySelectorAll('a');

    anchors.forEach(a => {
        const text = a.textContent.trim();
        const match = text.match(/^الحلقة\s*(\d+)$/);
        if (match) {
            let href = a.getAttribute('href');
            if (!href) return;
            if (href.startsWith('/')) href = baseUrl + href;
            else if (!href.startsWith('http')) href = baseUrl + '/' + href;

            episodes.push({
                href,
                number: match[1]
            });
        }
    });

    episodes.reverse();
    return episodes;
}

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
                    let videoPath = match[0];
                    let videoUrl = videoPath.startsWith('http') ? videoPath : baseUrl + videoPath;
                    html = await fetchV2(videoUrl);
                    break;
                }
            }
        }
    }

    const fileMatch = html.match(/file:\s*"([^"]+\.m3u8)"/);
    return fileMatch ? fileMatch[1] : null;
}
