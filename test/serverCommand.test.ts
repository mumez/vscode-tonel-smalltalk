import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  resolveServerCommand,
  type ServerLaunchConfig
} from "../src/serverCommand";

function config(overrides: Partial<ServerLaunchConfig> = {}): ServerLaunchConfig {
  return {
    serverProjectPath: "",
    serverPath: "",
    platform: "linux",
    extensionPath: "/ext",
    fileExists: () => false,
    ...overrides
  };
}

test("serverProjectPath runs cargo against that Cargo.toml", () => {
  const command = resolveServerCommand(
    config({ serverProjectPath: "  /srv/tonel-smalltalk-language-server  " })
  );

  assert.equal(command.command, "cargo");
  assert.deepEqual(command.args, [
    "run",
    "--release",
    "--manifest-path",
    path.join("/srv/tonel-smalltalk-language-server", "Cargo.toml")
  ]);
});

test("serverPath wins over a local binary and PATH", () => {
  const command = resolveServerCommand(
    config({
      serverPath: "/opt/tonel-smalltalk-language-server",
      fileExists: () => true
    })
  );

  assert.deepEqual(command, {
    command: "/opt/tonel-smalltalk-language-server",
    args: []
  });
});

test("a configured serverPath is kept when the file is missing", () => {
  const command = resolveServerCommand(
    config({ serverPath: "/missing/tonel-smalltalk-language-server" })
  );

  assert.equal(command.command, "/missing/tonel-smalltalk-language-server");
});

test("an existing local binary is used before PATH", () => {
  const localBin = path.join(
    "/ext",
    "node_modules",
    ".bin",
    "tonel-smalltalk-language-server"
  );
  const command = resolveServerCommand(
    config({
      fileExists: (candidate) => candidate === localBin
    })
  );

  assert.deepEqual(command, { command: localBin, args: [] });
});

test("Windows looks for the npm cmd shim", () => {
  const localBin = path.join(
    "/ext",
    "node_modules",
    ".bin",
    "tonel-smalltalk-language-server.cmd"
  );
  const command = resolveServerCommand(
    config({
      platform: "win32",
      fileExists: (candidate) => candidate === localBin
    })
  );

  assert.equal(command.command, localBin);
});

test("PATH is the fallback", () => {
  const command = resolveServerCommand(config());

  assert.deepEqual(command, {
    command: "tonel-smalltalk-language-server",
    args: []
  });
});
