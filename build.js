#!/usr/bin/env node

/**
 * Production Build Script for Cryptexa
 * Optimizes files for production deployment
 * Supports both modular (src/) and bundled (app.js) output
 */

const fs = require('fs');
const path = require('path');


// Configuration
const BUILD_DIR = 'dist';
const STATIC_FILES = ['index.html', 'styles.css', 'kinetic.css', 'package.json', 'icon.png'];
const COPY_FILES = ['README.md', 'DEPLOYMENT.md', '.env.example', 'ecosystem.config.js', 'Dockerfile', '.dockerignore'];
const SRC_DIR = 'src';

console.log('🚀 Building Cryptexa for production...');

// Check if esbuild is available for bundling
let hasEsbuild = false;
try {
  require.resolve('esbuild');
  hasEsbuild = true;
} catch {
  console.log('⚠️  esbuild not found. Install with: npm install -D esbuild');
  console.log('   Falling back to copying the original app.js');
}

// Clean build directory
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true });
  console.log('✅ Cleaned build directory');
}

// Create build directory
fs.mkdirSync(BUILD_DIR, { recursive: true });
console.log('✅ Created build directory');

// Bundle src/ files if esbuild is available and src/ exists
if (hasEsbuild && fs.existsSync(SRC_DIR) && fs.existsSync(path.join(SRC_DIR, 'app.ts'))) {
  try {
    console.log('📦 Bundling modular source files...');

    // Use esbuild to bundle the modular source into a single file

    const esbuild = require('esbuild');
    esbuild.buildSync({
      entryPoints: [path.join(SRC_DIR, 'app.ts')],
      bundle: true,
      minify: true,
      outfile: path.join(BUILD_DIR, 'app.js'),
      format: 'iife',
      target: ['es2020'],
      sourcemap: false,
    });

    console.log('✅ Bundled modular source to app.js');
  } catch (error) {
    console.error('❌ Bundle failed:', error.message);
    console.log('   Falling back to copying original app.js');
    if (fs.existsSync('app.js')) {
      fs.copyFileSync('app.js', path.join(BUILD_DIR, 'app.js'));
      console.log('✅ Copied original app.js');
    }
  }
} else if (fs.existsSync('app.js')) {
  // Fall back to copying and optionally minifying app.js
  const jsSource = fs.readFileSync('app.js', 'utf8');

  if (hasEsbuild) {
    try {
      // Use esbuild's transform API for minification (faster than terser)
      const esbuild = require('esbuild');
      const result = esbuild.transformSync(jsSource, {
        minify: true,
        target: ['es2020'],
      });
      fs.writeFileSync(path.join(BUILD_DIR, 'app.js'), result.code);
      console.log('✅ Minified and copied app.js');
    } catch (error) {
      console.warn('⚠️  JS minification failed:', error.message);
      fs.writeFileSync(path.join(BUILD_DIR, 'app.js'), jsSource);
      console.log('✅ Copied app.js (unminified)');
    }
  } else {
    fs.writeFileSync(path.join(BUILD_DIR, 'app.js'), jsSource);
    console.log('✅ Copied app.js (unminified - install esbuild for minification)');
  }
}

// Copy static files
STATIC_FILES.forEach(file => {
  if (fs.existsSync(file) && file !== 'app.js') {
    fs.copyFileSync(file, path.join(BUILD_DIR, file));
    console.log(`✅ Copied ${file}`);
  }
});

// Compile server.ts to dist/server.js
if (hasEsbuild && fs.existsSync('server.ts')) {
  try {
    console.log('📦 Compiling server.ts...');
    require('esbuild').buildSync({
      entryPoints: ['server.ts'],
      platform: 'node',
      outfile: path.join(BUILD_DIR, 'server.js'),
      target: 'node18',
      format: 'cjs',
    });
    console.log('✅ Compiled server.ts to dist/server.js');
  } catch (e) {
    console.error('❌ Failed to compile server.ts:', e);
  }
}

// Patch index.html to use bundled app.js
const indexHtmlPath = path.join(BUILD_DIR, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  // Replace module import with bundled script
  html = html.replace(
    /<script type="module" src="\.\/src\/app\.js"><\/script>/,
    '<script src="./app.js"></script>'
  );
  // Fallback if user using old path
  html = html.replace(
    /<script src="\.\/app\.js"><\/script>/,
    '<script src="./app.js"></script>'
  );
  fs.writeFileSync(indexHtmlPath, html);
  console.log('✅ Patched index.html for production');
}

// Copy additional files
COPY_FILES.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(BUILD_DIR, file));
    console.log(`✅ Copied ${file}`);
  }
});

// Minify CSS (basic minification)
if (fs.existsSync('styles.css')) {
  let css = fs.readFileSync('styles.css', 'utf8');
  // Remove comments and extra whitespace
  css = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/;\s*}/g, '}')
    .replace(/\s*{\s*/g, '{')
    .replace(/;\s*/g, ';')
    .trim();

  fs.writeFileSync(path.join(BUILD_DIR, 'styles.css'), css);
  console.log('✅ Minified CSS');
}

// Create production package.json
if (fs.existsSync('package.json')) {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  // Remove dev dependencies and scripts not needed in production
  delete pkg.devDependencies;
  pkg.scripts = {
    start: pkg.scripts.start,
    prod: pkg.scripts.prod
  };

  fs.writeFileSync(
    path.join(BUILD_DIR, 'package.json'),
    JSON.stringify(pkg, null, 2)
  );
  console.log('✅ Created production package.json');
}

// Create deployment instructions
const deployInstructions = `# Cryptexa Production Deployment

## Quick Deploy

1. Install dependencies:
   \`\`\`bash
   npm install --production
   \`\`\`

2. Set environment variables (see .env.example)

3. Start the application:
   \`\`\`bash
   npm run prod
   \`\`\`

## Modular Architecture

The source code has been modularized for better maintainability:

\`\`\`
src/
├── crypto/
│   ├── aes-gcm.js      # Encryption/decryption
│   ├── pbkdf2.js       # Key derivation
│   └── index.js        # Crypto exports
├── state/
│   ├── ClientState.js  # State management class
│   └── index.js        # State exports
├── ui/
│   ├── dialogs.js      # Dialog management
│   ├── tabs.js         # Tab management
│   ├── toast.js        # Notifications
│   ├── themes.js       # Theme toggling
│   └── index.js        # UI exports
├── utils/
│   ├── fetch.js        # fetchWithRetry, debounce
│   ├── dom.js          # DOM helpers (qs, qsa, on)
│   ├── crypto-helpers.js # Crypto utilities
│   └── index.js        # Utils exports
└── app.js              # Main entry, orchestration
\`\`\`

For development, you can work with the modular source in src/.
The build process bundles everything into a single app.js.

## Files in this build:
${[...STATIC_FILES, ...COPY_FILES].map(f => `- ${f}`).join('\n')}

Build created: ${new Date().toISOString()}
`;

fs.writeFileSync(path.join(BUILD_DIR, 'DEPLOY.md'), deployInstructions);
console.log('✅ Created deployment instructions');

console.log('\n🎉 Production build complete!');
console.log(`📁 Build output: ${BUILD_DIR}/`);
console.log('\n📋 Next steps:');
console.log('1. Review DEPLOY.md for deployment instructions');
console.log('2. Set up environment variables');
console.log('3. Deploy to your production environment');