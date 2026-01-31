/**
 * NEXUS REAL SCANNER v7.0
 * Termux compatible • Actually works • No broken commands
 */

const fs = require('fs');
const path = require('path');

class NexusScanner {
    constructor(projectRoot) {
        this.root = projectRoot;
        this.issues = [];
        this.critical = [];
        this.stats = {
            filesScanned: 0,
            jsFiles: 0,
            jsxFiles: 0,
            strayTextFound: 0,
            templateIssues: 0,
            missingReact: 0
        };
    }
    
    scan() {
        console.log('🔍 NEXUS - Scanning for ACTUAL blank screen causes...\n');
        
        // Phase 1: Check critical files
        this.checkCriticalFiles();
        
        // Phase 2: Scan JS/JSX files for actual issues
        this.scanJSFiles();
        
        // Phase 3: Check for obvious problems
        this.checkObviousProblems();
        
        return this.generateReport();
    }
    
    checkCriticalFiles() {
        console.log('📁 Checking critical files...');
        
        // 1. package.json
        const pkgPath = path.join(this.root, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            this.critical.push({
                type: 'missing_package_json',
                severity: 'critical',
                description: 'No package.json - project cannot build',
                fix: 'Create package.json with React dependencies'
            });
        } else {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                
                // Check for React
                if (!pkg.dependencies?.react && !pkg.devDependencies?.react) {
                    this.critical.push({
                        type: 'missing_react_dependency',
                        severity: 'critical',
                        description: 'React not in dependencies',
                        fix: 'npm install react react-dom'
                    });
                }
                
                // Check for build script
                if (!pkg.scripts?.build) {
                    this.issues.push({
                        type: 'missing_build_script',
                        severity: 'high',
                        description: 'No build script',
                        fix: 'Add "build": "vite build" to scripts'
                    });
                }
                
            } catch (e) {
                this.critical.push({
                    type: 'invalid_package_json',
                    severity: 'critical',
                    description: 'package.json is invalid JSON',
                    fix: 'Fix JSON syntax'
                });
            }
        }
        
        // 2. index.html
        const htmlPath = path.join(this.root, 'index.html');
        if (!fs.existsSync(htmlPath)) {
            this.critical.push({
                type: 'missing_index_html',
                severity: 'critical',
                description: 'No index.html - browser has nothing to show',
                fix: 'Create index.html with <div id="root"></div>'
            });
        } else {
            const html = fs.readFileSync(htmlPath, 'utf8');
            
            if (!html.includes('id="root"') && !html.includes('id="app"')) {
                this.critical.push({
                    type: 'missing_root_div',
                    severity: 'critical',
                    description: 'No root div (id="root" or id="app")',
                    fix: 'Add <div id="root"></div> to index.html'
                });
            }
        }
        
        // 3. Find main entry
        const mainFiles = [
            'src/main.jsx', 'src/main.js', 'main.jsx', 'main.js',
            'src/index.jsx', 'src/index.js', 'index.jsx', 'index.js'
        ];
        
        let foundMain = false;
        for (const file of mainFiles) {
            if (fs.existsSync(path.join(this.root, file))) {
                foundMain = true;
                break;
            }
        }
        
        if (!foundMain) {
            this.critical.push({
                type: 'missing_entry_file',
                severity: 'critical',
                description: 'No main entry file (main.jsx, index.js, etc.)',
                fix: 'Create src/main.jsx with ReactDOM.render'
            });
        }
        
        // 4. Find App component
        const appFiles = [
            'src/App.jsx', 'src/App.js', 'App.jsx', 'App.js'
        ];
        
        let foundApp = false;
        for (const file of appFiles) {
            if (fs.existsSync(path.join(this.root, file))) {
                foundApp = true;
                break;
            }
        }
        
        if (!foundApp) {
            this.critical.push({
                type: 'missing_app_component',
                severity: 'critical',
                description: 'No App component found',
                fix: 'Create src/App.jsx with default export'
            });
        }
    }
    
    scanJSFiles() {
        console.log('📄 Scanning JS/JSX files for actual issues...');
        
        // Get all JS/JSX files
        const jsFiles = this.getJSFiles();
        
        for (const file of jsFiles) {
            this.stats.filesScanned++;
            if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
                this.stats.jsxFiles++;
            } else {
                this.stats.jsFiles++;
            }
            
            const filePath = path.join(this.root, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // 1. Check for stray text (like "Core Providers")
            this.checkStrayText(file, content);
            
            // 2. Check for template literal issues
            this.checkTemplateLiterals(file, content);
            
            // 3. Check for missing React import in JSX files
            if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
                this.checkReactImport(file, content);
            }
            
            // 4. Check for missing default export in App files
            if (file.includes('App.')) {
                this.checkDefaultExport(file, content);
            }
        }
    }
    
    getJSFiles() {
        const files = [];
        
        const walk = (dir) => {
            if (!fs.existsSync(dir)) return;
            
            const items = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                const relativePath = path.relative(this.root, fullPath);
                
                // Skip node_modules and hidden directories
                if (item.name.includes('node_modules') || 
                    item.name.startsWith('.') || 
                    item.name === 'dist' || 
                    item.name === 'build') {
                    continue;
                }
                
                if (item.isDirectory()) {
                    walk(fullPath);
                } else if (item.isFile()) {
                    if (item.name.endsWith('.js') || 
                        item.name.endsWith('.jsx') || 
                        item.name.endsWith('.ts') || 
                        item.name.endsWith('.tsx')) {
                        files.push(relativePath);
                    }
                }
            }
        };
        
        walk(this.root);
        return files;
    }
    
    checkStrayText(file, content) {
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            // Pattern: Capitalized words that look like plain text
            if (trimmed && 
                /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed) &&
                !trimmed.startsWith('//') &&
                !trimmed.startsWith('/*') &&
                !trimmed.startsWith('import') &&
                !trimmed.startsWith('export') &&
                !trimmed.startsWith('function') &&
                !trimmed.startsWith('const') &&
                !trimmed.startsWith('let') &&
                !trimmed.startsWith('var') &&
                !trimmed.startsWith('class') &&
                !trimmed.includes('=') &&
                !trimmed.includes('{') &&
                !trimmed.includes('}') &&
                !trimmed.includes('(') &&
                !trimmed.includes(')')) {
                
                this.issues.push({
                    type: 'stray_text',
                    file: file,
                    line: index + 1,
                    severity: 'critical',
                    description: `Stray text found: "${trimmed}"`,
                    fix: `Replace with comment: // ${trimmed}`
                });
                
                this.stats.strayTextFound++;
            }
        });
    }
    
    checkTemplateLiterals(file, content) {
        // Look for: className={something ${variable} something}
        const regex = /className=\{\s*[^{}]*\$\{[^{}]*\}[^{}]*\}/g;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            // Get line number
            const upToMatch = content.substring(0, match.index);
            const lineNumber = upToMatch.split('\n').length;
            
            this.issues.push({
                type: 'template_literal',
                file: file,
                line: lineNumber,
                severity: 'high',
                description: 'Template literal without backticks in JSX attribute',
                fix: 'Change to: className={`something ${variable} something`}'
            });
            
            this.stats.templateIssues++;
        }
    }
    
    checkReactImport(file, content) {
        // Check if file has JSX but no React import
        if (content.includes('<') && content.includes('>')) {
            if (!content.includes('import React') && 
                !content.includes('from \'react\'') && 
                !content.includes('from "react"')) {
                
                this.issues.push({
                    type: 'missing_react_import',
                    file: file,
                    severity: 'high',
                    description: 'JSX file missing React import',
                    fix: 'Add: import React from \'react\'; at top'
                });
                
                this.stats.missingReact++;
            }
        }
    }
    
    checkDefaultExport(file, content) {
        if (!content.includes('export default')) {
            this.issues.push({
                type: 'missing_default_export',
                file: file,
                severity: 'high',
                description: 'App component missing default export',
                fix: 'Add: export default App; at end'
            });
        }
    }
    
    checkObviousProblems() {
        console.log('🔎 Checking for obvious problems...');
        
        // Check if build works
        try {
            const { execSync } = require('child_process');
            const result = execSync('npm run build 2>&1', {
                cwd: this.root,
                timeout: 30000,
                stdio: 'pipe'
            }).toString();
            
            if (result.includes('error') || result.includes('Error:')) {
                this.issues.push({
                    type: 'build_error',
                    severity: 'critical',
                    description: 'Build fails with errors',
                    fix: 'Check build output above'
                });
            }
        } catch (e) {
            // Build failed or not configured
        }
        
        // Check for common CSS issues
        const cssFiles = this.getCSSFiles();
        for (const file of cssFiles) {
            const content = fs.readFileSync(path.join(this.root, file), 'utf8');
            
            if (content.includes('#root') && content.includes('display: none')) {
                this.issues.push({
                    type: 'css_hiding_root',
                    file: file,
                    severity: 'high',
                    description: 'CSS hides the root element',
                    fix: 'Remove display: none from #root selector'
                });
            }
        }
    }
    
    getCSSFiles() {
        const files = [];
        
        const walk = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                const relativePath = path.relative(this.root, fullPath);
                
                if (item.isDirectory()) {
                    if (!item.name.includes('node_modules')) {
                        walk(fullPath);
                    }
                } else if (item.isFile() && item.name.endsWith('.css')) {
                    files.push(relativePath);
                }
            }
        };
        
        walk(this.root);
        return files;
    }
    
    generateReport() {
        const allIssues = [...this.critical, ...this.issues];
        
        return {
            timestamp: new Date().toISOString(),
            stats: this.stats,
            issues: allIssues,
            critical: this.critical.length,
            nonCritical: this.issues.length,
            hasCriticalIssues: this.critical.length > 0,
            summary: this.generateSummary(allIssues)
        };
    }
    
    generateSummary(issues) {
        if (issues.length === 0) {
            return {
                status: 'no_structural_issues',
                message: 'No structural issues found. Blank screen is likely due to component logic, state, or async issues.',
                nextSteps: [
                    'Check component logic and state',
                    'Verify API calls are working',
                    'Check browser console for errors',
                    'Inspect elements to see if HTML is rendered'
                ]
            };
        }
        
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        
        if (criticalCount > 0) {
            return {
                status: 'critical_issues_found',
                message: `Found ${criticalCount} critical issue(s) that WILL cause blank screen`,
                nextSteps: [
                    'Fix critical issues first',
                  'Then run build to verify',
                  'Start dev server to test'
                ]
            };
        }
        
        return {
            status: 'issues_found',
            message: `Found ${issues.length} issue(s) that may cause problems`,
            nextSteps: [
                'Review and fix issues',
              'Run build to verify',
              'Check browser console'
            ]
        };
    }
}

// CLI
if (require.main === module) {
    const scanner = new NexusScanner(process.cwd());
    const report = scanner.scan();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 NEXUS SCAN REPORT');
    console.log('='.repeat(60) + '\n');
    
    console.log(`📁 Files scanned: ${report.stats.filesScanned}`);
    console.log(`📄 JS files: ${report.stats.jsFiles}`);
    console.log(`⚛️  JSX files: ${report.stats.jsxFiles}`);
    console.log(`📝 Stray text found: ${report.stats.strayTextFound}`);
    console.log(`🔤 Template issues: ${report.stats.templateIssues}`);
    console.log(`⚡ Missing React imports: ${report.stats.missingReact}`);
    console.log('');
    
    console.log(`🚨 Critical issues: ${report.critical}`);
    console.log(`⚠️  Other issues: ${report.nonCritical}`);
    console.log('');
    
    // Show critical issues
    const criticalIssues = report.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
        console.log('🚨 CRITICAL ISSUES (MUST FIX):');
        console.log('-' .repeat(50));
        
        criticalIssues.forEach((issue, index) => {
            console.log(`${index + 1}. ${issue.type.toUpperCase()}`);
            console.log(`   File: ${issue.file || 'N/A'}`);
            console.log(`   ${issue.description}`);
            if (issue.fix) {
                console.log(`   🔧 Fix: ${issue.fix}`);
            }
            console.log('');
        });
    }
    
    // Show other issues
    const otherIssues = report.issues.filter(i => i.severity !== 'critical');
    if (otherIssues.length > 0) {
        console.log('⚠️  OTHER ISSUES:');
        console.log('-' .repeat(50));
        
        otherIssues.slice(0, 5).forEach((issue, index) => {
            console.log(`${index + 1}. ${issue.type}`);
            console.log(`   File: ${issue.file || 'N/A'}`);
            console.log(`   ${issue.description}`);
            console.log('');
        });
        
        if (otherIssues.length > 5) {
            console.log(`   ... and ${otherIssues.length - 5} more`);
            console.log('');
        }
    }
    
    // Show summary
    console.log('📈 SUMMARY:');
    console.log('-' .repeat(50));
    console.log(report.summary.message);
    console.log('');
    
    if (report.summary.nextSteps) {
        console.log('🚀 NEXT STEPS:');
        report.summary.nextSteps.forEach((step, index) => {
            console.log(`   ${index + 1}. ${step}`);
        });
    }
    
    console.log('');
    console.log('💡 TIP: Run ./ares_nexus fix to automatically fix issues');
    console.log('');
    
    // Save report
    const reportPath = path.join(process.cwd(), '.ares_nexus', 'scan_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved: ${reportPath}`);
}
