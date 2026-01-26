import { SlideElement } from "../types";

// Helper to convert Base64 to Blob
const base64ToBlob = (base64: string, mimeType: string = 'image/png'): Blob => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
};

export const extractTextLayout = async (base64Image: string, apiKey: string): Promise<SlideElement[]> => {
  // NOTE: apiKey param is kept for signature compatibility but NOT used for Aliyun (handled by server.js)
  
  console.log("Calling Local OCR Proxy (Aliyun)...");

  try {
    const blob = base64ToBlob(base64Image);
    const formData = new FormData();
    formData.append('file', blob, 'slide.png');

    // Call local Node.js server (Proxied via Vercel in production)
    const response = await fetch('/api/ocr', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server Error ${response.status}`);
    }

    const data = await response.json();
    console.log(`OCR Success: Found ${data.elements?.length || 0} elements.`);
    return data.elements || [];

  } catch (e: any) {
    console.error("OCR Service Failed:", e);
    throw new Error(`OCR Service Failed: ${e.message}`);
  }
};
