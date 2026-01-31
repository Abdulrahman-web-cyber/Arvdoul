/**
 * EXECUTION REALITY GRAPH v3.0
 * Facebook/Google Internal Grade Dependency Analysis
 * Deterministic Failure Path Detection
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ExecutionRealityGraph {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.graph = {
            nodes: new Map(),
            edges: new Map(),
            entryPoints: new Set(),
            criticalPaths: new Map(),
            vulnerabilityPoints: new Map()
        };
        
        this.metrics = {
            nodesAnalyzed: 0,
            edgesDiscovered: 0,
            cyclesDetected: 0,
            criticalPathsFound: 0
        };
    }
    
    async analyzeProject() {
        console.log('🔍 Analyzing project for execution reality...');
        
        // Step 1: Discover all source files
        const files = this.discoverSourceFiles();
        console.log(`📁 Found ${files.length} source files`);
        
        // Step 2: Build import graph
        await this.buildImportGraph(files);
        
        // Step 3: Identify entry points
        this.identifyEntryPoints();
        
        // Step 4: Calculate critical paths
        this.calculateCriticalPaths();
        
        // Step 5: Identify vulnerability points
        this.identifyVulnerabilityPoints();
        
        // Step 6: Generate execution plan
        const executionPlan = this.generateExecutionPlan();
        
        return {
            graph: this.serializeGraph(),
            metrics: this.metrics,
            executionPlan,
            summary: this.generateSummary()
        };
    }
    
    discoverSourceFiles() {
        const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
        const ignorePatterns = [
            '**/node_modules/**',
            '**/.git/**',
            '**/.ares/**',
            '**/dist/**',
            '**/build/**',
            '**/*.test.*',
            '**/*.spec.*',
            '**/*.d.ts'
        ];
        
        const files = [];
        
        const walk = (dir) => {
            if (!fs.existsSync(dir)) return;
            
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                // Check ignore patterns
                const relativePath = path.relative(this.projectRoot, fullPath);
                const shouldIgnore = ignorePatterns.some(pattern => {
                    const minimatch = require('minimatch');
                    return minimatch(relativePath, pattern);
                });
                
                if (shouldIgnore) continue;
                
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (extensions.includes(ext)) {
                        files.push({
                            path: fullPath,
                            relativePath,
                            extension: ext,
                            size: fs.statSync(fullPath).size
                        });
                    }
                }
            }
        };
        
        walk(this.projectRoot);
        return files;
    }
    
    async buildImportGraph(files) {
        console.log('🧩 Building import graph...');
        
        const parser = require('@babel/parser');
        
        for (const file of files) {
            try {
                const content = fs.readFileSync(file.path, 'utf8');
                
                // Parse file to extract imports
                const ast = parser.parse(content, {
                    sourceType: 'module',
                    plugins: ['jsx', 'typescript'],
                    errorRecovery: true
                });
                
                const imports = this.extractImports(ast, file.path);
                
                // Add node to graph
                this.graph.nodes.set(file.relativePath, {
                    id: file.relativePath,
                    type: this.determineNodeType(file),
                    size: file.size,
                    imports,
                    exports: this.extractExports(ast),
                    hasJSX: content.includes('<') && content.includes('>'),
                    hasSideEffects: this.hasSideEffects(content),
                    parseErrors: ast.errors || []
                });
                
                this.metrics.nodesAnalyzed++;
                
                // Add edges for imports
                for (const imp of imports) {
                    const edgeId = `${file.relativePath}->${imp.resolvedPath}`;
                    this.graph.edges.set(edgeId, {
                        from: file.relativePath,
                        to: imp.resolvedPath,
                        type: 'import',
                        importType: imp.type,
                        isDynamic: imp.isDynamic
                    });
                    this.metrics.edgesDiscovered++;
                }
                
            } catch (error) {
                console.warn(`⚠️  Failed to parse ${file.relativePath}:`, error.message);
                
                // Add node with error
                this.graph.nodes.set(file.relativePath, {
                    id: file.relativePath,
                    type: 'file',
                    error: error.message,
                    parseError: true
                });
            }
        }
        
        // Detect circular dependencies
        this.detectCircularDependencies();
    }
    
    extractImports(ast, filePath) {
        const imports = [];
        const dir = path.dirname(filePath);
        
        const traverse = (node) => {
            if (!node) return;
            
            if (node.type === 'ImportDeclaration') {
                const source = node.source.value;
                const resolvedPath = this.resolveImportPath(source, dir);
                
                imports.push({
                    source,
                    resolvedPath,
                    type: 'static',
                    isDynamic: false,
                    specifiers: node.specifiers.map(s => ({
                        type: s.type,
                        imported: s.imported?.name,
                        local: s.local.name
                    }))
                });
            }
            
            if (node.type === 'CallExpression' && 
                node.callee.type === 'Import') {
                // Dynamic import
                if (node.arguments[0] && node.arguments[0].type === 'StringLiteral') {
                    const source = node.arguments[0].value;
                    const resolvedPath = this.resolveImportPath(source, dir);
                    
                    imports.push({
                        source,
                        resolvedPath,
                        type: 'dynamic',
                        isDynamic: true
                    });
                }
            }
            
            // Recursive traversal
            for (const key in node) {
                if (Array.isArray(node[key])) {
                    node[key].forEach(traverse);
                } else if (node[key] && typeof node[key] === 'object') {
                    traverse(node[key]);
                }
            }
        };
        
        traverse(ast);
        return imports;
    }
    
    resolveImportPath(source, baseDir) {
        // Simplified path resolution
        // Real implementation would handle node_modules, aliases, etc.
        
        if (source.startsWith('.')) {
            // Relative import
            const resolved = path.resolve(baseDir, source);
            const relative = path.relative(this.projectRoot, resolved);
            
            // Try with extensions
            const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];
            
            for (const ext of extensions) {
                const testPath = resolved + ext;
                if (fs.existsSync(testPath)) {
                    return path.relative(this.projectRoot, testPath);
                }
            }
            
            return relative;
        }
        
        // Package import
        return `node_modules:${source}`;
    }
    
    extractExports(ast) {
        const exports = [];
        
        const traverse = (node) => {
            if (!node) return;
            
            if (node.type === 'ExportDefaultDeclaration') {
                exports.push({
                    type: 'default',
                    name: 'default'
                });
            }
            
            if (node.type === 'ExportNamedDeclaration') {
                if (node.specifiers && node.specifiers.length > 0) {
                    node.specifiers.forEach(specifier => {
                        exports.push({
                            type: 'named',
                            name: specifier.exported.name
                        });
                    });
                }
                
                if (node.declaration) {
                    // Export declaration like export function foo() {}
                    if (node.declaration.id) {
                        exports.push({
                            type: 'named',
                            name: node.declaration.id.name
                        });
                    }
                }
            }
            
            // Recursive traversal
            for (const key in node) {
                if (Array.isArray(node[key])) {
                    node[key].forEach(traverse);
                } else if (node[key] && typeof node[key] === 'object') {
                    traverse(node[key]);
                }
            }
        };
        
        traverse(ast);
        return exports;
    }
    
    determineNodeType(file) {
        const name = path.basename(file.relativePath);
        
        if (name === 'main.jsx' || name === 'main.js' || name === 'index.jsx') {
            return 'entry';
        }
        
        if (name.includes('Provider')) {
            return 'provider';
        }
        
        if (name.includes('Context')) {
            return 'context';
        }
        
        if (name.includes('firebase') || name.includes('Firebase')) {
            return 'firebase';
        }
        
        if (file.relativePath.includes('components/')) {
            return 'component';
        }
        
        if (file.relativePath.includes('pages/') || file.relativePath.includes('routes/')) {
            return 'route';
        }
        
        if (file.relativePath.includes('hooks/')) {
            return 'hook';
        }
        
        if (file.relativePath.includes('utils/') || file.relativePath.includes('lib/')) {
            return 'utility';
        }
        
        return 'module';
    }
    
    hasSideEffects(content) {
        const sideEffectPatterns = [
            /localStorage\./,
            /sessionStorage\./,
            /document\./,
            /window\./,
            /process\.env\./,
            /fetch\(/,
            /XMLHttpRequest/,
            /setTimeout\(/,
            /setInterval\(/
        ];
        
        return sideEffectPatterns.some(pattern => pattern.test(content));
    }
    
    detectCircularDependencies() {
        const nodes = Array.from(this.graph.nodes.keys());
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        
        const dfs = (node, path = []) => {
            if (recursionStack.has(node)) {
                // Found a cycle
                const cycleStart = path.indexOf(node);
                const cycle = path.slice(cycleStart);
                cycles.push(cycle);
                return;
            }
            
            if (visited.has(node)) return;
            
            visited.add(node);
            recursionStack.add(node);
            path.push(node);
            
            const nodeData = this.graph.nodes.get(node);
            if (nodeData && nodeData.imports) {
                for (const imp of nodeData.imports) {
                    if (imp.resolvedPath && imp.resolvedPath.startsWith('.')) {
                        dfs(imp.resolvedPath, [...path]);
                    }
                }
            }
            
            recursionStack.delete(node);
            path.pop();
        };
        
        for (const node of nodes) {
            if (!visited.has(node)) {
                dfs(node);
            }
        }
        
        this.metrics.cyclesDetected = cycles.length;
        
        // Store cycles in graph
        cycles.forEach((cycle, index) => {
            this.graph.vulnerabilityPoints.set(`cycle-${index}`, {
                type: 'circular_dependency',
                cycle,
                severity: 'high',
                files: cycle
            });
        });
    }
    
    identifyEntryPoints() {
        // Find files that are likely entry points
        const entryPatterns = [
            /main\.(js|jsx|ts|tsx)$/,
            /index\.(js|jsx|ts|tsx)$/,
            /app\.(js|jsx|ts|tsx)$/,
            /entry\.(js|jsx|ts|tsx)$/
        ];
        
        for (const [filePath, node] of this.graph.nodes) {
            if (node.type === 'entry' || entryPatterns.some(pattern => pattern.test(filePath))) {
                this.graph.entryPoints.add(filePath);
                
                // Mark as entry in node data
                node.isEntryPoint = true;
            }
        }
        
        console.log(`🎯 Identified ${this.graph.entryPoints.size} entry points`);
    }
    
    calculateCriticalPaths() {
        // Calculate critical paths from entry points
        // Simplified implementation - real would use Dijkstra or similar
        
        for (const entryPoint of this.graph.entryPoints) {
            const criticalPath = this.findCriticalPath(entryPoint);
            
            if (criticalPath.length > 0) {
                this.graph.criticalPaths.set(entryPoint, criticalPath);
                this.metrics.criticalPathsFound++;
            }
        }
    }
    
    findCriticalPath(startNode) {
        const visited = new Set();
        const queue = [{ node: startNode, depth: 0 }];
        const criticalNodes = [];
        
        while (queue.length > 0) {
            const { node, depth } = queue.shift();
            
            if (visited.has(node)) continue;
            visited.add(node);
            
            const nodeData = this.graph.nodes.get(node);
            if (!nodeData) continue;
            
            // Add to critical path if it's important
            if (this.isCriticalNode(nodeData)) {
                criticalNodes.push({
                    node,
                  depth,
                  type: nodeData.type,
                  reason: this.getCriticalReason(nodeData)
                });
            }
            
            // Add imports to queue
            if (nodeData.imports) {
                for (const imp of nodeData.imports) {
                    if (imp.resolvedPath && imp.resolvedPath.startsWith('.') && !visited.has(imp.resolvedPath)) {
                        queue.push({ node: imp.resolvedPath, depth: depth + 1 });
                    }
                }
            }
        }
        
        return criticalNodes;
    }
    
    isCriticalNode(nodeData) {
        // Determine if node is critical to execution
        return (
            nodeData.type === 'provider' ||
            nodeData.type === 'context' ||
            nodeData.type === 'firebase' ||
            nodeData.type === 'entry' ||
            nodeData.hasSideEffects ||
            (nodeData.parseErrors && nodeData.parseErrors.length > 0)
        );
    }
    
    getCriticalReason(nodeData) {
        if (nodeData.parseErrors && nodeData.parseErrors.length > 0) {
            return 'has_parse_errors';
        }
        
        if (nodeData.hasSideEffects) {
            return 'has_side_effects';
        }
        
        return nodeData.type;
    }
    
    identifyVulnerabilityPoints() {
        // Identify points where failures could occur
        for (const [filePath, node] of this.graph.nodes) {
            const vulnerabilities = [];
            
            // Parse errors
            if (node.parseErrors && node.parseErrors.length > 0) {
                vulnerabilities.push({
                    type: 'parse_error',
                    severity: 'critical',
                    errors: node.parseErrors
                });
            }
            
            // Side effects at module level
            if (node.hasSideEffects && node.type !== 'utility') {
                vulnerabilities.push({
                    type: 'module_side_effect',
                    severity: 'high',
                    description: 'Side effects at module level'
                });
            }
            
            // Missing dependencies
            if (node.imports) {
                for (const imp of node.imports) {
                    if (imp.resolvedPath && !this.graph.nodes.has(imp.resolvedPath) && 
                        !imp.resolvedPath.startsWith('node_modules:')) {
                        vulnerabilities.push({
                            type: 'missing_dependency',
                            severity: 'high',
                            import: imp.source,
                            resolvedPath: imp.resolvedPath
                        });
                    }
                }
            }
            
            if (vulnerabilities.length > 0) {
                this.graph.vulnerabilityPoints.set(filePath, vulnerabilities);
            }
        }
    }
    
    generateExecutionPlan() {
        const plan = {
            phases: [],
            estimatedTime: 0,
          riskLevel: 'unknown',
          successProbability: 1.0
        };
        
        // Phase 1: Fix critical parse errors
        plan.phases.push({
            phase: 1,
            name: 'critical_syntax_repair',
            description: 'Fix parse errors in critical path files',
            files: this.getCriticalFilesWithParseErrors(),
            priority: 'critical',
            estimatedDuration: 5
        });
        
        // Phase 2: Fix side effects
        plan.phases.push({
            phase: 2,
            name: 'side_effect_isolation',
            description: 'Isolate module-level side effects',
            files: this.getFilesWithSideEffects(),
            priority: 'high',
            estimatedDuration: 10
        });
        
        // Phase 3: Fix missing dependencies
        plan.phases.push({
            phase: 3,
            name: 'dependency_resolution',
            description: 'Resolve missing dependencies',
            files: this.getFilesWithMissingDeps(),
            priority: 'medium',
            estimatedDuration: 15
        });
        
        // Calculate metrics
        plan.estimatedTime = plan.phases.reduce((sum, phase) => sum + phase.estimatedDuration, 0);
        plan.riskLevel = this.calculateRiskLevel();
        plan.successProbability = this.calculateSuccessProbability();
        
        return plan;
    }
    
    getCriticalFilesWithParseErrors() {
        const files = [];
        
        for (const [filePath, vulnerabilities] of this.graph.vulnerabilityPoints) {
            if (Array.isArray(vulnerabilities)) {
                const hasParseError = vulnerabilities.some(v => v.type === 'parse_error');
                const isCritical = this.isInCriticalPath(filePath);
                
                if (hasParseError && isCritical) {
                    files.push(filePath);
                }
            }
        }
        
        return files;
    }
    
    getFilesWithSideEffects() {
        const files = [];
        
        for (const [filePath, node] of this.graph.nodes) {
            if (node.hasSideEffects && node.type !== 'utility') {
                files.push(filePath);
            }
        }
        
        return files;
    }
    
    getFilesWithMissingDeps() {
        const files = [];
        
        for (const [filePath, vulnerabilities] of this.graph.vulnerabilityPoints) {
            if (Array.isArray(vulnerabilities)) {
                const hasMissingDep = vulnerabilities.some(v => v.type === 'missing_dependency');
                
                if (hasMissingDep) {
                    files.push(filePath);
                }
            }
        }
        
        return files;
    }
    
    isInCriticalPath(filePath) {
        for (const criticalPath of this.graph.criticalPaths.values()) {
            if (criticalPath.some(node => node.node === filePath)) {
                return true;
            }
        }
        return false;
    }
    
    calculateRiskLevel() {
        const criticalCount = this.getCriticalFilesWithParseErrors().length;
        const sideEffectCount = this.getFilesWithSideEffects().length;
        const missingDepCount = this.getFilesWithMissingDeps().length;
        const cycleCount = this.metrics.cyclesDetected;
        
        const totalRisks = criticalCount + sideEffectCount + missingDepCount + (cycleCount * 2);
        
        if (totalRisks === 0) return 'low';
        if (totalRisks <= 3) return 'medium';
        if (totalRisks <= 10) return 'high';
        return 'critical';
    }
    
    calculateSuccessProbability() {
        const riskLevel = this.calculateRiskLevel();
        
        switch (riskLevel) {
            case 'low': return 0.95;
            case 'medium': return 0.85;
            case 'high': return 0.70;
            case 'critical': return 0.50;
            default: return 0.80;
        }
    }
    
    serializeGraph() {
        return {
            nodes: Object.fromEntries(this.graph.nodes),
            edges: Object.fromEntries(this.graph.edges),
            entryPoints: Array.from(this.graph.entryPoints),
            criticalPaths: Object.fromEntries(this.graph.criticalPaths),
            vulnerabilityPoints: Object.fromEntries(this.graph.vulnerabilityPoints),
            metrics: this.metrics
        };
    }
    
    generateSummary() {
        const totalNodes = this.graph.nodes.size;
        const totalEdges = this.graph.edges.size;
        const entryPoints = this.graph.entryPoints.size;
        const criticalPaths = this.graph.criticalPaths.size;
        const vulnerabilityPoints = this.graph.vulnerabilityPoints.size;
        const cycles = this.metrics.cyclesDetected;
        
        const parseErrors = Array.from(this.graph.nodes.values())
            .filter(node => node.parseErrors && node.parseErrors.length > 0)
            .length;
        
        const sideEffects = Array.from(this.graph.nodes.values())
            .filter(node => node.hasSideEffects)
            .length;
        
        return {
            totalNodes,
            totalEdges,
            entryPoints,
            criticalPaths,
            vulnerabilityPoints,
            cycles,
            parseErrors,
            sideEffects,
            riskLevel: this.calculateRiskLevel(),
            successProbability: this.calculateSuccessProbability()
        };
    }
}

module.exports = ExecutionRealityGraph;
