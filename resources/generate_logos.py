#!/usr/bin/env python3
"""
Generate PNG versions of the PRODE logo from SVG.
Creates:
- logo-transparent.png - Logo with transparent background
- logo-white-bg.png - Logo with white background
- logo-round.png - Round version of the logo
"""

import subprocess
import sys

# Check and install required packages
def install_package(package):
    subprocess.check_call([sys.executable, "-m", "pip", "install", package, "-q"])

try:
    from PIL import Image, ImageDraw
except ImportError:
    install_package("pillow")
    from PIL import Image, ImageDraw

try:
    import cairosvg
except ImportError:
    install_package("cairosvg")
    import cairosvg

from io import BytesIO
import os

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# SVG logo definition (extracted from toolbar component)
# The logo mark - a square with "IO" style shapes inside
LOGO_SVG = '''<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="400" height="400">
  <rect x="2" y="2" width="36" height="36" stroke="#e8ff47" stroke-width="2"/>
  <rect x="8" y="8" width="10" height="24" fill="#e8ff47"/>
  <circle cx="27" cy="20" r="6" stroke="#e8ff47" stroke-width="2"/>
</svg>'''

# Full logo with text
LOGO_FULL_SVG = '''<svg viewBox="0 0 180 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="900" height="200">
  <!-- Logo Mark -->
  <rect x="2" y="2" width="36" height="36" stroke="#e8ff47" stroke-width="2"/>
  <rect x="8" y="8" width="10" height="24" fill="#e8ff47"/>
  <circle cx="27" cy="20" r="6" stroke="#e8ff47" stroke-width="2"/>
  
  <!-- Logo Text: PRODE -->
  <text x="52" y="28" font-family="sans-serif" font-size="24" font-weight="800" letter-spacing="0.15em" fill="#fafafa">PROD</text>
  <text x="137" y="28" font-family="sans-serif" font-size="24" font-weight="800" letter-spacing="0.15em" fill="#e8ff47">E</text>
</svg>'''

# Round logo (logo mark inside a circle)
LOGO_ROUND_SVG = '''<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="400" height="400">
  <!-- Circle background -->
  <circle cx="24" cy="24" r="23" stroke="#e8ff47" stroke-width="2"/>
  
  <!-- Logo Mark scaled to fit inside circle -->
  <g transform="translate(8, 8) scale(0.8)">
    <rect x="2" y="2" width="36" height="36" stroke="#e8ff47" stroke-width="2.5"/>
    <rect x="8" y="8" width="10" height="24" fill="#e8ff47"/>
    <circle cx="27" cy="20" r="6" stroke="#e8ff47" stroke-width="2.5"/>
  </g>
</svg>'''


def svg_to_png(svg_string, output_size=None):
    """Convert SVG string to PNG PIL Image."""
    png_data = cairosvg.svg2png(bytestring=svg_string.encode('utf-8'))
    img = Image.open(BytesIO(png_data))
    if output_size:
        img = img.resize(output_size, Image.Resampling.LANCZOS)
    return img.convert('RGBA')


def add_white_background(img):
    """Add white background to an RGBA image."""
    background = Image.new('RGBA', img.size, (255, 255, 255, 255))
    background.paste(img, (0, 0), img)
    return background.convert('RGB')


def create_round_version(img):
    """Create a round version with circular mask."""
    size = img.size
    # Create circular mask
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size[0]-1, size[1]-1), fill=255)
    
    # Apply mask
    result = Image.new('RGBA', size, (0, 0, 0, 0))
    result.paste(img, (0, 0), mask)
    return result


def main():
    print("Generating PRODE logo PNG files...")
    
    # Generate logo mark with transparent background
    print("  -> logo-transparent.png (logo mark with transparent background)")
    logo_transparent = svg_to_png(LOGO_SVG, (400, 400))
    logo_transparent.save(os.path.join(SCRIPT_DIR, 'logo-transparent.png'), 'PNG')
    
    # Generate logo mark with white background
    print("  -> logo-white-bg.png (logo mark with white background)")
    logo_white = add_white_background(logo_transparent)
    logo_white.save(os.path.join(SCRIPT_DIR, 'logo-white-bg.png'), 'PNG')
    
    # Generate round logo with transparent background
    print("  -> logo-round.png (round version with transparent background)")
    logo_round = svg_to_png(LOGO_ROUND_SVG, (400, 400))
    logo_round.save(os.path.join(SCRIPT_DIR, 'logo-round.png'), 'PNG')
    
    # Generate round logo with white background
    print("  -> logo-round-white-bg.png (round version with white background)")
    logo_round_white = add_white_background(logo_round)
    logo_round_white.save(os.path.join(SCRIPT_DIR, 'logo-round-white-bg.png'), 'PNG')
    
    # Generate full logo with text (transparent)
    print("  -> logo-full-transparent.png (full logo with text, transparent)")
    logo_full = svg_to_png(LOGO_FULL_SVG, (900, 200))
    logo_full.save(os.path.join(SCRIPT_DIR, 'logo-full-transparent.png'), 'PNG')
    
    # Generate full logo with text (white background)
    print("  -> logo-full-white-bg.png (full logo with text, white background)")
    logo_full_white = add_white_background(logo_full)
    logo_full_white.save(os.path.join(SCRIPT_DIR, 'logo-full-white-bg.png'), 'PNG')
    
    print("\n✓ All logo files generated successfully in the resources directory!")


if __name__ == '__main__':
    main()
