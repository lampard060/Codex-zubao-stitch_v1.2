#!/usr/bin/env bash
# ============================================================
# ZuBao 字体下载脚本
# 从 Google Fonts 下载 Inter、Manrope、Material Symbols 字体
# 保存到 app/fonts/ 目录，用于离线自托管
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FONTS_DIR="$PROJECT_DIR/app/fonts"
mkdir -p "$FONTS_DIR"

info()  { echo "[INFO] $*"; }
error() { echo "[ERROR] $*" >&2; }
success() { echo "[OK] $*"; }

# Google Fonts CSS URLs (variable fonts, woff2)
GF_CSS_URLS=(
  "Inter:https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap"
  "Inter-Italic:https://fonts.googleapis.com/css2?family=Inter:ital,wght@1,400..800&display=swap"
  "Manrope:https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap"
  "MaterialSymbolsOutlined:https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@300..500&display=block"
)

download_font() {
  local name="$1"
  local css_url="$2"

  info "Fetching $name CSS from Google Fonts ..."
  local css
  css=$(curl -sL --max-time 15 "$css_url" 2>/dev/null || true)

  if [ -z "$css" ]; then
    warning "  ⚠ Could not fetch CSS for $name (connectivity issue). Skipping."
    return 0
  fi

  # Extract woff2 URLs from CSS
  local urls
  urls=$(echo "$css" | grep -oE 'https://fonts\.gstatic\.com[^)"]+' || true)

  if [ -z "$urls" ]; then
    error "No woff2 URLs found in $name CSS"
    return 1
  fi

  local count=0
  for url in $urls; do
    # Clean URL (remove query params if any)
    local clean_url="${url%%\?*}"
    local filename
    filename=$(basename "$clean_url")

    # Ensure .woff2 extension
    case "$filename" in
      *.woff2) ;;
      *) filename="${name}-${filename}.woff2" ;;
    esac

    # If filename is too generic, use the font name as prefix
    if [ "$filename" = "woff2" ] || [ "$(echo "$filename" | wc -c)" -lt 10 ]; then
      filename="${name}-$(echo "$url" | md5sum | head -c 8).woff2"
    fi

    local output="$FONTS_DIR/$filename"

    if [ -f "$output" ] && [ -s "$output" ]; then
      info "  $filename already exists, skipping"
    else
      info "  Downloading $filename ..."
      curl -sL --max-time 30 "$url" -o "$output" 2>/dev/null || {
        warning "  ⚠ Failed to download from $url"
        continue
      }
      if [ -s "$output" ]; then
        success "  $filename ($(du -h "$output" | cut -f1))"
        count=$((count + 1))
      else
        rm -f "$output"
        warning "  ⚠ Downloaded file is empty"
      fi
    fi
  done

  # Update fonts.css with the correct file paths
  local first_file
  first_file=$(find "$FONTS_DIR" -name "${name}*.woff2" -exec basename {} \; 2>/dev/null | head -1)
  if [ -n "$first_file" ]; then
    info "  Font file for $name: $first_file"
  fi

  return 0
}

echo "=========================================="
echo "  ZuBao Font Downloader"
echo "=========================================="
echo ""

for entry in "${GF_CSS_URLS[@]}"; do
  name="${entry%%:*}"
  url="${entry#*:}"
  download_font "$name" "$url"
done

echo ""
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo ""

FONT_FILES=$(find "$FONTS_DIR" -name "*.woff2" -type f | sort)
if [ -z "$FONT_FILES" ]; then
  echo "  ⚠ No font files were downloaded."
  echo ""
  echo "  Possible reasons:"
  echo "    - Network cannot reach Google Fonts CDN (common in China)"
  echo "    - curl is not installed"
  echo ""
  echo "  Alternative options:"
  echo "    1. Run this script on a machine with VPN access, then copy the"
  echo "       app/fonts/ directory back to this project."
  echo "    2. Manually download from:"
  echo "       https://fonts.google.com/"
  echo "    3. Use npm (requires network access to npm registry):"
  echo "       npm install material-symbols"
  echo "       cp node_modules/material-symbols/*.woff2 $FONTS_DIR/"
  echo ""
else
  echo "  Fonts downloaded to: $FONTS_DIR"
  echo "$FONT_FILES" | while read -r f; do
    echo "    $(basename "$f") ($(du -h "$f" | cut -f1))"
  done
  echo ""
  echo "  Fonts are ready! Reload the app to see them."
fi
