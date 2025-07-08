const baseUrl = "https://www.faselhds.xyz";

async function soraFetch(url, options = {}) {
  try {
    return await fetchV2(url, options.headers ?? {}, options.method ?? "GET", options.body ?? null);
  } catch (err) {
    console.error("soraFetch error:", err);
    return null;
  }
}

async function searchResults(keyword) {
  const url = `${baseUrl}/?s=${encodeURIComponent(keyword)}`;
  const res = await soraFetch(url);
  if (!res) return [];
  const html = await res.text();

  const regex = /<div class="postDiv "[\s\S]*?<a href="([^"]+)">[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<div class="h1">([^<]+)<\/div>/g;
  const results = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1].trim();
    let image = match[2].trim();
    const title = match[3].trim();

    if (href.startsWith("/")) href = baseUrl + href;
    if (image.startsWith("/")) image = baseUrl + image;

    results.push({ title, href, image });
  }

  // Optionally dedupe by href
  const unique = [];
  const seen = new Set();
  for (const item of results) {
    if (!seen.has(item.href)) {
      seen.add(item.href);
      unique.push(item);
    }
  }

  return unique;
}

async function extractDetails(url) {
  const res = await soraFetch(url);
  if (!res) return null;
  const html = await res.text();

  // Title
  const titleMatch = html.match(/<div class="h1 title">([\s\S]*?)<\/div>/);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Description
  const descMatch = html.match(/<div class="singleDesc">\s*<p>([\s\S]*?)<\/p>/);
  const description = descMatch ? descMatch[1].trim() : "";

  // Poster
  const imgMatch = html.match(/<div class="posterImg">[\s\S]*?<img[^>]+src="([^"]+)"/);
  let image = imgMatch ? imgMatch[1].trim() : "";
  if (image.startsWith("/")) image = baseUrl + image;

  return { title, description, image };
}

async function extractEpisodes(url) {
  // Faselhds doesn’t provide a consistent episodes list in HTML; skip for now
  return [];
}

async function extractStreamUrl(url) {
  const res = await soraFetch(url);
  if (!res) return [];
  const html = await res.text();

  // Find the first /video_player? link
  const playerMatch = html.match(/onclick="player_iframe\.location\.href ='([^']+)'/);
  if (!playerMatch) return [];

  let playerUrl = playerMatch[1];
  if (playerUrl.startsWith("/")) playerUrl = baseUrl + playerUrl;

  const playerRes = await soraFetch(playerUrl);
  if (!playerRes) return [];
  const playerHtml = await playerRes.text();

  // Try JWPlayer .m3u8
  const fileMatch = playerHtml.match(/file:\s*"([^"]+\.m3u8)"/);
  if (fileMatch) {
    return [{ url: fileMatch[1], isM3U8: true }];
  }

  // Fallback to direct <video src="...">
  const videoMatch = playerHtml.match(/<video[^>]+src="([^"]+)"/);
  if (videoMatch) {
    return [{ url: videoMatch[1], isM3U8: videoMatch[1].includes(".m3u8") }];
  }

  return [];
}
