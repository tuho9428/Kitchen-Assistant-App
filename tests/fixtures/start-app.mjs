import { spawn } from "node:child_process";
const next = "node_modules/next/dist/bin/next";
const build = spawn(process.execPath, [next, "build", "--webpack"], {
  stdio: "inherit",
  windowsHide: true,
});
build.on("exit", (code) => {
  if (code) process.exit(code);
  const server = spawn(
    process.execPath,
    [next, "start", "--port", "3100", "--hostname", "127.0.0.1"],
    { stdio: "inherit", windowsHide: true },
  );
  server.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGTERM", () => server.kill());
  process.on("SIGINT", () => server.kill());
});
