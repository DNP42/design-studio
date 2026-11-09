#!/usr/bin/env bash
# design-studio gate: structure, size and secret checks. No installs.
set -u
cd "$(dirname "$0")/.." || exit 1
fail=0
err() { echo "FAIL: $*"; fail=1; }

files=$(git ls-files --cached --others --exclude-standard)

# 1. No file over 5 MB.
while IFS= read -r f; do
  [ -f "$f" ] || continue
  s=$(stat -f %z "$f" 2>/dev/null || stat -c %s "$f")
  [ "$s" -gt 5242880 ] && err "$f is over 5 MB"
done <<< "$files"

# 2. No node_modules, no env files except .env.example.
echo "$files" | grep -E '(^|/)node_modules/' >/dev/null && err "node_modules is tracked"
echo "$files" | grep -E '(^|/)\.env' | grep -v '\.env\.example$' >/dev/null && err ".env file is tracked"

# 3. Every part folder has README.md and poster.png.
for d in components/*/*/ patterns/*/*/; do
  [ -d "$d" ] || continue
  [ -f "$d/README.md" ] || err "$d has no README.md"
  [ -f "$d/poster.png" ] || err "$d has no poster.png"
  case "$d" in components/motion/*) [ -f "$d/contact.png" ] || err "$d has no contact.png";; esac
done

# 4. Every package.json is valid JSON.
while IFS= read -r f; do
  case "$f" in *package.json) jq empty "$f" 2>/dev/null || err "$f is not valid JSON";; esac
done <<< "$files"

# 5. Required root files.
for f in README.md AGENTS.md LICENSE .gitignore; do [ -f "$f" ] || err "$f is missing"; done

if [ "$fail" -eq 0 ]; then echo "gate: PASS ($(echo "$files" | grep -c .) files)"; fi
exit "$fail"
