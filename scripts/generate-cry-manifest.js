const fs = require('fs');
const path = require('path');

const criesDir = path.join(__dirname, '..', 'public', 'assets', 'sounds', 'cries');
const outFile = path.join(criesDir, 'index.json');

function main() {
  if (!fs.existsSync(criesDir)) {
    console.error('Error: cries directory does not exist:', criesDir);
    process.exit(1);
  }
  const files = fs.readdirSync(criesDir).filter(f => f && !f.startsWith('.') && f !== 'index.json');
  files.sort();
  fs.writeFileSync(outFile, JSON.stringify(files, null, 2), 'utf8');
  console.log('Cry manifest written:', outFile, files.length, 'entries');
}

main();
