# Vercel Deployment Issues & Solutions

This document addresses common Vercel deployment issues encountered in WSL/Ubuntu environments and provides comprehensive solutions.

## Common Issues Encountered

### 1. Project Naming Conflicts
```
Error: The provided name for your project "my_project" is invalid. Project names must not contain underscores and more than two consecutive dashes.
```

**Solution:** The deployment pipeline now automatically fixes project names in `package.json`:
- Replaces underscores with hyphens
- Removes triple dashes
- Ensures lowercase naming
- Removes invalid characters

### 2. Framework Detection Problems
```
Error: No framework detected. Please specify a framework for your project.
```

**Solution:** Enhanced vercel.json configuration based on project type:
- API-only projects get proper functions configuration
- Next.js projects use default settings
- Static sites get minimal configuration

### 3. .vercel Directory Corruption
```
Error: Invalid project configuration in .vercel/project.json
```

**Solution:** Automatic cleanup and regeneration:
- Validates existing .vercel/project.json
- Removes corrupted configurations
- Allows fresh project linking

### 4. Authentication Issues
```
Error: You do not have permission to access this resource.
```

**Solution:** Enhanced token management:
- Validates VERCEL_TOKEN environment variable
- Passes token to all vercel commands
- Provides fallback authentication methods

## Using the Enhanced Deployment System

### Method 1: Use the Fix Script
```bash
# Run the diagnostic and fix script
npm run fix-vercel

# With verbose output
npm run fix-vercel -- --verbose

# Dry run to see what would be changed
npm run fix-vercel -- --dry-run --verbose
```

### Method 2: Use Enhanced vercel --prod Command
```bash
# This now includes automatic fixes
npm run vercel-prod

# Or directly
vercel --prod
```

### Method 3: Use the Deployment Orchestrator
```bash
# Full deployment pipeline with all checks
npm run deploy-seamless
```

## Manual Troubleshooting Steps

### 1. Check Project Name
```bash
# View current project name
cat package.json | grep '"name"'

# Fix manually if needed
# Edit package.json and change "my_project" to "my-project"
```

### 2. Clean Vercel Configuration
```bash
# Remove corrupted .vercel directory
rm -rf .vercel

# Let Vercel recreate it on next deployment
vercel --prod
```

### 3. Verify Environment Variables
```bash
# Check if token is set
echo $VERCEL_TOKEN

# Set if missing
export VERCEL_TOKEN="your_token_here"
```

### 4. Force New Project Creation
```bash
# Use a clean project name
vercel --prod --yes --name my-clean-project-name
```

## Vercel Configuration Examples

### For API-Only Projects
```json
{
  "functions": {
    "api/*.js": {
      "maxDuration": 10
    }
  }
}
```

### For Next.js Projects
```json
{}
```

### For Static Sites
```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

## Error Recovery Strategies

The enhanced deployment system implements multiple fallback strategies:

1. **Primary:** Standard `vercel --prod` with fixes
2. **Fallback 1:** `vercel deploy --prod --yes`
3. **Fallback 2:** Force new project with clean name
4. **Fallback 3:** Manual link and deploy

## Environment Setup

### Required Environment Variables
```bash
export VERCEL_TOKEN="your_vercel_token"
```

### Optional Environment Variables
```bash
export VERCEL_ORG_ID="your_org_id"
export VERCEL_PROJECT_ID="your_project_id"
```

## Debugging Commands

### Check Vercel CLI Status
```bash
vercel whoami
vercel ls
```

### Validate Project Configuration
```bash
# Check package.json
cat package.json | jq '.name'

# Check vercel.json (if exists)
cat vercel.json

# Check .vercel configuration
cat .vercel/project.json
```

### Test Deployment Locally
```bash
# Build locally first
npm run build

# Then deploy
vercel --prod
```

## Prevention Best Practices

1. **Use Valid Project Names:** Only lowercase letters, numbers, and single hyphens
2. **Keep .vercel Directory Clean:** Don't manually edit files in .vercel/
3. **Set Environment Variables:** Always have VERCEL_TOKEN available
4. **Regular Cleanup:** Periodically run the fix script to prevent issues

## Integration with Other Tools

### With Git
```bash
# The deployment pipeline handles git automatically
npm run vercel-prod  # Commits, pushes, then deploys
```

### With MCP Server
```bash
# Full MCP deployment pipeline
npm run deploy
```

### With WSL/Ubuntu
The system is optimized for WSL/Ubuntu environments with:
- Proper path handling
- SSH key management
- Environment variable detection
- Linux-specific command adaptations

## Getting Help

If you encounter issues not covered here:

1. Run the diagnostic script: `npm run fix-vercel -- --verbose`
2. Check the deployment logs in the terminal
3. Verify your Vercel account permissions
4. Try the manual fallback commands
5. Check Vercel's status page for service issues
