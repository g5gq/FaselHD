// Sora module for faselhds.xyz
const baseUrl = "https://www.faselhds.xyz";

/**
 * Search for movies and shows on faselhds.xyz.
 * Uses fetchV2 to retrieve the search results page and parses it.
 * @param {string} query - Search query.
 * @returns {Promise<Array<Object>>} Array of results with {title, image, href}.
 * Example output format: {title, image, href}:contentReference[oaicite:0]{index=0}.
 */
async function search(query) {
    const url = `${baseUrl}/?s=${encodeURIComponent(query)}`;
    const html = await fetchV2(url);
    return searchResults(html);
}

/**
 * Parses the HTML of a search results page.
 * Each result is in <div class="postDiv"> with title in <div class="h1">,
 * an <img> and an <a href>.
 * @param {string} html - HTML of the search results page.
 * @returns {Array<Object>} Array of results with title, image, href.
 */
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
        // Make absolute if needed
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
            results.push({
                title: title,
                image: image,
                href: href
            });
        }
    });
    return results;
}

/**
 * Parses the HTML of a movie or show details page.
 * Extracts description and year (airdate). Aliases not provided by site.
 * @param {string} html - HTML of the detail page.
 * @returns {Array<Object>} Array with one details object.
 * Example fields: {description, aliases, airdate}:contentReference[oaicite:1]{index=1}.
 */
function extractDetails(html) {
    const details = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Description
    const descEl = doc.querySelector('div.singleDesc');
    const description = descEl ? descEl.textContent.trim() : '';
    // Year / airdate (icon with class far fa-calendar-alt)
    let airdate = '';
    const yearIcon = doc.querySelector('i.far.fa-calendar-alt');
    if (yearIcon && yearIcon.parentElement) {
        // Extract digits (e.g., year) from parent element text
        const yearText = yearIcon.parentElement.textContent;
        const yearMatch = yearText.match(/\d{4}/);
        airdate = yearMatch ? yearMatch[0] : '';
    }
    // If description found, push details object. Aliases blank (not on site).
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
 * Looks for links whose text is "الحلقة X" (episode number in Arabic).
 * @param {string} html - HTML of the episodes listing.
 * @returns {Array<Object>} Array of episodes with {href, number}.
 * Example format: {href, number}:contentReference[oaicite:2]{index=2}.
 */
function extractEpisodes(html) {
    const episodes = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const anchors = doc.querySelectorAll('a');
    anchors.forEach(a => {
        const text = a.textContent.trim();
        // Match Arabic "الحلقة <digits>" exactly
        const match = text.match(/^الحلقة\s*(\d+)$/);
        if (match) {
            let href = a.getAttribute('href');
            if (!href) return;
            // Make absolute if needed
            if (href.startsWith('/')) {
                href = baseUrl + href;
            } else if (!href.startsWith('http')) {
                href = baseUrl + '/' + href;
            }
            episodes.push({
                href: href,
                number: match[1]
            });
        }
    });
    // Order episodes by ascending number
    episodes.reverse();
    return episodes;
}

/**
 * Extracts the actual video stream URL (.m3u8).
 * If given the HTML of the details page with server links, it fetches the first /video_player URL.
 * Then it finds the JW Player stream file URL in the resulting HTML.
 * @param {string} html - HTML of either the detail page or the video_player page.
 * @returns {Promise<string|null>} Stream URL (.m3u8) or null if not found.
 * Output is a direct stream URL string:contentReference[oaicite:3]{index=3}.
 */
async function extractStreamUrl(html) {
    // Check if HTML already contains the stream file
    if (!html.includes('file:')) {
        // Parse HTML to find /video_player link
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const liTabs = doc.querySelectorAll('ul.tabs-ul li');
        for (const li of liTabs) {
            const onclick = li.getAttribute('onclick');
            if (onclick && onclick.includes('/video_player')) {
                // Extract the URL inside onclick
                const videoPathMatch = onclick.match(/\/video_player[^'"]+/);
                if (videoPathMatch) {
                    let videoPath = videoPathMatch[0];
                    // Ensure absolute URL
                    let videoUrl = videoPath.startsWith('http') ? videoPath : baseUrl + videoPath;
                    // Fetch the video player page
                    html = await fetchV2(videoUrl);
                    break;
                }
            }
        }
    }
    // Find the m3u8 file URL in the HTML (JW Player "file" parameter)
    const fileMatch = html.match(/file:\s*"([^"]+\.m3u8)"/);
    return fileMatch ? fileMatch[1] : null;
}
