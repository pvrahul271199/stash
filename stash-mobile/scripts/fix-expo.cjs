const fs = require('fs');
const path = require('path');

const cliRoots = [
  path.join(__dirname, '..', 'node_modules', 'expo', 'node_modules', '@expo', 'cli', 'build', 'src', 'start'),
  path.join(__dirname, '..', 'node_modules', '@expo', 'cli', 'build', 'src', 'start'),
];

for (const startDir of cliRoots) {
  const dir = path.join(startDir, 'server', 'middleware');
  const resolveAssetsPath = path.join(dir, 'resolveAssets.js');
  if (fs.existsSync(resolveAssetsPath)) {
    let content = fs.readFileSync(resolveAssetsPath, 'utf8');
    content = content.replace(
      /const sdkAssetFieldPaths = await \(0, _getExpoSchema\.getAssetSchemasAsync\)\(manifest\.sdkVersion\);/g,
      `const sdkAssetFieldPaths = ['icon','notification.icon','splash.image','ios.splash.image','ios.splash.tabletImage','ios.splash.dark.image','ios.splash.dark.tabletImage','android.icon','android.adaptiveIcon.foregroundImage','android.adaptiveIcon.monochromeImage','android.adaptiveIcon.backgroundImage','android.splash.image','web.splash.image'];`
    );
    fs.writeFileSync(resolveAssetsPath, content, 'utf8');
  }

  const manifestMwPath = path.join(dir, 'ManifestMiddleware.js');
  if (fs.existsSync(manifestMwPath)) {
    let content = fs.readFileSync(manifestMwPath, 'utf8');
    content = content.replace(
      /bundleUrl\.match\(\/\^https\?:\\\/\\\/\.\*\?\\\/\/\)\[0\]/g,
      `(bundleUrl.match(/https?:\\/\\/.*?\\//)?.[0] ?? '')`
    );
    fs.writeFileSync(manifestMwPath, content, 'utf8');
  }

  const resolveOptsPath = path.join(startDir, 'resolveOptions.js');
  if (fs.existsSync(resolveOptsPath)) {
    let content = fs.readFileSync(resolveOptsPath, 'utf8');
    content = content.replace(
      /case true:\s*case 'expo':\s*return 'expo';/g,
      `case true:\n            return 'ngrok';\n        case 'expo':\n            return 'expo';`
    );
    content = content.replace(
      /return host === 'tunnel' \? 'expo' : null;/g,
      `return host === 'tunnel' ? 'ngrok' : null;`
    );
    fs.writeFileSync(resolveOptsPath, content, 'utf8');
  }
}
