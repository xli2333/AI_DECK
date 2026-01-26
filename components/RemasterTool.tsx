import React, { useState } from 'react';
import { Upload, Loader2, FileCheck, Download, AlertCircle, Sparkles, Wand2, X, FileText } from 'lucide-react';
import { removePrintedText } from '../services/nanobananaService';
import { extractTextLayout } from '../services/ocrService';
import { generatePptx } from '../services/pptGenService';
import { extractImagesFromPdf } from '../services/pdfService';
import { RemasteredSlideData, SlideElement } from '../types';

interface RemasterToolProps {
  apiKey: string;
}

const RemasterTool: React.FC<RemasterToolProps> = ({ apiKey }) => {
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [currentAction, setCurrentAction] = useState<string>(''); // Detailed status like "Cleaning background..."
  const [results, setResults] = useState<RemasteredSlideData[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    // Reset input value to allow re-uploading the same file if needed
    e.target.value = '';

    if (uploadedFile.type !== 'application/pdf') {
        alert("Please upload a PDF file.");
        return;
    }

    setFile({ name: uploadedFile.name, size: uploadedFile.size });
    setSlideImages([]); // Clear previous images immediately
    setStatus('processing');
    setCurrentAction('Extracting pages from PDF...');
    
    try {
        const images = await extractImagesFromPdf(uploadedFile);
        setSlideImages(images);
        setStatus('idle');
        setProgress({ current: 0, total: images.length });
    } catch (e) {
        console.error(e);
        setStatus('error');
        setErrorMsg("Failed to parse PDF. Please try another file.");
    }
  };

  // Helper: Delay function to prevent rate limiting
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const startRemastering = async () => {
    if (slideImages.length === 0 || !apiKey) return;

    setStatus('processing');
    setResults([]);
    setErrorMsg('');

    const processedSlides: RemasteredSlideData[] = [];

    try {
      for (let i = 0; i < slideImages.length; i++) {
        const base64 = slideImages[i];
        
        // RATE LIMIT PROTECTION: Wait 2 seconds between slides
        if (i > 0) await delay(2000); 

        setProgress({ current: i + 1, total: slideImages.length });
        
        // Phase 1: OCR (Analyze Text FIRST)
        setCurrentAction(`Slide ${i + 1}/${slideImages.length}: Analysis & OCR (Aliyun)...`);
        const elements = await extractTextLayout(base64, apiKey);
        
        // Extract plain text list for Nanobanana "Kill List"
        const detectedTextList = elements.map(e => e.content).filter(t => t.trim().length > 0);
        console.log(`[Slide ${i+1}] OCR found ${detectedTextList.length} text items.`);

        // Phase 2: Nanobanana (Remove Text using Kill List)
        setCurrentAction(`Slide ${i + 1}/${slideImages.length}: AI Removing Text (Nanobanana)...`);
        
        let cleanBg = base64; 
        let attempts = 0;
        let success = false;
        
        while(attempts < 3 && !success) {
            try {
                attempts++;
                // Pass the FULL elements array (with coordinates) to Nanobanana
                cleanBg = await removePrintedText(base64, apiKey, elements);
                success = true;
            } catch (nbError: any) {
                console.error(`Slide ${i+1} Nanobanana Attempt ${attempts} Failed:`, nbError);
                if (attempts >= 3) {
                     throw new Error(`[Phase 2: Nanobanana Failed after 3 attempts] ${nbError.message}`);
                }
                await delay(2000); // Wait before retry
            }
        }

        processedSlides.push({
          originalImage: base64,
          cleanBackground: cleanBg,
          elements: elements
        });
        
        // Update intermediate results if we wanted to show previews, 
        // but for now we just collect them.
      }

      setResults(processedSlides);
      setStatus('done');
      setCurrentAction('All slides remastered successfully.');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMsg('Error during processing: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const downloadPpt = async () => {
    if (results.length === 0) return;
    try {
      setCurrentAction('Compiling PPTX file...');
      await generatePptx(results);
      setCurrentAction('Download started.');
    } catch (error) {
      console.error(error);
      alert('Failed to generate PPTX');
    }
  };

  return (
    <div className="bg-white border border-gray-200 p-12 shadow-2xl max-w-4xl w-full mx-auto my-8 relative">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-[#051C2C]"></div>
      
      <div className="flex flex-col items-center text-center mb-12">
        <div className="p-4 bg-gray-100 text-[#163E93] rounded-full mb-4">
          <Wand2 className="w-8 h-8" />
        </div>
        <h2 className="text-4xl font-bold text-[#051C2C] font-serif mb-2">Project Iron</h2>
        <p className="text-gray-500 text-lg max-w-lg">
          PDF to PPTX Remastering. <br/>
          <span className="text-[#163E93] font-medium">Extract pages. Remove artifacts. Rebuild as editable slides.</span>
        </p>
      </div>

      {!file ? (
        <div className="relative border-2 border-dashed border-gray-300 bg-gray-50 hover:border-[#163E93] hover:bg-blue-50/30 transition-all p-16 text-center cursor-pointer group h-64 flex flex-col items-center justify-center">
          <input
            type="file"
            onChange={handleUpload}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            accept="application/pdf"
          />
          <FileText className="w-12 h-12 text-gray-400 group-hover:text-[#163E93] mx-auto mb-4 transition-colors" />
          <p className="text-sm font-bold uppercase tracking-widest text-gray-500 group-hover:text-[#163E93]">
            Upload PDF Document
          </p>
          <p className="text-xs text-gray-400 mt-2">Any size (Processed page by page)</p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between bg-gray-50 p-6 border border-gray-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white border border-gray-200 flex items-center justify-center text-[#163E93]">
                 <FileText className="w-6 h-6" />
              </div>
              <div>
                  <h4 className="text-sm font-bold text-[#051C2C]">{file.name}</h4>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">
                      {slideImages.length > 0 ? `${slideImages.length} Pages Extracted` : 'Parsing PDF...'}
                  </p>
              </div>
            </div>
            {status !== 'processing' && status !== 'done' && (
                <button
                onClick={() => { setFile(null); setSlideImages([]); setStatus('idle'); setResults([]); }}
                className="text-gray-400 hover:text-red-500 transition-colors p-2"
                >
                <X className="w-5 h-5" />
                </button>
            )}
          </div>

          {slideImages.length > 0 && (
            <div className="space-y-6">
                <div className="grid grid-cols-5 gap-2 max-h-32 overflow-hidden relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-8 after:bg-gradient-to-t after:from-white after:to-transparent">
                    {slideImages.slice(0, 10).map((img, idx) => (
                        <div key={idx} className="border border-gray-200 p-1 bg-white">
                            <img src={img} className="w-full h-auto opacity-50" alt={`Page ${idx+1}`} />
                        </div>
                    ))}
                    {slideImages.length > 10 && <div className="flex items-center justify-center text-xs font-bold text-gray-400">+{slideImages.length - 10} more</div>}
                </div>

                {status === 'idle' && (
                    <div className="flex justify-center">
                        <button
                        onClick={startRemastering}
                        className="bg-[#051C2C] hover:bg-[#163E93] text-white px-12 py-4 font-bold uppercase tracking-[0.2em] transition-all shadow-lg hover:shadow-xl flex items-center gap-3"
                        >
                        <Sparkles className="w-5 h-5" />
                        <span>Start Batch Processing ({slideImages.length} Slides)</span>
                        </button>
                    </div>
                )}
            </div>
          )}

          {status === 'processing' && (
            <div className="bg-blue-50 border border-blue-100 p-8 flex flex-col items-center gap-6 text-center">
              <div className="w-full max-w-md bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#163E93] transition-all duration-500 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
              </div>
              <div className="flex items-center gap-3">
                   <Loader2 className="w-5 h-5 text-[#163E93] animate-spin" />
                   <p className="text-sm font-bold text-[#051C2C]">{currentAction}</p>
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-widest">
                  Processing Page {progress.current} of {progress.total}
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 p-6 flex items-center gap-4">
                <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><FileCheck className="w-6 h-6" /></div>
                <div>
                    <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Batch Reconstruction Complete</h3>
                    <p className="text-xs text-emerald-600 mt-1">Processed {results.length} slides successfully.</p>
                </div>
              </div>
              
              <button
                onClick={downloadPpt}
                className="w-full bg-[#051C2C] hover:bg-[#163E93] text-white py-5 font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-lg"
              >
                <Download className="w-5 h-5" />
                Download Full PPTX
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-50 border border-red-100 p-6 flex items-center gap-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <div className="flex-1">
                  <h3 className="text-sm font-bold text-red-800 uppercase tracking-wider">Processing Error</h3>
                  <p className="text-xs text-red-600 mt-1">{errorMsg}</p>
              </div>
              <button
                onClick={startRemastering}
                className="text-xs font-bold underline text-red-700 hover:text-red-900"
              >
                Retry Batch
              </button>
            </div>
          )}
        </div>
      )}

      <div className="mt-12 pt-6 border-t border-gray-100 flex justify-between items-center opacity-40 hover:opacity-100 transition-opacity">
        <span className="text-[9px] uppercase tracking-widest text-gray-400">Powered by Gemini 3.0 Pro Vision</span>
        <div className="flex gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
        </div>
      </div>
    </div>
  );
};

export default RemasterTool;