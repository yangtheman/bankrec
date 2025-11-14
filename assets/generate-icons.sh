#!/bin/bash

# Script to generate app icons from SVG
# Requires: inkscape or imagemagick (convert/magick)

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ASSETS_DIR="$SCRIPT_DIR"
SVG_FILE="$ASSETS_DIR/icon.svg"

echo "Generating app icons from SVG..."

# Check if SVG exists
if [ ! -f "$SVG_FILE" ]; then
    echo "Error: icon.svg not found in $ASSETS_DIR"
    exit 1
fi

# Generate PNG files at different sizes
echo "Generating PNG files..."
magick -background none -resize 16x16 "$SVG_FILE" "$ASSETS_DIR/icon_16x16.png"
magick -background none -resize 32x32 "$SVG_FILE" "$ASSETS_DIR/icon_32x32.png"
magick -background none -resize 48x48 "$SVG_FILE" "$ASSETS_DIR/icon_48x48.png"
magick -background none -resize 64x64 "$SVG_FILE" "$ASSETS_DIR/icon_64x64.png"
magick -background none -resize 128x128 "$SVG_FILE" "$ASSETS_DIR/icon_128x128.png"
magick -background none -resize 256x256 "$SVG_FILE" "$ASSETS_DIR/icon_256x256.png"
magick -background none -resize 512x512 "$SVG_FILE" "$ASSETS_DIR/icon_512x512.png"
magick -background none -resize 1024x1024 "$SVG_FILE" "$ASSETS_DIR/icon_1024x1024.png"

# Generate main icon.png (512x512)
magick -background none -resize 512x512 "$SVG_FILE" "$ASSETS_DIR/icon.png"

# Generate macOS ICNS file
echo "Generating macOS icon (.icns)..."
mkdir -p "$ASSETS_DIR/icon.iconset"
convert -background none -resize 16x16 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_16x16.png"
convert -background none -resize 32x32 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_16x16@2x.png"
convert -background none -resize 32x32 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_32x32.png"
convert -background none -resize 64x64 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_32x32@2x.png"
convert -background none -resize 128x128 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_128x128.png"
convert -background none -resize 256x256 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_128x128@2x.png"
convert -background none -resize 256x256 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_256x256.png"
convert -background none -resize 512x512 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_256x256@2x.png"
convert -background none -resize 512x512 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_512x512.png"
convert -background none -resize 1024x1024 "$SVG_FILE" "$ASSETS_DIR/icon.iconset/icon_512x512@2x.png"

iconutil -c icns "$ASSETS_DIR/icon.iconset" -o "$ASSETS_DIR/icon.icns"
rm -rf "$ASSETS_DIR/icon.iconset"

# Generate Windows ICO file
echo "Generating Windows icon (.ico)..."
convert "$ASSETS_DIR/icon_16x16.png" \
        "$ASSETS_DIR/icon_32x32.png" \
        "$ASSETS_DIR/icon_48x48.png" \
        "$ASSETS_DIR/icon_64x64.png" \
        "$ASSETS_DIR/icon_128x128.png" \
        "$ASSETS_DIR/icon_256x256.png" \
        "$ASSETS_DIR/icon.ico"

echo "✅ Icon generation complete!"
echo "Generated files:"
echo "  - icon.png (main 512x512)"
echo "  - icon.icns (macOS)"
echo "  - icon.ico (Windows)"
echo "  - Various PNG sizes for other uses"
