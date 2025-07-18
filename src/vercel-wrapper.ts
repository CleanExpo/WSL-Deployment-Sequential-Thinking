#!/usr/bin/env node

/**
 * Vercel CLI wrapper that intercepts `vercel --prod` and adds enhanced deployment workflow
 * This replaces the standard vercel command with our comprehensive deployment pipeline
 */

import { seamlessVercelDeploy } from "./deployment-orchestrator.js";
import { discoverProjectContext, analyzeDeploymentReadiness } from "./project-context.js";
import { execSync, spawn } from "child_process";
import process from "process";

async function main() {
  const args = process.argv.slice(2);
  
  // Check if this is a production deployment
  const isProd = args.includes('--prod') || args.includes('--production');
  
  // If not a production deployment, just pass through to real vercel
  if (!isProd) {
    console.log('🔄 Passing through to standard Vercel CLI...');
    const vercelProcess = spawn('vercel', args, { stdio: 'inherit' });
    vercelProcess.on('close', (code) => process.exit(code));
    return;
  }

  // For production deployments, use our enhanced workflow
  console.log('🚀 Enhanced production deployment detected');
  console.log('📝 This will: commit changes → push to GitHub → deploy to Vercel');

  // Check if we're in a valid project directory
  const workingDir = process.cwd();
  console.log(`📍 Working directory: ${workingDir}`);

  // Discover project context
  const context = discoverProjectContext(workingDir);
  
  // Quick validation
  if (!context.packageJson) {
    console.error('\n❌ No package.json found in current directory');
    console.error('💡 Make sure you\'re in the root of a Node.js project');
    process.exit(1);
  }

  if (!context.gitRepo) {
    console.error('\n⚠️  No Git repository found');
    console.error('💡 Initialize Git first: git init');
    process.exit(1);
  }

  // Show project info
  console.log('\n📊 Project detected:');
  console.log(`   Name: ${context.packageJson.name || 'unnamed'}`);
  console.log(`   Framework: ${context.framework || 'Generic Node.js'}`);
  console.log(`   Strategy: ${context.deploymentStrategy}`);

  // Check if there are changes to commit
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim().length > 0) {
      console.log('\n📋 Changes detected - will commit and push before deployment');
      
      // Prompt for commit message
      const inquirer = await import('inquirer');
      const resp = await inquirer.default.prompt({
        name: 'msg',
        type: 'input',
        message: 'Enter a commit message for this deployment:',
        default: 'Production deployment'
      });
      
      console.log('\n🔄 Starting enhanced deployment pipeline...');
      await seamlessVercelDeploy(resp.msg);
    } else {
      console.log('\n✅ No changes to commit - deploying current state');
      console.log('🔄 Deploying to Vercel production...');
      
      // Just deploy without committing
      const vercelProcess = spawn('vercel', ['--prod'], { stdio: 'inherit' });
      vercelProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n🎉 Deployment completed successfully!');
        } else {
          console.error('\n💥 Deployment failed');
        }
        process.exit(code);
      });
    }
  } catch (error: any) {
    console.error('\n💥 Deployment failed:', error.message);
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

main();
