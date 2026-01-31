/**
 * ARES OMEGA FIX ENGINE
 * Platform-grade fixes for everything found
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class OmegaFixEngine {
    constructor(projectRoot, scanReport) {
        this.root = projectRoot;
        this.report = scanReport;
        this.backupDir = path.join(projectRoot, '.ares_omega', 'backups', Date.now().toString());
        this.fixesApplied = [];
        this.fixesFailed = [];
        this.backupsCreated = [];
        
        fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    async applyAllFixes() {
        console.log('🔧 ARES OMEGA - Applying platform-grade fixes...');
        console.log('=' .repeat(60));
        
        // Apply fixes by category
        await this.fixCriticalIssues();
        await this.fixBuildIssues();
        await this.fixImportIssues();
        await this.fixSyntaxIssues();
        
        // Generate fix report
        return this.generateReport();
    }
    
    async fixCriticalIssues() {
        const critical = this.report.criticalIssues.filter(i => i.severity === 'critical');
        
        for (const issue of critical) {
            try {
                console.log(`Fixing critical: ${issue.type} in ${issue.file || 'project'}`);
                
                switch (issue.type) {
                    case 'missing_critical_file':
                        await this.fixMissingFile(issue);
                        break;
                        
                    case 'missing_root_element':
                        await this.fixMissingRootElement(issue);
                        break;
                        
                    case 'missing_reactdom_render':
                        await this.fixMissingReactDOMRender(issue);
                        break;
                        
                    case 'missing_app_import':
                        await this.fixMissingAppImport(issue);
                        break;
                        
                    case 'stray_text':
                        await this.fixStrayText(issue);
                        break;
                        
                    case 'missing_default_export':
                        await this.fixMissingDefaultExport(issue);
                        break;
                        
                    case 'missing_jsx_return':
                        await this.fixMissingJSXReturn(issue);
                        break;
                        
                    default:
                        console.log(`  ⚠️  No fix available for ${issue.type}`);
                        this.fixesFailed.push({
                            issue,
                            reason: 'No fix implementation'
                        });
                }
                
            } catch (error) {
                this.fixesFailed.push({
                    issue,
                    error: error.message
                });
                console.log(`  ❌ Failed: ${error.message}`);
            }
        }
    }
    
    async fixBuildIssues() {
        const buildIssues = this.report.buildIssues.filter(i => i.severity === 'critical');
        
        for (const issue of buildIssues) {
            try {
                console.log(`Fixing build: ${issue.type}`);
                
                switch (issue.type) {
                    case 'missing_module':
                        await this.fixMissingModule(issue);
                        break;
                        
                    case 'syntax_error':
                        // Already handled by stray text fix
                        break;
                        
                    default:
                        // Skip unknown build issues
                }
                
            } catch (error) {
                this.fixesFailed.push({ issue, error: error.message });
            }
        }
    }
    
    async fixImportIssues() {
        const importIssues = this.report.importIssues || [];
        
        for (const issue of importIssues) {
            if (issue.type === 'missing_react_import') {
                await this.fixMissingReactImport(issue);
            }
        }
    }
    
    async fixSyntaxIssues() {
        // Fix stray text in all files
        const strayTextIssues = [
            ...(this.report.criticalIssues || []),
            ...(this.report.importIssues || []),
            ...(this.report.renderBlockers || [])
        ].filter(i => i.type === 'stray_text');
        
        for (const issue of strayTextIssues) {
            await this.fixStrayText(issue);
        }
    }
    
    async fixMissingFile(issue) {
        const filePath = path.join(this.root, issue.file);
        
        if (issue.file === 'package.json') {
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
                    "react-dom": "^18.2.0"
                },
                devDependencies: {
                    "@vitejs/plugin-react": "^4.0.0",
                    "vite": "^4.4.0"
                }
            };
            
            fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2));
            this.fixesApplied.push({
                type: 'created_file',
                file: issue.file,
                action: 'Created package.json with React setup'
            });
            
        } else if (issue.file === 'index.html') {
            const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Arvdoul</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
            
            fs.writeFileSync(filePath, html);
            this.fixesApplied.push({
                type: 'created_file',
                file: issue.file,
                action: 'Created index.html with root div'
            });
            
        } else if (issue.file === 'src/main.jsx') {
            const mainJsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
            
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, mainJsx);
            this.fixesApplied.push({
                type: 'created_file',
                file: issue.file,
                action: 'Created main.jsx with ReactDOM render'
            });
            
        } else if (issue.file === 'src/App.jsx') {
            const appJsx = `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Arvdoul</h1>
      <p>App component loaded successfully</p>
    </div>
  );
}

export default App;`;
            
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, appJsx);
            this.fixesApplied.push({
                type: 'created_file',
                file: issue.file,
                action: 'Created App.jsx with default export'
            });
        }
    }
    
    async fixMissingRootElement(issue) {
        const filePath = path.join(this.root, 'index.html');
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if body exists
        if (!content.includes('<body>')) {
            content = content.replace('</head>', '</head>\n<body>\n</body>');
        }
        
        // Add root div
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/);
        if (bodyMatch) {
            const bodyContent = bodyMatch[1];
            if (!bodyContent.includes('id="root"') && !bodyContent.includes('id="app"')) {
                content = content.replace(
                    bodyMatch[0],
                    `<body>${bodyMatch[1]}\n<div id="root"></div>\n</body>`
                );
            }
        } else {
            // Simple replacement
            content = content.replace('</body>', '  <div id="root"></div>\n</body>');
        }
        
        // Ensure script tag
        if (!content.includes('<script type="module"')) {
            content = content.replace('</body>', '  <script type="module" src="/src/main.jsx"></script>\n</body>');
        }
        
        fs.writeFileSync(filePath, content);
        this.fixesApplied.push({
            type: 'fixed_root_element',
            file: 'index.html',
            action: 'Added root div and script tag'
        });
    }
    
    async fixMissingReactDOMRender(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add React import if missing
        if (!content.includes('import React')) {
            content = 'import React from \'react\';\n' + content;
        }
        
        // Add ReactDOM import
        if (!content.includes('import ReactDOM')) {
            // Find last import
            const lines = content.split('\n');
            let lastImportIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('import ')) {
                    lastImportIndex = i;
                }
            }
            
            if (lastImportIndex >= 0) {
                lines.splice(lastImportIndex + 1, 0, "import ReactDOM from 'react-dom/client';");
            } else {
                lines.unshift("import ReactDOM from 'react-dom/client';");
            }
            content = lines.join('\n');
        }
        
        // Add render call at the end
        if (!content.includes('ReactDOM.createRoot') && !content.includes('ReactDOM.render')) {
            content += '\n\nReactDOM.createRoot(document.getElementById(\'root\')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);';
        }
        
        fs.writeFileSync(filePath, content);
        this.fixesApplied.push({
            type: 'fixed_reactdom_render',
            file: issue.file,
            action: 'Added ReactDOM render setup'
        });
    }
    
    async fixMissingAppImport(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Find last import
        let lastImportIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('import ')) {
                lastImportIndex = i;
            }
        }
        
        // Add App import
        const importLine = "import App from './App.jsx';";
        if (!content.includes('import App')) {
            if (lastImportIndex >= 0) {
                lines.splice(lastImportIndex + 1, 0, importLine);
            } else {
                lines.unshift(importLine);
            }
        }
        
        fs.writeFileSync(filePath, lines.join('\n'));
        this.fixesApplied.push({
            type: 'fixed_app_import',
            file: issue.file,
            action: 'Added App import'
        });
    }
    
    async fixStrayText(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        if (issue.line && issue.line <= lines.length) {
            const lineIndex = issue.line - 1;
            const original = lines[lineIndex];
            
            // Only comment if it's not already a comment
            if (!original.trim().startsWith('//') && !original.trim().startsWith('/*')) {
                lines[lineIndex] = `// ARES OMEGA: Fixed stray text - ${original.trim()}`;
            }
        } else {
            // Try to find and fix anywhere in file
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (trimmed && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed) &&
                    !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
                    !trimmed.startsWith('import') && !trimmed.startsWith('export') &&
                    !trimmed.startsWith('function') && !trimmed.startsWith('const') &&
                    !trimmed.includes('=') && !trimmed.includes('{') && !trimmed.includes('}')) {
                    
                    lines[i] = `// ARES OMEGA: Fixed stray text - ${trimmed}`;
                }
            }
        }
        
        fs.writeFileSync(filePath, lines.join('\n'));
        this.fixesApplied.push({
            type: 'fixed_stray_text',
            file: issue.file,
            line: issue.line,
            action: 'Commented out stray text'
        });
    }
    
    async fixMissingDefaultExport(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if it has export default at the end
        if (!content.includes('export default')) {
            // Try to find the App function/component
            if (content.includes('function App') || content.includes('const App =') || content.includes('class App')) {
                content += '\n\nexport default App;';
            } else {
                // Add default export at the end
                content += '\n\nexport default App;';
            }
        }
        
        fs.writeFileSync(filePath, content);
        this.fixesApplied.push({
            type: 'fixed_default_export',
            file: issue.file,
            action: 'Added default export'
        });
    }
    
    async fixMissingJSXReturn(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Check if function returns JSX
        const functionMatch = content.match(/function\s+App\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
        if (functionMatch) {
            const functionBody = functionMatch[1];
            
            // If no return statement, add one
            if (!functionBody.includes('return')) {
                const newBody = `\n  return (\n    <div className="App">\n      <h1>Arvdoul</h1>\n      <p>Application loaded</p>\n    </div>\n  );`;
                content = content.replace(functionMatch[0], functionMatch[0].replace(functionBody, newBody));
            }
        }
        
        fs.writeFileSync(filePath, content);
        this.fixesApplied.push({
            type: 'fixed_jsx_return',
            file: issue.file,
            action: 'Added JSX return statement'
        });
    }
    
    async fixMissingModule(issue) {
        console.log('📦 Installing missing modules...');
        
        try {
            const { execSync } = require('child_process');
            execSync('npm install', {
                cwd: this.root,
                stdio: 'inherit',
                timeout: 120000
            });
            
            this.fixesApplied.push({
                type: 'installed_modules',
                action: 'Ran npm install to fix missing modules'
            });
            
        } catch (error) {
            console.log('❌ npm install failed:', error.message);
            this.fixesFailed.push({
                issue,
                error: error.message
            });
        }
    }
    
    async fixMissingReactImport(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add React import at the top
        if (!content.includes('import React')) {
            content = 'import React from \'react\';\n' + content;
        }
        
        fs.writeFileSync(filePath, content);
        this.fixesApplied.push({
            type: 'fixed_react_import',
            file: issue.file,
            action: 'Added React import for JSX'
        });
    }
    
    createBackup(filePath) {
        const relativePath = path.relative(this.root, filePath);
        const backupPath = path.join(this.backupDir, relativePath);
        
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(filePath, backupPath);
        
        this.backupsCreated.push({
            original: filePath,
            backup: backupPath
        });
    }
    
    generateReport() {
        return {
            timestamp: new Date().toISOString(),
            backupDir: this.backupDir,
            fixesApplied: this.fixesApplied,
            fixesFailed: this.fixesFailed,
            backupsCreated: this.backupsCreated.length,
            summary: {
                totalApplied: this.fixesApplied.length,
                totalFailed: this.fixesFailed.length,
                successRate: this.fixesApplied.length / (this.fixesApplied.length + this.fixesFailed.length) || 0
            }
        };
    }
}

// CLI interface
if (require.main === module) {
    const reportPath = path.join(process.cwd(), '.ares_omega', 'deepscan_report.json');
    
    if (!fs.existsSync(reportPath)) {
        console.error('❌ No scan report found. Run deep scan first.');
        process.exit(1);
    }
    
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const engine = new OmegaFixEngine(process.cwd(), report);
    
    engine.applyAllFixes().then(fixReport => {
        console.log('\n' + '='.repeat(60));
        console.log('✅ ARES OMEGA - FIXES COMPLETE');
        console.log('='.repeat(60) + '\n');
        
        console.log(`🔧 Fixes applied: ${fixReport.fixesApplied.length}`);
        console.log(`❌ Fixes failed: ${fixReport.fixesFailed.length}`);
        console.log(`💾 Backups created: ${fixReport.backupsCreated}`);
        console.log(`📁 Backup directory: ${fixReport.backupDir}`);
        
        if (fixReport.fixesApplied.length > 0) {
            console.log('\n✅ SUCCESSFUL FIXES:');
            console.log('-' .repeat(40));
            fixReport.fixesApplied.forEach((fix, index) => {
                console.log(`${index + 1}. ${fix.type}`);
                console.log(`   File: ${fix.file || 'N/A'}`);
                console.log(`   Action: ${fix.action}`);
                console.log('');
            });
        }
        
        if (fixReport.fixesFailed.length > 0) {
            console.log('\n❌ FAILED FIXES:');
            console.log('-' .repeat(40));
            fixReport.fixesFailed.forEach((fail, index) => {
                console.log(`${index + 1}. ${fail.issue?.type || 'unknown'}`);
                console.log(`   Reason: ${fail.error || fail.reason}`);
                console.log('');
            });
        }
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Run: npm run build');
        console.log('2. Run: npm run dev');
        console.log('3. Check if blank screen is fixed');
        console.log('4. If not, check component logic and state');
        
        // Save fix report
        const fixReportPath = path.join(process.cwd(), '.ares_omega', 'fix_report.json');
        fs.writeFileSync(fixReportPath, JSON.stringify(fixReport, null, 2));
        console.log(`\n📄 Fix report saved: ${fixReportPath}`);
        
    }).catch(error => {
        console.error('❌ Fix engine failed:', error.message);
        process.exit(1);
    });
}
