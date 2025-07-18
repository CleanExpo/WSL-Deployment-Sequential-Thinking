import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import inquirer from "inquirer";

interface PrerequisiteCheck {
  name: string;
  description: string;
  check: () => boolean;
  fix?: () => Promise<boolean>;
  instructions: string[];
  critical: boolean;
}

interface EnvironmentVariable {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string;
  validation?: (value: string) => boolean;
  instructions: string[];
}

function safePrint(msg: string) {
  process.stdout.write(msg + "\n");
}

export function isWSL(): boolean {
  try {
    // Check for WSL-specific indicators
    const release = fs.readFileSync('/proc/version', 'utf8').toLowerCase();
    return release.includes('microsoft') || release.includes('wsl');
  } catch {
    return false;
  }
}

export function isUbuntu(): boolean {
  try {
    if (os.platform() === 'linux') {
      const release = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase();
      return release.includes('ubuntu');
    }
    return false;
  } catch {
    return false;
  }
}

export function checkNodeVersion(): boolean {
  try {
    const version = process.version;
    const majorVersion = parseInt(version.slice(1).split('.')[0]);
    return majorVersion >= 18;
  } catch {
    return false;
  }
}

export function checkGitInstalled(): boolean {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function checkVercelCLI(): boolean {
  try {
    execSync("vercel --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function checkVercelAuth(): boolean {
  try {
    const result = execSync("vercel whoami", { stdio: "pipe", encoding: "utf-8" });
    return !result.includes("Not logged in");
  } catch {
    return false;
  }
}

export function checkWSLEnvironment(): boolean {
  return fs.existsSync("/proc/version") && 
         fs.readFileSync("/proc/version", "utf-8").toLowerCase().includes("microsoft");
}

export function checkWSLConfiguration(): boolean {
  if (!isWSL()) return true;
  
  try {
    // Check if git is configured properly in WSL
    execSync("git config --global user.name", { stdio: "pipe" });
    execSync("git config --global user.email", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function checkEnvFile(): boolean {
  return fs.existsSync(".env") || fs.existsSync(".env.local");
}

export function checkGitRepository(): boolean {
  return fs.existsSync(".git");
}

const ENVIRONMENT_VARIABLES: EnvironmentVariable[] = [
  {
    name: "NODE_ENV",
    description: "Node.js environment (development, production, etc.)",
    required: false,
    defaultValue: "development",
    instructions: ["Set to 'development' for local work, 'production' for live deployment"]
  },
  {
    name: "PORT",
    description: "Port number for the MCP server",
    required: false,
    defaultValue: "3000",
    validation: (value) => !isNaN(parseInt(value)) && parseInt(value) > 0,
    instructions: ["Use any available port number (default: 3000)"]
  },
  {
    name: "VERCEL_TOKEN",
    description: "Vercel API token for deployments (CRITICAL for Claude Code CLI)",
    required: true,
    validation: (value) => value.length > 20 && value.startsWith('vercel_'),
    instructions: [
      "🔑 REQUIRED for deployment from Claude Code CLI:",
      "1. Go to https://vercel.com/account/tokens",
      "2. Click 'Create Token'",
      "3. Name it 'Claude-CLI-Token'", 
      "4. Set expiration (recommend 'No Expiration' for development)",
      "5. Copy the token (starts with 'vercel_')",
      "6. Paste it here",
      "",
      "⚠️  WSL/Ubuntu Note: Token must be set in .env file",
      "💡 Alternative: Run 'vercel login' first, then set token"
    ]
  },
  {
    name: "VERCEL_ORG_ID",
    description: "Vercel organization ID (recommended for team projects)",
    required: false,
    validation: (value) => !value || value.startsWith('team_') || value.startsWith('user_'),
    instructions: [
      "1. Run 'vercel' in your project directory",
      "2. Look for 'org_' or 'team_' in the output",
      "3. Copy the organization ID",
      "4. Or leave empty for personal account"
    ]
  },
  {
    name: "VERCEL_PROJECT_ID", 
    description: "Vercel project ID (speeds up deployments)",
    required: false,
    validation: (value) => !value || value.startsWith('prj_'),
    instructions: [
      "1. Run 'vercel' in your project directory first time", 
      "2. Look for 'prj_' in the output",
      "3. Copy the project ID",
      "4. Or leave empty for auto-detection"
    ]
  },
  {
    name: "GITHUB_TOKEN",
    description: "GitHub personal access token (CRITICAL for SSH issues)",
    required: false,
    validation: (value) => !value || (value.length >= 40 && (value.startsWith('ghp_') || value.startsWith('github_pat_'))),
    instructions: [
      "🔑 HIGHLY RECOMMENDED for WSL/Ubuntu deployment:",
      "1. Go to https://github.com/settings/tokens",
      "2. Click 'Generate new token (classic)'",
      "3. Select scopes: 'repo', 'workflow', 'write:packages'",
      "4. Set expiration (90 days recommended)",
      "5. Copy the token (starts with 'ghp_')",
      "6. Paste it here",
      "",
      "🚀 This enables HTTPS fallback when SSH fails",
      "💡 Especially important in WSL environments"
    ]
  }
];

const PREREQUISITES: PrerequisiteCheck[] = [
  {
    name: "Node.js 18+",
    description: "Node.js version 18 or higher",
    check: checkNodeVersion,
    instructions: [
      "Install Node.js 18+ from https://nodejs.org",
      "WSL/Ubuntu: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -",
      "Then: sudo apt-get install -y nodejs",
      "Or use nvm: nvm install 18 && nvm use 18"
    ],
    critical: true
  },
  {
    name: "Git",
    description: "Git version control system",
    check: checkGitInstalled,
    fix: async () => {
      if (isUbuntu()) {
        try {
          execSync("sudo apt update && sudo apt install -y git", { stdio: "inherit" });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    instructions: [
      "Ubuntu/WSL: sudo apt update && sudo apt install -y git",
      "Or install from: https://git-scm.com",
      "Verify with: git --version"
    ],
    critical: true
  },
  {
    name: "Git Repository",
    description: "Project is in a Git repository",
    check: checkGitRepository,
    fix: async () => {
      try {
        execSync("git init", { stdio: "inherit" });
        return true;
      } catch {
        return false;
      }
    },
    instructions: [
      "Initialize Git: git init",
      "Add remote: git remote add origin YOUR_GITHUB_URL",
      "💡 Make sure you have SSH keys setup for GitHub"
    ],
    critical: true
  },
  {
    name: "Vercel CLI",
    description: "Vercel command-line interface",
    check: checkVercelCLI,
    fix: async () => {
      try {
        safePrint("📦 Installing Vercel CLI globally...");
        execSync("npm install -g vercel", { stdio: "inherit" });
        return checkVercelCLI();
      } catch {
        return false;
      }
    },
    instructions: [
      "Install: npm install -g vercel",
      "WSL/Ubuntu may need: sudo npm install -g vercel",
      "Verify with: vercel --version"
    ],
    critical: false
  },
  {
    name: "Vercel Authentication",
    description: "Logged into Vercel CLI",
    check: checkVercelAuth,
    fix: async () => {
      try {
        safePrint("🔐 Starting Vercel authentication...");
        execSync("vercel login", { stdio: "inherit" });
        return checkVercelAuth();
      } catch {
        return false;
      }
    },
    instructions: [
      "Run: vercel login",
      "Choose your preferred authentication method",
      "💡 Email/password or GitHub OAuth recommended for WSL"
    ],
    critical: false
  },
  {
    name: "WSL Environment Check",
    description: "WSL-specific configuration validation",
    check: () => !isWSL() || checkWSLConfiguration(),
    instructions: [
      "Ensure WSL2 is being used (not WSL1)",
      "Check: wsl --list --verbose",
      "Upgrade if needed: wsl --set-version <distro> 2"
    ],
    critical: false
  }
];

export async function checkAllPrerequisites(): Promise<{ 
  allPassed: boolean; 
  criticalPassed: boolean;
  issues: string[];
  results: { [key: string]: { success: boolean; critical: boolean; message?: string } }
}> {
  const issues: string[] = [];
  const results: { [key: string]: { success: boolean; critical: boolean; message?: string } } = {};
  let criticalIssues = 0;
  let totalIssues = 0;

  safePrint("🔍 Checking system prerequisites...\n");
  
  // Special WSL/Ubuntu detection
  if (isWSL()) {
    safePrint("🐧 WSL environment detected");
  }
  if (isUbuntu()) {
    safePrint("🐧 Ubuntu system detected");
  }

  for (const prereq of PREREQUISITES) {
    try {
      const passed = prereq.check();
      const status = passed ? "✅" : (prereq.critical ? "❌" : "⚠️ ");
      safePrint(`${status} ${prereq.name}: ${prereq.description}`);
      
      results[prereq.name.toLowerCase().replace(/[^a-z0-9]/g, '')] = {
        success: passed,
        critical: prereq.critical,
        message: passed ? undefined : prereq.instructions.join("; ")
      };
      
      if (!passed) {
        totalIssues++;
        if (prereq.critical) criticalIssues++;
        issues.push(`${prereq.name}: ${prereq.instructions.join(", ")}`);
      }
    } catch (error: any) {
      safePrint(`⚠️  ${prereq.name}: Check failed - ${error.message}`);
      results[prereq.name.toLowerCase().replace(/[^a-z0-9]/g, '')] = {
        success: false,
        critical: prereq.critical,
        message: `Check failed: ${error.message}`
      };
      totalIssues++;
      if (prereq.critical) criticalIssues++;
    }
  }

  safePrint(`\n📊 Summary: ${PREREQUISITES.length - totalIssues}/${PREREQUISITES.length} checks passed`);
  
  if (criticalIssues > 0) {
    safePrint(`❌ ${criticalIssues} critical issues must be resolved`);
  }
  
  if (totalIssues > criticalIssues) {
    safePrint(`⚠️  ${totalIssues - criticalIssues} optional improvements available`);
  }

  return { 
    allPassed: totalIssues === 0,
    criticalPassed: criticalIssues === 0, 
    issues,
    results
  };
}

export async function fixPrerequisites(): Promise<boolean> {
  const fixablePrereqs = PREREQUISITES.filter(p => p.fix && !p.check());
  
  if (fixablePrereqs.length === 0) {
    safePrint("✅ No automatically fixable issues found.");
    return true;
  }

  safePrint(`\n🔧 Found ${fixablePrereqs.length} issues that can be automatically fixed:`);
  
  for (const prereq of fixablePrereqs) {
    safePrint(`   • ${prereq.name}`);
  }

  const { shouldFix } = await inquirer.prompt({
    name: "shouldFix",
    type: "confirm",
    message: "Would you like to automatically fix these issues?",
    default: true
  });

  if (!shouldFix) return false;

  let allFixed = true;
  for (const prereq of fixablePrereqs) {
    safePrint(`\n🔧 Fixing: ${prereq.name}...`);
    try {
      const fixed = await prereq.fix!();
      if (fixed) {
        safePrint(`✅ Fixed: ${prereq.name}`);
      } else {
        safePrint(`❌ Failed to fix: ${prereq.name}`);
        allFixed = false;
      }
    } catch (error) {
      safePrint(`❌ Error fixing ${prereq.name}: ${error}`);
      allFixed = false;
    }
  }

  return allFixed;
}

export function readEnvFile(): Record<string, string> {
  const envFiles = [".env", ".env.local"];
  const envVars: Record<string, string> = {};

  for (const envFile of envFiles) {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf-8");
      const lines = content.split("\n");
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          if (key && valueParts.length > 0) {
            envVars[key] = valueParts.join("=");
          }
        }
      }
      break; // Use first found env file
    }
  }

  return envVars;
}

export async function checkEnvironmentVariables(): Promise<{ passed: boolean; missing: EnvironmentVariable[] }> {
  const envVars = readEnvFile();
  const missing: EnvironmentVariable[] = [];

  safePrint("\n🌍 Checking environment variables...\n");

  for (const envVar of ENVIRONMENT_VARIABLES) {
    const value = envVars[envVar.name] || process.env[envVar.name];
    const hasValue = value !== undefined && value !== "";
    const status = hasValue ? "✅" : (envVar.required ? "❌" : "⚠️ ");
    
    safePrint(`${status} ${envVar.name}: ${envVar.description}`);
    
    if (!hasValue && envVar.required) {
      missing.push(envVar);
    } else if (!hasValue) {
      safePrint(`     Optional - can be set for enhanced functionality`);
    } else if (envVar.validation && !envVar.validation(value)) {
      safePrint(`     ⚠️  Current value may be invalid`);
      missing.push(envVar);
    }
  }

  return { passed: missing.filter(v => v.required).length === 0, missing };
}

export async function setupEnvironmentVariables(): Promise<boolean> {
  const { missing } = await checkEnvironmentVariables();
  
  if (missing.length === 0) {
    safePrint("✅ All environment variables are properly configured.");
    return true;
  }

  safePrint(`\n⚙️  Setting up ${missing.length} environment variables...\n`);

  const envVars = readEnvFile();
  let hasChanges = false;

  for (const envVar of missing) {
    safePrint(`\n📝 ${envVar.name}: ${envVar.description}`);
    safePrint("Instructions:");
    envVar.instructions.forEach((instruction, i) => {
      safePrint(`   ${i + 1}. ${instruction}`);
    });

    const { value } = await inquirer.prompt({
      name: "value",
      type: envVar.name.toLowerCase().includes("token") ? "password" : "input",
      message: `Enter value for ${envVar.name}:`,
      default: envVar.defaultValue,
      validate: (input: string) => {
        if (envVar.required && !input.trim()) {
          return "This variable is required";
        }
        if (envVar.validation && input.trim() && !envVar.validation(input)) {
          return "Invalid value format";
        }
        return true;
      }
    });

    if (value && value.trim()) {
      envVars[envVar.name] = value.trim();
      hasChanges = true;
    }
  }

  if (hasChanges) {
    const envContent = Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n";

    fs.writeFileSync(".env", envContent);
    safePrint("\n✅ Environment variables saved to .env file");
  }

  return true;
}

export async function runSystemDiagnostics(): Promise<boolean> {
  safePrint(`
🏥 System Diagnostics for WSL MCP Deployment

This will check all requirements for successful deployment:
- System prerequisites (Node.js, Git, Vercel CLI)
- Environment variables and configuration
- GitHub SSH authentication
- WSL compatibility

`);

  // Check prerequisites
  const prereqResult = await checkAllPrerequisites();
  
  if (!prereqResult.criticalPassed) {
    safePrint("\n❌ Critical issues found with system prerequisites:");
    prereqResult.issues.forEach(issue => safePrint(`   • ${issue}`));
    
    const { fixNow } = await inquirer.prompt({
      name: "fixNow",
      type: "confirm", 
      message: "Would you like to attempt automatic fixes?",
      default: true
    });

    if (fixNow) {
      await fixPrerequisites();
    }
  }

  // Check environment variables
  const envResult = await checkEnvironmentVariables();
  
  if (!envResult.passed || envResult.missing.length > 0) {
    const { setupEnv } = await inquirer.prompt({
      name: "setupEnv",
      type: "confirm",
      message: "Would you like to configure environment variables now?",
      default: true
    });

    if (setupEnv) {
      await setupEnvironmentVariables();
    }
  }

  // Final status
  const finalPrereqCheck = await checkAllPrerequisites();
  const finalEnvCheck = await checkEnvironmentVariables();
  
  if (finalPrereqCheck.criticalPassed && finalEnvCheck.passed) {
    safePrint("\n🎉 All systems ready! Your MCP deployment environment is properly configured.");
    return true;
  } else {
    safePrint("\n⚠️  Some issues remain. Check the output above for manual resolution steps.");
    return false;
  }
}
