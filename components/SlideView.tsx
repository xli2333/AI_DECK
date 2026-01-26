
import React from 'react';
import { SlideData, ConsultingStyle } from '../types';
import { Loader2, AlertCircle, Sparkles, Monitor, Palette, FileText } from 'lucide-react';

interface SlideViewProps {
  slide: SlideData;
  style: ConsultingStyle;
  onRegenerateImage?: () => void;
  onRetry?: () => void;
}

const SlideView: React.FC<SlideViewProps> = ({ slide, style, onRegenerateImage, onRetry }) => {
  // Define style-specific colors
  const getColors = () => {
      switch (style) {
          case 'bcg': return { text: '#00291C', accent: '#4ecb61', border: '#00291C' };
      case 'bain': return { text: '#CB2026', accent: '#CB2026', border: '#CB2026' };
      case 'internet': return { text: '#0052D9', accent: '#0052D9', border: '#0052D9' };
      default: return { text: '#051C2C', accent: '#051C2C', border: '#051C2C' };
      }
  };
  const colors = getColors();

  // IF IMAGE EXISTS: Render the full slide image
  if (slide.imageBase64 && slide.status !== 'error') {
      return (
        <div className="w-full aspect-[16/9] relative group shadow-2xl bg-white border border-gray-200 overflow-hidden">
            {/* 4K Badge */}
            {slide.isHighRes && (
                <div className="absolute top-0 left-0 text-white text-[10px] font-bold px-2 py-1 rounded-br z-10 shadow-md flex items-center gap-1"
                     style={{ backgroundColor: colors.text }}>
                    <Monitor className="w-3 h-3" />
                    4K ULTRA HD
                </div>
            )}
            
            {/* Upscaling Overlay */}
            {slide.status === 'upscaling' && (
                <div className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in">
                     <Sparkles className="w-12 h-12 mb-4 animate-spin" style={{ color: colors.accent }} />
                     <h3 className="text-white font-bold text-xl font-serif">Upscaling to 4K...</h3>
                     <p className="text-gray-300 text-xs uppercase tracking-widest mt-2">Enhancing Typography & Vectors</p>
                </div>
            )}

            <img 
                src={slide.imageBase64} 
                alt={slide.actionTitle} 
                className="w-full h-full object-contain"
            />
            {onRegenerateImage && slide.status !== 'upscaling' && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={onRegenerateImage}
                        className="bg-white/90 hover:bg-white px-4 py-2 rounded shadow-lg border border-gray-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                        style={{ color: colors.text }}
                    >
                        <Sparkles className="w-3 h-3" />
                        Regenerate Visual
                    </button>
                </div>
            )}
        </div>
      );
  }

  // IF NO IMAGE (BLUEPRINT MODE): Render the text layout with loading overlays
  return (
    <div 
        className="aspect-[16/9] w-full bg-white p-10 flex flex-col shadow-2xl border border-gray-200 relative overflow-hidden font-sans"
        style={{ color: colors.text }}
    >
      
      {/* 1. BLUEPRINTING OVERLAY (Generating Text) */}
      {slide.status === 'generating_text' && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-[2px] z-20 flex flex-col items-center justify-center animate-in fade-in duration-300">
               <div className="flex items-center gap-3 mb-6">
                  <div className="relative">
                      <div className="w-12 h-12 border-2 border-gray-100 rounded-full"></div>
                      <div className="absolute inset-0 border-2 rounded-full animate-spin" style={{ borderTopColor: colors.text, borderRightColor: colors.text }}></div>
                      <FileText className="absolute inset-0 m-auto w-5 h-5" style={{ color: colors.text }} />
                  </div>
               </div>
               <h3 className="text-2xl font-serif font-bold mb-2" style={{ color: colors.text }}>Structural Analysis</h3>
               <div className="flex flex-col gap-2 w-64">
                  <div className="h-1 bg-gray-100 overflow-hidden w-full rounded-full">
                      <div className="h-full animate-[translateX_1.5s_ease-in-out_infinite] w-1/2 rounded-full" style={{ backgroundColor: colors.text }}></div>
                  </div>
                  <p className="text-[10px] text-center font-bold uppercase tracking-widest text-gray-400">
                      {slide.currentStep || "Synthesizing Logic & Data"}
                  </p>
               </div>
          </div>
      )}

      {/* 2. RENDERING OVERLAY (Generating Visual) */}
      {slide.status === 'generating_visual' && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="w-16 h-16 border-4 rounded-full animate-spin mb-6 relative" 
                   style={{ borderColor: `${colors.text}10`, borderTopColor: colors.accent }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Palette className="w-6 h-6" style={{ color: colors.accent }} />
                    </div>
              </div>
              <h3 className="text-2xl font-bold font-serif mb-2" style={{ color: colors.text }}>Rendering Visuals</h3>
              <p className="text-xs font-bold uppercase tracking-[0.2em] animate-pulse" style={{ color: colors.accent }}>
                  {slide.currentStep || "Generating Pixel-Perfect Slide"}
              </p>
          </div>
      )}

      {/* 3. ERROR OVERLAY */}
      {slide.status === 'error' && (
           <div className="absolute inset-0 bg-red-50/95 z-30 flex flex-col items-center justify-center text-center p-8 backdrop-blur-sm">
               <div className="bg-white p-6 rounded-lg shadow-xl border border-red-100 max-w-sm">
                   <AlertCircle className="w-10 h-10 text-red-500 mb-4 mx-auto" />
                   <h3 className="text-lg font-bold text-red-900 font-serif mb-1">Generation Failed</h3>
                   <p className="text-xs text-red-600 mb-6 leading-relaxed">
                       {slide.subtitle === 'Generation Failed' ? 'The AI model timed out or encountered an error.' : slide.subtitle}
                   </p>
                   {onRetry && (
                       <button onClick={onRetry} className="w-full bg-red-600 text-white px-6 py-3 font-bold text-xs uppercase tracking-wider hover:bg-red-700 shadow-md transition-colors flex items-center justify-center gap-2">
                           <Sparkles className="w-3 h-3" /> Retry Generation
                       </button>
                   )}
               </div>
           </div>
      )}

      {/* Header Section (Blueprint) */}
      <div className="mb-6 border-b-2 pb-4 opacity-50" style={{ borderColor: `${colors.text}33` }}>
        <h1 className="text-3xl font-bold leading-tight mb-2 tracking-tight font-serif" style={{ color: colors.text }}>
          {slide.actionTitle || "Drafting Headline..."}
        </h1>
        {slide.subtitle && (
            <p className="text-sm font-medium uppercase tracking-wider text-gray-600">
                {slide.subtitle}
            </p>
        )}
      </div>

      {/* Main Content Area (Blueprint) */}
      <div className="flex-1 flex gap-8 min-h-0 opacity-50">
        
        {/* Text Column */}
        <div className="w-[40%] flex flex-col gap-5">
          {slide.bodyContent && slide.bodyContent.length > 0 ? (
            slide.bodyContent.map((point, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className="w-1.5 h-1.5 mt-2 flex-shrink-0" style={{ backgroundColor: colors.accent }} />
                <p className="text-[14px] text-gray-800 leading-relaxed font-normal">
                    {point}
                </p>
              </div>
            ))
          ) : (
            <div className="space-y-4">
                <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-gray-100 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-gray-100 rounded w-5/6 animate-pulse"></div>
            </div>
          )}
        </div>

        {/* Visual Column Placeholder */}
        <div className="w-[60%] border border-dashed border-gray-300 bg-gray-50 rounded flex flex-col items-center justify-center p-4">
            <div className="text-center mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Visual Blueprint</p>
                <p className="text-sm font-serif mb-1" style={{ color: colors.accent }}>{slide.visualSpecification.chartType || "Pending..."}</p>
            </div>
            
            {/* Show Data Points being extracted */}
            {(slide as any).dataPoints && (slide as any).dataPoints.length > 0 && (
                <div className="bg-white p-3 rounded border text-left w-full max-w-[300px]" style={{ borderColor: `${colors.accent}33` }}>
                    <p className="text-[9px] font-bold uppercase mb-2" style={{ color: colors.text }}>Extracted Data Points:</p>
                    <div className="space-y-1">
                        {(slide as any).dataPoints.map((dp: string, i: number) => (
                            <div key={i} className="text-[10px] text-gray-600 truncate">• {dp}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Footer (Blueprint) */}
      <div className="mt-auto pt-4 flex justify-between items-end text-[8px] text-gray-300 font-medium uppercase tracking-widest border-t border-gray-100 opacity-50">
        <div>{slide.footer?.source || "Source: Analysis"}</div>
        <div>{slide.footer?.disclaimer || "CONFIDENTIAL"}</div>
      </div>
    </div>
  );
};

export default SlideView;
