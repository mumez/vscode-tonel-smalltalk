import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions
} from "vscode-languageclient/node";
import { resolveServerCommand } from "./serverCommand";

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("tonelSmalltalk");
  const server = resolveServerCommand({
    serverPath: config.get<string>("serverPath") ?? ""
  });

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
