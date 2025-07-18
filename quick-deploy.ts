#!/usr/bin/env node

/**
 * Quick deployment script with Vercel fixes
 * Usage: ./quick-deploy.sh [commit-message]
 */

import { DeploymentOrchestrator } from './src/deployment-orchestrator.js';
import { fixVercelDeployment } from './scripts/fix-vercel-deployment.js';

async function quickDeploy() {
  const commitMessage = process.argv[2] || 'Quick deployment';
  
  console.log('🚀 Quick Deploy with Vercel Fixes');
  console.log('================================');
  
  try {
    // Step 1: Fix common Vercel issues
    console.log('\n📋 Step 1: Fixing Vercel deployment issues...');
    fixVercelDeployment({ verbose: true });
    
    // Step 2: Run deployment pipeline
    console.log('\n📋 Step 2: Running deployment pipeline...');
    const orchestrator = new DeploymentOrchestrator({
      commitMessage,
      autoFix: true
    });
    
    await orchestrator.runSeamlessDeployment();
    
    console.log('\n✅ Quick deployment completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Quick deployment failed:', error);
    
    // Provide troubleshooting guidance
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check your Vercel token: echo $VERCEL_TOKEN');
    console.log('2. Verify project name in package.json');
    console.log('3. Run: npm run fix-vercel -- --verbose');
    console.log('4. Try manual deploy: vercel --prod');
    
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  quickDeploy();
}
