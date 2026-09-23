import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const configUrl = new URL("content/writing.json", root);
const pageUrl = new URL("writing.html", root);
const startMarker = "    <!-- SUBSTACK_POSTS_START -->";
const endMarker = "    <!-- SUBSTACK_POSTS_END -->";

const config = JSON.parse(await readFile(configUrl, "utf8"));
const feedFileIndex = process.argv.indexOf("--feed-file");
const feedFile = feedFileIndex >= 0 ? process.argv[feedFileIndex + 1] : undefined;
const xml = feedFile ? await readFile(feedFile, "utf8") : await fetchFeed(config.feedUrl);
const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map(([item]) => ({
  title: field(item, "title"),
  url: field(item, "link").replace(/\?.*$/, ""),
  description: field(item, "description")
})).filter((post) => post.title && post.url);

if (!items.length) throw new Error("No posts were found in the Substack feed.");

if (!config.featured?.url || !config.featured?.title || !config.featured?.summary) {
  throw new Error("The featured post needs a URL, title, and summary in content/writing.json.");
}

const featured = { ...config.featured, featured: true };
const selected = [featured, ...items.filter((post) => !sameUrl(post.url, featured.url))]
  .slice(0, config.postCount ?? 3);
const rows = selected.map((post, index) => renderPost(post, index, config)).join("\n");
const page = await readFile(pageUrl, "utf8");

if (!page.includes(startMarker) || !page.includes(endMarker)) {
  throw new Error("The Substack markers are missing from writing.html.");
}

const before = page.slice(0, page.indexOf(startMarker));
const after = page.slice(page.indexOf(endMarker) + endMarker.length);
await writeFile(pageUrl, `${before}${startMarker}\n${rows}\n${endMarker}${after}`);
console.log(`Updated writing.html with ${selected.length} Substack posts.`);

async function fetchFeed(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      "user-agent": "Mozilla/5.0 (compatible; YannickMatiaPortfolio/1.0)"
    }
  });
  if (!response.ok) {
    throw new Error(`Substack feed returned ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function field(item, name) {
  const match = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1] ?? "").trim();
}

function decodeXml(value) {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"").replace(/&apos;|&#39;/g, "'")
    .replace(/\s+/g, " ");
}

function sameUrl(a, b) {
  return a?.replace(/\/$/, "") === b?.replace(/\/$/, "");
}

function summaryFor(post, override) {
  if (post.summary) return post.summary;
  if (override?.summary) return override.summary;
  const firstSentence = post.description.match(/^.*?[.!?](?:\s|$)/)?.[0] ?? post.description;
  const summary = firstSentence.trim();
  return summary.length <= 150 ? summary : `${summary.slice(0, 147).trimEnd()}…`;
}

function renderPost(post, index, config) {
  const override = config.overrides?.[post.url];
  const featured = post.featured === true;
  const label = featured ? "Featured · Substack" : "Substack";
  const aside = post.aside ?? override?.aside ?? "Read the full piece ↗";
  return `    <a class="writing-row${featured ? " featured" : ""}" href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer"><span>${String(index + 1).padStart(2, "0")}</span><div><small>${label}</small><h2>${escapeHtml(post.title)}</h2><p>${escapeHtml(summaryFor(post, override))}</p><em class="hover-aside">${escapeHtml(aside)}</em></div><b aria-hidden="true">↗</b></a>`;
}

function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
