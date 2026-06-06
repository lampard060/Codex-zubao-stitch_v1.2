export function initBrandingAssets() {
  if (typeof document === "undefined") return;

  let favicon = document.querySelector('link[data-zubao-favicon="true"]');
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = "./zubao-tech-icon.png";
    favicon.dataset.zubaoFavicon = "true";
    document.head.appendChild(favicon);
  }
}
