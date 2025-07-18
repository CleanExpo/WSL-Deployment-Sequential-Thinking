import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

export function triggerVercelProdAndStreamLogs() {
  // Run prod deploy
  const log = spawn("vercel", ["--prod"], { stdio: "inherit" });
  log.on("close", (code) => {
    if (code === 0) console.log("✔️ Vercel deployment triggered.");
    else console.error("❌ Vercel deploy failed. See above logs for details.");
  });
}

export function triggerVercelDeployHook(hookUrl: string) {
  try {
    execSync(`curl -X POST "${hookUrl}"`, { stdio: "inherit" });
    console.log("✔️ Vercel deploy hook triggered.");
  } catch (err) {
    console.error("❌ Vercel deploy hook failed.");
    throw err;
  }
}

/**
 * Enhanced Vercel deployment with error handling for common issues
 */
export function deployToVercelWithFixes(projectRoot: string = process.cwd()): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🚀 Starting Vercel deployment with fixes...");
    
    // Check for problematic project names and fix them
    fixProjectNameIssues(projectRoot);
    
    // Create or fix vercel.json for proper deployment
    ensureVercelConfig(projectRoot);
    
    // Clean up .vercel directory if corrupted
    cleanVercelDirectory(projectRoot);
    
    // Build the Vercel command with proper flags
    const vercelArgs = ['--prod', '--yes'];
    
    // Add token if available
    if (process.env.VERCEL_TOKEN) {
      vercelArgs.push('--token', process.env.VERCEL_TOKEN);
    }
    
    console.log(`🔧 Running: vercel ${vercelArgs.join(' ')}`);
    
    const deployProcess = spawn('vercel', vercelArgs, { 
      stdio: 'inherit',
      cwd: projectRoot,
      env: { 
        ...process.env,
        VERCEL_TOKEN: process.env.VERCEL_TOKEN 
      }
    });

    deployProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ Vercel deployment completed successfully");
        resolve();
      } else {
        console.log("⚠️  Vercel deployment failed, attempting fixes...");
        // Try alternative deployment strategies
        attemptAlternativeDeployment(projectRoot)
          .then(resolve)
          .catch(reject);
      }
    });

    deployProcess.on('error', (error) => {
      console.log("⚠️  Vercel process error, attempting fixes...");
      attemptAlternativeDeployment(projectRoot)
        .then(resolve)
        .catch(reject);
    });
  });
}

/**
 * Fix common project name issues
 */
function fixProjectNameIssues(projectRoot: string): void {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const originalName = packageJson.name;
      
      if (originalName && (originalName.includes('_') || originalName.includes('---'))) {
        // Fix problematic characters
        const fixedName = originalName
          .replace(/_/g, '-')
          .replace(/---+/g, '-')
          .toLowerCase();
          
        if (fixedName !== originalName) {
          console.log(`🔧 Fixing project name: "${originalName}" → "${fixedName}"`);
          packageJson.name = fixedName;
          fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        }
      }
    } catch (error) {
      console.warn("⚠️  Could not read/fix package.json name");
    }
  }
}

/**
 * Ensure proper vercel.json configuration
 */
function ensureVercelConfig(projectRoot: string): void {
  const vercelJsonPath = path.join(projectRoot, 'vercel.json');
  
  // Check if vercel.json exists and is valid
  let vercelConfig: any = {};
  
  if (fs.existsSync(vercelJsonPath)) {
    try {
      vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    } catch (error) {
      console.log("🔧 Fixing corrupted vercel.json");
      vercelConfig = {};
    }
  }
  
  // For API-only projects, ensure minimal config
  const packageJsonPath = path.join(projectRoot, 'package.json');
  let isApiOnlyProject = false;
  
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      // Check if this looks like an API-only project
      const hasApiDir = fs.existsSync(path.join(projectRoot, 'api'));
      const hasNextConfig = fs.existsSync(path.join(projectRoot, 'next.config.js'));
      const hasReactDeps = packageJson.dependencies?.react || packageJson.dependencies?.next;
      
      isApiOnlyProject = hasApiDir && !hasNextConfig && !hasReactDeps;
    } catch (error) {
      // Ignore error
    }
  }
  
  if (isApiOnlyProject) {
    console.log("🔧 Configuring for API-only deployment");
    vercelConfig = {
      "functions": {
        "api/*.js": {
          "maxDuration": 10
        }
      }
    };
  } else if (Object.keys(vercelConfig).length === 0) {
    // Minimal config for other projects
    vercelConfig = {};
  }
  
  // Write the config
  fs.writeFileSync(vercelJsonPath, JSON.stringify(vercelConfig, null, 2));
}

/**
 * Clean up corrupted .vercel directory
 */
function cleanVercelDirectory(projectRoot: string): void {
  const vercelDir = path.join(projectRoot, '.vercel');
  
  if (fs.existsSync(vercelDir)) {
    try {
      // Check if project.json is valid
      const projectJsonPath = path.join(vercelDir, 'project.json');
      if (fs.existsSync(projectJsonPath)) {
        const projectData = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
        if (!projectData.projectId || !projectData.orgId) {
          throw new Error("Invalid project configuration");
        }
      }
    } catch (error) {
      console.log("🔧 Cleaning corrupted .vercel directory");
      fs.rmSync(vercelDir, { recursive: true, force: true });
    }
  }
}

/**
 * Attempt alternative deployment strategies if main deployment fails
 */
async function attemptAlternativeDeployment(projectRoot: string): Promise<void> {
  console.log("🔄 Attempting alternative deployment strategies...");
  
  // Strategy 1: Use vercel deploy instead of vercel --prod
  try {
    console.log("📤 Trying: vercel deploy --prod --yes");
    const result = execSync('vercel deploy --prod --yes', { 
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, VERCEL_TOKEN: process.env.VERCEL_TOKEN }
    });
    console.log("✅ Alternative deployment successful");
    return;
  } catch (error) {
    console.log("⚠️  vercel deploy failed, trying next strategy...");
  }
  
  // Strategy 2: Force new project creation with clean name
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const cleanName = (packageJson.name || 'my-project')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
      
      console.log(`📤 Trying: vercel --prod --yes --name ${cleanName}`);
      execSync(`vercel --prod --yes --name ${cleanName}`, { 
        cwd: projectRoot,
        stdio: 'inherit',
        env: { ...process.env, VERCEL_TOKEN: process.env.VERCEL_TOKEN }
      });
      console.log("✅ Force deployment successful");
      return;
    }
  } catch (error) {
    console.log("⚠️  Force deployment failed, trying final strategy...");
  }
  
  // Strategy 3: Manual vercel link and deploy
  try {
    console.log("🔗 Attempting manual link and deploy...");
    
    // Remove .vercel and start fresh
    const vercelDir = path.join(projectRoot, '.vercel');
    if (fs.existsSync(vercelDir)) {
      fs.rmSync(vercelDir, { recursive: true, force: true });
    }
    
    // Try basic deployment
    execSync('vercel --yes', { 
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, VERCEL_TOKEN: process.env.VERCEL_TOKEN }
    });
    console.log("✅ Manual deployment successful");
    return;
  } catch (error) {
    throw new Error(`All deployment strategies failed. Last error: ${error}`);
  }
}
