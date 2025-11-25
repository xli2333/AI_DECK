import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { getSystemPrompts } from "../constants";
import { SlideData, OutlineItem, SlideType, ConsultingStyle } from "../types";

const getClient = (apiKey: string) => {
  // STRICT VALIDATION: Ensure only explicit, valid keys are used.
  // SANITIZATION: We strictly trim the key to remove accidental newlines, spaces, or quotes from copy-pasting.
  const cleanKey = apiKey ? apiKey.replace(/["s"'\n\r]/g, '') : "";

  if (!cleanKey || !cleanKey.startsWith('AIza') || cleanKey.length < 30) {
      throw new Error("No valid API Key provided. The system has no default key. You must enter your own Google Gemini API Key starting with 'AIza'.");
  }
  return new GoogleGenAI({ apiKey: cleanKey });
};

export interface AnalysisInput {
  text?: string;
  filesData?: {
    mimeType: string;
    base64: string;
  }[];
}

const validateAnalysisInput = (input: AnalysisInput) => {
    if (!input.text && (!input.filesData || input.filesData.length === 0)) {
        throw new Error("Input validation failed: No text or file data provided.");
    }
    if (input.filesData) {
        for (const file of input.filesData) {
            if (!file.base64 || file.base64.length < 10) {
                throw new Error("Input validation failed: One or more files are corrupt or empty.");
            }
        }
    }
};

// --- ROBUST JSON CLEANER (Stack-Based) ---
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

// --- HELPER: Sanitize String Arrays ---
// Fixes React Error #31 where AI returns objects ({header, details}) instead of strings
const sanitizeStringArray = (arr: any): string[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'number') return String(item);
        if (typeof item === 'object' && item !== null) {
            // Attempt to flatten object to string
            const parts = [
                item.header, item.title, item.label, item.heading, 
                item.details, item.description, item.text, item.value, item.content
            ].filter(val => typeof val === 'string' && val.trim() !== '');
            
            if (parts.length > 0) return parts.join(': ');
            
            // Fallback: join all string values
            const values = Object.values(item).filter(v => typeof v === 'string');
            if (values.length > 0) return values.join(' - ');
            
            return JSON.stringify(item);
        }
        return String(item);
    });
};

const prepareParts = (input: AnalysisInput, prompt: string) => {
  const parts = [];
  
  // Attach all files
  if (input.filesData && input.filesData.length > 0) {
      for (const file of input.filesData) {
        parts.push({
            inlineData: {
                mimeType: file.mimeType,
                data: file.base64
            }
        });
      }
  }

  // Attach text context
  if (input.text) {
      parts.push({ text: `Context/Input Data:\n${input.text}\n\n` });
  }
  
  parts.push({ text: prompt });
  return parts;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
    ]);
};

const callWithRetry = async <T>(fn: () => Promise<T>, retries: number = 2, label: string): Promise<T> => {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            console.warn(`${label} failed, retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, 2000));
            return callWithRetry(fn, retries - 1, label);
        }
        throw error;
    }
};

// --- NEW: CUSTOM STYLE EXTRACTOR (GEMINI 3 PRO) ---
export const extractCustomStyle = async (
    fileBase64: string | null, 
    fileMime: string | null, 
    description: string, 
    apiKey: string
): Promise<{ core: string, visual: string }> => {
    const client = getClient(apiKey);
    
    const extractionPrompt = `
    # ROLE: Methodology Engineer & Design System Analyst
    # TASK: Reverse-engineer a "Consulting Presentation Style" from the input provided (File or Description).
    # CONTEXT: ${description || "Professional Consulting Deck"}

    # OBJECTIVE:
    Create TWO distinct system prompts that capture the essence of this style.

    ## 1. CORE_PROMPT (The Logic & Structure)
    Structure this prompt exactly like a "Persona Definition" for a Consultant.
    Must include these specific sections:
    - **Role:** The specific persona (e.g., "Senior Project Leader").
    - **Philosophy:** Core logical values (e.g., "Insight-Led", "Hypothesis-Driven").
    - **Visual Identity (Text):** Color Palette (Hex codes), Typography hierarchy rules.
    - **Narrative Architecture:** How to structure titles (Action Titles) and arguments.
    - **Chart Library:** Strategic frameworks (Matrices, Waterfalls) specific to this style.
    - **Tone:** Vocabulary and writing style (e.g., "Unlock value", "Granularity").
    - **Output Specification:** Define the expected structure for a slide (Headline, Visual Spec, Body, Footer).

    ## 2. VISUAL_PROMPT (The Design & Rendering)
    Structure this prompt for a "Visual Designer Agent".
    Must include:
    - **Role:** "Slide Architect".
    - **Visual Identity:** STRICT color codes, margin rules, font choices.
    - **Layout Strategy:** Grid systems (Split, Columns, Matrix).
    - **Visual Engine:** Detailed descriptions of how charts should look (e.g., "No gridlines", "High contrast").
    
    # REFERENCE STRUCTURE (Example of tone/detail expected):
    """
    # Role: The BCG Senior Project Leader
    **Identity:** You are not just making slides; you are crafting a Strategic Narrative.
    **Visual Identity:** Use the Green Palette (#00291C).
    **Narrative Architecture:** Action Titles must be complete sentences.
    ...
    """

    # INPUT DATA SOURCE:
    ${fileBase64 ? "Reference the uploaded file image/document for visual evidence." : "Use the user description to infer the style."}

    # OUTPUT FORMAT (JSON ONLY):
    Return a single valid JSON object.
    {
      "core": "MARKDOWN_STRING",
      "visual": "MARKDOWN_STRING"
    }
    `;

    // Construct parts dynamically based on whether a file is provided
    const parts: any[] = [{ text: extractionPrompt }];
    if (fileBase64 && fileMime) {
        parts.unshift({ inlineData: { mimeType: fileMime, data: fileBase64 } });
    }

    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts },
                config: { responseMimeType: 'application/json' }
            }),
            60000, "Extract Custom Style"
        ),
        1, "Extract Custom Style"
    );

    const jsonStr = extractJson(response.text || "{}");
    const data = JSON.parse(jsonStr);
    
    if (!data.core || !data.visual) {
        throw new Error("Failed to extract style structure from the input.");
    }

    return { core: data.core, visual: data.visual };
};


// --- 1. GENERATE OUTLINE (GEMINI 3 PRO - BRAIN) ---
export const generateOutline = async (
    input: AnalysisInput, 
    style: ConsultingStyle, 
    apiKey: string,
    customPrompts?: { core: string, visual: string }
): Promise<OutlineItem[]> => {
    validateAnalysisInput(input);
    const client = getClient(apiKey);
    const { outlinePrompt } = getSystemPrompts(style, customPrompts);

    // CRITICAL: We structure the prompt to make the User Context the PRIMARY DRIVER.
    // The "input.text" (User Purpose) is injected here as a high-level constraint.
    const prompt = `
    # CRITICAL INSTRUCTION: USER MANDATE (HIGHEST PRIORITY)
    The user has provided the following core objective/context. You MUST build the deck SPECIFICALLY to address this. 
    
    *** USER INPUT START ***
    ${input.text || "No specific text provided. Infer from files."} 
    *** USER INPUT END ***
    
    Ignore any generic template structures if they conflict with the User Input above. The User Input is the "Boss".
    
    ${outlinePrompt}
    
    # TASK
    1. Deeply analyze the provided Input Data & Files.
    2. Extract the strategic narrative that aligns with the User Mandate.
    3. Create a logical, persuasive storyboard (5-10 slides) in ${style.toUpperCase()} style.
    `;

    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-preview', // UPGRADED from flash
                contents: { parts: prepareParts(input, prompt) },
                config: { temperature: 0.2, responseMimeType: 'application/json' }
            }),
            60000, "Outline Generation" // Increased timeout for Pro model
        ),
        2, "Generate Outline"
    );

    const text = response.text || "[]";
    const jsonStr = extractJson(text);
    const data = JSON.parse(jsonStr);
    
    // Validate and map IDs
    return data.map((item: any, idx: number) => ({
        id: `slide-${idx}-${Date.now()}`,
        title: item.title,
        executiveSummary: item.executiveSummary,
        suggestedSlideType: item.suggestedSlideType,
        keyPoints: sanitizeStringArray(item.keyPoints)
    }));
};

// --- 2. GENERATE SLIDE CONTENT (GEMINI 3 PRO - BRAIN) ---
export const generateSlideContent = async (
    input: AnalysisInput, 
    outlineItem: OutlineItem, 
    previousSlides: {title: string, summary: string}[],
    style: ConsultingStyle, 
    apiKey: string,
    globalInstructions?: string,
    customPrompts?: { core: string, visual: string }
): Promise<SlideData> => {
    const client = getClient(apiKey);
    let { constructionPrompt } = getSystemPrompts(style, customPrompts);

    // INJECT USER INSTRUCTIONS INTO SYSTEM PROMPT (HIGH PRIORITY)
    if (globalInstructions && globalInstructions.trim().length > 0) {
        constructionPrompt = `
        # CRITICAL USER INSTRUCTION (HIGHEST PRIORITY):
        The user has provided specific instructions for this deck generation. You MUST adhere to them:
        "${globalInstructions}"
        
        Ensure the "fullImagePrompt" you generate explicitly describes these visual preferences for the image generator.
        
        ${constructionPrompt}`;
    }

    const contextStr = previousSlides.map((s, i) => `Slide ${i+1}: ${s.title} (${s.summary})`).join('\n');
    
    const prompt = `
    ${constructionPrompt}

    # CURRENT TASK
    Draft Slide: "${outlineItem.title}"
    Type: ${outlineItem.suggestedSlideType}
    Summary: ${outlineItem.executiveSummary}
    
    # REQUIRED EVIDENCE & KEY POINTS (MUST BE INCLUDED IN VISUALS):
    ${outlineItem.keyPoints ? outlineItem.keyPoints.join('\n- ') : "No specific points."} 

    # CONTEXT (Story Flow)
    ${contextStr}

    # CRITICAL INSTRUCTION FOR IMAGE PROMPT
    You are writing instructions for an advanced AI Visual Engine.
    The 'visualSpecification.fullImagePrompt' MUST be comprehensive. 
    1. It must explicitly list the data values to be plotted.
    2. It must describe the exact layout (Split, Matrix, Waterfall).
    3. It must enforce the ${style} color code.
    4. It must reference the specific "Key Points" listed above.
    `;

    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-preview', // UPGRADED from flash
                contents: { parts: prepareParts(input, prompt) },
                config: { temperature: 0.3, responseMimeType: 'application/json' }
            }),
            60000, "Slide Text Generation" // Increased timeout for Pro model
        ),
        2, "Generate Slide Content"
    );

    const jsonStr = extractJson(response.text || "{}");
    const data = JSON.parse(jsonStr);

    return {
        id: outlineItem.id,
        slideType: outlineItem.suggestedSlideType,
        actionTitle: data.actionTitle || outlineItem.title,
        subtitle: data.subtitle || outlineItem.executiveSummary,
        visualSpecification: {
            chartType: data.visualSpecification?.chartType || "Conceptual",
            axesVariables: data.visualSpecification?.axesVariables || "",
            keyInsight: data.visualSpecification?.keyInsight || "",
            annotation: data.visualSpecification?.annotation || "",
            fullImagePrompt: data.visualSpecification?.fullImagePrompt || `A professional ${style} consulting slide showing ${outlineItem.title}`
        },
        bodyContent: sanitizeStringArray(data.bodyContent),
        footer: {
            source: data.footer?.source || "Internal Analysis",
            disclaimer: data.footer?.disclaimer || "Confidential"
        },
        dataPoints: sanitizeStringArray(data.dataPoints),
        status: 'generating_visual'
    };
};

// --- 3. GENERATE SLIDE VISUAL (NANO BANANA PRO - PAINTER) ---
export const generateSlideVisual = async (
    input: AnalysisInput, // <--- NEW: Access to raw files
    slideContext: { title: string, subtitle: string, keyPoints: string[] }, // <--- NEW: Full context
    prompt: string, 
    style: ConsultingStyle, 
    apiKey: string,
    resolution: '1K' | '4K' = '1K',
    globalInstructions?: string,
    customPrompts?: { core: string, visual: string }
): Promise<string> => {
    const client = getClient(apiKey);
    const { imagePrompt } = getSystemPrompts(style, customPrompts);

    // Combine system visual style with specific slide prompt
    let finalPrompt = `
    # SYSTEM IDENTITY (HIGHEST PRIORITY)
    ${imagePrompt}
    `;

    // DIRECT INJECTION FOR NANO BANANA PRO (TOP PRIORITY)
    if (globalInstructions && globalInstructions.trim().length > 0) {
        finalPrompt += `
        
        # CRITICAL USER VISUAL DIRECTIVE:
        The user has provided strict global instructions. You MUST incorporate these and IGNORE any conflicting defaults:
        "${globalInstructions}"
        
        `;
    }
    
    finalPrompt += `
    # SLIDE CONTEXT (CONTENT TO RENDER):
    **Action Title:** ${slideContext.title}
    **Kicker/Subtitle:** ${slideContext.subtitle}
    **Key Evidence/Bullets:** 
    ${slideContext.keyPoints.map(p => `- ${p}`).join('\n')}

    # DESIGN SPECIFICATION (FROM ANALYST):
    ${prompt}
    
    # RENDER INSTRUCTION (QUALITY BOOST):
    - **RAW DATA ACCESS:** You have access to the original input files (attached). Use them to accurately render logos, specific data shapes, or product images if relevant.
    - **STYLE ENFORCEMENT:** Strictly adhere to the ${style} Color Palette and Layout Grid defined in the System Identity.
    - **TEXT CLARITY:** Render a **MAXIMUM FIDELITY**, **VECTOR-STYLE SHARPNESS** presentation slide. Text must be simulated but look CRISP.
    - **NO ARTIFACTS:** No blur, no jpeg compression, no hallucinations.
    `;

    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-image-preview', // LOCKED: Nano Banana Pro
                // UPGRADE: Use prepareParts to attach the raw files + the prompt
                contents: { parts: prepareParts(input, finalPrompt) },
                config: {
                    imageConfig: {
                         aspectRatio: '16:9',
                         imageSize: resolution // '1K' or '4K'
                    }
                }
            }),
            60000, `Generate Slide Visual (${resolution})` // 60s timeout for high quality
        ),
        1, `Generate Slide Visual (${resolution})`
    );

    // Extract image
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No image data returned from Gemini.");
};

// --- 4. REFINE OUTLINE (GEMINI 3 PRO - BRAIN) ---
export const refineOutline = async (
    currentOutline: OutlineItem[], 
    instruction: string, 
    history: string[],
    style: ConsultingStyle, 
    apiKey: string,
    customPrompts?: { core: string, visual: string }
): Promise<OutlineItem[]> => {
    const client = getClient(apiKey);
    const { outlineRefinePrompt } = getSystemPrompts(style, customPrompts);

    const historyText = history.length > 0 
        ? history.map((h, i) => `Step ${i+1}: ${h}`).join('\n')
        : "No previous modifications.";

    const prompt = `
    ${outlineRefinePrompt}
    
    # CURRENT OUTLINE:
    ${JSON.stringify(currentOutline.map(o => ({ title: o.title, summary: o.executiveSummary })))} 

    # MODIFICATION HISTORY (CONTEXT):
    We are in a linear refinement session. The user has previously asked:
    ${historyText}

    # NEW USER INSTRUCTION (LATEST):
    "${instruction}"

    # TASK:
    Re-write the outline to satisfy the NEW instruction while maintaining the improvements from previous steps. Return the complete new JSON array.
    `;

    const response = await client.models.generateContent({
        model: 'gemini-3-pro-preview', // UPGRADED
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: 'application/json' }
    });

    const jsonStr = extractJson(response.text || "[]");
    const data = JSON.parse(jsonStr);

    return data.map((item: any, idx: number) => ({
        id: currentOutline[idx]?.id || `slide-${idx}-${Date.now()}`,
        title: item.title,
        executiveSummary: item.executiveSummary,
        suggestedSlideType: item.suggestedSlideType || "Text Slide",
        keyPoints: sanitizeStringArray(item.keyPoints)
    }));
};

// --- 5. REFINE SPECIFIC SLIDE (GEMINI 3 PRO - BRAIN) ---
export const refineSpecificSlide = async (
    slide: OutlineItem, 
    instruction: string, 
    history: string[],
    style: ConsultingStyle, 
    apiKey: string,
    customPrompts?: { core: string, visual: string }
): Promise<OutlineItem> => {
    const client = getClient(apiKey);
    const { slideRefinePrompt } = getSystemPrompts(style, customPrompts);

    const historyText = history.length > 0 
        ? history.map((h, i) => `Step ${i+1}: ${h}`).join('\n')
        : "No previous modifications.";

    const prompt = `
    ${slideRefinePrompt}

    # CURRENT SLIDE:
    Title: ${slide.title}
    Summary: ${slide.executiveSummary}
    Points: ${slide.keyPoints.join('; ')}

    # LINEAR MODIFICATION CONTEXT:
    ${historyText}

    # NEW USER FEEDBACK:
    "${instruction}"
    
    # TASK:
    Apply the new feedback to update the slide structure.
    `;

    const response = await client.models.generateContent({
        model: 'gemini-3-pro-preview', // UPGRADED
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: 'application/json' }
    });

    const jsonStr = extractJson(response.text || "{}");
    const data = JSON.parse(jsonStr);

    return {
        ...slide,
        title: data.title || slide.title,
        executiveSummary: data.executiveSummary || slide.executiveSummary,
        suggestedSlideType: data.suggestedSlideType || slide.suggestedSlideType,
        keyPoints: sanitizeStringArray(data.keyPoints)
    };
};

// --- 6. REGENERATE FINAL SLIDE (GEMINI 3 PRO - BRAIN) ---
export const regenerateFinalSlide = async (
    input: AnalysisInput, 
    currentSlide: SlideData, 
    instruction: string, 
    history: string[],
    style: ConsultingStyle, 
    apiKey: string
): Promise<SlideData> => {
    const client = getClient(apiKey);
    let { constructionPrompt } = getSystemPrompts(style);

    const historyText = history.length > 0 
        ? history.map((h, i) => `Step ${i+1}: ${h}`).join('\n')
        : "No previous modifications.";

    const prompt = `
    ${constructionPrompt}

    # CONTEXT
    We are refining an existing slide in a continuous session.
    Current Title: ${currentSlide.actionTitle}
    Current Visual Prompt: ${currentSlide.visualSpecification.fullImagePrompt}

    # MODIFICATION HISTORY:
    ${historyText}

    # NEW USER INSTRUCTION:
    "${instruction}"

    # TASK
    Regenerate the slide JSON content. 
    1. Respect previous instructions if they don't conflict.
    2. Strongly apply the NEW instruction.
    3. UPDATE the 'visualSpecification.fullImagePrompt' to reflect the user's change.
    `;

    const response = await client.models.generateContent({
        model: 'gemini-3-pro-preview', // UPGRADED
        contents: { parts: prepareParts(input, prompt) },
        config: { responseMimeType: 'application/json' }
    });

    const jsonStr = extractJson(response.text || "{}");
    const data = JSON.parse(jsonStr);

    return {
        ...currentSlide,
        actionTitle: data.actionTitle || currentSlide.actionTitle,
        subtitle: data.subtitle || currentSlide.subtitle,
        visualSpecification: {
            ...currentSlide.visualSpecification,
            chartType: data.visualSpecification?.chartType || currentSlide.visualSpecification.chartType,
            fullImagePrompt: data.visualSpecification?.fullImagePrompt || currentSlide.visualSpecification.fullImagePrompt
        },
        bodyContent: sanitizeStringArray(data.bodyContent),
        status: 'generating_visual'
    };
};

// --- 7. UPSCALE SLIDE (4K) ---
export const upscaleSlideImage = async (base64Image: string, prompt: string, style: ConsultingStyle, apiKey: string): Promise<string> => {
    const client = getClient(apiKey);
    
    // We STRICTLY use the provided image as the base. We do NOT use the prompt to regenerate from scratch.
    // This is to satisfy the requirement: "只能做upscale 不能有任何的内容格式修改" (Only upscale, no content/format modification).
    const upscaleInstruction = `
    # SYSTEM INSTRUCTION: IMAGE UPSCALER
    Your sole function is to output a higher resolution (4K) version of the input image.

    # STRICT CONSTRAINTS (MANDATORY):
    1. **NO CONTENT CHANGES**: The output must contain EXACTLY the same text, EXACTLY the same layout, and EXACTLY the same data visualization. Do not rewrite text. Do not move objects.
    2. **FIDELITY**: Preserve the original font styles, color palette (#hex codes), and logos.
    3. **ENHANCEMENT ONLY**: Only improve sharpness, remove compression artifacts, and increase resolution.
    4. **NO HALLUCINATIONS**: Do not add new details that are not present in the source. 
    
    If the text is readable, keep it identical. If text is blurry, infer the characters based on visual shape but do not change the meaning or words.
    `;

    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-image-preview', 
                contents: {
                    parts: [
                        // The image to upscale
                        { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] } },
                        // The instruction to only upscale
                        { text: upscaleInstruction }
                    ]
                },
                config: {
                    imageConfig: {
                         aspectRatio: '16:9',
                         imageSize: '4K'
                    }
                }
            }),
            90000, "Upscale Slide Image"
        ),
        1, "Upscale Slide Image"
    );

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    
    throw new Error("No upscaled image returned from Gemini.");
};

// --- 8. MODIFY SLIDE IMAGE (EDIT) ---
export const modifySlideImage = async (base64Image: string, instruction: string, style: ConsultingStyle, apiKey: string): Promise<string> => {
    const client = getClient(apiKey);
    
    // CRITICAL FIX: DO NOT load getSystemPrompts(style) here.
    // Loading the system "creation" prompt pollutes the context and causes the model to "redraw" the slide 
    // (often re-adding elements you wanted to remove) instead of "editing" it.
    
    const finalPrompt = `
    # ROLE: Expert Image Retoucher & Editor
    # TASK: Edit the provided presentation slide image strictly according to the user instruction.
    # INSTRUCTION: "${instruction}"
    
    # CONSTRAINTS:
    1. DO NOT regenerate the slide concept. 
    2. RETAIN the original layout, text, charts, and data exactly as they are, unless the instruction specifically asks to change them.
    3. If asked to remove an element (e.g. logo, text, footer), fill the gap seamlessly with the background color (White #FFFFFF).
    4. Perform a pixel-perfect edit. High fidelity. 
    `;

    // To use image input for editing, we pass it in contents
    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-image-preview', // Edit supported model
                contents: {
                    parts: [
                        { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] } },
                        { text: finalPrompt }
                    ]
                },
                config: {
                    imageConfig: { aspectRatio: '16:9' } // Note: imageSize might be restricted in edit mode depending on API
                }
            }),
            60000, "Modify Slide Image"
        ),
        1, "Modify Slide Image"
    );

    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No edited image returned.");
};