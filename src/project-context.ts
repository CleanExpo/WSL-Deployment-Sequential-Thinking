import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export interface ProjectContext {
  root: string;
  packageJson: any;
  envFiles: string[];
  deploymentDocs: string[];
  gitRepo: boolean;
  framework: string | null;
  buildScript: string | null;
  deploymentStrategy: string;
}

/**
 * Discovers and analyzes the current project context
 */
export function discoverProjectContext(workingDir: string = process.cwd()): ProjectContext {
  const context: ProjectContext = {
    root: workingDir,
    packageJson: null,
    envFiles: [],
    deploymentDocs: [],
    gitRepo: false,
    framework: null,
    buildScript: null,
    deploymentStrategy: 'unknown'
  };

  console.log(`🔍 Analyzing project context in: ${workingDir}`);

  // Find package.json
  const packageJsonPath = path.join(workingDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      context.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      console.log(`📦 Found package.json: ${context.packageJson.name || 'unnamed'}`);
    } catch (error) {
      console.warn(`⚠️  package.json exists but couldn't be parsed: ${error}`);
    }
  } else {
    console.log("📦 No package.json found - not a Node.js project");
  }

  // Find environment files
  const envPatterns = ['.env', '.env.local', '.env.production', '.env.prod', '.env.development', '.env.dev'];
  for (const pattern of envPatterns) {
    const envPath = path.join(workingDir, pattern);
    if (fs.existsSync(envPath)) {
      context.envFiles.push(envPath);
    }
  }
  
  if (context.envFiles.length > 0) {
    console.log(`🔐 Found ${context.envFiles.length} environment files:`);
    context.envFiles.forEach(file => console.log(`   • ${path.basename(file)}`));
  } else {
    console.log("🔐 No environment files found");
  }

  // Find deployment documentation
  const docPatterns = [
    'DEPLOYMENT.md', 'deployment.md', 'DEPLOY.md', 'deploy.md',
    'README.md', 'readme.md', 'SETUP.md', 'setup.md'
  ];
  for (const pattern of docPatterns) {
    const docPath = path.join(workingDir, pattern);
    if (fs.existsSync(docPath)) {
      context.deploymentDocs.push(docPath);
    }
  }

  if (context.deploymentDocs.length > 0) {
    console.log(`📚 Found ${context.deploymentDocs.length} documentation files:`);
    context.deploymentDocs.forEach(file => console.log(`   • ${path.basename(file)}`));
  }

  // Check for git repository
  context.gitRepo = fs.existsSync(path.join(workingDir, '.git'));
  console.log(`📂 Git repository: ${context.gitRepo ? 'Yes' : 'No'}`);

  // Detect framework and build strategy
  if (context.packageJson) {
    context.framework = detectFramework(context.packageJson, workingDir);
    context.buildScript = context.packageJson.scripts?.build || null;
    context.deploymentStrategy = determineDeploymentStrategy(context.packageJson, workingDir);
    
    console.log(`🏗️  Framework: ${context.framework || 'Unknown'}`);
    console.log(`⚙️  Build script: ${context.buildScript || 'None'}`);
    console.log(`🚀 Deployment strategy: ${context.deploymentStrategy}`);
  }

  return context;
}

/**
 * Detect the framework being used
 */
function detectFramework(packageJson: any, projectRoot: string): string | null {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // React frameworks
  if (deps['next']) return 'Next.js';
  if (deps['vite'] && deps['react']) return 'Vite + React';
  if (deps['@vitejs/plugin-react']) return 'Vite + React';
  if (deps['react-scripts']) return 'Create React App';
  
  // Vue frameworks
  if (deps['nuxt']) return 'Nuxt.js';
  if (deps['vite'] && deps['vue']) return 'Vite + Vue';
  if (deps['@vue/cli-service']) return 'Vue CLI';
  
  // Other frameworks
  if (deps['svelte'] || deps['@sveltejs/kit']) return 'SvelteKit';
  if (deps['astro']) return 'Astro';
  if (deps['gatsby']) return 'Gatsby';
  if (deps['@angular/core']) return 'Angular';
  
  // Backend frameworks
  if (deps['express']) return 'Express.js';
  if (deps['fastify']) return 'Fastify';
  if (deps['koa']) return 'Koa.js';
  
  // Build tools
  if (deps['vite']) return 'Vite';
  if (deps['webpack']) return 'Webpack';
  if (deps['parcel']) return 'Parcel';
  
  // Check for specific config files
  if (fs.existsSync(path.join(projectRoot, 'next.config.js'))) return 'Next.js';
  if (fs.existsSync(path.join(projectRoot, 'vite.config.js'))) return 'Vite';
  if (fs.existsSync(path.join(projectRoot, 'nuxt.config.js'))) return 'Nuxt.js';
  
  return null;
}

/**
 * Determine the best deployment strategy for the project
 */
function determineDeploymentStrategy(packageJson: any, projectRoot: string): string {
  // Check for Vercel configuration
  if (fs.existsSync(path.join(projectRoot, 'vercel.json'))) return 'Vercel (configured)';
  
  // Check for other platform configs
  if (fs.existsSync(path.join(projectRoot, 'netlify.toml'))) return 'Netlify';
  if (fs.existsSync(path.join(projectRoot, '.railway'))) return 'Railway';
  if (fs.existsSync(path.join(projectRoot, 'Dockerfile'))) return 'Docker/Container';
  
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Framework-specific strategies
  if (deps['next']) return 'Vercel (Next.js)';
  if (deps['vite']) return 'Vercel (Static)';
  if (deps['gatsby']) return 'Vercel (Static)';
  if (deps['@sveltejs/kit']) return 'Vercel (SvelteKit)';
  if (deps['nuxt']) return 'Vercel (Nuxt.js)';
  
  // Generic strategies
  if (packageJson.scripts?.build) return 'Vercel (Build + Static)';
  if (deps['express'] || deps['fastify'] || deps['koa']) return 'Vercel (Serverless)';
  
  return 'Vercel (Auto-detect)';
}

/**
 * Load and merge environment variables from project files
 */
export function loadProjectEnvironment(context: ProjectContext): { [key: string]: string } {
  const envVars: { [key: string]: string } = {};
  
  for (const envFile of context.envFiles) {
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            envVars[key.trim()] = value;
          }
        }
      }
      
      console.log(`📝 Loaded ${Object.keys(envVars).length} variables from ${path.basename(envFile)}`);
    } catch (error) {
      console.warn(`⚠️  Failed to load ${envFile}: ${error}`);
    }
  }
  
  return envVars;
}

/**
 * Analyze project deployment readiness
 */
export function analyzeDeploymentReadiness(context: ProjectContext): {
  ready: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check basic requirements
  if (!context.gitRepo) {
    issues.push("No Git repository found - initialize with 'git init'");
  }
  
  if (!context.packageJson) {
    issues.push("No package.json found - not a Node.js project");
  } else {
    // Check for build script if framework detected
    if (context.framework && !context.buildScript) {
      recommendations.push(`Add a build script for ${context.framework} framework`);
    }
    
    // Check for missing dependencies
    const requiredForVercel = ['next', 'vite', 'react-scripts', 'gatsby'];
    const hasFramework = requiredForVercel.some(dep => 
      context.packageJson.dependencies?.[dep] || context.packageJson.devDependencies?.[dep]
    );
    
    if (!hasFramework && !context.buildScript) {
      recommendations.push("Add a build script or use a supported framework");
    }
  }
  
  // Check environment files
  if (context.envFiles.length === 0) {
    recommendations.push("Consider creating a .env file for environment variables");
  }
  
  // Check for deployment documentation
  if (context.deploymentDocs.length === 0) {
    recommendations.push("Consider adding deployment documentation (DEPLOYMENT.md)");
  }
  
  return {
    ready: issues.length === 0,
    issues,
    recommendations
  };
}

/**
 * Create project-specific deployment documentation
 */
export function generateDeploymentGuide(context: ProjectContext): string {
  const guide = `# Deployment Guide for ${context.packageJson?.name || 'Your Project'}

## Project Analysis
- **Framework**: ${context.framework || 'Unknown'}
- **Build Script**: ${context.buildScript || 'None'}
- **Strategy**: ${context.deploymentStrategy}
- **Environment Files**: ${context.envFiles.length}

## Quick Deployment
\`\`\`bash
# Deploy to production
npm run vercel-prod

# Or use the helper
npm run mcp-helper
\`\`\`

## Environment Variables Required
${context.envFiles.length > 0 ? 
  `Check your .env files for required variables:\n${context.envFiles.map(f => `- ${path.basename(f)}`).join('\n')}` : 
  'No environment files found - create .env if needed'}

## Framework-Specific Notes
${getFrameworkNotes(context.framework)}

## Troubleshooting
If deployment fails:
1. Run \`npm run mcp-helper\` for diagnostics
2. Check that all environment variables are set
3. Ensure build script works: \`npm run build\`
4. Verify Git repository is configured

Generated on ${new Date().toISOString()}
`;

  return guide;
}

function getFrameworkNotes(framework: string | null): string {
  switch (framework) {
    case 'Next.js':
      return `- Next.js apps deploy automatically to Vercel
- Make sure you have a build script
- Environment variables should be prefixed with NEXT_PUBLIC_ for client-side access`;
    
    case 'Vite + React':
    case 'Vite':
      return `- Vite builds to \`dist/\` by default
- Environment variables should be prefixed with VITE_ for client-side access
- Make sure your build script outputs to the correct directory`;
    
    case 'Create React App':
      return `- CRA builds to \`build/\` directory
- Environment variables should be prefixed with REACT_APP_
- Uses \`npm run build\` to create production build`;
    
    default:
      return `- Make sure your build script creates deployable output
- Check that all dependencies are listed in package.json
- Environment variables may need framework-specific prefixes`;
  }
}

/**
 * Validate project is ready for deployment
 */
export function validateProjectForDeployment(context: ProjectContext): {
  canDeploy: boolean;
  blockers: string[];
  warnings: string[];
} {
  const blockers: string[] = [];
  const warnings: string[] = [];
  
  // Critical blockers
  if (!context.gitRepo) {
    blockers.push("Git repository not initialized");
  }
  
  if (!context.packageJson) {
    blockers.push("No package.json found - not a Node.js project");
  }
  
  // Check if project has been built
  if (context.buildScript) {
    const buildDirs = ['dist', 'build', '.next', 'out'];
    const hasBuildOutput = buildDirs.some(dir => 
      fs.existsSync(path.join(context.root, dir))
    );
    
    if (!hasBuildOutput) {
      warnings.push("No build output found - run build script before deployment");
    }
  }
  
  // Check for common deployment files
  if (!fs.existsSync(path.join(context.root, 'vercel.json')) && 
      !context.framework) {
    warnings.push("No vercel.json found - Vercel will use auto-detection");
  }
  
  return {
    canDeploy: blockers.length === 0,
    blockers,
    warnings
  };
}
