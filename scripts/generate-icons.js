import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [16, 48, 128];

// Create a simple but nice logo: a checkmark inside a magnifying glass with gradient
async function generateIcon(size) {
  // Scale factors
  const s = size / 128;

  // SVG for the icon - magnifying glass with checkmark, representing fact-checking
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#ffffff;stop-opacity:0.9" />
          <stop offset="100%" style="stop-color:#f3e8ff;stop-opacity:0.9" />
        </linearGradient>
      </defs>

      <!-- Background rounded square -->
      <rect x="4" y="4" width="120" height="120" rx="24" ry="24" fill="url(#bgGrad)"/>

      <!-- Magnifying glass circle -->
      <circle cx="52" cy="52" r="30" fill="url(#glassGrad)" stroke="#ffffff" stroke-width="4"/>

      <!-- Magnifying glass handle -->
      <line x1="74" y1="74" x2="100" y2="100" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>

      <!-- Checkmark inside the glass -->
      <polyline
        points="36,52 48,64 68,40"
        fill="none"
        stroke="#7c3aed"
        stroke-width="7"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <!-- Small sparkle/AI indicator -->
      <circle cx="98" cy="24" r="8" fill="#fbbf24"/>
      <circle cx="98" cy="24" r="4" fill="#ffffff"/>
    </svg>
  `;

  const outputPath = path.join(process.cwd(), 'public', 'icons', `icon${size}.png`);

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`Generated ${outputPath}`);
}

// Ensure icons directory exists
const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate all sizes
Promise.all(sizes.map(generateIcon))
  .then(() => console.log('All icons generated!'))
  .catch(console.error);
