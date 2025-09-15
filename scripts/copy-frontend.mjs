#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

/**
 * Cross-platform frontend copy script for desktop app packaging
 * Builds Vite frontend and copies to desktop-app/frontend/
 * Works on both Windows and Unix systems
 */

function log(message) {
  console.log(`[copy-frontend] ${message}`);
}

function error(message) {
  console.error(`[copy-frontend] ERROR: ${message}`);
  process.exit(1);
}

function execCommand(command, description, workingDir) {
  try {
    log(`${description}...`);
    log(`Working directory: ${workingDir || process.cwd()}`);
    execSync(command, { stdio: 'inherit', cwd: workingDir || process.cwd() });
    log(`✓ ${description} completed`);
  } catch (err) {
    error(`Failed to ${description.toLowerCase()}: ${err.message}`);
  }
}

function copyDirectory(src, dest) {
  try {
    log(`Copying ${src} to ${dest}...`);
    
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Remove existing contents
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
      fs.mkdirSync(dest, { recursive: true });
    }

    // Copy directory contents recursively
    function copyRecursive(srcPath, destPath) {
      const items = fs.readdirSync(srcPath);
      
      for (const item of items) {
        const srcItem = path.join(srcPath, item);
        const destItem = path.join(destPath, item);
        const stat = fs.statSync(srcItem);
        
        if (stat.isDirectory()) {
          fs.mkdirSync(destItem, { recursive: true });
          copyRecursive(srcItem, destItem);
        } else {
          fs.copyFileSync(srcItem, destItem);
        }
      }
    }

    copyRecursive(src, dest);
    log(`✓ Copy completed successfully`);
  } catch (err) {
    error(`Failed to copy directory: ${err.message}`);
  }
}

function fixAssetPaths(targetDir) {
  try {
    log('Fixing asset paths for Electron file:// protocol...');
    
    const indexPath = path.join(targetDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      error(`index.html not found at ${indexPath}`);
      return;
    }
    
    // Read the HTML file
    let htmlContent = fs.readFileSync(indexPath, 'utf8');
    log(`Original HTML content length: ${htmlContent.length}`);
    
    // Fix asset paths: change /assets/ to ./assets/
    const originalContent = htmlContent;
    htmlContent = htmlContent
      .replace(/href="\/assets\//g, 'href="./assets/')
      .replace(/src="\/assets\//g, 'src="./assets/')
      .replace(/href='\/assets\//g, "href='./assets/")
      .replace(/src='\/assets\//g, "src='./assets/");
    
    // Count changes made
    const hrefChanges = (originalContent.match(/href=["']\/assets\//g) || []).length;
    const srcChanges = (originalContent.match(/src=["']\/assets\//g) || []).length;
    
    if (hrefChanges + srcChanges > 0) {
      fs.writeFileSync(indexPath, htmlContent, 'utf8');
      log(`✓ Fixed ${hrefChanges} href and ${srcChanges} src asset paths`);
    } else {
      log('✓ No asset paths needed fixing');
    }
    
  } catch (err) {
    error(`Failed to fix asset paths: ${err.message}`);
  }
}

function verifyFiles(targetDir) {
  log('Verifying copied files...');
  
  const indexPath = path.join(targetDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    error(`index.html not found in ${targetDir}`);
  }
  
  // Check for common assets
  const expectedFiles = ['index.html'];
  const missingFiles = expectedFiles.filter(file => 
    !fs.existsSync(path.join(targetDir, file))
  );
  
  if (missingFiles.length > 0) {
    error(`Missing required files: ${missingFiles.join(', ')}`);
  }
  
  log('✓ File verification completed');
}

function main() {
  log('Starting cross-platform frontend copy process');
  
  // Derive project root from script location, not from cwd()
  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  const rootDir = path.resolve(scriptDir, '..');
  
  log(`Script location: ${scriptPath}`);
  log(`Project root: ${rootDir}`);
  
  const desktopAppDir = path.join(rootDir, 'desktop-app');
  const frontendDestDir = path.join(desktopAppDir, 'frontend');
  
  // Check if we're in the right directory
  if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
    error(`package.json not found in derived project root: ${rootDir}. Script might be in wrong location.`);
  }
  
  if (!fs.existsSync(desktopAppDir)) {
    error('desktop-app directory not found');
  }
  
  // Step 1: Build the frontend
  execCommand('npm run build', 'Building Vite frontend', rootDir);
  
  // Step 2: Determine source directory
  const distDir = path.join(rootDir, 'dist');
  let sourceDir;
  
  if (fs.existsSync(path.join(distDir, 'public'))) {
    sourceDir = path.join(distDir, 'public');
    log('Using dist/public as source directory');
  } else if (fs.existsSync(distDir)) {
    sourceDir = distDir;
    log('Using dist as source directory');
  } else {
    error('Built frontend not found. Expected dist/ or dist/public/ directory.');
  }
  
  // Step 3: Copy to desktop app
  copyDirectory(sourceDir, frontendDestDir);
  
  // Step 3.5: Fix asset paths for Electron (file:// protocol)
  fixAssetPaths(frontendDestDir);
  
  // Step 4: Verify the copy
  verifyFiles(frontendDestDir);
  
  log('✅ Frontend copy process completed successfully');
  log(`Frontend files copied to: ${frontendDestDir}`);
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as copyFrontend };