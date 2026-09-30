import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";
import { serverExecutableBaseName, serverExecutableName } from "./serverCommand";

const latestReleaseUrl =
  "https://api.github.com/repos/mumez/tonel-smalltalk-language-server/releases/latest";

const releaseTargets: Record<string, string> = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "linux-arm64": "aarch64-unknown-linux-gnu",
  "linux-x64": "x86_64-unknown-linux-gnu",
  "win32-arm64": "aarch64-pc-windows-msvc",
  "win32-x64": "x86_64-pc-windows-msvc"
};

export function releaseTarget(
  platform: NodeJS.Platform,
  arch: string
): string | undefined {
  return releaseTargets[`${platform}-${arch}`];
}

function releaseDirectoryName(target: string): string {
  return `${serverExecutableBaseName}-${target}`;
}

export function releaseAssetName(
  target: string,
  platform: NodeJS.Platform
): string {
  const extension = platform === "win32" ? "zip" : "tar.gz";
  return `${releaseDirectoryName(target)}.${extension}`;
}

export interface ServerDownloadOptions {
  installRoot: string;
  platform: NodeJS.Platform;
  arch: string;
  fetch: typeof fetch;
}

interface LatestRelease {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}

/**
 * Returns the executable of the latest GitHub release, downloading it into
 * installRoot/<tag>/ when missing. Falls back to an installed release when
 * GitHub cannot be reached.
 */
export async function downloadLatestServer(
  options: ServerDownloadOptions
): Promise<string> {
  const target = releaseTarget(options.platform, options.arch);
  if (!target) {
    throw new Error(
      `No prebuilt ${serverExecutableBaseName} for ${options.platform}-${options.arch}. Set tonelSmalltalk.serverPath.`
    );
  }
  const executableInRelease = (tag: string) =>
    path.join(
      options.installRoot,
      tag,
      releaseDirectoryName(target),
      serverExecutableName(options.platform)
    );

  let release: LatestRelease;
  try {
    release = await fetchJson<LatestRelease>(options.fetch, latestReleaseUrl);
  } catch (error) {
    const installed = findInstalledExecutable(options.installRoot, executableInRelease);
    if (installed) {
      return installed;
    }
    throw error;
  }

  const executable = executableInRelease(release.tag_name);
  if (fs.existsSync(executable)) {
    return executable;
  }

  const assetName = releaseAssetName(target, options.platform);
  const asset = release.assets.find((candidate) => candidate.name === assetName);
  if (!asset) {
    throw new Error(`Release ${release.tag_name} has no asset ${assetName}.`);
  }
  await installReleaseAsset(
    options,
    asset.browser_download_url,
    path.join(options.installRoot, release.tag_name),
    assetName
  );
  return executable;
}

function findInstalledExecutable(
  installRoot: string,
  executableInRelease: (tag: string) => string
): string | undefined {
  if (!fs.existsSync(installRoot)) {
    return undefined;
  }
  return fs
    .readdirSync(installRoot)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .map(executableInRelease)
    .find((candidate) => fs.existsSync(candidate));
}

async function fetchJson<T>(fetchFunction: typeof fetch, url: string): Promise<T> {
  const response = await fetchFunction(url, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "vscode-tonel-smalltalk" }
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function installReleaseAsset(
  options: ServerDownloadOptions,
  assetUrl: string,
  releaseDirectory: string,
  assetName: string
): Promise<void> {
  const response = await options.fetch(assetUrl);
  if (!response.ok) {
    throw new Error(`GET ${assetUrl} failed: ${response.status} ${response.statusText}`);
  }
  const archive = Buffer.from(await response.arrayBuffer());

  // Extract into a staging directory so a failed download never looks installed.
  const stagingDirectory = `${releaseDirectory}.partial`;
  fs.rmSync(stagingDirectory, { recursive: true, force: true });
  fs.mkdirSync(stagingDirectory, { recursive: true });
  try {
    const archivePath = path.join(stagingDirectory, assetName);
    fs.writeFileSync(archivePath, archive);
    await promisify(execFile)(tarCommand(options.platform), [
      "-xf",
      archivePath,
      "-C",
      stagingDirectory
    ]);
    fs.rmSync(archivePath);
    if (options.platform !== "win32") {
      for (const file of fs.readdirSync(stagingDirectory, { recursive: true })) {
        const filePath = path.join(stagingDirectory, String(file));
        if (path.basename(filePath) === serverExecutableBaseName) {
          fs.chmodSync(filePath, 0o755);
        }
      }
    }
    fs.renameSync(stagingDirectory, releaseDirectory);
  } catch (error) {
    fs.rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

// Windows 10+ ships bsdtar as System32\tar.exe, which also extracts zip files.
function tarCommand(platform: NodeJS.Platform): string {
  return platform === "win32"
    ? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
    : "tar";
}
