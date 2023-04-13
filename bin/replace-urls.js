#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const cheerio = require('cheerio');
const replace = require('replace-in-file');
const argv = require('yargs').argv;

const configPath = path.resolve(argv.config || './config.js');
const config = require(path.resolve(process.cwd(), configPath));

const downloadFile = promisify((url, destPath, cb) => {
    const file = fs.createWriteStream(destPath);
    const request = https.request(url, (response) => {
        const totalSize = response.headers['content-length'];
        let downloadedSize = 0;

        response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            const percentage = (downloadedSize / totalSize) * 100;
            const progress = `[${'#'.repeat(Math.floor(percentage / 10)).padEnd(10)}] ${percentage.toFixed(1)}%`;
            process.stdout.write(`\r${progress}`);
        });

        response.pipe(file);
        file.on('finish', () => {
            file.close(cb);
        });
    });

    request.on('error', (err) => {
        fs.unlink(destPath);
        if (cb) cb(err.message);
    });

    request.end();
});

async function replaceUrls() {
    // Read the HTML file
    const htmlPath = require(path.resolve(process.cwd(), config.htmlPath));
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Parse the HTML using Cheerio
    const $ = cheerio.load(htmlContent);

    // Find all images and videos with URLs starting with 'https://res.cloudinary.com'
    const mediaElements = $(config.mediaSrcSelector);

    // Create the 'medias' directory if it does not exist
    const mediaDir = require(path.resolve(process.cwd(), config.mediaDir));
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir);
    }

    // Download and replace the URLs of each media element
    for (let i = 0; i < mediaElements.length; i++) {
        const mediaElem = $(mediaElements[i]);
        const mediaSrc = mediaElem.attr('src');
        const mediaExt = path.extname(mediaSrc);
        const mediaFilename = `media_${i}${mediaExt}`;
        const mediaDestPath = path.resolve(mediaDir, mediaFilename);

        console.log('Downloading images...')
        // Download the file
        await downloadFile(mediaSrc, mediaDestPath);

        console.log('Replacing URLs...')
        // Replace the URL in the HTML with the downloaded file path
        replace({files: htmlPath, from: mediaSrc, to: `./medias/${mediaFilename}`});
    }
}

replaceUrls().catch((error) => {
    console.error(error)
    process.exit(1)
});

module.exports = replaceUrls;