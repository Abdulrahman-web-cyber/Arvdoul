#!/usr/bin/env node
/**
 * ARES CLI v3.0
 * Production Command Line Interface
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const ora = require('ora');
const boxen = require('boxen');

// Import engines
const AresAstEngine = require('./plugins/ast_engine');
const TransformationEngine = require('./plugins/transformation_engine');
const ExecutionRealityGraph = require('./plugins/execution_graph');
const MathematicalVerificationEngine = require('./plugins/verification_engine');
const ProductionSafetyEngine = require('./plugins/safety_engine');
const PerformanceAnalyticsEngine = require('./plugins/performance_engine');

class AresCLI {
    constructor() {
        this.projectRoot = process.cwd();
        this.aresHome = path.join(this.projectRoot, '.ares_v3');
        this.config = this.loadConfig();
        
        this.spinner = null;
        this.verbose = false;
        
        // Initialize engines
        this.initializeEngines();
    }
    
    loadConfig() {
        const configPath = path.join(this.aresHome, 'config.json');
        
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        
        // Default config
        return {
            version: '3.0.0',
            safeMode: true,
            autoBackup: true,
            maxFileSize: 10485760,
            rules: ['syntax', 'imports', 'react', 'providers'],
            output: {
                json: true,
                markdown: true,
                console: true
            }
        };
    }
    
    initializeEngines() {
        console.log(chalk.blue.bold('\n🚀 ARES v3.0 - Initializing Engines\n'));
        
        // AST Engine
        this.spinner = ora('Initializing AST Engine...').start();
        const astCacheDir = path.join(this.aresHome, 'cache', 'ast');
        this.astEngine = new AresAstEngine(astCacheDir);
        this.spinner.succeed('AST Engine ready');
        
        // Transformation Engine
        this.spinner = ora('Initializing Transformation Engine...').start();
        this.transformationEngine = new TransformationEngine(this.astEngine);
        this.spinner.succeed('Transformation Engine ready');
        
        // Execution Graph
        this.spinner = ora('Initializing Execution Reality Graph...').start();
        this.executionGraph = new ExecutionRealityGraph(this.projectRoot);
        this.spinner.succeed('Execution Reality Graph ready');
        
        // Verification Engine
        this.spinner = ora('Initializing Mathematical Verification Engine...').start();
        this.verificationEngine = new MathematicalVerificationEngine();
        this.spinner.succeed('Verification Engine ready');
        
        // Safety Engine
        this.spinner = ora('Initializing Safety Engine...').start();
        const backupDir = path.join(this.aresHome, 'backups');
        this.safetyEngine = new ProductionSafetyEngine(this.projectRoot, backupDir);
        this.spinner.succeed('Safety Engine ready');
        
        // Performance Engine
        this.spinner = ora('Initializing Performance Analytics Engine...').start();
        this.performanceEngine = new PerformanceAnalyticsEngine(this.projectRoot);
        this.spinner.succeed('Performance Engine ready');
        
        console.log(chalk.green.bold('\n✅ All engines initialized successfully!\n'));
    }
    
    async scanCommand(options) {
        console.log(chalk.blue.bold('\n🔍 ARES - Deep Repository Scan\n'));
        
        const scanSpinner = ora('Scanning repository...').start();
        
        try {
            // Run safety checks
            scanSpinner.text = 'Running safety checks...';
            const safetyResults = await this.safetyEngine.runSafetyChecks();
            
            if (!safetyResults.allPassed) {
                scanSpinner.warn('Safety checks completed with warnings');
                console.log(chalk.yellow('\n⚠️  Safety warnings:'));
                safetyResults.results.forEach(result => {
                    if (!result.passed) {
                        console.log(chalk.yellow(`  • ${result.name}: ${result.message}`));
                    }
                });
                
                if (!safetyResults.canProceed && !options.force) {
                    scanSpinner.fail('Cannot proceed due to critical safety issues');
                    console.log(chalk.red('Use --force to override (not recommended)'));
                    return;
                }
            } else {
                scanSpinner.succeed('Safety checks passed');
            }
            
            // Create snapshot
            if (this.config.autoBackup) {
                scanSpinner.text = 'Creating safety snapshot...';
                const snapshotId = await this.safetyEngine.createSnapshot(
                    'pre_scan',
                    'Snapshot before ARES scan'
                );
                scanSpinner.succeed(`Safety snapshot created: ${snapshotId}`);
            }
            
            // Analyze execution graph
            scanSpinner.text = 'Analyzing execution graph...';
            const graphAnalysis = await this.executionGraph.analyzeProject();
            scanSpinner.succeed('Execution graph analyzed');
            
            // Generate report
            scanSpinner.text = 'Generating report...';
            const report = this.generateScanReport(graphAnalysis);
            scanSpinner.succeed('Report generated');
            
            // Display summary
            this.displayScanSummary(report);
            
            // Save report
            if (options.save) {
                this.saveReport(report, 'scan_report');
            }
            
            return report;
            
        } catch (error) {
            scanSpinner.fail(`Scan failed: ${error.message}`);
            throw error;
        }
    }
    
    generateScanReport(graphAnalysis) {
        return {
            timestamp: new Date().toISOString(),
            project: path.basename(this.projectRoot),
            summary: graphAnalysis.summary,
            criticalPaths: Array.from(graphAnalysis.graph.criticalPaths.entries()),
            vulnerabilityPoints: Array.from(graphAnalysis.graph.vulnerabilityPoints.entries()),
            recommendations: this.generateRecommendations(graphAnalysis)
        };
    }
    
    generateRecommendations(graphAnalysis) {
        const recommendations = [];
        
        // Parse errors
        if (graphAnalysis.summary.parseErrors > 0) {
            recommendations.push({
                priority: 'critical',
                action: 'Fix parse errors',
                description: `${graphAnalysis.summary.parseErrors} files have syntax errors`,
                impact: 'Critical path failures'
            });
        }
        
        // Circular dependencies
        if (graphAnalysis.summary.cycles > 0) {
            recommendations.push({
                priority: 'high',
                action: 'Resolve circular dependencies',
                description: `${graphAnalysis.summary.cycles} circular dependencies detected`,
                impact: 'Module initialization issues'
            });
        }
        
        // Side effects
        if (graphAnalysis.summary.sideEffects > 0) {
            recommendations.push({
                priority: 'medium',
                action: 'Isolate module side effects',
                description: `${graphAnalysis.summary.sideEffects} files have module-level side effects`,
                impact: 'SSR and testing issues'
            });
        }
        
        return recommendations;
    }
    
    displayScanSummary(report) {
        console.log(chalk.blue.bold('\n📊 SCAN SUMMARY\n'));
        
        const summary = report.summary;
        
        console.log(boxen(
            chalk.white.bold(`Project: ${report.project}\n`) +
            chalk.white(`Files: ${summary.totalNodes}\n`) +
            chalk.white(`Imports: ${summary.totalEdges}\n`) +
            chalk.white(`Entry Points: ${summary.entryPoints}\n`) +
            chalk.white(`Critical Paths: ${summary.criticalPaths}\n`) +
            chalk.red(`Parse Errors: ${summary.parseErrors}\n`) +
            chalk.yellow(`Circular Dependencies: ${summary.cycles}\n`) +
            chalk.yellow(`Side Effects: ${summary.sideEffects}\n`) +
            chalk.blue(`Risk Level: ${summary.riskLevel}\n`) +
            chalk.green(`Success Probability: ${Math.round(summary.successProbability * 100)}%`),
            {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'blue'
            }
        ));
        
        // Display critical recommendations
        if (report.recommendations.length > 0) {
            console.log(chalk.red.bold('\n🚨 CRITICAL ACTIONS REQUIRED:\n'));
            
            report.recommendations
                .filter(r => r.priority === 'critical')
                .forEach(rec => {
                    console.log(chalk.red(`  • ${rec.action}: ${rec.description}`));
                });
        }
    }
    
    async fixCommand(options) {
        console.log(chalk.blue.bold('\n🔧 ARES - Deterministic Fix Engine\n'));
        
        const fixSpinner = ora('Preparing fixes...').start();
        
        try {
            // First, scan to understand the project
            fixSpinner.text = 'Scanning project for issues...';
            const scanReport = await this.scanCommand({ ...options, save: false });
            
            if (scanReport.summary.parseErrors === 0 && 
                scanReport.summary.cycles === 0 &&
                scanReport.summary.sideEffects === 0) {
                fixSpinner.succeed('No issues found to fix!');
                return { fixed: 0, skipped: 0, failed: 0 };
            }
            
            // Create backup
            fixSpinner.text = 'Creating pre-fix backup...';
            const snapshotId = await this.safetyEngine.createSnapshot(
                'pre_fix',
                'Snapshot before ARES fixes'
            );
            fixSpinner.succeed(`Backup created: ${snapshotId}`);
            
            // Apply fixes based on rules
            fixSpinner.text = 'Applying deterministic fixes...';
            const fixResults = await this.applyFixes(scanReport, options);
            fixSpinner.succeed('Fixes applied');
            
            // Verify fixes
            fixSpinner.text = 'Verifying fixes...';
            const verificationResults = await this.verifyFixes(fixResults);
            fixSpinner.succeed('Fixes verified');
            
            // Generate report
            const report = this.generateFixReport(fixResults, verificationResults);
            
            // Display summary
            this.displayFixSummary(report);
            
            // Save report
            if (options.save) {
                this.saveReport(report, 'fix_report');
            }
            
            return report;
            
        } catch (error) {
            fixSpinner.fail(`Fix operation failed: ${error.message}`);
            
            // Offer rollback
            if (await this.offerRollback()) {
                console.log(chalk.green('Rollback completed successfully'));
            }
            
            throw error;
        }
    }
    
    async applyFixes(scanReport, options) {
        const results = {
            applied: [],
            skipped: [],
            failed: [],
            proofs: []
        };
        
        // Apply fixes based on vulnerability points
        const vulnerabilityPoints = scanReport.vulnerabilityPoints;
        
        for (const [filePath, vulnerabilities] of vulnerabilityPoints) {
            for (const vulnerability of vulnerabilities) {
                const fixResult = await this.applyFix(filePath, vulnerability, options);
                
                if (fixResult.success) {
                    results.applied.push(fixResult);
                    results.proofs.push(fixResult.proof);
                } else if (fixResult.skipped) {
                    results.skipped.push(fixResult);
                } else {
                    results.failed.push(fixResult);
                }
            }
        }
        
        return results;
    }
    
    async applyFix(filePath, vulnerability, options) {
        try {
            const fullPath = path.join(this.projectRoot, filePath);
            
            if (!fs.existsSync(fullPath)) {
                return {
                    success: false,
                    filePath,
                    vulnerability,
                    error: 'File not found',
                    skipped: false
                };
            }
            
            // Read file
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Parse AST
            const ast = this.astEngine.parseWithFallback(content, fullPath);
            
            // Check if fix is needed
            if (vulnerability.type === 'parse_error') {
                // Apply parse error fix
                const transformationId = 'DRL-0001'; // Stray text fix
                
                const context = {
                    filePath,
                    vulnerability,
                    theoremId: 'THEOREM-001',
                    line: vulnerability.errors[0]?.line || 1
                };
                
                const transformation = this.transformationEngine.applyTransformation(
                    transformationId,
                    ast,
                    context
                );
                
                if (transformation.success) {
                    // Generate new code
                    const newCode = this.astEngine.generateCode(transformation.transformedAst);
                    
                    // Verify transformation
                    const verification = this.verificationEngine.verifyTransformation(
                        transformationId,
                        content,
                        newCode,
                        context
                    );
                    
                    if (verification.success) {
                        // Apply fix
                        if (!options.dryRun) {
                            fs.writeFileSync(fullPath, newCode);
                        }
                        
                        return {
                            success: true,
                            filePath,
                            vulnerability,
                            transformation: transformationId,
                            proof: verification.proofId,
                            dryRun: options.dryRun,
                            verification
                        };
                    }
                }
            }
            
            // Other vulnerability types would be handled here...
            
            return {
                success: false,
                filePath,
                vulnerability,
                error: 'No applicable fix found',
                skipped: true
            };
            
        } catch (error) {
            return {
                success: false,
                filePath,
                vulnerability,
                error: error.message,
                skipped: false
            };
        }
    }
    
    async verifyFixes(fixResults) {
        const verification = {
            total: fixResults.applied.length,
            successful: 0,
            failed: 0,
            details: []
        };
        
        for (const fix of fixResults.applied) {
            if (fix.verification?.success) {
                verification.successful++;
                verification.details.push({
                    file: fix.filePath,
                  success: true,
                  proof: fix.proof
                });
            } else {
                verification.failed++;
                verification.details.push({
                    file: fix.filePath,
                  success: false,
                  error: fix.verification?.error || 'Verification failed'
                });
            }
        }
        
        return verification;
    }
    
    generateFixReport(fixResults, verificationResults) {
        return {
            timestamp: new Date().toISOString(),
            summary: {
                totalFixesAttempted: fixResults.applied.length + fixResults.failed.length,
                fixesApplied: fixResults.applied.length,
                fixesFailed: fixResults.failed.length,
                fixesSkipped: fixResults.skipped.length,
                verificationSuccessRate: verificationResults.total > 0 ? 
                    verificationResults.successful / verificationResults.total : 0
            },
            applied: fixResults.applied,
            failed: fixResults.failed,
            skipped: fixResults.skipped,
            verification: verificationResults,
            proofs: fixResults.proofs.slice(0, 10) // First 10 proofs
        };
    }
    
    displayFixSummary(report) {
        console.log(chalk.blue.bold('\n📊 FIX SUMMARY\n'));
        
        const summary = report.summary;
        
        console.log(boxen(
            chalk.white.bold(`Fixes Applied: ${summary.fixesApplied}\n`) +
            chalk.red(`Fixes Failed: ${summary.fixesFailed}\n`) +
            chalk.yellow(`Fixes Skipped: ${summary.fixesSkipped}\n`) +
            chalk.green(`Verification Success: ${Math.round(summary.verificationSuccessRate * 100)}%\n`) +
            chalk.blue(`Total Attempted: ${summary.totalFixesAttempted}`),
            {
                padding: 1,
                margin: 1,
                borderStyle: 'round',
                borderColor: 'green'
            }
        ));
        
        // Show sample of applied fixes
        if (report.applied.length > 0) {
            console.log(chalk.green.bold('\n✅ SUCCESSFUL FIXES (Sample):\n'));
            
            report.applied.slice(0, 3).forEach(fix => {
                console.log(chalk.green(`  • ${path.basename(fix.filePath)}: ${fix.vulnerability.type}`));
            });
            
            if (report.applied.length > 3) {
                console.log(chalk.green(`  ... and ${report.applied.length - 3} more`));
            }
        }
        
        // Show failed fixes
        if (report.failed.length > 0) {
            console.log(chalk.red.bold('\n❌ FAILED FIXES (Sample):\n'));
            
            report.failed.slice(0, 3).forEach(fix => {
                console.log(chalk.red(`  • ${path.basename(fix.filePath)}: ${fix.error}`));
            });
        }
    }
    
    async offerRollback() {
        const { confirm } = require('@inquirer/prompts');
        
        try {
            const answer = await confirm({
                message: 'Would you like to rollback to the previous state?',
                default: true
            });
            
            if (answer) {
                const snapshots = this.safetyEngine.getSnapshots();
                if (snapshots.length > 0) {
                    const latestSnapshot = snapshots[snapshots.length - 1];
                    
                    console.log(chalk.yellow(`\nRolling back to snapshot: ${latestSnapshot.tag}`));
                    
                    const rollbackResult = await this.safetyEngine.executeRollback(
                        latestSnapshot.id,
                        false
                    );
                    
                    return rollbackResult.success;
                }
            }
            
            return false;
        } catch {
            return false;
        }
    }
    
    saveReport(report, name) {
        const reportsDir = path.join(this.aresHome, 'reports');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${name}_${timestamp}.json`;
        const filepath = path.join(reportsDir, filename);
        
        fs.mkdirSync(reportsDir, { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
        
        console.log(chalk.blue(`\n📁 Report saved: ${filepath}`));
    }
    
    async cleanup() {
        console.log(chalk.blue.bold('\n🧹 ARES - Cleanup\n'));
        
        const cleanupSpinner = ora('Cleaning up...').start();
        
        try {
            // Cleanup safety engine
            this.safetyEngine.cleanup();
            
            // Cleanup performance engine
            this.performanceEngine.cleanup();
            
            // Save performance metrics
            const metrics = this.performanceEngine.exportMetrics();
            this.saveReport(metrics, 'performance_metrics');
            
            cleanupSpinner.succeed('Cleanup completed');
            
        } catch (error) {
            cleanupSpinner.fail(`Cleanup failed: ${error.message}`);
        }
    }
}

// CLI Program Setup
async function main() {
    // ASCII Art Banner
    console.log(chalk.blue.bold(
        figlet.textSync('ARES v3.0', { horizontalLayout: 'full' })
    ));
    
    console.log(chalk.gray('Arvdoul Repository Engineering System - Facebook/Google Internal Grade\n'));
    
    const cli = new AresCLI();
    
    program
        .name('ares')
        .description('ARES v3.0 - Deterministic Repository Engineering System')
        .version('3.0.0');
    
    program
        .command('scan')
        .description('Deep scan of repository for issues and vulnerabilities')
        .option('-f, --force', 'Force operation despite warnings')
        .option('-s, --save', 'Save detailed report')
        .option('-v, --verbose', 'Verbose output')
        .action(async (options) => {
            cli.verbose = options.verbose;
            await cli.scanCommand(options);
            await cli.cleanup();
        });
    
    program
        .command('fix')
        .description('Apply deterministic fixes to repository issues')
        .option('-d, --dry-run', 'Dry run - show what would be fixed')
        .option('-f, --force', 'Force operation despite warnings')
        .option('-s, --save', 'Save detailed report')
        .option('-v, --verbose', 'Verbose output')
        .action(async (options) => {
            cli.verbose = options.verbose;
            await cli.fixCommand(options);
            await cli.cleanup();
        });
    
    program
        .command('verify')
        .description('Verify repository state and fixes')
        .action(async () => {
            console.log(chalk.blue.bold('\n✅ ARES - Verification\n'));
            
            const verifySpinner = ora('Verifying repository...').start();
            
            try {
                // Scan first
                const scanReport = await cli.scanCommand({ save: false });
                
                // Check verification
                const snapshots = cli.safetyEngine.getSnapshots();
                const proofs = cli.verificationEngine.getAllProofs();
                
                verifySpinner.succeed('Verification completed');
                
                console.log(boxen(
                    chalk.white.bold(`Repository: ${path.basename(cli.projectRoot)}\n`) +
                    chalk.white(`Snapshots: ${snapshots.length}\n`) +
                    chalk.white(`Mathematical Proofs: ${proofs.length}\n`) +
                    chalk.green(`Parse Errors: ${scanReport.summary.parseErrors}\n`) +
                    chalk.blue(`Risk Level: ${scanReport.summary.riskLevel}`),
                    {
                        padding: 1,
                        margin: 1,
                        borderStyle: 'round',
                        borderColor: 'blue'
                    }
                ));
                
            } catch (error) {
                verifySpinner.fail(`Verification failed: ${error.message}`);
            }
            
            await cli.cleanup();
        });
    
    program
        .command('rollback')
        .description('Rollback to previous snapshot')
        .option('-i, --id <snapshotId>', 'Specific snapshot ID')
        .option('-l, --list', 'List available snapshots')
        .action(async (options) => {
            console.log(chalk.blue.bold('\n🔄 ARES - Rollback\n'));
            
            if (options.list) {
                const snapshots = cli.safetyEngine.getSnapshots();
                
                console.log(chalk.white.bold('Available Snapshots:\n'));
                
                snapshots.forEach(snapshot => {
                    console.log(chalk.blue(`  ${snapshot.id}`));
                    console.log(chalk.gray(`    Tag: ${snapshot.tag}`));
                    console.log(chalk.gray(`    Time: ${snapshot.timestamp}`));
                    console.log(chalk.gray(`    Files: ${snapshot.files.length}\n`));
                });
                
                return;
            }
            
            const rollbackSpinner = ora('Preparing rollback...').start();
            
            try {
                let snapshotId = options.id;
                
                if (!snapshotId) {
                    const snapshots = cli.safetyEngine.getSnapshots();
                    if (snapshots.length === 0) {
                        rollbackSpinner.fail('No snapshots available for rollback');
                        return;
                    }
                    
                    // Use latest snapshot
                    snapshotId = snapshots[snapshots.length - 1].id;
                }
                
                rollbackSpinner.text = `Rolling back to snapshot ${snapshotId}...`;
                
                const result = await cli.safetyEngine.executeRollback(snapshotId, false);
                
                if (result.success) {
                    rollbackSpinner.succeed(`Rollback successful to snapshot ${snapshotId}`);
                } else {
                    rollbackSpinner.fail(`Rollback failed: ${result.message}`);
                }
                
            } catch (error) {
                rollbackSpinner.fail(`Rollback failed: ${error.message}`);
            }
            
            await cli.cleanup();
        });
    
    program
        .command('status')
        .description('Show ARES system status')
        .action(async () => {
            console.log(chalk.blue.bold('\n📈 ARES - System Status\n'));
            
            const statusSpinner = ora('Checking system status...').start();
            
            try {
                // Get metrics from all engines
                const astMetrics = cli.astEngine.getMetrics();
                const transformationMetrics = cli.transformationEngine.getTransformationMetrics();
                const safetySnapshots = cli.safetyEngine.getSnapshots();
                const performanceMetrics = cli.performanceEngine.exportMetrics();
                const verificationSummary = cli.verificationEngine.getVerificationSummary();
                
                statusSpinner.succeed('System status retrieved');
                
                console.log(boxen(
                    chalk.white.bold('System Status:\n') +
                    chalk.white(`AST Cache: ${astMetrics.cacheHits} hits\n`) +
                    chalk.white(`Transformations: ${transformationMetrics.successful} successful\n`) +
                    chalk.white(`Snapshots: ${safetySnapshots.length}\n`) +
                    chalk.white(`Proofs: ${verificationSummary.totalProofs}\n`) +
                    chalk.white(`Operations: ${performanceMetrics.summary.totalOperations}\n`) +
                    chalk.green(`Success Rate: ${Math.round(transformationMetrics.overallSuccessRate * 100)}%`),
                    {
                        padding: 1,
                        margin: 1,
                        borderStyle: 'round',
                        borderColor: 'green'
                    }
                ));
                
                // Show performance recommendations
                const recommendations = performanceMetrics.analysis.recommendations;
                if (recommendations.length > 0) {
                    console.log(chalk.yellow.bold('\n⚠️  Performance Recommendations:\n'));
                    
                    recommendations.slice(0, 3).forEach(rec => {
                        console.log(chalk.yellow(`  • ${rec.suggestion}`));
                    });
                }
                
            } catch (error) {
                statusSpinner.fail(`Status check failed: ${error.message}`);
            }
            
            await cli.cleanup();
        });
    
    // Parse command line arguments
    program.parse(process.argv);
    
    // Show help if no arguments
    if (!process.argv.slice(2).length) {
        program.help();
    }
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error(chalk.red.bold('\n❌ Unhandled Error:'));
    console.error(chalk.red(error.message));
    
    if (process.env.DEBUG) {
        console.error(error.stack);
    }
    
    process.exit(1);
});

// Run CLI
if (require.main === module) {
    main().catch(error => {
        console.error(chalk.red.bold('\n❌ ARES Fatal Error:'));
        console.error(chalk.red(error.message));
        process.exit(1);
    });
}

module.exports = AresCLI;
