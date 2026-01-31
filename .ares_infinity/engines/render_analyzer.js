#!/usr/bin/env node
/**
 * ARES INFINITY - Render Chain Analyzer
 * Finds why builds pass but screen is blank
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class RenderChainAnalyzer {
    constructor(projectRoot) {
        this.root = projectRoot;
        this.results = {
            timestamp: new Date().toISOString(),
            project: path.basename(projectRoot),
            issues: [],
            warnings: [],
            recommendations: [],
            renderChain: [],
            cssIssues: [],
            providerIssues: [],
            hookIssues: [],
            firebaseIssues: [],
            criticalIssues: []
        };
        
        this.blankScreenDB = this.loadBlankScreenDB();
    }
    
    loadBlankScreenDB() {
        const dbPath = path.join(this.root, '.ares_infinity', 'blank_screen_db.json');
        if (fs.existsSync(dbPath)) {
            return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }
        return { blank_screen_causes: [] };
    }
    
    async analyzeEverything() {
        console.log('🔬 ARES INFINITY - Analyzing Render Chain...');
        console.log('='.repeat(60));
        
        // Phase 1: Basic project structure
        await this.analyzeProjectStructure();
        
        // Phase 2: Render chain reconstruction
        await this.reconstructRenderChain();
        
        // Phase 3: CSS analysis
        await this.analyzeCSS();
        
        // Phase 4: Provider analysis
        await this.analyzeProviders();
        
        // Phase 5: Hook analysis
        await this.analyzeHooks();
        
        // Phase 6: Firebase analysis
        await this.analyzeFirebase();
        
        // Phase 7: Build output analysis
        await this.analyzeBuildOutput();
        
        // Generate final report
        return this.generateReport();
    }
    
    async analyzeProjectStructure() {
        console.log('📁 Phase 1: Project structure...');
        
        // Check critical files
        const criticalFiles = [
            { path: 'package.json', check: this.checkPackageJson.bind(this) },
            { path: 'index.html', check: this.checkIndexHtml.bind(this) },
            { path: 'src/main.jsx', check: this.checkMainEntry.bind(this) },
            { path: 'src/App.jsx', check: this.checkAppComponent.bind(this) },
            { path: 'vite.config.js', check: this.checkViteConfig.bind(this) }
        ];
        
        for (const file of criticalFiles) {
            const fullPath = path.join(this.root, file.path);
            if (fs.existsSync(fullPath)) {
                const result = await file.check(fullPath);
                if (result.issues.length > 0) {
                    this.results.issues.push(...result.issues);
                }
            } else if (file.path === 'src/main.jsx' || file.path === 'src/App.jsx') {
                // Try to find alternative
                const alternatives = this.findAlternativeFiles(file.path);
                if (alternatives.found) {
                    const result = await file.check(alternatives.path);
                    if (result.issues.length > 0) {
                        this.results.issues.push(...result.issues);
                    }
                } else {
                    this.results.criticalIssues.push({
                        type: 'missing_critical_file',
                        file: file.path,
                        severity: 'critical',
                        description: `Missing ${file.path} - app cannot render`,
                        fix: `Create ${file.path} with proper structure`
                    });
                }
            }
        }
    }
    
    findAlternativeFiles(target) {
        const patterns = {
            'src/main.jsx': ['main.jsx', 'src/main.js', 'main.js', 'src/index.jsx', 'index.jsx'],
            'src/App.jsx': ['App.jsx', 'src/App.js', 'App.js', 'src/components/App.jsx', 'src/pages/App.jsx']
        };
        
        const targetPatterns = patterns[target] || [];
        for (const pattern of targetPatterns) {
            const fullPath = path.join(this.root, pattern);
            if (fs.existsSync(fullPath)) {
                return { found: true, path: fullPath, actual: pattern };
            }
        }
        
        return { found: false, path: null };
    }
    
    async checkPackageJson(filePath) {
        const issues = [];
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const pkg = JSON.parse(content);
            
            // Check for React
            if (!pkg.dependencies?.react && !pkg.devDependencies?.react) {
                issues.push({
                    type: 'missing_react',
                    severity: 'critical',
                    description: 'React not in dependencies',
                    fix: 'npm install react react-dom'
                });
            }
            
            // Check scripts
            if (!pkg.scripts?.dev) {
                issues.push({
                    type: 'missing_dev_script',
                    severity: 'medium',
                    description: 'No dev script in package.json',
                    fix: 'Add "dev": "vite" to scripts'
                });
            }
            
        } catch (error) {
            issues.push({
                type: 'package_json_error',
                severity: 'critical',
                description: `Failed to parse package.json: ${error.message}`,
                fix: 'Check JSON syntax'
            });
        }
        
        return { issues };
    }
    
    async checkIndexHtml(filePath) {
        const issues = [];
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for root div
            if (!content.includes('id="root"') && !content.includes('id="app"')) {
                issues.push({
                    type: 'missing_root_div',
                    severity: 'critical',
                    description: 'No root div (id="root" or id="app") in index.html',
                    fix: 'Add <div id="root"></div> to body'
                });
            }
            
            // Check for script tag
            if (!content.includes('<script') || !content.includes('type="module"')) {
                issues.push({
                    type: 'missing_script_tag',
                    severity: 'high',
                    description: 'Missing script tag in index.html',
                    fix: 'Add <script type="module" src="/src/main.jsx"></script>'
                });
            }
            
        } catch (error) {
            issues.push({
                type: 'html_read_error',
                severity: 'critical',
                description: `Failed to read index.html: ${error.message}`
            });
        }
        
        return { issues };
    }
    
    async checkMainEntry(filePath) {
        const issues = [];
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            // Check for ReactDOM render
            const hasReactDOM = content.includes('ReactDOM') || content.includes('createRoot');
            const hasRender = content.includes('.render(') || content.includes('render(');
            
            if (!hasReactDOM || !hasRender) {
                issues.push({
                    type: 'missing_reactdom_render',
                    severity: 'critical',
                    description: 'Main entry missing ReactDOM render',
                    fix: 'Add ReactDOM.createRoot(document.getElementById("root")).render(<App />)'
                });
            }
            
            // Check for stray text
            lines.forEach((line, index) => {
                const trimmed = line.trim();
                if (this.isStrayText(trimmed)) {
                    issues.push({
                        type: 'stray_text',
                        severity: 'high',
                        line: index + 1,
                        description: `Stray text in main entry: "${trimmed}"`,
                        fix: `Comment out line ${index + 1}: // ${trimmed}`
                    });
                }
            });
            
            // Check for App import
            if (!content.includes('import App')) {
                issues.push({
                    type: 'missing_app_import',
                    severity: 'critical',
                    description: 'Missing App import in main entry',
                    fix: 'Add import App from "./App"'
                });
            }
            
        } catch (error) {
            issues.push({
                type: 'main_entry_error',
                severity: 'critical',
                description: `Failed to analyze main entry: ${error.message}`
            });
        }
        
        return { issues };
    }
    
    async checkAppComponent(filePath) {
        const issues = [];
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for default export
            if (!content.includes('export default')) {
                issues.push({
                    type: 'missing_default_export',
                    severity: 'critical',
                    description: 'App component missing default export',
                    fix: 'Add "export default App" at the end'
                });
            }
            
            // Check for JSX return
            if (!content.includes('return (') && !content.includes('return <')) {
                issues.push({
                    type: 'missing_jsx_return',
                    severity: 'critical',
                    description: 'App component not returning JSX',
                    fix: 'Add return statement with JSX'
                });
            }
            
            // Check for CSS that might hide everything
            if (content.includes('display: none') || content.includes('visibility: hidden')) {
                issues.push({
                    type: 'css_hiding_app',
                    severity: 'high',
                    description: 'App component has CSS that hides content',
                    fix: 'Remove display: none or visibility: hidden'
                });
            }
            
        } catch (error) {
            issues.push({
                type: 'app_component_error',
                severity: 'critical',
                description: `Failed to analyze App component: ${error.message}`
            });
        }
        
        return { issues };
    }
    
    async checkViteConfig(filePath) {
        const issues = [];
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for React plugin
            if (!content.includes('@vitejs/plugin-react') && !content.includes('react()')) {
                issues.push({
                    type: 'missing_react_plugin',
                    severity: 'medium',
                    description: 'Vite config missing React plugin',
                    fix: 'Add @vitejs/plugin-react and react() to plugins'
                });
            }
            
        } catch (error) {
            // Vite config optional, just warn
            issues.push({
                type: 'vite_config_warning',
                severity: 'low',
                description: 'Could not read vite.config.js'
            });
        }
        
        return { issues };
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
    
    async reconstructRenderChain() {
        console.log('🔄 Phase 2: Reconstructing render chain...');
        
        // Find main entry point
        const mainEntry = this.findMainEntry();
        if (!mainEntry) {
            this.results.criticalIssues.push({
                type: 'no_main_entry',
                severity: 'critical',
                description: 'Could not find main entry point',
                fix: 'Create src/main.jsx or similar entry file'
            });
            return;
        }
        
        this.results.renderChain.push({
            step: 'main_entry',
            file: mainEntry,
            status: 'found'
        });
        
        // Try to trace from main to App
        try {
            const mainContent = fs.readFileSync(path.join(this.root, mainEntry), 'utf8');
            const appMatch = mainContent.match(/import.*App.*from\s+['"]([^'"]+)['"]/);
            
            if (appMatch) {
                let appPath = appMatch[1];
                if (!appPath.startsWith('.')) {
                    appPath = './' + appPath;
                }
                
                // Resolve App path
                const mainDir = path.dirname(mainEntry);
                const resolvedAppPath = path.join(mainDir, appPath);
                const normalizedAppPath = path.relative(this.root, resolvedAppPath);
                
                if (fs.existsSync(resolvedAppPath + '.jsx') || fs.existsSync(resolvedAppPath + '.js')) {
                    const actualPath = fs.existsSync(resolvedAppPath + '.jsx') ? 
                        normalizedAppPath + '.jsx' : normalizedAppPath + '.js';
                    
                    this.results.renderChain.push({
                        step: 'app_component',
                        file: actualPath,
                        status: 'found'
                    });
                } else {
                    this.results.renderChain.push({
                        step: 'app_component',
                        file: appPath,
                        status: 'not_found'
                    });
                    
                    this.results.criticalIssues.push({
                        type: 'app_not_found',
                        severity: 'critical',
                        description: `App component not found: ${appPath}`,
                        fix: 'Check import path or create App component'
                    });
                }
            }
            
        } catch (error) {
            this.results.warnings.push({
                type: 'render_chain_partial',
                description: `Could not fully trace render chain: ${error.message}`
            });
        }
    }
    
    findMainEntry() {
        const candidates = [
            'src/main.jsx', 'src/main.js', 'main.jsx', 'main.js',
            'src/index.jsx', 'src/index.js', 'index.jsx', 'index.js'
        ];
        
        for (const candidate of candidates) {
            if (fs.existsSync(path.join(this.root, candidate))) {
                return candidate;
            }
        }
        
        return null;
    }
    
    async analyzeCSS() {
        console.log('🎨 Phase 3: Analyzing CSS for blank screens...');
        
        // Look for global CSS
        const cssFiles = this.findFiles(/\.(css|scss|sass|less)$/);
        
        for (const cssFile of cssFiles.slice(0, 10)) { // Check first 10
            try {
                const content = fs.readFileSync(path.join(this.root, cssFile), 'utf8');
                
                // Check for root element styling that might hide content
                if (content.includes('#root') || content.includes('#app') || 
                    content.includes('.app') || content.includes('.App')) {
                    
                    // Look for hiding styles
                    const hidingPatterns = [
                        'display:\\s*none',
                        'visibility:\\s*hidden',
                        'opacity:\\s*0',
                        'height:\\s*0',
                        'width:\\s*0',
                        'z-index:\\s*-?\\d+'
                    ];
                    
                    for (const pattern of hidingPatterns) {
                        const regex = new RegExp(`(#root|#app|\\.app|\\.App)[^{]*{[^}]*${pattern}`, 'gi');
                        if (regex.test(content)) {
                            this.results.cssIssues.push({
                                type: 'css_hiding_root',
                                file: cssFile,
                                pattern: pattern,
                                severity: 'high',
                                description: `CSS might hide root element: ${pattern}`,
                                fix: 'Remove or fix the CSS rule'
                            });
                        }
                    }
                }
                
            } catch (error) {
                // Skip CSS files we can't read
            }
        }
        
        // Check for inline styles in JSX
        const jsxFiles = this.findFiles(/\.(jsx|tsx)$/);
        for (const jsxFile of jsxFiles.slice(0, 5)) {
            try {
                const content = fs.readFileSync(path.join(this.root, jsxFile), 'utf8');
                
                // Look for inline styles that hide elements
                if (content.includes('display:') && 
                   (content.includes('display: none') || content.includes('display:"none"'))) {
                    this.results.cssIssues.push({
                        type: 'inline_style_hiding',
                        file: jsxFile,
                        severity: 'medium',
                        description: 'Inline style with display: none found',
                        fix: 'Check if this is intentionally hiding elements'
                    });
                }
                
            } catch (error) {
                // Skip
            }
        }
    }
    
    async analyzeProviders() {
        console.log('🔄 Phase 4: Analyzing providers...');
        
        // Look for provider files
        const providerFiles = this.findFiles(/Provider\.(jsx|js|tsx|ts)$/);
        
        for (const providerFile of providerFiles) {
            try {
                const content = fs.readFileSync(path.join(this.root, providerFile), 'utf8');
                
                // Check for module-level side effects
                if (content.includes('localStorage') || 
                    content.includes('sessionStorage') ||
                    content.includes('document.') ||
                    content.includes('window.')) {
                    
                    // Check if it's in module scope (not inside function)
                    const lines = content.split('\n');
                    let inFunction = false;
                    
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        
                        if (line.includes('function') || line.includes('const') || line.includes('class')) {
                            inFunction = true;
                        }
                        
                        if (line.includes('localStorage') || line.includes('sessionStorage')) {
                            if (!inFunction) {
                                this.results.providerIssues.push({
                                    type: 'provider_side_effect',
                                    file: providerFile,
                                    line: i + 1,
                                    severity: 'high',
                                    description: 'Provider has module-level side effect (localStorage/sessionStorage)',
                                    fix: 'Move to useEffect or check for window existence'
                                });
                            }
                        }
                    }
                }
                
            } catch (error) {
                // Skip
            }
        }
    }
    
    async analyzeHooks() {
        console.log('🪝 Phase 5: Analyzing hooks...');
        
        const jsxFiles = this.findFiles(/\.(jsx|tsx)$/);
        
        for (const jsxFile of jsxFiles.slice(0, 5)) {
            try {
                const content = fs.readFileSync(path.join(this.root, jsxFile), 'utf8');
                const lines = content.split('\n');
                
                // Simple hook detection
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    // Look for useState, useEffect, useContext
                    if (line.includes('useState') || line.includes('useEffect') || line.includes('useContext')) {
                        // Check if inside conditional
                        let j = i;
                        let bracketCount = 0;
                        let foundConditional = false;
                        
                        while (j >= 0 && j >= i - 10) {
                            if (lines[j].includes('if (') || lines[j].includes('else') || 
                                lines[j].includes('for (') || lines[j].includes('while (')) {
                                foundConditional = true;
                                break;
                            }
                            j--;
                        }
                        
                        if (foundConditional) {
                            this.results.hookIssues.push({
                                type: 'hook_in_conditional',
                                file: jsxFile,
                                line: i + 1,
                                severity: 'high',
                                description: 'Hook might be called conditionally',
                                fix: 'Move hook to top level of component'
                            });
                        }
                    }
                }
                
            } catch (error) {
                // Skip
            }
        }
    }
    
    async analyzeFirebase() {
        console.log('🔥 Phase 6: Analyzing Firebase...');
        
        const allFiles = this.findFiles(/\.(js|jsx|ts|tsx)$/);
        let foundFirebase = false;
        
        for (const file of allFiles.slice(0, 20)) {
            try {
                const content = fs.readFileSync(path.join(this.root, file), 'utf8');
                
                if (content.includes('firebase') || content.includes('Firebase') || 
                    content.includes('initializeApp')) {
                    foundFirebase = true;
                    
                    // Check for initialization issues
                    if (content.includes('getAuth') || content.includes('getFirestore') || 
                        content.includes('getDatabase')) {
                        
                        if (!content.includes('initializeApp')) {
                            this.results.firebaseIssues.push({
                                type: 'firebase_before_init',
                                file: file,
                                severity: 'high',
                                description: 'Firebase used before initialization',
                                fix: 'Ensure initializeApp() is called first'
                            });
                        }
                    }
                }
                
            } catch (error) {
                // Skip
            }
        }
        
        if (foundFirebase) {
            this.results.renderChain.push({
                step: 'firebase',
                status: 'detected',
                note: 'Firebase usage detected, check initialization order'
            });
        }
    }
    
    async analyzeBuildOutput() {
        console.log('⚙️  Phase 7: Analyzing build output...');
        
        try {
            // Try to run build
            const buildResult = this.runBuild();
            
            if (buildResult.success) {
                this.results.renderChain.push({
                    step: 'build',
                    status: 'passes',
                    note: 'Build completes successfully'
                });
                
                // Check dist/index.html
                const distHtml = path.join(this.root, 'dist', 'index.html');
                if (fs.existsSync(distHtml)) {
                    const content = fs.readFileSync(distHtml, 'utf8');
                    
                    // Check if built HTML has root div
                    if (!content.includes('id="root"') && !content.includes('id="app"')) {
                        this.results.criticalIssues.push({
                            type: 'build_missing_root',
                            severity: 'critical',
                            description: 'Built index.html missing root div',
                            fix: 'Check build configuration'
                        });
                    }
                }
                
            } else {
                this.results.criticalIssues.push({
                    type: 'build_failed',
                    severity: 'critical',
                    description: `Build failed: ${buildResult.error}`,
                    fix: 'Fix build errors first'
                });
            }
            
        } catch (error) {
            this.results.warnings.push({
                type: 'build_check_skipped',
                description: `Build check skipped: ${error.message}`
            });
        }
    }
    
    runBuild() {
        try {
            // Check if package.json has build script
            const pkgPath = path.join(this.root, 'package.json');
            if (!fs.existsSync(pkgPath)) {
                return { success: false, error: 'No package.json' };
            }
            
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            if (!pkg.scripts || !pkg.scripts.build) {
                return { success: false, error: 'No build script' };
            }
            
            // Run build with timeout
            execSync('npm run build', {
                cwd: this.root,
                stdio: 'pipe',
                timeout: 120000
            });
            
            return { success: true };
            
        } catch (error) {
            return { 
                success: false, 
                error: error.message,
                stdout: error.stdout?.toString(),
                stderr: error.stderr?.toString()
            };
        }
    }
    
    findFiles(pattern) {
        const { glob } = require('glob');
        return glob.sync('**/*' + pattern, {
            cwd: this.root,
            ignore: ['**/node_modules/**', '**/.git/**', '**/.ares*/**']
        });
    }
    
    generateReport() {
        // Combine all issues
        const allIssues = [
            ...this.results.issues,
            ...this.results.cssIssues,
            ...this.results.providerIssues,
            ...this.results.hookIssues,
            ...this.results.firebaseIssues,
            ...this.results.criticalIssues
        ];
        
        // Categorize by severity
        const critical = allIssues.filter(i => i.severity === 'critical');
        const high = allIssues.filter(i => i.severity === 'high');
        const medium = allIssues.filter(i => i.severity === 'medium');
        const low = allIssues.filter(i => i.severity === 'low');
        
        // Generate recommendations based on findings
        const recommendations = [];
        
        if (critical.length > 0) {
            recommendations.push({
                priority: 'critical',
                action: 'Fix critical issues immediately',
                count: critical.length
            });
        }
        
        if (this.results.cssIssues.length > 0) {
            recommendations.push({
                priority: 'high',
                action: 'Check CSS for hiding styles',
                count: this.results.cssIssues.length
            });
        }
        
        if (this.results.providerIssues.length > 0) {
            recommendations.push({
                priority: 'high',
                action: 'Fix provider side effects',
                count: this.results.providerIssues.length
            });
        }
        
        if (allIssues.length === 0) {
            recommendations.push({
                priority: 'investigation',
                action: 'No structural issues found. Blank screen may be due to:',
                details: [
                    'Component logic errors',
                    'State management issues',
                    'API/async problems',
                    'Data fetching failures',
                    'Conditional rendering bugs'
                ]
            });
        }
        
        // Add blank screen causes from database
        const blankScreenCauses = this.blankScreenDB.blank_screen_causes || [];
        const possibleCauses = [];
        
        // Match found issues with known causes
        for (const cause of blankScreenCauses) {
            for (const issue of allIssues) {
                if (cause.name.toLowerCase().includes(issue.type.toLowerCase()) ||
                    issue.description.toLowerCase().includes(cause.name.toLowerCase())) {
                    possibleCauses.push({
                        cause: cause.name,
                        description: cause.description,
                        match: issue.type,
                        fix: cause.fix
                    });
                }
            }
        }
        
        this.results.summary = {
            totalIssues: allIssues.length,
            critical: critical.length,
            high: high.length,
            medium: medium.length,
            low: low.length,
            renderChainLength: this.results.renderChain.length,
            blankScreenCauses: possibleCauses.length,
            buildStatus: this.results.renderChain.find(r => r.step === 'build')?.status || 'unknown'
        };
        
        this.results.recommendations = recommendations;
        this.results.possibleBlankScreenCauses = possibleCauses;
        
        return this.results;
    }
}

// CLI execution
if (require.main === module) {
    const analyzer = new RenderChainAnalyzer(process.cwd());
    
    analyzer.analyzeEverything().then(results => {
        console.log('\n' + '='.repeat(60));
        console.log('📊 ARES INFINITY - RENDER CHAIN ANALYSIS');
        console.log('='.repeat(60) + '\n');
        
        // Show render chain
        console.log('🔄 RENDER CHAIN:');
        console.log('-' .repeat(40));
        results.renderChain.forEach((step, index) => {
            console.log(`${index + 1}. ${step.step}: ${step.file || 'N/A'} (${step.status})`);
            if (step.note) {
                console.log(`   Note: ${step.note}`);
            }
        });
        console.log('');
        
        // Show critical issues
        const critical = results.issues.concat(results.criticalIssues)
            .filter(i => i.severity === 'critical');
        
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
        
        // Show CSS issues
        if (results.cssIssues.length > 0) {
            console.log('🎨 CSS ISSUES (May cause blank screen):');
            console.log('-' .repeat(40));
            results.cssIssues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.type}`);
                console.log(`   File: ${issue.file}`);
                console.log(`   ${issue.description}`);
                console.log('');
            });
        }
        
        // Show provider issues
        if (results.providerIssues.length > 0) {
            console.log('🔄 PROVIDER ISSUES (May block render):');
            console.log('-' .repeat(40));
            results.providerIssues.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue.type}`);
                console.log(`   File: ${issue.file}:${issue.line}`);
                console.log(`   ${issue.description}`);
                console.log('');
            });
        }
        
        // Show blank screen causes
        if (results.possibleBlankScreenCauses.length > 0) {
            console.log('🔍 POSSIBLE BLANK SCREEN CAUSES:');
            console.log('-' .repeat(40));
            results.possibleBlankScreenCauses.forEach((cause, index) => {
                console.log(`${index + 1}. ${cause.cause}`);
                console.log(`   ${cause.description}`);
                console.log(`   🔧 Fix: ${cause.fix}`);
                console.log('');
            });
        }
        
        // Show summary
        console.log('📈 SUMMARY:');
        console.log('-' .repeat(40));
        console.log(`Total issues found: ${results.summary.totalIssues}`);
        console.log(`Critical: ${results.summary.critical}`);
        console.log(`High: ${results.summary.high}`);
        console.log(`CSS issues: ${results.cssIssues.length}`);
        console.log(`Provider issues: ${results.providerIssues.length}`);
        console.log(`Build status: ${results.summary.buildStatus}`);
        
        if (results.summary.totalIssues === 0) {
            console.log('\n✅ NO STRUCTURAL ISSUES FOUND');
            console.log('   Build passes but screen is blank. Likely causes:');
            console.log('   • Component returns null/undefined');
            console.log('   • State prevents rendering');
            console.log('   • Async data not loaded');
            console.log('   • Conditional rendering bug');
            console.log('   • Routing issues');
        } else if (results.summary.critical > 0) {
            console.log('\n❌ CRITICAL ISSUES FOUND');
            console.log('   These WILL cause blank screen. Fix them first.');
        } else {
            console.log('\n⚠️  ISSUES FOUND');
            console.log('   May cause blank screen. Review and fix.');
        }
        
        // Save report
        const reportPath = path.join(process.cwd(), '.ares_infinity', 'render_analysis.json');
        fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 Full report saved: ${reportPath}`);
        
        // Show next steps
        console.log('\n🚀 NEXT STEPS:');
        if (results.summary.critical > 0) {
            console.log('1. Run: ./ares_infinity fix_critical');
            console.log('2. Then: ./ares_infinity fix_all');
        } else if (results.summary.totalIssues > 0) {
            console.log('1. Run: ./ares_infinity fix_all');
            console.log('2. Then: npm run build');
        } else {
            console.log('1. Check component logic in App.jsx');
            console.log('2. Check state and useEffect hooks');
            console.log('3. Check async data loading');
            console.log('4. Use React DevTools to inspect component tree');
        }
        
    }).catch(error => {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    });
}
