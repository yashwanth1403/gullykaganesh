/**
 * Screenshot a localhost URL into ./temporary screenshots/.
 *
 *   node screenshot.mjs http://localhost:3000 [label] [--w=390] [--h=844]
 *
 * Uses puppeteer-core against the Chrome already in ~/.cache/puppeteer, so
 * there is no second Chrome download. SwiftShader is forced on because
 * MapLibre needs a working WebGL context and headless Chrome has no GPU here.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CACHE = join(homedir(), ".cache/puppeteer/chrome");
const build = readdirSync(CACHE).sort().reverse()[0];
const CHROME = join(CACHE, build, "chrome-linux64", "chrome");

const url = process.argv[2] ?? "http://localhost:3000";
const args = process.argv.slice(3);
const label = args.find((a) => !a.startsWith("--")) ?? "";
const flag = (n, d) => {
  const m = args.find((a) => a.startsWith(`--${n}=`));
  return m ? Number(m.split("=")[1]) : d;
};
const width = flag("w", 390);
const height = flag("h", 844);

const OUT = "temporary screenshots";
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const next =
  readdirSync(OUT)
    .map((f) => Number(f.match(/^screenshot-(\d+)/)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0) + 1;
const file = join(OUT, `screenshot-${next}${label ? `-${label}` : ""}.png`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--hide-scrollbars",
  ],
});

const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 2, isMobile: width < 700, hasTouch: width < 700 });

const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text()}`);
});
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("requestfailed", (r) =>
  problems.push(`requestfailed: ${r.url().slice(0, 110)} — ${r.failure()?.errorText}`),
);

await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
// Tiles and the pin-drop sequence need a beat past network idle.
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: file });
await browser.close();

console.log(`saved: ${file}  (${width}x${height})`);
if (problems.length) {
  console.log(`\n${problems.length} runtime problem(s):`);
  [...new Set(problems)].slice(0, 12).forEach((p) => console.log("  - " + p));
} else {
  console.log("no console errors, no failed requests");
}
