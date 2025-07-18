#!/bin/bash

# Installation script to replace the vercel command with our enhanced version

echo "🚀 Installing Enhanced Vercel CLI Wrapper..."

# Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Build our wrapper
npm run build

# Create a backup of the original vercel command
VERCEL_PATH=$(which vercel)
if [ -f "$VERCEL_PATH" ]; then
    echo "📦 Backing up original vercel command to vercel-original"
    sudo cp "$VERCEL_PATH" "${VERCEL_PATH}-original"
fi

# Create our enhanced vercel wrapper
CURRENT_DIR=$(pwd)
WRAPPER_PATH="$CURRENT_DIR/dist/vercel-wrapper.js"

echo "🔧 Creating enhanced vercel command..."

# Create a new vercel script that calls our wrapper
sudo cat > /usr/local/bin/vercel << EOF
#!/bin/bash

# Enhanced Vercel CLI - calls the wrapper for --prod, passes through otherwise
node "$WRAPPER_PATH" "\$@"
EOF

sudo chmod +x /usr/local/bin/vercel

echo "✅ Enhanced Vercel CLI installed!"
echo ""
echo "Now you can use:"
echo "  vercel --prod    # Enhanced workflow (commit → push → deploy)"
echo "  vercel           # Standard Vercel CLI behavior"
echo ""
echo "To uninstall, run: sudo rm /usr/local/bin/vercel && sudo mv /usr/local/bin/vercel-original /usr/local/bin/vercel"
