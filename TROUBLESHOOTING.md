# 🔧 WSL/Ubuntu Deployment Troubleshooting Guide

This guide helps resolve common issues when deploying from Claude Code CLI in WSL/Ubuntu environments.

## 🚨 Most Common Issues

### 1. Missing Vercel Token
**Error**: `Missing required environment variables: VERCEL_TOKEN`

**Quick Fix**:
```bash
# Run the helper first
npm run mcp-helper

# Or set manually:
# 1. Go to https://vercel.com/account/tokens
# 2. Create new token named "Claude-CLI-Token"
# 3. Add to .env file:
echo "VERCEL_TOKEN=your_token_here" >> .env
```

### 2. GitHub SSH Connection Failed
**Error**: `SSH setup required for GitHub authentication`

**Quick Fix**:
```bash
# Run SSH setup wizard
npm run mcp-helper
# Select: "🔐 SSH Setup Wizard"

# Or manual setup:
ssh-keygen -t ed25519 -C "your_email@example.com"
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
# Add public key to GitHub: https://github.com/settings/ssh
```

### 3. WSL Path Issues
**Error**: Various path-related errors

**Quick Fix**:
```bash
# Ensure you're in the right directory
cd /mnt/c/path/to/your/project  # If accessing Windows files
# OR
cd ~/your-project  # If using Linux filesystem

# Check current directory
pwd
ls -la
```

## 🎯 One-Command Deployment

The repository includes a seamless deployment command that handles all checks:

```bash
# This replaces `vercel --prod` with comprehensive checks
npm run vercel-prod
```

**What it does**:
1. ✅ Checks Node.js 18+, Git, Vercel CLI
2. ✅ Validates/sets up environment variables
3. ✅ Tests GitHub SSH connection (with HTTPS fallback)
4. ✅ Builds project
5. ✅ Commits and pushes to GitHub
6. ✅ Deploys to Vercel production

## 🐧 WSL-Specific Setup

### Initial WSL Configuration
```bash
# Update package list
sudo apt update

# Install essential tools
sudo apt install -y git curl build-essential

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
node --version
npm --version
git --version
```

### Git Configuration
```bash
# Set global git config
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Enable credential helper for Windows integration
git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/libexec/git-core/git-credential-manager-core.exe"
```

## 🔐 Environment Variables Setup

### Required Variables
Create a `.env` file in your project root:

```bash
# Critical for deployment
VERCEL_TOKEN=vercel_xxxxxxxxxxxxx

# Recommended for team projects
VERCEL_ORG_ID=team_xxxxxxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxx

# For SSH fallback (highly recommended in WSL)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

### Getting Tokens

#### Vercel Token
1. Visit: https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: "Claude-CLI-Token"
4. Copy token (starts with `vercel_`)

#### GitHub Token
1. Visit: https://github.com/settings/tokens
2. "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`, `write:packages`
4. Copy token (starts with `ghp_`)

## 📋 Diagnostic Commands

```bash
# Run comprehensive system check
npm run mcp-helper

# Check current environment
node --version
npm --version
git --version
vercel --version

# Test GitHub SSH
ssh -T git@github.com

# Check Vercel auth
vercel whoami

# Test deployment pipeline
npm run deploy-seamless
```

## 🆘 Emergency Deployment

If normal deployment fails, try this sequence:

```bash
# 1. Force build
npm run build

# 2. Manual git operations
git add .
git commit -m "Emergency deployment"
git push origin main

# 3. Direct Vercel deploy with token
VERCEL_TOKEN=your_token_here vercel --prod

# 4. Or use our wrapper with auto-fixes
npm run vercel-prod
```

## 🔄 Alternative Deployment Methods

### Method 1: Vercel CLI Direct
```bash
# Login first
vercel login

# Deploy
vercel --prod
```

### Method 2: Our Enhanced Pipeline
```bash
# With comprehensive checks
npm run vercel-prod
```

### Method 3: Manual Pipeline
```bash
npm run build
git add . && git commit -m "Deploy" && git push
vercel --prod
```

## 📞 Getting Help

1. **Run diagnostics**: `npm run mcp-helper`
2. **Check this guide**: Common issues listed above
3. **Verify environment**: All required tokens set
4. **Test SSH**: `ssh -T git@github.com` should work
5. **Check WSL version**: `wsl --list --verbose` (should be WSL2)

## 💡 Pro Tips

- Always use WSL2 (not WSL1)
- Keep tokens in `.env` file, never commit them
- Test SSH connection before deployment
- Use absolute paths when possible
- Run `npm run mcp-helper` when in doubt

---

**Remember**: The `npm run vercel-prod` command is designed to replace `vercel --prod` with comprehensive error checking and auto-fixes for WSL/Ubuntu environments.
