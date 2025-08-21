import puppeteer from "puppeteer-extra";
import puppeteerExtraStealth from "puppeteer-extra-plugin-stealth";
import { NodeHtmlMarkdown } from "node-html-markdown";

// --- Stealth
puppeteer.use(puppeteerExtraStealth());

// --- Stronger removal targets
const REMOVE_SELECTORS = [
  // structural/navigation
  "nav",
  "header",
  "footer",
  "aside",
  "[role='navigation']",
  "[role='toolbar']",
  "[role='banner']",
  "[role='complementary']",
  "[data-testid*='nav']",
  "[data-test*='nav']",

  // UI chrome / CTAs
  "button",
  "input[type='button']",
  "input[type='submit']",
  "form",
  "select",

  // overlays / modals / toasts / sticky bars
  ".modal, [role='dialog'], [aria-modal='true']",
  ".toast, .snackbar",
  ".sticky, .is-sticky, [style*='position: sticky']",
  "[class*='sticky-']",
  ".announcement, .banner, .cookie, .cookie-banner",

  // monetization / social
  ".ads, [aria-label='ad'], [id*='ad-'], [class*='ad-']",
  ".share, .social, [class*='share-']",

  // misc clutter
  "noscript",
  "svg[aria-hidden='true']",
];

// --- Text-based removal heuristics (buttons/links with these words)
const REMOVE_TEXT_HINTS = [
  "subscribe",
  "sign in",
  "sign up",
  "log in",
  "start free",
  "try free",
  "get started",
  "cookies",
  "accept all",
  "manage preferences",
  "allow all",
  "install app",
];

// --- NodeHtmlMarkdown with MDX-friendly tweaks
const nhm = new NodeHtmlMarkdown({
  // keep paragraphs readable
  useInlineLinks: false,
  preferStrong: true,
  // keep single <br> as line breaks in paragraphs
  keepDataImages: false,
  // You can tune more options if needed
});

// --- Utility: collapse extra blank lines, trim trailing spaces
function postProcessMDX(s) {
  return (
    s
      .replace(/[ \t]+\n/g, "\n") // strip trailing spaces
      .replace(/\n{3,}/g, "\n\n") // collapse 3+ blank lines
      .replace(/\u00A0/g, " ") // nbsp to space
      .trim() + "\n"
  );
}

// --- Auto-scroll to trigger lazy content
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const distance = 600;
      let total = 0;
      const timer = setInterval(() => {
        const { scrollHeight } =
          document.scrollingElement || document.documentElement;
        window.scrollBy(0, distance);
        total += distance;
        if (total >= scrollHeight - window.innerHeight - 50) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// --- Strong cleaner that keeps killing new nodes for SPAs + handles iframes/shadow
async function strongClean(page, selectors, textHints) {
  // 1) Kill scripts/styles early
  await page.evaluate(() => {
    document
      .querySelectorAll(
        "script, style, link[rel='preload'], link[rel='preconnect']"
      )
      .forEach((el) => el.remove());
  });

  // 2) Remove by selectors & roles & attributes
  await page.evaluate(
    ({ selectors }) => {
      const kill = (root = document) => {
        selectors.forEach((sel) =>
          root.querySelectorAll(sel).forEach((el) => el.remove())
        );
        // roles/attributes that commonly map to chrome
        root
          .querySelectorAll(
            "[role='menu'], [role='menubar'], [role='search'], [role='tablist']"
          )
          .forEach((el) => el.remove());
        // Ads via common attributes/classes
        root
          .querySelectorAll(
            "[data-ad], [data-testid*='ad'], [class*='-ad-'], [id*='-ad-']"
          )
          .forEach((el) => el.remove());
      };
      kill();
      // Keep killing new ones that appear
      const mo = new MutationObserver(() => kill());
      mo.observe(document, { childList: true, subtree: true });
    },
    { selectors }
  );

  // 3) Text-based nuking for CTAs/cookie prompts
  await page.evaluate(
    (hints) => {
      const matchText = (el) => (el.textContent || "").toLowerCase();
      const killIfMatch = (els) => {
        els.forEach((el) => {
          const t = matchText(el);
          if (hints.some((h) => t.includes(h))) el.remove();
        });
      };
      killIfMatch([
        ...document.querySelectorAll(
          "a, button, [role='button'], [role='link'], div, p, span"
        ),
      ]);
    },
    textHints.map((t) => t.toLowerCase())
  );

  // 4) Shadow DOM (best-effort)
  await page.evaluate(() => {
    const traverseShadow = (root) => {
      const trees = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.shadowRoot) trees.push(node.shadowRoot);
      }
      return trees;
    };
    const allShadowRoots = traverseShadow(document);
    allShadowRoots.forEach((sr) => {
      sr.querySelectorAll(
        "nav, header, footer, button, .modal, .cookie, .cookie-banner"
      ).forEach((el) => el.remove());
    });
  });

  // 5) iFrames (same-origin only)
  for (const frame of page.frames()) {
    try {
      await frame.evaluate((selectors) => {
        selectors.forEach((sel) =>
          frameElement?.contentDocument
            ?.querySelectorAll(sel)
            .forEach((el) => el.remove())
        );
      }, selectors);
    } catch {
      // cross-origin: ignore safely
    }
  }

  // 6) Final sweep for empties
  await page.evaluate(() => {
    // Drop empty asides/headers/footers left behind
    document.querySelectorAll("aside, header, footer").forEach((el) => {
      if (!el.textContent?.trim()) el.remove();
    });
  });
}

// --- Main handler
export const handler = async (event) => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--window-size=1920,1080",
    ],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  // Load & let the network settle
  await page.goto(event.url, { waitUntil: "networkidle2", timeout: 90_000 });

  // Auto-scroll to trigger lazy content (images/next page blocks)
  await autoScroll(page);

  // --- Metadata
  const title = await page.title();
  const description = await page.evaluate(
    () => document.querySelector("meta[name='description']")?.content || null
  );

  // --- 1) FULL PAGE HTML -> MDX
  const htmlFull = await page.content();
  const mdxFull = postProcessMDX(nhm.translate(htmlFull));

  // --- 2) BODY-ONLY -> MDX (raw body, before cleaning)
  const bodyHtml = await page.evaluate(() => document.body.innerHTML);
  const mdxBody = postProcessMDX(nhm.translate(bodyHtml));

  // --- 3) STRONG CLEAN, then BODY -> MDX
  await strongClean(page, REMOVE_SELECTORS, REMOVE_TEXT_HINTS);
  const htmlCleaned = await page.content();
  const bodyCleaned = await page.evaluate(() => document.body.innerHTML);
  const mdxCleaned = postProcessMDX(nhm.translate(bodyCleaned));

  const result = {
    url: event.url,
    title,
    description,
    // raw html snapshots
    htmlFull,
    htmlCleaned,
    // mdx variants
    mdxFull,
    mdxBody,
    mdxCleaned,
  };

  console.log(result);
  await browser.close();
  return result;
};
