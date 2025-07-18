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

function vercelDeploy() {
  const deploy = spawnSync("vercel", ["--prod"], { stdio: "inherit" });
  if (deploy.status !== 0) {
    safePrint("❌ Vercel deploy failed. Double-check login or token.");
    throw new Error("Vercel deploy error");
  }
  safePrint("🌍 Site deploy triggered on Vercel!");
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
          { name: "� Analyze Current Project", value: "analyze" },
          { name: "📦 Deploy Project (Complete Pipeline)", value: "deploy" },
          { name: "👀 Check for misplaced files and fix", value: "fixfiles" },
          { name: "🔐 SSH/GitHub Setup Wizard", value: "ssh-setup" },
          { name: "🏥 System Diagnostics & Setup", value: "diagnostics" },
          { name: "🔧 Help / Troubleshooting Guide", value: "help" },
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
            } else {
              throw e; // Re-throw other errors
            }
          }
        } catch (e: any) {
          safePrint("🛑 An error occurred: " + (e instanceof Error ? e.message : String(e)));
        }
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
