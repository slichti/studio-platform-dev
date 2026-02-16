#!/bin/bash

OUTPUT_FILE="spark_studio_820_HQ.png"

# Check for ImageMagick
if command -v magick &> /dev/null; then
    IM_CMD="magick"
elif command -v convert &> /dev/null; then
    IM_CMD="convert"
else
    echo "Error: ImageMagick is not installed."
    exit 1
fi

echo "Generating high-quality $OUTPUT_FILE..."

# 1. -size 800x800: We create a canvas 4x larger than needed.
# 2. -font Arial-Bold: explicit font avoids the ugly default fixed-width font.
# 3. -pointsize 100: scaled up font size (26 * 4 approx).
# 4. -resize 200x200: Softly scales it down, smoothing the text edges.
# 5. -unsharp 0x1: Adds a tiny bit of sharpening after resize for clarity.

$IM_CMD -size 800x800 gradient:'#2C3E50-#4CA1AF' \
    -gravity center \
    -fill white \
    -font Arial-Bold \
    -pointsize 110 \
    -annotate +0+0 "Spark Studio\n820" \
    -resize 200x200 \
    -unsharp 0x0.75+0.75+0.008 \
    "$OUTPUT_FILE"

echo "Done."
