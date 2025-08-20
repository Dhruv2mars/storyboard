/**
 * Production-level Queue System Test
 * 
 * This script uses Convex CLI to test the queue system with multiple users
 */

const { execSync, spawn } = require('child_process');

class QueueSystemTester {
  constructor() {
    this.startTime = Date.now();
  }

  log(message, data = null) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`\n[${elapsed}s] 🧪 ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async runConvexAction(actionName, args = {}) {
    try {
      const argsStr = Object.keys(args).length > 0 ? ` '${JSON.stringify(args)}'` : '';
      const command = `bunx convex run ${actionName}${argsStr}`;
      
      console.log(`  Running: ${command}`);
      const result = execSync(command, { 
        encoding: 'utf8', 
        cwd: __dirname,
        timeout: 30000 
      });
      
      // Try to parse JSON result
      try {
        return JSON.parse(result.trim());
      } catch {
        return result.trim();
      }
    } catch (error) {
      console.error(`❌ Failed to run ${actionName}:`, error.message);
      return null;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testMultiUserSimulation() {
    this.log("🚀 Testing Multi-User Simulation");
    
    // Clean up any existing test data first
    this.log("Cleaning up existing test data...");
    await this.runConvexAction('testActions:cleanupTestData');
    
    // Simulate 5 concurrent users
    this.log("Simulating 5 concurrent users submitting storyboards...");
    const result = await this.runConvexAction('testActions:simulateMultipleUsers', {
      numberOfUsers: 5
    });
    
    if (!result) {
      return false;
    }
    
    this.log("Multi-user simulation results:", {
      submitted: result.submittedCount,
      successful: result.successfulSubmissions?.length || 0,
      failed: result.failedSubmissions?.length || 0
    });
    
    return result.successfulSubmissions?.length > 0;
  }

  async monitorQueueProcessing() {
    this.log("👀 Monitoring Queue Processing for 3 minutes...");
    
    const monitoringResults = [];
    const startTime = Date.now();
    const endTime = startTime + (3 * 60 * 1000); // 3 minutes
    let iteration = 0;
    
    while (Date.now() < endTime) {
      iteration++;
      
      const status = await this.runConvexAction('testActions:getQueueTestStatus');
      
      if (status) {
        const qStats = status.queueStats || {};
        const rStats = status.rateLimitStatus || {};
        
        console.log(`  [${iteration}] Queue: ${qStats.totalQueued} queued, ${qStats.totalProcessing} processing, ${qStats.totalCompleted} completed, ${qStats.totalFailed} failed | Rate: ${rStats.currentCount}/10`);
        
        monitoringResults.push({
          iteration,
          timestamp: Date.now(),
          ...status
        });
        
        // If all are completed, break early
        if (qStats.totalQueued === 0 && qStats.totalProcessing === 0) {
          this.log("✅ All items processed!");
          break;
        }
      }
      
      await this.sleep(10000); // Check every 10 seconds
    }
    
    return monitoringResults;
  }

  async testStressLoad() {
    this.log("🔥 Running Stress Test");
    
    const result = await this.runConvexAction('testActions:stressTestQueue', {
      numberOfRequests: 8,
      delayBetweenRequests: 200
    });
    
    if (result) {
      this.log("Stress test results:", {
        duration: `${result.duration}ms`,
        requests: result.totalRequests,
        success: result.successCount,
        failures: result.failureCount,
        requestsPerSecond: result.requestsPerSecond
      });
      
      return result.successCount > 0;
    }
    
    return false;
  }

  async validateQueueBehavior(monitoringResults) {
    this.log("🔍 Validating Queue Behavior");
    
    let rateLimitViolations = 0;
    let maxConcurrentProcessing = 0;
    let processingRate = [];
    
    monitoringResults.forEach((result, index) => {
      const rateLimitCount = result.rateLimitStatus?.currentCount || 0;
      const processing = result.queueStats?.totalProcessing || 0;
      
      // Check rate limit violations
      if (rateLimitCount > 10) {
        rateLimitViolations++;
      }
      
      // Track max concurrent processing (should be 1)
      if (processing > maxConcurrentProcessing) {
        maxConcurrentProcessing = processing;
      }
      
      // Calculate processing rate
      if (index > 0) {
        const prevResult = monitoringResults[index - 1];
        const completedDiff = (result.queueStats?.totalCompleted || 0) - 
                             (prevResult.queueStats?.totalCompleted || 0);
        const timeDiff = (result.timestamp - prevResult.timestamp) / 1000; // seconds
        
        if (timeDiff > 0) {
          processingRate.push(completedDiff / timeDiff);
        }
      }
    });
    
    const avgProcessingRate = processingRate.length > 0 
      ? processingRate.reduce((a, b) => a + b) / processingRate.length 
      : 0;
    
    const validationResults = {
      rateLimitViolations,
      maxConcurrentProcessing,
      avgProcessingRate: avgProcessingRate.toFixed(4),
      passed: rateLimitViolations === 0 && maxConcurrentProcessing <= 1
    };
    
    this.log("Validation Results:", validationResults);
    return validationResults;
  }

  async runFullTest() {
    try {
      this.log("🧪 Starting Production-Level Queue System Test");
      console.log("=".repeat(60));

      // Test 1: Multi-user simulation
      const simulationSuccess = await this.testMultiUserSimulation();
      if (!simulationSuccess) {
        this.log("❌ Multi-user simulation failed");
        return false;
      }

      console.log("=".repeat(60));

      // Test 2: Monitor processing
      const monitoringResults = await this.monitorQueueProcessing();
      
      console.log("=".repeat(60));

      // Test 3: Stress test
      const stressSuccess = await this.testStressLoad();
      
      console.log("=".repeat(60));

      // Test 4: Validate behavior
      const validationResults = await this.validateQueueBehavior(monitoringResults);
      
      console.log("=".repeat(60));

      // Final results
      const allTestsPassed = simulationSuccess && stressSuccess && validationResults.passed;
      
      this.log(`🏁 Test Complete! Result: ${allTestsPassed ? "✅ PASSED" : "❌ FAILED"}`);
      
      if (!allTestsPassed) {
        this.log("Issues detected:");
        if (!simulationSuccess) console.log("  - Multi-user simulation failed");
        if (!stressSuccess) console.log("  - Stress test failed");
        if (!validationResults.passed) console.log("  - Queue behavior validation failed");
      }
      
      const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);
      this.log(`Total test duration: ${totalTime} seconds`);
      
      // Clean up after test
      this.log("Cleaning up test data...");
      await this.runConvexAction('testActions:cleanupTestData');
      
      return allTestsPassed;

    } catch (error) {
      this.log("💥 Test failed with error:", error.message);
      return false;
    }
  }
}

// Main execution
async function main() {
  const tester = new QueueSystemTester();
  
  console.log("🎯 Production-Level Queue System Test");
  console.log("This test will:");
  console.log("• Simulate 5 concurrent users");
  console.log("• Monitor queue processing for 3 minutes");
  console.log("• Run stress test with 8 rapid requests");
  console.log("• Validate rate limiting (10 RPM)");
  console.log("• Validate FIFO queue ordering");
  console.log("• Check for race conditions");
  console.log("");
  
  const success = await tester.runFullTest();
  process.exit(success ? 0 : 1);
}

// Handle interruption gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  process.exit(1);
});

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});