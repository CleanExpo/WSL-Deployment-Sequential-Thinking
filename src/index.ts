import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Minimal functional starter implementation.
class WSLDeploymentMCPServer extends Server {
  constructor() {
    super({ name: 'wsl-deployment', version: '1.0.0' }, {});
  }
}

const server = new WSLDeploymentMCPServer();
const transport = new StdioServerTransport();
server.connect(transport);

console.log('WSL Deployment MCP Server is running.');
