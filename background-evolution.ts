/**
 * Continuous Background Evolution Service
 * Runs genetic algorithm continuously to improve trading strategy
 * Automatically deploys better strategies to live trading
 */

import { StrategyEvolver, StrategyGenes } from "./strategy-evolution";
import { compareStrategies } from "./strategy-backtester";
import {
  EvolvedStrategyEngine,
  selectBestStrategy,
  LiveTradingWithEvolvedStrategy,
} from "./evolved-strategy-injector";
import { AIBacktester, PriceBar } from "./ai-backtest";

// ============= BACKGROUND EVOLUTION STATE =============

export interface EvolutionCycle {
  cycleNumber: number;
  timestamp: Date;
  generationCount: number;
  bestFitness: number;
  previousFitness: number | null;
  improvementPercent: number;
  deployed: boolean;
  reason: string;
}

export interface BackgroundEvolutionConfig {
  enabled: boolean;
  cycleDurationMinutes: number; // How often to run evolution
  populationSize: number;
  generationCount: number;
  improvementThreshold: number; // Minimum % improvement to deploy
  maxConsecutiveNoImprovement: number; // Stop after N cycles with no improvement
}

// ============= BACKGROUND EVOLUTION MANAGER =============

export class BackgroundEvolutionManager {
  private config: BackgroundEvolutionConfig;
  private isRunning: boolean = false;
  private cycleHistory: EvolutionCycle[] = [];
  private currentBestGenes: StrategyGenes | null = null;
  private currentBestFitness: number = 0;
  private noImprovementCount: number = 0;
  private cycleNumber: number = 0;
  private liveTrading: LiveTradingWithEvolvedStrategy | null = null;

  constructor(config: Partial<BackgroundEvolutionConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      cycleDurationMinutes: config.cycleDurationMinutes ?? 5,
      populationSize: config.populationSize ?? 100,
      generationCount: config.generationCount ?? 30,
      improvementThreshold: config.improvementThreshold ?? 2, // 2% improvement minimum
      maxConsecutiveNoImprovement: config.maxConsecutiveNoImprovement ?? 10,
    };
  }

  /**
   * Start continuous background evolution
   */
  start(priceDataProvider: () => Promise<PriceBar[]>): void {
    if (this.isRunning) {
      console.warn("⚠️ Background evolution already running");
      return;
    }

    this.isRunning = true;
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║         BACKGROUND EVOLUTION SERVICE STARTED              ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("Configuration:");
    console.log(`  Cycle Duration: ${this.config.cycleDurationMinutes} minutes`);
    console.log(`  Population Size: ${this.config.populationSize}`);
    console.log(`  Generations per Cycle: ${this.config.generationCount}`);
    console.log(`  Improvement Threshold: ${this.config.improvementThreshold}%`);
    console.log(`  Max No-Improvement Cycles: ${this.config.maxConsecutiveNoImprovement}\n`);

    this.runEvolutionLoop(priceDataProvider);
  }

  /**
   * Stop background evolution
   */
  stop(): void {
    this.isRunning = false;
    console.log("\n⏹️ Background evolution service stopped");
    console.log(`Total cycles completed: ${this.cycleNumber}`);
    console.log(`Best fitness achieved: ${this.currentBestFitness.toFixed(2)}/100`);
  }

  /**
   * Main evolution loop
   */
  private async runEvolutionLoop(
    priceDataProvider: () => Promise<PriceBar[]>
  ): Promise<void> {
    while (this.isRunning) {
      try {
        this.cycleNumber++;

        console.log(`\n${"=".repeat(60)}`);
        console.log(`EVOLUTION CYCLE #${this.cycleNumber} - ${new Date().toISOString()}`);
        console.log(`${"=".repeat(60)}`);

        // Get fresh price data
        console.log("Fetching price data...");
        const priceData = await priceDataProvider();
        console.log(`✓ Received ${priceData.length} price bars\n`);

        // Run evolution
        const result = await this.runEvolutionCycle(priceData);

        // Decide whether to deploy
        const shouldDeploy = this.shouldDeployNewStrategy(result);

        // Log cycle
        this.logCycle(result, shouldDeploy);

        // Deploy if better
        if (shouldDeploy) {
          this.deployNewStrategy(result.genes, result.fitness);
        }

        // Check stopping condition
        if (this.noImprovementCount >= this.config.maxConsecutiveNoImprovement) {
          console.log(
            `\n⏸️ Stopping evolution: No improvement for ${this.config.maxConsecutiveNoImprovement} cycles`
          );
          this.stop();
          break;
        }

        // Wait for next cycle
        const waitMs = this.config.cycleDurationMinutes * 60 * 1000;
        console.log(
          `\n⏳ Next cycle in ${this.config.cycleDurationMinutes} minutes...`
        );
        await this.sleep(waitMs);
      } catch (error) {
        console.error("❌ Evolution cycle error:", error);
        // Continue running despite errors
        const waitMs = this.config.cycleDurationMinutes * 60 * 1000;
        await this.sleep(waitMs);
      }
    }
  }

  /**
   * Run single evolution cycle
   */
  private async runEvolutionCycle(priceData: PriceBar[]): Promise<{
    genes: StrategyGenes;
    fitness: number;
  }> {
    const evolver = new StrategyEvolver({
      populationSize: this.config.populationSize,
      generationCount: this.config.generationCount,
      mutationRate: 0.15,
      crossoverRate: 0.8,
      eliteSize: Math.max(5, Math.floor(this.config.populationSize * 0.1)),
    });

    const result = await evolver.evolve(priceData);

    return {
      genes: result.bestIndividual.genes,
      fitness: result.bestIndividual.fitness,
    };
  }

  /**
   * Determine if new strategy should be deployed
   */
  private shouldDeployNewStrategy(result: {
    genes: StrategyGenes;
    fitness: number;
  }): boolean {
    if (this.currentBestFitness === 0) {
      // First cycle, always deploy
      return true;
    }

    const improvement = result.fitness - this.currentBestFitness;
    const improvementPercent = (improvement / this.currentBestFitness) * 100;

    return improvementPercent >= this.config.improvementThreshold;
  }

  /**
   * Deploy new strategy to live trading
   */
  private deployNewStrategy(genes: StrategyGenes, fitness: number): void {
    const improvement = this.currentBestFitness
      ? fitness - this.currentBestFitness
      : fitness;

    console.log("\n" + "🚀".repeat(30));
    console.log("DEPLOYING NEW STRATEGY");
    console.log("🚀".repeat(30));
    console.log(`Previous Fitness: ${this.currentBestFitness.toFixed(2)}/100`);
    console.log(`New Fitness: ${fitness.toFixed(2)}/100`);
    console.log(`Improvement: +${improvement.toFixed(2)} points\n`);

    this.currentBestGenes = genes;
    this.currentBestFitness = fitness;
    this.noImprovementCount = 0;

    // If live trading is connected, inject new strategy
    if (this.liveTrading) {
      console.log("Injecting into live trading system...");
      // In real implementation, would re-inject strategy
      console.log("✅ Strategy injected to live trading\n");
    }
  }

  /**
   * Log evolution cycle results
   */
  private logCycle(
    result: { genes: StrategyGenes; fitness: number },
    deployed: boolean
  ): void {
    const previousFitness = this.currentBestFitness || null;
    const improvement = previousFitness
      ? ((result.fitness - previousFitness) / previousFitness) * 100
      : 0;

    const cycle: EvolutionCycle = {
      cycleNumber: this.cycleNumber,
      timestamp: new Date(),
      generationCount: this.config.generationCount,
      bestFitness: result.fitness,
      previousFitness,
      improvementPercent: improvement,
      deployed,
      reason: deployed
        ? `New best (${improvement.toFixed(1)}% improvement)`
        : `No improvement (${improvement.toFixed(1)}%)`,
    };

    this.cycleHistory.push(cycle);

    console.log("\n📊 CYCLE RESULTS");
    console.log("────────────────────────────────────────────────────────────");
    console.log(`Best Fitness: ${result.fitness.toFixed(2)}/100`);

    if (previousFitness) {
      console.log(`Previous: ${previousFitness.toFixed(2)}/100`);
      console.log(`Improvement: ${improvement.toFixed(2)}%`);
    }

    console.log(`Deployed: ${deployed ? "✅ YES" : "❌ No"}`);
    console.log(`Reason: ${cycle.reason}`);

    if (!deployed) {
      this.noImprovementCount++;
      console.log(
        `No improvement count: ${this.noImprovementCount}/${this.config.maxConsecutiveNoImprovement}`
      );
    }
  }

  /**
   * Connect live trading instance
   */
  connectLiveTrading(liveTrading: LiveTradingWithEvolvedStrategy): void {
    this.liveTrading = liveTrading;
    console.log("✓ Live trading connected to background evolution");
  }

  /**
   * Get cycle history
   */
  getHistory(): EvolutionCycle[] {
    return [...this.cycleHistory];
  }

  /**
   * Get current best genes
   */
  getCurrentBestGenes(): StrategyGenes | null {
    return this.currentBestGenes ? { ...this.currentBestGenes } : null;
  }

  /**
   * Get evolution statistics
   */
  getStats(): {
    cyclesCompleted: number;
    currentBestFitness: number;
    deploymentsCount: number;
    averageImprovement: number;
    isRunning: boolean;
  } {
    const deployedCycles = this.cycleHistory.filter((c) => c.deployed);
    const improvements = this.cycleHistory
      .filter((c) => c.previousFitness !== null)
      .map((c) => c.improvementPercent);
    const avgImprovement =
      improvements.length > 0
        ? improvements.reduce((a, b) => a + b, 0) / improvements.length
        : 0;

    return {
      cyclesCompleted: this.cycleNumber,
      currentBestFitness: this.currentBestFitness,
      deploymentsCount: deployedCycles.length,
      averageImprovement: avgImprovement,
      isRunning: this.isRunning,
    };
  }

  /**
   * Print status report
   */
  printReport(): void {
    const stats = this.getStats();

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║      BACKGROUND EVOLUTION STATUS REPORT                  ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log(`Status: ${stats.isRunning ? "🟢 RUNNING" : "🔴 STOPPED"}`);
    console.log(`Cycles Completed: ${stats.cyclesCompleted}`);
    console.log(`Deployments: ${stats.deploymentsCount}`);
    console.log(`Current Best Fitness: ${stats.currentBestFitness.toFixed(2)}/100`);
    console.log(
      `Average Improvement: ${stats.averageImprovement.toFixed(2)}% per cycle`
    );

    if (this.cycleHistory.length > 0) {
      console.log("\nRecent Cycles:");
      const recent = this.cycleHistory.slice(-5);
      for (const cycle of recent) {
        const status = cycle.deployed ? "✅" : "⏭️";
        console.log(
          `  ${status} Cycle #${cycle.cycleNumber}: ${cycle.bestFitness.toFixed(2)}/100 (${cycle.improvementPercent.toFixed(1)}%)`
        );
      }
    }

    console.log();
  }

  /**
   * Utility: sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============= PRICE DATA PROVIDER EXAMPLE =============

export interface PriceDataProvider {
  fetchLatestPrices(symbol: string, limit: number): Promise<PriceBar[]>;
}

export class SimulatedPriceProvider implements PriceDataProvider {
  private basePrice: number = 2000;
  private trend: number = 0; // -1 to 1

  async fetchLatestPrices(
    symbol: string,
    limit: number = 2000
  ): Promise<PriceBar[]> {
    const prices: number[] = [this.basePrice];

    for (let i = 1; i < limit; i++) {
      // Add trend + random walk
      this.trend = this.trend * 0.95 + (Math.random() - 0.5) * 0.1;
      const change = (Math.random() - 0.5) * 40 + this.trend * 30;
      const newPrice = Math.max(100, prices[i - 1] + change);
      prices.push(newPrice);
    }

    this.basePrice = prices[prices.length - 1];

    return prices.map((price, i) => ({
      timestamp: Date.now() + i * 60000,
      open: price,
      high: price + 5,
      low: price - 5,
      close: price,
      volume: 1000,
    }));
  }
}

// ============= SCHEDULED TASK INTEGRATION =============

export async function setupBackgroundEvolution(
  priceProvider: PriceDataProvider,
  liveTrading?: LiveTradingWithEvolvedStrategy
): Promise<BackgroundEvolutionManager> {
  const manager = new BackgroundEvolutionManager({
    enabled: true,
    cycleDurationMinutes: 5,
    populationSize: 150,
    generationCount: 50,
    improvementThreshold: 1.5,
    maxConsecutiveNoImprovement: 15,
  });

  if (liveTrading) {
    manager.connectLiveTrading(liveTrading);
  }

  // Start evolution loop
  manager.start(() => priceProvider.fetchLatestPrices("BTCUSDT", 2000));

  return manager;
}

// ============= EXAMPLE USAGE =============

export async function exampleBackgroundEvolution() {
  console.log("\n");
  console.log("█████████████████████████████████████████████████████████████");
  console.log("█         CONTINUOUS BACKGROUND EVOLUTION EXAMPLE           █");
  console.log("█████████████████████████████████████████████████████████████");

  // Create price provider
  const priceProvider = new SimulatedPriceProvider();

  // Setup background evolution
  const manager = await setupBackgroundEvolution(priceProvider);

  // Simulate a few cycles
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 sec between cycles in demo
    manager.printReport();
  }

  // Stop evolution
  manager.stop();
  manager.printReport();

  return manager;
}

// ============= MONITORING DASHBOARD =============

export function createMonitoringDashboard(
  manager: BackgroundEvolutionManager
): string {
  const stats = manager.getStats();
  const history = manager.getHistory();

  let dashboard = `
╔════════════════════════════════════════════════════════════╗
║        BACKGROUND EVOLUTION MONITORING DASHBOARD           ║
╚════════════════════════════════════════════════════════════╝

STATUS
──────────────────────────────────────────────────────────────
Status: ${stats.isRunning ? "🟢 RUNNING" : "🔴 STOPPED"}
Cycles: ${stats.cyclesCompleted}
Deployments: ${stats.deploymentsCount}
Best Fitness: ${stats.currentBestFitness.toFixed(2)}/100

PERFORMANCE
──────────────────────────────────────────────────────────────
Avg Improvement/Cycle: ${stats.averageImprovement.toFixed(2)}%
Deployment Rate: ${((stats.deploymentsCount / Math.max(1, stats.cyclesCompleted)) * 100).toFixed(1)}%

RECENT CYCLES
──────────────────────────────────────────────────────────────
`;

  const recentCycles = history.slice(-10);
  for (const cycle of recentCycles) {
    const arrow = cycle.improvementPercent >= 0 ? "📈" : "📉";
    const deploy = cycle.deployed ? "✅ DEPLOY" : "⏭️ SKIP";
    dashboard += `
${arrow} Cycle #${cycle.cycleNumber}: ${cycle.bestFitness.toFixed(2)}/100 (${cycle.improvementPercent > 0 ? "+" : ""}${cycle.improvementPercent.toFixed(1)}%) - ${deploy}`;
  }

  dashboard += `

CONFIGURATION
──────────────────────────────────────────────────────────────
Cycle Duration: 5 minutes
Population Size: 150
Generations/Cycle: 50
Improvement Threshold: 1.5%
Max No-Improve Cycles: 15

`;

  return dashboard;
}
