// native
const path = require('path');

// packages
const debug = require('debug');
const sharp = require('sharp');

const logger = debug('baker:blocks:image');

function createImageBlock(input, output, pathPrefix) {
  async function image(src, alt, { widths = [300, 600] } = {}) {
    // resolve the path relative to the source directory
    const pathToFile = path.resolve(input, src);
    logger('new file:', pathToFile);

    const originalImage = sharp(pathToFile);
    const { width, height } = await originalImage.metadata();

    // create the new file path with the output
    const { dir, ext, name } = path.parse(src);

    let srcsets = [];

    for (const width of widths.sort((a, b) => a - b)) {
      const image = originalImage.clone();
      image.resize({ width });

      // create the output path
      const filepath = path.format({ dir, ext, name: `${name}-${width}` });
      const fileOutput = path.resolve(output, filepath);

      await image.toFile(fileOutput);

      // build the path for the HTML
      const outputPath = path.resolve(pathPrefix, filepath);

      srcsets.push({ src: outputPath, w: width });
    }

    return `<img src="${srcsets[0].src}" srcset="${srcsets
      .map(({ src, w }) => `${src} ${w}w`)
      .join(
        ', '
      )}" width="${width}" height="${height}" alt="${alt}" decoding="async">`;
  }

  image.async = true;

  return image;
}

function getValidWidths() {}

module.exports = { createImageBlock };
