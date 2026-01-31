#!/bin/bash
echo "=== COMPREHENSIVE ARVDOUL FIX ==="
echo "This will fix ALL known syntax issues..."

# Backup first
cp -r src src_backup_$(date +%s)

# 1. Fix main.jsx comment issue
echo "1. Fixing main.jsx..."
sed -i 's/\\\/\\\///g' src/main.jsx

# 2. Fix all template literals without backticks
echo "2. Fixing template literals..."
find src -name "*.jsx" -o -name "*.js" | while read file; do
    # Fix className={... ${...} ...} -> className={`... ${...} ...`}
    sed -i 's/className={\([^`].*\)}/className={`\1`}/g' "$file" 2>/dev/null || true
    sed -i 's/alt={\([^`].*\)}/alt={`\1`}/g' "$file" 2>/dev/null || true
    sed -i 's/title={\([^`].*\)}/title={`\1`}/g' "$file" 2>/dev/null || true
    sed -i 's/placeholder={\([^`].*\)}/placeholder={`\1`}/g' "$file" 2>/dev/null || true
done

# 3. Fix specific problematic files individually
echo "3. Fixing specific problematic files..."

# Fix CommentsModal.jsx
if [ -f "src/components/Home/CommentsModal.jsx" ]; then
    echo "  Fixing CommentsModal.jsx..."
    sed -i '242,244s/className={`flex-1 px-2 py-1 rounded border ${/className={`flex-1 px-2 py-1 rounded-border ${/' src/components/Home/CommentsModal.jsx
    sed -i '242,244s/}$/`}/' src/components/Home/CommentsModal.jsx
    sed -i 's/<\/AnimatePresence>,/<\/AnimatePresence>/g' src/components/Home/CommentsModal.jsx
fi

# Fix Composer.jsx regex
if [ -f "src/components/Home/Composer.jsx" ]; then
    echo "  Fixing Composer.jsx..."
    sed -i 's#/(https?://[^\\s]+)/g#/(https?:\\/\\/[^\\s]+)/g#' src/components/Home/Composer.jsx
fi

# Fix PostCard.jsx
if [ -f "src/components/Home/PostCard.jsx" ]; then
    echo "  Fixing PostCard.jsx..."
    sed -i '99s/const postUrl =`${/const postUrl = `${/' src/components/Home/PostCard.jsx
    sed -i '99s/post/${post.id};/post/${post.id}`;/' src/components/Home/PostCard.jsx
    sed -i '126s/alt={${post.displayName} avatar}/alt={`${post.displayName} avatar`}/' src/components/Home/PostCard.jsx
fi

# Fix VideosScreen.jsx
if [ -f "src/screens/VideosScreen.jsx" ]; then
    echo "  Fixing VideosScreen.jsx..."
    sed -i '268s/a.download = `${post.id}.mp4;/a.download = `${post.id}.mp4`;/' src/screens/VideosScreen.jsx
    sed -i '314s/bar.style.width = `${pct}%;/bar.style.width = `${pct}%`;/' src/screens/VideosScreen.jsx
    sed -i '327s/querySelector([data-idx="${nextIdx}"])/querySelector(`[data-idx="${nextIdx}"]`)/' src/screens/VideosScreen.jsx
fi

# Fix HomeScreen.jsx
if [ -f "src/screens/HomeScreen.jsx" ]; then
    echo "  Fixing HomeScreen.jsx..."
    sed -i '329s/navigate(/post/${/navigate(`\/post\/${/' src/screens/HomeScreen.jsx
    sed -i '352s/className={min-h-screen/className={`min-h-screen/' src/screens/HomeScreen.jsx
    sed -i '352s/}$/`}/' src/screens/HomeScreen.jsx
fi

# 4. Fix ReelsFeed.jsx
if [ -f "src/components/Home/ReelsFeed.jsx" ]; then
    echo "  Fixing ReelsFeed.jsx..."
    sed -i '89s/watch-reel-${/`watch-reel-${/' src/components/Home/ReelsFeed.jsx
    sed -i '101s/react-reel-${/`react-reel-${/' src/components/Home/ReelsFeed.jsx
fi

# 5. Fix SwipableMedia.jsx
if [ -f "src/components/Home/SwipableMedia.jsx" ]; then
    echo "  Fixing SwipableMedia.jsx..."
    sed -i '108s/alt={Post media ${/alt={`Post media ${/' src/components/Home/SwipableMedia.jsx
fi

echo "4. Testing fixes..."

# Test syntax of key files
echo "=== Syntax check of fixed files ==="
for file in \
    src/main.jsx \
    src/components/Home/CommentsModal.jsx \
    src/components/Home/Composer.jsx \
    src/components/Home/PostCard.jsx \
    src/screens/VideosScreen.jsx \
    src/screens/HomeScreen.jsx; do
    if [ -f "$file" ]; then
        echo -n "$file: "
        if node -c "$file" 2>/dev/null; then
            echo "✓ OK"
        else
            echo "✗ Still has issues"
            node -c "$file" 2>&1 | head -3
        fi
    fi
done

echo "5. Attempting build..."
if npx vite build 2>&1 | tail -10; then
    echo "=== BUILD SUCCESSFUL! ==="
else
    echo "=== BUILD STILL FAILING ==="
    echo "Last errors:"
    npx vite build 2>&1 | grep -A5 -B5 "error\|Error\|ERROR" | tail -20
fi

echo "=== FIXES COMPLETED ==="
echo "Backup saved in: src_backup_*"
echo "Run 'npm run dev' to test the application."
