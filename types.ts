export enum SlideType {
  Title = "Title Slide",
  ExecutiveSummary = "Executive Summary",
  TwoColumnText = "2-Column Text",
  ThreeColumnArgument = "3-Column Argument",
  WaterfallChart = "Waterfall Chart",
  MekkoChart = "Mekko Chart",
  BarChart = "Bar Chart",
  TableHarveyBalls = "Table with Harvey Balls",
  Imported = "Imported Slide"
}

export type ConsultingStyle = 'mckinsey' | 'bcg' | 'bain' | 'custom';

export interface OutlineItem {
  id: string;
  title: string;
  executiveSummary: string; 
  suggestedSlideType: SlideType;
  keyPoints: string[];
}

export interface SlideData {
  id: string;
  slideType: SlideType;
  actionTitle: string;
  subtitle?: string;
  visualSpecification: {
    chartType: string;
    axesVariables: string;
    keyInsight: string;
    annotation: string;
    fullImagePrompt: string;
  };
  bodyContent: string[];
  footer: {
    source: string;
    disclaimer: string;
  };
  imageBase64?: string;
  isHighRes?: boolean;
  status: 'pending' | 'generating_text' | 'generating_visual' | 'upscaling' | 'complete' | 'error';
  currentStep?: string; // Granular status message (e.g. "Analyzing...", "Rendering...")
  dataPoints?: string[];
  history?: Omit<SlideData, 'history'>[];
}

export interface GenerationState {
  stage: 'idle' | 'style-selection' | 'analyzing-outline' | 'outline-review' | 'constructing-deck' | 'finished' | 'paused';
  progress?: {
    current: number;
    total: number;
    status: string;
  };
  error?: string;
}