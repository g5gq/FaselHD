const baseUrl = "https://www.faselhds.xyz";

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

        // Make href absolute if needed
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

    console.log(`Found ${results.length} results.`);
    return results;
}

/**
 * Fetch HTML content using fetchV2 with error handling.
 * @param {string} url - URL to fetch.
 * @returns {Promise<string>} HTML content.
 */
async function fetchV2(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${url}`);
        }
        return await response.text();
    } catch (error) {
        console.error("Error in fetchV2:", error);
        throw error;  // Rethrow to propagate the error
    }
}

/**
 * Parse the HTML of a movie or show details page to extract description and year (airdate).
 * @param {string} html - HTML of the details page.
 * @returns {Array<Object>} Array with one details object.
 */
function extractDetails(html) {
    const details = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Description
    const descEl = doc.querySelector('div.singleDesc');
    const description = descEl ? descEl.textContent.trim() : '';
    
    // Airdate (looking for icon with class "far fa-calendar-alt")
    let airdate = '';
    const yearIcon = doc.querySelector('i.far.fa-calendar-alt');
    if (yearIcon && yearIcon.parentElement) {
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
        // Match Arabic "الحلقة <digits>"
        const match = text.match(/^الحلقة\s*(\d+)$/);
        if (match) {
            let href = a.getAttribute('href');
            if (!href) return;

            // Make href absolute if needed
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
 * Extracts the actual video stream URL (.m3u8) from the detail page or video player page.
 * @param {string} html - HTML of the detail or video player page.
 * @returns {Promise<string|null>} Stream URL (.m3u8) or null if not found.
 */
async function extractStreamUrl(html) {
    // Check if HTML already contains the stream file
    if (!html.includes('file:')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const liTabs = doc.querySelectorAll('ul.tabs-ul li');
        
        for (const li of liTabs) {
            const onclick = li.getAttribute('onclick');
            if (onclick && onclick.includes('/video_player')) {
                const videoPathMatch = onclick.match(/\/video_player[^'"]+/);
                if (videoPathMatch) {
                    let videoPath = videoPathMatch[0];
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
