/**
 * Strategy Evolution Engine - Genetic Algorithm
 * Automatically optimize strategy parameters using AI evolution
 */

import { AIBacktester, PriceBar, BacktestResult } from "./ai-backtest";

// ============= TYPES =============

export interface StrategyGenes {
  // Common technical indicator parameters
  rsiPeriod: number;
  rsiBuyThreshold: number;
  rsiSellThreshold: number;

  bBandsPeriod: number;
  bbStdDev: number;

  maPeriod: number;
  maTypeShort: number; // 0=SMA, 1=EMA
  maTypeLong: number;

  // Trading parameters
  takeProfitPercent: number;
  stopLossPercent: number;
  riskPerTrade: number;
}

export interface Individual {
  genes: StrategyGenes;
  fitness: number; // Strategy score 0-100
  result?: BacktestResult;
}

export interface EvolutionConfig {
  populationSize: number;
  generationCount: number;
  mutationRate: number; // 0-1
  crossoverRate: number; // 0-1
  eliteSize: number; // Number of top performers to keep
}

export interface EvolutionResult {
  bestIndividual: Individual;
  allGenerations: Individual[][];
  improvementHistory: number[];
}

// ============= DEFAULT GENES =============

export const DEFAULT_GENES: StrategyGenes = {
  rsiPeriod: 14,
  rsiBuyThreshold: 30,
  rsiSellThreshold: 70,
  bBandsPeriod: 20,
  bbStdDev: 2,
  maPeriod: 20,
  maTypeShort: 0,
  maTypeLong: 1,
  takeProfitPercent: 0.005,
  stopLossPercent: 0.005,
  riskPerTrade: 0.02,
};

// ============= GENETIC ALGORITHM =============

export class StrategyEvolver {
  private config: EvolutionConfig;
  private population: Individual[] = [];
  private generationHistory: Individual[][] = [];
  private improvementHistory: number[] = [];

  constructor(config: Partial<EvolutionConfig> = {}) {
    this.config = {
      populationSize: config.populationSize ?? 50,
      generationCount: config.generationCount ?? 20,
      mutationRate: config.mutationRate ?? 0.2,
      crossoverRate: config.crossoverRate ?? 0.7,
      eliteSize: config.eliteSize ?? 5,
    };
  }

  /**
   * Create random individual
   */
  private createRandomIndividual(): Individual {
    const genes: StrategyGenes = {
      rsiPeriod: this.randomInt(10, 30),
      rsiBuyThreshold: this.randomInt(20, 40),
      rsiSellThreshold: this.randomInt(60, 80),
      bBandsPeriod: this.randomInt(15, 30),
      bbStdDev: this.randomFloat(1.5, 3),
      maPeriod: this.randomInt(10, 50),
      maTypeShort: this.randomInt(0, 1),
      maTypeLong: this.randomInt(0, 1),
      takeProfitPercent: this.randomFloat(0.002, 0.01),
      stopLossPercent: this.randomFloat(0.002, 0.01),
      riskPerTrade: this.randomFloat(0.01, 0.05),
    };

    return { genes, fitness: 0 };
  }

  /**
   * Evaluate individual fitness
   */
  private async evaluateFitness(
    individual: Individual,
    priceData: PriceBar[]
  ): Promise<void> {
    try {
      const backtest = new AIBacktester({
        initialBalance: 1000,
        takeProfitPercent: individual.genes.takeProfitPercent,
        stopLossPercent: individual.genes.stopLossPercent,
        riskPerTrade: individual.genes.riskPerTrade,
      });

      // Create AI engine with these genes
      const engine = new EvolvingStrategyEngine(individual.genes);

      const result = await backtest.runBacktest(priceData, engine);
      individual.result = result;

      // Calculate fitness score (0-100)
      let score = 50;
      score += Math.min(result.profitPercent / 4, 25);
      score += Math.min(result.winRate / 5, 20);
      score += Math.min(Math.max(result.profitFactor - 1, 0) * 7.5, 15);

      individual.fitness = Math.max(0, Math.min(100, score));
    } catch (err) {
      individual.fitness = 0;
    }
  }

  /**
   * Crossover: combine two parents
   */
  private crossover(parent1: Individual, parent2: Individual): Individual {
    const genes: StrategyGenes = { ...parent1.genes };

    // 50% chance for each gene from either parent
    for (const key in genes) {
      if (Math.random() > 0.5) {
        genes[key as keyof StrategyGenes] =
          parent2.genes[key as keyof StrategyGenes];
      }
    }

    return { genes, fitness: 0 };
  }

  /**
   * Mutate: randomly change genes
   */
  private mutate(individual: Individual): void {
    const genes = individual.genes;

    if (Math.random() < this.config.mutationRate) {
      genes.rsiPeriod = this.randomInt(10, 30);
    }
    if (Math.random() < this.config.mutationRate) {
      genes.rsiBuyThreshold = this.randomInt(20, 40);
    }
    if (Math.random() < this.config.mutationRate) {
      genes.rsiSellThreshold = this.randomInt(60, 80);
    }
    if (Math.random() < this.config.mutationRate) {
      genes.bBandsPeriod = this.randomInt(15, 30);
    }
    if (Math.random() < this.config.mutationRate) {
      genes.bbStdDev = this.randomFloat(1.5, 3);
    }
    if (Math.random() < this.config.mutationRate) {
      genes.maPeriod = this.randomInt(10, 50);
    }
    if (Math.random() < this.config.mutationRate) {
      genes.takeProfitPercent = this.randomFloat(0.002, 0.01);
    }
    if (Math.random() < this.config.mutationRate) {
      genes.stopLossPercent = this.randomFloat(0.002, 0.01);
    }
    if (Math.random() < this.config.mutationRate) {
      genes.riskPerTrade = this.randomFloat(0.01, 0.05);
    }
  }

  /**
   * Main evolution algorithm
   */
  async evolve(priceData: PriceBar[]): Promise<EvolutionResult> {
    console.log("[EVOLUTION] Starting genetic algorithm...");

    // Initialize population
    this.population = [];
    for (let i = 0; i < this.config.populationSize; i++) {
      this.population.push(this.createRandomIndividual());
    }

    // Evolve for generations
    for (let gen = 0; gen < this.config.generationCount; gen++) {
      console.log(`[EVOLUTION] Generation ${gen + 1}/${this.config.generationCount}`);

      // Evaluate fitness
      for (const individual of this.population) {
        await this.evaluateFitness(individual, priceData);
      }

      // Sort by fitness
      this.population.sort((a, b) => b.fitness - a.fitness);

      // Record generation
      this.generationHistory.push([...this.population]);
      this.improvementHistory.push(this.population[0].fitness);

      // Create next generation
      const newPopulation: Individual[] = [];

      // Elitism: keep top performers
      for (let i = 0; i < this.config.eliteSize; i++) {
        newPopulation.push({
          genes: { ...this.population[i].genes },
          fitness: this.population[i].fitness,
        });
      }

      // Breeding
      while (newPopulation.length < this.config.populationSize) {
        // Select parents
        const parent1 = this.selectParent();
        const parent2 = this.selectParent();

        // Crossover
        let child = this.crossover(parent1, parent2);

        // Mutate
        this.mutate(child);

        newPopulation.push(child);
      }

      this.population = newPopulation;

      // Log progress
      console.log(
        `[EVOLUTION] Gen ${gen + 1} - Best Fitness: ${this.population[0].fitness.toFixed(2)}`
      );
    }

    // Final evaluation
    for (const individual of this.population) {
      await this.evaluateFitness(individual, priceData);
    }
    this.population.sort((a, b) => b.fitness - a.fitness);

    return {
      bestIndividual: this.population[0],
      allGenerations: this.generationHistory,
      improvementHistory: this.improvementHistory,
    };
  }

  /**
   * Tournament selection
   */
  private selectParent(tournamentSize: number = 3): Individual {
    let best = this.population[0];

    for (let i = 0; i < tournamentSize; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      if (this.population[idx].fitness > best.fitness) {
        best = this.population[idx];
      }
    }

    return best;
  }

  /**
   * Utility functions
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  private randomFloat(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}

// ============= EVOLVING STRATEGY ENGINE =============

class EvolvingStrategyEngine {
  constructor(private genes: StrategyGenes) {}

  generateSignal(prices: number[]) {
    // Implement strategy based on genes
    // This is simplified - would be expanded for full implementation

    const rsi = this.calculateRSI(prices, this.genes.rsiPeriod);
    const price = prices[prices.length - 1];
    const avgPrice = prices.reduce((a, b) => a + b) / prices.length;

    if (rsi < this.genes.rsiBuyThreshold && price < avgPrice) {
      return { action: "BUY", confidence: 0.8 };
    }

    if (rsi > this.genes.rsiSellThreshold && price > avgPrice) {
      return { action: "SELL", confidence: 0.8 };
    }

    return { action: "HOLD", confidence: 0.5 };
  }

  updateWeights(): void {
    // No learning needed for genetic evolution
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }

    const rs = (gains / period) / (losses / period);
    return 100 - (100 / (1 + rs));
  }
}

// ============= EXAMPLE USAGE =============

export async function exampleEvolution() {
  // Generate sample price data
  function generatePrices(length: number): number[] {
    let prices = [2000];
    for (let i = 1; i < length; i++) {
      const change = (Math.random() - 0.5) * 50;
      prices.push(Math.max(100, prices[i - 1] + change));
    }
    return prices;
  }

  function createPriceBars(prices: number[]): PriceBar[] {
    return prices.map((price, i) => ({
      timestamp: Date.now() + i * 60000,
      open: price,
      high: price + 5,
      low: price - 5,
      close: price,
      volume: 1000,
    }));
  }

  // Run evolution
  const prices = generatePrices(1000);
  const priceBars = createPriceBars(prices);

  const evolver = new StrategyEvolver({
    populationSize: 50,
    generationCount: 10,
  });

  const result = await evolver.evolve(priceBars);

  console.log("\n=== EVOLUTION COMPLETE ===");
  console.log("Best Strategy Genes:");
  console.log(JSON.stringify(result.bestIndividual.genes, null, 2));
  console.log(
    `Final Fitness: ${result.bestIndividual.fitness.toFixed(2)}/100`
  );
  console.log(
    `Profit: ${result.bestIndividual.result?.profitPercent.toFixed(2)}%`
  );
}
