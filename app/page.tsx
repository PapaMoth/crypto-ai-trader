"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <section className="text-center max-w-3xl">
        <h1 className="text-5xl font-bold leading-tight">
          AI Trading Bot That Adapts to the Market in Real Time
        </h1>
        <p className="mt-6 text-lg text-gray-300">
          Built to trade smarter, not harder. Real data, real strategies, real results.
        </p>

        <Link href="/signup">
          <button className="mt-8 px-8 py-4 bg-green-500 text-black font-bold rounded-xl text-lg hover:bg-green-400 transition">
            Start Free 🚀
          </button>
        </Link>
      </section>

      <section className="mt-20 text-center">
        <h2 className="text-3xl font-bold">Real Results</h2>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 p-6 rounded-xl">
            <p className="text-2xl font-bold">63%</p>
            <p className="text-gray-400">Win Rate</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl">
            <p className="text-2xl font-bold">+12%</p>
            <p className="text-gray-400">30 Day Growth</p>
          </div>
          <div className="bg-gray-900 p-6 rounded-xl">
            <p className="text-2xl font-bold">1000+</p>
            <p className="text-gray-400">Trades Tested</p>
          </div>
        </div>
      </section>

      <section className="mt-20 max-w-4xl text-center">
        <h2 className="text-3xl font-bold">How It Works</h2>

        <div className="mt-8 space-y-6 text-gray-300">
          <p>🧠 AI analyzes market conditions in real-time</p>
          <p>📊 Multiple strategies compete for best performance</p>
          <p>🎯 Only high-confidence trades are executed</p>
          <p>🛑 Built-in risk management protects capital</p>
        </div>
      </section>

      <section className="mt-20 text-center">
        <h2 className="text-3xl font-bold">Simple Pricing</h2>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-900 p-6 rounded-xl">
            <h3 className="text-xl font-bold">Free</h3>
            <p className="mt-4 text-3xl">$0</p>
            <ul className="mt-4 text-gray-400 space-y-2">
              <li>Paper Trading</li>
              <li>Limited Signals</li>
            </ul>
          </div>

          <div className="bg-green-500 text-black p-6 rounded-xl">
            <h3 className="text-xl font-bold">Pro</h3>
            <p className="mt-4 text-3xl">$29/mo</p>
            <ul className="mt-4 space-y-2">
              <li>Live Signals</li>
              <li>Full Dashboard</li>
            </ul>
          </div>

          <div className="bg-gray-900 p-6 rounded-xl">
            <h3 className="text-xl font-bold">Elite</h3>
            <p className="mt-4 text-3xl">$99/mo</p>
            <ul className="mt-4 text-gray-400 space-y-2">
              <li>Auto Trading</li>
              <li>Advanced AI</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-20 text-center">
        <h2 className="text-3xl font-bold">
          Let AI Trade While You Focus on Life
        </h2>

        <Link href="/signup">
          <button className="mt-8 px-8 py-4 bg-green-500 text-black font-bold rounded-xl text-lg hover:bg-green-400 transition">
            Get Started Now 💰
          </button>
        </Link>
      </section>
    </main>
  );
}
