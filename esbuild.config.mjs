import esbuild from "esbuild";

const prod = process.argv.includes("--prod");

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  target: "es2020",
  platform: "browser",
  outfile: "main.js",
  external: [
    "obsidian",
    "electron",
    "@electron/remote",
    "child_process",
    "node:child_process",
    "fs",
    "node:fs",
    "path",
    "node:path",
    "os",
    "node:os",
  ],
  footer: { js: "module.exports = module.exports.default || module.exports;" },
  logLevel: "info",
  minify: prod,
  sourcemap: false,
});
