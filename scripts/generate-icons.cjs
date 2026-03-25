// scripts/generate-icons.js
const fs = require('fs');
const path = require('path');

// Minimal valid PNG (1x1 pixel, dark background)
// This is a base64-encoded minimal PNG
const minimalPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==',
  'base64'
);

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), minimalPng);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), minimalPng);
console.log('Placeholder icons created');
