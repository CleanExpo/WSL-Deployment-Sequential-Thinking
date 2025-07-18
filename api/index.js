export default function handler(req, res) {
  res.status(200).json({
    message: 'WSL Deployment Sequential Thinking MCP Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    features: [
      'MCP Protocol Support',
      'Git Automation',
      'Vercel Deployment',
      'File Safety Checks'
    ]
  });
}