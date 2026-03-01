# Icon Generation

The VS Code Marketplace requires a 128x128 PNG icon.

## Quick Option

Convert `icon.svg` to PNG using any of these:

1. **Online**: https://svgtopng.com/
2. **Figma**: Import SVG, export as PNG 128x128
3. **ImageMagick**: `convert -background none -size 128x128 icon.svg icon.png`

Save as `icon.png` in this folder.

## Current Files

- `icon.svg` - Main extension icon (convert to PNG)
- `brain-icon.svg` - Sidebar icon (used as-is)
