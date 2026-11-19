import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repo = new URL("../", import.meta.url);
const script = new URL("scripts/update-writing.mjs", repo);

test("retries transient article proxy errors before hydrating a post", async () => {
  const result = await runUpdater({
    feedFile: true,
    proxyResponses: [
      { status: 503 },
      {
        status: 200,
        body: "Title: Recovered article title\n\nMarkdown Content:\nRecovered article excerpt.\n"
      }
    ]
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requestCount, 2);
  assert.match(result.page, /<h2>Recovered article title<\/h2>/);
  assert.match(result.page, /Recovered article excerpt\./);
});

test("updates the page with a slug title when the article proxy stays unavailable", async () => {
  const result = await runUpdater({
    feedFile: true,
    proxyResponses: [{ status: 503 }, { status: 503 }, { status: 503 }]
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requestCount, 3);
  assert.match(result.stderr, /Article proxy unavailable after 3 attempts/);
  assert.match(result.page, /<h2>Transient Article<\/h2>/);
});

test("uses a valid direct RSS feed without requesting the proxy", async () => {
  const result = await runUpdater({
    directResponses: [{ status: 200, body: rssFeed("Direct feed title") }]
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.requests, ["https://yannickmatia.substack.com/feed"]);
  assert.match(result.page, /<h2>Direct feed title<\/h2>/);
});

test("retries a transient direct feed error before succeeding", async () => {
  const result = await runUpdater({
    directResponses: [
      { status: 503 },
      { status: 200, body: rssFeed("Recovered direct title") }
    ]
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.requests, [
    "https://yannickmatia.substack.com/feed",
    "https://yannickmatia.substack.com/feed"
  ]);
  assert.match(result.page, /<h2>Recovered direct title<\/h2>/);
});

test("rejects a non-RSS direct response and falls back to validated RSS", async () => {
  const result = await runUpdater({
    directResponses: Array(5).fill({
      status: 200,
      body: "<html><body>Temporary error</body></html>"
    }),
    proxyResponses: [{ status: 200, body: rssFeed("Validated fallback title") }]
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requests.length, 6);
  assert.match(result.page, /<h2>Validated fallback title<\/h2>/);
});

test("falls back to Substack links in a recognized text-proxy response", async () => {
  const result = await runUpdater({
    directResponses: Array(5).fill({ status: 503 }),
    proxyResponses: [
      {
        status: 200,
        body: "Title: Substack feed\nURL Source: https://yannickmatia.substack.com/feed\nMarkdown Content:\nhttps://yannickmatia.substack.com/p/proxy-article\n"
      },
      {
        status: 200,
        body: "Title: Recovered proxy title\n\nMarkdown Content:\nRecovered proxy excerpt.\n"
      }
    ]
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requests.filter((url) => url.includes("r.jina.ai")).length, 2);
  assert.match(result.page, /<h2>Recovered proxy title<\/h2>/);
  assert.match(result.page, /Recovered proxy excerpt\./);
});

test("rejects an invalid proxy response and leaves the page unchanged", async () => {
  const result = await runUpdater({
    directResponses: Array(5).fill({ status: 503 }),
    proxyResponses: Array(5).fill({ status: 200, body: "<html><body>Unauthorized</body></html>" })
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unable to load the Substack feed/);
  assert.match(result.stderr, /not valid RSS or a supported text-proxy response/);
  assert.equal(result.page, "    <!-- SUBSTACK_POSTS_START -->\n    <!-- SUBSTACK_POSTS_END -->");
});

function rssFeed(title) {
  return `<rss version="2.0"><channel><title>Writing</title><item><title>${title}</title><link>https://yannickmatia.substack.com/p/test-post</link><description>An RSS excerpt.</description></item></channel></rss>`;
}

async function runUpdater({
  feedFile: useFeedFile = false,
  directResponses = [],
  proxyResponses = []
}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "writing-update-"));
  const scriptDirectory = path.join(directory, "scripts");
  const contentDirectory = path.join(directory, "content");
  const requestsFile = path.join(directory, "proxy-requests.txt");
  const feedFilePath = path.join(directory, "feed.xml");
  const loaderFile = path.join(directory, "mock-fetch.mjs");

  try {
    await mkdir(scriptDirectory);
    await mkdir(contentDirectory);
    await writeFile(path.join(scriptDirectory, "update-writing.mjs"), await readFile(script, "utf8"));
    await writeFile(path.join(contentDirectory, "writing.json"), JSON.stringify({
      feedUrl: "https://yannickmatia.substack.com/feed",
      featured: {
        url: "https://yannickmatia.substack.com/p/featured",
        title: "Featured",
        summary: "Featured summary"
      },
      postCount: 2
    }));
    await writeFile(path.join(directory, "writing.html"),
      "    <!-- SUBSTACK_POSTS_START -->\n    <!-- SUBSTACK_POSTS_END -->");
    if (useFeedFile) {
      await writeFile(feedFilePath, "Title: Substack feed\nURL Source: https://yannickmatia.substack.com/feed\nMarkdown Content:\nhttps://yannickmatia.substack.com/p/transient-article\n");
    }
    await writeFile(loaderFile, `
import { appendFile } from "node:fs/promises";
const directResponses = JSON.parse(process.env.DIRECT_RESPONSES);
const proxyResponses = JSON.parse(process.env.PROXY_RESPONSES);
globalThis.setTimeout = (callback) => { callback(); return 0; };
globalThis.fetch = async (url) => {
  const urlString = String(url);
  await appendFile(process.env.PROXY_REQUESTS_FILE, urlString + "\\n");
  const responses = urlString.includes("r.jina.ai") ? proxyResponses : directResponses;
  const response = responses.shift();
  if (!response) throw new Error("Unexpected request: " + urlString);
  return new Response(response.body ?? "", {
    status: response.status,
    statusText: response.status === 503 ? "Service Unavailable" : ""
  });
};
`);

    const args = ["--import", loaderFile, path.join(scriptDirectory, "update-writing.mjs")];
    if (useFeedFile) args.push("--feed-file", feedFilePath);
    const result = spawnSync(process.execPath, args, {
      encoding: "utf8",
      env: {
        ...process.env,
        PROXY_REQUESTS_FILE: requestsFile,
        DIRECT_RESPONSES: JSON.stringify(directResponses),
        PROXY_RESPONSES: JSON.stringify(proxyResponses)
      }
    });
    const requests = await readRequests(requestsFile);
    return {
      ...result,
      page: await readFile(path.join(directory, "writing.html"), "utf8"),
      requests,
      requestCount: requests.length
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function readRequests(file) {
  return (await readFile(file, "utf8")).trim().split("\n");
}
