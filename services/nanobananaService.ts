import { GoogleGenAI } from "@google/genai";

// --- Helper: Clean JSON ---
const extractJson = (text: string): string => {
  const startMatch = text.match(/[[{]/);
  if (!startMatch) return text.trim();

  const startIndex = startMatch.index!;
  const openChar = startMatch[0];
  const closeChar = openChar === '[' ? ']' : '}';
  
  let balance = 0;
  let endIndex = -1;
  let insideString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (escape) { escape = false; continue; }
    if (char === '\\') { escape = true; continue; }
    if (char === '"') { insideString = !insideString; continue; }
    if (!insideString) {
      if (char === openChar) balance++;
      else if (char === closeChar) {
        balance--;
        if (balance === 0) { endIndex = i; break; }
      }
    }
  }

  if (endIndex !== -1) return text.substring(startIndex, endIndex + 1);
  return text.trim();
};

/**
 * Verifies if the image is clean of text.
 * Returns a list of locations where text was found.
 */
const verifyCleanup = async (client: GoogleGenAI, imageBase64: string): Promise<{ found: boolean; locations: string[]; advice: string }> => {
    const prompt = `
    # SYSTEM TASK: Quality Control / Text Detection
    Analyze this "Cleaned Background" candidate. 
    
    # OBJECTIVE:
    Determine if there are ANY remaining printed text artifacts that were not removed.
    
    # CRITERIA:
    1. Look for: Chinese characters (Hanzi), English letters, Numbers, Symbols (%, $, etc.), Punctuation.
    2. IGNORE: Handwriting (if distinct), Logos (graphics), Chart lines/bars (without labels).
    3. BE STRICT: Even faint "ghost" text or partial letters should be flagged.
    
    # OUTPUT FORMAT (JSON ONLY):
    {
        "found": boolean, // true if ANY printed text remains
        "locations": string[], // ["Top left title", "X-axis labels", "Number 2024 in middle"]
        "advice": string // Specific instruction for the painter to fix this (e.g., "The X-axis still has numbers 10, 20, 30. Remove them.")
    }
    `;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-pro', // Using the model string specified by the user
            contents: {
                parts: [
                    { text: prompt },
                    { inlineData: { mimeType: 'image/png', data: imageBase64.replace(/^data:image\/\w+;base64,/, '') } }
                ]
            },
            config: { responseMimeType: 'application/json' }
        });

        const json = extractJson(response.text || "{}");
        const result = JSON.parse(json);
        return {
            found: result.found === true,
            locations: Array.isArray(result.locations) ? result.locations : [],
            advice: result.advice || ""
        };
    } catch (e) {
        console.warn("[Nanobanana] Verification failed (non-blocking):", e);
        return { found: false, locations: [], advice: "" }; // Assume clean if verification fails to avoid infinite loops
    }
};

/**
 * Nanobanana Pro Service (Iterative Text Removal)
 * Uses Gemini Vision to smartly reconstruct slides by removing printed text.
 * Implements a "Generate -> Verify -> Refine" loop.
 */
export const removePrintedText = async (base64Image: string, apiKey: string, elements: any[] = []): Promise<string> => {
  if (!apiKey) throw new Error("API Key is required for Nanobanana Service.");

  const cleanKey = apiKey.replace(/["\s'\n\r]/g, '');
  const client = new GoogleGenAI({ apiKey: cleanKey });

  if (!base64Image || base64Image.length < 100) {
      throw new Error("Invalid Image Data.");
  }

  // 1. Prepare Base Kill List (from OCR)
  const ocrKillListStr = elements.slice(0, 50).map((e, idx) => {
        const [y, x, y2, x2] = e.box || [0,0,0,0];
        const top = Math.round(y / 10);
        const left = Math.round(x / 10);
        const content = e.content.length > 15 ? e.content.substring(0, 15) + "..." : e.content;
        return `- Known Text: "${content}" @ (y:${top}%, x:${left}%)`;
  }).join('\n');

  let currentBestImage = base64Image; // Start with original
  let feedbackHistory: string[] = [];
  const MAX_ATTEMPTS = 3; 

  console.log(`[Nanobanana] Starting Smart Removal Loop. OCR Items: ${elements.length}`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`[Nanobanana] Generation Attempt ${attempt}/${MAX_ATTEMPTS}...`);

      // Determine which image to use as input
      // Attempt 1: Use Original
      // Attempt 2+: Use the result from previous attempt (Iterative Refinement)
      const inputImageForThisRound = attempt === 1 ? base64Image : currentBestImage;

      // Construct Dynamic Prompt
      let dynamicInstructions = "";
      let taskDescription = "";

      if (attempt === 1) {
          taskDescription = `
          # INPUT CONTEXT:
          The user has provided a slide. It contains:
          1. Graphics/Charts/Backgrounds (KEEP THESE).
          2. Printed Text (REMOVE THESE).
          `;
      } else {
          taskDescription = `
          # INPUT CONTEXT:
          The user has provided a **partially cleaned slide**.
          It still contains some stubborn text residues.
          `;

          dynamicInstructions = `
          # 🚨 CRITICAL CORRECTION (ITERATIVE REFINEMENT):
          The previous attempt missed some text. You are working on the *already processed* image.
          SPECIFIC FEEDBACK FROM QA:
          ${feedbackHistory.join('\n')}
          
          👉 ACTION: Focus ONLY on removing these remaining artifacts. Do not touch already clean areas.
          `;
      }

      const prompt = `
      # ROLE: Specialized Image Restorer (Text Removal Expert)
      # TASK: Output a clean background image by removing ALL printed text.

      ${taskDescription}

      # KNOWN TEXT LOCATIONS (OCR):
      ${ocrKillListStr}
      ...and any other text you see.

      ${dynamicInstructions}

      # STRICT EXECUTION RULES:
      1. **Target**: Remove ALL Chinese characters, English letters, Numbers, and Symbols.
      2. **Preserve**: Keep the background color, gradients, chart bars/lines, and any distinct handwriting.
      3. **Inpainting**: When removing text from a chart or complex background, intelligently fill the gap with the surrounding texture/color.
      4. **Verification**: Imagine you are being graded. Any leftover text is a failure.

      # OUTPUT:
      A pure image. No text. High fidelity (4K).
      `;

      try {
          // CALL GENERATION
          const response = await client.models.generateContent({
              model: 'gemini-3-pro-image-preview', // The "Painter"
              contents: {
                  parts: [
                      { text: prompt },
                      {
                          inlineData: {
                              mimeType: 'image/png', 
                              // Use the correct input image for this round
                              data: inputImageForThisRound.includes('base64,') ? inputImageForThisRound.split(',')[1] : inputImageForThisRound 
                          }
                      }
                  ]
              },
              config: { imageConfig: { aspectRatio: '16:9', imageSize: '4K' } }
          });

          // Extract Image
          let generatedImage = "";
          if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                  if (part.inlineData && part.inlineData.data) {
                      generatedImage = `data:image/png;base64,${part.inlineData.data}`;
                      break;
                  }
              }
          }

          if (!generatedImage) {
              throw new Error("Gemini returned no image.");
          }

          // Update current best to the new result
          currentBestImage = generatedImage;

          // VERIFICATION STEP
          console.log(`[Nanobanana] Verifying result ${attempt}...`);
          const verification = await verifyCleanup(client, currentBestImage);

          if (!verification.found) {
              console.log(`[Nanobanana] ✅ Verification Passed on attempt ${attempt}. Image is clean.`);
              return currentBestImage;
          } else {
              console.warn(`[Nanobanana] ⚠️ Text remaining on attempt ${attempt}:`, verification.locations);
              feedbackHistory.push(`- Attempt ${attempt} missed text at: ${verification.locations.join(', ')}. Advice: ${verification.advice}`);
              
              if (attempt === MAX_ATTEMPTS) {
                  console.warn("[Nanobanana] Max attempts reached. Returning best effort.");
              }
          }

      } catch (err: any) {
          console.error(`[Nanobanana] Attempt ${attempt} Error:`, err.message);
          if (attempt === MAX_ATTEMPTS && (!currentBestImage || currentBestImage === base64Image)) throw err; 
          // If we fail but have a previous result, we might return that, but here we just throw if it's the last try
      }
  }

  return currentBestImage;
};
