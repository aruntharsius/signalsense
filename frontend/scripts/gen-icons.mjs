import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const svg   = readFileSync(resolve(__dir, "../public/icon.svg"));
const out   = (name) => resolve(__dir, "../public", name);

await sharp(svg).resize(512, 512).png().toFile(out("icon-512.png"));
await sharp(svg).resize(192, 192).png().toFile(out("icon-192.png"));
await sharp(svg).resize(180, 180).png().toFile(out("apple-touch-icon.png"));
await sharp(svg).resize(32,  32 ).png().toFile(out("favicon.png"));

console.log("Icons generated ✓");
