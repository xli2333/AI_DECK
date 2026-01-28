import React, { useState, useEffect, useRef } from 'react';
import { SlideData, GenerationState, OutlineItem, ConsultingStyle, SlideType, MasterStyleConfig, LayoutRecommendation } from './types';
import { 
    generateOutline, 
    generateSlideContent, 
    generateSlideVisual, 
    refineOutline, 
    refineSpecificSlide, 
    regenerateFinalSlide, 
    upscaleSlideImage,
    modifySlideImage,
    extractCustomStyle,
    getLayoutRecommendations,
    AnalysisInput 
} from './services/geminiService';
import { extractImagesFromPdf } from './services/pdfService';
import SlideView from './components/SlideView';
import RemasterTool from './components/RemasterTool';
import { jsPDF } from "jspdf";

import { 
  Upload, FileText, ChevronRight, Play, Layout, Download, Wand2, CheckCircle, Loader2, File, ArrowRight, Trash2, RefreshCw, Briefcase, MessageSquare, Send, Check, X, Sparkles, CornerDownLeft, Edit3, Layers, Clock, Palette, Key, Monitor, Paintbrush, Sliders, Image as ImageIcon, AlertTriangle, Command, Target, PauseCircle, PlayCircle, RotateCcw, History, Pause, Coffee, AlertCircle, PenTool, GraduationCap, LayoutDashboard
} from 'lucide-react';

type AnalysisSubTask = {
    id: string;
    label: string;
    status: 'waiting' | 'processing' | 'done' | 'error';
};

const App: React.FC = () => {
  // --- State ---
  const [view, setView] = useState<'landing' | 'style-selection' | 'analyzing' | 'workspace' | 'remaster'>('landing');

  const [apiKey, setApiKey] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'file'>('file');
  const [textContent, setTextContent] = useState('');
  const [deckPurpose, setDeckPurpose] = useState('');
  const [filesData, setFilesData] = useState<{ name: string; base64: string; mimeType: string; size: number }[]>([]);
  const [consultingStyle, setConsultingStyle] = useState<ConsultingStyle>('mckinsey');
  
  // Custom Style State
  const [showCustomStyleModal, setShowCustomStyleModal] = useState(false);
  const [customStyleDescription, setCustomStyleDescription] = useState('');
  const [customStyleFile, setCustomStyleFile] = useState<{ base64: string, mimeType: string } | null>(null);
  const [customStylePrompts, setCustomStylePrompts] = useState<{ core: string, visual: string } | undefined>(undefined);
  const [isExtractingStyle, setIsExtractingStyle] = useState(false);

  const [status, setStatus] = useState<GenerationState>({ stage: 'idle' });
  const [isExporting, setIsExporting] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  
  // Global Visual Edit State
  const [showGlobalVisualEditModal, setShowGlobalVisualEditModal] = useState(false);
  const [globalVisualEditInstruction, setGlobalVisualEditInstruction] = useState('');
  const [isGlobalVisualEditing, setIsGlobalVisualEditing] = useState(false);

  const [isImportingDeck, setIsImportingDeck] = useState(false);
  const [isPausing, setIsPausing] = useState(false); 
  
  const [analysisTasks, setAnalysisTasks] = useState<AnalysisSubTask[]>([
      { id: 'upload', label: 'Ingesting Document Source', status: 'waiting' },
      { id: 'connect', label: 'Initializing Gemini 3.0 Pro', status: 'waiting' },
      { id: 'parse', label: 'Deconstructing Strategic Context', status: 'waiting' },
      { id: 'scqa', label: 'Synthesizing SCQA Logic Arc', status: 'waiting' },
      { id: 'draft', label: 'Structuring Ghost Deck', status: 'waiting' },
  ]);

  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [slides, setSlides] = useState<SlideData[]>([]);
  
  // CRITICAL: slidesRef ensures that the async loop always sees the most up-to-date slides state.
  // Without this, the loop acts on a stale closure (empty array) and does nothing.
  const slidesRef = useRef<SlideData[]>([]); 
  
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);
  
  const [globalRefineInput, setGlobalRefineInput] = useState('');
  const [slideRefineInput, setSlideRefineInput] = useState('');
  const [pauseInstruction, setPauseInstruction] = useState(''); // New: Input for pause adjustments
  const [visualRefineImage, setVisualRefineImage] = useState<{ base64: string, mimeType: string } | null>(null); // NEW: Reference Image for Edit
  
  // Smart Layout State
  const [layoutRecommendations, setLayoutRecommendations] = useState<LayoutRecommendation[] | null>(null);
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [isRecommendingLayout, setIsRecommendingLayout] = useState(false);

  const [isRefining, setIsRefining] = useState(false);
  const [isRefiningSlide, setIsRefiningSlide] = useState(false);

  // --- HISTORY STATE ---
  const [outlineHistory, setOutlineHistory] = useState<string[]>([]);
  const [slideHistoryMap, setSlideHistoryMap] = useState<Record<string, string[]>>({});

  // Pre-generation settings
  const [showBuildConfirm, setShowBuildConfirm] = useState(false);
  const [buildInstructions, setBuildInstructions] = useState('');

  // Global Regeneration
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState('');

  // --- Controls ---
  const shouldPauseRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  // --- Helpers ---
  const getMimeType = (file: globalThis.File) => {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'txt') return 'text/plain';
    if (ext === 'md') return 'text/markdown';
    if (ext === 'json') return 'application/json';
    return 'application/octet-stream';
  };

  const isValidApiKey = (key: string) => {
      const clean = (key || '').replace(/["\s'\n\r]/g, '');
      return clean.startsWith('AIza') && clean.length >= 35;
  };

  const updateTaskStatus = (id: string, status: 'waiting' | 'processing' | 'done' | 'error') => {
      setAnalysisTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  // --- HISTORY HELPERS ---
  const updateSlideWithHistory = (
      index: number, 
      newData: Partial<SlideData> | ((prevSlide: SlideData) => Partial<SlideData>),
      forceSnapshot: boolean = false
  ) => {
      setSlides(prevSlides => prevSlides.map((s, i) => {
          if (i !== index) return s;

          const resolvedNewData = typeof newData === 'function' ? newData(s) : newData;
          
          // Determine if we should save history
          const isContentChange = 
            (resolvedNewData.bodyContent && resolvedNewData.bodyContent !== s.bodyContent) || 
            (resolvedNewData.actionTitle && resolvedNewData.actionTitle !== s.actionTitle) || 
            (resolvedNewData.visualSpecification && resolvedNewData.visualSpecification !== s.visualSpecification) || 
            (resolvedNewData.imageBase64 && resolvedNewData.imageBase64 !== s.imageBase64);
          
          let newHistory = s.history;

          if (isContentChange || forceSnapshot) {
              const stableStatus = s.status.startsWith('generating') || s.status === 'upscaling' ? 'complete' : s.status;

              const snapshot: Omit<SlideData, 'history'> = { 
                  ...s, 
                  status: stableStatus,
                  history: undefined 
              };
              
              newHistory = [...(s.history || []).slice(-9), snapshot];
          }

          return {
              ...s,
              ...resolvedNewData,
              history: newHistory
          };
      }));
  };

  // Helper to update a slide in both State and Ref synchronously
  const updateSlideStatus = (index: number, updates: Partial<SlideData>) => {
      setSlides(prev => {
          const newSlides = prev.map((s, i) => i === index ? { ...s, ...updates } : s);
          slidesRef.current = newSlides; // Immediate ref update for the loop
          return newSlides;
      });
  };

  const handleUndoSlide = () => {
      const currentSlide = slides[currentSlideIdx];
      if (!currentSlide.history || currentSlide.history.length === 0) return;
      
      const previousVersion = currentSlide.history[currentSlide.history.length - 1];
      const newHistory = currentSlide.history.slice(0, -1);
      
      setSlides(prev => prev.map((s, i) => 
          i === currentSlideIdx ? { ...previousVersion, history: newHistory } : s
      ));
  };

      const handleRetrySlide = async () => {
          const currentSlide = slides[currentSlideIdx];
          // Logic: If bodyContent is empty, retry whole slide. If bodyContent exists but no image, retry visual.
          
          const needsFullRegen = !currentSlide.bodyContent || currentSlide.bodyContent.length === 0;
  
          // Prepare input for regeneration
          const input: AnalysisInput = {};
          if (filesData.length > 0) input.filesData = filesData.map(f => ({ mimeType: f.mimeType, base64: f.base64 }));
          if (deckPurpose.trim()) input.text = `PURPOSE: ${deckPurpose}\n\n`;
  
          if (needsFullRegen) {
               // Treat as a fresh refinement but without new instructions
               setIsRefiningSlide(true);
               setSlides(prev => prev.map((s, i) => i === currentSlideIdx ? { ...s, status: 'generating_text', currentStep: 'Retrying Analysis...' } : s));
               
               try {
                  const history = slideHistoryMap[currentSlide.id] || [];
                  const updatedSlidePending = await regenerateFinalSlide(input, currentSlide, "Retry generation with same parameters.", history, consultingStyle, apiKey, customStylePrompts);
                  
                  setSlides(prev => prev.map((s, i) => i === currentSlideIdx ? { ...s, ...updatedSlidePending, status: 'generating_visual', currentStep: 'Retrying Visuals...' } : s));
                  
                  // Construct Context for Visual
                  const slideContext = {
                      title: updatedSlidePending.actionTitle,
                      subtitle: updatedSlidePending.subtitle || "",
                      keyPoints: updatedSlidePending.bodyContent
                  };
  
                  const visual = await generateSlideVisual(input, slideContext, updatedSlidePending.visualSpecification.fullImagePrompt, consultingStyle, apiKey, '4K', undefined, customStylePrompts);
  
                  setSlides(prev => prev.map((s, i) => i === currentSlideIdx ? { ...s, imageBase64: visual, status: 'complete', currentStep: undefined, isHighRes: true } : s));
               } catch (e) {
                  alert("Retry failed: " + (e as Error).message);
                  setSlides(prev => prev.map((s, i) => i === currentSlideIdx ? { ...s, status: 'error', subtitle: 'Retry Failed' } : s));
               } finally {
                  setIsRefiningSlide(false);
               }
          } else {
              // Retry only visual
              setSlides(prev => prev.map((s, i) => i === currentSlideIdx ? { ...s, status: 'generating_visual', currentStep: 'Retrying Visuals...' } : s));
              try {
                  // Construct Context
                  const slideContext = {
                      title: currentSlide.actionTitle,
                      subtitle: currentSlide.subtitle || "",
                      keyPoints: currentSlide.bodyContent
                  };
  
                  const visual = await generateSlideVisual(input, slideContext, currentSlide.visualSpecification.fullImagePrompt, consultingStyle, apiKey, '4K', undefined, customStylePrompts);
  
                  setSlides(prev => prev.map((s, i) => i === currentSlideIdx ? { ...s, imageBase64: visual, status: 'complete', currentStep: undefined, isHighRes: true } : s));
                          } catch(e) {
                              setSlides(prev => prev.map((s, i) => i === currentSlideIdx ? { ...s, status: 'error', subtitle: 'Visual Retry Failed' } : s));
                          }
                      }
                  };
              
                // --- Handlers ---
                const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!isValidApiKey(apiKey)) {
        alert("Please enter a valid Google Gemini API Key (starts with AIza) first.");
        return;
    }

    const newFilesData: { name: string; base64: string; mimeType: string; size: number }[] = [];
    const readers: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 8 * 1024 * 1024) {
            alert(`File ${file.name} is too large. Skip.`);
            continue;
        }

        const promise = new Promise<void>((resolve) => {
             const reader = new FileReader();
             reader.onload = (event) => {
                 const result = event.target?.result as string;
                 const parts = result.split(',');
                 if (parts.length >= 2) {
                     const base64 = parts[1];
                     newFilesData.push({
                         name: file.name,
                         mimeType: getMimeType(file),
                         base64: base64,
                         size: file.size
                     });
                 }
                 resolve();
             };
             reader.readAsDataURL(file);
        });
        readers.push(promise);
    }

    await Promise.all(readers);
    
    if (newFilesData.length > 0) {
        setFilesData(prev => [...prev, ...newFilesData]);
        setInputMode('file');
    }
  };
  
  // Handle Custom Style File Upload
  const handleCustomStyleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!isValidApiKey(apiKey)) {
        alert("Please enter a valid Google Gemini API Key first.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          const result = event.target?.result as string;
          const parts = result.split(',');
          if (parts.length >= 2) {
              setCustomStyleFile({
                  base64: parts[1],
                  mimeType: getMimeType(file)
              });
          }
      };
      reader.readAsDataURL(file);
  };

  const handleAnalyzeCustomStyle = async () => {
      setIsExtractingStyle(true);
      try {
          // Unified logic: whether it's a file or text description, we call the API to generate structured prompts.
          // This ensures text-only descriptions (e.g. "Cyberpunk style") are expanded into full Consulting Persona/Visual prompts.
          const result = await extractCustomStyle(
              customStyleFile ? customStyleFile.base64 : null,
              customStyleFile ? customStyleFile.mimeType : null,
              customStyleDescription,
              apiKey
          );

          setCustomStylePrompts(result);
          setConsultingStyle('custom');
          setShowCustomStyleModal(false);
          startOutlineAnalysis(true); // Proceed to analysis immediately

      } catch (e) {
          alert("Failed to analyze custom style: " + (e as Error).message);
      } finally {
          setIsExtractingStyle(false);
      }
  };


  const handleDeckImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!isValidApiKey(apiKey)) {
          alert("Please enter a valid Google Gemini API Key (starts with AIza) first.");
          return;
      }
      
      if (file.type !== 'application/pdf') {
          alert("Please upload a PDF file.");
          return;
      }

      setIsImportingDeck(true);
      try {
          const images = await extractImagesFromPdf(file);
          const importedSlides: SlideData[] = images.map((img, idx) => ({
              id: `imported-${idx}-${Date.now()}`,
              slideType: SlideType.Imported,
              actionTitle: `Imported Slide ${idx + 1}`,
              subtitle: "Source PDF",
              visualSpecification: {
                  chartType: "Image",
                  axesVariables: "",
                  keyInsight: "",
                  annotation: "",
                  fullImagePrompt: "" 
              },
              bodyContent: [],
              footer: { source: "Imported Document", disclaimer: "" },
              imageBase64: img,
              status: 'complete',
              isHighRes: false
          }));

          setSlides(importedSlides);
          slidesRef.current = importedSlides;

          setOutline(importedSlides.map((s, i) => ({
              id: s.id,
              title: s.actionTitle,
              executiveSummary: "Imported from PDF",
              suggestedSlideType: SlideType.Imported,
              keyPoints: []
          })));

          setStatus({ stage: 'finished' });
          setView('workspace');

      } catch (err) {
          console.error(err);
          alert("Failed to import deck: " + (err instanceof Error ? err.message : String(err)));
      } finally {
          setIsImportingDeck(false);
      }
  };

  const removeFile = (index: number) => {
      setFilesData(prev => prev.filter((_, i) => i !== index));
  };

  const startOutlineAnalysis = async (skipValidation = false) => {
    if (!skipValidation) {
        if (!isValidApiKey(apiKey)) { alert("Valid API Key required."); return; }
        if (filesData.length === 0 && !deckPurpose.trim() && !textContent.trim()) return;
    }

    setView('analyzing');
    setStatus({ stage: 'analyzing-outline' });
    setAnalysisTasks(prev => prev.map(t => ({ ...t, status: 'waiting' })));
    
    let scqaTimer: ReturnType<typeof setTimeout>;

    try {
      updateTaskStatus('upload', 'processing');
      await new Promise(resolve => setTimeout(resolve, 600));
      updateTaskStatus('upload', 'done');

      updateTaskStatus('connect', 'processing');
      
      const input: AnalysisInput = {};
      if (filesData.length > 0) {
          input.filesData = filesData.map(f => ({ mimeType: f.mimeType, base64: f.base64 }));
      }
      
      let combinedText = '';
      if (deckPurpose.trim()) {
          // FORCEFUL PREFIX for user purpose
          combinedText += `USER CORE PURPOSE / GOAL (MUST PRIORITIZE):\n"${deckPurpose.trim()}"\n\n`;
      }
      if (textContent.trim()) {
          combinedText += `ADDITIONAL CONTEXT:\n${textContent.trim()}`;
      }
      if (combinedText.trim()) input.text = combinedText;

      await new Promise(resolve => setTimeout(resolve, 400));
      updateTaskStatus('connect', 'done');

      updateTaskStatus('parse', 'processing');
      scqaTimer = setTimeout(() => {
          setAnalysisTasks(prev => {
              if (prev.find(t => t.id === 'parse')?.status === 'processing') {
                 return prev.map(t => t.id === 'parse' ? { ...t, status: 'done' } : t.id === 'scqa' ? { ...t, status: 'processing' } : t);
              }
              return prev;
          });
      }, 4000); 

      // Pass customPrompts if style is custom
      const generatedOutline = await generateOutline(input, consultingStyle, apiKey, customStylePrompts);
      
      clearTimeout(scqaTimer);
      updateTaskStatus('parse', 'done');
      updateTaskStatus('scqa', 'done');
      updateTaskStatus('draft', 'processing');
      await new Promise(resolve => setTimeout(resolve, 800)); 
      updateTaskStatus('draft', 'done');

      setOutline(generatedOutline);
      setStatus({ stage: 'outline-review' });
      setCurrentSlideIdx(1); // NEW: Skip Index 0 (Model Page) which is hidden in Outline View
      
      setTimeout(() => {
          setView('workspace');
      }, 500);

    } catch (err) {
      console.error("Analysis Error:", err);
      // @ts-ignore
      if (scqaTimer) clearTimeout(scqaTimer);
      updateTaskStatus('parse', 'error');
      setStatus({ stage: 'idle', error: err instanceof Error ? err.message : 'Analysis failed.' });
      setTimeout(() => {
        alert("Analysis failed. " + (err instanceof Error ? err.message : 'Please check your internet or file.'));
        setView('landing');
      }, 500);
    }
  };

  const handleGlobalRefine = async () => {
    if (!globalRefineInput.trim()) return;
    setIsRefining(true);
    try {
        const newHistory = [...outlineHistory, globalRefineInput];
        setOutlineHistory(newHistory);

        const newOutline = await refineOutline(outline, globalRefineInput, newHistory, consultingStyle, apiKey, customStylePrompts);
        setOutline(newOutline);
        setGlobalRefineInput('');
        if (currentSlideIdx >= newOutline.length) setCurrentSlideIdx(0);
        
        // SYNC SLIDES WITH NEW OUTLINE
        // We preserve existing slides and add placeholders for new ones
        const newSlides = newOutline.map(item => {
             const existing = slidesRef.current.find(s => s.id === item.id);
             if (existing) return existing;
             return {
                id: item.id,
                slideType: item.suggestedSlideType,
                actionTitle: item.title,
                subtitle: item.executiveSummary,
                visualSpecification: { chartType: "Pending", axesVariables: "", keyInsight: "", annotation: "", fullImagePrompt: "" },
                bodyContent: [],
                footer: { source: "", disclaimer: "" },
                status: 'pending'
             } as SlideData;
        });
        setSlides(newSlides);
        slidesRef.current = newSlides;

    } catch (e) {
        alert("Failed to refine outline: " + (e as Error).message);
    } finally {
        setIsRefining(false);
    }
  };

  const handleSlideRefine = async () => {
      if (!slideRefineInput.trim()) return;
      setIsRefiningSlide(true);
      try {
          const targetSlide = outline[currentSlideIdx];
          
          // Get/Update History for this slide
          const currentHist = slideHistoryMap[targetSlide.id] || [];
          const newHist = [...currentHist, slideRefineInput];
          setSlideHistoryMap(prev => ({...prev, [targetSlide.id]: newHist}));

          const updatedSlide = await refineSpecificSlide(targetSlide, slideRefineInput, newHist, consultingStyle, apiKey, customStylePrompts);
          const newOutline = [...outline];
          newOutline[currentSlideIdx] = updatedSlide;
          setOutline(newOutline);
          setSlideRefineInput('');
      } catch (e) {
           alert("Failed to refine slide: " + (e as Error).message);
      } finally {
          setIsRefiningSlide(false);
      }
  };

  const handleFinalSlideRefine = async () => {
    if (!slideRefineInput.trim()) return;
    setIsRefiningSlide(true);
    
    updateSlideWithHistory(currentSlideIdx, {}, true);

    try {
        const input: AnalysisInput = {};
        if (filesData.length > 0) {
             input.filesData = filesData.map(f => ({ mimeType: f.mimeType, base64: f.base64 }));
        }
        if (deckPurpose.trim()) input.text = `PURPOSE: ${deckPurpose}\n\n`;

        const currentSlide = slides[currentSlideIdx];
        
        // Get/Update History for this slide
        const currentHist = slideHistoryMap[currentSlide.id] || [];
        const newHist = [...currentHist, slideRefineInput];
        setSlideHistoryMap(prev => ({...prev, [currentSlide.id]: newHist}));
        
        updateSlideStatus(currentSlideIdx, { status: 'generating_text', currentStep: 'Interpreting Feedback...' });

        const updatedSlidePending = await regenerateFinalSlide(input, currentSlide, slideRefineInput, newHist, consultingStyle, apiKey, customStylePrompts);
        
        updateSlideStatus(currentSlideIdx, { ...updatedSlidePending, status: 'generating_visual', currentStep: 'Applying Edits...' });
        
        setSlideRefineInput('');

        const lightPrompt = updatedSlidePending.visualSpecification.fullImagePrompt;
        
        // Construct Context for Visual
        const slideContext = {
            title: updatedSlidePending.actionTitle,
            subtitle: updatedSlidePending.subtitle || "",
            keyPoints: updatedSlidePending.bodyContent
        };

        // FORCE 4K REGENERATION
        // Pass the reference image if available
        const visual = await generateSlideVisual(
            input, 
            slideContext, 
            lightPrompt, 
            consultingStyle, 
            apiKey, 
            '4K', 
            undefined, 
            customStylePrompts,
            visualRefineImage?.base64 // <--- PASS REF IMAGE
        );
        
        updateSlideStatus(currentSlideIdx, { imageBase64: visual, status: 'complete', currentStep: undefined, isHighRes: true });
        // Optional: Clear image after use?
        // setVisualRefineImage(null); 

    } catch (e) {
         alert("Failed to regenerate slide: " + (e as Error).message);
         updateSlideStatus(currentSlideIdx, { status: 'complete', currentStep: undefined });
    } finally {
        setIsRefiningSlide(false);
    }
  };

  const handleSmartLayoutRecommendation = async () => {
      if (currentSlideIdx === 0) return; // Skip Model Page
      const currentSlide = slides[currentSlideIdx];
      
      setIsRecommendingLayout(true);
      try {
          // Fetch recommendations
          const recs = await getLayoutRecommendations(
              currentSlide.actionTitle,
              currentSlide.subtitle || "",
              currentSlide.bodyContent || [],
              consultingStyle,
              apiKey
          );
          
          setLayoutRecommendations(recs);
          setShowLayoutModal(true);
      } catch (e) {
          alert("Failed to get layout recommendations: " + (e as Error).message);
      } finally {
          setIsRecommendingLayout(false);
      }
  };

  const handleApplyLayoutRecommendation = async (rec: LayoutRecommendation) => {
      setShowLayoutModal(false);
      
      // 1. Update Slide with new Layout Path
      const currentSlide = slides[currentSlideIdx];
      updateSlideStatus(currentSlideIdx, { 
          layoutFilePath: rec.layoutFilePath,
          status: 'generating_text',
          currentStep: `Adopting Layout: ${rec.name}...`
      });

      try {
          // 2. Regenerate Slide Content (to fit new layout structure)
          // We treat this as a "Regenerate Final Slide" call but with the new layout file enforced by the update above.
          // Note: regenerateFinalSlide reads the current slide object. We need to make sure the state is updated first.
          
          // Force update the slide object in memory for the function call
          const updatedSlideRef = { ...currentSlide, layoutFilePath: rec.layoutFilePath };
          
          const input: AnalysisInput = {};
          if (filesData.length > 0) input.filesData = filesData.map(f => ({ mimeType: f.mimeType, base64: f.base64 }));
          if (deckPurpose.trim()) input.text = `PURPOSE: ${deckPurpose}\n\n`;

          // Regenerate Content
          const newContent = await regenerateFinalSlide(
              input, 
              updatedSlideRef, 
              `Switch to layout: ${rec.name}. Ensure the content fits this structure.`, 
              slideHistoryMap[currentSlide.id] || [], 
              consultingStyle, 
              apiKey, 
              customStylePrompts
          );

          updateSlideStatus(currentSlideIdx, { ...newContent, status: 'generating_visual', currentStep: 'Rendering New Layout...' });

          // 3. Regenerate Visual
          const slideContext = {
              title: newContent.actionTitle,
              subtitle: newContent.subtitle || "",
              keyPoints: newContent.bodyContent
          };

          const visual = await generateSlideVisual(
              input, 
              slideContext, 
              newContent.visualSpecification.fullImagePrompt, 
              consultingStyle, 
              apiKey, 
              '4K', 
              undefined, 
              customStylePrompts
          );
          
          updateSlideStatus(currentSlideIdx, { 
              imageBase64: visual, 
              status: 'complete', 
              currentStep: undefined, 
              isHighRes: true 
          });

      } catch (e) {
          alert("Failed to apply layout: " + (e as Error).message);
          updateSlideStatus(currentSlideIdx, { status: 'complete', currentStep: undefined });
      }
  };

  const handleSlideModify = async () => {
      if (!slideRefineInput.trim()) return;
      if (!slides[currentSlideIdx].imageBase64) {
          alert("No visual to modify. Please regenerate first.");
          return;
      }
      setIsRefiningSlide(true);
      updateSlideWithHistory(currentSlideIdx, {}, true); 
      
      try {
          const currentSlide = slides[currentSlideIdx];
          updateSlideStatus(currentSlideIdx, { status: 'generating_visual', currentStep: 'Performing Visual Edit...' });

          const newImage = await modifySlideImage(
              currentSlide.imageBase64!, 
              slideRefineInput, 
              consultingStyle, 
              apiKey,
              visualRefineImage?.base64 // <--- PASS REF IMAGE
          );
          
          updateSlideStatus(currentSlideIdx, { 
              imageBase64: newImage, 
              status: 'complete', 
              isHighRes: true, // 4K Confirmed
              currentStep: undefined
          });
          setSlideRefineInput('');

      } catch (e) {
          alert("Failed to modify slide: " + (e as Error).message);
          updateSlideStatus(currentSlideIdx, { status: 'complete', currentStep: undefined });
      } finally {
          setIsRefiningSlide(false);
      }
  };

  const handleUpscaleDeck = async () => {
      if (slides.length === 0 || isUpscaling) return;
      
      setIsUpscaling(true);
      try {
          for (let i = 0; i < slides.length; i++) {
              if (slides[i].status === 'complete' && slides[i].imageBase64) {
                  setCurrentSlideIdx(i);
                  updateSlideStatus(i, { status: 'upscaling', currentStep: 'Enhancing Resolution...' });
                  
                  const prompt = slides[i].visualSpecification.fullImagePrompt;
                  if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));
                  const visual4k = await upscaleSlideImage(slides[i].imageBase64!, prompt, consultingStyle, apiKey);
                  
                  updateSlideStatus(i, { imageBase64: visual4k, status: 'complete', isHighRes: true, currentStep: undefined });
              }
          }
          alert("Deck Upscaled to 4K Ultra HD successfully.");
      } catch (e) {
          console.error(e);
          alert("Upscaling failed. " + (e instanceof Error ? e.message : ''));
          setSlides(prev => prev.map(s => s.status === 'upscaling' ? { ...s, status: 'complete', currentStep: undefined } : s));
      } finally {
          setIsUpscaling(false);
      }
  };

  const removeOutlineItem = (id: string) => {
    setOutline(prev => {
        const newOutline = prev.filter(o => o.id !== id);
        if (currentSlideIdx >= newOutline.length) {
            setCurrentSlideIdx(Math.max(0, newOutline.length - 1));
        }
        return newOutline;
    });
  };

  // --- CORE DECK GENERATION LOOP (With Pause/Resume) ---
  
  const generateDeckLoop = async (startIndex: number, instructions: string) => {
      if (!isValidApiKey(apiKey)) return;
      
      shouldPauseRef.current = false;
      setIsPausing(false);

      const input: AnalysisInput = {};
      if (filesData.length > 0) {
           input.filesData = filesData.map(f => ({ mimeType: f.mimeType, base64: f.base64 }));
      }
      if (deckPurpose.trim()) input.text = `PURPOSE: ${deckPurpose}\n\n`;

      const previousSlidesContext: { title: string, summary: string }[] = [];
      // Use ref to read already generated context if restarting
      for(let k=0; k < startIndex; k++) {
          const s = slidesRef.current[k];
          if (s) previousSlidesContext.push({ title: s.actionTitle, summary: s.subtitle || "" });
      }

      // NEW: Initialize Master Style
      let activeMasterStyle: MasterStyleConfig | undefined = slidesRef.current[0]?.masterStyle;

      for (let i = startIndex; i < outline.length; i++) {
          // Check Pause
          if (shouldPauseRef.current) {
              setStatus(prev => ({ ...prev, stage: 'paused', progress: { ...prev.progress!, status: 'Paused by user' } }));
              setIsPausing(false);
              return; 
          }

          // Use slidesRef.current to check valid slide existence (Robustness)
          if (!slidesRef.current[i]) {
              console.warn(`Slide ${i} not found in ref state. Skipping.`);
              continue;
          }

          const item = outline[i];
          setCurrentSlideIdx(i);
          setStatus(prev => ({ ...prev, stage: 'constructing-deck', progress: { current: i + 1, total: outline.length, status: `Analyst: Structuring Slide ${i+1}...` } }));
          
          // SET START STATUS
          updateSlideStatus(i, { status: 'generating_text', currentStep: 'Analyzing Logic...' });
          
          try {
              // 1. Structural Blueprint (Text Generation)
              updateSlideStatus(i, { currentStep: 'Drafting Content...' });
              const slideContent = await generateSlideContent(input, item, previousSlidesContext, consultingStyle, apiKey, instructions, customStylePrompts, activeMasterStyle);
              
              if (slideContent.masterStyle) {
                  activeMasterStyle = slideContent.masterStyle;
              }

              previousSlidesContext.push({ title: slideContent.actionTitle, summary: item.executiveSummary });
              
              // Small delay to allow UI to show 'generating_visual' transition clearly
              await new Promise(r => setTimeout(r, 600));

              // DOUBLE CHECK PAUSE before heavy rendering
              if (shouldPauseRef.current) {
                  // FIX: Reset status to pending so it stops spinning and can be resumed
                  updateSlideStatus(i, { ...slideContent, status: 'pending', currentStep: 'Paused' });
                  setStatus(prev => ({ ...prev, stage: 'paused', progress: { ...prev.progress!, status: 'Paused by user' } }));
                  setIsPausing(false);
                  return;
              }

              // Update status to generating_visual (Rendering)
              updateSlideStatus(i, { ...slideContent, status: 'generating_visual', currentStep: 'Designing Visuals...' });

              // --- SPECIAL CASE: MASTER STYLE GUIDE (NO IMAGE GEN) ---
              if (slideContent.slideType === SlideType.MasterStyleGuide || slideContent.masterStyle) {
                  // Skip Nanobanana. Mark as complete immediately.
                  // We add a tiny delay just for UX smoothness
                  await new Promise(r => setTimeout(r, 500));
                  updateSlideStatus(i, { 
                      ...slideContent,
                      status: 'complete', 
                      currentStep: undefined, 
                      isHighRes: true,
                      imageBase64: undefined // Explicitly no image
                  });
                  continue; // SKIP TO NEXT SLIDE
              }

              setStatus(prev => ({ ...prev, progress: { current: i + 1, total: outline.length, status: `Designer: Rendering Slide ${i+1}...` } }));
              
              // 2. Visual Rendering (Image Generation)
              updateSlideStatus(i, { currentStep: 'Rendering Pixel-Perfect Image...' });
              
              const lightPrompt = slideContent.visualSpecification.fullImagePrompt;
              
              // Construct Context for Visual
              const slideContext = {
                  title: slideContent.actionTitle,
                  subtitle: slideContent.subtitle || "",
                  keyPoints: slideContent.bodyContent
              };

              // Standard Nanobanana Pro
              const visual = await generateSlideVisual(input, slideContext, lightPrompt, consultingStyle, apiKey, '4K', instructions, customStylePrompts); 
              
              updateSlideStatus(i, { imageBase64: visual, status: 'complete', currentStep: undefined, isHighRes: true });
          } catch (e) {
              console.error("Slide Generation Error:", e);
              // Mark slide as error but continue loop
              updateSlideStatus(i, { status: 'error', subtitle: 'Generation Failed', currentStep: undefined });
              await new Promise(r => setTimeout(r, 1000)); // Brief pause on error
          }
      }
      setStatus({ stage: 'finished' });
  };

  const startConstruction = async () => {
      setShowBuildConfirm(false); 
      const initialSlides: SlideData[] = outline.map(item => ({
          id: item.id,
          slideType: item.suggestedSlideType,
          actionTitle: item.title,
          subtitle: "Scheduled for generation...",
          visualSpecification: { chartType: "Pending", axesVariables: "", keyInsight: "", annotation: "", fullImagePrompt: "" },
          bodyContent: [],
          footer: { source: "", disclaimer: "" },
          status: 'pending' 
      }));
      
      // CRITICAL: Update both state and ref immediately
      setSlides(initialSlides);
      slidesRef.current = initialSlides;

      await generateDeckLoop(0, buildInstructions);
  };

  const resumeConstruction = async () => {
      shouldPauseRef.current = false;
      setIsPausing(false);

      let currentInstructions = buildInstructions;
      if (pauseInstruction.trim()) {
          currentInstructions = `${buildInstructions}\n\n[MID-RUN ADJUSTMENT]: ${pauseInstruction.trim()}`;
          setBuildInstructions(currentInstructions); 
          setPauseInstruction(''); 
      }

      let indexToResume = -1;
      
      // Find where to resume using the reliable ref
      const currentSlides = slidesRef.current;
      const interruptedIdx = currentSlides.findIndex(s => s.status === 'generating_text' || s.status === 'generating_visual');
      
      if (interruptedIdx !== -1) {
          indexToResume = interruptedIdx;
          updateSlideStatus(interruptedIdx, { status: 'pending', currentStep: undefined });
      } else {
          const pendingIdx = currentSlides.findIndex(s => s.status === 'pending' || s.status === 'error');
          if (pendingIdx !== -1) indexToResume = pendingIdx;
      }

      await new Promise(r => setTimeout(r, 100));

      if (indexToResume !== -1) {
          await generateDeckLoop(indexToResume, currentInstructions); 
      } else {
          setStatus({ stage: 'finished' });
      }
  };

  const handlePause = () => {
      shouldPauseRef.current = true;
      setIsPausing(true); 
  };

  const handleRefineImageUpload = (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
          if (e.target?.result) {
              setVisualRefineImage({
                  base64: e.target.result as string,
                  mimeType: file.type
              });
          }
      };
      reader.readAsDataURL(file);
  };

  const handleGlobalRegeneration = async () => {
      setShowRegenerateModal(false);
      
      const resetSlides: SlideData[] = outline.map(item => ({
          id: item.id,
          slideType: item.suggestedSlideType,
          actionTitle: item.title,
          subtitle: "Scheduled for regeneration...",
          visualSpecification: { chartType: "Pending", axesVariables: "", keyInsight: "", annotation: "", fullImagePrompt: "" },
          bodyContent: [],
          footer: { source: "", disclaimer: "" },
          status: 'pending' 
      }));
      setSlides(resetSlides);
      slidesRef.current = resetSlides;
      await generateDeckLoop(0, regenInstructions);
  };

  const handleGlobalVisualEdit = async () => {
      if (!globalVisualEditInstruction.trim()) return;
      setShowGlobalVisualEditModal(false);
      setIsGlobalVisualEditing(true);

      try {
          // Iterate through all slides
          for (let i = 0; i < slides.length; i++) {
              // Only process completed slides that have an image
              if (slides[i].status === 'complete' && slides[i].imageBase64) {
                  setCurrentSlideIdx(i); // Focus so user sees progress
                  updateSlideStatus(i, { status: 'generating_visual', currentStep: 'Applying Global Visual Edit...' });
                  
                  // Use existing modify logic
                  const newImage = await modifySlideImage(slides[i].imageBase64!, globalVisualEditInstruction, consultingStyle, apiKey);
                  
                  updateSlideStatus(i, { 
                      imageBase64: newImage, 
                      status: 'complete', 
                      currentStep: undefined,
                      isHighRes: true // 4K Confirmed
                  });
              }
          }
          setGlobalVisualEditInstruction('');
      } catch (e) {
          alert("Global Visual Edit failed: " + (e as Error).message);
      } finally {
          setIsGlobalVisualEditing(false);
      }
  };

  const handleSingleSlideUpscale = async () => {
      const currentSlide = slides[currentSlideIdx];
      if (!currentSlide.imageBase64) return;
      
      // Use local status update instead of global isUpscaling to allow other interactions if needed, 
      // though blocking is safer.
      updateSlideStatus(currentSlideIdx, { status: 'upscaling', currentStep: 'Enhancing Resolution (4K)...' });
      
      try {
          const prompt = currentSlide.visualSpecification.fullImagePrompt;
          const visual4k = await upscaleSlideImage(currentSlide.imageBase64!, prompt, consultingStyle, apiKey);
          
          updateSlideStatus(currentSlideIdx, { 
              imageBase64: visual4k, 
              status: 'complete', 
              isHighRes: true, 
              currentStep: undefined 
          });
      } catch (e) {
          alert("Upscale failed: " + (e as Error).message);
          updateSlideStatus(currentSlideIdx, { status: 'complete', currentStep: undefined });
      }
  };

  const handleExportPDF = () => {
      if (slides.length === 0) return;
      setIsExporting(true);
      try {
          const doc = new jsPDF({
              orientation: 'landscape',
              unit: 'px',
              format: [1920, 1080],
              hotfixes: ["px_scaling"]
          });

          // Filter out the Model Page (Master Style Guide)
          const exportSlides = slides.filter(s => s.slideType !== SlideType.MasterStyleGuide);

          if (exportSlides.length === 0) {
              alert("No content slides to export.");
              return;
          }

          exportSlides.forEach((slide, index) => {
              if (index > 0) doc.addPage();
              if (slide.imageBase64) {
                  doc.addImage(slide.imageBase64, 'PNG', 0, 0, 1920, 1080, '', 'FAST');
              } else {
                  doc.text(slide.actionTitle || "Untitled", 100, 200);
              }
          });

          doc.save(`Strategy_AI_${new Date().toISOString().slice(0, 10)}.pdf`);
      } catch (e) {
          console.error("PDF Export Failed", e);
          alert("Failed to export PDF.");
      } finally {
          setIsExporting(false);
      }
  };

  // --- NEW: ENFORCE MASTER STYLE (Fix Slide) ---
  const handleEnforceMasterStyle = async () => {
      // 1. Get Master Style DNA
      const masterSlide = slides.find(s => s.slideType === SlideType.MasterStyleGuide || s.masterStyle);
      const masterConfig = masterSlide?.masterStyle;

      if (!masterConfig) {
          alert("No Master Style Guide found (Slide 0). Cannot enforce style.");
          return;
      }

      if (currentSlideIdx === 0 || !slides[currentSlideIdx]) return;

      const currentSlide = slides[currentSlideIdx];
      
      // 2. Set Status to Regenerating
      updateSlideStatus(currentSlideIdx, { 
          status: 'generating_visual', 
          currentStep: 'Applying Master Style Rules...' 
      });

      try {
          // 3. Construct Context
          const slideContext = {
              title: currentSlide.actionTitle,
              subtitle: currentSlide.subtitle || "",
              keyPoints: currentSlide.bodyContent
          };

          // 4. Construct STRICT Style Instruction (STYLE OVERRIDE ONLY)
          const styleInstruction = `
          # CRITICAL INSTRUCTION: APPLY MASTER STYLE SKIN
          
          **OBJECTIVE**: Repaint this slide using the Master Style Palette, BUT KEEP THE LAYOUT EXACTLY THE SAME.
          
          ## 1. WHAT TO KEEP (DO NOT CHANGE):
          - **Layout Structure**: Keep columns, charts, and text positions exactly as they are.
          - **Content**: Do not change the text or data.
          
          ## 2. WHAT TO CHANGE (MANDATORY OVERRIDE):
          - **BACKGROUND**: Must be exactly ${masterConfig.backgroundColor}.
          - **TITLES**: Must use color ${masterConfig.colorPalette.primary} and font-family "${masterConfig.typography.title.fontFamily}" (or "${masterConfig.typography.title.fontFamilyChinese || 'Microsoft YaHei'}" for Chinese).
          - **CHARTS/SHAPES**: Repaint all charts using ONLY this palette: ${masterConfig.colorPalette.chartColors.join(', ')}.
          - **ACCENTS**: Use ${masterConfig.colorPalette.secondary} for highlights.
          
          ## EXECUTION:
          Take the existing visual concept and "skin" it with these colors and fonts. Do not hallucinate new objects.
          `;

          // 5. Call Nanobanana
          const newVisual = await generateSlideVisual(
              {}, // No new input files needed, uses internal logic
              slideContext, 
              currentSlide.visualSpecification.fullImagePrompt, // Keep original concept
              consultingStyle, 
              apiKey, 
              '4K', 
              styleInstruction, // Pass enforcement as global instruction
              customStylePrompts
          );
          
          updateSlideStatus(currentSlideIdx, { 
              imageBase64: newVisual, 
              status: 'complete', 
              currentStep: undefined, 
              isHighRes: true 
          });

      } catch (e) {
          alert("Failed to enforce master style: " + (e as Error).message);
          updateSlideStatus(currentSlideIdx, { status: 'complete', currentStep: undefined }); // Revert status
      }
  };


  // --- Views ---

  // Removed old Fudan view condition

      if (view === 'landing') {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-white relative overflow-hidden selection:bg-[#163E93] selection:text-white">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-[#051C2C]"></div>
          
          {/* NAV LINKS */}
          <div className="absolute top-6 right-8 flex gap-6 z-20">
              <a 
                  href="http://www.strategyaimanual.com/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs font-bold text-[#051C2C] uppercase tracking-[0.1em] hover:text-[#163E93] transition-colors flex items-center gap-2"
              >
                  <GraduationCap className="w-4 h-4" />
                  用户手册
              </a>
              <a 
                  href="https://aistudio.google.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs font-bold text-[#051C2C] uppercase tracking-[0.1em] hover:text-[#163E93] transition-colors flex items-center gap-2"
              >
                  <Key className="w-4 h-4" />
                  Gemini API Key
              </a>
          </div>
  
          <div className="absolute bottom-0 right-0 w-1/3 h-full bg-[#F8FAFC] -z-10 skew-x-12 transform origin-bottom-right opacity-60"></div>        
        <div className="max-w-6xl w-full p-8 relative z-10 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-700">
            {/* STANDARD BRANDING */}
            <h1 className="text-7xl md:text-9xl font-bold text-[#051C2C] mb-8 font-serif tracking-tighter leading-none">
                Strategy<span className="text-[#163E93]">.AI</span>
            </h1>
            <div className="w-32 h-2 bg-[#163E93] mb-12"></div>
            <p className="text-xl md:text-3xl text-gray-600 mb-12 font-serif italic leading-relaxed max-w-2xl">
                The Strategic Presentation. <br/>
                <span className="text-[#051C2C] not-italic font-semibold">Reimagined by Intelligence.</span>
            </p>
            
            <div className="w-full max-w-md mb-12">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-20">
                        {apiKey && !isValidApiKey(apiKey) ? (
                             <AlertTriangle className="w-5 h-5 text-red-500" />
                        ) : (
                             <Key className={`w-5 h-5 transition-colors ${isValidApiKey(apiKey) ? 'text-[#163E93]' : 'text-gray-300'}`} />
                        )}
                    </div>
                    <input 
                        type="password"
                        value={apiKey}
                        onChange={(e) => {
                            const val = e.target.value.replace(/["\s'\n\r]/g, '');
                            setApiKey(val);
                        }}
                        placeholder="Enter Google Gemini API Key (starts with AIza...)"
                        autoComplete="new-password"
                        spellCheck={false}
                        className={`w-full pl-12 pr-4 py-4 bg-gray-50 border-2 focus:bg-white transition-all outline-none font-mono text-sm placeholder:font-sans
                            ${apiKey && !isValidApiKey(apiKey) 
                                ? 'border-red-300 focus:border-red-500 text-red-900' 
                                : 'border-gray-200 focus:border-[#051C2C] text-[#051C2C]'
                            }
                        `}
                    />
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-8 w-full justify-center items-stretch">
                
                <div className="flex-1 max-w-md bg-white border border-gray-200 hover:border-[#051C2C] transition-all shadow-lg p-6 relative group hover:-translate-y-1">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#051C2C]"></div>
                    <div className="mb-6 flex items-center gap-3">
                         <div className="p-2 bg-gray-100 text-[#051C2C] rounded-full"><Briefcase className="w-6 h-6"/></div>
                         <h3 className="text-lg font-bold text-[#051C2C] uppercase tracking-wider">Strategy Engine</h3>
                    </div>
                    
                    <div className="mb-4">
                        <label className="text-[10px] font-bold text-[#051C2C] uppercase tracking-wider mb-2 flex items-center gap-2">
                             <Target className="w-3 h-3 text-[#163E93]" />
                             Core Objective / Context (Optional)
                        </label>
                        <textarea
                            value={deckPurpose}
                            onChange={(e) => setDeckPurpose(e.target.value)}
                            placeholder="Briefly describe the goal (e.g., 'Analyze Q3 revenue drop and propose a recovery plan')..."
                            className={`w-full p-3 bg-gray-50 border-2 text-sm focus:bg-white focus:outline-none resize-none h-24 transition-all font-medium rounded-none
                                ${isValidApiKey(apiKey) ? 'border-gray-200 focus:border-[#051C2C] text-[#051C2C]' : 'border-gray-100 text-gray-400 cursor-not-allowed'}
                            `}
                            disabled={!isValidApiKey(apiKey)}
                        />
                    </div>

                    <div className={`
                        relative overflow-hidden rounded-none border-2 transition-colors mb-4
                        ${isValidApiKey(apiKey) ? 'border-gray-200 hover:border-[#163E93] bg-gray-50 hover:bg-white cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}
                    `}>
                        <input 
                            type="file" 
                            onChange={handleFileUpload} 
                            disabled={!isValidApiKey(apiKey)}
                            className="absolute inset-0 opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed" 
                            accept=".pdf,.txt,.md,.doc,.docx" 
                            multiple 
                        />
                        <div className="p-8 flex flex-col items-center justify-center relative z-10">
                             <Upload className={`w-6 h-6 mb-2 ${isValidApiKey(apiKey) ? 'text-gray-400' : 'text-gray-300'}`} />
                             <p className={`font-bold text-xs uppercase tracking-widest ${isValidApiKey(apiKey) ? 'text-[#051C2C]' : 'text-gray-400'}`}>Upload Brief Docs</p>
                        </div>
                    </div>

                    {filesData.length > 0 && (
                        <div className="w-full bg-white border border-gray-200 divide-y divide-gray-100 shadow-sm mb-4">
                            {filesData.map((f, i) => (
                                <div key={i} className="p-2 flex items-center justify-between text-left">
                                    <span className="text-xs font-medium text-[#051C2C] truncate max-w-[200px]">{f.name}</span>
                                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}

                    <button 
                        onClick={() => setView('style-selection')}
                        disabled={(filesData.length === 0 && !deckPurpose.trim()) || !isValidApiKey(apiKey)}
                        className="w-full bg-[#051C2C] disabled:bg-gray-300 hover:bg-[#163E93] text-white py-3 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all"
                    >
                        <span>Start Logic</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 max-w-md bg-white border border-gray-200 hover:border-[#163E93] transition-all shadow-lg p-6 relative group hover:-translate-y-1">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#163E93]"></div>
                    <div className="mb-6 flex items-center gap-3">
                         <div className="p-2 bg-blue-50 text-[#163E93] rounded-full"><ImageIcon className="w-6 h-6"/></div>
                         <h3 className="text-lg font-bold text-[#163E93] uppercase tracking-wider">Visual Engine</h3>
                    </div>
                     <div className={`
                        relative overflow-hidden rounded-none border-2 transition-colors mb-4
                        ${isValidApiKey(apiKey) ? 'border-dashed border-blue-200 hover:border-[#163E93] bg-blue-50/50 hover:bg-blue-50 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}
                    `}>
                        <input 
                            type="file" 
                            onChange={handleDeckImport} 
                            disabled={!isValidApiKey(apiKey) || isImportingDeck}
                            className="absolute inset-0 opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed" 
                            accept=".pdf" 
                        />
                        <div className="p-8 flex flex-col items-center justify-center relative z-10">
                             {isImportingDeck ? (
                                 <Loader2 className="w-6 h-6 animate-spin text-[#163E93] mb-2" />
                             ) : (
                                 <Monitor className={`w-6 h-6 mb-2 ${isValidApiKey(apiKey) ? 'text-[#163E93]' : 'text-gray-300'}`} />
                             )}
                             <p className={`font-bold text-xs uppercase tracking-widest ${isValidApiKey(apiKey) ? 'text-[#163E93]' : 'text-gray-400'}`}>
                                 {isImportingDeck ? 'Extracting Slides...' : 'Import Visual Deck'}
                             </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 max-w-md bg-white border border-gray-200 hover:border-amber-600 transition-all shadow-lg p-6 relative group hover:-translate-y-1">
                    <div className="absolute top-0 left-0 w-full h-1 bg-amber-600"></div>
                    <div className="mb-6 flex items-center gap-3">
                         <div className="p-2 bg-amber-50 text-amber-600 rounded-full"><Sparkles className="w-6 h-6"/></div>
                         <h3 className="text-lg font-bold text-amber-600 uppercase tracking-wider">Project Iron</h3>
                    </div>
                     <div 
                        onClick={() => { if(isValidApiKey(apiKey)) setView('remaster'); }}
                        className={`
                        relative overflow-hidden rounded-none border-2 transition-colors mb-4 h-40 flex items-center justify-center
                        ${isValidApiKey(apiKey) ? 'border-dashed border-amber-200 hover:border-amber-600 bg-amber-50/50 hover:bg-amber-50 cursor-pointer' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}
                    `}>
                        <div className="p-8 flex flex-col items-center justify-center relative z-10">
                             <Wand2 className={`w-6 h-6 mb-2 ${isValidApiKey(apiKey) ? 'text-amber-600' : 'text-gray-300'}`} />
                             <p className={`font-bold text-xs uppercase tracking-widest ${isValidApiKey(apiKey) ? 'text-amber-600' : 'text-gray-400'}`}>
                                 Remaster Slide
                             </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
  }

  if (view === 'remaster') {
      return (
          <div className="min-h-screen bg-[#F8FAFC]">
              <header className="h-20 border-b border-gray-200 bg-white flex items-center justify-between px-8 shadow-sm z-40 sticky top-0">
                  <div className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setView('landing')}>
                      <span className="font-serif font-bold text-2xl tracking-tighter text-[#051C2C]">Strategy<span className="text-amber-600">.Iron</span></span>
                      <div className="h-4 w-[1px] bg-gray-300 mx-2"></div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Remaster Tool</span>
                  </div>
                  <div className="flex gap-6">
                      <a 
                          href="http://www.strategyaimanual.com/" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs font-bold text-[#051C2C] uppercase tracking-[0.1em] hover:text-amber-600 transition-colors flex items-center gap-2"
                      >
                          <GraduationCap className="w-4 h-4" />
                          用户手册
                      </a>
                      <a 
                          href="https://aistudio.google.com/api-keys" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-xs font-bold text-[#051C2C] uppercase tracking-[0.1em] hover:text-amber-600 transition-colors flex items-center gap-2"
                      >
                          <Key className="w-4 h-4" />
                          Gemini API Key
                      </a>
                  </div>
              </header>
              <div className="container mx-auto px-4 py-8">
                  <RemasterTool apiKey={apiKey} />
              </div>
          </div>
      );
  }

  if (view === 'style-selection') {
    return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8FAFC] p-8">
        
        {/* CUSTOM STYLE MODAL */}
        {showCustomStyleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white max-w-2xl w-full shadow-2xl border-l-8 border-purple-600 p-8 flex flex-col gap-6 relative">
                    <button onClick={() => setShowCustomStyleModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                    <div>
                        <h3 className="text-3xl font-bold text-[#051C2C] font-serif mb-2 flex items-center gap-3"><PenTool className="w-8 h-8 text-purple-600" />Define Custom Identity</h3>
                        <p className="text-gray-500 text-sm">Upload a style guide (PDF/Image) or describe the framework in text. The AI will reverse-engineer a system prompt.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Option 1: File Upload */}
                        <div className="flex flex-col gap-3">
                             <label className="text-xs font-bold text-purple-600 uppercase tracking-widest flex items-center gap-2">
                                 <Upload className="w-3 h-3" /> Upload Style Reference
                             </label>
                             <div className="relative border-2 border-dashed border-gray-300 hover:border-purple-500 bg-gray-50 h-32 flex flex-col items-center justify-center cursor-pointer transition-colors">
                                 <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleCustomStyleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                 {customStyleFile ? (
                                     <div className="text-center">
                                         <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                         <p className="text-xs font-bold text-gray-700">File Loaded</p>
                                     </div>
                                 ) : (
                                     <div className="text-center text-gray-400">
                                         <ImageIcon className="w-6 h-6 mx-auto mb-2" />
                                         <p className="text-[10px] font-bold uppercase">Drop PDF or Image</p>
                                     </div>
                                 )}
                             </div>
                        </div>
                        
                        {/* Option 2: Text Description */}
                        <div className="flex flex-col gap-3">
                            <label className="text-xs font-bold text-purple-600 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="w-3 h-3" /> Or Describe Style
                            </label>
                            <textarea 
                                value={customStyleDescription}
                                onChange={(e) => setCustomStyleDescription(e.target.value)}
                                placeholder="e.g. 'Use a minimalist Swiss design. Black background, Helvetica font. Focus on large typography and negative space. Logic should be inductive...'"
                                className="w-full h-32 p-3 bg-gray-50 border border-gray-200 text-sm focus:border-purple-500 focus:bg-white focus:outline-none resize-none"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button onClick={() => setShowCustomStyleModal(false)} className="px-6 py-3 border border-gray-300 text-gray-600 font-bold text-xs uppercase tracking-widest hover:bg-gray-50">Cancel</button>
                        <button 
                            onClick={handleAnalyzeCustomStyle} 
                            disabled={(!customStyleFile && !customStyleDescription.trim()) || isExtractingStyle} 
                            className="px-6 py-3 bg-purple-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-purple-800 flex items-center gap-2 disabled:opacity-50"
                        >
                            {isExtractingStyle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            {isExtractingStyle ? 'Extracting DNA...' : 'Analyze & Apply'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="max-w-6xl w-full">
            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold font-serif mb-4 text-[#051C2C]">
                    Choose Consulting Persona
                </h2>
                <p className="text-gray-500 text-lg">
                    Select the logic framework and visual identity for your deck.
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {['mckinsey', 'bcg', 'bain', 'internet'].map((style) => (
                    <div 
                        key={style}
                        onClick={() => {
                            setConsultingStyle(style as ConsultingStyle);
                            setCustomStylePrompts(undefined);
                        }}
                        className={`bg-white p-8 border-2 cursor-pointer transition-all hover:-translate-y-2 shadow-sm hover:shadow-xl relative overflow-hidden group
                            ${consultingStyle === style 
                                ? style === 'bcg' ? 'border-[#00291C] ring-4 ring-[#00291C]/10' 
                                : style === 'bain' ? 'border-[#CB2026] ring-4 ring-[#CB2026]/10' 
                                : style === 'internet' ? 'border-[#3B82F6] ring-4 ring-[#3B82F6]/10'
                                : 'border-[#163E93] ring-4 ring-[#163E93]/10' 
                                : 'border-gray-200'
                            }
                        `}
                    >
                         <h3 className="text-xl font-serif font-bold uppercase mb-2 relative z-10">
                             {style === 'internet' ? 'Internet / Tech' : style}
                         </h3>
                         <p className="text-xs text-gray-400 font-bold uppercase tracking-wider relative z-10">
                             {style === 'internet' ? 'Product & UX' : 'Standard Model'}
                         </p>
                         <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150
                             ${style === 'bcg' ? 'bg-[#4ecb61]' 
                             : style === 'bain' ? 'bg-[#CB2026]' 
                             : style === 'internet' ? 'bg-[#3B82F6]'
                             : 'bg-[#163E93]'}
                         `}></div>
                    </div>
                ))}

                {/* CUSTOM STYLE CARD */}
                <div 
                    onClick={() => setShowCustomStyleModal(true)}
                    className={`bg-white p-8 border-2 border-dashed border-gray-300 cursor-pointer transition-all hover:-translate-y-2 hover:border-purple-500 hover:shadow-xl group
                         ${consultingStyle === 'custom' ? 'border-purple-600 ring-4 ring-purple-600/10 bg-purple-50/10' : ''}
                    `}
                >
                     <div className="flex items-center justify-between mb-2">
                        <h3 className="text-2xl font-serif font-bold uppercase text-gray-800 group-hover:text-purple-700">Custom</h3>
                        <PenTool className="w-6 h-6 text-gray-300 group-hover:text-purple-500" />
                     </div>
                     <p className="text-xs text-gray-400 font-bold uppercase tracking-wider group-hover:text-purple-400">Upload / Define</p>
                </div>
            </div>

            <div className="mt-12 flex justify-center gap-6">
                <button onClick={() => setView('landing')} className="text-gray-400 hover:text-gray-600 font-bold uppercase tracking-widest text-sm">Back</button>
                <button 
                    onClick={() => startOutlineAnalysis(false)} 
                    disabled={consultingStyle === 'custom' && !customStylePrompts}
                    className="text-white px-12 py-4 font-bold uppercase tracking-[0.2em] flex items-center gap-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-[#051C2C] hover:bg-black"
                >
                    <span>Confirm Strategy</span>
                    <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
    );
  }
  
  // Analyzing View
  if (view === 'analyzing') {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white">
            <h2 className="text-3xl font-serif font-bold text-[#051C2C] mb-8">Synthesizing Strategic Logic</h2>
            <div className="space-y-4 w-full max-w-md">
                {analysisTasks.map(task => (
                    <div key={task.id} className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full ${task.status === 'done' ? 'bg-[#051C2C]' : task.status === 'processing' ? 'bg-[#163E93] animate-pulse' : 'bg-gray-200'}`}></div>
                        <span className={`font-medium ${task.status === 'processing' ? 'text-[#163E93]' : 'text-gray-500'}`}>{task.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  // Workspace View
  return (
    <div className="h-screen overflow-hidden bg-[#F8FAFC] text-slate-800 font-sans flex flex-col relative">
      
      {showLayoutModal && layoutRecommendations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white max-w-6xl w-full shadow-2xl border-l-8 border-amber-400 p-8 flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto">
                 <button onClick={() => setShowLayoutModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                 <div>
                    <h3 className="text-3xl font-bold text-[#051C2C] font-serif mb-2 flex items-center gap-3"><LayoutDashboard className="w-8 h-8 text-amber-500" />Smart Layout Recommendations</h3>
                    <p className="text-gray-500 text-sm">AI-selected professional layouts tailored to your content's logic.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {layoutRecommendations.map((rec) => (
                        <div 
                            key={rec.id} 
                            onClick={() => handleApplyLayoutRecommendation(rec)}
                            className="border border-gray-200 hover:border-amber-500 cursor-pointer p-4 rounded hover:shadow-lg transition-all group bg-gray-50 hover:bg-white flex flex-col h-full"
                        >
                            <div className="h-24 bg-gray-200 mb-3 rounded flex items-center justify-center text-gray-400 font-bold uppercase text-[10px] tracking-widest group-hover:bg-amber-50 group-hover:text-amber-600 transition-colors">
                                {rec.name}
                            </div>
                            <h4 className="font-serif font-bold text-sm text-[#051C2C] mb-1 group-hover:text-amber-700 leading-tight">{rec.name}</h4>
                            <p className="text-[10px] text-gray-500 mb-3 line-clamp-2">{rec.description}</p>
                            <div className="mt-auto bg-amber-50 p-2 rounded border border-amber-100 text-[9px] text-amber-800 font-medium">
                                <span className="font-bold uppercase block mb-0.5 text-amber-600">Match Reason:</span>
                                {rec.reason}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button onClick={() => setShowLayoutModal(false)} className="px-6 py-3 border border-gray-300 text-gray-600 font-bold text-xs uppercase tracking-widest hover:bg-gray-50">Cancel</button>
                </div>
             </div>
        </div>
      )}

      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white max-w-lg w-full shadow-2xl border-l-8 border-[#163E93] p-8 flex flex-col gap-6 relative">
                 <button onClick={() => setShowRegenerateModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                 <div>
                    <h3 className="text-3xl font-bold text-[#051C2C] font-serif mb-2 flex items-center gap-3"><Command className="w-8 h-8 text-[#163E93]" />Director's Cut</h3>
                </div>
                <div className="flex flex-col gap-3">
                    <label className="text-xs font-bold text-[#163E93] uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3" />Director's Instructions</label>
                    <textarea 
                        value={regenInstructions}
                        onChange={(e) => setRegenInstructions(e.target.value)}
                        placeholder="Give a command to the AI models..."
                        className="w-full h-40 p-4 bg-blue-50/50 border-2 border-blue-100 text-sm focus:border-[#163E93] focus:bg-white focus:outline-none resize-none rounded-sm"
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowRegenerateModal(false)} className="px-6 py-3 border border-gray-300 text-gray-600 font-bold text-xs uppercase tracking-widest hover:bg-gray-50">Cancel</button>
                    <button onClick={handleGlobalRegeneration} disabled={!regenInstructions.trim()} className="px-6 py-3 bg-[#163E93] text-white font-bold text-xs uppercase tracking-widest hover:bg-[#051C2C] flex items-center gap-2 disabled:opacity-50">Regenerate</button>
                </div>
             </div>
        </div>
      )}

      {showGlobalVisualEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-white max-w-lg w-full shadow-2xl border-l-8 border-purple-600 p-8 flex flex-col gap-6 relative">
                 <button onClick={() => setShowGlobalVisualEditModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                 <div>
                    <h3 className="text-3xl font-bold text-[#051C2C] font-serif mb-2 flex items-center gap-3"><Paintbrush className="w-8 h-8 text-purple-600" />Global Visual Edit</h3>
                </div>
                <div className="flex flex-col gap-3">
                    <label className="text-xs font-bold text-purple-600 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3" />Edit Instruction (Applied to ALL slides)</label>
                    <textarea 
                        value={globalVisualEditInstruction}
                        onChange={(e) => setGlobalVisualEditInstruction(e.target.value)}
                        placeholder="e.g., 'Change the background to dark blue', 'Make all charts green', 'Remove the footer'..."
                        className="w-full h-40 p-4 bg-purple-50/50 border-2 border-purple-100 text-sm focus:border-purple-600 focus:bg-white focus:outline-none resize-none rounded-sm"
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowGlobalVisualEditModal(false)} className="px-6 py-3 border border-gray-300 text-gray-600 font-bold text-xs uppercase tracking-widest hover:bg-gray-50">Cancel</button>
                    <button onClick={handleGlobalVisualEdit} disabled={!globalVisualEditInstruction.trim()} className="px-6 py-3 bg-purple-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-purple-800 flex items-center gap-2 disabled:opacity-50">Apply to All</button>
                </div>
             </div>
        </div>
      )}

      {showBuildConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white max-w-lg w-full shadow-2xl border border-gray-200 p-8 flex flex-col gap-6">
                <div><h3 className="text-2xl font-bold text-[#051C2C] font-serif mb-2">Finalize Production Parameters</h3></div>
                <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#051C2C] uppercase tracking-wider">Global Instructions (Optional)</label>
                    <textarea value={buildInstructions} onChange={(e) => setBuildInstructions(e.target.value)} placeholder="e.g. Use more figures..." className="w-full h-32 p-4 bg-gray-50 border border-gray-200 text-sm focus:border-[#051C2C] focus:bg-white focus:outline-none resize-none" />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button onClick={() => setShowBuildConfirm(false)} className="px-6 py-3 border border-gray-300 text-gray-600 font-bold text-xs uppercase tracking-widest">Cancel</button>
                    <button onClick={startConstruction} className="px-6 py-3 bg-[#051C2C] text-white font-bold text-xs uppercase tracking-widest hover:bg-[#163E93] flex items-center gap-2"><Wand2 className="w-4 h-4" />Start Production</button>
                </div>
            </div>
        </div>
      )}

      <header className="h-20 border-b border-gray-200 bg-white flex items-center justify-between px-8 shadow-sm z-40 sticky top-0">
        <div className="flex items-center">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-70 transition-opacity" onClick={() => { if(confirm("Reset project?")) setView('landing'); }}>
                <span className="font-serif font-bold text-2xl tracking-tighter text-[#051C2C]">Strategy<span className="text-[#163E93]">.AI</span></span>
                <div className="h-4 w-[1px] bg-gray-300 mx-2"></div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Workspace</span>
            </div>
            <div className="hidden lg:flex items-center gap-6 ml-8">
                 <a 
                    href="http://www.strategyaimanual.com/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#163E93] transition-colors flex items-center gap-1.5"
                >
                    <GraduationCap className="w-3 h-3" />
                    用户手册
                </a>
                <a 
                    href="https://aistudio.google.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#163E93] transition-colors flex items-center gap-1.5"
                >
                    <Key className="w-3 h-3" />
                    Gemini API Key
                </a>
            </div>
        </div>
        
        {/* TOP CONTROL BAR */}
        <div className="flex items-center gap-4">
            
            {status.stage === 'outline-review' && (
                <button onClick={() => setShowBuildConfirm(true)} className="bg-[#163E93] hover:bg-blue-800 text-white px-8 py-3 rounded-none font-bold text-xs uppercase tracking-[0.15em] shadow-lg flex items-center gap-3 transition-all">
                    <Wand2 className="w-4 h-4" /> Build Final Deck
                </button>
            )}

            {/* PAUSE / RESUME CONTROLS */}
            {status.stage === 'constructing-deck' && (
                <button 
                    onClick={handlePause}
                    disabled={isPausing}
                    className={`
                        ${isPausing ? 'bg-amber-50 text-amber-500 border-amber-200' : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'}
                        px-6 py-3 rounded-none font-bold text-xs uppercase tracking-[0.15em] flex items-center gap-3 transition-all
                    `}
                >
                    {isPausing ? <Loader2 className="w-4 h-4 animate-spin"/> : <PauseCircle className="w-4 h-4" />}
                    {isPausing ? 'Stopping...' : 'Pause Generation'}
                </button>
            )}

            {status.stage === 'paused' && (
                <div className="px-6 py-3 bg-amber-50 border border-amber-200 text-amber-600 font-bold text-xs uppercase tracking-[0.15em] flex items-center gap-2">
                    <PauseCircle className="w-4 h-4" /> Production Paused
                </div>
            )}

                             {(status.stage === 'finished' || status.stage === 'paused') && (
                             <>
                             {status.stage !== 'paused' && (
                                 <div className="flex gap-2 mr-2">
                                     <button onClick={() => { setRegenInstructions(''); setShowRegenerateModal(true); }} disabled={isExporting || isUpscaling || isGlobalVisualEditing} className="bg-[#163E93] hover:bg-[#051C2C] text-white px-4 py-3 rounded-none font-bold text-xs uppercase tracking-[0.15em] flex items-center gap-2 transition-all disabled:opacity-50 shadow-md">
                                         <RefreshCw className="w-4 h-4" /> Director's Cut
                                     </button>
                                     <button onClick={() => { setGlobalVisualEditInstruction(''); setShowGlobalVisualEditModal(true); }} disabled={isExporting || isUpscaling || isGlobalVisualEditing} className="bg-purple-600 hover:bg-purple-800 text-white px-4 py-3 rounded-none font-bold text-xs uppercase tracking-[0.15em] flex items-center gap-2 transition-all disabled:opacity-50 shadow-md">
                                         {isGlobalVisualEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paintbrush className="w-4 h-4" />} {isGlobalVisualEditing ? 'Applying...' : 'Global Visual Edit'}
                                     </button>
                                 </div>
                             )}
             
                             <button onClick={handleUpscaleDeck} disabled={isUpscaling || isExporting || status.stage === 'paused' || isGlobalVisualEditing} className="bg-white text-[#163E93] border border-[#163E93] hover:bg-blue-50 px-6 py-3 rounded-none font-bold text-xs uppercase tracking-[0.15em] shadow-sm flex items-center gap-3 transition-all disabled:opacity-50">
                                 {isUpscaling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Monitor className="w-4 h-4" />} {isUpscaling ? 'Upscale (4K)' : 'Upscale (4K)'}
                             </button>
                             <button onClick={handleExportPDF} disabled={isExporting || isUpscaling || status.stage === 'paused' || isGlobalVisualEditing} className="bg-[#051C2C] hover:bg-black text-white px-8 py-3 rounded-none font-bold text-xs uppercase tracking-[0.15em] shadow-lg flex items-center gap-3 transition-all disabled:opacity-50">
                                 {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {isExporting ? 'Exporting...' : 'Export PDF'}
                             </button>                </>
            )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="w-[320px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0 z-10 h-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Narrative Arc</h3>
                <span className="text-[9px] bg-gray-100 px-2 py-1 rounded text-gray-500 font-bold">{outline.length} Slides</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-32">
                {(status.stage === 'constructing-deck' || status.stage === 'finished' || status.stage === 'paused' ? slides : outline.map(o => ({ id: o.id, title: o.title, type: o.suggestedSlideType, status: 'draft' })))
                // FILTER: Hide Master Style Guide ONLY during Outline Review
                .filter((item: any) => status.stage === 'outline-review' ? (item.slideType !== SlideType.MasterStyleGuide && item.type !== SlideType.MasterStyleGuide) : true)
                .map((item: any, idx) => {
                    // Logic to handle "Hidden" slide index offset if we were hiding it
                    // But now we show it in finished state, so we need robust index handling
                    
                    // If we are in 'outline-review', the array is already filtered, so idx 0 is actually Slide 1 (Title).
                    // If we are in 'finished', the array includes Model Page at 0.
                    
                    const isModelPage = (item.slideType === SlideType.MasterStyleGuide || item.type === SlideType.MasterStyleGuide);
                    const displayIndex = status.stage === 'outline-review' ? idx + 1 : idx; // 1-based for Outline View
                    const displayLabel = isModelPage ? "Model Page" : `Slide ${displayIndex}`;
                    
                    // Click Handler Index:
                    // In 'outline-review', we filtered 0 out. So idx 0 corresponds to data-array index 1.
                    // In 'finished', idx 0 is data-array index 0.
                    const clickIndex = status.stage === 'outline-review' ? idx + 1 : idx;

                    return (
                        <div 
                        key={item.id} 
                        onClick={() => setCurrentSlideIdx(clickIndex)}
                        className={`p-4 border-l-4 transition-all cursor-pointer group relative
                            ${currentSlideIdx === clickIndex ? 'bg-blue-50 border-[#163E93]' : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'}
                        `}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${currentSlideIdx === clickIndex ? 'text-[#163E93]' : 'text-gray-400'}`}>
                                    {displayLabel}
                                </span>
                                <span className="text-[9px] text-gray-300 uppercase">{(item.slideType || item.suggestedSlideType || "Generic").split(' ')[0]}</span>
                            </div>
                            <p className={`text-sm font-serif font-bold leading-tight line-clamp-3 ${currentSlideIdx === clickIndex ? 'text-[#051C2C]' : 'text-gray-500'}`}>{item.actionTitle || item.title}</p>
                            <div className="flex items-center gap-2 mt-2">
                                {status.stage !== 'outline-review' && (
                                    item.status === 'generating_text' ? <span className="text-[9px] text-[#163E93] font-bold uppercase flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Blueprinting</span> : 
                                    item.status === 'generating_visual' ? <span className="text-[9px] text-purple-600 font-bold uppercase flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Rendering</span> : 
                                    item.status === 'upscaling' ? <span className="text-[9px] text-purple-600 font-bold uppercase flex items-center gap-1"><Sparkles className="w-3 h-3 animate-pulse"/> Upscaling</span> : 
                                    item.status === 'pending' ? <span className="text-[9px] text-gray-400 font-bold uppercase flex items-center gap-1"><Clock className="w-3 h-3 animate-pulse"/> Queued</span> : 
                                    item.status === 'complete' ? <span className="text-[9px] text-emerald-600 font-bold uppercase flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Ready</span> : 
                                    item.status === 'error' ? <span className="text-[9px] text-red-500 font-bold uppercase flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Failed</span> : null
                                )}
                            </div>
                            {status.stage === 'outline-review' && currentSlideIdx === clickIndex && (
                                <button onClick={(e) => { e.stopPropagation(); removeOutlineItem(item.id); }} className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        <div className="flex-1 bg-[#F8FAFC] flex flex-col relative overflow-hidden h-full">
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#051C2C 1px, transparent 1px), linear-gradient(90deg, #051C2C 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
             
             <div className="flex-1 overflow-y-auto flex flex-col items-center p-8 pb-40">
                 {status.stage === 'outline-review' && outline[currentSlideIdx] ? (
                    <div className="w-full max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white shadow-xl border border-gray-200 p-10 relative">
                             <div className="absolute top-0 left-0 w-full h-1 bg-[#163E93]"></div>
                             <div className="mb-6">
                                 <div className="flex justify-between items-center mb-2">
                                     <span className="text-[#163E93] text-xs font-bold uppercase tracking-[0.15em]">Slide {currentSlideIdx + 1} • {outline[currentSlideIdx].suggestedSlideType}</span>
                                     {/* NEW: DISPLAY LAYOUT PATH */}
                                     {outline[currentSlideIdx].layoutFilePath && (
                                         <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 truncate max-w-[200px]" title={outline[currentSlideIdx].layoutFilePath}>
                                             Layout: {outline[currentSlideIdx].layoutFilePath.split('/').pop()?.replace('.md','')}
                                         </span>
                                     )}
                                 </div>
                                 <h2 className="text-3xl font-bold text-[#051C2C] font-serif leading-tight">{outline[currentSlideIdx].title}</h2>
                             </div>
                             <div className="bg-slate-50 p-6 border-l-2 border-[#051C2C] mb-8">
                                 <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Executive Summary</h4>
                                 <p className="text-base text-gray-700 font-serif italic leading-relaxed">"{outline[currentSlideIdx].executiveSummary}"</p>
                             </div>
                             <div>
                                 <h4 className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Evidence & Key Points</h4>
                                 <div className="grid grid-cols-1 gap-3">
                                     {outline[currentSlideIdx].keyPoints?.map((kp, i) => (
                                         <div key={i} className="flex items-start gap-3 text-sm text-gray-600 bg-white border border-gray-100 p-3 hover:border-gray-300 transition-colors">
                                             <div className="w-1.5 h-1.5 bg-[#163E93] mt-1.5 flex-shrink-0 rounded-full"></div>
                                             <span className="leading-relaxed">{kp}</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                        </div>
                        <div className="bg-white border border-gray-200 p-4 flex gap-4 items-center shadow-sm">
                             <div className="bg-gray-100 p-2 rounded-full text-gray-500"><Edit3 className="w-4 h-4" /></div>
                             <div className="flex-1 relative">
                                <textarea
                                    value={slideRefineInput}
                                    onChange={(e) => setSlideRefineInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSlideRefine(); } }}
                                    placeholder={`Modify Slide ${currentSlideIdx + 1} outline (maintains history)...`}
                                    disabled={isRefiningSlide}
                                    rows={2}
                                    className="w-full bg-transparent text-sm font-medium text-[#051C2C] placeholder:text-gray-400 focus:outline-none resize-none py-2"
                                />
                             </div>
                             <button onClick={handleSlideRefine} disabled={!slideRefineInput.trim() || isRefiningSlide} className="text-[#163E93] font-bold text-xs uppercase tracking-wider hover:text-[#051C2C] disabled:opacity-50 transition-colors">
                                 {isRefiningSlide ? 'Updating...' : 'Update Slide'}
                             </button>
                        </div>
                    </div>
                 ) : (
                    <div className="w-full max-w-5xl space-y-6">
                        {/* UNDO SINGLE SLIDE BUTTON */}
                        {slides[currentSlideIdx]?.history && slides[currentSlideIdx].history!.length > 0 && status.stage !== 'paused' && (
                            <div className="w-full flex justify-end">
                                <button onClick={handleUndoSlide} className="text-gray-500 hover:text-red-600 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 bg-white px-3 py-1.5 rounded shadow-sm border border-gray-200 transition-colors hover:bg-gray-50">
                                    <History className="w-3 h-3" />
                                    Undo (Revert to V{slides[currentSlideIdx].history!.length})
                                </button>
                            </div>
                        )}

                        {/* PAUSED STATE OVERLAY FOR PENDING SLIDES */}
                        {status.stage === 'paused' && (slides[currentSlideIdx]?.status === 'pending' || slides[currentSlideIdx]?.status === 'generating_text' || slides[currentSlideIdx]?.status === 'generating_visual') ? (
                             <div className="w-full aspect-[16/9] shadow-2xl bg-white border border-gray-200 flex flex-col relative animate-in fade-in zoom-in-95 duration-300">
                                 <div className="absolute inset-0 bg-amber-50/50 backdrop-blur-[2px] z-10"></div>
                                 <div className="z-20 absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                                     <div className="bg-white p-8 shadow-2xl border-t-8 border-amber-400 max-w-xl w-full">
                                         <div className="mb-4 flex flex-col items-center">
                                             <div className="p-4 bg-amber-100 rounded-full mb-4">
                                                 <Pause className="w-8 h-8 text-amber-600" />
                                             </div>
                                             <h3 className="text-2xl font-bold text-[#051C2C] font-serif">Production Halted</h3>
                                             <p className="text-sm text-gray-500 mt-2 font-medium">Review completed slides or adjust strategy for the remaining deck.</p>
                                         </div>
                                         
                                         <div className="mb-6 text-left">
                                             <label className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                 <Sliders className="w-3 h-3" />
                                                 Adjust Upcoming Slides (Optional)
                                             </label>
                                             <textarea 
                                                 value={pauseInstruction}
                                                 onChange={(e) => setPauseInstruction(e.target.value)}
                                                 placeholder="e.g., 'Make the remaining charts green' or 'Focus more on risks for the next slides'..."
                                                 className="w-full h-24 p-3 bg-amber-50 border border-amber-200 focus:border-amber-400 focus:bg-white text-sm outline-none resize-none transition-all placeholder:text-amber-300/50"
                                             />
                                         </div>

                                         <button 
                                             onClick={resumeConstruction}
                                             className="w-full py-4 bg-[#051C2C] hover:bg-[#163E93] text-white font-bold text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-lg group"
                                         >
                                             <PlayCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                             Resume Production
                                         </button>
                                     </div>
                                 </div>
                             </div>
                        ) : (
                            /* STANDARD SLIDE VIEW */
                            <div className="w-full aspect-[16/9] shadow-2xl bg-white relative flex flex-col transition-all duration-500">
                                {slides[currentSlideIdx] && slides[currentSlideIdx].status !== 'pending' ? (
                                    <SlideView 
                                        slide={slides[currentSlideIdx]} 
                                        style={consultingStyle} 
                                        onRegenerateImage={handleFinalSlideRefine}
                                        onRetry={handleRetrySlide}
                                        onEnforceStyle={handleEnforceMasterStyle}
                                        onSmartLayout={handleSmartLayoutRecommendation}
                                    />
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-12 text-center bg-white">
                                        <div className="relative">
                                            <div className="w-20 h-20 border-4 border-gray-100 border-t-[#051C2C] rounded-full animate-spin"></div>
                                            <div className="absolute inset-0 flex items-center justify-center font-serif font-bold text-xl text-[#051C2C]">{currentSlideIdx + 1}</div>
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-bold text-[#051C2C] font-serif mb-2">Constructing Slide...</h3>
                                            <p className="text-xs text-[#163E93] font-bold uppercase tracking-[0.2em] animate-pulse">
                                                {slides[currentSlideIdx]?.status === 'pending' ? 'In Queue' : 'Processing'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {/* LAYOUT INDICATOR (Outside Canvas) */}
                                {slides[currentSlideIdx]?.layoutFilePath && (
                                    <div className="absolute bottom-[-24px] right-0 bg-gray-100 text-gray-500 text-[9px] px-2 py-0.5 rounded-b font-mono border border-t-0 border-gray-200 opacity-70 hover:opacity-100 transition-opacity">
                                        Layout: {slides[currentSlideIdx].layoutFilePath?.split('/').pop()?.replace('.md','')}
                                    </div>
                                )}
                            </div>
                        )}

                        {(status.stage === 'finished' || status.stage === 'paused') && (
                            <div className={`bg-white border border-gray-200 p-4 flex gap-4 items-center shadow-sm animate-in fade-in slide-in-from-bottom-2 ${status.stage === 'paused' ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                <div className="bg-[#163E93] p-2 text-white"><Sparkles className="w-4 h-4" /></div>
                                
                                {/* REF IMAGE UPLOAD */}
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="file" 
                                        id="ref-image-upload" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={(e) => handleRefineImageUpload(e.target.files)}
                                    />
                                    {visualRefineImage ? (
                                        <div className="relative group">
                                            <img src={visualRefineImage.base64} alt="Ref" className="w-10 h-10 object-cover rounded border border-gray-200" />
                                            <button 
                                                onClick={() => setVisualRefineImage(null)}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label htmlFor="ref-image-upload" className="cursor-pointer p-2 hover:bg-gray-100 rounded text-gray-500 transition-colors" title="Attach Reference Image">
                                            <Upload className="w-4 h-4" />
                                        </label>
                                    )}
                                </div>

                                <div className="flex-1 relative">
                                    <textarea
                                        value={slideRefineInput}
                                        onChange={(e) => setSlideRefineInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                // Trigger regenerate if not empty
                                                if(slideRefineInput.trim()) handleFinalSlideRefine();
                                            }
                                        }}
                                        placeholder={`Refine Slide ${currentSlideIdx + 1} (Context-aware: I remember previous edits)...`}
                                        disabled={isRefiningSlide}
                                        rows={3}
                                        className="w-full bg-transparent text-sm font-medium text-[#051C2C] placeholder:text-gray-400 focus:outline-none resize-none py-2"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleFinalSlideRefine} disabled={!slideRefineInput.trim() || isRefiningSlide || slides[currentSlideIdx]?.slideType === SlideType.Imported} className="bg-gray-100 hover:bg-gray-200 text-[#051C2C] px-4 py-2 font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-colors border border-gray-200 disabled:cursor-not-allowed">
                                        {isRefiningSlide ? 'Processing...' : 'Regenerate Logic'}
                                    </button>
                                    <button onClick={handleSlideModify} disabled={!slideRefineInput.trim() || isRefiningSlide} className="bg-[#051C2C] hover:bg-[#163E93] text-white px-4 py-2 font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-colors flex items-center gap-2">
                                        <Paintbrush className="w-3 h-3" /> {isRefiningSlide ? 'Modifying...' : 'Visual Edit'}
                                    </button>
                                    <button onClick={handleSingleSlideUpscale} disabled={isRefiningSlide || slides[currentSlideIdx]?.status === 'upscaling'} className="bg-white hover:bg-blue-50 text-[#163E93] border border-[#163E93] px-4 py-2 font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-colors flex items-center gap-2">
                                        {slides[currentSlideIdx]?.status === 'upscaling' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Monitor className="w-3 h-3" />} Upscale (4K)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                 )}
             </div>

             {status.stage === 'outline-review' && (
                 <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-6 z-20 shadow-[0_-5px_25px_rgba(0,0,0,0.05)]">
                     <div className="max-w-4xl mx-auto flex gap-4 items-center">
                         <div className="flex flex-col items-center justify-center w-10 h-10 bg-[#051C2C] text-white"><Layers className="w-5 h-5" /></div>
                         <div className="flex-1">
                             <textarea 
                                value={globalRefineInput}
                                onChange={(e) => setGlobalRefineInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGlobalRefine(); } }}
                                placeholder="Refine the entire structure (linear history preserved)..."
                                disabled={isRefining}
                                rows={2}
                                className="w-full text-[#051C2C] font-medium placeholder:text-gray-400 focus:outline-none bg-transparent py-2 resize-none"
                             />
                             {isRefining && <p className="text-[10px] text-[#163E93] font-bold uppercase tracking-wider mt-1 animate-pulse">Restructuring Deck...</p>}
                         </div>
                         <button onClick={handleGlobalRefine} disabled={!globalRefineInput.trim() || isRefining} className="bg-[#163E93] hover:bg-[#051C2C] text-white px-6 py-3 font-bold text-xs uppercase tracking-[0.15em] transition-colors disabled:opacity-50">Refine Structure</button>
                     </div>
                 </div>
             )}
        </div>
      </main>
    </div>
  );
};

export default App;