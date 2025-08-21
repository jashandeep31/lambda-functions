import { Page } from "puppeteer-core";

export async function strongClean(
  page: Page,
  selectors: string[],
  textHints: string[]
) {
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
      const matchText = (el: any) => (el.textContent || "").toLowerCase();
      const killIfMatch = (els: any[]) => {
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
}
