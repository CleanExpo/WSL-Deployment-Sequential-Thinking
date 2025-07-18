#!/usr/bin/env node

/**
 * Direct deployment CLI for seamless `vercel --prod` replacement
 * This mimics the vercel CLI but with comprehensive pre-deployment checks
 */

import { seamlessVercelDeploy } from "./deployment-orchestrator.js";
import process from "process";

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const isProd = args.includes('--prod') || args.includes('-p');
  const commitMessage = args.find(arg => arg.startsWith('--message='))?.split('=')[1] ||
                       args[args.indexOf('--message') + 1] ||
                       args[args.indexOf('-m') + 1] ||
                       'Auto deployment from CLI';

  console.log(`🎯 ${isProd ? 'Production' : 'Development'} deployment initiated`);
  console.log(`📝 Commit message: "${commitMessage}"`);

  try {
    await seamlessVercelDeploy(commitMessage);
    console.log('\n🎉 Deployment completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n💥 Deployment failed:', error.message);
    console.error('\n🛠️  Run `npm run mcp-helper` for troubleshooting assistance');
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
