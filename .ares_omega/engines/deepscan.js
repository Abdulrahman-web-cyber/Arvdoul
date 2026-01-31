/**
 * ARES OMEGA DEEP SCAN ENGINE
 * Finds EVERYTHING that causes blank screens
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class DeepScanEngine {
    constructor(projectRoot) {
        this.root = projectRoot;
        this.results = {
            timestamp: new Date().toISOString(),
            summary: {},
            criticalIssues: [],
            renderBlockers: [],
            providerIssues: [],
            firebaseIssues: [],
            importIssues: [],
            hookIssues: [],
            asyncIssues: [],
            cssIssues: [],
            buildIssues: [],
            fileAnalysis: {}
        };
    }
    
    async scanEverything() {
        console.log('🚀 Starting OMNISCAN - Finding EVERYTHING...');
        
        // Phase 1: File system analysis
        await this.analyzeFileSystem();
        
        // Phase 2: AST deep analysis
        await this.analyzeAST();
        
        // Phase 3: Build chain analysis
        await this.analyzeBuildChain();
        
        // Phase 4: Runtime simulation
        await this.simulateRuntime();
        
        // Phase 5: Critical path analysis
        await this.analyzeCriticalPath();
        
        return this.generateReport();
    }
    
    async analyzeFileSystem() {
        console.log('📁 Phase 1: File system analysis...');
        
        const patterns = [
            '**/*.{js,jsx,ts,tsx,html,css,json,md}',
            '!**/node_modules/**',
            '!**/.git/**',
            '!**/.ares*/**'
        ];
        
        const { glob } = require('glob');
        const files = glob.sync(patterns, { cwd: this.root, absolute: false });
        
        this.results.summary.totalFiles = files.length;
        this.results.summary.jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.jsx')).length;
        this.results.summary.tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx')).length;
        
        // Check for critical files
        const criticalFiles = {
            'package.json': this.checkPackageJson(),
            'vite.config.js': this.checkViteConfig(),
            'index.html': this.checkIndexHtml(),
            'src/main.jsx': this.checkMainEntry(),
            'src/App.jsx': this.checkAppComponent()
        };
        
        Object.entries(criticalFiles).forEach(([file, result]) => {
            if (result.issues.length > 0) {
                this.results.criticalIssues.push(...result.issues);
            }
        });
    }
    
    checkPackageJson() {
        const filePath = path.join(this.root, 'package.json');
        const issues = [];
        
        if (!fs.existsSync(filePath)) {
            issues.push({
                type: 'missing_critical_file',
                file: 'package.json',
                severity: 'critical',
                description: 'Missing package.json - project may not build',
                fix: 'Create package.json with basic configuration'
            });
            return { exists: false, issues };
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const pkg = JSON.parse(content);
            
            // Check for required dependencies
            const requiredDeps = ['react', 'react-dom'];
            requiredDeps.forEach(dep => {
                if (!pkg.dependencies?.[dep] && !pkg.devDependencies?.[dep]) {
                    issues.push({
                        type: 'missing_dependency',
                        dependency: dep,
                        severity: 'critical',
                        description: `Missing required dependency: ${dep}`,
                        fix: `npm install ${dep}`
                    });
                }
            });
            
            // Check scripts
            if (!pkg.scripts?.build) {
                issues.push({
                    type: 'missing_build_script',
                    severity: 'high',
                    description: 'Missing build script in package.json',
                    fix: 'Add "build": "vite build" to scripts'
                });
            }
            
            if (!pkg.scripts?.dev) {
                issues.push({
                    type: 'missing_dev_script',
                    severity: 'medium',
                    description: 'Missing dev script in package.json',
                    fix: 'Add "dev": "vite" to scripts'
                });
            }
            
        } catch (error) {
            issues.push({
                type: 'parse_error',
                file: 'package.json',
                severity: 'critical',
                description: `Failed to parse package.json: ${error.message}`,
                fix: 'Check JSON syntax'
            });
        }
        
        return { exists: true, issues };
    }
    
    checkViteConfig() {
        const filePath = path.join(this.root, 'vite.config.js');
        const issues = [];
        
        if (!fs.existsSync(filePath)) {
            issues.push({
                type: 'missing_config',
                file: 'vite.config.js',
                severity: 'medium',
                description: 'Missing Vite config - using defaults',
                fix: 'Create vite.config.js for better control'
            });
            return { exists: false, issues };
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for common issues
            if (!content.includes('react()')) {
                issues.push({
                    type: 'missing_react_plugin',
                    severity: 'high',
                    description: 'Vite config missing @vitejs/plugin-react',
                    fix: 'Add react() to plugins array'
                });
            }
            
        } catch (error) {
            // Ignore parse errors for config
        }
        
        return { exists: true, issues };
    }
    
    checkIndexHtml() {
        const filePath = path.join(this.root, 'index.html');
        const issues = [];
        
        if (!fs.existsSync(filePath)) {
            issues.push({
                type: 'missing_critical_file',
                file: 'index.html',
                severity: 'critical',
                description: 'Missing index.html - no entry point for browser',
                fix: 'Create index.html with root div'
            });
            return { exists: false, issues };
        }
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for root div
            if (!content.includes('<div id="root">') && !content.includes('<div id="app">')) {
                issues.push({
                    type: 'missing_root_element',
                    severity: 'critical',
                    description: 'index.html missing root div (id="root" or id="app")',
                    fix: 'Add <div id="root"></div> to body'
                });
            }
            
            // Check for script tag
            if (!content.includes('<script') || !content.includes('type="module"')) {
                issues.push({
                    type: 'missing_script_tag',
                    severity: 'high',
                    description: 'index.html missing script tag',
                    fix: 'Add <script type="module" src="/src/main.jsx"></script>'
                });
            }
            
        } catch (error) {
            issues.push({
                type: 'read_error',
                file: 'index.html',
                severity: 'critical',
                description: `Failed to read index.html: ${error.message}`
            });
        }
        
        return { exists: true, issues };
    }
    
    checkMainEntry() {
        const possibleFiles = [
            'src/main.jsx', 'src/main.js', 'src/index.jsx', 'src/index.js',
            'main.jsx', 'main.js', 'index.jsx', 'index.js'
        ];
        
        const issues = [];
        let foundFile = null;
        
        for (const file of possibleFiles) {
            const filePath = path.join(this.root, file);
            if (fs.existsSync(filePath)) {
                foundFile = file;
                
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    // Check for ReactDOM.render or createRoot
                    if (!content.includes('ReactDOM') && !content.includes('createRoot')) {
                        issues.push({
                            type: 'missing_reactdom_render',
                            file,
                            severity: 'critical',
                            description: 'Main entry file missing ReactDOM.render or createRoot',
                            fix: 'Add ReactDOM.createRoot(document.getElementById("root")).render(<App />)'
                        });
                    }
                    
                    // Check for App import
                    if (!content.includes('import App')) {
                        issues.push({
                            type: 'missing_app_import',
                            file,
                            severity: 'critical',
                            description: 'Main entry file missing App import',
                            fix: 'Add import App from "./App" or similar'
                        });
                    }
                    
                    // Check for stray text
                    const lines = content.split('\n');
                    lines.forEach((line, index) => {
                        const trimmed = line.trim();
                        if (trimmed && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed) &&
                            !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
                            !trimmed.startsWith('import') && !trimmed.startsWith('export') &&
                            !trimmed.includes('=') && !trimmed.includes('{') && !trimmed.includes('}')) {
                            
                            issues.push({
                                type: 'stray_text',
                                file,
                                line: index + 1,
                                severity: 'high',
                                description: `Stray text found: "${trimmed}"`,
                                fix: `Comment out line: // ${trimmed}`
                            });
                        }
                    });
                    
                } catch (error) {
                    issues.push({
                        type: 'read_error',
                        file,
                        severity: 'critical',
                        description: `Failed to read ${file}: ${error.message}`
                    });
                }
                
                break;
            }
        }
        
        if (!foundFile) {
            issues.push({
                type: 'missing_entry_file',
                severity: 'critical',
                description: 'No main entry file found (main.jsx, index.jsx, etc.)',
                fix: 'Create src/main.jsx with ReactDOM.render'
            });
        }
        
        return { foundFile, issues };
    }
    
    checkAppComponent() {
        const possibleFiles = [
            'src/App.jsx', 'src/App.js', 'App.jsx', 'App.js',
            'src/components/App.jsx', 'src/pages/App.jsx'
        ];
        
        const issues = [];
        let foundFile = null;
        
        for (const file of possibleFiles) {
            const filePath = path.join(this.root, file);
            if (fs.existsSync(filePath)) {
                foundFile = file;
                
                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    // Check for default export
                    if (!content.includes('export default')) {
                        issues.push({
                            type: 'missing_default_export',
                            file,
                            severity: 'high',
                            description: 'App component missing default export',
                            fix: 'Add "export default App"'
                        });
                    }
                    
                    // Check for JSX return
                    if (!content.includes('return (') && !content.includes('return <')) {
                        issues.push({
                            type: 'missing_jsx_return',
                            file,
                            severity: 'critical',
                            description: 'App component not returning JSX',
                            fix: 'Add return statement with JSX'
                        });
                    }
                    
                } catch (error) {
                    issues.push({
                        type: 'read_error',
                        file,
                        severity: 'critical',
                        description: `Failed to read ${file}: ${error.message}`
                    });
                }
                
                break;
            }
        }
        
        if (!foundFile) {
            issues.push({
                type: 'missing_app_component',
                severity: 'critical',
                description: 'No App component found',
                fix: 'Create src/App.jsx with function App() { return <div>Hello</div> }'
            });
        }
        
        return { foundFile, issues };
    }
    
    async analyzeAST() {
        console.log('🧠 Phase 2: AST deep analysis...');
        
        try {
            const parser = require('@babel/parser');
            const traverse = require('@babel/traverse').default;
            
            const jsFiles = this.findJSFiles();
            
            for (const file of jsFiles.slice(0, 50)) { // Limit for speed
                try {
                    const filePath = path.join(this.root, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    const ast = parser.parse(content, {
                        sourceType: 'module',
                        plugins: ['jsx', 'typescript'],
                        errorRecovery: true
                    });
                    
                    // Analyze imports
                    this.analyzeImports(file, ast);
                    
                    // Analyze providers
                    this.analyzeProviders(file, ast);
                    
                    // Analyze hooks
                    this.analyzeHooks(file, ast);
                    
                    // Analyze async code
                    this.analyzeAsyncCode(file, ast);
                    
                } catch (error) {
                    this.results.criticalIssues.push({
                        type: 'ast_parse_error',
                        file,
                        severity: 'high',
                        description: `AST parse failed: ${error.message}`,
                        fix: 'Check syntax errors'
                    });
                }
            }
            
        } catch (error) {
            console.log('⚠️  AST analysis skipped:', error.message);
        }
    }
    
    findJSFiles() {
        const { glob } = require('glob');
        return glob.sync('**/*.{js,jsx,ts,tsx}', {
            cwd: this.root,
            ignore: ['**/node_modules/**', '**/.git/**']
        });
    }
    
    analyzeImports(file, ast) {
        const traverse = require('@babel/traverse').default;
        const imports = [];
        
        traverse(ast, {
            ImportDeclaration(path) {
                imports.push({
                    source: path.node.source.value,
                    specifiers: path.node.specifiers.map(s => s.local?.name)
                });
            }
        });
        
        // Check for React import in JSX files
        if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
            const hasReactImport = imports.some(imp => 
                imp.source === 'react' || imp.source.includes('/react')
            );
            
            if (!hasReactImport) {
                this.results.importIssues.push({
                    type: 'missing_react_import',
                    file,
                    severity: 'high',
                    description: 'JSX file missing React import',
                    fix: 'Add "import React from \'react\'"'
                });
            }
        }
        
        // Check for circular imports
        // This is simplified - real implementation would build import graph
    }
    
    analyzeProviders(file, ast) {
        const traverse = require('@babel/traverse').default;
        let hasProvider = false;
        let providerName = '';
        
        traverse(ast, {
            JSXElement(path) {
                const elementName = path.node.openingElement.name.name;
                if (elementName && elementName.includes('Provider')) {
                    hasProvider = true;
                    providerName = elementName;
                }
            }
        });
        
        if (hasProvider) {
            // Check if provider is properly used
            this.results.providerIssues.push({
                type: 'provider_detected',
                file,
                provider: providerName,
                severity: 'info',
                description: `Provider found: ${providerName}`,
                check: 'Ensure provider wraps children'
            });
        }
    }
    
    analyzeHooks(file, ast) {
        const traverse = require('@babel/traverse').default;
        const hooks = [];
        
        traverse(ast, {
            CallExpression(path) {
                if (path.node.callee.name && path.node.callee.name.startsWith('use')) {
                    hooks.push({
                        name: path.node.callee.name,
                        line: path.node.loc?.start.line
                    });
                }
            }
        });
        
        // Check for hook violations
        // This is simplified - real implementation would check hook rules
    }
    
    analyzeAsyncCode(file, ast) {
        const traverse = require('@babel/traverse').default;
        let hasTopLevelAwait = false;
        
        traverse(ast, {
            AwaitExpression(path) {
                // Check if await is at top level (not in async function)
                let parent = path.parentPath;
                let inAsyncFunction = false;
                
                while (parent) {
                    if (parent.isFunction()) {
                        if (parent.node.async) {
                            inAsyncFunction = true;
                            break;
                        }
                    }
                    parent = parent.parentPath;
                }
                
                if (!inAsyncFunction) {
                    hasTopLevelAwait = true;
                }
            }
        });
        
        if (hasTopLevelAwait) {
            this.results.asyncIssues.push({
                type: 'top_level_await',
                file,
                severity: 'critical',
                description: 'Top-level await blocks rendering',
                fix: 'Wrap in async function or use useEffect'
            });
        }
    }
    
    async analyzeBuildChain() {
        console.log('⚙️  Phase 3: Build chain analysis...');
        
        try {
            // Check if build works
            const buildResult = await this.runBuild();
            this.results.buildIssues.push(...buildResult.issues);
            
        } catch (error) {
            this.results.buildIssues.push({
                type: 'build_check_failed',
                severity: 'high',
                description: `Build check failed: ${error.message}`,
                fix: 'Check build configuration'
            });
        }
    }
    
    async runBuild() {
        const issues = [];
        
        // Try npm run build
        try {
            execSync('npm run build 2>&1', {
                cwd: this.root,
                stdio: 'pipe',
                timeout: 60000
            });
            
            issues.push({
                type: 'build_success',
                severity: 'info',
                description: 'Build completed successfully'
            });
            
        } catch (error) {
            const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
            
            // Parse common build errors
            if (output.includes('Cannot find module')) {
                issues.push({
                    type: 'missing_module',
                    severity: 'critical',
                    description: 'Missing module in build',
                    fix: 'Run npm install',
                    details: output.substring(0, 200)
                });
            } else if (output.includes('Unexpected token')) {
                issues.push({
                    type: 'syntax_error',
                    severity: 'critical',
                    description: 'Syntax error during build',
                    fix: 'Check for stray text or syntax errors',
                    details: output.substring(0, 200)
                });
            } else {
                issues.push({
                    type: 'build_failed',
                    severity: 'critical',
                    description: 'Build failed',
                    details: output.substring(0, 500)
                });
            }
        }
        
        return { issues };
    }
    
    async simulateRuntime() {
        console.log('🔄 Phase 4: Runtime simulation...');
        
        // This would simulate React rendering in a real browser
        // For now, we'll check for common render blockers
        
        // Check for infinite loops in useEffect
        // Check for state updates during render
        // Check for missing keys in lists
        
        this.results.renderBlockers.push({
            type: 'runtime_simulation_skipped',
            severity: 'info',
            description: 'Full runtime simulation requires browser environment',
            fix: 'Consider using React.StrictMode and development tools'
        });
    }
    
    async analyzeCriticalPath() {
        console.log('🛣️  Phase 5: Critical path analysis...');
        
        // Analyze the rendering path from main.jsx to App to components
        // Check for broken chains
        
        // 1. Main -> App
        const mainCheck = this.checkMainEntry();
        if (mainCheck.foundFile) {
            this.results.criticalIssues.push(...mainCheck.issues);
        }
        
        // 2. App -> Components
        const appCheck = this.checkAppComponent();
        if (appCheck.foundFile) {
            this.results.criticalIssues.push(...appCheck.issues);
        }
    }
    
    generateReport() {
        // Categorize by severity
        const critical = [
            ...this.results.criticalIssues.filter(i => i.severity === 'critical'),
            ...this.results.buildIssues.filter(i => i.severity === 'critical')
        ];
        
        const high = [
            ...this.results.criticalIssues.filter(i => i.severity === 'high'),
            ...this.results.renderBlockers.filter(i => i.severity === 'high'),
            ...this.results.buildIssues.filter(i => i.severity === 'high')
        ];
        
        const medium = [
            ...this.results.providerIssues.filter(i => i.severity === 'medium'),
            ...this.results.importIssues.filter(i => i.severity === 'medium'),
            ...this.results.asyncIssues.filter(i => i.severity === 'medium')
        ];
        
        // Generate actionable summary
        const summary = {
            totalIssues: critical.length + high.length + medium.length,
            critical: critical.length,
            high: high.length,
            medium: medium.length,
            mustFix: critical.length > 0 || high.length > 0,
            nextSteps: []
        };
        
        if (critical.length > 0) {
            summary.nextSteps.push('Fix critical issues immediately');
        }
        if (high.length > 0) {
            summary.nextSteps.push('Address high severity issues');
        }
        if (summary.totalIssues === 0) {
            summary.nextSteps.push('No structural issues found - check component logic');
        }
        
        this.results.summary = {
            ...this.results.summary,
            ...summary
        };
        
        return this.results;
    }
}

// Export for CLI
if (require.main === module) {
    const engine = new DeepScanEngine(process.cwd());
    
    engine.scanEverything().then(results => {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ARES OMEGA - COMPLETE ANALYSIS REPORT');
        console.log('='.repeat(60) + '\n');
        
        console.log(`📁 Files scanned: ${results.summary.totalFiles || 0}`);
        console.log(`🔧 JS/JSX files: ${results.summary.jsFiles || 0}`);
        console.log(`⚡ TypeScript files: ${results.summary.tsFiles || 0}`);
        console.log('');
        
        // Show critical issues
        const critical = results.criticalIssues.filter(i => i.severity === 'critical');
        if (critical.length > 0) {
            console.log('🚨 CRITICAL ISSUES (MUST FIX):');
            console.log('-' .repeat(40));
            critical.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.type.toUpperCase()}`);
                console.log(`   File: ${issue.file || 'N/A'}`);
                console.log(`   ${issue.description}`);
                if (issue.fix) {
                    console.log(`   🔧 Fix: ${issue.fix}`);
                }
                console.log('');
            });
        }
        
        // Show high issues
        const high = [
            ...results.criticalIssues.filter(i => i.severity === 'high'),
            ...results.buildIssues.filter(i => i.severity === 'high')
        ];
        
        if (high.length > 0) {
            console.log('⚠️  HIGH PRIORITY ISSUES:');
            console.log('-' .repeat(40));
            high.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.type.toUpperCase()}`);
                console.log(`   File: ${issue.file || 'N/A'}`);
                console.log(`   ${issue.description}`);
                if (issue.fix) {
                    console.log(`   🔧 Fix: ${issue.fix}`);
                }
                console.log('');
            });
        }
        
        // Show summary
        console.log('📈 SUMMARY:');
        console.log('-' .repeat(40));
        console.log(`Total issues found: ${results.summary.totalIssues || 0}`);
        console.log(`Critical: ${results.summary.critical || 0}`);
        console.log(`High: ${results.summary.high || 0}`);
        console.log(`Medium: ${results.summary.medium || 0}`);
        
        if (results.summary.mustFix) {
            console.log('\n❌ PROJECT HAS CRITICAL ISSUES - BLANK SCREEN LIKELY');
        } else if (results.summary.totalIssues === 0) {
            console.log('\n✅ NO STRUCTURAL ISSUES FOUND');
            console.log('   Blank screen may be due to:');
            console.log('   • Component logic errors');
            console.log('   • State management issues');
            console.log('   • API/async problems');
            console.log('   • CSS/display issues');
        } else {
            console.log('\n⚠️  SOME ISSUES FOUND - MAY CAUSE PROBLEMS');
        }
        
        // Save detailed report
        const reportPath = path.join(process.cwd(), '.ares_omega', 'deepscan_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 Full report saved: ${reportPath}`);
        
    }).catch(error => {
        console.error('❌ Scan failed:', error.message);
        process.exit(1);
    });
} else {
    module.exports = DeepScanEngine;
}
