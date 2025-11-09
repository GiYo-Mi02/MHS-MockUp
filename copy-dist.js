const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'packages/web/dist');
const dest = path.join(__dirname, 'public');

// Remove destination if it exists
if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}

// Copy the dist folder to public
fs.cpSync(src, dest, { recursive: true });
console.log('✓ Copied packages/web/dist to public/');
