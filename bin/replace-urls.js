#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const cheerio = require('cheerio');
const replace = require('replace-in-file');
const yargs = require('yargs');
const cliProgress = require('cli-progress');

const argv = yargs
    .option('config', {
        alias: 'c',
        description: 'Path to configuration file',
        type: 'string',
        default: './config.js',
    })
    .help()
    .alias('help', 'h')
    .argv;

const configPath = path.resolve(argv.config);
const config = require(configPath);

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
        fs.unlink(destPath, () => {});
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

    // Find all images with URLs starting with 'https://res.cloudinary.com'
    const mediaElements = $(config.mediaSrcSelector);
    console.log(`Found ${mediaElements.length} media elements.`);

    // Create the 'medias' directory if it does not exist
    const mediaDir = path.resolve(process.cwd(), config.mediaDir);
    if (!fs.existsSync(mediaDir)) {
        fs.mkdirSync(mediaDir);
    }

    // Download all media elements
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    const downloadPromises = [];
    const downloadedMedia = [];

    for (let i = 0; i < mediaElements.length; i++) {
        const mediaElem = $(mediaElements[i]);
        const mediaSrc = mediaElem.attr('src');
        const mediaExt = path.extname(mediaSrc);
        const mediaFilename = `media_${i}${mediaExt}`;
        const mediaDestPath = path.resolve(mediaDir, mediaFilename);

        downloadedMedia.push(mediaFilename);
        downloadPromises.push(downloadFile(mediaSrc, mediaDestPath, (percentage) => {
            progressBar.update(percentage);
        }));
    }

    progressBar.start(100, 0);
    await Promise.all(downloadPromises);
    progressBar.stop();

    // Replace all media URLs in the HTML with the downloaded file paths
    const replacePromises = [];

    for (let i = 0; i < mediaElements.length; i++) {
        const mediaElem = $(mediaElements[i]);
        const mediaSrc = mediaElem.attr('src');
        const mediaFilename = downloadedMedia[i];
        const mediaPath = `./medias/${mediaFilename}`;
        console.log(`Replacing ${mediaSrc} with ${mediaPath}.`);

        replacePromises.push(replace({files: htmlPath, from: new RegExp(mediaSrc, 'g'), to: mediaPath}));
    }

    await Promise.all(replacePromises);
}

replaceUrls().catch((error) => {
    console.error(error);
    process.exit(1);
});

module.exports = replaceUrls;