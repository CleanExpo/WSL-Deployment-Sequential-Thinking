#!/usr/bin/env node

/**
 * Quick deployment tester - tests all deployment strategies
 */

import { mcpHelperMenu } from './src/mcp-helper-ui.js';

async function main() {
  console.log('🚀 MCP Deployment Helper - Enhanced Version');
  console.log('============================================');
  console.log('');
  console.log('This enhanced version includes:');
  console.log('✅ Multiple Vercel deployment strategies');
  console.log('✅ Comprehensive system diagnostics');
  console.log('✅ Automatic error recovery');
  console.log('✅ Next.js misconfiguration detection');
  console.log('✅ Manual fix guidance');
  console.log('');
  
  await mcpHelperMenu();
}

main().catch(error => {
  console.error('❌ Error starting MCP Helper:', error);
  process.exit(1);
});
