/**
 * Live Training Service
 * Continuous evolution on real Binance market data
 */

import { BackgroundEvolutionManager, SimulatedPriceProvider } from "./background-evolution";
import { BinanceConnector, DataValidator, LivePriceStreamer } from "./binance-connector";
import { LiveTradingWithEvolvedStrategy } from "./evolved-strategy-injector";
import { PriceBar } from "./ai-backtest";

// ============= LIVE TRAINING CONFIG =============

export interface LiveTrainingConfig {
  // Evolution settings
  evolutionEnabled: boolean;
  cycleIntervalMinutes: number;
  populationSize: number;
  generationsPerCycle: number;

  // Binance settings
  binanceSymbol: string;
  binanceInterval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  binanceTestnet: boolean;
  historicalBarsPerCycle: number;

  // Live trading settings
  liveTrading: boolean;
  initialBalance: number;
  autoRollback: boolean;
}

// ============= LIVE TRAINING SERVICE =============

export class LiveTrainingService {
  private config: LiveTrainingConfig;
  private binanceConnector: BinanceConnector;
  private evolutionManager: BackgroundEvolutionManager | null = null;
  private liveTrading: LiveTradingWithEvolvedStrategy | null = null;
  private priceStreamer: LivePriceStreamer | null = null;
  private isRunning: boolean = false;

  constructor(config: Partial<LiveTrainingConfig> = {}) {
    this.config = {
      evolutionEnabled: config.evolutionEnabled ?? true,
      cycleIntervalMinutes: config.cycleIntervalMinutes ?? 5,
      populationSize: config.populationSize ?? 150,
      generationsPerCycle: config.generationsPerCycle ?? 50,
      binanceSymbol: config.binanceSymbol ?? "BTCUSDT",
      binanceInterval: config.binanceInterval ?? "1h",
      binanceTestnet: config.binanceTestnet ?? true,
      historicalBarsPerCycle: config.historicalBarsPerCycle ?? 2000,
      liveTrading: config.liveTrading ?? false,
      initialBalance: config.initialBalance ?? 10000,
      autoRollback: config.autoRollback ?? true,
    };

    this.binanceConnector = new BinanceConnector({
      symbol: this.config.binanceSymbol,
      interval: this.config.binanceInterval,
      limit: this.config.historicalBarsPerCycle,
      testnet: this.config.binanceTestnet,
    });
  }

  /**
   * Start live training service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("⚠️ Live training service already running");
      return;
    }

    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║         LIVE TRAINING SERVICE INITIALIZATION              ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    this.isRunning = true;

    try {
      // Step 1: Validate Binance connection
      console.log("Step 1: Validating Binance connection...");
      const isValid = await this.binanceConnector.validateSymbol();

      if (!isValid) {
        throw new Error("Failed to validate Binance symbol");
      }

      // Step 2: Fetch initial training data
      console.log("\nStep 2: Fetching initial training data...");
      const initialData = await this.binanceConnector.fetchLatest(
        this.config.historicalBarsPerCycle
      );

      if (initialData.length === 0) {
        throw new Error("Failed to fetch price data from Binance");
      }

      DataValidator.printReport(initialData, `${this.config.binanceSymbol}`);

      // Step 3: Setup background evolution
      if (this.config.evolutionEnabled) {
        console.log("\nStep 3: Starting background evolution...");

        this.evolutionManager = new BackgroundEvolutionManager({
          enabled: true,
          cycleDurationMinutes: this.config.cycleIntervalMinutes,
          populationSize: this.config.populationSize,
          generationCount: this.config.generationsPerCycle,
          improvementThreshold: 1.5,
          maxConsecutiveNoImprovement: 20,
        });

        // Start evolution with Binance data provider
        this.evolutionManager.start(() =>
          this.binanceConnector.fetchLatest(this.config.historicalBarsPerCycle)
        );
      }

      // Step 4: Setup live trading if enabled
      if (this.config.liveTrading && this.evolutionManager) {
        console.log("\nStep 4: Initializing live trading...");

        const bestGenes = this.evolutionManager.getCurrentBestGenes();
        if (bestGenes) {
          this.liveTrading = new LiveTradingWithEvolvedStrategy({
            symbol: this.config.binanceSymbol,
            initialBalance: this.config.initialBalance,
            evolvedGenes: bestGenes,
            autoRollback: this.config.autoRollback,
            performanceThreshold: 50,
            strategyName: `${this.config.binanceSymbol} Live Evolved Strategy`,
          });

          this.liveTrading.start();

          // Connect to evolution manager
          this.evolutionManager.connectLiveTrading(this.liveTrading);
        }
      }

      // Step 5: Start live price streaming
      console.log("\nStep 5: Starting live price streaming...");
      this.priceStreamer = new LivePriceStreamer(this.binanceConnector);

      if (this.liveTrading) {
        let priceBuffer: number[] = [];

        this.priceStreamer.onPrice((bar) => {
          priceBuffer.push(bar.close);

          // Keep last 100 prices
          if (priceBuffer.length > 100) {
            priceBuffer.shift();
          }

          // Generate signal every 20 new prices
          if (priceBuffer.length % 20 === 0) {
            const signal = this.liveTrading!.executeSignal(priceBuffer);

            if (signal && signal.action !== "HOLD") {
              // Simulate trade outcome (would be real in production)
              const won = Math.random() > 0.45;
              this.liveTrading!.recordTrade(won);
            }
          }
        });

        this.priceStreamer.startStream(5000); // Update every 5 seconds
      }

      console.log("\n✅ Live training service started successfully");
      this.printStatus();
    } catch (error) {
      console.error("❌ Failed to start live training service:", error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop live training service
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn("⚠️ Live training service not running");
      return;
    }

    console.log("\n⏹️ Stopping live training service...");

    if (this.priceStreamer) {
      this.priceStreamer.stopStream();
    }

    if (this.evolutionManager) {
      this.evolutionManager.stop();
    }

    this.isRunning = false;
    console.log("✓ Live training service stopped");
  }

  /**
   * Print service status
   */
  printStatus(): void {
    console.log("\n╔════════════════════════════════════════════════════════════╗");
    console.log("║         LIVE TRAINING SERVICE STATUS                      ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("Configuration:");
    console.log(`  Symbol: ${this.config.binanceSymbol}`);
    console.log(`  Interval: ${this.config.binanceInterval}`);
    console.log(`  Environment: ${this.config.binanceTestnet ? "TESTNET" : "MAINNET"}`);

    console.log("\nEvolution:");
    if (this.evolutionManager) {
      const stats = this.evolutionManager.getStats();
      console.log(`  Status: ${"🟢 RUNNING"}`);
      console.log(`  Cycles: ${stats.cyclesCompleted}`);
      console.log(`  Best Fitness: ${stats.currentBestFitness.toFixed(2)}/100`);
      console.log(`  Deployments: ${stats.deploymentsCount}`);
    } else {
      console.log(`  Status: 🔴 DISABLED`);
    }

    console.log("\nLive Trading:");
    if (this.liveTrading) {
      const metrics = this.liveTrading.getMetrics();
      console.log(`  Status: ${"🟢 RUNNING"}`);
      console.log(`  Balance: $${this.config.initialBalance}`);
      console.log(`  Trades: ${metrics.tradesExecuted}`);
      console.log(`  Win Rate: ${metrics.winRate.toFixed(1)}%`);
    } else {
      console.log(`  Status: 🔴 DISABLED`);
    }

    console.log("\nPrice Streaming:");
    if (this.priceStreamer) {
      console.log(`  Status: 🟢 ACTIVE`);
    } else {
      console.log(`  Status: 🔴 INACTIVE`);
    }

    console.log();
  }

  /**
   * Get Binance connector stats
   */
  getBinanceStats() {
    return this.binanceConnector.getStats();
  }

  /**
   * Get evolution stats
   */
  getEvolutionStats() {
    if (!this.evolutionManager) return null;
    return this.evolutionManager.getStats();
  }

  /**
   * Get live trading metrics
   */
  getLiveTradingMetrics() {
    if (!this.liveTrading) return null;
    return this.liveTrading.getMetrics();
  }

  /**
   * Get service status
   */
  isRunning_(): boolean {
    return this.isRunning;
  }
}

// ============= MONITORING HELPER =============

export class ServiceMonitor {
  private service: LiveTrainingService;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(service: LiveTrainingService) {
    this.service = service;
  }

  /**
   * Start monitoring
   */
  startMonitoring(intervalSeconds: number = 30): void {
    console.log(`\n📊 Starting service monitor (${intervalSeconds}s interval)\n`);

    this.monitorInterval = setInterval(() => {
      this.printReport();
    }, intervalSeconds * 1000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      console.log("\n⏹️ Service monitor stopped\n");
    }
  }

  /**
   * Print detailed report
   */
  private printReport(): void {
    const evolutionStats = this.service.getEvolutionStats();
    const tradingMetrics = this.service.getLiveTradingMetrics();

    console.log("\n" + "=".repeat(60));
    console.log("LIVE TRAINING SERVICE REPORT");
    console.log("=".repeat(60));

    if (evolutionStats) {
      console.log("\n📈 Evolution:");
      console.log(`  Cycles: ${evolutionStats.cyclesCompleted}`);
      console.log(`  Best Fitness: ${evolutionStats.currentBestFitness.toFixed(2)}/100`);
      console.log(`  Deployments: ${evolutionStats.deploymentsCount}/${evolutionStats.cyclesCompleted}`);
      console.log(`  Avg Improvement: ${evolutionStats.averageImprovement.toFixed(2)}%`);
    }

    if (tradingMetrics) {
      console.log("\n💰 Live Trading:");
      console.log(`  Trades Executed: ${tradingMetrics.tradesExecuted}`);
      console.log(`  Win Rate: ${tradingMetrics.winRate.toFixed(1)}%`);
      console.log(`  Losses: ${tradingMetrics.lossesCount}`);
    }

    console.log("\n" + "=".repeat(60) + "\n");
  }
}

// ============= EXAMPLE USAGE =============

export async function exampleLiveTraining() {
  console.log("\n");
  console.log("█████████████████████████████████████████████████████████████");
  console.log("█            LIVE TRAINING ON REAL BINANCE DATA              █");
  console.log("█████████████████████████████████████████████████████████████");

  const service = new LiveTrainingService({
    evolutionEnabled: true,
    cycleIntervalMinutes: 5,
    populationSize: 150,
    generationsPerCycle: 50,
    binanceSymbol: "BTCUSDT",
    binanceInterval: "1h",
    binanceTestnet: true, // Use testnet
    historicalBarsPerCycle: 2000,
    liveTrading: true,
    initialBalance: 10000,
    autoRollback: true,
  });

  // Start service
  await service.start();

  // Start monitoring
  const monitor = new ServiceMonitor(service);
  monitor.startMonitoring(10); // Print report every 10 seconds

  // Run for demo duration
  setTimeout(() => {
    monitor.stopMonitoring();
    service.stop();
    console.log("\n✅ Demo complete");
  }, 60000); // Run for 60 seconds

  return { service, monitor };
}
