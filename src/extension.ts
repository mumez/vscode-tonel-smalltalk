import * as fs from "node:fs";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from "vscode-languageclient/node";
import {
  findExecutableOnPath,
  resolveServerCommand,
  type ServerCommand
} from "./serverCommand";
import { downloadLatestServer } from "./serverDownload";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("tonelSmalltalk");
  let server: ServerCommand;
  try {
    server = await resolveServerCommand({
      serverPath: config.get<string>("serverPath") ?? "",
      findExecutableOnPath: () =>
        findExecutableOnPath({
          pathVariable: process.env.PATH ?? "",
          platform: process.platform,
          fileExists: fs.existsSync
        }),
      downloadLatestServer: () =>
        vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Downloading Tonel Smalltalk language server"
          },
          () =>
            downloadLatestServer({
              installRoot: vscode.Uri.joinPath(context.globalStorageUri, "server").fsPath,
              platform: process.platform,
              arch: process.arch,
              fetch
            })
        )
    });
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Tonel Smalltalk language server could not be started: ${error instanceof Error ? error.message : String(error)}`
    );
    return;
  }

  const executable = { command: server.command, args: server.args };
  const serverOptions: ServerOptions = {
    run: executable,
    debug: executable
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "tonel-smalltalk" }]
  };

  client = new LanguageClient(
    "tonelSmalltalkLanguageServer",
    "Tonel Smalltalk Language Server",
    serverOptions,
    clientOptions
  );

  await client.start();
}

export async function deactivate(): Promise<void> {
  if (!client) {
    return;
  }

  await client.stop();
  client = undefined;
}
