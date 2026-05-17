const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;
        
        // FIX 1: Remove escaped forward slashes in comments
        content = content.replace(/\\\//g, '/');
        
        // FIX 2: Fix template literals in JSX attributes
        // Pattern: className={... ${...} ...} -> className={`... ${...} ...`}
        content = content.replace(/(\w+)=\{([^`][^{}]*\$\{[^{}]*\}[^{}]*)\}/g, '$1={`$2`}');
        
        // FIX 3: Fix missing backticks in template strings
        content = content.replace(/=\s*\$\{/g, '=`${');
        content = content.replace(/\$\{([^}]+)\}(?!`)/g, (match, p1) => {
            // Check context to see if it should be in backticks
            const before = content.substring(0, content.indexOf(match));
            const after = content.substring(content.indexOf(match) + match.length);
            if (before.endsWith('`') && after.startsWith('`')) {
                return match; // Already in backticks
            }
            // Check if it's in a string that should be template literal
            if (before.match(/=\s*["']/) || after.match(/["']$/)) {
                return match;
            }
            return match;
        });
        
        // FIX 4: Fix specific problematic patterns
        const fixes = [
            // navigate(/post/${id}) -> navigate(`/post/${id}`)
            { pattern: /navigate\(\/([^)]*?)\/\$\{([^}]*?)\}\)/g, replace: 'navigate(`/$1/${$2}`)' },
            // querySelector([data-x="${y}"]) -> querySelector(`[data-x="${y}"]`)
            { pattern: /querySelector\(\[([^=]+)=\\"\$\{([^}]+)\}\\"\]\)/g, replace: 'querySelector(`[$1="${$2}"]`)' },
            // const url = ${...} -> const url = `${...}`
            { pattern: /(const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\$\{/g, replace: '$1 $2 = `${' },
            // a.download = ${...}.mp4; -> a.download = `${...}.mp4`;
            { pattern: /(\.download|\.style\.width)\s*=\s*\$\{([^}]+)\}\.([^;]+);/g, replace: '$1 = `${$2}.$3`;' },
        ];
        
        fixes.forEach(({ pattern, replace }) => {
            content = content.replace(pattern, replace);
        });
        
        if (content !== original) {
            fs.writeFileSync(filePath, content, 'utf8');
            return true;
        }
    } catch (err) {
        console.error(`Error fixing ${filePath}:`, err.message);
    }
    return false;
}

// Process all files
const files = [];
function walk(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walk(fullPath);
        } else if (/\.(js|jsx)$/.test(item)) {
            files.push(fullPath);
        }
    }
}

walk('src');

console.log(`Processing ${files.length} files...`);
let fixedCount = 0;

// Process known problematic files first
const problematicFiles = [
    'src/components/Home/CommentsModal.jsx',
    'src/components/Home/Composer.jsx',
    'src/components/Home/PostCard.jsx',
    'src/components/Home/ReelsFeed.jsx',
    'src/components/Home/SwipableMedia.jsx',
    'src/screens/HomeScreen.jsx',
    'src/screens/VideosScreen.jsx',
    'src/main.jsx'
];

problematicFiles.forEach(file => {
    if (fs.existsSync(file) && fixFile(file)) {
        console.log(`✅ Fixed: ${file}`);
        fixedCount++;
    }
});

// Process remaining files
files.forEach(file => {
    if (!problematicFiles.includes(file) && fixFile(file)) {
        console.log(`Fixed: ${file}`);
        fixedCount++;
    }
});

console.log(`\nFixed ${fixedCount} files`);
