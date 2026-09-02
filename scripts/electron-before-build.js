/**
 * Vite already bundles renderer deps into dist/. Returning false tells
 * electron-builder not to copy production node_modules into the asar
 * (lucide, three/examples, firebase *.map, pdfjs-dist, @napi-rs/canvas).
 */
async function beforeBuild() {
  return false;
}

module.exports = beforeBuild;
module.exports.beforeBuild = beforeBuild;
