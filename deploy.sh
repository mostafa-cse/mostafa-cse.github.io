#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CP Routine — GitHub Pages Deploy Script
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh YOUR_GITHUB_USERNAME
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_NAME="cp-routine"
USERNAME="${1:?Usage: ./deploy.sh YOUR_GITHUB_USERNAME}"

echo "══════════════════════════════════════════════"
echo " CP Routine → GitHub Pages Deploy"
echo " User: $USERNAME"
echo " Repo: https://github.com/$USERNAME/$REPO_NAME"
echo "══════════════════════════════════════════════"

# Make sure we're in the website directory
cd "$(dirname "$0")"

# Install git if missing
if ! command -v git &>/dev/null; then
  echo "→ Installing git..."
  sudo apt-get install -y git
fi

# Configure git identity if not set
if [ -z "$(git config --global user.email 2>/dev/null)" ]; then
  read -rp "Your name (for git commits): " GIT_NAME
  read -rp "Your email: " GIT_EMAIL
  git config --global user.name  "$GIT_NAME"
  git config --global user.email "$GIT_EMAIL"
fi

# Init repo if needed
if [ ! -d ".git" ]; then
  git init
  git branch -M main
fi

git add -A
git commit -m "Deploy: CP Routine website — $(date '+%Y-%m-%d %H:%M')" || echo "(Nothing new to commit)"

# Set remote (overwrite if exists)
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"

echo ""
echo "→ Pushing to GitHub (you may be prompted for GitHub credentials)..."
echo "  Tip: Use a Personal Access Token as the password."
echo "  Create one at: https://github.com/settings/tokens/new"
echo "  Required scope: repo"
echo ""

git push -u origin main

echo ""
echo "✓ Push complete."
echo ""
echo "Next step: Enable GitHub Pages"
echo "  1. Go to: https://github.com/$USERNAME/$REPO_NAME/settings/pages"
echo "  2. Source → Deploy from branch → main / (root) → Save"
echo "  3. Wait ~60 seconds"
echo "  4. Site live at: https://$USERNAME.github.io/$REPO_NAME/"
