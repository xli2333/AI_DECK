import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { getSystemPrompts } from "../constants";
import { SlideData, OutlineItem, SlideType, ConsultingStyle, MasterStyleConfig } from "../types";

const getClient = (apiKey: string) => {
  // STRICT VALIDATION: Ensure only explicit, valid keys are used.
  // SANITIZATION: Remove accidental newlines, spaces, or quotes from copy-pasting.
  const cleanKey = apiKey ? apiKey.replace(/[\s"']/g, '') : "";

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
        console.error(`[Gemini Error] ${label} failed:`, error);
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


// --- 9. GET LAYOUT RECOMMENDATIONS (SMART LAYOUT) ---
export const getLayoutRecommendations = async (
    slideTitle: string,
    slideSummary: string,
    slideKeyPoints: string[],
    style: ConsultingStyle, 
    apiKey: string
): Promise<any[]> => {
    const client = getClient(apiKey);
    
    // 1. Load the Style Index
    let indexFile = "";
    if (style === 'bcg') indexFile = 'Prompts/BCG Prompts/BCG_Instruction_Index.md';
    else if (style === 'mckinsey') indexFile = 'Prompts/McKinsey Prompts/McKinsey_Prompt_Index.md';
    else if (style === 'bain') indexFile = 'Prompts/Bain Prompts/Bain_Instruction_Index.md';
    else if (style === 'internet') indexFile = 'Prompts/Internet Prompts/Internet_Prompts_Index.md';
    
    let indexContent = "No specific index available. Recommend generic charts.";
    if (indexFile) {
        try {
            indexContent = await fetchLocalPrompt(indexFile);
            console.log(`[Smart Layout] Loaded Index File: ${indexFile} (Length: ${indexContent.length} chars)`);
        } catch (e) {
            console.warn("Could not load index file for recommendations:", e);
        }
    }

    const prompt = `
    # ROLE: ${style.toUpperCase()} Presentation Expert & Layout Specialist
    # TASK: Recommend the best 3 layout templates for a specific slide.
    
    # INPUT SLIDE CONTENT:
    **Title:** "${slideTitle}"
    **Summary:** "${slideSummary}"
    **Key Points:**
    ${slideKeyPoints.map(p => `- ${p}`).join('\n')}

    # AVAILABLE LAYOUT INDEX (SOURCE OF TRUTH):
    ${indexContent}

    # INSTRUCTION:
    Analyze the "Input Slide Content". 
    Is it a comparison? A process? A list? A data chart?
    Select the **top 6** most appropriate layouts from the "Available Layout Index".
    
    # OUTPUT FORMAT (JSON ARRAY ONLY):
    Return a valid JSON array of objects.
    [
      {
        "id": "unique_id_1",
        "name": "Name of the Layout (e.g., Vertical Bar Chart)",
        "description": "Brief description of what this layout shows.",
        "reason": "Why this fits the content (e.g., 'Because you are comparing 3 distinct regions...')",
        "layoutFilePath": "The EXACT file path from the index (e.g., Prompts/Bain Prompts/...)"
      },
      ...
    ]
    `;

    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            }),
            90000, "Get Layout Recommendations"
        ),
        1, "Get Layout Recommendations"
    );

    const jsonStr = extractJson(response.text || "[]");
    return JSON.parse(jsonStr);
};

// --- HELPER: Fetch Local Prompt File ---
const fetchLocalPrompt = async (filePath: string): Promise<string> => {
    try {
        // --- PATH MAPPING LOGIC (Robustness for BCG, McKinsey, Bain) ---
        let finalPath = filePath;
        
        // 1. Normalize slashes first
        finalPath = finalPath.replace(/\\/g, '/');

        // 2. Robust Prefix Handling (Regex for Precision)
        
        // BCG Logic
        if (/^BCG Prompts/i.test(finalPath)) {
             if (!finalPath.startsWith('Prompts/')) finalPath = 'Prompts/' + finalPath;
        } else if (/^BCG Prompt/i.test(finalPath)) {
             finalPath = finalPath.replace(/^BCG Prompt/i, 'Prompts/BCG Prompts');
        }

        // McKinsey Logic
        else if (/^McKinsey Prompts/i.test(finalPath)) {
             if (!finalPath.startsWith('Prompts/')) finalPath = 'Prompts/' + finalPath;
        } else if (/^McKinsey Prompt/i.test(finalPath)) {
             finalPath = finalPath.replace(/^McKinsey Prompt/i, 'Prompts/McKinsey Prompts');
        }

        // Bain Logic
        else if (/^Bain Prompts/i.test(finalPath)) {
             if (!finalPath.startsWith('Prompts/')) finalPath = 'Prompts/' + finalPath;
        } else if (/^Bain Prompt/i.test(finalPath)) {
             finalPath = finalPath.replace(/^Bain Prompt/i, 'Prompts/Bain Prompts');
        }

        // Internet Style Logic
        else if (/^Internet Prompts/i.test(finalPath)) {
             if (!finalPath.startsWith('Prompts/')) finalPath = 'Prompts/' + finalPath;
        }

        // --- SPECIAL CASE: Bain Index Path Redirection ---
        // Bain index often points to "Prompts/Data Charts/..." missing the "Bain Prompts" subfolder.
        const bainCategories = ['Data Charts', 'Conceptual Layouts', 'Text and Structure'];
        for (const cat of bainCategories) {
            if (finalPath.startsWith(`Prompts/${cat}`)) {
                finalPath = finalPath.replace(`Prompts/${cat}`, `Prompts/Bain Prompts/${cat}`);
                break;
            }
        }

        // --- SPECIAL CASE: Internet Index Path Redirection ---
        // Internet index uses relative paths starting with Chinese category names
        const internetCategories = [
            '对比与关系图解', '封面与目录结构', '流程计划与执行', 
            '数据看板与图表', '战略与商业模型', '组织与人员介绍'
        ];
        for (const cat of internetCategories) {
            // Case 1: Starts with category directly (from Index)
            if (finalPath.startsWith(cat)) {
                finalPath = `Prompts/Internet Prompts/${finalPath}`;
                break;
            }
            // Case 2: Starts with Prompts/Category (User typo?)
            if (finalPath.startsWith(`Prompts/${cat}`)) {
                finalPath = finalPath.replace(`Prompts/${cat}`, `Prompts/Internet Prompts/${cat}`);
                break;
            }
        }

        // 3. Normalize slashes again (in case of replacements)
        finalPath = finalPath.replace(/\\/g, '/');

        console.log(`[Gemini] Requesting prompt file: ${finalPath} (Original: ${filePath})`);
        
        const response = await fetch('/api/read-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: finalPath })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Gemini] Backend Error (${response.status}): ${errText}`);
            // THROW ERROR to make it visible in the UI
            throw new Error(`Failed to load Layout File: ${filePath}. Status: ${response.status}. Ensure backend is running (npm run dev:all).`);
        }
        
        const data = await response.json();
        return data.content || "";
    } catch (e) {
        console.error(`[Gemini] Network/System Error reading prompt: ${filePath}`, e);
        // Re-throw to ensure the process stops and alerts the user
        throw e;
    }
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

    // DYNAMIC INSTRUCTION LOADING (BCG, McKinsey, Bain)
    let dynamicContext = "";
    let indexFile = "";
    
    if (style === 'bcg') indexFile = 'Prompts/BCG Prompts/BCG_Instruction_Index.md';
    else if (style === 'mckinsey') indexFile = 'Prompts/McKinsey Prompts/McKinsey_Prompt_Index.md';
    else if (style === 'bain') indexFile = 'Prompts/Bain Prompts/Bain_Instruction_Index.md';
    else if (style === 'internet') indexFile = 'Prompts/Internet Prompts/Internet_Prompts_Index.md';

    if (indexFile) {
        const indexContent = await fetchLocalPrompt(indexFile);
        if (indexContent) {
            dynamicContext = `
            # ${style.toUpperCase()} LAYOUT INDEX (MANDATORY REFERENCE)
            You are a ${style.toUpperCase()} Engagement Manager. You MUST select a specific Layout File for EVERY slide you generate.
            Use the following index to find the best matching layout for the content:
            
            ${indexContent}
            
            # REQUIREMENT:
            In your JSON output, for every slide, you MUST add a field "layoutFilePath".
            The value must be the full relative path based on the index (e.g., "Prompts/${style} Prompts/...").
            If you are unsure, pick the closest fit from the "General" or "Structure" sections.
            `;
        }
    }

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

    ${dynamicContext}
    
    # MANDATORY STRUCTURE RULE (MASTER STYLE):
    The FIRST SLIDE (Index 0) of the JSON output MUST BE a special slide.
    - Title: "Master Style Guide"
    - Executive Summary: "Defining the visual system for ${style.toUpperCase()} style."
    - Suggested Slide Type: "Master Style Guide"
    - Key Points: ["Define Typography", "Define Palette", "Define Spacing"]
    
    This is REQUIRED. The rest of the slides follow the storyboard.

    # TASK
    1. Deeply analyze the provided Input Data & Files.
    2. Extract the strategic narrative that aligns with the User Mandate.
    3. Create a logical, persuasive storyboard (start with the Master Style Guide, then 5-10 content slides) in ${style.toUpperCase()} style.
    ${indexFile ? "4. CRITICAL: Select a 'layoutFilePath' for every slide from the provided Index." : ""}
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
        keyPoints: sanitizeStringArray(item.keyPoints),
        layoutFilePath: item.layoutFilePath // Capture the dynamically selected layout path
    }));
};

// --- NEW: MASTER STYLE GENERATOR ---
const generateMasterStyleSlide = async (
    input: AnalysisInput,
    outlineItem: OutlineItem,
    style: ConsultingStyle,
    apiKey: string
): Promise<SlideData> => {
    const client = getClient(apiKey);
    
    const prompt = `
    # ROLE: Design System Architect
    # TASK: Define the MASTER VISUAL STYLE for a ${style.toUpperCase()} consulting deck.
    
    # CONTEXT:
    The user wants a consistent design system. You must define the exact fonts, sizes, and colors that will be used for ALL subsequent slides.
    
    # CRITICAL: FONT SELECTION RULES (IGNORE BROWSER COMPATIBILITY)
    The final output is an IMAGE generated by an AI (NanoBanana), NOT a website. 
    **We do NOT care if the user has the font installed.** We care about the **Visual Authenticity**.
    
    1. **Do NOT default to "Arial" or "Microsoft YaHei".** These look cheap/amateur.
    2. **Select the ACTUAL professional fonts** associated with the style:
       - **McKinsey**: Serif for Titles (*Georgia, Garamond*), Sans for Body (*Calibri, Arial*). CN: *Songti SC* (Serif) or *PingFang SC* (Sans).
       - **BCG**: Strong Sans-Serif (*Verdana, Trebuchet MS*). CN: *PingFang SC* or *Source Han Sans*.
       - **Bain**: Clean Sans-Serif (*Lato, Helvetica*). CN: *HarmonyOS Sans* or *PingFang SC*.
       - **Internet/Tech**: Modern Geometric (*Inter, Roboto, SF Pro*). CN: *PingFang SC* (The Gold Standard), *HarmonyOS Sans*, or *Lantinghei*.
    
    # REQUIREMENTS:
    1. **Background**: MUST be White (#FFFFFF) unless the user explicitly requested Dark Mode in the input text: "${input.text || ''}".
    2. **Palette**: Create a sophisticated color palette suitable for ${style}.
    3. **Typography**: Define a hierarchy (Title, Subtitle, Body Levels).
    
    # OUTPUT FORMAT (JSON ONLY):
    {
      "masterStyle": {
        "themeReference": "${style}",
        "backgroundColor": "#FFFFFF",
        "colorPalette": {
           "primary": "#HEX",
           "secondary": "#HEX",
           "accent": ["#HEX", "#HEX"],
           "chartColors": ["#HEX", "#HEX", "#HEX", "#HEX", "#HEX"]
        },
        "typography": {
           "title": { "fontFamily": "[Insert Authentic Font Name]", "fontFamilyChinese": "[Insert Professional CN Font]", "fontSize": 24, "color": "#000000" },
           "subtitle": { "fontFamily": "[Insert Authentic Font Name]", "fontFamilyChinese": "[Insert Professional CN Font]", "fontSize": 18, "color": "#666666" },
           "sectionHeader": { "fontFamily": "[Insert Authentic Font Name]", "fontFamilyChinese": "[Insert Professional CN Font]", "fontSize": 14, "color": "#000000", "fontWeight": "bold" },
           "bodyL1": { "fontFamily": "[Insert Authentic Font Name]", "fontFamilyChinese": "[Insert Professional CN Font]", "fontSize": 12, "color": "#333333" },
           "bodyL2": { "fontFamily": "[Insert Authentic Font Name]", "fontFamilyChinese": "[Insert Professional CN Font]", "fontSize": 10, "color": "#555555" },
           "bodyL3": { "fontFamily": "[Insert Authentic Font Name]", "fontFamilyChinese": "[Insert Professional CN Font]", "fontSize": 9, "color": "#777777" }
        }
      },
      "actionTitle": "Design System Specification",
      "visualSpecification": {
         "fullImagePrompt": "A clean, minimalist style guide sheet showing color swatches and typography hierarchy on a white background. High resolution, professional."
      },
      "bodyContent": [
         "This slide defines the visual rules for the deck.",
         "Primary Color: [Insert Primary Color Name]",
         "English Font: [Insert Font Name]",
         "Chinese Font: [Insert Font Name]"
      ]
    }
    `;

    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: 'application/json' }
            }),
            30000, "Generate Master Style"
        ),
        2, "Generate Master Style"
    );

    const jsonStr = extractJson(response.text || "{}");
    const data = JSON.parse(jsonStr);

    return {
        id: outlineItem.id,
        slideType: SlideType.MasterStyleGuide,
        actionTitle: data.actionTitle || "Master Style Guide",
        subtitle: "Visual System Definition",
        visualSpecification: {
            chartType: "Style Guide",
            axesVariables: "",
            keyInsight: "Consistent Visual Identity",
            annotation: "",
            fullImagePrompt: data.visualSpecification?.fullImagePrompt || "Style Guide"
        },
        bodyContent: sanitizeStringArray(data.bodyContent),
        footer: { source: "System", disclaimer: "Internal Use" },
        masterStyle: data.masterStyle,
        status: 'generating_visual'
    };
};

// --- 2. GENERATE SLIDE CONTENT (GEMINI 3 PRO - BRAIN) ---
export const generateSlideContent = async (
    input: AnalysisInput, 
    outlineItem: OutlineItem, 
    previousSlides: {title: string, summary: string}[],
    style: ConsultingStyle, 
    apiKey: string,
    globalInstructions?: string,
    customPrompts?: { core: string, visual: string },
    masterStyleConfig?: MasterStyleConfig // NEW: Pass the Master Style
): Promise<SlideData> => {
    // --- NEW: MASTER STYLE INTERCEPT ---
    if (outlineItem.suggestedSlideType === SlideType.MasterStyleGuide || outlineItem.title === "Master Style Guide") {
        return generateMasterStyleSlide(input, outlineItem, style, apiKey);
    }

    const client = getClient(apiKey);
    let { constructionPrompt } = getSystemPrompts(style, customPrompts);

    // --- NEW: INJECT MASTER STYLE ---
    if (masterStyleConfig) {
        constructionPrompt += `
        
        # MASTER VISUAL STYLE ENFORCEMENT (MANDATORY):
        You MUST adhere to the Master Style defined in Slide 1:
        - **Fonts (EN)**: Title="${masterStyleConfig.typography.title.fontFamily}", Body="${masterStyleConfig.typography.bodyL1.fontFamily}"
        - **Fonts (CN)**: Title="${masterStyleConfig.typography.title.fontFamilyChinese || 'Microsoft YaHei'}", Body="${masterStyleConfig.typography.bodyL1.fontFamilyChinese || 'Microsoft YaHei'}"
        - **Colors**: Primary="${masterStyleConfig.colorPalette.primary}", Background="${masterStyleConfig.backgroundColor}"
        - **Sizing**: Title Size=${masterStyleConfig.typography.title.fontSize}, Body Size=${masterStyleConfig.typography.bodyL1.fontSize}
        
        When defining "layoutElements", use these EXACT hex codes and similar relative font sizes.
        `;
    }

    // --- NEW: DYNAMIC LAYOUT LOADING ---
    if (outlineItem.layoutFilePath) {
        const specificLayoutInstructions = await fetchLocalPrompt(outlineItem.layoutFilePath);
        if (specificLayoutInstructions) {
            console.log(`[Gemini] Loaded specific layout for slide: ${outlineItem.layoutFilePath}`);
            // We append the specific instructions to the core prompt.
            // The specific instructions usually contain detailed "Visual Specification" rules.
            constructionPrompt += `
            
            # SPECIFIC LAYOUT INSTRUCTIONS (OVERRIDE DEFAULT):
            The user has selected a SPECIFIC LAYOUT for this slide. You MUST follow these rules exactly:
            
            ${specificLayoutInstructions}
            
            # MANDATE:
            1. Use the "Action Title" format defined above if applicable.
            2. Structure the "visualSpecification.fullImagePrompt" to match the description in the layout file.
            3. Adopt the layout structure (columns, matrices) described.
            `;
        }
    }

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

    # ADVANCED LAYOUT ENGINE (MANDATORY)
    You are now acting as a World-Class Layout Designer.
    Instead of just listing content, you must spatially arrange it on a 16:9 canvas (100% width x 100% height).
    
    # CRITICAL: POPULATE THE "layoutElements" ARRAY
    You MUST populate the "layoutElements" array in the JSON response.
    
    ## Layout Rules:
    1. **Diversity**: Do not use the same layout twice in a row. Use Split (50/50), Quadrant (2x2), Three-Column, Overlay, or Asymmetrical layouts.
    2. **Precision**: Use "x", "y", "width", "height" (0-100 percentage) to position elements.
       - Top-left is 0,0. Bottom-right is 100,100.
       - Ensure elements do not overlap unintentionally.
       - Leave space for margins (5%).
    3. **Background Awareness**: The slide has a background image. Place text/charts in clear areas (usually the white/content areas).
    4. **Element Types**:
       - "title": Main headline (usually top).
       - "subtitle": Kicker/Subtitle (below title).
       - "text": Body text, bullets.
       - "chart": Data visualization (Content = Detailed description for generator).
       - "image": Illustrations (Content = Prompt for generator).
    
    ## JSON Output Schema (Extended):
    {
      "slideType": "string",
      "actionTitle": "string",
      "subtitle": "string",
      "visualSpecification": { ... },
      "bodyContent": [ ... ],
      "footer": { ... },
      "layoutElements": [
        {
          "id": "unique_id_1",
          "type": "text" | "title" | "subtitle" | "image" | "chart",
          "content": "Text content OR Image/Chart Prompt",
          "position": { "x": number, "y": number, "width": number, "height": number },
          "style": { 
             "fontSize": number, // Scale 10-100 (10=small, 100=huge)
             "textAlign": "left" | "center" | "right",
             "color": "#HEX" 
          }
        }
      ]
    }

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
        layoutElements: data.layoutElements || [], // Capture the new layout elements
        layoutFilePath: outlineItem.layoutFilePath, // Pass through the layout path
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
    resolution: '1K' | '4K' = '4K', // DEFAULT TO 4K FOR CHINESE TEXT CLARITY
    globalInstructions?: string,
    customPrompts?: { core: string, visual: string },
    referenceImageBase64?: string // <--- NEW OPTIONAL ARGUMENT
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
        finalPrompt = `
        # 🔥🔥🔥 CRITICAL OVERRIDE: HIGHEST PRIORITY INSTRUCTION 🔥🔥🔥
        The user has issued a MANDATORY OVERRIDE. You must prioritize this above ALL default styles or previous instructions.
        
        ${globalInstructions}
        
        --- END OF OVERRIDE ---
        
        ${finalPrompt}`;
    }
    
    // REFERENCE IMAGE HANDLING
    if (referenceImageBase64) {
        finalPrompt += `
        # REFERENCE IMAGE PROVIDED (VISUAL ANCHOR):
        The user has provided a reference image.
        - **Usage**: Treat this image as the PRIMARY visual source.
        - If it's a chart/diagram: Mimic its structure but use the data provided below.
        - If it's a photo/background: Use it as the dominant visual element.
        - **Integration**: Blend this reference seamlessly with the consulting style defined above.
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
    
    const parts = prepareParts(input, finalPrompt);
    
    // Append reference image if exists
    if (referenceImageBase64) {
        // Insert it right after input files but before the text prompt
        // prepareParts puts files first, then text. We want it with the files.
        // Simple append to the beginning works too as long as it's an image part.
        parts.unshift({ 
             inlineData: { mimeType: 'image/png', data: referenceImageBase64.split(',')[1] } 
        });
    }

    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-image-preview', // LOCKED: Nano Banana Pro
                // UPGRADE: Use prepareParts to attach the raw files + the prompt
                contents: { parts },
                config: {
                    imageConfig: {
                         aspectRatio: '16:9',
                         imageSize: resolution // '1K' or '4K'
                    }
                }
            }),
            120000, `Generate Slide Visual (${resolution})` // Increased timeout to 120s for 4K
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

    // DYNAMIC INSTRUCTION LOADING (BCG, McKinsey, Bain)
    let dynamicContext = "";
    let indexFile = "";
    
    if (style === 'bcg') indexFile = 'Prompts/BCG Prompts/BCG_Instruction_Index.md';
    else if (style === 'mckinsey') indexFile = 'Prompts/McKinsey Prompts/McKinsey_Prompt_Index.md';
    else if (style === 'bain') indexFile = 'Prompts/Bain Prompts/Bain_Instruction_Index.md';
    else if (style === 'internet') indexFile = 'Prompts/Internet Prompts/Internet_Prompts_Index.md';

    if (indexFile) {
        const indexContent = await fetchLocalPrompt(indexFile);
        if (indexContent) {
            dynamicContext = `
            # ${style.toUpperCase()} LAYOUT INDEX (MANDATORY REFERENCE)
            When adding or modifying slides, you MUST select a specific Layout File for the new/modified slide.
            
            ${indexContent}
            
            # REQUIREMENT:
            In your JSON output, ensure every slide (especially new ones) has a "layoutFilePath".
            `;
        }
    }

    const historyText = history.length > 0 
        ? history.map((h, i) => `Step ${i+1}: ${h}`).join('\n')
        : "No previous modifications.";

    const prompt = `
    ${outlineRefinePrompt}
    
    ${dynamicContext}

    # CURRENT OUTLINE:
    ${JSON.stringify(currentOutline.map(o => ({ title: o.title, summary: o.executiveSummary, layoutFilePath: o.layoutFilePath })))} 

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
        keyPoints: sanitizeStringArray(item.keyPoints),
        layoutFilePath: item.layoutFilePath || currentOutline[idx]?.layoutFilePath // Preserve or update layout
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
    apiKey: string,
    customPrompts?: { core: string, visual: string }
): Promise<SlideData> => {
    const client = getClient(apiKey);
    let { constructionPrompt } = getSystemPrompts(style, customPrompts);

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
export const modifySlideImage = async (
    base64Image: string, 
    instruction: string, 
    style: ConsultingStyle, 
    apiKey: string,
    referenceImageBase64?: string // <--- NEW OPTIONAL ARGUMENT
): Promise<string> => {
    const client = getClient(apiKey);
    
    let finalPrompt = `
    # ROLE: Expert Image Retoucher & Editor
    # TASK: Edit the provided presentation slide image strictly according to the user instruction.
    # INSTRUCTION: "${instruction}"
    
    # CRITICAL PRIORITY: TEXT & STRUCTURE INTEGRITY
    1. **NO DISTORTION**: Existing text, numbers, and charts must remain **SHARP** and **READABLE**. Do not blur or warp them.
    2. **4K OUTPUT**: You are generating a high-resolution 4K image. Details must be crisp.
    3. **MINIMAL INTERVENTION**: Only change what is asked. Freeze the rest of the pixels.
    `;

    // Dynamic prompt addition for reference image
    if (referenceImageBase64) {
        finalPrompt += `
        # REFERENCE IMAGE PROVIDED:
        The user has uploaded a second image (Reference Material).
        - If the instruction is "replace background", use this reference image as the new background canvas, overlaying existing text/charts on top.
        - If the instruction is "insert image" or "replace logo", use this reference image as the source object.
        - **Integrate it naturally** into the scene.
        `;
    }
    
    finalPrompt += `
    # CONSTRAINTS:
    1. DO NOT regenerate the slide concept. 
    2. RETAIN the original layout, text, charts, and data exactly as they are, unless the instruction specifically asks to change them.
    3. If asked to remove an element (e.g. logo, text, footer), fill the gap seamlessly with the surrounding background.
    4. Perform a pixel-perfect edit. High fidelity. 
    `;

    // Construct Parts
    const parts: any[] = [
        { inlineData: { mimeType: 'image/png', data: base64Image.split(',')[1] } },
        { text: finalPrompt }
    ];

    // Append reference image if exists
    if (referenceImageBase64) {
        parts.splice(1, 0, { // Insert before text
             inlineData: { mimeType: 'image/png', data: referenceImageBase64.split(',')[1] } 
        });
    }

    // To use image input for editing, we pass it in contents
    const response: GenerateContentResponse = await callWithRetry(
        () => withTimeout(
            client.models.generateContent({
                model: 'gemini-3-pro-image-preview', // Edit supported model
                contents: { parts },
                config: {
                    imageConfig: { 
                        aspectRatio: '16:9',
                        imageSize: '4K' // FORCE 4K
                    } 
                }
            }),
            90000, "Modify Slide Image" // Increased timeout for 4K
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
