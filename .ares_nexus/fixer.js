/**
 * NEXUS REAL FIXER v7.0
 * Actually fixes issues • Creates backups • Never breaks
 */

const fs = require('fs');
const path = require('path');

class NexusFixer {
    constructor(projectRoot) {
        this.root = projectRoot;
        this.backupDir = path.join(projectRoot, '.ares_nexus', 'backups', Date.now().toString());
        this.fixesApplied = [];
        this.fixesFailed = [];
        
        fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    fix() {
        console.log('🔧 NEXUS - Applying REAL fixes...\n');
        
        // Load scan report
        const reportPath = path.join(this.root, '.ares_nexus', 'scan_report.json');
        if (!fs.existsSync(reportPath)) {
            console.log('❌ No scan report found. Run scan first: ./ares_nexus scan');
            process.exit(1);
        }
        
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        const issues = report.issues || [];
        
        if (issues.length === 0) {
            console.log('✅ No issues to fix');
            return { fixesApplied: 0, fixesFailed: 0 };
        }
        
        console.log(`Found ${issues.length} issue(s) to fix\n`);
        
        // Apply fixes
        for (const issue of issues) {
            try {
                console.log(`Fixing: ${issue.type} in ${issue.file || 'project'}`);
                
                switch (issue.type) {
                    case 'stray_text':
                        this.fixStrayText(issue);
                        break;
                        
                    case 'template_literal':
                        this.fixTemplateLiteral(issue);
                        break;
                        
                    case 'missing_react_import':
                        this.fixMissingReactImport(issue);
                        break;
                        
                    case 'missing_default_export':
                        this.fixMissingDefaultExport(issue);
                        break;
                        
                    case 'missing_package_json':
                        this.fixMissingPackageJson();
                        break;
                        
                    case 'missing_index_html':
                        this.fixMissingIndexHtml();
                        break;
                        
                    case 'missing_root_div':
                        this.fixMissingRootDiv();
                        break;
                        
                    case 'missing_entry_file':
                        this.fixMissingEntryFile();
                        break;
                        
                    case 'missing_app_component':
                        this.fixMissingAppComponent();
                        break;
                        
                    default:
                        console.log(`  ⚠️  No fix available for ${issue.type}`);
                        this.fixesFailed.push({
                            issue,
                          reason: 'No fix implementation'
                        });
                }
                
            } catch (error) {
                console.log(`  ❌ Failed: ${error.message}`);
                this.fixesFailed.push({
                    issue,
                  error: error.message
                });
            }
        }
        
        return this.generateReport();
    }
    
    fixStrayText(issue) {
        const filePath = path.join(this.root, issue.file);
        
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        if (issue.line && issue.line <= lines.length) {
            const lineIndex = issue.line - 1;
            const original = lines[lineIndex];
            
            // Only fix if not already commented
            if (!original.trim().startsWith('//') && !original.trim().startsWith('/*')) {
                // Try to extract the stray text
                const match = original.match(/^(\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)(\s*)$/);
                if (match) {
                    const [, spaces, text, trailing] = match;
                    lines[lineIndex] = `${spaces}// NEXUS: Fixed stray text - ${text}${trailing}`;
                } else {
                    lines[lineIndex] = `// NEXUS: Fixed stray text - ${original.trim()}`;
                }
            }
        } else {
            // Try to find and fix in entire file
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (trimmed && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed) &&
                    !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
                    !trimmed.startsWith('import') && !trimmed.startsWith('export') &&
                    !trimmed.includes('=') && !trimmed.includes('{') && !trimmed.includes('}')) {
                    
                    lines[i] = `// NEXUS: Fixed stray text - ${trimmed}`;
                }
            }
        }
        
        fs.writeFileSync(filePath, lines.join('\n'));
        
        this.fixesApplied.push({
            type: 'stray_text',
            file: issue.file,
            action: 'Commented out stray text'
        });
        
        console.log(`  ✅ Fixed stray text in ${issue.file}`);
    }
    
    fixTemplateLiteral(issue) {
        const filePath = path.join(this.root, issue.file);
        
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Fix: className={something ${x} something}
        // To:   className={`something ${x} something`}
        const fixed = content.replace(
            /className=\{\s*([^{}]*)\$\{([^{}]*)\}([^{}]*)\}/g,
            'className={`$1${$2}$3`}'
        );
        
        if (content !== fixed) {
            fs.writeFileSync(filePath, fixed);
            
            this.fixesApplied.push({
                type: 'template_literal',
                file: issue.file,
                action: 'Fixed template literal syntax'
            });
            
            console.log(`  ✅ Fixed template literal in ${issue.file}`);
        } else {
            console.log(`  ⚠️  No template literal found to fix in ${issue.file}`);
        }
    }
    
    fixMissingReactImport(issue) {
        const filePath = path.join(this.root, issue.file);
        
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add React import at the top if not present
        if (!content.includes('import React')) {
            // Find where to insert (after any existing imports)
            const lines = content.split('\n');
            let insertIndex = 0;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('import ')) {
                    insertIndex = i + 1;
                } else if (lines[i].trim() && !lines[i].trim().startsWith('//')) {
                    break;
                }
            }
            
            lines.splice(insertIndex, 0, "import React from 'react';");
            fs.writeFileSync(filePath, lines.join('\n'));
            
            this.fixesApplied.push({
                type: 'missing_react_import',
                file: issue.file,
                action: 'Added React import'
            });
            
            console.log(`  ✅ Added React import to ${issue.file}`);
        } else {
            console.log(`  ⚠️  React import already exists in ${issue.file}`);
        }
    }
    
    fixMissingDefaultExport(issue) {
        const filePath = path.join(this.root, issue.file);
        
        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add default export if missing
        if (!content.includes('export default')) {
            // Check if it's an App component
            const lines = content.split('\n');
            let hasApp = false;
            
            for (const line of lines) {
                if (line.includes('function App') || line.includes('const App') || line.includes('class App')) {
                    hasApp = true;
                    break;
                }
            }
            
            if (hasApp) {
                fs.writeFileSync(filePath, content + '\n\nexport default App;');
                
                this.fixesApplied.push({
                    type: 'missing_default_export',
                    file: issue.file,
                    action: 'Added default export'
                });
                
                console.log(`  ✅ Added default export to ${issue.file}`);
            } else {
                console.log(`  ⚠️  Could not find App component in ${issue.file}`);
            }
        } else {
            console.log(`  ⚠️  Default export already exists in ${issue.file}`);
        }
    }
    
    fixMissingPackageJson() {
        const filePath = path.join(this.root, 'package.json');
        
        if (fs.existsSync(filePath)) {
            console.log('  ⚠️  package.json already exists');
            return;
        }
        
        const pkg = {
            name: "arvdoul",
            version: "1.0.0",
            type: "module",
            scripts: {
                dev: "vite",
                build: "vite build",
                preview: "vite preview"
            },
            dependencies: {
                "react": "^18.2.0",
                "react-dom": "^18.2.0",
                "firebase": "^10.7.0"
            },
            devDependencies: {
                "@vitejs/plugin-react": "^4.0.0",
                "vite": "^4.4.0"
            }
        };
        
        fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2));
        
        this.fixesApplied.push({
            type: 'missing_package_json',
            action: 'Created package.json with React setup'
        });
        
        console.log('  ✅ Created package.json');
    }
    
    fixMissingIndexHtml() {
        const filePath = path.join(this.root, 'index.html');
        
        if (fs.existsSync(filePath)) {
            console.log('  ⚠️  index.html already exists');
            return;
        }
        
        const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Arvdoul</title>
    <style>
      #root {
        max-width: 1280px;
        margin: 0 auto;
        padding: 2rem;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
        
        fs.writeFileSync(filePath, html);
        
        this.fixesApplied.push({
            type: 'missing_index_html',
            action: 'Created index.html'
        });
        
        console.log('  ✅ Created index.html');
    }
    
    fixMissingRootDiv() {
        const filePath = path.join(this.root, 'index.html');
        
        if (!fs.existsSync(filePath)) {
            throw new Error('index.html not found');
        }
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if root div exists
        if (!content.includes('id="root"') && !content.includes('id="app"')) {
            // Add root div before closing body tag
            if (content.includes('</body>')) {
                content = content.replace('</body>', '    <div id="root"></div>\n</body>');
            } else if (content.includes('</html>')) {
                content = content.replace('</html>', '    <div id="root"></div>\n</html>');
            } else {
                content += '\n    <div id="root"></div>';
            }
            
            fs.writeFileSync(filePath, content);
            
            this.fixesApplied.push({
                type: 'missing_root_div',
                action: 'Added root div to index.html'
            });
            
            console.log('  ✅ Added root div to index.html');
        } else {
            console.log('  ⚠️  Root div already exists');
        }
    }
    
    fixMissingEntryFile() {
        const filePath = path.join(this.root, 'src/main.jsx');
        
        // Create directory if needed
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        if (fs.existsSync(filePath)) {
            console.log('  ⚠️  main.jsx already exists');
            return;
        }
        
        const mainJsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
        
        fs.writeFileSync(filePath, mainJsx);
        
        this.fixesApplied.push({
            type: 'missing_entry_file',
            action: 'Created main.jsx'
        });
        
        console.log('  ✅ Created main.jsx');
    }
    
    fixMissingAppComponent() {
        const filePath = path.join(this.root, 'src/App.jsx');
        
        // Create directory if needed
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        if (fs.existsSync(filePath)) {
            console.log('  ⚠️  App.jsx already exists');
            return;
        }
        
        const appJsx = `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Arvdoul Application</h1>
      <p>Your application is now working!</p>
    </div>
  );
}

export default App;`;
        
        fs.writeFileSync(filePath, appJsx);
        
        this.fixesApplied.push({
            type: 'missing_app_component',
            action: 'Created App.jsx'
        });
        
        console.log('  ✅ Created App.jsx');
    }
    
    createBackup(filePath) {
        const relativePath = path.relative(this.root, filePath);
        const backupPath = path.join(this.backupDir, relativePath);
        
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(filePath, backupPath);
    }
    
    generateReport() {
        return {
            timestamp: new Date().toISOString(),
            backupDir: this.backupDir,
            fixesApplied: this.fixesApplied,
            fixesFailed: this.fixesFailed,
            summary: {
                totalApplied: this.fixesApplied.length,
                totalFailed: this.fixesFailed.length,
                successRate: this.fixesApplied.length > 0 ? 
                    (this.fixesApplied.length / (this.fixesApplied.length + this.fixesFailed.length)) * 100 : 0
            }
        };
    }
}

// CLI
if (require.main === module) {
    const fixer = new NexusFixer(process.cwd());
    const report = fixer.fix();
    
    console.log('\n' + '='.repeat(60));
    console.log('🔧 NEXUS FIX COMPLETE');
    console.log('='.repeat(60) + '\n');
    
    console.log(`✅ Fixes applied: ${report.fixesApplied.length}`);
    console.log(`❌ Fixes failed: ${report.fixesFailed.length}`);
    console.log(`📁 Backup directory: ${report.backupDir}`);
    console.log(`📈 Success rate: ${Math.round(report.summary.successRate)}%`);
    
    if (report.fixesApplied.length > 0) {
        console.log('\n🎯 APPLIED FIXES:');
        console.log('-' .repeat(40));
        
        report.fixesApplied.forEach((fix, index) => {
            console.log(`${index + 1}. ${fix.type}`);
            console.log(`   File: ${fix.file || 'N/A'}`);
            console.log(`   Action: ${fix.action}`);
            console.log('');
        });
    }
    
    if (report.fixesFailed.length > 0) {
        console.log('\n⚠️  FAILED FIXES:');
        console.log('-' .repeat(40));
        
        report.fixesFailed.forEach((fail, index) => {
            console.log(`${index + 1}. ${fail.issue?.type || 'unknown'}`);
            console.log(`   Reason: ${fail.error || fail.reason}`);
            console.log('');
        });
    }
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Run: npm install');
    console.log('2. Run: npm run build');
    console.log('3. Run: npm run dev');
    console.log('4. Check if blank screen is fixed');
    console.log('');
    console.log('💡 If still blank, check:');
    console.log('   • Browser console for errors');
    console.log('   • Component logic and state');
    console.log('   • Async operations and API calls');
    
    // Save fix report
    const reportPath = path.join(process.cwd(), '.ares_nexus', 'fix_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Fix report saved: ${reportPath}`);
}
