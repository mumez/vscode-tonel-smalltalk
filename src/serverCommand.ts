export interface ServerLaunchConfig {
  serverPath: string;
}

export interface ServerCommand {
  command: string;
  args: string[];
}

export function resolveServerCommand(config: ServerLaunchConfig): ServerCommand {
  const configuredPath = config.serverPath.trim();
  if (configuredPath.length > 0) {
    return { command: configuredPath, args: [] };
  }

  return { command: "tonel-smalltalk-language-server", args: [] };
}
