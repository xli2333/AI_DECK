export enum SlideType {
  MasterStyleGuide = "Master Style Guide",
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

export type ConsultingStyle = 'mckinsey' | 'bcg' | 'bain' | 'internet' | 'custom';

export interface TypographySpec {
  fontFamily: string;
  fontFamilyChinese?: string;
  fontSize: number; // pt
  color: string;    // hex
  fontWeight?: string;
  lineHeight?: number;
}

export interface MasterStyleConfig {
  themeReference: string; // e.g. "McKinsey", "Internet"
  backgroundColor: string; // Default #FFFFFF unless overridden
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string[];
    chartColors: string[];
  };
  typography: {
    title: TypographySpec;
    subtitle: TypographySpec;
    sectionHeader: TypographySpec;
    bodyL1: TypographySpec;
    bodyL2: TypographySpec;
    bodyL3: TypographySpec;
  };
}

export interface OutlineItem {
    id: string;
    title: string;
    executiveSummary: string;
    keyPoints: string[];
    suggestedSlideType: SlideType;
    layoutFilePath?: string; // NEW: Path to the specific local prompt file (e.g. for BCG)
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
  layoutElements?: LayoutElement[]; // New field for MBB style precision layouts
  layoutFilePath?: string; // Persist the specific layout file path (BCG/MBB)
  masterStyle?: MasterStyleConfig; // NEW: Only present on the first slide (Index 0)
  imageBase64?: string;
  isHighRes?: boolean;
  status: 'pending' | 'generating_text' | 'generating_visual' | 'upscaling' | 'complete' | 'error';
  currentStep?: string; // Granular status message (e.g. "Analyzing...", "Rendering...")
  dataPoints?: string[];
  history?: Omit<SlideData, 'history'>[];
}

export interface SlideElement {
  content: string;
  // 坐标 [ymin, xmin, ymax, xmax] (0-1000 scale)
  box: [number, number, number, number]; 
  style: {
    fontSize: number; // pt
    color: string;    // hex
    align?: 'left' | 'center' | 'right';
  };
}

export interface LayoutElement {
  id: string;
  type: 'text' | 'title' | 'subtitle' | 'image' | 'chart' | 'shape';
  content: string; // The text to display OR the prompt for the image/chart
  position: {
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    width: number; // Percentage 0-100
    height: number; // Percentage 0-100
  };
  style?: {
    fontSize?: number; // relative scale usually
    color?: string;
    backgroundColor?: string;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    zIndex?: number;
    border?: string;
  };
  generatedImage?: string; // If type is image/chart, this holds the base64 result
}

// 最终处理结果
export interface RemasteredSlideData {
  originalImage: string;   // Base64 原图
  cleanBackground: string; // Base64 (Nanobanana 输出的无打印字背景)
  elements: SlideElement[]; // OCR 提取的文字
}

export interface LayoutRecommendation {
  id: string;
  name: string;      // e.g., "Vertical Ranking Bar Chart"
  description: string; // e.g., "Best for comparing entities..."
  reason: string;      // e.g., "Your content emphasizes top performers..."
  layoutFilePath: string; // e.g., "Prompts/Bain Prompts/..."
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