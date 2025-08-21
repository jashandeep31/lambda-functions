// import puppeteer from "puppeteer-extra";
import puppeteer, { Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { strongClean } from "./strong-clean";
import { REMOVE_SELECTORS, REMOVE_TEXT_HINTS } from "./config";
const nhm = new NodeHtmlMarkdown({
  useInlineLinks: false,
  keepDataImages: false,
});

// --- Stealth
// puppeteer.use(puppeteerExtraStealth());

export const handler = async (event: { url: string }) => {
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: await chromium.executablePath(),
    args: chromium.args,

    defaultViewport: { width: 1920, height: 1080 },
  });
  const page = await browser.newPage();
  await page.goto(event.url, {
    waitUntil: "networkidle2",
    timeout: 90_000,
  });
  //   await autoScroll(page);

  // --- Metadata
  const title = await page.title();
  const description = await page.evaluate(
    () =>
      document
        .querySelector("meta[name='description']")
        ?.getAttribute("content") || null
  );
  // --- 1) FULL PAGE HTML -> MDX
  const htmlFull = await page.content();
  const mdxFull = postProcessMDX(nhm.translate(htmlFull));

  // --- 3) STRONG CLEAN, then BODY -> MDX
  await strongClean(page, REMOVE_SELECTORS, REMOVE_TEXT_HINTS);
  const htmlCleaned = await page.content();
  const bodyCleaned = await page.evaluate(() => document.body.innerHTML);
  const mdxCleaned = postProcessMDX(nhm.translate(bodyCleaned));

  return {
    statusCode: 200,
    body: JSON.stringify({
      title,
      description,
      htmlFull,
      htmlCleaned,
      mdxFull,
      mdxCleaned,
    }),
  };
};

async function autoScroll(page: Page) {
  // page.evaluate will wait for the returned promise to resolve
  await page.evaluate(() => {
    // Return the promise directly
    return new Promise((resolve) => {
      const distance = 600;
      let total = 0;
      const timer = setInterval(() => {
        const { scrollHeight } =
          document.scrollingElement || document.documentElement;
        window.scrollBy(0, distance);
        total += distance;
        if (total >= scrollHeight - window.innerHeight - 50) {
          clearInterval(timer);
          resolve(1); // Resolve the promise
        }
      }, 100);
    });
  });
}
// --- Utility: collapse extra blank lines, trim trailing spaces
function postProcessMDX(s: string) {
  return (
    s
      .replace(/[ \t]+\n/g, "\n") // strip trailing spaces
      .replace(/\n{3,}/g, "\n\n") // collapse 3+ blank lines
      .replace(/\u00A0/g, " ") // nbsp to space
      .trim() + "\n"
  );
}
