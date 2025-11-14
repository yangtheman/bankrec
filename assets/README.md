# BankRec App Icons

This folder contains the app icons for BankRec in various formats.

## Files

- **icon.svg** - Source SVG file (editable)
- **icon.png** - Main PNG icon (512x512)
- **icon.icns** - macOS app icon
- **icon.ico** - Windows app icon
- **icon_*x*.png** - PNG files in various sizes (16x16 to 1024x1024)

## Logo Design

The BankRec logo features:
- **Bank Building**: Represents financial institutions with classical pillars
- **Checkmark Badge**: Symbolizes reconciliation and verification
- **Color Scheme**: 
  - Primary: Blue gradient (#1E40AF to #3B82F6)
  - Accent: Green gradient for checkmark (#10B981 to #059669)
  - Elements: White for clarity and professionalism

## Regenerating Icons

If you modify `icon.svg`, regenerate all icon formats by running:

```bash
cd assets
./generate-icons.sh
```

### Requirements
- ImageMagick (magick/convert command)
- macOS iconutil (for .icns generation, macOS only)

### Install ImageMagick
```bash
# macOS
brew install imagemagick

# Linux (Ubuntu/Debian)
sudo apt-get install imagemagick

# Linux (Fedora/RHEL)
sudo dnf install ImageMagick
```

## Usage in App

- **macOS**: Uses `icon.icns` (configured in package.json build.mac.icon)
- **Windows**: Uses `icon.ico` (configured in package.json build.win.icon)
- **Linux**: Uses `icon.png` (configured in package.json build.linux.icon)
- **Window Icon**: Set in main.ts BrowserWindow options
- **HTML Favicon**: Linked in index.html
