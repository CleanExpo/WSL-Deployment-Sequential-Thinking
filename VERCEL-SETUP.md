# 🚀 Enhanced Vercel CLI - Multiple Setup Options

This tool provides several ways to get the enhanced `vercel --prod` functionality that automatically commits and pushes changes before deployment.

## Option 1: Use npm scripts (Recommended)

```bash
# In any project where this tool is installed
npm run vercel --prod
# or
npm run vercel-prod
```

## Option 2: Use the wrapper directly

```bash
# Build the tool first
npm run build

# Then use the wrapper
node dist/vercel-wrapper.js --prod
```

## Option 3: Set up shell alias (Advanced)

```bash
# Run the setup script
./setup-vercel-alias.sh

# Then use anywhere
vercel --prod  # Uses enhanced workflow
vercel         # Standard vercel for other commands
```

## Option 4: Install globally (Advanced)

```bash
# Install this package globally
npm install -g wsl-deployment-sequential-thinking

# Then use the enhanced commands anywhere
vercel-enhanced --prod
wsl-deploy --prod
```

## What happens with `vercel --prod`:

1. **Detects changes** - Checks if there are uncommitted changes
2. **Prompts for commit message** - If changes found
3. **Commits and pushes** - All changes go to GitHub
4. **Deploys to Vercel** - Using the latest code from GitHub
5. **Shows success** - Confirms deployment is live

## Standard workflow:

```bash
cd your-project
vercel --prod  # (using any of the methods above)
# Enter commit message when prompted
# Watch as it commits → pushes → deploys
```

This ensures your GitHub repo and Vercel production are always in sync!
