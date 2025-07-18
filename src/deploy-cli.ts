#!/usr/bin/env node

/**
 * Direct deployment CLI for seamless `vercel --prod` replacement
 * This works with any project directory and discovers project context automatically
 */

import { seamlessVercelDeploy } from "./deployment-orchestrator.js";
import { discoverProjectContext, analyzeDeploymentReadiness } from "./project-context.js";
import process from "process";
import path from "path";
import fs from "fs";

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const isProd = args.includes('--prod') || args.includes('-p');
  let commitMessage = args.find(arg => arg.startsWith('--message='))?.split('=')[1] ||
                       args[args.indexOf('--message') + 1] ||
                       args[args.indexOf('-m') + 1];

  // Prompt for commit message if not provided
  if (!commitMessage) {
    const inquirer = await import('inquirer');
    const resp = await inquirer.default.prompt({
      name: 'msg',
      type: 'input',
      message: 'Enter a commit message for this deployment:',
      default: 'Auto deployment from CLI'
    });
    commitMessage = resp.msg;
  }

  // Check if we're in a valid project directory
  const workingDir = process.cwd();
  console.log(`🎯 ${isProd ? 'Production' : 'Development'} deployment initiated`);
  console.log(`� Working directory: ${workingDir}`);
  console.log(`�📝 Commit message: "${commitMessage}"`);

  // Discover project context
  const context = discoverProjectContext(workingDir);
  
  // Quick validation
  if (!context.packageJson) {
    console.error('\n❌ No package.json found in current directory');
    console.error('💡 Make sure you\'re in the root of a Node.js project');
    console.error('📍 Current directory:', workingDir);
    console.error('\n🔍 Looking for these files:');
    console.error('   • package.json (required)');
    console.error('   • .env files (recommended)');
    console.error('   • Git repository (.git folder)');
    process.exit(1);
  }

  if (!context.gitRepo) {
    console.error('\n⚠️  No Git repository found');
    console.error('💡 Initialize Git first: git init');
    console.error('💡 Add remote: git remote add origin YOUR_GITHUB_URL');
    process.exit(1);
  }

  // Show project info
  console.log('\n📊 Project detected:');
  console.log(`   Name: ${context.packageJson.name || 'unnamed'}`);
  console.log(`   Framework: ${context.framework || 'Generic Node.js'}`);
  console.log(`   Strategy: ${context.deploymentStrategy}`);
  console.log('\n🔄 Pushing all changes to GitHub, then deploying to Vercel production...');
  
  // Check deployment readiness
  const readiness = analyzeDeploymentReadiness(context);
  if (!readiness.ready) {
    console.log('\n⚠️  Project issues detected:');
    readiness.issues.forEach(issue => console.log(`   • ${issue}`));
    console.log('\n💡 Run `npm run mcp-helper` for assistance with these issues');
  }

  try {
    await seamlessVercelDeploy(commitMessage);
    console.log('\n🎉 Deployment completed successfully!');
    console.log('🌐 Your project should now be live on Vercel');
    process.exit(0);
  } catch (error: any) {
    console.error('\n💥 Deployment failed:', error.message);
    console.error('\n🛠️  Troubleshooting options:');
    console.error('   • Run `npm run mcp-helper` for guided troubleshooting');
    console.error('   • Check TROUBLESHOOTING.md for common issues');
    console.error('   • Verify environment variables in .env files');
    console.error('   • Test SSH connection: ssh -T git@github.com');
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('🛠️  Run `npm run mcp-helper` for system diagnostics');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('🛠️  Run `npm run mcp-helper` for system diagnostics');
  process.exit(1);
});

main();
