import inquirer from "inquirer";
import path from "path";
import fs from "fs";
import { execSync, spawnSync } from "child_process";
import { sshSetupWizard, quickSSHFix, checkSSHAgent, checkGitHubSSHConnection } from "./ssh-setup.js";
import { runSystemDiagnostics, checkAllPrerequisites, checkEnvironmentVariables } from "./system-check.js";

const PROJECT_ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();

function safePrint(msg: string) {
  process.stdout.write(msg + "\n");
}

function showHelp() {
  safePrint(`
Welcome to the MCP Deployment Helper!

This tool automates common steps:
- Adds/saves code changes
- Commits to git
- Pushes to GitHub (checks for SSH)
- Launches your Vercel deploy with visible logs
- Detects misplaced files
- Checks system prerequisites and environment variables

Anything goes wrong, you'll get plain-English help.
`);
}

function checkMisplacedFiles() {
  let issues: string[] = [];
  function walk(dir: string) {
    try {
      fs.readdirSync(dir).forEach((file) => {
        const resolved = path.join(dir, file);
        if (fs.lstatSync(resolved).isDirectory() && !resolved.includes("node_modules") && !file.startsWith('.')) {
          walk(resolved);
        } else if (!resolved.startsWith(PROJECT_ROOT)) {
          issues.push(resolved);
        }
      });
    } catch (err) {
      // Skip directories we can't read
    }
  }
  walk(PROJECT_ROOT);
  return issues;
}

function moveMisplacedFiles(issues: string[]) {
  for (const file of issues) {
    try {
      const basename = path.basename(file);
      const dest = path.join(PROJECT_ROOT, basename);
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
  try {
    execSync("git add -A", { cwd: PROJECT_ROOT, stdio: "inherit" });
    execSync("git status --short", { cwd: PROJECT_ROOT, stdio: "inherit" });
    execSync(`git commit -m "${commitMsg}"`, { cwd: PROJECT_ROOT, stdio: "inherit" });
    execSync("git push", { cwd: PROJECT_ROOT, stdio: "inherit" });
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
          { name: "📦 Publish My Changes Online (Commit, Push, and Deploy)", value: "deploy" },
          { name: "👀 Check for misplaced files and fix", value: "fixfiles" },
          { name: "🔐 SSH/GitHub Setup Wizard", value: "ssh-setup" },
          { name: "🏥 System Diagnostics & Setup", value: "diagnostics" },
          { name: "🔧 Help / Troubleshooting Guide", value: "help" },
          { name: "🚪 Exit", value: "exit" }
        ]
      }
    ]);
    switch (resp.action) {
      case "deploy":
        try {
          // Quick system check before deployment
          const prereqCheck = await checkAllPrerequisites();
          const envCheck = await checkEnvironmentVariables();
          
          if (!prereqCheck.passed) {
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
