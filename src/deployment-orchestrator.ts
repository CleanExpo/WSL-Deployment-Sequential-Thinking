import { execSync, spawn } from "child_process";
import { checkAllPrerequisites, setupEnvironmentVariables } from "./system-check.js";
import { sshSetupWizard, checkGitHubSSHConnection } from "./ssh-setup.js";
import { gitStageCommitPush } from "./git-helper.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export interface DeploymentConfig {
  skipChecks?: boolean;
  autoFix?: boolean;
  commitMessage?: string;
  forceSSHSetup?: boolean;
}

export class DeploymentOrchestrator {
  private projectRoot: string;
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig = {}) {
    this.projectRoot = process.cwd();
    this.config = {
      skipChecks: false,
      autoFix: true,
      commitMessage: "Auto deployment from Claude Code CLI",
      forceSSHSetup: false,
      ...config
    };
  }

  /**
   * Main deployment pipeline that mimics `vercel --prod` but with comprehensive checks
   */
  async runSeamlessDeployment(): Promise<void> {
    console.log("🚀 Starting seamless deployment pipeline...");
    console.log("📍 Working directory:", this.projectRoot);

    try {
      // Step 1: Pre-deployment checks
      if (!this.config.skipChecks) {
        await this.runPreDeploymentChecks();
      }

      // Step 2: Ensure GitHub connection
      await this.ensureGitHubConnection();

      // Step 3: Commit and push changes
      await this.commitAndPushChanges();

      // Step 4: Deploy to Vercel
      await this.deployToVercel();

      console.log("✅ Seamless deployment completed successfully!");
      console.log("🌐 Your application should be live on Vercel");

    } catch (error: any) {
      console.error("❌ Deployment failed:", error.message);
      await this.handleDeploymentError(error);
      throw error;
    }
  }

  /**
   * Run comprehensive pre-deployment checks
   */
  private async runPreDeploymentChecks(): Promise<void> {
    console.log("🔍 Running pre-deployment checks...");

    // Check system prerequisites
    const prereqResults = await checkAllPrerequisites();
    if (!prereqResults.allPassed) {
      if (this.config.autoFix) {
        console.log("🔧 Attempting to fix missing prerequisites...");
        // Auto-install missing tools if possible
        await this.autoFixPrerequisites(prereqResults);
      } else {
        throw new Error("Prerequisites not met. Run system diagnostics first.");
      }
    }

    // Check and setup environment variables
    await this.ensureEnvironmentVariables();

    // Verify project structure
    this.verifyProjectStructure();

    console.log("✅ Pre-deployment checks passed");
  }

  /**
   * Ensure all required environment variables are present
   */
  private async ensureEnvironmentVariables(): Promise<void> {
    console.log("🔐 Checking environment variables...");

    const requiredVars = ['VERCEL_TOKEN'];
    const optionalVars = ['VERCEL_PROJECT_ID', 'VERCEL_ORG_ID', 'GITHUB_TOKEN'];
    
    const missing: string[] = [];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missing.push(varName);
      }
    }

    if (missing.length > 0) {
      console.log(`⚠️  Missing required environment variables: ${missing.join(', ')}`);
      
      if (this.config.autoFix) {
        console.log("🔧 Starting interactive environment setup...");
        await setupEnvironmentVariables();
        
        // Reload environment after setup
        dotenv.config();
        
        // Verify again
        for (const varName of missing) {
          if (!process.env[varName]) {
            throw new Error(`Failed to set required environment variable: ${varName}`);
          }
        }
      } else {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
      }
    }

    // Check optional variables and warn
    const missingOptional = optionalVars.filter(v => !process.env[v]);
    if (missingOptional.length > 0) {
      console.log(`ℹ️  Optional environment variables not set: ${missingOptional.join(', ')}`);
      console.log("   These may improve deployment experience but are not required");
    }

    console.log("✅ Environment variables verified");
  }

  /**
   * Ensure GitHub SSH connection is working
   */
  private async ensureGitHubConnection(): Promise<void> {
    console.log("🔗 Verifying GitHub connection...");

    try {
      const sshStatus = await checkGitHubSSHConnection();
      if (!sshStatus.success) {
        console.log("⚠️  GitHub SSH connection failed");
        
        if (this.config.autoFix || this.config.forceSSHSetup) {
          console.log("🔧 Running SSH setup wizard...");
          await sshSetupWizard();
          
          // Verify connection after setup
          const retryStatus = await checkGitHubSSHConnection();
          if (!retryStatus.success) {
            throw new Error("SSH setup completed but connection still failing");
          }
        } else {
          throw new Error("GitHub SSH connection required. Run SSH setup wizard.");
        }
      }
      
      console.log("✅ GitHub SSH connection verified");
    } catch (error: any) {
      console.log("⚠️  SSH connection check failed, attempting HTTPS fallback...");
      await this.ensureHTTPSFallback();
    }
  }

  /**
   * Fallback to HTTPS if SSH fails
   */
  private async ensureHTTPSFallback(): Promise<void> {
    try {
      // Check if we have a GitHub token for HTTPS
      if (process.env.GITHUB_TOKEN) {
        console.log("🔄 Configuring HTTPS authentication with token...");
        execSync(`git config --global url."https://${process.env.GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"`, 
          { stdio: 'pipe' });
        console.log("✅ HTTPS fallback configured");
      } else {
        console.log("⚠️  No GitHub token available for HTTPS fallback");
        console.log("💡 Consider setting GITHUB_TOKEN environment variable");
      }
    } catch (error) {
      console.log("⚠️  HTTPS fallback setup failed, proceeding with existing configuration");
    }
  }

  /**
   * Commit and push changes to GitHub
   */
  private async commitAndPushChanges(): Promise<void> {
    console.log("📝 Committing and pushing changes...");

    try {
      // Check if there are any changes to commit
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      
      if (status.trim().length === 0) {
        console.log("ℹ️  No changes to commit");
        return;
      }

      console.log("📋 Changes detected:");
      console.log(status);

      // Stage, commit, and push
      await gitStageCommitPush(this.config.commitMessage!);
      console.log("✅ Changes committed and pushed to GitHub");

    } catch (error: any) {
      if (error.message.includes('SSH_SETUP_NEEDED')) {
        throw new Error("GitHub authentication failed. SSH setup required.");
      }
      throw error;
    }
  }

  /**
   * Deploy to Vercel with proper error handling
   */
  private async deployToVercel(): Promise<void> {
    console.log("🚀 Deploying to Vercel...");

    return new Promise((resolve, reject) => {
      // Build the Vercel command
      const vercelArgs = ['--prod'];
      
      // Add token if available
      if (process.env.VERCEL_TOKEN) {
        vercelArgs.push('--token', process.env.VERCEL_TOKEN);
      }

      // Add project ID if available
      if (process.env.VERCEL_PROJECT_ID) {
        vercelArgs.push('--scope', process.env.VERCEL_ORG_ID || 'personal');
      }

      console.log(`🔧 Running: vercel ${vercelArgs.join(' ')}`);

      const deployProcess = spawn('vercel', vercelArgs, { 
        stdio: 'inherit',
        env: { 
          ...process.env,
          // Ensure Vercel CLI uses the token
          VERCEL_TOKEN: process.env.VERCEL_TOKEN 
        }
      });

      deployProcess.on('close', (code) => {
        if (code === 0) {
          console.log("✅ Vercel deployment completed successfully");
          resolve();
        } else {
          reject(new Error(`Vercel deployment failed with exit code ${code}`));
        }
      });

      deployProcess.on('error', (error) => {
        reject(new Error(`Vercel deployment process error: ${error.message}`));
      });
    });
  }

  /**
   * Verify project structure is ready for deployment
   */
  private verifyProjectStructure(): void {
    console.log("📁 Verifying project structure...");

    const requiredFiles = ['package.json'];
    const buildOutputs = ['dist/', 'build/', '.next/', '.vercel/'];

    // Check required files
    for (const file of requiredFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Check if build is needed
    const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
    
    if (packageJson.scripts?.build) {
      console.log("🔨 Build script detected, running build...");
      try {
        execSync('npm run build', { stdio: 'inherit', cwd: this.projectRoot });
        console.log("✅ Build completed successfully");
      } catch (error) {
        throw new Error("Build failed. Fix build errors before deployment.");
      }
    }

    console.log("✅ Project structure verified");
  }

  /**
   * Auto-fix missing prerequisites where possible
   */
  private async autoFixPrerequisites(results: any): Promise<void> {
    // This would implement auto-installation of missing tools
    // For now, just log what needs to be fixed
    console.log("🔧 Auto-fix not yet implemented for all prerequisites");
    console.log("📋 Please install missing tools manually:");
    
    if (!results.nodeVersion?.success) {
      console.log("   - Install Node.js 18+ from https://nodejs.org/");
    }
    
    if (!results.gitInstalled?.success) {
      console.log("   - Install Git: sudo apt-get install git");
    }
    
    if (!results.vercelCLI?.success) {
      console.log("   - Install Vercel CLI: npm install -g vercel");
    }

    throw new Error("Prerequisites not met. Please install missing tools.");
  }

  /**
   * Handle deployment errors with helpful suggestions
   */
  private async handleDeploymentError(error: any): Promise<void> {
    console.log("\n🆘 Deployment Error Analysis:");
    
    if (error.message.includes('authentication') || error.message.includes('SSH')) {
      console.log("🔑 Authentication Issue Detected");
      console.log("💡 Suggested fixes:");
      console.log("   1. Run SSH setup wizard: npm run mcp-helper");
      console.log("   2. Verify GitHub SSH keys in your account");
      console.log("   3. Set GITHUB_TOKEN environment variable for HTTPS fallback");
    }
    
    if (error.message.includes('VERCEL_TOKEN') || error.message.includes('Vercel')) {
      console.log("🌐 Vercel Configuration Issue");
      console.log("💡 Suggested fixes:");
      console.log("   1. Get Vercel token: https://vercel.com/account/tokens");
      console.log("   2. Set VERCEL_TOKEN environment variable");
      console.log("   3. Run: vercel login");
    }
    
    if (error.message.includes('build') || error.message.includes('compilation')) {
      console.log("🔨 Build Issue Detected");
      console.log("💡 Suggested fixes:");
      console.log("   1. Fix TypeScript/build errors");
      console.log("   2. Run: npm run build");
      console.log("   3. Check dependencies: npm install");
    }

    console.log("\n🛠️  For comprehensive troubleshooting, run: npm run mcp-helper");
  }
}

/**
 * Simple function that mimics `vercel --prod` but with all the checks
 */
export async function seamlessVercelDeploy(commitMessage?: string): Promise<void> {
  const orchestrator = new DeploymentOrchestrator({
    autoFix: true,
    commitMessage: commitMessage || "Auto deployment from Claude Code CLI"
  });
  
  await orchestrator.runSeamlessDeployment();
}

/**
 * Export for use in npm scripts and CLI
 */
export default seamlessVercelDeploy;
