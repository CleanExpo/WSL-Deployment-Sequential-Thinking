# 🚀 Universal WSL/Ubuntu Deployment Tool for Claude Code CLI

A comprehensive deployment solution that works with **any Node.js project** in WSL/Ubuntu environments, specifically designed for Claude Code CLI usage.

## 🎯 What This Tool Does

This tool provides a seamless `vercel --prod` replacement that:
- **Works in any project directory** - analyzes your current project automatically
- **Finds and loads your `.env` files** - discovers environment variables from your project
- **Detects your framework** - Next.js, Vite, React, Vue, or any Node.js project
- **Handles authentication** - SSH keys, GitHub tokens, Vercel tokens
- **Provides clear guidance** - tells you exactly what's missing and how to fix it

## 🚀 Quick Start

### Method 1: Install Globally (Recommended)
```bash
# Install this tool globally
npm install -g wsl-deployment-sequential-thinking

# Then use in any project
cd /path/to/your/project
vercel-deploy --prod
```

### Method 2: Use Directly in Your Project
```bash
# In your project directory
npx wsl-deployment-sequential-thinking --prod
```

### Method 3: Clone and Use
```bash
# Clone this repository
git clone https://github.com/CleanExpo/WSL-Deployment-Sequential-Thinking.git
cd WSL-Deployment-Sequential-Thinking
npm install && npm run build

# Use from any project directory
cd /path/to/your/project
node /path/to/WSL-Deployment-Sequential-Thinking/dist/deploy-cli.js --prod
```

## 🏗️ How It Works

### 1. **Project Analysis**
When you run the tool, it automatically:
- Scans for `package.json` to identify the project
- Detects framework (Next.js, Vite, React, Vue, etc.)
- Finds `.env`, `.env.local`, `.env.production` files
- Checks for build scripts and deployment configuration
- Validates Git repository status

### 2. **Environment Discovery**
Automatically loads environment variables from:
```
.env
.env.local  
.env.production
.env.prod
.env.development
.env.dev
```

### 3. **Deployment Strategy**
Determines optimal deployment approach:
- **Next.js projects** → Direct Vercel deployment
- **Vite/React projects** → Static site deployment  
- **Node.js apps** → Serverless function deployment
- **Custom builds** → Build + static deployment

## 📋 Commands

### Primary Deployment
```bash
# Deploy to production (replaces `vercel --prod`)
npm run vercel-prod

# Or with custom message
npm run vercel-prod --message="My deployment"
```

### Interactive Helper
```bash
# Get project analysis and troubleshooting
npm run mcp-helper
```

### Available Menu Options:
- **📊 Analyze Current Project** - See what was detected
- **📦 Deploy Project** - Full deployment pipeline  
- **🔐 SSH/GitHub Setup** - Fix authentication issues
- **🏥 System Diagnostics** - Check prerequisites
- **🔧 Help & Troubleshooting** - Get assistance

## 🔐 Environment Variables

### Required for Deployment
```bash
# Get from https://vercel.com/account/tokens
VERCEL_TOKEN=vercel_xxxxxxxxxxxxx
```

### Recommended for Better Experience
```bash
# For team projects (optional)
VERCEL_ORG_ID=team_xxxxxxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxx

# For SSH fallback (recommended in WSL)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx
```

## 🐧 WSL/Ubuntu Specific Features

### Automatic Detection
- Detects WSL environment and Ubuntu systems
- Provides platform-specific installation instructions
- Handles WSL path issues automatically

### Prerequisites Auto-Installation
```bash
# The tool can auto-install missing prerequisites:
sudo apt update && sudo apt install -y git nodejs npm
npm install -g vercel
```

### SSH Authentication
- Automatic SSH key generation for GitHub
- WSL-compatible SSH agent setup
- HTTPS fallback using GitHub tokens
- Step-by-step authentication guidance

## 🎨 Framework Support

### Automatically Detected Frameworks
- **Next.js** - Full SSR/SSG support
- **Vite + React/Vue** - Optimized static builds
- **Create React App** - Classic React builds
- **Nuxt.js** - Vue.js framework
- **SvelteKit** - Svelte applications
- **Astro** - Modern static site generator
- **Gatsby** - React-based static sites
- **Express/Fastify/Koa** - Node.js backends

### Custom Projects
- Detects build scripts automatically
- Works with any `npm run build` output
- Supports custom deployment configurations

## 🔧 Troubleshooting

### Common Issues in WSL/Ubuntu

#### 1. Missing Vercel Token
```bash
# Error: Missing required environment variables: VERCEL_TOKEN
# Solution: Get token from https://vercel.com/account/tokens
echo "VERCEL_TOKEN=your_token_here" >> .env
```

#### 2. SSH Authentication Failed
```bash
# Error: SSH setup required for GitHub authentication
# Solution: Run the SSH wizard
npm run mcp-helper
# Select: "🔐 SSH/GitHub Setup Wizard"
```

#### 3. Not in Project Directory
```bash
# Error: No package.json found
# Solution: Navigate to your project root
cd /path/to/your/project
pwd  # Verify you're in the right place
ls   # Should see package.json
```

### Emergency Deployment
If everything fails, try this sequence:
```bash
# 1. Manual build
npm run build

# 2. Manual git operations  
git add .
git commit -m "Deploy"
git push

# 3. Direct Vercel
VERCEL_TOKEN=your_token vercel --prod
```

## 📚 Example Usage

### Deploying a Next.js Project
```bash
cd my-nextjs-app
npm run vercel-prod
# Output:
# 📊 Project detected: Next.js
# 🔐 Environment files: .env.local found
# 🔨 Building with: npm run build
# 📤 Deploying to Vercel...
# ✅ Deployed: https://my-app.vercel.app
```

### Deploying a Vite React Project
```bash
cd my-vite-app  
npm run vercel-prod
# Output:
# 📊 Project detected: Vite + React
# 🔐 Environment files: .env found
# 🔨 Building with: npm run build
# 📤 Deploying to Vercel...
# ✅ Deployed: https://my-vite-app.vercel.app
```

## 🎁 Features for Non-Coders

### Clear, Plain English
- No technical jargon in error messages
- Step-by-step instructions for every issue
- Links to exactly where to get tokens/keys

### Auto-Discovery
- Finds your project files automatically
- Loads environment variables from your project
- Detects what type of project you're building

### Guided Setup
- Interactive menus for all operations
- Automatic fixes for common problems
- Visual progress indicators

### Documentation Generation
- Creates project-specific deployment guides
- Explains your project's specific requirements
- Saves configuration for future deployments

## 🔗 Integration with Claude Code CLI

This tool is specifically designed for Claude Code CLI workflows:

1. **Works from any directory** - no need to be in the tool's directory
2. **Discovers project context** - finds your `.env` files and project structure
3. **Provides clear error messages** - tells you exactly what's wrong and how to fix it
4. **Handles authentication** - sets up SSH keys and tokens automatically
5. **One-command deployment** - `npm run vercel-prod` does everything

## 📄 License

MIT License - Use freely in any project.

---

**Remember**: This tool works with your project's files, not its own. Run it from your project directory and it will discover and use your `.env` files, `package.json`, and deployment configuration automatically.

## Quick Start

1. Install Node.js 18+ in your WSL Ubuntu terminal.
2. Clone this repository and run the setup:

```bash
git clone https://github.com/CleanExpo/WSL-Deployment-Sequential-Thinking.git
cd WSL-Deployment-Sequential-Thinking
chmod +x setup.sh
./setup.sh
```

3. To launch the server:

```bash
npm start
```

4. Begin customizing your logic in `src/index.ts`.

## Features

- TypeScript build pipeline
- MCP protocol scaffolding
- WSL compatibility
- GitHub Actions CI/CD
- Example environment configuration
- **Enhanced MCP Pipeline** with automated deployment
- **Safe file operations** with path validation
- **Git automation** with SSH support
- **Vercel integration** with streaming logs

## Deployment MCP Pipeline

This project provides multiple ways to deploy your changes:

### One-Step Publish (for non-coders)

To quickly commit *and* deploy your changes to Vercel:

```bash
npm run mcp-helper
```

This command walks you through (in plain English):
- Checking for misplaced files
- Stage & commit all updates
- Push to GitHub (with SSH tips!)
- Launch a Vercel deploy (with real-time logs)

### Advanced Pipeline

For developers, use the programmatic approach:

```typescript
import { runMCPDeploy } from './src/mcp-pipeline.js';

// Deploy with automatic commit and Vercel trigger
runMCPDeploy("feat: add new MCP functionality");
```

This script:
- Ensures files created by Claude Code or tools are within the project root
- Stages/commits/pushes all changes (with SSH agent checks)
- Triggers a Vercel production deploy and streams logs to your terminal

### Edge Cases Handled

- Files landing in unexpected places
- Git authentication/SSH problems in WSL
- Occasional Vercel commit-sync failures—retries included
- Path normalization across Windows/WSL boundaries

## Environment Setup

### Prerequisites

- **Node.js 18+** - Required for MCP SDK compatibility
- **Git with SSH** - Configure SSH keys for GitHub authentication
- **Vercel CLI** - Install globally: `npm install -g vercel`
- **WSL2** - Recommended for Windows development

### SSH Configuration

For WSL users, ensure SSH agent is properly configured:

```bash
# Start SSH agent and add your key
eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_rsa

# Set your remote to SSH (not HTTPS)
git remote set-url origin git@github.com:CleanExpo/WSL-Deployment-Sequential-Thinking.git

# Keep proper permissions
chmod 600 ~/.ssh/id_rsa
```

### Vercel Setup

1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Link your project: `vercel link`
4. For deploy hooks, create one in Vercel Dashboard → Project → Settings → Git → Deploy Hooks

See the `.env.example` file for additional environment configuration.

## Project Structure

```
WSL-Deployment-Sequential-Thinking/
├── src/
│   ├── index.ts          # Main MCP server entry point
│   ├── path-helper.ts    # Safe path resolution utilities
│   ├── git-helper.ts     # Git operations with error handling
│   ├── vercel-helper.ts  # Vercel deployment automation
│   └── mcp-pipeline.ts   # Complete deployment pipeline
├── .github/workflows/
│   ├── ci.yml           # GitHub Actions CI/CD
│   └── vercel-deploy.yml # Vercel deploy hook trigger
├── CONTRIBUTING.md       # Contributor guidelines
└── README.md            # This file
```

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Safe file operations and path handling
- Using the MCP deployment pipeline
- Troubleshooting SSH and WSL issues
- Code standards and testing practices

---

**For advanced features or expansion, add files and logic to the `src/` directory using the provided utilities.**
