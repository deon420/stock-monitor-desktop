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
    console.log('\n🔧 Step 0: Installing root dependencies...');
    await runCommand('npm', ['ci'], projectRoot);

    console.log('\n🔧 Step 1: Building frontend for desktop with relative paths...');
    // Run vite build with relative paths for desktop using local binary
    const viteBin = process.platform === 'win32' ? 'vite.cmd' : 'vite';
    await runCommand(join(projectRoot, 'node_modules', '.bin', viteBin), ['build', '--base=./'], projectRoot);
    // Run esbuild separately for server bundle using local binary
    const esbuildBin = process.platform === 'win32' ? 'esbuild.cmd' : 'esbuild';
    await runCommand(join(projectRoot, 'node_modules', '.bin', esbuildBin), ['server/index.ts', '--platform=node', '--packages=external', '--bundle', '--format=esm', '--outdir=dist'], projectRoot);

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

    console.log('\n🖥️  Step 4: Packaging desktop application (no installers)...');
    await runCommand('npm', ['run', 'build-win'], desktopAppPath);
    
    // Clean up any unwanted installer files created by electron-builder
    const distDir = join(desktopAppPath, 'dist');
    const unwantedFiles = [
      join(distDir, 'Stock Monitor Setup 1.0.0.exe'),
      join(distDir, 'Stock Monitor Setup 1.0.0.exe.blockmap'),
      join(distDir, '__uninstaller-nsis-stock-monitor-desktop.exe')
    ];
    
    for (const file of unwantedFiles) {
      try {
        if (existsSync(file)) {
          const { unlinkSync } = await import('fs');
          unlinkSync(file);
          console.log(`🗑️  Removed unwanted file: ${file}`);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    console.log('\n🎨 Step 5: Creating professional installer with Inno Setup...');
    try {
      // Direct path to ISCC.exe 
      const isccPath = 'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe';
      
      console.log(`Using Inno Setup at: ${isccPath}`);
      
      // Run Inno Setup to create professional installer
      await runCommand(`"${isccPath}"`, ['installer.iss'], desktopAppPath);
      
      console.log('\n🎉 BUILD COMPLETE!');
      console.log('');
      console.log('🎨 Professional Installer: desktop-app/dist/StockMonitor-Setup-1.0.0.exe');
      console.log('✨ Features: Windows 11 style GUI with auto-update support');
      console.log('');
      console.log('✅ Ready for professional distribution!');
      
    } catch (innoError) {
      console.log('\n❌ Inno Setup failed');
      console.log('📝 Error details:', innoError.message);
      console.log('📝 Make sure Inno Setup is installed at: C:\\Program Files (x86)\\Inno Setup 6\\');
      console.log('');
      console.log('🎉 BUILD INCOMPLETE - INSTALLER FAILED:');
      console.log('');
      console.log('❌ No installer created - Inno Setup required for auto-update support');
      console.log('💡 Please install Inno Setup to create professional installer');
      console.log('');
      console.log('⚠️  Build failed - installer is required!');
    }

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