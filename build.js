#!/usr/bin/env node

/**
 * Production Build Script for Cryptexa
 * Optimizes files for production deployment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const BUILD_DIR = 'dist';
const STATIC_FILES = ['index.html', 'app.js', 'styles.css', 'server.js', 'package.json'];
const COPY_FILES = ['README.md', 'DEPLOYMENT.md', '.env.example', 'ecosystem.config.js', 'Dockerfile', '.dockerignore'];

console.log('🚀 Building Cryptexa for production...');

// Clean build directory
if (fs.existsSync(BUILD_DIR)) {
  fs.rmSync(BUILD_DIR, { recursive: true });
  console.log('✅ Cleaned build directory');
}

// Create build directory
fs.mkdirSync(BUILD_DIR, { recursive: true });
console.log('✅ Created build directory');

// Copy static files
STATIC_FILES.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join(BUILD_DIR, file));
    console.log(`✅ Copied ${file}`);
  }
});

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