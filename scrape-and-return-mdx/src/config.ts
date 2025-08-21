export const REMOVE_SELECTORS = [
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
export const REMOVE_TEXT_HINTS = [
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
