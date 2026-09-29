/**
 * lib/bills/extract.ts — the text of a dropped bill, read in the browser (nothing is uploaded).
 *
 *   .txt                     File.text()
 *   .pdf                     the PDF's text layer (unpdf, pdf.js inside), rebuilt line by line
 *   .png .jpg .jpeg .webp    OCR (tesseract.js in a Web Worker): English, plus Korean, Japanese or
 *                            Simplified Chinese when that is the UI language (`ocrLanguages`)
 *
 * Both libraries are loaded with a dynamic import() the first time a file of that kind arrives, so
 * the traveler page does not carry them. OCR runs entirely on self-hosted files under
 * public/tesseract/ (worker, WebAssembly core, English model: lib/bills/copy-ocr-assets.mjs; the
 * kor / jpn / chi_sim models, 1.5–1.9 MB each: lib/bills/fetch-ocr-langs.mjs): no runtime CDN
 * fetch. A CJK model is fetched only when a Korean, Japanese or Chinese UI reads its first image;
 * with an English UI, text in those scripts is not recognized in images (PDF and text bills are
 * read in any script).
 *
 * Errors are BillFileError with a code; the UI localizes the code (lib/i18n/messages/bills.ts).
 */

export const MAX_BILL_BYTES = 5 * 1024 * 1024;
/** Maximum PDF pages read (a bill is one or two pages). */
const MAX_PDF_PAGES = 5;

/** For <input type="file" accept>. */
export const BILL_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain";

export type BillFileKind = "text" | "pdf" | "image";

export type BillFileErrorCode =
  /** Not .txt / .pdf / .png / .jpg / .jpeg / .webp. */
  | "unsupported"
  /** Larger than 5 MB. */
  | "too_large"
  /** 0 bytes. */
  | "empty"
  /** The file has no readable text (a scanned PDF without a text layer, a blank image). */
  | "no_text"
  /** OCR cannot run here (no WebAssembly SIMD) or its files did not load. */
  | "ocr_unavailable"
  /** The file could not be read (damaged, password-protected, …). */
  | "read_failed";

export class BillFileError extends Error {
  readonly code: BillFileErrorCode;
  constructor(code: BillFileErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "BillFileError";
    this.code = code;
  }
}

export interface BillText {
  text: string;
  kind: BillFileKind;
}

const EXT: Record<string, BillFileKind> = {
  txt: "text",
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
};
const MIME: Record<string, BillFileKind> = {
  "text/plain": "text",
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};

/** The kind of bill file, by extension first (some systems send no MIME type), else by MIME type. */
export function billFileKind(file: { name: string; type: string }): BillFileKind | null {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  if (ext && EXT[ext]) return EXT[ext];
  return MIME[file.type.toLowerCase()] ?? null;
}

/** Checks type and size without reading the file. Throws BillFileError. */
export function assertBillFile(file: { name: string; type: string; size: number }): BillFileKind {
  const kind = billFileKind(file);
  if (!kind) throw new BillFileError("unsupported", `Unsupported file type: ${file.name}`);
  if (file.size === 0) throw new BillFileError("empty", `The file is empty: ${file.name}`);
  if (file.size > MAX_BILL_BYTES) throw new BillFileError("too_large", `Larger than 5 MB: ${file.name}`);
  return kind;
}

/** OCR models PerDiem self-hosts (public/tesseract/<code>.traineddata.gz). */
export type OcrLanguage = "eng" | "kor" | "jpn" | "chi_sim";

/** The OCR models for a UI language: English, plus the UI language's own script. */
export function ocrLanguagesFor(locale: string): OcrLanguage[] {
  if (locale === "ko") return ["eng", "kor"];
  if (locale === "ja") return ["eng", "jpn"];
  if (locale === "zh") return ["eng", "chi_sim"];
  return ["eng"];
}

export async function fileToText(file: File, opts: { ocrLanguages?: OcrLanguage[] } = {}): Promise<BillText> {
  const kind = assertBillFile(file);
  let text: string;
  try {
    if (kind === "text") text = await file.text();
    else if (kind === "pdf") text = await pdfText(new Uint8Array(await file.arrayBuffer()));
    else text = await ocrText(file, opts.ocrLanguages ?? ["eng"]);
  } catch (e) {
    if (e instanceof BillFileError) throw e;
    throw new BillFileError("read_failed", `Could not read ${file.name}`, { cause: e });
  }
  text = text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!/[\p{L}\p{N}]/u.test(text)) throw new BillFileError("no_text", `No text found in ${file.name}`);
  return { text, kind };
}

// ---------------------------------------------------------------------------------------------
// PDF: the text layer, rebuilt into lines by position (pdf.js returns runs, not lines)
// ---------------------------------------------------------------------------------------------

interface Run {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Groups text runs into lines (top to bottom, left to right). Exported for tests. */
export function runsToLines(runs: Run[]): string[] {
  const sorted = runs.filter((r) => r.str !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Run[][] = [];
  for (const r of sorted) {
    const line = lines[lines.length - 1];
    const tol = Math.max(2, Math.min(r.h, line?.[0].h ?? r.h) * 0.5);
    if (line && Math.abs(line[0].y - r.y) <= tol) line.push(r);
    else lines.push([r]);
  }
  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    let out = "";
    let end = -Infinity;
    for (const r of line) {
      const gap = r.x - end;
      const h = r.h || 10;
      if (out !== "" && !out.endsWith(" ") && !r.str.startsWith(" ")) {
        if (gap > h * 1.5) out += "  ";
        else if (gap > h * 0.15) out += " ";
      }
      out += r.str;
      end = r.x + r.w;
    }
    return out.trim();
  });
}

/** The text of a PDF (its text layer, first 5 pages). Works in the browser and in Node. */
export async function pdfText(data: Uint8Array): Promise<string> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(data);
  try {
    const pages: string[] = [];
    for (let p = 1; p <= Math.min(pdf.numPages, MAX_PDF_PAGES); p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      const runs: Run[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const [, , , d, x, y] = item.transform as number[];
        runs.push({ str: item.str, x, y, w: item.width, h: item.height || Math.abs(d) });
      }
      pages.push(runsToLines(runs).join("\n"));
    }
    return pages.join("\n");
  } finally {
    void pdf.loadingTask.destroy();
  }
}

// ---------------------------------------------------------------------------------------------
// Images: tesseract.js, self-hosted (public/tesseract/), one worker kept for the page's lifetime
// ---------------------------------------------------------------------------------------------

/** WebAssembly SIMD probe (the same module wasm-feature-detect validates). */
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
]);

function hasWasmSimd(): boolean {
  try {
    return typeof WebAssembly === "object" && WebAssembly.validate(SIMD_PROBE);
  } catch {
    return false;
  }
}

type OcrWorker = { recognize(image: Blob): Promise<{ data: { text: string } }>; terminate(): Promise<unknown> };
let ocrWorker: Promise<OcrWorker> | null = null;
/** The models the current worker was created with ("eng+kor"). */
let ocrLangs = "";

function getOcrWorker(languages: OcrLanguage[]): Promise<OcrWorker> {
  const langs = languages.join("+");
  if (ocrWorker && ocrLangs !== langs) {
    // The UI language changed: a worker with the other models replaces this one.
    const old = ocrWorker;
    ocrWorker = null;
    void old.then((w) => w.terminate()).catch(() => {});
  }
  if (!ocrWorker) {
    ocrLangs = langs;
    ocrWorker = (async () => {
      if (!hasWasmSimd()) throw new BillFileError("ocr_unavailable", "WebAssembly SIMD is not available");
      const mod = await import("tesseract.js");
      const T = (mod as unknown as { default?: typeof mod }).default ?? mod;
      const base = new URL("/tesseract/", window.location.origin).href;
      let worker: Awaited<ReturnType<typeof T.createWorker>>;
      try {
        worker = await T.createWorker(languages, T.OEM.LSTM_ONLY, {
          workerPath: `${base}worker.min.js`,
          corePath: `${base}tesseract-core-simd-lstm.wasm.js`,
          langPath: base.replace(/\/$/, ""),
          workerBlobURL: false,
          cacheMethod: "none",
          gzip: true,
        });
      } catch (e) {
        throw new BillFileError("ocr_unavailable", "The OCR engine did not load", { cause: e });
      }
      // One uniform block: keeps a label and its amount on the same line on receipts.
      await worker.setParameters({ tessedit_pageseg_mode: T.PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
      return worker;
    })();
    const mine = ocrWorker;
    mine.catch(() => {
      if (ocrWorker === mine) ocrWorker = null; // let a later drop try again
    });
  }
  return ocrWorker;
}

async function ocrText(image: Blob, languages: OcrLanguage[]): Promise<string> {
  const worker = await getOcrWorker(languages);
  const { data } = await worker.recognize(image);
  return data.text;
}
