import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  downloadLatestServer,
  releaseAssetName,
  releaseTarget
} from "../src/serverDownload";

test("releaseTarget maps supported platforms to Rust target triples", () => {
  assert.equal(releaseTarget("darwin", "arm64"), "aarch64-apple-darwin");
  assert.equal(releaseTarget("darwin", "x64"), "x86_64-apple-darwin");
  assert.equal(releaseTarget("linux", "arm64"), "aarch64-unknown-linux-gnu");
  assert.equal(releaseTarget("linux", "x64"), "x86_64-unknown-linux-gnu");
  assert.equal(releaseTarget("win32", "arm64"), "aarch64-pc-windows-msvc");
  assert.equal(releaseTarget("win32", "x64"), "x86_64-pc-windows-msvc");
});

test("releaseTarget returns undefined for unsupported platforms", () => {
  assert.equal(releaseTarget("linux", "ia32"), undefined);
  assert.equal(releaseTarget("freebsd", "x64"), undefined);
});

test("releaseAssetName uses zip on Windows and tar.gz elsewhere", () => {
  assert.equal(
    releaseAssetName("x86_64-unknown-linux-gnu", "linux"),
    "tonel-smalltalk-language-server-x86_64-unknown-linux-gnu.tar.gz"
  );
  assert.equal(
    releaseAssetName("x86_64-pc-windows-msvc", "win32"),
    "tonel-smalltalk-language-server-x86_64-pc-windows-msvc.zip"
  );
});

const linuxAssetName =
  "tonel-smalltalk-language-server-x86_64-unknown-linux-gnu.tar.gz";

function makeReleaseArchive(workDir: string): Buffer {
  const contentDir = path.join(
    workDir,
    "tonel-smalltalk-language-server-x86_64-unknown-linux-gnu"
  );
  fs.mkdirSync(contentDir);
  fs.writeFileSync(
    path.join(contentDir, "tonel-smalltalk-language-server"),
    "#!/bin/sh\n"
  );
  const archivePath = path.join(workDir, linuxAssetName);
  execFileSync("tar", [
    "-czf",
    archivePath,
    "-C",
    workDir,
    path.basename(contentDir)
  ]);
  return fs.readFileSync(archivePath);
}

function fakeGitHub(archive: Buffer, requestedUrls: string[]): typeof fetch {
  return async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    if (url.endsWith("/releases/latest")) {
      return Response.json({
        tag_name: "v1.2.3",
        assets: [
          { name: linuxAssetName, browser_download_url: "https://example.test/asset" }
        ]
      });
    }
    return new Response(archive);
  };
}

function temporaryDirectory(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "tonel-server-download-"));
}

const expectedExecutableSuffix = path.join(
  "v1.2.3",
  "tonel-smalltalk-language-server-x86_64-unknown-linux-gnu",
  "tonel-smalltalk-language-server"
);

test("downloadLatestServer extracts the latest release into the install root", async () => {
  const workDir = temporaryDirectory();
  const installRoot = temporaryDirectory();
  const requestedUrls: string[] = [];

  const executable = await downloadLatestServer({
    installRoot,
    platform: "linux",
    arch: "x64",
    fetch: fakeGitHub(makeReleaseArchive(workDir), requestedUrls)
  });

  assert.equal(executable, path.join(installRoot, expectedExecutableSuffix));
  assert.ok(fs.statSync(executable).mode & 0o100, "executable bit is set");
  assert.deepEqual(requestedUrls, [
    "https://api.github.com/repos/mumez/tonel-smalltalk-language-server/releases/latest",
    "https://example.test/asset"
  ]);
  assert.deepEqual(fs.readdirSync(installRoot), ["v1.2.3"]);
});

test("downloadLatestServer reuses an installed release without downloading it again", async () => {
  const workDir = temporaryDirectory();
  const installRoot = temporaryDirectory();
  const archive = makeReleaseArchive(workDir);
  await downloadLatestServer({
    installRoot,
    platform: "linux",
    arch: "x64",
    fetch: fakeGitHub(archive, [])
  });
  const requestedUrls: string[] = [];

  await downloadLatestServer({
    installRoot,
    platform: "linux",
    arch: "x64",
    fetch: fakeGitHub(archive, requestedUrls)
  });

  assert.equal(requestedUrls.length, 1, "only the release lookup is requested");
});

test("downloadLatestServer falls back to an installed release when offline", async () => {
  const workDir = temporaryDirectory();
  const installRoot = temporaryDirectory();
  await downloadLatestServer({
    installRoot,
    platform: "linux",
    arch: "x64",
    fetch: fakeGitHub(makeReleaseArchive(workDir), [])
  });

  const executable = await downloadLatestServer({
    installRoot,
    platform: "linux",
    arch: "x64",
    fetch: async () => {
      throw new TypeError("fetch failed");
    }
  });

  assert.equal(executable, path.join(installRoot, expectedExecutableSuffix));
});

test("downloadLatestServer rethrows when offline and nothing is installed", async () => {
  await assert.rejects(
    downloadLatestServer({
      installRoot: temporaryDirectory(),
      platform: "linux",
      arch: "x64",
      fetch: async () => {
        throw new TypeError("fetch failed");
      }
    }),
    /fetch failed/
  );
});

test("downloadLatestServer rejects unsupported platforms", async () => {
  await assert.rejects(
    downloadLatestServer({
      installRoot: temporaryDirectory(),
      platform: "linux",
      arch: "ia32",
      fetch: async () => assert.fail("must not fetch")
    }),
    /No prebuilt tonel-smalltalk-language-server for linux-ia32/
  );
});
