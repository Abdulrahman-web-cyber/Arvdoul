/**
 * PERFORMANCE ANALYTICS ENGINE v3.0
 * Real-time Metrics, Predictive Analysis, Optimization
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class PerformanceAnalyticsEngine {
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.metrics = {
            startup: Date.now(),
            operations: [],
            fileOperations: [],
            parseOperations: [],
            memoryUsage: [],
            timing: {}
        };
        
        this.predictiveModels = new Map();
        this.optimizationSuggestions = [];
        this.benchmarks = new Map();
        
        this.startMonitoring();
    }
    
    startMonitoring() {
        // Start periodic monitoring
        this.monitorInterval = setInterval(() => {
            this.recordMemoryUsage();
        }, 5000); // Every 5 seconds
        
        // Record startup metrics
        this.recordMetric('startup', {
            timestamp: new Date().toISOString(),
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem()
        });
    }
    
    recordMetric(category, data) {
        const metric = {
            category,
            timestamp: new Date().toISOString(),
            data,
            performance: this.getCurrentPerformance()
        };
        
        this.metrics.operations.push(metric);
        
        // Categorize
        if (category === 'file_operation') {
            this.metrics.fileOperations.push(metric);
        } else if (category === 'parse_operation') {
            this.metrics.parseOperations.push(metric);
        }
        
        // Keep only last 1000 operations
        if (this.metrics.operations.length > 1000) {
            this.metrics.operations = this.metrics.operations.slice(-1000);
        }
        
        return metric;
    }
    
    getCurrentPerformance() {
        return {
            memory: process.memoryUsage(),
            cpu: os.loadavg(),
            uptime: process.uptime(),
            timestamp: Date.now()
        };
    }
    
    recordMemoryUsage() {
        const usage = process.memoryUsage();
        this.metrics.memoryUsage.push({
            timestamp: Date.now(),
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            rss: usage.rss,
            external: usage.external
        });
        
        // Keep only last 100 readings
        if (this.metrics.memoryUsage.length > 100) {
            this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
        }
    }
    
    startTiming(operation) {
        const id = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.metrics.timing[id] = {
            operation,
            start: Date.now(),
            startMemory: process.memoryUsage()
        };
        
        return id;
    }
    
    endTiming(timingId, result = {}) {
        if (!this.metrics.timing[timingId]) {
            return null;
        }
        
        const timing = this.metrics.timing[timingId];
        const end = Date.now();
        const duration = end - timing.start;
        
        const finalMetric = {
            ...timing,
            end,
            duration,
            endMemory: process.memoryUsage(),
            memoryDelta: this.calculateMemoryDelta(timing.startMemory, process.memoryUsage()),
            result
        };
        
        // Record as operation
        this.recordMetric('timing', finalMetric);
        
        // Store benchmark if applicable
        if (duration > 100) { // Only store operations longer than 100ms
            this.storeBenchmark(timing.operation, duration);
        }
        
        // Generate optimization suggestion if needed
        if (duration > 1000) { // Operations longer than 1 second
            this.generateOptimizationSuggestion(timing.operation, duration);
        }
        
        // Clean up
        delete this.metrics.timing[timingId];
        
        return finalMetric;
    }
    
    calculateMemoryDelta(startMemory, endMemory) {
        return {
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            rss: endMemory.rss - startMemory.rss,
            external: endMemory.external - startMemory.external
        };
    }
    
    storeBenchmark(operation, duration) {
        if (!this.benchmarks.has(operation)) {
            this.benchmarks.set(operation, []);
        }
        
        const benchmarks = this.benchmarks.get(operation);
        benchmarks.push({
            duration,
            timestamp: Date.now(),
            memory: process.memoryUsage()
        });
        
        // Keep only last 50 benchmarks per operation
        if (benchmarks.length > 50) {
            benchmarks.shift();
        }
    }
    
    generateOptimizationSuggestion(operation, duration) {
        const suggestion = {
            operation,
            duration,
            timestamp: new Date().toISOString(),
            severity: this.calculateSeverity(duration),
            suggestion: this.generateSuggestionText(operation, duration)
        };
        
        this.optimizationSuggestions.push(suggestion);
        
        // Keep only last 20 suggestions
        if (this.optimizationSuggestions.length > 20) {
            this.optimizationSuggestions.shift();
        }
        
        return suggestion;
    }
    
    calculateSeverity(duration) {
        if (duration > 10000) return 'critical'; // > 10 seconds
        if (duration > 5000) return 'high';      // > 5 seconds
        if (duration > 2000) return 'medium';    // > 2 seconds
        if (duration > 1000) return 'low';       // > 1 second
        return 'info';
    }
    
    generateSuggestionText(operation, duration) {
        const suggestions = {
            'parse_file': `File parsing took ${duration}ms. Consider caching AST results or using incremental parsing.`,
            'build_graph': `Graph construction took ${duration}ms. Consider parallel processing or lazy loading.`,
            'apply_transformation': `AST transformation took ${duration}ms. Consider batching transformations or using worker threads.`,
            'backup_creation': `Backup creation took ${duration}ms. Consider incremental backups or compression.`
        };
        
        return suggestions[operation] || `Operation "${operation}" took ${duration}ms. Consider optimizing this operation.`;
    }
    
    analyzePerformance() {
        const analysis = {
            summary: {},
            bottlenecks: [],
            recommendations: [],
            predictions: this.generatePredictions()
        };
        
        // Calculate summary statistics
        analysis.summary = this.calculateSummaryStatistics();
        
        // Identify bottlenecks
        analysis.bottlenecks = this.identifyBottlenecks();
        
        // Generate recommendations
        analysis.recommendations = this.generateRecommendations();
        
        return analysis;
    }
    
    calculateSummaryStatistics() {
        const operations = this.metrics.operations;
        
        if (operations.length === 0) {
            return {
                totalOperations: 0,
                averageDuration: 0,
                memoryPeak: 0,
                suggestions: 0
            };
        }
        
        const timingOperations = operations.filter(op => op.category === 'timing');
        const durations = timingOperations.map(op => op.data.duration || 0);
        
        // Memory usage
        const memoryReadings = this.metrics.memoryUsage;
        const heapUsedValues = memoryReadings.map(m => m.heapUsed);
        
        return {
            totalOperations: operations.length,
            timingOperations: timingOperations.length,
            averageDuration: durations.length > 0 ? 
                durations.reduce((a, b) => a + b, 0) / durations.length : 0,
            maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
            minDuration: durations.length > 0 ? Math.min(...durations) : 0,
            memoryPeak: heapUsedValues.length > 0 ? Math.max(...heapUsedValues) : 0,
            averageMemory: heapUsedValues.length > 0 ? 
                heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length : 0,
            optimizationSuggestions: this.optimizationSuggestions.length,
            benchmarks: this.benchmarks.size
        };
    }
    
    identifyBottlenecks() {
        const bottlenecks = [];
        
        // Check for slow operations
        for (const [operation, benchmarks] of this.benchmarks) {
            if (benchmarks.length > 0) {
                const avgDuration = benchmarks.reduce((sum, b) => sum + b.duration, 0) / benchmarks.length;
                
                if (avgDuration > 1000) { // Average > 1 second
                    bottlenecks.push({
                        operation,
                        averageDuration: avgDuration,
                        samples: benchmarks.length,
                        severity: this.calculateSeverity(avgDuration)
                    });
                }
            }
        }
        
        // Check memory bottlenecks
        const memoryReadings = this.metrics.memoryUsage;
        if (memoryReadings.length > 0) {
            const lastMemory = memoryReadings[memoryReadings.length - 1];
            
            if (lastMemory.heapUsed > 500 * 1024 * 1024) { // > 500MB
                bottlenecks.push({
                    operation: 'memory_usage',
                    metric: 'heapUsed',
                    value: lastMemory.heapUsed,
                    severity: 'high'
                });
            }
        }
        
        return bottlenecks;
    }
    
    generateRecommendations() {
        const recommendations = [];
        const summary = this.calculateSummaryStatistics();
        
        // Memory recommendations
        if (summary.memoryPeak > 1000 * 1024 * 1024) { // > 1GB
            recommendations.push({
                category: 'memory',
                severity: 'high',
                suggestion: 'Consider implementing memory pooling or streaming for large file operations',
                impact: 'Reduces memory usage by up to 70%'
            });
        }
        
        // Duration recommendations
        if (summary.averageDuration > 2000) { // > 2 seconds average
            recommendations.push({
                category: 'performance',
                severity: 'medium',
                suggestion: 'Implement parallel processing for independent operations',
                impact: 'Could reduce processing time by 30-50%'
            });
        }
        
        // File operation recommendations
        const fileOps = this.metrics.fileOperations.length;
        if (fileOps > 1000) {
            recommendations.push({
                category: 'io',
                severity: 'low',
                suggestion: 'Consider batch file operations or caching file metadata',
                impact: 'Reduces disk I/O overhead'
            });
        }
        
        // Add optimization suggestions
        this.optimizationSuggestions.forEach(suggestion => {
            recommendations.push({
                category: 'optimization',
                severity: suggestion.severity,
                suggestion: suggestion.suggestion,
                operation: suggestion.operation
            });
        });
        
        return recommendations;
    }
    
    generatePredictions() {
        const predictions = [];
        
        // Predict memory usage growth
        const memoryTrend = this.calculateMemoryTrend();
        if (memoryTrend.growthRate > 0.1) { // > 10% growth per operation
            predictions.push({
                type: 'memory_growth',
                current: memoryTrend.current,
                predicted: memoryTrend.predicted,
                growthRate: memoryTrend.growthRate,
                warning: memoryTrend.growthRate > 0.5 ? 'High memory growth detected' : 'Moderate memory growth'
            });
        }
        
        // Predict operation duration
        const durationTrend = this.calculateDurationTrend();
        if (durationTrend.growthRate > 0.2) { // > 20% growth
            predictions.push({
                type: 'duration_growth',
                current: durationTrend.current,
                predicted: durationTrend.predicted,
                growthRate: durationTrend.growthRate,
                warning: 'Operations are getting slower over time'
            });
        }
        
        return predictions;
    }
    
    calculateMemoryTrend() {
        const memoryReadings = this.metrics.memoryUsage;
        
        if (memoryReadings.length < 10) {
            return { current: 0, predicted: 0, growthRate: 0 };
        }
        
        // Simple linear regression for last 10 readings
        const samples = memoryReadings.slice(-10);
        const times = samples.map((s, i) => i);
        const values = samples.map(s => s.heapUsed);
        
        const n = samples.length;
        const sumX = times.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = times.reduce((sum, x, i) => sum + x * values[i], 0);
        const sumXX = times.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const current = values[values.length - 1];
        const predicted = intercept + slope * (n + 5); // Predict 5 samples ahead
        
        return {
            current,
            predicted,
            growthRate: slope / current
        };
    }
    
    calculateDurationTrend() {
        const timingOps = this.metrics.operations.filter(op => op.category === 'timing');
        
        if (timingOps.length < 5) {
            return { current: 0, predicted: 0, growthRate: 0 };
        }
        
        // Get durations from last 5 timing operations
        const durations = timingOps.slice(-5).map(op => op.data.duration || 0);
        
        // Simple average growth
        const current = durations[durations.length - 1];
        const previous = durations.length > 1 ? durations[durations.length - 2] : current;
        
        const growthRate = previous > 0 ? (current - previous) / previous : 0;
        const predicted = current * (1 + growthRate);
        
        return {
            current,
            predicted,
            growthRate
        };
    }
    
    getOptimizationSuggestions() {
        return this.optimizationSuggestions;
    }
    
    getBenchmarks() {
        const result = {};
        for (const [operation, benchmarks] of this.benchmarks) {
            if (benchmarks.length > 0) {
                const avg = benchmarks.reduce((sum, b) => sum + b.duration, 0) / benchmarks.length;
                result[operation] = {
                    average: avg,
                    samples: benchmarks.length,
                    last: benchmarks[benchmarks.length - 1]
                };
            }
        }
        return result;
    }
    
    exportMetrics() {
        return {
            metrics: this.metrics,
            analysis: this.analyzePerformance(),
            suggestions: this.optimizationSuggestions,
            benchmarks: this.getBenchmarks(),
            summary: this.calculateSummaryStatistics()
        };
    }
    
    cleanup() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
        }
        
        console.log('📊 Performance monitoring stopped');
    }
}

module.exports = PerformanceAnalyticsEngine;
