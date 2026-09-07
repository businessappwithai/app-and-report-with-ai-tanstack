#!/bin/bash
# Setup gstack for Claude Code

set -e

echo "Installing gstack for Claude Code..."

# Clone gstack
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack

# Run setup
cd ~/.claude/skills/gstack
./setup

echo "✓ gstack installed successfully!"
echo ""
echo "Available skills:"
echo "  /browse           - Web browsing and site testing (primary skill)"
echo "  /review           - Code review"
echo "  /qa               - Full QA testing workflow"
echo "  /ship             - Prepare for shipping"
echo "  /land-and-deploy  - Deploy to production"
echo "  /canary           - Canary deployment testing"
echo ""
echo "For more skills and documentation, see CLAUDE.md"
