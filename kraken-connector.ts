import fetch from 'node-fetch';

export interface KrakenOHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  volume: number;
  count: number;
}

export interface KrakenPrice {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class DataValidator {
  static validate(data: KrakenPrice[]): boolean {
    if (data.length === 0) return false;

    for (const candle of data) {
      if (
        isNaN(candle.close) ||
        isNaN(candle.open) ||
        isNaN(candle.high) ||
        isNaN(candle.low) ||
        candle.close <= 0 ||
        candle.high < candle.low ||
        candle.high < candle.close ||
        candle.low > candle.close
      ) {
        return false;
      }
    }
    return true;
  }

  static sanitize(data: KrakenPrice[]): KrakenPrice[] {
    return data
      .filter(candle =>
        !isNaN(candle.close) &&
        candle.close > 0 &&
        candle.high >= candle.low
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}

export class KrakenConnector {
  private baseUrl = 'https://api.kraken.com/0/public';
  private pair: string;
  private interval: string; // "1", "5", "15", "30", "60", "240", "1440", "10080", "21600"
  private requestLimit = 15; // Kraken OHLC calls per 15 seconds

  constructor(pair: string = 'XBTUSDT', interval: string = '60') {
    this.pair = pair;
    this.interval = interval;
  }

  // Map trading pair to Kraken format
  private mapPair(pair: string): string {
    const pairMap: { [key: string]: string } = {
      'BTCUSDT': 'XBTUSDT',
      'BTCUSD': 'XBTUSD',
      'ETHUSDT': 'ETHUSDT',
      'ETHUSD': 'ETHUSD',
      'XBTUSDT': 'XBTUSDT',
      'XBTUSD': 'XBTUSD',
    };
    return pairMap[pair] || pair;
  }

  async fetchHistorical(limit: number = 300): Promise<KrakenPrice[]> {
    try {
      const krakenPair = this.mapPair(this.pair);

      const url = `${this.baseUrl}/OHLC?pair=${krakenPair}&interval=${this.interval}&limit=${limit}`;

      const response = await fetch(url);
      const data: any = await response.json();

      if (!data.result || !data.result[krakenPair]) {
        console.error('Kraken API error:', data.error);
        throw new Error('Failed to fetch Kraken data');
      }

      const ohlcData = data.result[krakenPair] as any[];
      const prices: KrakenPrice[] = ohlcData.map((candle: any) => ({
        timestamp: candle[0] * 1000, // Convert to milliseconds
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[6]),
      }));

      // Validate and sanitize
      const sanitized = DataValidator.sanitize(prices);
      if (!DataValidator.validate(sanitized)) {
        console.warn('Data validation failed, but continuing with sanitized data');
      }

      return sanitized;
    } catch (error) {
      console.error('Error fetching Kraken data:', error);
      throw error;
    }
  }

  async fetchLatest(limit: number = 100): Promise<KrakenPrice[]> {
    // For real-time, fetch latest OHLC data
    return this.fetchHistorical(limit);
  }

  async getCurrentPrice(): Promise<number> {
    try {
      const krakenPair = this.mapPair(this.pair);
      const response = await fetch(`${this.baseUrl}/Ticker?pair=${krakenPair}`);
      const data: any = await response.json();

      if (!data.result || !data.result[krakenPair]) {
        throw new Error('Failed to fetch current price');
      }

      const tickerData = data.result[krakenPair];
      // Use closing price from ask/bid
      return parseFloat(tickerData.c[0]); // Last trade close price
    } catch (error) {
      console.error('Error fetching current price:', error);
      throw error;
    }
  }

  // Stream price updates (simulated with polling)
  async *streamPrices(intervalMs: number = 60000): AsyncGenerator<number> {
    while (true) {
      try {
        const price = await this.getCurrentPrice();
        yield price;
      } catch (error) {
        console.error('Stream error:', error);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  async getAllAvailablePairs(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/AssetPairs`);
      const data: any = await response.json();

      if (!data.result) {
        throw new Error('Failed to fetch asset pairs');
      }

      return Object.keys(data.result).sort();
    } catch (error) {
      console.error('Error fetching pairs:', error);
      return [];
    }
  }
}

// Export for use in other modules
export default KrakenConnector;
