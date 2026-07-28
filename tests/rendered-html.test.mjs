import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const port = address.port;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function startProductionServer(port) {
  const nextBin = path.join(
    projectRoot,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  const server = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: projectRoot,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let output = "";
  const readiness = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Next.js did not start in time.\n${output}`)),
      30_000,
    );

    const inspectOutput = (chunk) => {
      output += chunk.toString();
      if (/\bReady in\b/i.test(output)) {
        clearTimeout(timer);
        resolve();
      }
    };

    server.stdout.on("data", inspectOutput);
    server.stderr.on("data", inspectOutput);
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(
        new Error(`Next.js exited before becoming ready (${code}).\n${output}`),
      );
    });
  });

  await readiness;
  return server;
}

test("server-renders the Git City product shell", async (context) => {
  const port = await availablePort();
  const server = await startProductionServer(port);
  context.after(() => {
    server.kill("SIGTERM");
  });

  const response = await fetch(`http://127.0.0.1:${port}/`, {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Git\/City — Repositories become a living skyline(?: · Git\/City)?<\/title>/i,
  );
  assert.match(html, /GIT/);
  assert.match(html, /CITY/);
  assert.match(html, /OPEN CITY LABS/);
  assert.match(html, /CITY SIGNALS/);
  assert.match(html, /Explore/);
  assert.match(html, /Build city/);
  assert.doesNotMatch(html, /codex-preview/);
  assert.doesNotMatch(html, /Your site is taking shape/);
});
