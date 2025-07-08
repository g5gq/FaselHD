async function searchResults(keyword) {
    const uniqueResults = new Map();
    const baseUrl = 'https://www.faselhds.xyz/?s=';
    let page = 1;

    while (true) {
        const url = `${baseUrl}${keyword}&page=${page}`;
        const response = await soraFetch(url);
        const html = await response.text();

        // Match the search result items (movie blocks)
        const regex = /<div class="col-xs-12 col-sm-6 col-md-3">[\s\S]*?<\/div>\s*<\/div>/g;
        const matches = [...html.matchAll(regex)];

        // If no matches are found, stop the loop
        if (matches.length === 0) break;

        // Process each match
        matches.forEach(match => {
            const anchorMatch = match[0].match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/);
            const href = anchorMatch ? anchorMatch[1] : null;
            let title = anchorMatch ? anchorMatch[2] : null;
            if (title) {
                title = title.replace(/^فيلم\s*/,'').replace(/\s*مترجم$/,'').trim();
            }

            const imageMatch = match[0].match(/<div class="post"[^>]*style="[^"]*background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
            const image = imageMatch ? imageMatch[1] : '';

            if (title && href) {
                uniqueResults.set(href, { title, href, image });
            }
        });

        // Move to the next page
        page++;
    }

    const deduplicatedResults = Array.from(uniqueResults.values());
    console.log(`Found ${deduplicatedResults.length} results.`);
    return JSON.stringify(deduplicatedResults);
}

// Example usage:
async function testSearch() {
    const keyword = "your_search_term_here";  // Replace with your search term
    const results = await searchResults(keyword);
    console.log(results);
}

// Uncomment to test search:
// testSearch();

async function extractDetails(url) {
    const response = await soraFetch(url);
    const html = await response.text();

    const descriptionMatch = html.match(/<div class="story">\s*<p>([\s\S]*?)<\/p>/);
    const description = descriptionMatch ? descriptionMatch[1].trim() : 'N/A';

    const airdateMatch = html.match(/<span>موعد الصدور\s*:<\/span>\s*<a[^>]*>(\d{4})<\/a>/);
    const airdate = airdateMatch ? airdateMatch[1] : 'N/A';

    const aliasMatches = [];
    const aliasSectionMatch = html.match(/<ul class="RightTaxContent">([\s\S]*?)<\/ul>/);
    if (aliasSectionMatch) {
        const section = aliasSectionMatch[1];
        const items = [...section.matchAll(/<li[^>]*>[\s\S]*?<span>(.*?)<\/span>([\s\S]*?)<\/li>/g)];
        for (const [, label, content] of items) {
            if (label.includes("موعد الصدور")) continue;

            const values = [...content.matchAll(/<a[^>]*>(.*?)<\/a>/g)].map(m => m[1].trim());
            if (values.length === 0) {
                const strongValue = content.match(/<strong>(.*?)<\/strong>/);
                if (strongValue) values.push(strongValue[1].trim());
            }
            aliasMatches.push(`${label.trim()} ${values.join(', ')}`);
        }
    }

    return JSON.stringify([{
        description,
        aliases: aliasMatches.join('\n'),
        airdate
    }]);
}

async function extractEpisodes(url) {
    const response = await soraFetch(url);
    const html = await response.text();

    const results = [];
    const episodeRegex = /<a href="([^"]+)"[^>]*><div class="image">[\s\S]*?<\/div><h3 class="title">([^<]+)<\/h3><\/a>/g;

    let match;
    while ((match = episodeRegex.exec(html)) !== null) {
        results.push({
            href: match[1].trim(),
            title: match[2].trim()
        });
    }

    return JSON.stringify(results);
}

async function extractStreamUrl(url) {
    const response = await soraFetch(url);
    const html = await response.text();

    const videoMatch = html.match(/<video[^>]*src="([^"]+)"/);
    const streamUrl = videoMatch ? videoMatch[1] : null;

    return JSON.stringify({ streamUrl });
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (error) {
        console.error('Error fetching URL:', error);
        return null;
    }
}
