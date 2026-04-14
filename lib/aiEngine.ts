import * as SecureStore from "expo-secure-store";
import { calculateRSI, bollingerBands, movingAverage } from "./indicators";

let weights = {
  rsi: 1,
  bb: 1,
  trend: 1,
};

let loaded = false;

// 🧠 LOAD WEIGHTS (async for mobile)
export async function loadWeights() {
  try {
    const saved = await SecureStore.getItemAsync("ai_weights");
    if (saved) {
      weights = JSON.parse(saved);
    }
  } catch (err) {
    console.log("Load failed");
  } finally {
    loaded = true;
  }
}

// 💾 SAVE WEIGHTS
async function saveWeights() {
  try {
    await SecureStore.setItemAsync("ai_weights", JSON.stringify(weights));
  } catch (err) {
    console.log("Save failed");
  }
}

// 🚀 AI SIGNAL
export function generateAISignal(prices: number[]) {
  if (!loaded || prices.length < 15) return "HOLD ⚪";

  const rsi = calculateRSI(prices);
  const bb = bollingerBands(prices);
  const avg = movingAverage(prices);
  const price = prices[prices.length - 1];

  let score = 0;

  if (rsi < 30) score += weights.rsi;
  if (rsi > 70) score -= weights.rsi;

  if (price < bb.lower) score += weights.bb;
  if (price > bb.upper) score -= weights.bb;

  if (price > avg) score += 0.5 * weights.trend;
  else score -= 0.5 * weights.trend;

  if (score > 1) return "BUY 🟢";
  if (score < -1) return "SELL 🔴";
  return "HOLD ⚪";
}

// 🧬 LEARNING SYSTEM
export async function updateWeights(result: "WIN" | "LOSS") {
  const adjust = result === "WIN" ? 0.1 : -0.1;

  weights.rsi = Math.max(0.1, weights.rsi + adjust);
  weights.bb = Math.max(0.1, weights.bb + adjust);
  weights.trend = Math.max(0.1, weights.trend + adjust);

  await saveWeights();

  console.log("Updated weights:", weights);
}