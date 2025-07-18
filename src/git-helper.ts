import { execSync } from "child_process";
import { checkSSHAgent, checkGitHubSSHConnection } from "./ssh-setup.js";

export function gitStageCommitPush(message: string) {
  // Check SSH setup before attempting git operations
  if (!checkSSHAgent() || !checkGitHubSSHConnection()) {
    console.error("🔑 SSH authentication is not properly configured.");
    console.error("💡 Please run the SSH setup wizard: npm run mcp-helper");
    throw new Error("SSH_SETUP_NEEDED");
  }

  try {
    execSync("git add -A", { stdio: "inherit" });
    execSync("git status --short", { stdio: "inherit" });
    execSync(`git commit -m "${message}"`, { stdio: "inherit" });
    execSync("git push", { stdio: "inherit" });
    console.log("✔️ All changes pushed successfully.");
  } catch (err) {
    console.error("❌ Git operation failed. Please check the SSH agent or verify remote settings.");
    throw err;
  }
}
