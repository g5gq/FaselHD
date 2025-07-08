const baseUrl = "https://www.faselhds.xyz";
const proxyUrl = "https://faseldhdproxy-hq1a.vercel.app/?url=";

async function fetchV2(url) {
    try {
        const response = await fetch(`${proxyUrl}${encodeURIComponent(url)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': baseUrl
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${url} (status ${response.status})`);
        }
        return await response.text();
    } catch (error) {
        console.error("fetchV2 error:", error);
        throw error;
    }
}

async function search(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log("Search URL:", url);
    const html = await fetchV2(url);
    return searchResults(html);
}

function searchResults(html) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('div.postDiv');
    console.log("Found search result items:", items.length);

    items.forEach(item => {
        const a = item.querySelector('a');
        const titleDiv = item.querySelector('.h1');
        const img = item.querySelector('img');

        if (!a || !titleDiv || !img) return;

        let href = a.getAttribute('href');
        if (href && href.startsWith('/')) href = baseUrl + href;

        let image = img.getAttribute('src');
        if (image && image.startsWith('/')) image = baseUrl + image;

        results.push({
            title: titleDiv.textContent.trim(),
            image,
            href
        });
    });

    return results;
}

function extractDetails(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const description = doc.querySelector('div.singleDesc')?.textContent.trim() || '';
    let airdate = '';

    const icon = doc.querySelector('i.far.fa-calendar-alt');
    if (icon && icon.parentElement) {
        const match = icon.parentElement.textContent.match(/\d{4}/);
        airdate = match ? match[0] : '';
    }

    return [{
        description,
        aliases: '',
        airdate
    }];
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
            if (href && href.startsWith('/')) href = baseUrl + href;
            episodes.push({
                href,
                number: match[1]
            });
        }
    });

    return episodes.reverse();
}

async function extractStreamUrl(html) {
    if (!html.includes('file:')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const liTabs = doc.querySelectorAll('ul.tabs-ul li');

        for (const li of liTabs) {
            const onclick = li.getAttribute('onclick');
            if (onclick?.includes('/video_player')) {
                const match = onclick.match(/\/video_player[^'"]+/);
                if (match) {
                    const videoUrl = baseUrl + match[0];
                    html = await fetchV2(videoUrl);
                    break;
                }
            }
        }
    }

    const streamMatch = html.match(/file:\s*"([^"]+\.m3u8)"/);
    return streamMatch ? streamMatch[1] : null;
}
