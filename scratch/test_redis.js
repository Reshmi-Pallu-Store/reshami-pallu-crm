const { Redis } = require("@upstash/redis");
const fs = require("fs");

const env = fs.readFileSync(".env.local", "utf8");
const envVars = {};
env.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
  }
});

const redis = new Redis({
  url: envVars.UPSTASH_REDIS_REST_URL,
  token: envVars.UPSTASH_REDIS_REST_TOKEN,
});

(async () => {
  const lockKey = "lock:test_race_condition";
  await redis.del(lockKey);
  const acq1 = await redis.set(lockKey, "processing", { nx: true, ex: 120 });
  console.log("acq1:", acq1, typeof acq1);
  const acq2 = await redis.set(lockKey, "processing", { nx: true, ex: 120 });
  console.log("acq2:", acq2, typeof acq2);
  await redis.del(lockKey);
})();
