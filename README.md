# WSL Deployment Sequential Thinking

A practical template for a Model Context Protocol (MCP) server and deployment workflow using TypeScript, Node.js, and best practices for WSL integration.

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
