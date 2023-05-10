#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const cheerio = require('cheerio');
const replace = require('replace-in-file');
const yargs = require('yargs');
const cliProgress = require('cli-progress');
const chalk = require('chalk');

const configPath = path.resolve(yargs.argv.config || './config.js');
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
        fs.unlink(destPath).catch(() => {});
        if (cb) cb(err.message);
    });

    request.end();
});

function rainbowProgressBar(percentage) {
    const rainbowColors = ['red', 'yellow', 'green', 'blue', 'magenta'];
    const numOfBars = 20;
    const numOfRainbowSections = rainbowColors.length - 1;
    const numOfFullSections = Math.floor(percentage / (100 / numOfRainbowSections));
    const currentRainbowSectionPercentage = (percentage % (100 / numOfRainbowSections)) / (100 / numOfRainbowSections);
    const currentRainbowColor = chalk[rainbowColors[numOfFullSections]];
    const progressBar = '#'.repeat(Math.floor(numOfBars * currentRainbowSectionPercentage)).padEnd(numOfBars, ' ');
    return `[${currentRainbowColor ? currentRainbowColor.bold(progressBar) : progressBar}]`;
}

async function replaceUrls() {
    const htmlPath = path.resolve(process.cwd(), config.htmlPath);
    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    const $ = cheerio.load(htmlContent);

    const mediaElements = $(config.mediaSrcSelector);

    const mediaDir = path.resolve(process.cwd(), config.mediaDir);
    await fs.mkdir(mediaDir, { recursive: true });

    const progressBar = new cliProgress.SingleBar({
        format: `${rainbowProgressBar('{percentage}')}`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    });

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

    const replacePromises = [];

    for (let i = 0; i < mediaElements.length; i++) {
        const mediaElem = $(mediaElements[i]);
        const mediaSrc = mediaElem.attr('src');
        const mediaFilename = downloadedMedia[i];
        const mediaPath = `./medias/${mediaFilename}`;

        replacePromises.push(replace({ files: htmlPath, from: mediaSrc, to: mediaPath }));
    }

    await Promise.all(replacePromises);
}

replaceUrls().catch((error) => {
    console.error(error);
    process.exit(1);
});

module.exports = replaceUrls