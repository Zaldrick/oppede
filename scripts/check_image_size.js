const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size');

const imagePath = path.join(__dirname, '../public/assets/apparences/Mehdi.png');

try {
    const dimensions = sizeOf(imagePath);
    console.log(`Image dimensions: ${dimensions.width}x${dimensions.height}`);
    console.log(`Frames horizontal: ${dimensions.width / 48}`);
    console.log(`Frames vertical: ${dimensions.height / 48}`);
} catch (err) {
    console.error(err);
}
