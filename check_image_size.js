const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/assets/apparences/Ralof.png');

try {
    const buffer = fs.readFileSync(filePath);
    // Simple PNG header parsing to get width/height
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    // IHDR chunk starts at byte 12 (length) + 4 (type) = 16
    // Width is at byte 16, Height at byte 20 (4 bytes each, big endian)
    
    if (buffer.readUInt32BE(0) === 0x89504E47) { // Check PNG signature
        // Skip signature (8)
        // IHDR chunk: Length (4), Type (4), Width (4), Height (4)
        // IHDR is usually the first chunk.
        // Offset 8: Length of IHDR data (usually 13)
        // Offset 12: Type "IHDR"
        // Offset 16: Width
        // Offset 20: Height
        
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        
        console.log(`Dimensions: ${width}x${height}`);
    } else {
        console.log('Not a valid PNG file');
    }
} catch (err) {
    console.error('Error reading file:', err);
}
