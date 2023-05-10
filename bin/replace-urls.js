#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const cheerio = require('cheerio');
const replace = require('replace-in-file');
const argv = require('yargs').argv;
const cliProgress = require('cli-progress');

const configPath = path.resolve(argv.config || './config.js');
const config = require(path.resolve(process.cwd(), configPath));

const downloadFile = promisify((url, destPath, progressCallback, cb) => {
    const file = fs.createWriteStream(destPath);
    const request = https.request(url, (response) => {
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            const percentage = (downloadedSize / totalSize) * 100;
            progressCallback(percentage);
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
    const htmlPath = path.resolve(process.cwd(), config.htmlPath);
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Parse the HTML using Cheerio
    const $ = cheerio.load(htmlContent);

    // Find all images and videos with URLs starting with 'https://res.cloudinary.com'
    const mediaElements = $(config.mediaSrcSelector);

    // Find all videos with poster URLs starting with 'https://res.cloudinary.com'
    const videoElements = $(config.videoPosterSelector);

    // Create the 'medias' directory if it does not exist
    const mediaDir = path.resolve(process.cwd(), config.mediaDir);
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir);
    }

    // Download all the media files
    const downloadPromises = [];
    for (let i = 0; i < mediaElements.length; i++) {
        const mediaElem = $(mediaElements[i]);
        const mediaSrc = mediaElem.attr('src');
        const mediaExt = path.extname(mediaSrc);
        const mediaFilename = `media_${i}${mediaExt}`;
        const mediaDestPath = path.resolve(mediaDir, mediaFilename);

        downloadPromises.push(downloadFile(mediaSrc, mediaDestPath));
    }
    for (let i = 0; i < videoElements.length; i++) {
        const videoElem = $(videoElements[i]);
        const videoPoster = videoElem.attr('poster');
        const posterExt = path.extname(videoPoster);
        const posterFilename = `poster_${i}${posterExt}`;
        const posterDestPath = path.resolve(mediaDir, posterFilename);

        downloadPromises.push(downloadFile(videoPoster, posterDestPath));
    }
    await Promise.all(downloadPromises);

    // Replace the URLs in the HTML with the downloaded file paths
    for (let i = 0; i < mediaElements.length; i++) {
        const mediaElem = $(mediaElements[i]);
        const mediaSrc = mediaElem.attr('src');
        const mediaExt = path.extname(mediaSrc);
        const mediaFilename = `media_${i}${mediaExt}`;

        replace({
            files: htmlPath,
            from: mediaSrc,
            to: `./medias/${mediaFilename}`
        });
    }
    for (let i = 0; i < videoElements.length; i++) {
        const videoElem = $(videoElements[i]);
        const videoPoster = videoElem.attr('poster');
        const posterExt = path.extname(videoPoster);
        const posterFilename = `poster_${i}${posterExt}`;

        replace({
            files: htmlPath,
            from: videoPoster,
            to: `./medias/${posterFilename}`
        });
    }
}
replaceUrls().catch((error) => {
    console.error(error);
    process.exit(1);
});

module.exports = replaceUrls