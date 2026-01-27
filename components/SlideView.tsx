
import React from 'react';
import { SlideData, ConsultingStyle, SlideType } from '../types';
import { Loader2, AlertCircle, Sparkles, Monitor, Palette, FileText, Type, LayoutDashboard } from 'lucide-react';

interface SlideViewProps {
  slide: SlideData;
  style: ConsultingStyle;
  onRegenerateImage?: () => void;
  onRetry?: () => void;
  onEnforceStyle?: () => void; // NEW: Callback for Master Style Enforcement
  onSmartLayout?: () => void; // NEW: Callback for Smart Layout Recommendations
}

const SlideView: React.FC<SlideViewProps> = ({ slide, style, onRegenerateImage, onRetry, onEnforceStyle, onSmartLayout }) => {
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

  // --- NEW: MASTER STYLE GUIDE RENDERING (Code-Based) ---
  if ((slide.slideType === SlideType.MasterStyleGuide || slide.masterStyle) && slide.status !== 'error') {
      const ms = slide.masterStyle!;
      if (!ms) return null; // Fallback if data missing

      return (
          <div className="w-full aspect-[16/9] relative shadow-2xl overflow-hidden flex flex-col p-8"
               style={{ backgroundColor: ms.backgroundColor, color: ms.colorPalette.primary }}>
              
              {/* Header */}
              <div className="border-b pb-4 mb-6 flex justify-between items-end" style={{ borderColor: `${ms.colorPalette.secondary}40` }}>
                  <div>
                      <h1 className="text-3xl font-serif font-bold mb-1" style={{ fontFamily: ms.typography.title.fontFamily, color: ms.typography.title.color }}>
                          {slide.actionTitle || "Design System Specification"}
                      </h1>
                      <p className="text-sm opacity-80 uppercase tracking-widest font-medium" style={{ fontFamily: ms.typography.subtitle.fontFamily, color: ms.typography.subtitle.color }}>
                          {slide.subtitle || "Master Visual Identity Guide"}
                      </p>
                  </div>
                  <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest font-bold mb-1 opacity-50">Identity System</div>
                      <div className="text-lg font-bold">{ms.themeReference}</div>
                  </div>
              </div>

              <div className="flex-1 flex gap-8 min-h-0">
                  {/* Left Column: Typography (Expanded) */}
                  <div className="flex-[1.5] space-y-4 overflow-hidden">
                      <div className="flex items-center gap-2 mb-2 opacity-50 border-b pb-1">
                          <Type size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Typography & Font Pairing</span>
                      </div>
                      
                      {/* Title Spec */}
                      <div className="bg-black/5 p-3 rounded-sm">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-[9px] font-mono opacity-60">
                                [TITLE] EN: {ms.typography.title.fontFamily} / CN: {ms.typography.title.fontFamilyChinese || 'None'} / {ms.typography.title.fontSize}pt / {ms.typography.title.color}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 border-l-2 pl-3" style={{ borderColor: ms.colorPalette.primary }}>
                              <div className="truncate" style={{ fontFamily: ms.typography.title.fontFamily, fontSize: '24px', fontWeight: 'bold' }}>
                                  Strategy Insight
                              </div>
                              {ms.typography.title.fontFamilyChinese && (
                                  <div className="truncate" style={{ fontFamily: ms.typography.title.fontFamilyChinese, fontSize: '24px', fontWeight: 'bold' }}>
                                      战略洞察结论
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Subtitle Spec */}
                      <div className="bg-black/5 p-3 rounded-sm">
                          <p className="text-[9px] font-mono mb-2 opacity-60">
                              [SUBTITLE] {ms.typography.subtitle.fontFamily} / {ms.typography.subtitle.fontSize}pt / {ms.typography.subtitle.color}
                          </p>
                          <div className="grid grid-cols-2 gap-4 border-l-2 pl-3" style={{ borderColor: ms.colorPalette.secondary }}>
                              <div className="truncate" style={{ fontFamily: ms.typography.subtitle.fontFamily, fontSize: '16px' }}>
                                  Analysis of key drivers
                              </div>
                              {ms.typography.subtitle.fontFamilyChinese && (
                                  <div className="truncate" style={{ fontFamily: ms.typography.subtitle.fontFamilyChinese, fontSize: '16px' }}>
                                      关键驱动因素分析
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Body Spec */}
                      <div className="grid grid-cols-2 gap-3">
                          <div className="bg-black/5 p-3 rounded-sm">
                              <p className="text-[9px] font-mono mb-2 opacity-60">BODY L1 / {ms.typography.bodyL1.fontSize}pt</p>
                              <div style={{ fontFamily: ms.typography.bodyL1.fontFamily, fontSize: '13px', lineHeight: 1.4 }}>
                                  Standard body text for analysis.
                              </div>
                              {ms.typography.bodyL1.fontFamilyChinese && (
                                  <div style={{ fontFamily: ms.typography.bodyL1.fontFamilyChinese, fontSize: '13px', marginTop: '2px' }}>
                                      标准正文分析文本展示。
                                  </div>
                              )}
                          </div>
                          <div className="bg-black/5 p-3 rounded-sm">
                              <p className="text-[9px] font-mono mb-2 opacity-60">BODY L2 / {ms.typography.bodyL2.fontSize}pt</p>
                              <div style={{ fontFamily: ms.typography.bodyL2.fontFamily, fontSize: '11px', opacity: 0.8 }}>
                                  Supporting data and annotations.
                              </div>
                              {ms.typography.bodyL2.fontFamilyChinese && (
                                  <div style={{ fontFamily: ms.typography.bodyL2.fontFamilyChinese, fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                                      支持性数据与注释文本。
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  {/* Right Column: Color Palette & Rules */}
                  <div className="flex-1 space-y-6">
                      <div className="flex items-center gap-2 mb-2 opacity-50 border-b pb-1">
                          <Palette size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Visual DNA & Palette</span>
                      </div>

                      {/* Primary Colors */}
                      <div className="grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-3 bg-white p-2 rounded shadow-sm ring-1 ring-black/5">
                              <div className="w-10 h-10 rounded-sm shrink-0" style={{ backgroundColor: ms.colorPalette.primary }}></div>
                              <div className="overflow-hidden">
                                  <div className="font-bold text-[10px] uppercase">Primary</div>
                                  <div className="font-mono text-[9px] opacity-60 truncate">{ms.colorPalette.primary}</div>
                              </div>
                          </div>
                          <div className="flex items-center gap-3 bg-white p-2 rounded shadow-sm ring-1 ring-black/5">
                              <div className="w-10 h-10 rounded-sm shrink-0" style={{ backgroundColor: ms.colorPalette.secondary }}></div>
                              <div className="overflow-hidden">
                                  <div className="font-bold text-[10px] uppercase">Secondary</div>
                                  <div className="font-mono text-[9px] opacity-60 truncate">{ms.colorPalette.secondary}</div>
                              </div>
                          </div>
                      </div>

                      {/* Chart Sequence */}
                      <div className="bg-white p-3 rounded shadow-sm ring-1 ring-black/5">
                          <div className="text-[9px] font-bold uppercase tracking-wider mb-3 opacity-40">Data Visualization Sequence</div>
                          <div className="flex justify-between gap-1">
                              {ms.colorPalette.chartColors.slice(0, 6).map((color, idx) => (
                                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                      <div className="w-full aspect-square rounded-sm" style={{ backgroundColor: color }}></div>
                                      <div className="font-mono text-[8px] opacity-40">{color.replace('#','')}</div>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Layout Rules (Placeholder/Decorative) */}
                      <div className="border-t pt-4">
                        <div className="text-[9px] font-bold uppercase tracking-wider mb-2 opacity-40">Standard Layout Rules</div>
                        <div className="grid grid-cols-3 gap-2 opacity-20">
                            <div className="aspect-video bg-current rounded-sm"></div>
                            <div className="aspect-video bg-current rounded-sm"></div>
                            <div className="aspect-video bg-current rounded-sm"></div>
                        </div>
                      </div>
                  </div>
              </div>

              {/* Footer System Info */}
              <div className="mt-auto pt-3 border-t flex justify-between text-[9px] font-mono opacity-30" style={{ borderColor: `${ms.colorPalette.primary}20` }}>
                  <div>ENGINE: STRATEGY.AI • SPEC_V3.1</div>
                  <div className="flex gap-4">
                      <span>RENDER_4K: ACTIVE</span>
                      <span>CSS_METHODOLOGY: CONSULTING_GRID</span>
                  </div>
              </div>
          </div>
      );
  }

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
            {slide.status !== 'upscaling' && (
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 items-end">
                    
                    {/* ENFORCE MASTER STYLE BUTTON */}
                    {onEnforceStyle && (
                        <button 
                            onClick={onEnforceStyle}
                            className="bg-[#051C2C]/90 hover:bg-[#051C2C] text-white px-4 py-2 rounded shadow-lg border border-gray-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                        >
                            <Palette className="w-3 h-3 text-emerald-400" />
                            Fix with Model Page
                        </button>
                    )}

                    {onSmartLayout && (
                        <button 
                            onClick={onSmartLayout}
                            className="bg-[#051C2C]/90 hover:bg-[#051C2C] text-white px-4 py-2 rounded shadow-lg border border-gray-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                        >
                            <LayoutDashboard className="w-3 h-3 text-amber-400" />
                            Smart Layout
                        </button>
                    )}

                    {onRegenerateImage && (
                        <button 
                            onClick={onRegenerateImage}
                            className="bg-white/90 hover:bg-white px-4 py-2 rounded shadow-lg border border-gray-200 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors"
                            style={{ color: colors.text }}
                        >
                            <Sparkles className="w-3 h-3" />
                            Regenerate Visual
                        </button>
                    )}
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
