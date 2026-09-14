import { copyFile, mkdir } from "node:fs/promises";

const vault = process.env["PROSODY_VAULT"];

if (!vault) {
  console.error("Set PROSODY_VAULT to your vault's absolute path, e.g.");
  console.error("  PROSODY_VAULT=~/vault bun run deploy");
  process.exit(1);
}

const dest = `${vault}/.obsidian/plugins/prosody`;

await mkdir(dest, { recursive: true });

const files = ["main.js", "manifest.json", "styles.css"];

await Promise.all(files.map((file) => copyFile(file, `${dest}/${file}`)));

console.log(`deployed ${files.join(", ")} -> ${dest}`);
