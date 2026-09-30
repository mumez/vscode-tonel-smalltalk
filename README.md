# Tonel Smalltalk for VS Code

Editor support for Tonel `.st` files. Highlighting lives in this extension. Navigation and syntax diagnostics come from [tonel-smalltalk-language-server](https://github.com/mumez/tonel-smalltalk-language-server) over stdio.

## Features

- Syntax highlighting for comments, strings, symbols, pragmas, Tonel keywords, and class names
- Go to Definition (F12)
- Find All References (Shift+F12)
- Hover for class, trait, and variable information
- Syntax-error diagnostics

The language server implements those LSP methods. This extension does not reimplement them.

## Requirements

- VS Code 1.85 or newer
- Network access to GitHub on first start, unless you provide the `tonel-smalltalk-language-server` binary yourself. See [Language server](#language-server).
- A workspace folder that contains the Tonel sources. The server indexes that folder on startup.

## Develop

`npm run package` uses `@vscode/vsce` 4, which requires Node.js 22 or newer.

```bash
npm install
npm test
npm run compile
```

Press F5 and choose **Run Extension**.

## Language server

The language server (`tonel-smalltalk-language-server`) is downloaded automatically. No manual setup is required.

The extension picks the first match:

1. `tonelSmalltalk.serverPath`: that executable
2. `tonel-smalltalk-language-server` on `PATH`
3. The latest release from [`mumez/tonel-smalltalk-language-server`](https://github.com/mumez/tonel-smalltalk-language-server), downloaded into the extension's global storage

Step 3 checks GitHub for the latest release on every start and downloads it only when that version is not stored yet. When GitHub is unreachable, it uses the newest stored version. Extraction uses the system `tar` (`System32\tar.exe` on Windows 10 and later).

### Download a release manually

To use a binary instead of the automatic download, download the archive for your platform from the [releases page](https://github.com/mumez/tonel-smalltalk-language-server/releases):

- `tonel-smalltalk-language-server-aarch64-apple-darwin.tar.gz`
- `tonel-smalltalk-language-server-x86_64-apple-darwin.tar.gz`
- `tonel-smalltalk-language-server-aarch64-unknown-linux-gnu.tar.gz`
- `tonel-smalltalk-language-server-x86_64-unknown-linux-gnu.tar.gz`
- `tonel-smalltalk-language-server-aarch64-pc-windows-msvc.zip`
- `tonel-smalltalk-language-server-x86_64-pc-windows-msvc.zip`

Each archive contains a directory with the `tonel-smalltalk-language-server` executable (`tonel-smalltalk-language-server.exe` on Windows). Extract it, then copy the executable onto `PATH`, or set its path in your VS Code `settings.json`, for example on Windows:

```json
{
  "tonelSmalltalk.serverPath": "C:\\Users\\someone\\bin\\tonel-smalltalk-language-server.exe"
}
```

### Build from source

Build the server in its own repository:

```bash
cargo build --release
```

The release binary is `target/release/tonel-smalltalk-language-server`. Point `tonelSmalltalk.serverPath` at it, or copy it onto `PATH`.

### Logs

Startup logs are in the **Tonel Smalltalk Language Server** output channel. A successful index logs `Workspace scan complete`.

## Package

```bash
npm run package
```

`npm run compile` type-checks with `tsc` and bundles `src/extension.ts` and `vscode-languageclient` into `dist/extension.js` with esbuild, so the VSIX ships no `node_modules`. This produces `vscode-tonel-smalltalk-0.0.1.vsix`. Install it from the VS Code Extensions view with **Install from VSIX**.

## Publish

The **Publish** workflow (`.github/workflows/publish.yml`) runs on manual dispatch only. It needs a repository secret `VSCE_PAT` holding an Azure DevOps personal access token with the **Marketplace (Manage)** scope for the `mumez` publisher.

1. Bump `version` in `package.json` and push to `main`.
2. Run **Actions > Publish > Run workflow**.

The workflow runs `npm test` and fails if a GitHub release named `v<version>` already exists. Then it publishes the VSIX to the Visual Studio Marketplace and attaches the same VSIX to a new GitHub release `v<version>`.

## Manual check

1. Leave `tonelSmalltalk.serverPath` empty and remove the server from `PATH` to test the automatic download, or set `tonelSmalltalk.serverPath`.
2. Press F5 in this repository.
3. In the Extension Development Host, open a folder of `.st` files.
4. Confirm comments, strings, symbols, and class names are colored.
5. Put the cursor on a class name and press F12. The editor opens that class definition.
6. Press Shift+F12 and confirm the references list.
7. Hover a class name and confirm the hover shows class information.
8. Insert a syntax error and confirm a diagnostic appears.
9. Confirm the output channel logs `Workspace scan complete`.

## Known limitations

- The language server is not bundled. If it cannot be found or downloaded, the extension shows an error message and does not start the client. Platforms other than macOS, Linux (glibc), and Windows on x64 or arm64 have no prebuilt binary and need `tonelSmalltalk.serverPath`.
- The download uses Node's `fetch`. Depending on the VS Code version, it may not follow VS Code's proxy settings. If the download fails behind a proxy, download the binary manually.
- Downloaded versions stay in global storage. Old versions are not removed.
- `tonelSmalltalk.serverPath` is read when the extension activates. Changing it needs a window reload. There is no restart command.
- The server indexes the workspace folder at startup, then updates documents that are open. It does not handle `workspace/didChangeWatchedFiles`, so a class added or edited in a closed `.st` file stays out of the index until reload.
- Highlighting is a TextMate grammar, not the tree-sitter grammar used by the language server. These forms are colored incorrectly or not at all:
  - radix integers such as `16r1F`
  - a leading minus on a number, such as `-3`
  - scaled decimals such as `1.5s2` (the `.` is treated as a statement terminator)
  - keyword symbols such as `#at:put:`
  - a space character literal, `$` followed by a space
  - `Class`, `Trait`, `Extension`, and `Package` anywhere, including when they are message receivers
- A `<...>` pragma is recognized only at the start of a line, after optional whitespace. A comparison written that way is colored as a pragma.
- The server provides definition, references, hover, and syntax diagnostics. Completion, formatting, rename, and code actions are not available.

## Remaining work

- `@types/vscode` is declared as `^1.85.0`, so the lockfile can resolve a much newer API than the VS Code 1.85 engine. Pin a 1.85-compatible range before using newer editor APIs.
- `npm test` does not launch the Extension Development Host. The manual check above is still the way to confirm definition, references, hover, and diagnostics against a real language server.
