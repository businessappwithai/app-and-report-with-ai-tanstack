// Test if environment variables are accessible server-side
console.log("Environment Variables Check:");
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`LLAMA_REASONING_URL: ${process.env.LLAMA_REASONING_URL}`);
console.log(`LLAMA_REASONING_MODEL: ${process.env.LLAMA_REASONING_MODEL}`);
console.log(`APP_URL: ${process.env.APP_URL}`);

// Check if defaults are used
const llamaUrl = process.env.LLAMA_REASONING_URL || "http://localhost:8080";
console.log(`\nEffective LLAMA_REASONING_URL: ${llamaUrl}`);

// Test connectivity
console.log("\nTesting llama.cpp server connectivity...");
try {
  const res = await fetch(`${llamaUrl}/health`, { signal: AbortSignal.timeout(2000) });
  console.log(`✅ Server is reachable: ${res.status}`);
} catch (e) {
  console.error(`❌ Server is not reachable: ${e}`);
}

process.exit(0);
