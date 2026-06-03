#!/usr/bin/env node

/**
 * Production build for Cryptexa.
 * Creates:
 * - dist/ for traditional Node deployments
 * - public/ assets for Vercel static delivery
 * - dist/server.js as the compiled runtime used by the root server.js wrapper
 */

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

const BUILD_DIR = 'dist';
const PUBLIC_DIR = 'public';
const PUBLIC_STATIC_FILES = ['favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png'];
const OBSOLETE_PUBLIC_FILES = ['kinetic.css', 'icon.png'];
const COPY_FILES = ['README.md', 'DEPLOYMENT.md', '.env.example', 'ecosystem.config.js', 'Dockerfile', '.dockerignore', 'vercel.json'];
const SRC_DIR = 'src';

console.log('Building Cryptexa for production...');

let esbuild = null;
try {
  esbuild = require('esbuild');
} catch {
  console.log('esbuild not found. Falling back to the checked-in browser bundle.');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFileToTargets(relativePath, content, targets) {
  for (const targetDir of targets) {
    ensureDir(targetDir);
    fs.writeFileSync(path.join(targetDir, relativePath), content);
  }
}

function copyFileToTargets(sourceFile, targets, outputName = sourceFile) {
  if (!fs.existsSync(sourceFile)) {
    return;
  }

  for (const targetDir of targets) {
    ensureDir(targetDir);
    fs.copyFileSync(sourceFile, path.join(targetDir, outputName));
  }
}

function removeFileFromTargets(relativePath, targets) {
  for (const targetDir of targets) {
    const filePath = path.join(targetDir, relativePath);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
      console.log(`Removed obsolete ${filePath}`);
    }
  }
}

function removeMatchingFilesFromTargets(pattern, targets) {
  for (const targetDir of targets) {
    if (!fs.existsSync(targetDir)) {
      continue;
    }

    for (const fileName of fs.readdirSync(targetDir)) {
      if (!pattern.test(fileName)) {
        continue;
      }
      fs.rmSync(path.join(targetDir, fileName), { force: true });
      console.log(`Removed stale generated asset ${path.join(targetDir, fileName)}`);
    }
  }
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/;\s*}/g, '}')
    .replace(/\s*{\s*/g, '{')
    .replace(/;\s*/g, ';')
    .trim();
}

function buildClientBundle() {
  if (esbuild && fs.existsSync(SRC_DIR) && fs.existsSync(path.join(SRC_DIR, 'app.ts'))) {
    console.log('Bundling src/app.ts...');
    const result = esbuild.buildSync({
      entryPoints: [path.join(SRC_DIR, 'app.ts')],
      bundle: true,
      minify: true,
      write: false,
      format: 'iife',
      target: ['es2020'],
      sourcemap: false,
    });

    return result.outputFiles[0].text;
  }

  if (fs.existsSync('app.js')) {
    const source = fs.readFileSync('app.js', 'utf8');
    if (!esbuild) {
      return source;
    }

    console.log('Minifying existing app.js...');
    return esbuild.transformSync(source, {
      minify: true,
      target: ['es2020'],
    }).code;
  }

  throw new Error('Unable to build browser bundle. Neither src/app.ts nor app.js exists.');
}

if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  console.log('Cleaned dist/');
}

ensureDir(BUILD_DIR);
ensureDir(PUBLIC_DIR);

for (const file of OBSOLETE_PUBLIC_FILES) {
  removeFileFromTargets(file, [PUBLIC_DIR, BUILD_DIR]);
}
removeMatchingFilesFromTargets(/^(?:app\.[a-f0-9]{8}\.js|styles\.[a-f0-9]{8}\.css)$/i, [PUBLIC_DIR, BUILD_DIR]);

function getHash(content) {
  return nodeCrypto.createHash('sha256').update(content).digest('hex').substring(0, 8);
}

const clientBundle = buildClientBundle();
const appHash = getHash(clientBundle);
const appHashedName = `app.${appHash}.js`;
writeFileToTargets('app.js', clientBundle, [BUILD_DIR, PUBLIC_DIR]);
writeFileToTargets(appHashedName, clientBundle, [BUILD_DIR, PUBLIC_DIR]);
console.log(`Wrote browser bundle to app.js and ${appHashedName}`);

copyFileToTargets('index.html', [BUILD_DIR, PUBLIC_DIR]);
for (const file of PUBLIC_STATIC_FILES) {
  copyFileToTargets(file, [BUILD_DIR, PUBLIC_DIR]);
}

let cssHashedName = 'styles.css';
if (fs.existsSync('styles.css')) {
  const css = minifyCss(fs.readFileSync('styles.css', 'utf8'));
  const cssHash = getHash(css);
  cssHashedName = `styles.${cssHash}.css`;
  writeFileToTargets('styles.css', css, [BUILD_DIR, PUBLIC_DIR]);
  writeFileToTargets(cssHashedName, css, [BUILD_DIR, PUBLIC_DIR]);
  console.log(`Minified styles.css to styles.css and ${cssHashedName}`);
}

if (esbuild && fs.existsSync('server-app.ts')) {
  console.log('Compiling server-app.ts...');
  esbuild.buildSync({
    entryPoints: ['server-app.ts'],
    platform: 'node',
    bundle: true,
    packages: 'external',
    outfile: path.join(BUILD_DIR, 'server.js'),
    target: 'node18',
    format: 'cjs',
  });
  console.log('Compiled dist/server.js');
}

const indexHtmlPaths = [
  path.join(BUILD_DIR, 'index.html'),
  path.join(PUBLIC_DIR, 'index.html')
];

for (const indexHtmlPath of indexHtmlPaths) {
  if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');
    html = html.replace(
      /<script type="module" src="\.\/src\/app\.js"><\/script>/,
      `<script src="./${appHashedName}"></script>`
    );
    html = html.replace(
      /<script src="\.\/app\.js"><\/script>/,
      `<script src="./${appHashedName}"></script>`
    );
    html = html.replace(
      /<link rel="stylesheet" href="\.\/styles\.css" \/>/,
      `<link rel="stylesheet" href="./${cssHashedName}" />`
    );
    fs.writeFileSync(indexHtmlPath, html);
    console.log(`Patched ${indexHtmlPath} with hashed assets.`);
  }
}

for (const file of COPY_FILES) {
  copyFileToTargets(file, [BUILD_DIR]);
}

if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  delete pkg.devDependencies;
  pkg.scripts = {
    start: pkg.scripts.start,
    prod: pkg.scripts.prod
  };

  fs.writeFileSync(
    path.join(BUILD_DIR, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );
  console.log('Created dist/package.json');
}

const deployInstructions = `# Cryptexa Production Deployment

## Build outputs

- dist/: standalone Node deployment output
- public/: static assets served by Vercel

## Quick deploy

1. Install dependencies:
   npm install --production
2. Set environment variables (see .env.example)
3. Start the application:
   npm run prod

## Notes

- Vercel requires MongoDB persistence. Set DB_TYPE=mongodb and MONGODB_URI.
- The browser bundle is generated from src/app.ts when available.
- index.html stays outside public/ so Express can serve it with runtime headers.

Build created: ${new Date().toISOString()}
`;

fs.writeFileSync(path.join(BUILD_DIR, 'DEPLOY.md'), deployInstructions);
console.log('Created dist/DEPLOY.md');

console.log('Build complete.');
