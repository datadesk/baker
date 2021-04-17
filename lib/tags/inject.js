// native
import { promises as fs } from 'fs';
import { join } from 'path';

export function createInjectTag(outputDir, sources) {
  async function inject(file) {
    let path;

    // we try to find it in our sources
    for (const source of sources) {
      if (file in source.manifest) {
        path = source.manifest[file];
        break;
      }
    }

    if (path) {
      const absolutePath = join(outputDir, path);

      return fs.readFile(absolutePath, 'utf8');
    } else {
      throw new Error(
        `The inject block tried to load a file that does not exist: ${file}`
      );
    }
  }

  return inject;
}
