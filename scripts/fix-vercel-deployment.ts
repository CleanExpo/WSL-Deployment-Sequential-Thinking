#!/usr/bin/env node

/**
 * Standalone script to fix Vercel deployment issues
 * Handles project naming conflicts, framework detection, and .vercel directory corruption
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface FixOptions {
  projectRoot?: string;
  verbose?: boolean;
  dryRun?: boolean;
}

/**
 * Main fix function
 */
export function fixVercelDeployment(options: FixOptions = {}): void {
  const projectRoot = options.projectRoot || process.cwd();
  const verbose = options.verbose || false;
  const dryRun = options.dryRun || false;

  console.log('🔧 Vercel Deployment Fixer');
  console.log(`📁 Project: ${projectRoot}`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  }
  
  console.log('');

  // Fix 1: Project naming issues
  fixProjectNaming(projectRoot, verbose, dryRun);

  // Fix 2: Clean .vercel directory if corrupted
  cleanVercelDirectory(projectRoot, verbose, dryRun);

  // Fix 3: Ensure proper vercel.json
  ensureVercelConfig(projectRoot, verbose, dryRun);

  // Fix 4: Check environment variables
  checkEnvironmentVariables(verbose);

  console.log('✅ Vercel deployment fixes completed');
}

/**
 * Fix project naming issues in package.json
 */
function fixProjectNaming(projectRoot: string, verbose: boolean, dryRun: boolean): void {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    if (verbose) console.log('⚠️  No package.json found');
    return;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const originalName = packageJson.name;
    
    if (!originalName) {
      console.log('📝 No project name in package.json');
      return;
    }

    // Check for problematic characters
    const problematicChars = /[^a-z0-9-]/g;
    const hasUnderscores = originalName.includes('_');
    const hasTripleDashes = originalName.includes('---');
    const hasProblematicChars = problematicChars.test(originalName);

    if (hasUnderscores || hasTripleDashes || hasProblematicChars) {
      const fixedName = originalName
        .toLowerCase()
        .replace(/_/g, '-')           // Replace underscores with hyphens
        .replace(/---+/g, '-')        // Replace multiple dashes with single dash
        .replace(/[^a-z0-9-]/g, '-')  // Replace other chars with hyphens
        .replace(/-+/g, '-')          // Clean up multiple hyphens
        .replace(/^-|-$/g, '');       // Remove leading/trailing hyphens

      console.log(`🔧 Project name issue detected:`);
      console.log(`   Original: "${originalName}"`);
      console.log(`   Fixed:    "${fixedName}"`);

      if (!dryRun) {
        packageJson.name = fixedName;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log('✅ Package.json updated');
      }
    } else {
      if (verbose) console.log('✅ Project name is valid');
    }
  } catch (error) {
    console.error('❌ Error reading package.json:', error);
  }
}

/**
 * Clean corrupted .vercel directory
 */
function cleanVercelDirectory(projectRoot: string, verbose: boolean, dryRun: boolean): void {
  const vercelDir = path.join(projectRoot, '.vercel');
  
  if (!fs.existsSync(vercelDir)) {
    if (verbose) console.log('📁 No .vercel directory found');
    return;
  }

  try {
    // Check if project.json exists and is valid
    const projectJsonPath = path.join(vercelDir, 'project.json');
    
    if (fs.existsSync(projectJsonPath)) {
      const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
      
      // Validate required fields
      if (!projectData.projectId || !projectData.orgId) {
        console.log('🗑️  Corrupted .vercel/project.json detected');
        console.log('   Missing projectId or orgId');
        
        if (!dryRun) {
          fs.rmSync(vercelDir, { recursive: true, force: true });
          console.log('✅ Cleaned .vercel directory');
        }
      } else {
        if (verbose) console.log('✅ .vercel directory is valid');
      }
    } else {
      if (verbose) console.log('📁 .vercel directory exists but no project.json');
    }
  } catch (error) {
    console.log('🗑️  Invalid .vercel directory detected');
    console.log(`   Error: ${error}`);
    
    if (!dryRun) {
      fs.rmSync(vercelDir, { recursive: true, force: true });
      console.log('✅ Cleaned .vercel directory');
    }
  }
}

/**
 * Ensure proper vercel.json configuration
 */
function ensureVercelConfig(projectRoot: string, verbose: boolean, dryRun: boolean): void {
  const vercelJsonPath = path.join(projectRoot, 'vercel.json');
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  // Determine project type
  let projectType = 'unknown';
  let needsConfig = false;
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const hasApiDir = fs.existsSync(path.join(projectRoot, 'api'));
      const hasNextConfig = fs.existsSync(path.join(projectRoot, 'next.config.js'));
      const hasReactDeps = packageJson.dependencies?.react || packageJson.dependencies?.next;
      
      if (hasApiDir && !hasNextConfig && !hasReactDeps) {
        projectType = 'api-only';
        needsConfig = true;
      } else if (hasNextConfig || hasReactDeps) {
        projectType = 'next-js';
      } else {
        projectType = 'static';
      }
      
      if (verbose) console.log(`📊 Detected project type: ${projectType}`);
    } catch (error) {
      console.warn('⚠️  Could not analyze project type');
    }
  }

  // Check existing vercel.json
  let existingConfig: any = {};
  let configIsValid = true;
  
  if (fs.existsSync(vercelJsonPath)) {
    try {
      existingConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
      if (verbose) console.log('📄 Found existing vercel.json');
    } catch (error) {
      console.log('🔧 Corrupted vercel.json detected');
      configIsValid = false;
      needsConfig = true;
    }
  } else if (projectType === 'api-only') {
    needsConfig = true;
  }

  if (needsConfig || !configIsValid) {
    let newConfig: any = {};
    
    if (projectType === 'api-only') {
      newConfig = {
        "functions": {
          "api/*.js": {
            "maxDuration": 10
          }
        }
      };
      console.log('🔧 Creating API-only vercel.json configuration');
    } else {
      newConfig = {};
      console.log('🔧 Creating minimal vercel.json configuration');
    }
    
    if (!dryRun) {
      fs.writeFileSync(vercelJsonPath, JSON.stringify(newConfig, null, 2));
      console.log('✅ Updated vercel.json');
    }
  } else {
    if (verbose) console.log('✅ vercel.json is valid');
  }
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables(verbose: boolean): void {
  const requiredVars = ['VERCEL_TOKEN'];
  const optionalVars = ['VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'];
  
  console.log('🔍 Checking environment variables:');
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: Set`);
    } else {
      console.log(`   ❌ ${varName}: Missing (required)`);
    }
  }
  
  if (verbose) {
    for (const varName of optionalVars) {
      if (process.env[varName]) {
        console.log(`   ✅ ${varName}: Set`);
      } else {
        console.log(`   ⚪ ${varName}: Not set (optional)`);
      }
    }
  }
}

/**
 * CLI interface
 */
function main(): void {
  const args = process.argv.slice(2);
  const options: FixOptions = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--dry-run':
      case '-n':
        options.dryRun = true;
        break;
      case '--project':
      case '-p':
        options.projectRoot = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Vercel Deployment Fixer

Usage: fix-vercel-deployment [options]

Options:
  -v, --verbose     Show detailed output
  -n, --dry-run     Show what would be changed without making changes
  -p, --project     Specify project directory (default: current directory)
  -h, --help        Show this help message

Examples:
  fix-vercel-deployment
  fix-vercel-deployment --verbose
  fix-vercel-deployment --dry-run --verbose
  fix-vercel-deployment --project /path/to/project
        `);
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }
  
  try {
    fixVercelDeployment(options);
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
