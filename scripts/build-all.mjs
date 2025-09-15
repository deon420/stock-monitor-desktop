#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const desktopAppPath = join(projectRoot, 'desktop-app');

console.log('🚀 [build-all] Starting complete build process...');
console.log(`📁 Project root: ${projectRoot}`);
console.log(`📁 Desktop app: ${desktopAppPath}`);

function runCommand(command, args, cwd = projectRoot, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️  Running: ${command} ${args.join(' ')}`);
    console.log(`📍 Working directory: ${cwd}`);
    
    const processOptions = {
      cwd,
      stdio: options.captureOutput ? 'pipe' : 'inherit',
      shell: true,
      ...options
    };

    const childProcess = spawn(command, args, processOptions);
    let output = '';

    if (options.captureOutput) {
      childProcess.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      childProcess.stderr.on('data', (data) => {
        output += data.toString();
        process.stderr.write(data);
      });
    }

    childProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Command completed successfully`);
        resolve(output);
      } else {
        console.error(`❌ Command failed with exit code ${code}`);
        reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
      }
    });

    childProcess.on('error', (err) => {
      console.error(`❌ Command error:`, err);
      reject(err);
    });
  });
}

async function buildAll() {
  try {
    console.log('\n🔧 Step 1: Building frontend...');
    await runCommand('npm', ['run', 'build'], projectRoot);

    console.log('\n📋 Step 2: Copying frontend to desktop app...');
    await runCommand('node', ['scripts/copy-frontend.mjs'], projectRoot);
    
    // Verify the copy was successful by checking the files directly
    const frontendDir = join(desktopAppPath, 'frontend');
    const indexPath = join(frontendDir, 'index.html');
    const assetsDir = join(frontendDir, 'assets');
    
    if (!existsSync(frontendDir)) {
      throw new Error(`Frontend copy failed: directory ${frontendDir} was not created`);
    }
    
    if (!existsSync(indexPath)) {
      throw new Error(`Frontend copy failed: index.html not found at ${indexPath}`);
    }
    
    if (!existsSync(assetsDir)) {
      throw new Error(`Frontend copy failed: assets directory not found at ${assetsDir}`);
    }
    
    console.log(`✅ Frontend copy verification completed: ${frontendDir}`);

    console.log('\n📦 Step 3: Installing desktop app dependencies...');
    if (!existsSync(join(desktopAppPath, 'package.json'))) {
      throw new Error('Desktop app package.json not found');
    }
    await runCommand('npm', ['install'], desktopAppPath);

    console.log('\n🖥️  Step 4: Building desktop application...');
    await runCommand('npm', ['run', 'build-win'], desktopAppPath);

    console.log('\n🎉 BUILD COMPLETE! Your application is ready:');
    console.log('');
    console.log('📱 Portable App: desktop-app/dist/win-unpacked/Stock Monitor.exe');
    console.log('💾 Installer: desktop-app/dist/Stock Monitor Setup 1.0.0.exe');
    console.log('');
    console.log('✅ Ready for distribution!');

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    console.error('\n🔍 Troubleshooting tips:');
    console.error('- Ensure Node.js 18+ is installed');
    console.error('- Install Python 3.x and Visual Studio Build Tools');
    console.error('- Run with administrator privileges');
    console.error('- Check that all prerequisites are in PATH');
    process.exit(1);
  }
}

// Check if all required directories exist
if (!existsSync(projectRoot)) {
  console.error('❌ Project root not found');
  process.exit(1);
}

if (!existsSync(desktopAppPath)) {
  console.error('❌ Desktop app directory not found');
  process.exit(1);
}

buildAll();