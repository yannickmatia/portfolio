import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const repo = new URL("../", import.meta.url);
const script = new URL("scripts/update-writing.mjs", repo);

test("retries transient article proxy errors before hydrating a post", async () => {
  const result = await runUpdater([503, 200]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requestCount, 2);
  assert.match(result.page, /<h2>Recovered article title<\/h2>/);
  assert.match(result.page, /Recovered article excerpt\./);
});

test("updates the page with a slug title when the article proxy stays unavailable", async () => {
  const result = await runUpdater([503, 503, 503]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requestCount, 3);
  assert.match(result.stderr, /Article proxy unavailable after 3 attempts/);
  assert.match(result.page, /<h2>Transient Article<\/h2>/);
});

async function runUpdater(responses) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "writing-update-"));
  const scriptDirectory = path.join(directory, "scripts");
  const contentDirectory = path.join(directory, "content");
  const requestsFile = path.join(directory, "proxy-requests.txt");
  const feedFile = path.join(directory, "feed.xml");
  const loaderFile = path.join(directory, "mock-fetch.mjs");

  try {
    await mkdir(scriptDirectory);
    await mkdir(contentDirectory);
    await writeFile(path.join(scriptDirectory, "update-writing.mjs"), await readFile(script, "utf8"));
    await writeFile(path.join(contentDirectory, "writing.json"), JSON.stringify({
      featured: {
        url: "https://yannickmatia.substack.com/p/featured",
        title: "Featured",
        summary: "Featured summary"
      },
      postCount: 2
    }));
    await writeFile(path.join(directory, "writing.html"),
      "    <!-- SUBSTACK_POSTS_START -->\n    <!-- SUBSTACK_POSTS_END -->");
    await writeFile(feedFile, "https://yannickmatia.substack.com/p/transient-article");
    await writeFile(loaderFile, `
import { appendFile } from "node:fs/promises";
let responses = JSON.parse(process.env.PROXY_RESPONSES);
globalThis.fetch = async () => {
  await appendFile(process.env.PROXY_REQUESTS_FILE, "request\\n");
  const status = responses.shift() ?? 200;
  return status === 200
    ? new Response("Title: Recovered article title\\n\\nMarkdown Content:\\nRecovered article excerpt.\\n", { status })
    : new Response("", { status, statusText: "Service Unavailable" });
};
`);

    const result = spawnSync(process.execPath, [
      "--import", loaderFile, path.join(scriptDirectory, "update-writing.mjs"),
      "--feed-file", feedFile
    ], {
      encoding: "utf8",
      env: {
        ...process.env,
        PROXY_REQUESTS_FILE: requestsFile,
        PROXY_RESPONSES: JSON.stringify(responses)
      }
    });
    return {
      ...result,
      page: await readFile(path.join(directory, "writing.html"), "utf8"),
      requestCount: (await readFile(requestsFile, "utf8")).trim().split("\n").length
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
