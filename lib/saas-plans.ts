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
  };
}

export const SAAS_PLANS: PlanConfig[] = [
  {
    key: "free",
    name: "Free",
    monthlyUsd: 0,
    features: ["Paper trading", "Basic dashboard"],
    limits: {
      maxStrategies: 1,
      maxBacktestDays: 7,
      copyTrading: false,
      liveTrading: false,
    },
  },
  {
    key: "pro",
    name: "Pro",
    monthlyUsd: 89,
    features: ["Adaptive strategy switching", "Pro dashboard", "Real historical backtests"],
    limits: {
      maxStrategies: 3,
      maxBacktestDays: 180,
      copyTrading: true,
      liveTrading: true,
    },
  },
  {
    key: "elite",
    name: "Elite",
    monthlyUsd: 199,
    features: ["All Pro features", "Priority execution", "Advanced risk controls"],
    limits: {
      maxStrategies: 10,
      maxBacktestDays: 3650,
      copyTrading: true,
      liveTrading: true,
    },
  },
];

export function getPlan(key?: string): PlanConfig {
  return SAAS_PLANS.find((p) => p.key === key) || SAAS_PLANS[0];
}
