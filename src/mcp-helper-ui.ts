import inquirer from "inquirer";
import path from "path";
import fs from "fs";
import { execSync, spawnSync } from "child_process";
import { sshSetupWizard, quickSSHFix, checkSSHAgent, checkGitHubSSHConnection } from "./ssh-setup.js";
import { runSystemDiagnostics, checkAllPrerequisites, checkEnvironmentVariables } from "./system-check.js";
import { discoverProjectContext, generateDeploymentGuide, analyzeDeploymentReadiness } from "./project-context.js";

function safePrint(msg: string) {
  process.stdout.write(msg + "\n");
}

function showProjectInfo() {
  const context = discoverProjectContext();
  
  safePrint(`
📊 Current Project Analysis:
  
📁 Project: ${context.packageJson?.name || 'Unknown'}
🏗️  Framework: ${context.framework || 'None detected'}
🚀 Strategy: ${context.deploymentStrategy}
📝 Build Script: ${context.buildScript || 'None'}
🔐 Environment Files: ${context.envFiles.length}

${context.envFiles.length > 0 ? 
  `📋 Found Environment Files:\n${context.envFiles.map(f => `   • ${path.basename(f)}`).join('\n')}` : 
  '⚠️  No environment files found'}
  
${context.deploymentDocs.length > 0 ? 
  `📚 Documentation:\n${context.deploymentDocs.map(f => `   • ${path.basename(f)}`).join('\n')}` : 
  '💡 Consider adding deployment documentation'}
`);

  const readiness = analyzeDeploymentReadiness(context);
  
  if (readiness.ready) {
    safePrint("✅ Project appears ready for deployment!");
  } else {
    safePrint("⚠️  Issues found:");
    readiness.issues.forEach(issue => safePrint(`   • ${issue}`));
  }
  
  if (readiness.recommendations.length > 0) {
    safePrint("\n💡 Recommendations:");
    readiness.recommendations.forEach(rec => safePrint(`   • ${rec}`));
  }
}

function showHelp() {
  safePrint(`
Welcome to the MCP Deployment Helper!

This tool helps you deploy any project from Claude Code CLI:
- Analyzes your current project structure and requirements
- Checks system prerequisites (Node.js, Git, Vercel CLI)
- Validates environment variables and tokens
- Sets up GitHub SSH authentication
- Provides deployment guidance specific to your project

Works with any Node.js project in any directory!
`);
}

function checkMisplacedFiles() {
  let issues: string[] = [];
  const projectRoot = process.cwd();
  
  function walk(dir: string) {
    try {
      fs.readdirSync(dir).forEach((file) => {
        const resolved = path.join(dir, file);
        if (fs.lstatSync(resolved).isDirectory() && !resolved.includes("node_modules") && !file.startsWith('.')) {
          walk(resolved);
        } else if (!resolved.startsWith(projectRoot)) {
          issues.push(resolved);
        }
      });
    } catch (err) {
      // Skip directories we can't read
    }
  }
  walk(projectRoot);
  return issues;
}

function moveMisplacedFiles(issues: string[]) {
  const projectRoot = process.cwd();
  
  for (const file of issues) {
    try {
      const basename = path.basename(file);
      const dest = path.join(projectRoot, basename);
      fs.renameSync(file, dest);
      safePrint(`Moved ${file} → ${dest}`);
    } catch (err) {
      safePrint(`⚠️  Could not move ${file}: ${err}`);
    }
  }
}

function ensureSSHAgent() {
  if (!checkSSHAgent() || !checkGitHubSSHConnection()) {
    safePrint("🔑 SSH authentication needs setup. Let's fix this...");
    throw new Error("SSH_SETUP_NEEDED");
  }
}

function runGitAll(commitMsg: string) {
  ensureSSHAgent();
  const projectRoot = process.cwd();
  
  try {
    execSync("git add -A", { cwd: projectRoot, stdio: "inherit" });
    execSync("git status --short", { cwd: projectRoot, stdio: "inherit" });
    execSync(`git commit -m "${commitMsg}"`, { cwd: projectRoot, stdio: "inherit" });
    execSync("git push", { cwd: projectRoot, stdio: "inherit" });
    safePrint("✔️ All changes pushed successfully.");
  } catch (err: any) {
    if (err.message === "SSH_SETUP_NEEDED") {
      throw err; // Let the caller handle SSH setup
    }
    safePrint("❌ Git operation failed. Please check the SSH agent or verify remote settings.");
    throw err;
  }
}

function checkSystemForDeployment() {
  safePrint("🔍 Running pre-deployment system check...");
  let issues: string[] = [];
  let warnings: string[] = [];

  // Check Node.js
  try {
    const nodeVersion = execSync("node --version", { encoding: "utf8" }).trim();
    safePrint(`✅ Node.js: ${nodeVersion}`);
  } catch (error) {
    issues.push("Node.js is not installed or not in PATH");
    safePrint("❌ Node.js: Not found");
  }

  // Check npm
  try {
    const npmVersion = execSync("npm --version", { encoding: "utf8" }).trim();
    safePrint(`✅ npm: ${npmVersion}`);
  } catch (error) {
    issues.push("npm is not installed or not in PATH");
    safePrint("❌ npm: Not found");
  }

  // Check npx
  try {
    const npxVersion = execSync("npx --version", { encoding: "utf8" }).trim();
    safePrint(`✅ npx: ${npxVersion}`);
  } catch (error) {
    warnings.push("npx is not available");
    safePrint("⚠️  npx: Not found");
  }

  // Check Vercel CLI
  try {
    const vercelVersion = execSync("vercel --version", { encoding: "utf8" }).trim();
    safePrint(`✅ Vercel CLI: ${vercelVersion}`);
  } catch (error) {
    try {
      const npxVercelVersion = execSync("npx vercel --version", { encoding: "utf8" }).trim();
      safePrint(`✅ Vercel CLI (via npx): ${npxVercelVersion}`);
    } catch (npxError) {
      warnings.push("Vercel CLI is not installed globally or via npx");
      safePrint("⚠️  Vercel CLI: Not found");
    }
  }

  // Check environment variables
  if (process.env.VERCEL_TOKEN) {
    safePrint(`✅ VERCEL_TOKEN: Set (${process.env.VERCEL_TOKEN.substring(0, 8)}...)`);
  } else {
    warnings.push("VERCEL_TOKEN environment variable not set");
    safePrint("⚠️  VERCEL_TOKEN: Not set");
  }

  // Check current directory permissions
  try {
    const stats = fs.statSync(process.cwd());
    if (stats.isDirectory()) {
      safePrint(`✅ Current directory: ${process.cwd()}`);
    }
  } catch (error) {
    issues.push("Cannot access current directory");
    safePrint("❌ Current directory: Access denied");
  }

  // Check package.json
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      safePrint(`✅ package.json: Found (${packageJson.name || 'unnamed'})`);
    } else {
      warnings.push("No package.json found in current directory");
      safePrint("⚠️  package.json: Not found");
    }
  } catch (error) {
    warnings.push("Cannot read package.json");
    safePrint("⚠️  package.json: Cannot read");
  }

  // Summary
  if (issues.length > 0) {
    safePrint("\n❌ Critical issues found:");
    issues.forEach(issue => safePrint(`   • ${issue}`));
    safePrint("\n🔧 Fix these issues before attempting deployment.");
    return false;
  }

  if (warnings.length > 0) {
    safePrint("\n⚠️  Warnings (deployment may still work):");
    warnings.forEach(warning => safePrint(`   • ${warning}`));
  }

  safePrint("\n✅ System appears ready for deployment!");
  return true;
}

function vercelDeploy() {
  // Detect Next.js misconfiguration: API-only build script with Next.js present
  const context = discoverProjectContext();
  const hasNext = context.framework && context.framework.toLowerCase().includes("next");
  const buildScript = context.buildScript || "";
  const apiOnlyBuild = buildScript.trim().startsWith("echo") && buildScript.includes("No build required for API endpoints");

  if (hasNext && apiOnlyBuild) {
    safePrint("\n❌ Detected Next.js in your project, but your build script disables Next.js build (API-only mode).\n");
    safePrint("This will cause Vercel to fail: Next.js expects a build output, but your build script is 'echo ...'.");
    safePrint("\n💡 To fix: Set your build script in package.json to 'next build' or remove the custom build script if you want a full Next.js deployment.\n");
    safePrint("Example:");
    safePrint('  "build": "next build"');
    throw new Error("Next.js misconfiguration: API-only build script with Next.js detected");
  }

  safePrint("🚀 Starting Vercel deployment with enhanced error handling...");
  
  // Strategy 1: Try standard vercel --prod
  try {
    safePrint("📤 Attempting: vercel --prod");
    const deploy = spawnSync("vercel", ["--prod"], { 
      stdio: "inherit",
      env: { 
        ...process.env,
        VERCEL_TOKEN: process.env.VERCEL_TOKEN 
      }
    });
    
    if (deploy.status === 0) {
      safePrint("✅ Vercel deployment successful!");
      return;
    }
    
    safePrint(`⚠️  vercel --prod failed with status ${deploy.status}. Trying alternatives...`);
  } catch (error) {
    safePrint(`⚠️  vercel --prod error: ${error}. Trying alternatives...`);
  }

  // Strategy 2: Try with token parameter
  if (process.env.VERCEL_TOKEN) {
    try {
      safePrint("📤 Attempting: vercel --prod --token [TOKEN]");
      const deployWithToken = spawnSync("vercel", ["--prod", "--token", process.env.VERCEL_TOKEN], { 
        stdio: "inherit" 
      });
      
      if (deployWithToken.status === 0) {
        safePrint("✅ Vercel deployment successful with token!");
        return;
      }
      
      safePrint(`⚠️  vercel with token failed with status ${deployWithToken.status}. Trying npx...`);
    } catch (error) {
      safePrint(`⚠️  vercel with token error: ${error}. Trying npx...`);
    }
  }

  // Strategy 3: Try with npx
  try {
    safePrint("📤 Attempting: npx vercel --prod");
    const npxDeploy = spawnSync("npx", ["vercel", "--prod"], { 
      stdio: "inherit",
      env: { 
        ...process.env,
        VERCEL_TOKEN: process.env.VERCEL_TOKEN 
      }
    });
    
    if (npxDeploy.status === 0) {
      safePrint("✅ Vercel deployment successful with npx!");
      return;
    }
    
    safePrint(`⚠️  npx vercel failed with status ${npxDeploy.status}. Trying manual execution...`);
  } catch (error) {
    safePrint(`⚠️  npx vercel error: ${error}. Trying manual execution...`);
  }

  // Strategy 4: Try with execSync for better error handling
  try {
    safePrint("📤 Attempting: execSync vercel deployment");
    const projectRoot = process.cwd();
    
    if (process.env.VERCEL_TOKEN) {
      execSync(`vercel --prod --token ${process.env.VERCEL_TOKEN} --yes`, { 
        cwd: projectRoot, 
        stdio: "inherit",
        timeout: 300000 // 5 minute timeout
      });
    } else {
      execSync("vercel --prod --yes", { 
        cwd: projectRoot, 
        stdio: "inherit",
        timeout: 300000
      });
    }
    
    safePrint("✅ Vercel deployment successful with execSync!");
    return;
  } catch (error) {
    safePrint(`⚠️  execSync vercel error: ${error}`);
  }

  // Strategy 5: Provide manual instructions
  safePrint("\n❌ All automated deployment strategies failed.");
  safePrint("\n🔧 Manual deployment instructions:");
  safePrint("1. Check if Vercel CLI is installed: npm install -g vercel");
  safePrint("2. Login to Vercel: vercel login");
  safePrint("3. Set your token: export VERCEL_TOKEN=your_token_here");
  safePrint("4. Deploy manually: vercel --prod");
  
  if (process.env.VERCEL_TOKEN) {
    safePrint("\n💡 Try this command manually:");
    safePrint(`vercel --prod --token ${process.env.VERCEL_TOKEN}`);
  }
  
  safePrint("\n🔍 System diagnostics might help identify the issue.");
  
  throw new Error("All Vercel deployment strategies failed - manual intervention required");
}

export async function mcpHelperMenu() {
  showHelp();
mainloop:
  while (true) {
    const resp = await inquirer.prompt([
      {
        name: "action",
        type: "list",
        message: "What would you like to do?",
        choices: [
          { name: "📊 Analyze Current Project", value: "analyze" },
          { name: "📦 Deploy Project (Complete Pipeline)", value: "deploy" },
          { name: "🔧 Fix Deployment Issues", value: "fix-deployment" },
          { name: "👀 Check for misplaced files and fix", value: "fixfiles" },
          { name: "🔐 SSH/GitHub Setup Wizard", value: "ssh-setup" },
          { name: "🏥 System Diagnostics & Setup", value: "diagnostics" },
          { name: "� Help / Troubleshooting Guide", value: "help" },
          { name: "🚪 Exit", value: "exit" }
        ]
      }
    ]);
    switch (resp.action) {
      case "analyze":
        showProjectInfo();
        
        const { generateGuide } = await inquirer.prompt({
          name: "generateGuide",
          type: "confirm",
          message: "Would you like to generate a deployment guide for this project?",
          default: false
        });
        
        if (generateGuide) {
          const context = discoverProjectContext();
          const guide = generateDeploymentGuide(context);
          fs.writeFileSync('DEPLOYMENT-GUIDE.md', guide);
          safePrint("📝 Deployment guide created: DEPLOYMENT-GUIDE.md");
        }
        continue mainloop;
        
      case "deploy":
        try {
          // Run system check first
          safePrint("🔍 Checking system readiness...");
          const systemReady = checkSystemForDeployment();
          
          if (!systemReady) {
            const { continueAnyway } = await inquirer.prompt({
              name: "continueAnyway",
              type: "confirm",
              message: "System check found critical issues. Continue anyway?",
              default: false
            });
            
            if (!continueAnyway) {
              safePrint("💡 Fix the system issues and try again, or run System Diagnostics from the main menu.");
              continue mainloop;
            }
          }

          // Quick system check before deployment
          const prereqCheck = await checkAllPrerequisites();
          const envCheck = await checkEnvironmentVariables();
          
          if (!prereqCheck.criticalPassed) {
            safePrint("⚠️  System prerequisites missing. Running diagnostics...");
            const { runDiag } = await inquirer.prompt({
              name: "runDiag",
              type: "confirm",
              message: "Would you like to run system diagnostics first?",
              default: true
            });
            if (runDiag) {
              await runSystemDiagnostics();
              continue mainloop;
            }
          }

          const misplaced = checkMisplacedFiles();
          if (misplaced.length) {
            safePrint("⚠️  Files found outside your project root: " + misplaced.join(", "));
            const fix = await inquirer.prompt({
              name: "move",
              type: "confirm",
              message: "Move them into your project root?"
            });
            if (fix.move) moveMisplacedFiles(misplaced);
            else continue mainloop;
          }
          
          const { msg } = await inquirer.prompt({
            name: "msg",
            type: "input",
            message: "Enter a commit message:",
            default: "Update via MCP Helper"
          });
          
          try {
            runGitAll(msg);
            vercelDeploy();
            safePrint("🎉 Done! Your changes are live.");
          } catch (e: any) {
            if (e.message === "SSH_SETUP_NEEDED") {
              safePrint("🔐 SSH setup is required for GitHub authentication.");
              const { runSetup } = await inquirer.prompt({
                name: "runSetup",
                type: "confirm",
                message: "Would you like to run the SSH setup wizard now?",
                default: true
              });
              if (runSetup) {
                const success = await sshSetupWizard();
                if (success) {
                  safePrint("✅ SSH setup complete! Let's try deploying again...");
                  try {
                    runGitAll(msg);
                    vercelDeploy();
                    safePrint("🎉 Done! Your changes are live.");
                  } catch (retryErr) {
                    safePrint("🛑 Still having issues. Please check the troubleshooting guide.");
                  }
                }
              } else {
                safePrint("💡 You can run the SSH setup wizard anytime from the main menu.");
              }
            } else if (e.message.includes("All Vercel deployment strategies failed")) {
              safePrint("\n🔧 Deployment failed with all strategies. Possible solutions:");
              safePrint("1. Install Vercel CLI globally: npm install -g vercel");
              safePrint("2. Login to Vercel: vercel login");
              safePrint("3. Check your internet connection");
              safePrint("4. Verify your Vercel token is valid");
              safePrint("5. Try manual deployment outside this tool");
              
              const { tryManualFix } = await inquirer.prompt({
                name: "tryManualFix",
                type: "confirm",
                message: "Would you like to try installing Vercel CLI now?",
                default: true
              });
              
              if (tryManualFix) {
                try {
                  safePrint("🔧 Installing Vercel CLI globally...");
                  execSync("npm install -g vercel", { stdio: "inherit" });
                  safePrint("✅ Vercel CLI installed. Try deployment again.");
                } catch (installError) {
                  safePrint("❌ Failed to install Vercel CLI. Manual installation required.");
                }
              }
            } else {
              throw e; // Re-throw other errors
            }
          }
        } catch (e: any) {
          safePrint("🛑 An error occurred: " + (e instanceof Error ? e.message : String(e)));
        }
        break;
      case "fix-deployment":
        safePrint("🔧 Deployment Issue Fixer");
        safePrint("========================");
        
        // Run comprehensive system check
        const isSystemReady = checkSystemForDeployment();
        
        if (!isSystemReady) {
          const { fixNow } = await inquirer.prompt({
            name: "fixNow",
            type: "confirm",
            message: "Would you like to attempt automatic fixes?",
            default: true
          });
          
          if (fixNow) {
            // Try to install missing tools
            try {
              safePrint("🔧 Attempting to install Vercel CLI...");
              execSync("npm install -g vercel", { stdio: "inherit" });
              safePrint("✅ Vercel CLI installed successfully");
            } catch (error) {
              safePrint("❌ Failed to install Vercel CLI automatically");
              safePrint("💡 Try manually: npm install -g vercel");
            }
            
            // Re-check system
            safePrint("\n🔍 Re-checking system...");
            checkSystemForDeployment();
          }
        }
        
        // Test Vercel connectivity
        safePrint("\n🌐 Testing Vercel connectivity...");
        try {
          if (process.env.VERCEL_TOKEN) {
            execSync(`vercel whoami --token ${process.env.VERCEL_TOKEN}`, { stdio: "inherit" });
            safePrint("✅ Vercel authentication successful");
          } else {
            execSync("vercel whoami", { stdio: "inherit" });
            safePrint("✅ Vercel authentication successful");
          }
        } catch (error) {
          safePrint("❌ Vercel authentication failed");
          safePrint("💡 Try: vercel login");
          
          const { tryLogin } = await inquirer.prompt({
            name: "tryLogin",
            type: "confirm",
            message: "Would you like to try logging in to Vercel now?",
            default: true
          });
          
          if (tryLogin) {
            try {
              execSync("vercel login", { stdio: "inherit" });
              safePrint("✅ Vercel login completed");
            } catch (loginError) {
              safePrint("❌ Vercel login failed");
            }
          }
        }
        
        // Provide manual fix instructions
        safePrint("\n📋 Manual Fix Checklist:");
        safePrint("1. ✓ Install Node.js 18+ from nodejs.org");
        safePrint("2. ✓ Install Vercel CLI: npm install -g vercel");
        safePrint("3. ✓ Login to Vercel: vercel login");
        safePrint("4. ✓ Set environment: export VERCEL_TOKEN=your_token");
        safePrint("5. ✓ Test deployment: vercel --prod");
        
        break;
      case "ssh-setup":
        await sshSetupWizard();
        break;
      case "diagnostics":
        await runSystemDiagnostics();
        break;
      case "fixfiles":
        const issues = checkMisplacedFiles();
        if (!issues.length) safePrint("✅ No misplaced files found!");
        else {
          safePrint("Found misplaced files:\n" + issues.join("\n"));
          const r = await inquirer.prompt({
            name: "move",
            type: "confirm",
            message: "Move these files to your project root?"
          });
          if (r.move) moveMisplacedFiles(issues);
        }
        break;
      case "help":
        showHelp();
        safePrint(`
Common Problems:
- "git" errors: Are you connected to WiFi? Is your SSH key/agent ready?
- "Vercel" errors: Run 'vercel login' or check that your Vercel token is valid.
- Misplaced files: Use option [Check for misplaced files and fix] to recover orphaned code.
- SSH/GitHub issues: Use the SSH Setup Wizard to generate keys and connect to GitHub.
- System issues: Use System Diagnostics to check Node.js, dependencies, and environment variables.

Quick SSH Check:
- Run the SSH Setup Wizard from the main menu
- It will detect missing keys, generate them, and guide you through GitHub setup
- No technical knowledge required - just follow the step-by-step instructions

System Requirements:
- Node.js 18+, Git, Vercel CLI
- Proper environment variables (.env file)
- SSH keys for GitHub authentication

For more FAQ, see CONTRIBUTING.md and README.md.
`);
        break;
      case "exit":
        break mainloop;
    }
  }
}
