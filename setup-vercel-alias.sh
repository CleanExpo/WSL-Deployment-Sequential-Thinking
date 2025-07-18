#!/bin/bash

# Simple alias setup for enhanced vercel command
# This adds an alias to your shell so 'vercel --prod' uses our enhanced workflow

echo "🚀 Setting up Enhanced Vercel CLI alias..."

# Build the project first
npm run build

CURRENT_DIR=$(pwd)
WRAPPER_PATH="$CURRENT_DIR/dist/vercel-wrapper.js"

# Detect shell and add alias
if [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_RC="$HOME/.zshrc"
elif [[ "$SHELL" == *"bash"* ]]; then
    SHELL_RC="$HOME/.bashrc"
else
    SHELL_RC="$HOME/.profile"
fi

echo ""
echo "Adding alias to $SHELL_RC..."

# Remove any existing alias
sed -i '/# Enhanced Vercel CLI/d' "$SHELL_RC" 2>/dev/null
sed -i '/alias vercel=/d' "$SHELL_RC" 2>/dev/null

# Add new alias
cat >> "$SHELL_RC" << EOF

# Enhanced Vercel CLI
alias vercel="node '$WRAPPER_PATH'"
EOF

echo "✅ Alias added to $SHELL_RC"
echo ""
echo "🔄 Reload your shell with: source $SHELL_RC"
echo "Or open a new terminal window"
echo ""
echo "Now you can use:"
echo "  vercel --prod    # Enhanced workflow (commit → push → deploy)"
echo "  vercel           # Standard Vercel CLI for other commands"
echo ""
echo "To remove alias: edit $SHELL_RC and remove the vercel alias line"
