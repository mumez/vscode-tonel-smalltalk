import * as path from "node:path";

export interface ServerLaunchConfig {
  serverProjectPath: string;
  serverPath: string;
  platform: NodeJS.Platform;
  extensionPath: string;
  fileExists: (candidate: string) => boolean;
}

export interface ServerCommand {
  command: string;
  args: string[];
}

function binaryName(platform: NodeJS.Platform): string {
  return platform === "win32"
    ? "tonel-smalltalk-language-server.cmd"
    : "tonel-smalltalk-language-server";
}

export function resolveServerCommand(config: ServerLaunchConfig): ServerCommand {
  const projectPath = config.serverProjectPath.trim();
  if (projectPath.length > 0) {
    return {
      command: "cargo",
      args: [
        "run",
        "--release",
        "--manifest-path",
        path.join(projectPath, "Cargo.toml")
      ]
    };
  }

  const configuredPath = config.serverPath.trim();
  if (configuredPath.length > 0) {
    return { command: configuredPath, args: [] };
  }

  const localBin = path.join(
    config.extensionPath,
    "node_modules",
    ".bin",
    binaryName(config.platform)
  );
  if (config.fileExists(localBin)) {
    return { command: localBin, args: [] };
  }

  return { command: "tonel-smalltalk-language-server", args: [] };
}
