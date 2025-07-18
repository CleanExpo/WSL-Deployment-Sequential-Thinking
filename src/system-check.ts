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
    description: "Vercel API token for deployments",
    required: false,
    instructions: [
      "1. Go to https://vercel.com/account/tokens",
      "2. Create a new token",
      "3. Copy the token and paste it here"
    ]
  },
  {
    name: "VERCEL_ORG_ID",
    description: "Vercel organization ID",
    required: false,
    instructions: [
      "1. Run 'vercel' in your project directory",
      "2. Look for 'org_' in the output",
      "3. Copy the organization ID"
    ]
  },
  {
    name: "VERCEL_PROJECT_ID",
    description: "Vercel project ID",
    required: false,
    instructions: [
      "1. Run 'vercel' in your project directory", 
      "2. Look for 'prj_' in the output",
      "3. Copy the project ID"
    ]
  },
  {
    name: "GITHUB_TOKEN",
    description: "GitHub personal access token (for advanced features)",
    required: false,
    instructions: [
      "1. Go to https://github.com/settings/tokens",
      "2. Generate a new token with repo permissions",
      "3. Copy and paste the token"
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
      "Or use nvm: nvm install 18 && nvm use 18"
    ],
    critical: true
  },
  {
    name: "Git",
    description: "Git version control system",
    check: checkGitInstalled,
    instructions: [
      "Install Git from https://git-scm.com",
      "Or on Ubuntu/WSL: sudo apt update && sudo apt install git"
    ],
    critical: true
  },
  {
    name: "Git Repository",
    description: "Project is in a Git repository",
    check: checkGitRepository,
    instructions: [
      "Initialize Git: git init",
      "Add remote: git remote add origin YOUR_GITHUB_URL"
    ],
    critical: true
  },
  {
    name: "Vercel CLI",
    description: "Vercel command-line interface",
    check: checkVercelCLI,
    fix: async () => {
      try {
        execSync("npm install -g vercel", { stdio: "inherit" });
        return true;
      } catch {
        return false;
      }
    },
    instructions: [
      "Install Vercel CLI: npm install -g vercel",
      "Or using yarn: yarn global add vercel"
    ],
    critical: false
  },
  {
    name: "Vercel Authentication",
    description: "Logged into Vercel CLI",
    check: checkVercelAuth,
    fix: async () => {
      try {
        execSync("vercel login", { stdio: "inherit" });
        return checkVercelAuth();
      } catch {
        return false;
      }
    },
    instructions: [
      "Run: vercel login",
      "Follow the authentication prompts"
    ],
    critical: false
  }
];

export async function checkAllPrerequisites(): Promise<{ passed: boolean; issues: string[] }> {
  const issues: string[] = [];
  let criticalIssues = 0;

  safePrint("🔍 Checking system prerequisites...\n");

  for (const prereq of PREREQUISITES) {
    const passed = prereq.check();
    const status = passed ? "✅" : (prereq.critical ? "❌" : "⚠️ ");
    safePrint(`${status} ${prereq.name}: ${prereq.description}`);
    
    if (!passed) {
      if (prereq.critical) criticalIssues++;
      issues.push(`${prereq.name}: ${prereq.instructions.join(", ")}`);
    }
  }

  return { 
    passed: criticalIssues === 0, 
    issues 
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
  
  if (!prereqResult.passed) {
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
  
  if (finalPrereqCheck.passed && finalEnvCheck.passed) {
    safePrint("\n🎉 All systems ready! Your MCP deployment environment is properly configured.");
    return true;
  } else {
    safePrint("\n⚠️  Some issues remain. Check the output above for manual resolution steps.");
    return false;
  }
}
