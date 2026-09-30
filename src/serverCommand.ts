import * as path from "node:path";

export const serverExecutableBaseName = "tonel-smalltalk-language-server";

export function serverExecutableName(platform: NodeJS.Platform): string {
  return platform === "win32"
    ? `${serverExecutableBaseName}.exe`
    : serverExecutableBaseName;
}

export interface ServerLaunchConfig {
  serverPath: string;
  findExecutableOnPath: () => string | undefined;
  downloadLatestServer: () => PromiseLike<string>;
}

export interface ServerCommand {
  command: string;
  args: string[];
}

export async function resolveServerCommand(
  config: ServerLaunchConfig
): Promise<ServerCommand> {
  const configuredPath = config.serverPath.trim();
  if (configuredPath.length > 0) {
    return { command: configuredPath, args: [] };
  }

  const executableOnPath = config.findExecutableOnPath();
  if (executableOnPath) {
    return { command: executableOnPath, args: [] };
  }

  return { command: await config.downloadLatestServer(), args: [] };
}

export interface PathLookup {
  pathVariable: string;
  platform: NodeJS.Platform;
  fileExists: (candidate: string) => boolean;
}

export function findExecutableOnPath(lookup: PathLookup): string | undefined {
  const platformPath = lookup.platform === "win32" ? path.win32 : path.posix;
  const executableName = serverExecutableName(lookup.platform);
  return lookup.pathVariable
    .split(platformPath.delimiter)
    .filter((directory) => directory.length > 0)
    .map((directory) => platformPath.join(directory, executableName))
    .find(lookup.fileExists);
}
