const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

// build-info.json is created by scripts/build.sh during the pipeline.
// When running locally it does not exist, so we fall back to "local".
function getBuildInfo() {
  const file = path.join(__dirname, '..', 'build-info.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { version: pkg.version, build: 'local', commit: 'local', builtAt: 'n/a' };
  }
}

module.exports = { getBuildInfo };
