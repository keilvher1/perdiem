#!/usr/bin/env node
/**
 * lib/bills/copy-ocr-assets.mjs — self-host the OCR engine used by the bill drop.
 *
 * lib/bills/extract.ts reads images with tesseract.js in a Web Worker. By default tesseract.js
 * downloads its worker, its WebAssembly core and the language data from a CDN at runtime; PerDiem
 * loads nothing from a CDN, so this script copies exactly the files the browser needs from
 * node_modules into public/tesseract/ (served same-origin, behind the same Basic auth as the app):
 *
 *   worker.min.js                   tesseract.js browser worker
 *   tesseract-core-simd-lstm.wasm.js WebAssembly core (LSTM engine, SIMD; the .wasm is embedded)
 *   eng.traineddata.gz              English LSTM model (@tesseract.js-data/eng 4.0.0_best_int)
 *
 * Only the SIMD + LSTM core is copied: every current browser has WebAssembly SIMD (Chrome 91,
 * Firefox 89, Safari 16.4). extract.ts checks for SIMD first and reports "OCR not available in this
 * browser" otherwise (PDF and text bills still work).
 *
 * Run after installing or upgrading tesseract.js / tesseract.js-core / @tesseract.js-data/eng:
 *   node lib/bills/copy-ocr-assets.mjs
 * It prints each file and its size, and exits 1 if a source file is missing. The two .js files get a
 * leading "eslint-disable" comment line: `npm run lint` lints everything outside .next/, and these are
 * minified vendor builds (a comment line changes nothing at runtime).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(join(root, "package.json"));
const out = join(root, "public", "tesseract");

const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));
const tesseract = pkgDir("tesseract.js");
// tesseract.js-core is a dependency of tesseract.js: resolve it from there (hoisted or nested).
const core = dirname(createRequire(join(tesseract, "package.json")).resolve("tesseract.js-core/package.json"));
const eng = pkgDir("@tesseract.js-data/eng");

const FILES = [
  [join(tesseract, "dist", "worker.min.js"), "worker.min.js"],
  [join(core, "tesseract-core-simd-lstm.wasm.js"), "tesseract-core-simd-lstm.wasm.js"],
  [join(eng, "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
];

mkdirSync(out, { recursive: true });
let total = 0;
let missing = 0;
for (const [src, name] of FILES) {
  if (!existsSync(src)) {
    console.error(`missing: ${relative(root, src)}`);
    missing += 1;
    continue;
  }
  const dest = join(out, name);
  if (name.endsWith(".js")) writeFileSync(dest, `/* eslint-disable */\n${readFileSync(src, "utf8")}`);
  else copyFileSync(src, dest);
  const size = statSync(dest).size;
  total += size;
  console.log(`${relative(root, dest).padEnd(52)} ${(size / 1024 / 1024).toFixed(2)} MB  <- ${relative(root, src)}`);
}
console.log(`${"total".padEnd(52)} ${(total / 1024 / 1024).toFixed(2)} MB`);
process.exit(missing > 0 ? 1 : 0);
