#!/usr/bin/env node
/**
 * lib/bills/fetch-ocr-langs.mjs — self-host the Korean, Japanese and Simplified Chinese OCR models.
 *
 * lib/bills/extract.ts reads images with English OCR; when the UI language is Korean, Japanese or
 * Chinese it adds that language's model (eng+kor, eng+jpn, eng+chi_sim), loaded lazily on the first
 * image. The models are the `4.0.0_best_int` builds of the npm packages @tesseract.js-data/{kor,jpn,
 * chi_sim}@1.0.0 (the same family and version as @tesseract.js-data/eng, a dependency):
 *
 *   public/tesseract/kor.traineddata.gz       1.50 MB
 *   public/tesseract/jpn.traineddata.gz       1.94 MB
 *   public/tesseract/chi_sim.traineddata.gz   1.64 MB
 *
 * They are not npm dependencies (package.json is not changed), so this script downloads each
 * package tarball from the npm registry, checks it against the registry's sha512 integrity, and
 * extracts the one file. Served same-origin like the English model (no runtime CDN fetch).
 *   node lib/bills/fetch-ocr-langs.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "public", "tesseract");
const VERSION = "1.0.0";
const LANGS = ["kor", "jpn", "chi_sim"];

/** The bytes of `wanted` inside a (ustar) tar archive, or null. */
function untar(tar, wanted) {
  for (let off = 0; off + 512 <= tar.length; ) {
    const header = tar.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const str = (a, b) => header.subarray(a, b).toString("utf8").replace(/\0.*$/s, "");
    const name = [str(345, 500), str(0, 100)].filter(Boolean).join("/");
    const size = parseInt(str(124, 136).trim() || "0", 8);
    const body = off + 512;
    if (name === wanted) return tar.subarray(body, body + size);
    off = body + Math.ceil(size / 512) * 512;
  }
  return null;
}

mkdirSync(out, { recursive: true });
let failed = 0;
for (const lang of LANGS) {
  const pkg = `@tesseract.js-data/${lang}`;
  try {
    const meta = await (await fetch(`https://registry.npmjs.org/${pkg}/${VERSION}`)).json();
    const { tarball, integrity } = meta.dist;
    const tgz = Buffer.from(await (await fetch(tarball)).arrayBuffer());
    const [algo, expected] = integrity.split("-");
    const actual = createHash(algo).update(tgz).digest("base64");
    if (actual !== expected) throw new Error(`integrity mismatch (${algo})`);
    const file = untar(gunzipSync(tgz), `package/4.0.0_best_int/${lang}.traineddata.gz`);
    if (!file) throw new Error("4.0.0_best_int model not in the package");
    writeFileSync(join(out, `${lang}.traineddata.gz`), file);
    console.log(`public/tesseract/${lang}.traineddata.gz`.padEnd(42), `${(file.length / 1024 / 1024).toFixed(2)} MB  <- ${pkg}@${VERSION} (${integrity.slice(0, 20)}…)`);
  } catch (e) {
    failed += 1;
    console.error(`${pkg}: ${e instanceof Error ? e.message : e}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
