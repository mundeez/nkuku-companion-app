#!/usr/bin/env python3
"""Generate favicon and app icon sizes from the source SVG."""
import os
import subprocess

SRC = "/home/mundeez/DevWorkz/nkuku-companion-app/assets/favicon-source.svg"
WEB_OUT = "/home/mundeez/DevWorkz/nkuku-companion-app/apps/web/public"
MOBILE_OUT = "/home/mundeez/DevWorkz/nkuku-companion-app/apps/mobile/assets"

os.makedirs(f"{WEB_OUT}/favicon", exist_ok=True)
os.makedirs(MOBILE_OUT, exist_ok=True)

def svg_to_png(svg, png, size):
    subprocess.run([
        "python3", "-c",
        f"import cairosvg; cairosvg.svg2png(url='{svg}', write_to='{png}', output_width={size}, output_height={size})"
    ], check=True)

sizes = {
    f"{WEB_OUT}/favicon-16x16.png": 16,
    f"{WEB_OUT}/favicon-32x32.png": 32,
    f"{WEB_OUT}/favicon-48x48.png": 48,
    f"{WEB_OUT}/apple-touch-icon.png": 180,
    f"{WEB_OUT}/android-chrome-192x192.png": 192,
    f"{WEB_OUT}/android-chrome-512x512.png": 512,
    f"{WEB_OUT}/mstile-150x150.png": 150,
    f"{MOBILE_OUT}/app_icon_1024.png": 1024,
}

print("Generating PNG sizes...")
for path, size in sizes.items():
    svg_to_png(SRC, path, size)
    print(f"  {os.path.basename(path)} ({size}x{size})")

# Generate multi-resolution favicon.ico using ImageMagick
print("\nGenerating favicon.ico...")
subprocess.run([
    "convert",
    f"{WEB_OUT}/favicon-16x16.png",
    f"{WEB_OUT}/favicon-32x32.png",
    f"{WEB_OUT}/favicon-48x48.png",
    f"{WEB_OUT}/favicon.ico"
], check=True)
print("  favicon.ico (16+32+48)")

# Generate site.webmanifest
print("\nGenerating site.webmanifest...")
manifest = '''{
  "name": "Nkuku Companion",
  "short_name": "Nkuku",
  "icons": [
    { "src": "/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#1B5E20",
  "background_color": "#FFFFFF",
  "display": "standalone"
}'''
with open(f"{WEB_OUT}/site.webmanifest", "w") as f:
    f.write(manifest)
print("  site.webmanifest")

# OG image (1200x630) - wide version
print("\nGenerating OG image (1200x630)...")
og_svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <rect x="0" y="0" width="1200" height="630" fill="#1B5E20"/>
  <circle cx="600" cy="315" r="200" fill="none" stroke="#FFFFFF" stroke-width="6" opacity="0.3"/>
  
  <!-- Phone -->
  <rect x="460" y="135" width="160" height="260" rx="20" fill="none" stroke="#FFFFFF" stroke-width="8"/>
  <rect x="500" y="145" width="80" height="6" rx="3" fill="#FFFFFF" opacity="0.5"/>
  <rect x="520" y="380" width="40" height="4" rx="2" fill="#FFFFFF" opacity="0.4"/>
  
  <!-- Chicken body -->
  <ellipse cx="540" cy="280" rx="45" ry="38" fill="#FFFFFF"/>
  <circle cx="500" cy="245" r="18" fill="#FFFFFF"/>
  <path d="M 485 240 L 470 245 L 485 250 Z" fill="#FFFFFF"/>
  <circle cx="505" cy="242" r="3" fill="#1B5E20"/>
  <path d="M 485 228 Q 490 215 495 222 Q 500 210 505 220 Q 510 212 515 225" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
  <path d="M 575 260 Q 600 230 595 195 Q 585 235 575 260" fill="#FFFFFF" opacity="0.8"/>
  <path d="M 580 275 Q 610 250 605 215 Q 595 255 580 275" fill="#FFFFFF" opacity="0.7"/>
  
  <text x="600" y="480" font-family="sans-serif" font-size="64" font-weight="bold" fill="#FFFFFF" text-anchor="middle">Nkuku Companion</text>
  <text x="600" y="520" font-family="sans-serif" font-size="28" fill="#C6A017" text-anchor="middle">Poultry Management Made Simple</text>
</svg>'''
og_path = f"{WEB_OUT}/og-image.png"
subprocess.run([
    "python3", "-c",
    f"import cairosvg; cairosvg.svg2png(bytestring='''{og_svg}''', write_to='{og_path}', output_width=1200, output_height=630)"
], check=True)
print("  og-image.png")

print("\nAll assets generated successfully.")
