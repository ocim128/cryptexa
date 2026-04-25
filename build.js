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

const BUILD_DIR = 'dist';
const PUBLIC_DIR = 'public';
const PUBLIC_STATIC_FILES = ['styles.css', 'icon.png'];
const OBSOLETE_PUBLIC_FILES = ['kinetic.css'];
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

const clientBundle = buildClientBundle();
writeFileToTargets('app.js', clientBundle, [BUILD_DIR, PUBLIC_DIR]);
console.log('Wrote browser bundle to dist/app.js and public/app.js');

copyFileToTargets('index.html', [BUILD_DIR, PUBLIC_DIR]);
for (const file of PUBLIC_STATIC_FILES) {
  copyFileToTargets(file, [BUILD_DIR, PUBLIC_DIR]);
}

if (fs.existsSync('styles.css')) {
  const css = minifyCss(fs.readFileSync('styles.css', 'utf8'));
  writeFileToTargets('styles.css', css, [BUILD_DIR, PUBLIC_DIR]);
  console.log('Minified styles.css for dist/ and public/');
}

if (esbuild && fs.existsSync('server-app.ts')) {
  console.log('Compiling server-app.ts...');
  esbuild.buildSync({
    entryPoints: ['server-app.ts'],
    platform: 'node',
    outfile: path.join(BUILD_DIR, 'server.js'),
    target: 'node18',
    format: 'cjs',
  });
  console.log('Compiled dist/server.js');
}

const indexHtmlPath = path.join(BUILD_DIR, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  html = html.replace(
    /<script type="module" src="\.\/src\/app\.js"><\/script>/,
    '<script src="./app.js"></script>'
  );
  html = html.replace(
    /<script src="\.\/app\.js"><\/script>/,
    '<script src="./app.js"></script>'
  );
  fs.writeFileSync(indexHtmlPath, html);
  console.log('Patched dist/index.html');
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
