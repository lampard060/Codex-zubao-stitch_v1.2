import { bindRoleTabs, bindApplicationToggles, injectLogoutAction } from "./utils/dom.js";
import { initTechnicianPwa, initTechnicianChrome } from "./utils/pwa.js";
import { initIconFallback } from "./utils/icon-fallback.js";
import { initBrandingAssets } from "./utils/branding.js";

async function main() {
  // Replace Material Symbols font icons with inline SVGs
  // (avoids timeout waiting for Google Fonts CDN which is blocked in China)
  initIconFallback();
  initBrandingAssets();

  bindRoleTabs();
  bindApplicationToggles();
  injectLogoutAction();
  initTechnicianPwa();
  initTechnicianChrome();

  const page = document.body.dataset.page;
  if (!page) return;

  try {
    // Dynamic import based on page attribute
    const mod = await import(`./pages/${page}.js`);
    if (mod && mod.default) {
      await mod.default();
    }
  } catch (error) {
    if (!["Missing merchant session", "Missing technician session"].includes(error.message)) {
      console.error("[app-error]", error);
    }
  }
}

main();
