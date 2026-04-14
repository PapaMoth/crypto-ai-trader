"use client";

export default function Signup() {
  const handleCheckout = async (plan: "pro" | "elite") => {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-10">Choose Your Plan</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-green-500 text-black p-8 rounded-xl text-center">
          <h2 className="text-2xl font-bold">Pro</h2>
          <p className="text-3xl mt-4">$29/mo</p>
          <button
            onClick={() => handleCheckout("pro")}
            className="mt-6 px-6 py-3 bg-black text-white rounded-lg"
          >
            Subscribe
          </button>
        </div>

        <div className="bg-gray-900 p-8 rounded-xl text-center">
          <h2 className="text-2xl font-bold">Elite</h2>
          <p className="text-3xl mt-4">$99/mo</p>
          <button
            onClick={() => handleCheckout("elite")}
            className="mt-6 px-6 py-3 bg-green-500 text-black rounded-lg"
          >
            Subscribe
          </button>
        </div>
      </div>
    </main>
  );
}
