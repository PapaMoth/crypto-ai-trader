/**
 * Visual Evolution Tracker
 * Real-time charts showing genetic algorithm improvement
 */

import React, { useState, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from "recharts";

interface CycleData {
  cycle: number;
  fitness: number;
  improvement: number;
  deployed: boolean;
  noImprovementStreak: number;
  timestamp: string;
}

interface EvolutionStats {
  totalCycles: number;
  bestFitness: number;
  deployments: number;
  averageImprovement: number;
  currentStreak: number;
}

export const EvolutionVisualizer: React.FC = () => {
  const [cycles, setCycles] = useState<CycleData[]>([
    { cycle: 1, fitness: 45.2, improvement: 0, deployed: true, noImprovementStreak: 0, timestamp: "00:00" },
    { cycle: 2, fitness: 48.7, improvement: 7.7, deployed: true, noImprovementStreak: 0, timestamp: "00:05" },
    { cycle: 3, fitness: 51.3, improvement: 5.3, deployed: true, noImprovementStreak: 0, timestamp: "00:10" },
    { cycle: 4, fitness: 51.8, improvement: 0.9, deployed: false, noImprovementStreak: 1, timestamp: "00:15" },
    { cycle: 5, fitness: 55.2, improvement: 6.6, deployed: true, noImprovementStreak: 0, timestamp: "00:20" },
    { cycle: 6, fitness: 56.1, improvement: 1.6, deployed: false, noImprovementStreak: 1, timestamp: "00:25" },
    { cycle: 7, fitness: 58.4, improvement: 4.1, deployed: true, noImprovementStreak: 0, timestamp: "00:30" },
    { cycle: 8, fitness: 58.9, improvement: 0.8, deployed: false, noImprovementStreak: 1, timestamp: "00:35" },
    { cycle: 9, fitness: 62.3, improvement: 5.8, deployed: true, noImprovementStreak: 0, timestamp: "00:40" },
    { cycle: 10, fitness: 63.7, improvement: 2.2, deployed: false, noImprovementStreak: 1, timestamp: "00:45" },
  ]);

  const [stats, setStats] = useState<EvolutionStats>({
    totalCycles: cycles.length,
    bestFitness: Math.max(...cycles.map(c => c.fitness)),
    deployments: cycles.filter(c => c.deployed).length,
    averageImprovement: cycles.filter(c => c.improvement > 0).reduce((a, b) => a + b.improvement, 0) / cycles.filter(c => c.improvement > 0).length,
    currentStreak: cycles[cycles.length - 1]?.noImprovementStreak || 0,
  });

  // Simulate new cycles arriving
  useEffect(() => {
    const interval = setInterval(() => {
      setCycles(prev => {
        if (prev.length >= 50) return prev; // Stop at 50 cycles for demo

        const lastFitness = prev[prev.length - 1].fitness;
        const newImprovement = (Math.random() - 0.3) * 8; // Biased toward improvement
        const newFitness = Math.min(100, Math.max(0, lastFitness + newImprovement));
        const shouldDeploy = newImprovement >= 1.5;

        const newCycle: CycleData = {
          cycle: prev.length + 1,
          fitness: parseFloat(newFitness.toFixed(1)),
          improvement: parseFloat(newImprovement.toFixed(1)),
          deployed: shouldDeploy,
          noImprovementStreak: shouldDeploy ? 0 : (prev[prev.length - 1].noImprovementStreak + 1),
          timestamp: `${String(Math.floor((prev.length + 1) * 5 / 60)).padStart(2, "0")}:${String(((prev.length + 1) * 5) % 60).padStart(2, "0")}`,
        };

        return [...prev, newCycle];
      });
    }, 3000); // New cycle every 3 seconds (simulated)

    return () => clearInterval(interval);
  }, []);

  // Update stats when cycles change
  useEffect(() => {
    setStats({
      totalCycles: cycles.length,
      bestFitness: Math.max(...cycles.map(c => c.fitness)),
      deployments: cycles.filter(c => c.deployed).length,
      averageImprovement:
        cycles.filter(c => c.improvement > 0).length > 0
          ? cycles.filter(c => c.improvement > 0).reduce((a, b) => a + b.improvement, 0) / cycles.filter(c => c.improvement > 0).length
          : 0,
      currentStreak: cycles[cycles.length - 1]?.noImprovementStreak || 0,
    });
  }, [cycles]);

  return (
    <div style={{ padding: "20px", background: "#0f1419", color: "#fff", fontFamily: "Courier New, monospace", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h1 style={{ margin: "0 0 10px 0", color: "#00d4ff", fontSize: "28px" }}>
          🧬 Evolution Visualizer
        </h1>
        <p style={{ color: "#888", margin: "0", fontSize: "14px" }}>
          Real-time genetic algorithm improvement tracking
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "30px" }}>
        <div style={{ background: "#1a1f2e", padding: "20px", borderRadius: "4px", borderLeft: "4px solid #00d4ff" }}>
          <div style={{ color: "#888", fontSize: "12px", marginBottom: "8px" }}>CYCLES COMPLETED</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#00d4ff" }}>{stats.totalCycles}</div>
        </div>

        <div style={{ background: "#1a1f2e", padding: "20px", borderRadius: "4px", borderLeft: "4px solid #4caf50" }}>
          <div style={{ color: "#888", fontSize: "12px", marginBottom: "8px" }}>BEST FITNESS</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#4caf50" }}>{stats.bestFitness.toFixed(1)}/100</div>
        </div>

        <div style={{ background: "#1a1f2e", padding: "20px", borderRadius: "4px", borderLeft: "4px solid #ff9800" }}>
          <div style={{ color: "#888", fontSize: "12px", marginBottom: "8px" }}>DEPLOYMENTS</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#ff9800" }}>{stats.deployments}</div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            {((stats.deployments / stats.totalCycles) * 100).toFixed(1)}% deployment rate
          </div>
        </div>

        <div style={{ background: "#1a1f2e", padding: "20px", borderRadius: "4px", borderLeft: "4px solid #f44336" }}>
          <div style={{ color: "#888", fontSize: "12px", marginBottom: "8px" }}>AVG IMPROVEMENT</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#f44336" }}>
            {stats.averageImprovement.toFixed(2)}%
          </div>
          <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>per deployment</div>
        </div>
      </div>

      {/* Fitness Trend Chart */}
      <div style={{ background: "#1a1f2e", padding: "20px", borderRadius: "4px", marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 15px 0", color: "#00d4ff", fontSize: "16px" }}>
          📈 Fitness Score Trend
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cycles}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="cycle" stroke="#666" />
            <YAxis stroke="#666" domain={[0, 100]} />
            <Tooltip
              contentStyle={{ background: "#1a1f2e", border: "1px solid #333", borderRadius: "4px" }}
              formatter={(value) => `${(value as number).toFixed(1)}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="fitness"
              stroke="#00d4ff"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                const cycle = payload as CycleData;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={cycle.deployed ? 5 : 3}
                    fill={cycle.deployed ? "#4caf50" : "#00d4ff"}
                  />
                );
              }}
              name="Fitness Score"
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ fontSize: "12px", color: "#888", marginTop: "10px" }}>
          🟢 = Deployed | 🔵 = Skipped (didn't meet threshold)
        </div>
      </div>

      {/* Improvement Distribution */}
      <div style={{ background: "#1a1f2e", padding: "20px", borderRadius: "4px", marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 15px 0", color: "#00d4ff", fontSize: "16px" }}>
          📊 Improvement Per Cycle
        </h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={cycles}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="cycle" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip
              contentStyle={{ background: "#1a1f2e", border: "1px solid #333", borderRadius: "4px" }}
              formatter={(value) => `${(value as number).toFixed(2)}%`}
            />
            <Bar
              dataKey="improvement"
              fill="#4caf50"
              radius={[4, 4, 0, 0]}
              name="Improvement %"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Deployment History */}
      <div style={{ background: "#1a1f2e", padding: "20px", borderRadius: "4px", marginBottom: "20px" }}>
        <h2 style={{ margin: "0 0 15px 0", color: "#00d4ff", fontSize: "16px" }}>
          🚀 Deployment Timeline
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <ScatterChart data={cycles}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="cycle" stroke="#666" />
            <YAxis stroke="#666" domain={[0, 1]} hide />
            <Tooltip
              contentStyle={{ background: "#1a1f2e", border: "1px solid #333", borderRadius: "4px" }}
              cursor={{ fill: "rgba(0, 212, 255, 0.1)" }}
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload as CycleData;
                  return (
                    <div style={{ color: "#fff" }}>
                      <p style={{ margin: "0 0 5px 0" }}>Cycle #{data.cycle}</p>
                      <p style={{ margin: "0 0 5px 0" }}>Fitness: {data.fitness.toFixed(1)}/100</p>
                      <p style={{ margin: "0" }}>
                        {data.deployed ? "✅ DEPLOYED" : "⏭️ SKIPPED"}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Scatter
              name="Deployments"
              data={cycles.filter(c => c.deployed)}
              fill="#4caf50"
              dataKey="fitness"
              shape="circle"
            />
            <Scatter
              name="Skipped"
              data={cycles.filter(c => !c.deployed)}
              fill="#ff9800"
              dataKey="fitness"
              shape="diamond"
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Cycles Table */}
      <div style={{ background: "#1a1f2e", padding: "20px", borderRadius: "4px" }}>
        <h2 style={{ margin: "0 0 15px 0", color: "#00d4ff", fontSize: "16px" }}>
          📋 Recent Cycles
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #333" }}>
                <th style={{ textAlign: "left", padding: "10px", color: "#888" }}>Cycle</th>
                <th style={{ textAlign: "left", padding: "10px", color: "#888" }}>Fitness</th>
                <th style={{ textAlign: "left", padding: "10px", color: "#888" }}>Improvement</th>
                <th style={{ textAlign: "left", padding: "10px", color: "#888" }}>Status</th>
                <th style={{ textAlign: "left", padding: "10px", color: "#888" }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {cycles.slice(-10).reverse().map((cycle) => (
                <tr key={cycle.cycle} style={{ borderBottom: "1px solid #333" }}>
                  <td style={{ padding: "10px", color: "#00d4ff" }}>#{cycle.cycle}</td>
                  <td style={{ padding: "10px", color: "#fff" }}>{cycle.fitness.toFixed(1)}/100</td>
                  <td style={{ padding: "10px", color: cycle.improvement > 0 ? "#4caf50" : "#ff9800" }}>
                    {cycle.improvement > 0 ? "+" : ""}{cycle.improvement.toFixed(2)}%
                  </td>
                  <td style={{ padding: "10px" }}>
                    {cycle.deployed ? (
                      <span style={{ color: "#4caf50" }}>✅ DEPLOYED</span>
                    ) : (
                      <span style={{ color: "#ff9800" }}>⏭️ SKIPPED</span>
                    )}
                  </td>
                  <td style={{ padding: "10px", color: "#666" }}>{cycle.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{ marginTop: "20px", padding: "15px", background: "#1a1f2e", borderRadius: "4px", borderLeft: "4px solid #00d4ff" }}>
        <p style={{ margin: "0", color: "#00d4ff", fontSize: "14px" }}>
          🟢 Live Evolution Running • Best: {stats.bestFitness.toFixed(1)}/100 • Deployments: {stats.deployments}/{stats.totalCycles} • No-Improve Streak: {stats.currentStreak}
        </p>
      </div>
    </div>
  );
};

export default EvolutionVisualizer;
