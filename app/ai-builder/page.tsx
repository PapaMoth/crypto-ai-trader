"use client";

import { useState } from "react";

export default function AIBuilder() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);

  const generate = async () => {
    setLoading(true);

    const res = await fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();

    try {
      const parsed = JSON.parse(data.output[0].content[0].text);
      setFiles(parsed.files || []);
    } catch {
      alert("Failed to parse AI output");
    }

    setLoading(false);
  };

  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold mb-6">AI App Builder</h1>

      <textarea
        className="w-full p-4 border rounded"
        rows={4}
        placeholder="Describe your app..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button
        onClick={generate}
        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded"
      >
        {loading ? "Generating..." : "Generate App"}
      </button>

      <div className="mt-10">
        {files.map((file, i) => (
          <div key={i} className="mb-6 border p-4 rounded">
            <h2 className="font-bold">{file.path}</h2>
            <pre className="text-sm overflow-auto">
              {file.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}