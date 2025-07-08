const baseUrl = "https://www.faselhds.xyz";
const proxyUrl = "https://faseldhdproxy-hq1a.vercel.app";

/**
 * Search for movies and shows on faselhds.xyz.
 * @param {string} query - Search query.
 * @returns {Promise<Array<Object>>} Array of results with {title, image, href}.
 */
async function search(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    console.log(`Searching for: ${query}`);
    
    try {
        const html = await fetchV2(url);
        return searchResults(html);
    } catch (error) {
        console.error("Error fetching search results:", error);
        return [];
    }
}

/**
 * Parses the HTML of a search results page.
 * @param {string} html - HTML of the search results page.
 * @returns {Array<Object>} Array of results with title, image, href.
 */
function searchResults(html) {
    const results = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('div.postDiv');
    
    if (items.length === 0) {
        console.log("No results found.");
    }

    items.forEach(item => {
        const a = item.querySelector('a');
        if (!a) return;

        let href = a.getAttribute('href');
        if (!href) return;

        if (href.startsWith('/')) {
            href = baseUrl + href;
        } else if (!href.startsWith('http')) {
            href = baseUrl + '/' + href;
        }

        const titleDiv = item.querySelector('div.h1');
        const title = titleDiv ? titleDiv.textContent.trim() : '';
        const imgEl = item.querySelector('img');
        let image = imgEl ? imgEl.getAttribute('src') : '';
        if (image && image.startsWith('/')) {
            image = baseUrl + image;
        }

        if (title && href) {
            results.push({ title, image, href });
        }
    });

    console.log(`Found ${results.length} results.`);
    return results;
}

/**
 * Fetch HTML content using Vercel proxy.
 * @param {string} url - Target URL to fetch.
 * @returns {Promise<string>} HTML content.
 */
async function fetchV2(url) {
    try {
        const proxied = `${proxyUrl}/?url=${encodeURIComponent(url)}`;
        console.log("Fetching via proxy:", proxied);
        const response = await fetch(proxied, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': baseUrl
            }
        });
        if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
        return await response.text();
    } catch (error) {
        console.error("Error in fetchV2:", error);
        throw error;
    }
}

/**
 * Parse the HTML of a movie or show details page.
 * @param {string} html - HTML of the details page.
 * @returns {Array<Object>} Array with one details object.
 */
function extractDetails(html) {
    const details = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const descEl = doc.querySelector('div.singleDesc');
    const description = descEl ? descEl.textContent.trim() : '';
    
    let airdate = '';
    const yearIcon = doc.querySelector('i.far.fa-calendar-alt');
    if (yearIcon?.parentElement) {
        const yearText = yearIcon.parentElement.textContent;
        const yearMatch = yearText.match(/\d{4}/);
        airdate = yearMatch ? yearMatch[0] : '';
    }

    if (description) {
        details.push({
            description: description,
            aliases: '',
            airdate: airdate
        });
    }

    return details;
}

/**
 * Parses the HTML of a show series or season page to extract episodes.
 * @param {string} html - HTML of the episodes listing.
 * @returns {Array<Object>} Array of episodes with {href, number}.
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
            let href = a.getAttribute('href');
            if (!href) return;
            if (href.startsWith('/')) {
                href = baseUrl + href;
            } else if (!href.startsWith('http')) {
                href = baseUrl + '/' + href;
            }
            episodes.push({ href, number: match[1] });
        }
    });

    episodes.reverse();
    return episodes;
}

/**
 * Extracts the actual video stream URL (.m3u8).
 * @param {string} html - HTML of the detail or player page.
 * @returns {Promise<string|null>} Stream URL or null.
 */
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
                    let playerUrl = match[0];
                    if (!playerUrl.startsWith('http')) {
                        playerUrl = baseUrl + playerUrl;
                    }
                    html = await fetchV2(playerUrl);
                    break;
                }
            }
        }
    }

    const fileMatch = html.match(/file:\s*"([^"]+\.m3u8)"/);
    return fileMatch ? fileMatch[1] : null;
}
