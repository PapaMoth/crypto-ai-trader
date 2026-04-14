export type PlanKey = "free" | "pro" | "elite";

export interface PlanConfig {
  key: PlanKey;
  name: string;
  monthlyUsd: number;
  features: string[];
  limits: {
    maxStrategies: number;
    maxBacktestDays: number;
    copyTrading: boolean;
    liveTrading: boolean;
    liveSignals: boolean;
    autoTrading: boolean;
  };
}

export const SAAS_PLANS: PlanConfig[] = [
  {
    key: "free",
    name: "Free",
    monthlyUsd: 0,
    features: ["Paper trading only", "Basic dashboard"],
    limits: {
      maxStrategies: 1,
      maxBacktestDays: 7,
      copyTrading: false,
      liveTrading: false,
      liveSignals: false,
      autoTrading: false,
    },
  },
  {
    key: "pro",
    name: "Pro",
    monthlyUsd: 29,
    features: ["Live signals", "Adaptive strategy switching", "Pro dashboard", "Real historical backtests"],
    limits: {
      maxStrategies: 3,
      maxBacktestDays: 180,
      copyTrading: false,
      liveTrading: false,
      liveSignals: true,
      autoTrading: false,
    },
  },
  {
    key: "elite",
    name: "Elite",
    monthlyUsd: 99,
    features: ["All Pro features", "Auto trading", "Copy trading", "Priority execution", "Advanced risk controls"],
    limits: {
      maxStrategies: 10,
      maxBacktestDays: 3650,
      copyTrading: true,
      liveTrading: true,
      liveSignals: true,
      autoTrading: true,
    },
  },
];

export function getPlan(key?: string): PlanConfig {
  return SAAS_PLANS.find((p) => p.key === key) || SAAS_PLANS[0];
}
