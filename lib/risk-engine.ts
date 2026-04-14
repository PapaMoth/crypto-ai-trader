export interface RiskEngineConfig {
  maxDailyLossPct: number; // 0.03 = 3%
  maxSymbolExposurePct: number; // 0.35 = 35%
  maxTotalExposurePct: number; // 0.8 = 80%
}

export interface RiskSnapshot {
  equity: number;
  startOfDayEquity: number;
  symbolExposureUsd: number;
  totalExposureUsd: number;
}

export class RiskEngine {
  private readonly config: RiskEngineConfig;
  private killSwitch = false;

  constructor(config?: Partial<RiskEngineConfig>) {
    this.config = {
      maxDailyLossPct: config?.maxDailyLossPct ?? 0.03,
      maxSymbolExposurePct: config?.maxSymbolExposurePct ?? 0.35,
      maxTotalExposurePct: config?.maxTotalExposurePct ?? 0.8,
    };
  }

  setKillSwitch(enabled: boolean): void {
    this.killSwitch = enabled;
  }

  isKillSwitchOn(): boolean {
    return this.killSwitch;
  }

  canOpenPosition(
    symbol: string,
    plannedNotionalUsd: number,
    snapshot: RiskSnapshot
  ): { ok: boolean; reason?: string } {
    if (this.killSwitch) {
      return { ok: false, reason: "Kill switch is enabled." };
    }

    if (snapshot.startOfDayEquity > 0) {
      const dailyLossPct =
        (snapshot.startOfDayEquity - snapshot.equity) / snapshot.startOfDayEquity;
      if (dailyLossPct >= this.config.maxDailyLossPct) {
        this.killSwitch = true;
        return { ok: false, reason: "Daily loss limit reached. Kill switch activated." };
      }
    }

    if (snapshot.equity <= 0) {
      return { ok: false, reason: "Invalid equity snapshot." };
    }

    const nextSymbolExposurePct =
      (snapshot.symbolExposureUsd + plannedNotionalUsd) / snapshot.equity;
    if (nextSymbolExposurePct > this.config.maxSymbolExposurePct) {
      return {
        ok: false,
        reason: `Symbol exposure too high (${(nextSymbolExposurePct * 100).toFixed(1)}%).`,
      };
    }

    const nextTotalExposurePct =
      (snapshot.totalExposureUsd + plannedNotionalUsd) / snapshot.equity;
    if (nextTotalExposurePct > this.config.maxTotalExposurePct) {
      return {
        ok: false,
        reason: `Total exposure too high (${(nextTotalExposurePct * 100).toFixed(1)}%).`,
      };
    }

    return { ok: true };
  }
}
