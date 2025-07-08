const baseUrl = "https://www.faselhds.xyz";
const proxy = "https://faseldhdproxy-hq1a.vercel.app/?url=";

async function search(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log("Searching URL:", url);
    const html = await fetchHtml(url);
    return searchResults(html);
}

async function fetchHtml(url) {
    const fullUrl = `${proxy}${encodeURIComponent(url)}`;
    console.log("Fetching via proxy:", fullUrl);
    const res = await fetch(fullUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Referer': baseUrl
        }
    });
    if (!res.ok) throw new Error(`Proxy failed: ${res.status}`);
    return await res.text();
}

function searchResults(html) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('div.postDiv');
    console.log("Search found items:", items.length);

    items.forEach(item => {
        const a = item.querySelector('a');
        const titleEl = item.querySelector('.h1');
        const img = item.querySelector('img');

        if (!a || !titleEl || !img) return;

        const href = a.getAttribute('href')?.startsWith('http') ? a.getAttribute('href') : baseUrl + a.getAttribute('href');
        const image = img.getAttribute('src')?.startsWith('http') ? img.getAttribute('src') : baseUrl + img.getAttribute('src');

        results.push({
            title: titleEl.textContent.trim(),
            image,
            href
        });
    });

    return results;
}

function extractDetails(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const desc = doc.querySelector('div.singleDesc')?.textContent.trim() || '';
    const dateIcon = doc.querySelector('i.far.fa-calendar-alt');
    let airdate = '';

    if (dateIcon?.parentElement) {
        const text = dateIcon.parentElement.textContent;
        const match = text.match(/\d{4}/);
        airdate = match ? match[0] : '';
    }

    return [{
        description: desc,
        aliases: '',
        airdate
    }];
}

function extractEpisodes(html) {
    const episodes = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('a');

    links.forEach(link => {
        const text = link.textContent.trim();
        const match = text.match(/^الحلقة\s*(\d+)$/);
        if (match) {
            const href = link.getAttribute('href')?.startsWith('http') ? link.getAttribute('href') : baseUrl + link.getAttribute('href');
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
        const tabs = doc.querySelectorAll('ul.tabs-ul li');

        for (const li of tabs) {
            const onclick = li.getAttribute('onclick');
            const match = onclick?.match(/\/video_player[^'"]+/);
            if (match) {
                const videoUrl = baseUrl + match[0];
                html = await fetchHtml(videoUrl);
                break;
            }
        }
    }

    const streamMatch = html.match(/file:\s*"([^"]+\.m3u8)"/);
    return streamMatch ? streamMatch[1] : null;
}
