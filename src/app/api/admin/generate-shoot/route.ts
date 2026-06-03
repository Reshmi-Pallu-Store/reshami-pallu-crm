import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { db } from "@/lib/db";
import { processQueueAsync } from "@/lib/media-worker";

const POSE_PROMPT_DESCRIPTIONS: Record<string, string> = {
  "Front Pleats Detail": "A professional, high-fashion full-body portrait shot of the model standing upright, facing the camera directly, showcasing the neat front pleats of the saree draped perfectly from the waist to the floor, complete nivi drape view.",
  "Back View Drape": "A high-fashion full-body back-view portrait shot of the model looking away from the camera, displaying the beautiful drape of the saree across her back and shoulders, showcasing how the fabric falls gracefully from the backside.",
  "Pallu Fall Close-up": "A high-fashion medium close-up shot focusing on the model's shoulder and upper torso, showcasing the decorative pallu section falling elegantly over her left shoulder, highlighting the elaborate printed or embroidered pallu patterns clearly.",
  "Macro Fabric Detail": "An extreme close-up macro fashion shot focusing purely on the saree's fabric weave, zari work, and thread detailing, highlighting the intricate gold zari threadwork, delicate borders, or sequin highlights on the textile texture up-close."
};

// Dynamic route
export const revalidate = 0;

// Authentication Helper
async function verifySession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("crm_session");
  return session && session.value === "authenticated";
}

export async function POST(req: NextRequest) {
  try {
    // 1. Session verification
    if (!await verifySession()) {
      return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 401 });
    }

    const { mediaIds, modelTone, backgroundVibe, customPrompt, poses } = await req.json();

    if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json({ error: "At least one Saree Media ID is required" }, { status: 400 });
    }

    const finalPoses = Array.isArray(poses) && poses.length > 0 ? poses : ["Front Pleats Detail"];

    console.log("=========================================");
    console.log("🚀 [AI Studio API] STARTING MULTI-IMAGE GENERATION PROCESS");
    console.log(`- Original Media IDs: ${mediaIds.join(", ")}`);
    console.log(`- Model Tone Selection: ${modelTone}`);
    console.log(`- Background Vibe: ${backgroundVibe}`);
    console.log(`- Target Poses: ${finalPoses.join(", ")}`);
    console.log(`- Custom Override Prompt: ${customPrompt ? `"${customPrompt}"` : "None"}`);
    console.log("=========================================");

    const apiKey = process.env.GEMINI_API_KEY;
    const isPlaceholderKey = !apiKey || apiKey === "YOUR_GEMINI_API_KEY_PLACEHOLDER";

    if (isPlaceholderKey) {
      console.error("❌ [AI Studio API] ERROR: Google Gen AI API key is not configured.");
      return NextResponse.json({ 
        error: "Google Gen AI API key is not configured. Please add your GEMINI_API_KEY in desktop/reshami-pallu-crm/.env.local." 
      }, { status: 400 });
    }

    // 2. Fetch and read all uploaded saree images for 360-degree context
    const inputParts: Array<{ inlineData: { mimeType: string, data: string } }> = [];
    let primaryMimeType = "image/jpeg";
    let primaryImageBase64 = "";

    for (const id of mediaIds) {
      const origItemStr = await db.hget<any>("media:queue", id);
      if (origItemStr) {
        const origItem = typeof origItemStr === "string" ? JSON.parse(origItemStr) : origItemStr;
        try {
          const imageBuffer = await fs.readFile(origItem.path);
          const imageBase64 = imageBuffer.toString("base64");
          const mimeType = origItem.mimeType || "image/jpeg";
          primaryMimeType = mimeType;
          if (!primaryImageBase64) primaryImageBase64 = imageBase64;
          inputParts.push({
            inlineData: { mimeType, data: imageBase64 }
          });
        } catch (err) {
          // If deleted from disk, fetch from Redis memory key fallback
          const redisKey = `brand-image-data:${id}`;
          const redisData = await db.get<string>(redisKey);
          if (redisData && redisData.includes("base64,")) {
            const mime = redisData.split(";")[0].split(":")[1] || "image/jpeg";
            primaryMimeType = mime;
            const dataBase64 = redisData.split("base64,")[1];
            if (!primaryImageBase64) primaryImageBase64 = dataBase64;
            inputParts.push({
              inlineData: { mimeType: mime, data: dataBase64 }
            });
          }
        }
      }
    }

    if (inputParts.length === 0) {
      return NextResponse.json({ error: "Failed to load any of the original Saree files from local disk or Redis memory" }, { status: 404 });
    }

    let sareeDescription = customPrompt || "";

    // Phase 1: Call Gemini 2.5 Flash to describe all angles into structured JSON (ONCE)
    if (!sareeDescription) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
      console.log(`⏳ [AI Studio API] Executing Multi-Angle Gemini JSON analysis...`);
      
      const jsonPrompt = `
        Analyze the uploaded saree photos showing different angles/details of the same saree. 
        Write a highly detailed, extremely precise description of this saree across all angles.
        You MUST return the output as a valid JSON object matching the following structure:
        {
          "base_color": "the primary color of the saree body",
          "accent_colors": ["list", "of", "secondary", "pattern/motif", "colors"],
          "border_design": "highly detailed description of borders, scalloping, pearl strings, waves, or threadwork",
          "pallu_design": "elaborate description of the decorative pallu section and its printed or embroidered elements",
          "fabric": "exact material texture e.g. sheer organza, katan silk, georgette, tissue",
          "motifs": "exact printed or embroidered patterns e.g. butterflies, lilies, flowers, vines",
          "weave_style": "e.g. digital printing, handwoven kadhua, jamdani, jacquard zari",
          "drape_style": "standard pleated nivi draping style recommendations",
          "catalog_requirements": "details about matching blouse, studio lighting, and high-fashion modeling parameters"
        }
        Return ONLY the raw JSON object inside your response content. Do not include markdown code block characters like \`\`\`json.
      `;

      const payload = {
        contents: [
          {
            parts: [
              { text: jsonPrompt },
              ...inputParts
            ]
          }
        ]
      };

      try {
        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify(payload)
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
          
          try {
            let cleanJsonText = rawText.trim();
            if (cleanJsonText.startsWith("```json")) {
              cleanJsonText = cleanJsonText.substring(7, cleanJsonText.length - 3).trim();
            } else if (cleanJsonText.startsWith("```")) {
              cleanJsonText = cleanJsonText.substring(3, cleanJsonText.length - 3).trim();
            }
            
            const parsedJson = JSON.parse(cleanJsonText);
            console.log("✅ [AI Studio API] Gemini Structured JSON analysis generated successfully:", parsedJson);
            
            sareeDescription = `An opulent, flowing ${parsedJson.fabric} saree featuring a base color of ${parsedJson.base_color} accented with ${parsedJson.accent_colors.join(", ")}, intricately detailed with ${parsedJson.motifs} in ${parsedJson.weave_style} style, featuring a gorgeous pallu with ${parsedJson.pallu_design}, finished with a border of ${parsedJson.border_design}. Styled with a matching blouse and recommendation: ${parsedJson.catalog_requirements}.`;
          } catch (jsonErr) {
            console.warn("⚠️ Failed to parse Gemini JSON output, falling back to raw text:", rawText);
            sareeDescription = rawText;
          }
        } else {
          const errText = await geminiRes.text();
          console.error(`❌ [AI Studio API] Gemini JSON analysis failed:`, errText);
          return NextResponse.json({ error: `Gemini JSON analysis failed: ${geminiRes.status} ${errText}` }, { status: 500 });
        }
      } catch (err: any) {
        console.error("❌ [AI Studio API] Network Exception during Gemini JSON request:", err);
        return NextResponse.json({ error: `Gemini network request failed: ${err.message}` }, { status: 500 });
      }
    }

    if (!sareeDescription) {
      sareeDescription = "A premium handwoven saree with detailed borders and rich fabric textures.";
    }

    // Phase 2: Call Image Try-on Generation in a loop for each requested pose
    const generatedItems = [];
    const uploadDir = path.join(os.tmpdir(), "reshami-pallu-uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    for (const pose of finalPoses) {
      console.log(`⏳ [AI Studio API] Generating model image for pose: ${pose}...`);
      let imagenSuccess = false;
      let finalImageBase64 = "";

      const poseDetail = POSE_PROMPT_DESCRIPTIONS[pose] || pose;

      // 1. Primary Method: Call their active custom 'gemini-3.1-flash-image' (Nano Banana 2) model!
      const geminiImageUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent?key=${apiKey}`;
      
      const geminiImagePayload = {
        contents: [
          {
            parts: [
              { 
                text: `Put this exact saree on the same elegant, professional Indian model named Maya, featuring a consistent beautiful face with symmetric facial features and identical soft smile across all shots, with a professional ${modelTone} skin tone, standing in a luxurious ${backgroundVibe} setting. Focus on catalog studio lighting, high resolution, intricate fabric weave textures, complete drape focus, photorealistic. Camera shot and angle instructions: ${poseDetail}. Return the final generated model image directly as an image asset.` 
              },
              ...inputParts
            ]
          }
        ]
      };

      try {
        const imgRes = await fetch(geminiImageUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify(geminiImagePayload)
        });

        console.log(`- gemini-3.1-flash-image Response Status for ${pose}: ${imgRes.status} ${imgRes.statusText}`);

        if (imgRes.ok) {
          const imgData = await imgRes.json();
          const generatedBytes = imgData.candidates?.[0]?.content?.parts?.find(
            (p: any) => p.inlineData?.data
          )?.inlineData?.data || imgData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

          if (generatedBytes) {
            finalImageBase64 = generatedBytes;
            console.log(`✅ [AI Studio API] gemini-3.1-flash-image successfully generated model photo for pose: ${pose}`);
            imagenSuccess = true;
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ [AI Studio API] gemini-3.1-flash-image exception for ${pose}:`, err.message);
      }

      // 2. Fallback Method: Loop through standard Imagen models if primary fails
      if (!imagenSuccess) {
        console.log(`⏳ [AI Studio API] Falling back to standard Google Imagen for pose: ${pose}...`);
        
        const poseDescription = `A specific, professional Indian model named Maya, featuring a highly consistent beautiful face, symmetric facial features, identical soft smile and hairstyle across all angles, with a professional ${modelTone} skin tone, wearing a custom stitched matching blouse, elegantly draped in a saree that matches this description: "${sareeDescription}". She is standing in a luxurious ${backgroundVibe} setting. Camera framing & shot angle: ${poseDetail}. Professional catalog studio lighting, award-winning fashion editorial photography, 8k resolution, photorealistic, intricate fabric weave textures, complete drape focus.`;
        
        const imagenModels = ["imagen-4.0-generate-001", "imagen-4.0-fast-generate-001"];

        for (const modelName of imagenModels) {
          const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;
          console.log(`⏳ [AI Studio API] Attempting imagen generation with model: ${modelName} for pose: ${pose}...`);

          const imagenPayload = {
            instances: [
              {
                prompt: poseDescription,
                imagePrompt: {
                  image: {
                    imageBytes: primaryImageBase64
                  }
                }
              }
            ],
            parameters: {
              sampleCount: 1,
              outputMimeType: "image/jpeg",
              aspectRatio: "3:4"
            }
          };

          try {
            const imagenRes = await fetch(imagenUrl, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey
              },
              body: JSON.stringify(imagenPayload)
            });

            if (imagenRes.ok) {
              const imagenData = await imagenRes.json();
              const generatedBytes = imagenData.predictions?.[0]?.bytesBase64Encoded || imagenData.generatedImages?.[0]?.image?.imageBytes;
              if (generatedBytes) {
                finalImageBase64 = generatedBytes;
                console.log(`✅ [AI Studio API] ${modelName} successfully generated model photo for pose: ${pose}`);
                imagenSuccess = true;
                break;
              }
            }
          } catch (err: any) {
            console.warn(`⚠️ [AI Studio API] Model ${modelName} fallback exception for ${pose}:`, err.message);
          }
        }
      }

      if (!imagenSuccess) {
        console.error(`❌ [AI Studio API] All Saree try-on models failed for pose: ${pose}`);
        continue; // Try next pose instead of failing entirely
      }

      // 3. Register the new generated image in the local OS temp disk and media queue
      const generatedMediaId = "media_ai_" + Math.random().toString(36).substring(2, 11);
      const absolutePath = path.join(uploadDir, `${generatedMediaId}.jpg`);
      const finalBuffer = Buffer.from(finalImageBase64, "base64");
      await fs.writeFile(absolutePath, finalBuffer);

      // Save metadata in Upstash Redis media queue
      const queueItem = {
        id: generatedMediaId,
        path: absolutePath,
        status: "queued",
        type: "image",
        originalName: `ai_model_${modelTone.replace(/\s+/g, '_')}_${pose.replace(/\s+/g, '_')}_${backgroundVibe.replace(/\s+/g, '_')}.jpg`,
        mimeType: "image/jpeg",
        createdAt: new Date().toISOString()
      };
      await db.hset("media:queue", { [generatedMediaId]: JSON.stringify(queueItem) });

      console.log(`[AI Studio API] Generated AI model ${generatedMediaId} for pose ${pose} queued in Redis.`);
      
      generatedItems.push({
        id: generatedMediaId,
        url: `/api/upload/preview?id=${generatedMediaId}`
      });
    }

    if (generatedItems.length === 0) {
      return NextResponse.json({ error: "All AI try-on models failed to generate any draped images." }, { status: 500 });
    }

    // Trigger background worker once to optimize and upload all to Shopify Files CDN!
    processQueueAsync();

    return NextResponse.json({
      success: true,
      items: generatedItems,
      description: sareeDescription
    });

  } catch (err: any) {
    console.error("AI Generation Endpoint Error:", err);
    return NextResponse.json({ error: err.message || "AI pipeline execution failure" }, { status: 500 });
  }
}
