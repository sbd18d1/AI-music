const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, '../public/audio');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'watermark.mp3');

const TEXT = "This is a free preview version.";

async function generateWatermark() {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`Created directory: ${OUTPUT_DIR}`);
    }

    const encodedText = encodeURIComponent(TEXT);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en&client=tw-ob`;

    const writeStream = fs.createWriteStream(OUTPUT_FILE);

    return new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP request failed with status ${response.statusCode}`));
          return;
        }

        response.pipe(writeStream);

        writeStream.on('finish', () => {
          writeStream.close();
          console.log(`Watermark audio generated successfully: ${OUTPUT_FILE}`);
          resolve();
        });

        writeStream.on('error', (error) => {
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  } catch (error) {
    console.error('Failed to generate watermark:', error);
    process.exit(1);
  }
}

generateWatermark();
