const fs = require('fs');
const path = require('path');

function extractIco(icoPath, outPath) {
  const buf = fs.readFileSync(icoPath);
  // Check ICO signature: 00 00 01 00
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) {
    console.error('Not a valid ICO file');
    return false;
  }

  const numImages = buf.readUInt16LE(4);
  console.log(`ICO contains ${numImages} images`);

  let largestDir = null;
  let maxW = 0;

  for (let i = 0; i < numImages; i++) {
    const offset = 6 + i * 16;
    let w = buf[offset];
    let h = buf[offset + 1];
    if (w === 0) w = 256;
    if (h === 0) h = 256;
    const size = buf.readUInt32LE(offset + 8);
    const dataOffset = buf.readUInt32LE(offset + 12);
    console.log(`Image ${i}: ${w}x${h}, size: ${size} bytes, offset: ${dataOffset}`);
    if (w >= maxW) {
      maxW = w;
      largestDir = { w, h, size, dataOffset };
    }
  }

  if (largestDir) {
    const imgData = buf.subarray(largestDir.dataOffset, largestDir.dataOffset + largestDir.size);
    // Write out
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, imgData);
    console.log(`Extracted largest image (${largestDir.w}x${largestDir.h}) to ${outPath}`);
    return true;
  }
  return false;
}

const src = path.join(__dirname, '..', 'public', 'icon.ico');
const dest = path.join(__dirname, '..', 'assets', 'icon-only.png');
extractIco(src, dest);
