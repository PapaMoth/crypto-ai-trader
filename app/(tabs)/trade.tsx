import { useEffect, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { generateAISignal, loadWeights } from "@/lib/aiEngine";

const API_URL = "http://192.168.0.198:3000";

export default function TradeScreen() {
  const [price, setPrice] = useState(0);
  const [signal, setSignal] = useState("...");
  const [prices, setPrices] = useState<number[]>([]);
  const [stats, setStats] = useState<any>(null);

  // 🧠 Load AI memory once
  useEffect(() => {
    loadWeights();
  }, []);

  // 📊 Fetch price + generate AI signal
  useEffect(() => {
    const fetchData = async () => {
      try {
        // ✅ FETCH FIRST
        const res = await fetch(`${API_URL}/api/price`);
        const data = await res.json();

        const newPrice = data.price;

        setPrice(newPrice);

        // Keep last 20 prices
        setPrices((prev) => {
          const updated = [...prev, newPrice].slice(-20);

          // Generate AI signal
          const aiSignal = generateAISignal(updated);
          setSignal(aiSignal);

          return updated;
        });
      } catch (err) {
        console.log("Fetch error", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/stats`);
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.log("Stats fetch error", err);
      }
    };

    fetchStats();
    const i = setInterval(fetchStats, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.price}>ETH: ${price}</Text>
      <Text style={styles.signal}>{signal}</Text>
      {stats && (
        <>
          <Text style={styles.stats}>Balance: ${stats.balance}</Text>
          <Text style={styles.stats}>Trades: {stats.totalTrades}</Text>
          <Text style={styles.stats}>Win Rate: {stats.winRate}%</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  price: { fontSize: 28, fontWeight: "bold" },
  signal: { fontSize: 24, marginTop: 20 },
  stats: { fontSize: 18, marginTop: 10 },
});
