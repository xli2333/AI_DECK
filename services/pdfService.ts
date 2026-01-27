
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const extractImagesFromPdf = async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const images: string[] = [];
    const scale = 2.0; // Render at 2x scale for better initial quality

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        
        // Calculate dimensions
        const viewport = page.getViewport({ scale });
        
        // Create a canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
            throw new Error("Could not create canvas context");
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page into canvas context
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Convert to base64
        images.push(canvas.toDataURL('image/png'));
    }

    return images;
};
