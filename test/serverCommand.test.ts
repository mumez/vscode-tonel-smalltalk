import assert from "node:assert/strict";
import test from "node:test";
import {
  findExecutableOnPath,
  resolveServerCommand,
  type ServerLaunchConfig
} from "../src/serverCommand";

function config(overrides: Partial<ServerLaunchConfig> = {}): ServerLaunchConfig {
  return {
    serverPath: "",
    findExecutableOnPath: () => undefined,
    downloadLatestServer: async () => "/storage/tonel-smalltalk-language-server",
    ...overrides
  };
}

test("serverPath wins over PATH and download", async () => {
  const command = await resolveServerCommand(
    config({
      serverPath: "  /opt/tonel-smalltalk-language-server  ",
      findExecutableOnPath: () => "/usr/bin/tonel-smalltalk-language-server"
    })
  );

  assert.deepEqual(command, {
    command: "/opt/tonel-smalltalk-language-server",
    args: []
  });
});

test("an executable on PATH wins over download", async () => {
  const command = await resolveServerCommand(
    config({
      findExecutableOnPath: () => "/usr/bin/tonel-smalltalk-language-server",
      downloadLatestServer: async () => assert.fail("must not download")
    })
  );

  assert.deepEqual(command, {
    command: "/usr/bin/tonel-smalltalk-language-server",
    args: []
  });
});

test("the downloaded server is the fallback", async () => {
  const command = await resolveServerCommand(config());

  assert.deepEqual(command, {
    command: "/storage/tonel-smalltalk-language-server",
    args: []
  });
});

test("findExecutableOnPath returns the first PATH entry holding the executable", () => {
  const found = findExecutableOnPath({
    pathVariable: "/usr/local/bin:/usr/bin",
    platform: "linux",
    fileExists: (candidate) =>
      candidate === "/usr/bin/tonel-smalltalk-language-server"
  });

  assert.equal(found, "/usr/bin/tonel-smalltalk-language-server");
});

test("findExecutableOnPath looks for the .exe on Windows", () => {
  const found = findExecutableOnPath({
    pathVariable: "C:\\tools;C:\\bin",
    platform: "win32",
    fileExists: (candidate) =>
      candidate === "C:\\bin\\tonel-smalltalk-language-server.exe"
  });

  assert.equal(found, "C:\\bin\\tonel-smalltalk-language-server.exe");
});

test("findExecutableOnPath returns undefined when nothing matches", () => {
  const found = findExecutableOnPath({
    pathVariable: "/usr/bin",
    platform: "linux",
    fileExists: () => false
  });

  assert.equal(found, undefined);
});
