import Link from "next/link";

export default function Success() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold">🎉 Payment Successful</h1>
        <p className="mt-4 text-gray-400">
          You now have access to premium features.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-8 px-6 py-3 rounded-lg bg-green-500 text-black font-semibold hover:bg-green-400 transition"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
