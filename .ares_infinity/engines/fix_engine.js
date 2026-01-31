#!/usr/bin/env node
/**
 * ARES INFINITY - Intelligent Fix Engine
 * Fixes blank screen causes intelligently
 */

const fs = require('fs');
const path = require('path');

class IntelligentFixEngine {
    constructor(projectRoot) {
        this.root = projectRoot;
        this.reportPath = path.join(projectRoot, '.ares_infinity', 'render_analysis.json');
        this.backupDir = path.join(projectRoot, '.ares_infinity', 'backups', Date.now().toString());
        this.fixesApplied = [];
        this.fixesFailed = [];
        
        fs.mkdirSync(this.backupDir, { recursive: true });
        
        if (!fs.existsSync(this.reportPath)) {
            throw new Error('No analysis report found. Run analysis first.');
        }
        
        this.report = JSON.parse(fs.readFileSync(this.reportPath, 'utf8'));
    }
    
    async fixAllIssues() {
        console.log('🔧 ARES INFINITY - Applying Intelligent Fixes');
        console.log('='.repeat(60));
        
        // Fix critical issues first
        await this.fixCriticalIssues();
        
        // Fix CSS issues
        await this.fixCSSIssues();
        
        // Fix provider issues
        await this.fixProviderIssues();
        
        // Fix stray text
        await this.fixStrayText();
        
        // Fix missing files
        await this.fixMissingFiles();
        
        return this.generateReport();
    }
    
    async fixCriticalIssues() {
        const critical = [
            ...(this.report.issues || []),
            ...(this.report.criticalIssues || [])
        ].filter(i => i.severity === 'critical');
        
        console.log(`Fixing ${critical.length} critical issues...`);
        
        for (const issue of critical) {
            try {
                console.log(`  Fixing: ${issue.type} in ${issue.file || 'project'}`);
                
                switch (issue.type) {
                    case 'missing_critical_file':
                        await this.fixMissingCriticalFile(issue);
                        break;
                        
                    case 'missing_root_div':
                        await this.fixMissingRootDiv(issue);
                        break;
                        
                    case 'missing_reactdom_render':
                        await this.fixMissingReactDOMRender(issue);
                        break;
                        
                    case 'missing_app_import':
                        await this.fixMissingAppImport(issue);
                        break;
                        
                    case 'missing_default_export':
                        await this.fixMissingDefaultExport(issue);
                        break;
                        
                    case 'missing_jsx_return':
                        await this.fixMissingJSXReturn(issue);
                        break;
                        
                    case 'stray_text':
                        await this.fixStrayTextIssue(issue);
                        break;
                        
                    default:
                        console.log(`  ⚠️  No fix for ${issue.type}`);
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
    
    async fixCSSIssues() {
        const cssIssues = this.report.cssIssues || [];
        console.log(`Fixing ${cssIssues.length} CSS issues...`);
        
        for (const issue of cssIssues) {
            try {
                if (issue.type === 'css_hiding_root') {
                    await this.fixCSSHidingRoot(issue);
                } else if (issue.type === 'inline_style_hiding') {
                    await this.fixInlineStyleHiding(issue);
                }
            } catch (error) {
                this.fixesFailed.push({ issue, error: error.message });
            }
        }
    }
    
    async fixProviderIssues() {
        const providerIssues = this.report.providerIssues || [];
        console.log(`Fixing ${providerIssues.length} provider issues...`);
        
        for (const issue of providerIssues) {
            try {
                if (issue.type === 'provider_side_effect') {
                    await this.fixProviderSideEffect(issue);
                }
            } catch (error) {
                this.fixesFailed.push({ issue, error: error.message });
            }
        }
    }
    
    async fixStrayText() {
        const strayTextIssues = [
            ...(this.report.issues || []),
            ...(this.report.criticalIssues || [])
        ].filter(i => i.type === 'stray_text');
        
        for (const issue of strayTextIssues) {
            await this.fixStrayTextIssue(issue);
        }
    }
    
    async fixMissingFiles() {
        // Check for missing critical files
        const criticalFiles = [
            { path: 'package.json', create: this.createPackageJson.bind(this) },
            { path: 'index.html', create: this.createIndexHtml.bind(this) },
            { path: 'src/main.jsx', create: this.createMainJsx.bind(this) },
            { path: 'src/App.jsx', create: this.createAppJsx.bind(this) }
        ];
        
        for (const file of criticalFiles) {
            const fullPath = path.join(this.root, file.path);
            if (!fs.existsSync(fullPath)) {
                console.log(`Creating missing: ${file.path}`);
                await file.create(fullPath);
            }
        }
    }
    
    async fixMissingCriticalFile(issue) {
        const filePath = path.join(this.root, issue.file);
        
        if (issue.file === 'package.json') {
            await this.createPackageJson(filePath);
        } else if (issue.file === 'index.html') {
            await this.createIndexHtml(filePath);
        } else if (issue.file === 'src/main.jsx') {
            await this.createMainJsx(filePath);
        } else if (issue.file === 'src/App.jsx') {
            await this.createAppJsx(filePath);
        }
    }
    
    async createPackageJson(filePath) {
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
        
        this.createBackup(filePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2));
        
        this.fixesApplied.push({
            type: 'created_package_json',
            file: 'package.json',
            action: 'Created package.json with React setup'
        });
    }
    
    async createIndexHtml(filePath) {
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
        
        this.createBackup(filePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, html);
        
        this.fixesApplied.push({
            type: 'created_index_html',
            file: 'index.html',
            action: 'Created index.html with root div'
        });
    }
    
    async createMainJsx(filePath) {
        const mainJsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
        
        this.createBackup(filePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, mainJsx);
        
        this.fixesApplied.push({
            type: 'created_main_jsx',
            file: 'src/main.jsx',
            action: 'Created main.jsx with ReactDOM render'
        });
    }
    
    async createAppJsx(filePath) {
        const appJsx = `import React from 'react';

function App() {
  return (
    <div className="App" style={{ minHeight: '100vh', padding: '20px' }}>
      <h1>Arvdoul Application</h1>
      <p>If you can see this, the app is rendering correctly.</p>
      <p>Check your components and logic for issues.</p>
    </div>
  );
}

export default App;`;
        
        this.createBackup(filePath);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, appJsx);
        
        this.fixesApplied.push({
            type: 'created_app_jsx',
            file: 'src/App.jsx',
            action: 'Created App.jsx with visible content'
        });
    }
    
    async fixMissingRootDiv(issue) {
        const filePath = path.join(this.root, 'index.html');
        if (!fs.existsSync(filePath)) {
            await this.createIndexHtml(filePath);
            return;
        }
        
        this.createBackup(filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add root div if missing
        if (!content.includes('id="root"') && !content.includes('id="app"')) {
            if (content.includes('</body>')) {
                content = content.replace('</body>', '  <div id="root"></div>\n</body>');
            } else if (content.includes('<body>')) {
                content = content.replace('<body>', '<body>\n  <div id="root"></div>');
            }
        }
        
        // Add script tag if missing
        if (!content.includes('<script type="module"')) {
            if (content.includes('</body>')) {
                content = content.replace('</body>', '  <script type="module" src="/src/main.jsx"></script>\n</body>');
            }
        }
        
        fs.writeFileSync(filePath, content);
        
        this.fixesApplied.push({
            type: 'fixed_root_div',
            file: 'index.html',
            action: 'Added root div and script tag'
        });
    }
    
    async fixMissingReactDOMRender(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) {
            await this.createMainJsx(filePath);
            return;
        }
        
        this.createBackup(filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Add React import if missing
        if (!content.includes('import React')) {
            lines.unshift("import React from 'react';");
        }
        
        // Add ReactDOM import if missing
        if (!content.includes('import ReactDOM')) {
            // Find last import
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
        }
        
        // Add render call at the end if missing
        if (!content.includes('ReactDOM.createRoot') && !content.includes('ReactDOM.render')) {
            lines.push('');
            lines.push('ReactDOM.createRoot(document.getElementById("root")).render(');
            lines.push('  <React.StrictMode>');
            lines.push('    <App />');
            lines.push('  </React.StrictMode>');
            lines.push(');');
        }
        
        fs.writeFileSync(filePath, lines.join('\n'));
        
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
        
        // Add App import
        if (!content.includes('import App')) {
            // Find last import
            let lastImportIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith('import ')) {
                    lastImportIndex = i;
                }
            }
            
            const importLine = "import App from './App.jsx';";
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
    
    async fixMissingDefaultExport(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Add default export if missing
        if (!content.includes('export default')) {
            content += '\n\nexport default App;';
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
        
        // Look for function App
        const functionMatch = content.match(/function\s+App\s*\([^)]*\)\s*\{([\s\S]*?)\}/);
        if (functionMatch) {
            const functionBody = functionMatch[1];
            
            // If no return statement, add one
            if (!functionBody.includes('return')) {
                const newBody = `\n  return (\n    <div className="App" style={{ minHeight: '100vh', padding: '20px' }}>\n      <h1>Arvdoul Application</h1>\n      <p>App component is now rendering.</p>\n    </div>\n  );`;
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
    
    async fixStrayTextIssue(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        if (issue.line && issue.line <= lines.length) {
            const lineIndex = issue.line - 1;
            const original = lines[lineIndex].trim();
            
            // Only comment if not already a comment
            if (!original.startsWith('//') && !original.startsWith('/*')) {
                lines[lineIndex] = `// ARES INFINITY: Fixed stray text - ${original}`;
            }
        } else {
            // Try to find and fix anywhere
            for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim();
                if (this.isStrayText(trimmed)) {
                    lines[i] = `// ARES INFINITY: Fixed stray text - ${trimmed}`;
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
    
    async fixCSSHidingRoot(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Fix common hiding patterns
        content = content
            .replace(/(#root|#app|\\.app|\\.App)[^{]*{[^}]*display:\\s*none[^}]*}/gi, '$1 { /* ARES: Removed display: none */ }')
            .replace(/(#root|#app|\\.app|\\.App)[^{]*{[^}]*visibility:\\s*hidden[^}]*}/gi, '$1 { /* ARES: Removed visibility: hidden */ }')
            .replace(/(#root|#app|\\.app|\\.App)[^{]*{[^}]*opacity:\\s*0[^}]*}/gi, '$1 { /* ARES: Changed opacity to 1 */ opacity: 1; }')
            .replace(/(#root|#app|\\.app|\\.App)[^{]*{[^}]*height:\\s*0[^}]*}/gi, '$1 { /* ARES: Changed height to auto */ height: auto; }')
            .replace(/(#root|#app|\\.app|\\.App)[^{]*{[^}]*z-index:\\s*-?\\d+[^}]*}/gi, '$1 { /* ARES: Fixed z-index */ z-index: 1; }');
        
        fs.writeFileSync(filePath, content);
        
        this.fixesApplied.push({
            type: 'fixed_css_hiding',
            file: issue.file,
            action: 'Fixed CSS that might hide content'
        });
    }
    
    async fixInlineStyleHiding(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Comment out inline display: none
        content = content
            .replace(/style={{[^}]*display:\\s*['"]none['"][^}]*}}/g, 'style={{ /* ARES: Removed display: none */ }}')
            .replace(/style={{[^}]*visibility:\\s*['"]hidden['"][^}]*}}/g, 'style={{ /* ARES: Removed visibility: hidden */ }}');
        
        fs.writeFileSync(filePath, content);
        
        this.fixesApplied.push({
            type: 'fixed_inline_style',
            file: issue.file,
            action: 'Fixed inline style hiding'
        });
    }
    
    async fixProviderSideEffect(issue) {
        const filePath = path.join(this.root, issue.file);
        if (!fs.existsSync(filePath)) return;
        
        this.createBackup(filePath);
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        if (issue.line && issue.line <= lines.length) {
            const lineIndex = issue.line - 1;
            const line = lines[lineIndex];
            
            // Wrap localStorage/sessionStorage access in window check
            if (line.includes('localStorage') || line.includes('sessionStorage')) {
                lines[lineIndex] = `  if (typeof window !== 'undefined') {\n    ${line}\n  }`;
            }
        }
        
        fs.writeFileSync(filePath, lines.join('\n'));
        
        this.fixesApplied.push({
            type: 'fixed_provider_side_effect',
            file: issue.file,
            line: issue.line,
            action: 'Wrapped side effect in window check'
        });
    }
    
    isStrayText(text) {
        return text && 
               /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(text) &&
               !text.startsWith('//') &&
               !text.startsWith('/*') &&
               !text.startsWith('import') &&
               !text.startsWith('export') &&
               !text.startsWith('function') &&
               !text.startsWith('const') &&
               !text.startsWith('let') &&
               !text.startsWith('var') &&
               !text.startsWith('class') &&
               !text.includes('=') &&
               !text.includes('{') &&
               !text.includes('}') &&
               !text.includes('(') &&
               !text.includes(')');
    }
    
    createBackup(filePath) {
        if (!fs.existsSync(filePath)) return;
        
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
                successRate: this.fixesApplied.length / (this.fixesApplied.length + this.fixesFailed.length) || 0
            }
        };
    }
}

// CLI execution
if (require.main === module) {
    const engine = new IntelligentFixEngine(process.cwd());
    
    engine.fixAllIssues().then(report => {
        console.log('\n' + '='.repeat(60));
        console.log('✅ ARES INFINITY - FIXES COMPLETE');
        console.log('='.repeat(60) + '\n');
        
        console.log(`🔧 Fixes applied: ${report.fixesApplied.length}`);
        console.log(`❌ Fixes failed: ${report.fixesFailed.length}`);
        console.log(`📁 Backup directory: ${report.backupDir}`);
        
        if (report.fixesApplied.length > 0) {
            console.log('\n✅ SUCCESSFUL FIXES:');
            console.log('-' .repeat(40));
            report.fixesApplied.forEach((fix, index) => {
                console.log(`${index + 1}. ${fix.type}`);
                console.log(`   File: ${fix.file || 'N/A'}`);
                console.log(`   Action: ${fix.action}`);
                if (fix.line) {
                    console.log(`   Line: ${fix.line}`);
                }
                console.log('');
            });
        }
        
        if (report.fixesFailed.length > 0) {
            console.log('\n❌ FAILED FIXES:');
            console.log('-' .repeat(40));
            report.fixesFailed.forEach((fail, index) => {
                console.log(`${index + 1}. ${fail.issue?.type || 'unknown'}`);
                console.log(`   Reason: ${fail.error || fail.reason}`);
                console.log('');
            });
        }
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Run: npm run build');
        console.log('2. Run: npm run dev');
        console.log('3. Check if blank screen is fixed');
        console.log('4. If still blank, check:');
        console.log('   • Component logic in App.jsx');
        console.log('   • State and useEffect hooks');
        console.log('   • Async data loading');
        console.log('   • Browser console for errors');
        
        // Save fix report
        const fixReportPath = path.join(process.cwd(), '.ares_infinity', 'fix_report.json');
        fs.writeFileSync(fixReportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Fix report saved: ${fixReportPath}`);
        
    }).catch(error => {
        console.error('❌ Fix engine failed:', error.message);
        process.exit(1);
    });
}
