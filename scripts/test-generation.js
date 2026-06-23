const fs = require('fs');
const path = require('path');
const os = require('os');

// Load API Key
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const matched = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (matched) {
      const key = matched[1];
      let value = matched[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  }
}

const apiKey = process.env.GEMINI_API_KEY;
console.log("Using API Key:", apiKey ? apiKey.substring(0, 10) + "..." : "None");

async function testGen() {
  const itemMediaDir = "/var/folders/k1/tdpbx4jd03d9jbkwfln32n300000gn/T/inventory/52";
  const files = fs.readdirSync(itemMediaDir);
  const referenceImages = files.filter(f => f.endsWith(".jpeg") && !f.includes("_ai"));
  console.log("Reference images found:", referenceImages);

  const inputParts = referenceImages.slice(0, 3).map(imgName => {
    const imgPath = path.join(itemMediaDir, imgName);
    return {
      inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(imgPath).toString("base64") }
    };
  });

  const promptText = `Put this exact saree on an elegant, professional Indian model named Maya, featuring a consistent beautiful face with symmetric facial features and identical soft smile across all shots, with a professional Olive Indian skin tone, wearing a custom-tailored matching saree blouse that perfectly coordinates in color, design, and pattern with the saree, and draped elegantly in this exact saree, standing in a luxurious minimalist modern light-filled studio. Strictly preserve all original patterns, colors, textures, borders, and print details of the saree. Camera: A professional, high-fashion full-body portrait shot. Return the final generated model image directly as an image asset.`;

  const geminiImageUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent?key=${apiKey}`;

  try {
    console.log("Sending request to gemini-3.1-flash-image...");
    const imgRes = await fetch(geminiImageUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }, ...inputParts] }]
      })
    });

    console.log("Status:", imgRes.status, imgRes.statusText);
    const data = await imgRes.json();
    console.log("Response keys:", Object.keys(data));
    if (data.error) {
      console.error("Error Details:", data.error);
    } else {
      const candidates = data.candidates || [];
      console.log("Candidates length:", candidates.length);
      if (candidates[0]) {
        const parts = candidates[0].content?.parts || [];
        console.log("Parts length:", parts.length);
        const bytes = parts.find(p => p.inlineData?.data)?.inlineData?.data || parts[0]?.inlineData?.data;
        console.log("Bytes returned:", bytes ? `${bytes.substring(0, 50)}... (${bytes.length} bytes)` : "None");
      }
    }
  } catch (err) {
    console.error("Fetch exception:", err);
  }
}

testGen();
