const fs = require('fs');
const path = require('path');

function nuclearFix(content) {
    // Fix ALL template literals with brute force
    let fixed = content;
    
    // Pattern: {something ${var}} -> {`something ${var}`}
    // This regex matches {... ${...} ...} patterns
    const regex = /=\{([^`][^{}]*\$\{[^{}]*\}[^{}]*)\}/g;
    fixed = fixed.replace(regex, '={`$1`}');
    
    // Fix escaped comments
    fixed = fixed.replace(/\\\//g, '/');
    
    // Fix missing semicolons at end of const/let/var lines
    const lines = fixed.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if ((line.startsWith('const ') || line.startsWith('let ') || line.startsWith('var ')) &&
            !line.endsWith(';') && 
            !line.endsWith('{') && 
            !line.includes('function') &&
            !line.includes('=>')) {
            lines[i] = lines[i].trim() + ';';
        }
    }
    
    return lines.join('\n');
}

// Process all JS/JSX files
function processAll() {
    const files = [];
    
    function walk(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
                files.push(fullPath);
            }
        }
    }
    
    walk('src');
    
    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const fixed = nuclearFix(content);
            
            if (fixed !== content) {
                fs.writeFileSync(file, fixed, 'utf8');
                console.log(`Fixed: ${file}`);
            }
        } catch (err) {
            console.error(`Error processing ${file}: ${err.message}`);
        }
    }
    
    console.log(`Processed ${files.length} files`);
}

processAll();
