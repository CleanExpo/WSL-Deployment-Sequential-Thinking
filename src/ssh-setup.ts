import { execSync, spawnSync } from "child_process";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import os from "os";

function safePrint(msg: string) {
  process.stdout.write(msg + "\n");
}

export function checkSSHKeyExists(): boolean {
  const sshDir = path.join(os.homedir(), ".ssh");
  const keyPaths = [
    path.join(sshDir, "id_rsa"),
    path.join(sshDir, "id_ed25519"),
    path.join(sshDir, "id_ecdsa")
  ];
  
  return keyPaths.some(keyPath => fs.existsSync(keyPath));
}

export function checkSSHAgent(): boolean {
  try {
    execSync("ssh-add -l", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function checkGitHubSSHConnection(): { success: boolean; message?: string } {
  try {
    const result = execSync("ssh -T git@github.com", { 
      stdio: "pipe", 
      timeout: 10000,
      encoding: "utf-8"
    });
    if (result.includes("successfully authenticated")) {
      return { success: true };
    }
    return { success: false, message: "Authentication response not recognized" };
  } catch (error: any) {
    // GitHub SSH returns exit code 1 even on successful auth
    if (error.stdout && error.stdout.includes("successfully authenticated")) {
      return { success: true };
    }
    return { 
      success: false, 
      message: error.stderr || error.message || "SSH connection failed" 
    };
  }
}

export async function sshSetupWizard() {
  safePrint(`
🔐 SSH Key Setup Wizard for GitHub

This wizard will help you set up SSH authentication with GitHub.
SSH keys are more secure than passwords and work better with automation.
`);

  const hasKey = checkSSHKeyExists();
  const hasAgent = checkSSHAgent();
  const hasGitHubConnection = checkGitHubSSHConnection();

  if (hasKey && hasAgent && hasGitHubConnection) {
    safePrint("✅ SSH is already properly configured! You're all set.");
    return true;
  }

  safePrint("🔍 Checking your SSH setup...");
  safePrint(`   SSH Key exists: ${hasKey ? "✅" : "❌"}`);
  safePrint(`   SSH Agent running: ${hasAgent ? "✅" : "❌"}`);
  safePrint(`   GitHub connection: ${hasGitHubConnection ? "✅" : "❌"}`);

  // Step 1: Generate SSH key if needed
  if (!hasKey) {
    const { generateKey } = await inquirer.prompt({
      name: "generateKey",
      type: "confirm",
      message: "No SSH key found. Would you like to generate one now?",
      default: true
    });

    if (!generateKey) {
      safePrint("❌ SSH key is required for GitHub authentication. Exiting wizard.");
      return false;
    }

    const { email } = await inquirer.prompt({
      name: "email",
      type: "input",
      message: "Enter your GitHub email address:",
      validate: (input) => input.includes("@") || "Please enter a valid email address"
    });

    try {
      safePrint("🔑 Generating SSH key...");
      execSync(`ssh-keygen -t ed25519 -C "${email}" -f ~/.ssh/id_ed25519 -N ""`, { stdio: "inherit" });
      safePrint("✅ SSH key generated successfully!");
    } catch (error) {
      safePrint("❌ Failed to generate SSH key. Please try manually with:");
      safePrint(`   ssh-keygen -t ed25519 -C "${email}"`);
      return false;
    }
  }

  // Step 2: Start SSH agent and add key
  if (!hasAgent) {
    try {
      safePrint("🚀 Starting SSH agent and adding key...");
      execSync('eval "$(ssh-agent -s)"', { stdio: "inherit" });
      
      // Find the key file
      const sshDir = path.join(os.homedir(), ".ssh");
      let keyFile = "";
      const keyFiles = ["id_ed25519", "id_rsa", "id_ecdsa"];
      
      for (const file of keyFiles) {
        const fullPath = path.join(sshDir, file);
        if (fs.existsSync(fullPath)) {
          keyFile = fullPath;
          break;
        }
      }

      if (keyFile) {
        execSync(`ssh-add ${keyFile}`, { stdio: "inherit" });
        safePrint("✅ SSH key added to agent!");
      }
    } catch (error) {
      safePrint("⚠️  SSH agent setup needs manual intervention. Please run:");
      safePrint('   eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519');
    }
  }

  // Step 3: Guide user to add public key to GitHub
  if (!hasGitHubConnection) {
    const sshDir = path.join(os.homedir(), ".ssh");
    let publicKeyFile = "";
    const pubKeyFiles = ["id_ed25519.pub", "id_rsa.pub", "id_ecdsa.pub"];
    
    for (const file of pubKeyFiles) {
      const fullPath = path.join(sshDir, file);
      if (fs.existsSync(fullPath)) {
        publicKeyFile = fullPath;
        break;
      }
    }

    if (publicKeyFile) {
      const publicKey = fs.readFileSync(publicKeyFile, "utf-8").trim();
      
      safePrint(`
📋 Your public SSH key (copy this to GitHub):

${publicKey}

🌐 Steps to add this key to GitHub:
1. Go to: https://github.com/settings/ssh/new
2. Give it a title like: "WSL MCP Deployment Key"
3. Paste the key above into the "Key" field
4. Click "Add SSH key"
`);

      const { keyAdded } = await inquirer.prompt({
        name: "keyAdded",
        type: "confirm",
        message: "Have you added the key to GitHub?",
        default: false
      });

      if (keyAdded) {
        safePrint("🧪 Testing GitHub connection...");
        if (checkGitHubSSHConnection()) {
          safePrint("🎉 Success! GitHub SSH connection is working!");
          
          // Update git remote to use SSH
          try {
            const currentRemote = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
            if (currentRemote.includes("https://")) {
              const sshUrl = currentRemote
                .replace("https://github.com/", "git@github.com:")
                .replace(".git", "") + ".git";
              
              execSync(`git remote set-url origin ${sshUrl}`, { stdio: "inherit" });
              safePrint(`✅ Updated git remote to use SSH: ${sshUrl}`);
            }
          } catch (error) {
            safePrint("⚠️  Could not update git remote. You may need to run:");
            safePrint("   git remote set-url origin git@github.com:CleanExpo/WSL-Deployment-Sequential-Thinking.git");
          }
          
          return true;
        } else {
          safePrint("❌ GitHub connection still not working. Please check:");
          safePrint("   1. Key was added correctly to GitHub");
          safePrint("   2. SSH agent is running: ssh-add -l");
          safePrint("   3. Test manually: ssh -T git@github.com");
          return false;
        }
      }
    }
  }

  return false;
}

export async function quickSSHFix() {
  safePrint("🔧 Quick SSH troubleshooting...");
  
  if (!checkSSHKeyExists()) {
    safePrint("❌ No SSH key found. Run the full SSH setup wizard.");
    return false;
  }
  
  if (!checkSSHAgent()) {
    safePrint("🔄 Attempting to start SSH agent...");
    try {
      execSync('eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_*', { stdio: "inherit" });
      safePrint("✅ SSH agent started and key added!");
    } catch (error) {
      safePrint("❌ Manual intervention needed. Run:");
      safePrint('   eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_rsa');
      return false;
    }
  }
  
  if (!checkGitHubSSHConnection()) {
    safePrint("❌ GitHub connection failed. You may need to:");
    safePrint("   1. Add your public key to GitHub");
    safePrint("   2. Run the full SSH setup wizard");
    return false;
  }
  
  safePrint("✅ SSH is working correctly!");
  return true;
}
