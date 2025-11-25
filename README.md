# Strategy.AI Deck Builder

**Strategy.AI** 是一个基于 React 和 Google Gemini 3.0 Pro 模型的智能商业 PPT 生成引擎。它能够模拟顶级咨询公司（McKinsey, BCG, Bain）的逻辑框架和视觉风格，自动将你的文档或简短想法转化为专业的战略演示文稿。

![Project Banner](banner.png)

## 核心功能 (Core Features)

本项目不仅仅是一个“PPT生成器”，它是一个模拟咨询顾问思考过程的 AI 代理系统。

### 1. 智能情境分析 (Context Intelligence)
- **多模态输入**: 支持上传 PDF, TXT, MD, DOC, DOCX 文档，或者直接输入你的核心目标（Purpose）。
- **逻辑解构**: 内置 SCQA (Situation, Complication, Question, Answer) 框架，AI 会像分析师一样拆解你的输入，提取关键战略信息。
- **视觉导入**: 支持导入现有的notebooklm 生成的PDF幻灯片,实现一键4K化。

### 2. 顶级咨询风格定制 (Consulting Personas)
系统内置了三大顶级咨询公司的“思维与视觉”预设：
- **McKinsey (麦肯锡风格)**:
    - **逻辑**: 金字塔原理 (Pyramid Principle)，MECE 原则。
    - **视觉**: 经典的蓝色系 (Deep Blue)，瀑布图 (Waterfall)，Marimekko 图表。
    - **特点**: 强调结构化叙事和"So What"结论。
- **BCG (波士顿咨询风格)**:
    - **逻辑**: 增长/份额矩阵逻辑，强调洞察 (Insight-driven)。
    - **视觉**: 标志性的绿色系 (Deep Green)，高对比度，分栏布局。
    - **特点**: 视觉冲击力强，强调增长和竞争优势。
- **Bain (贝恩风格)**:
    - **逻辑**: 结果导向 (Answer First)，严谨的数据证明。
    - **视觉**: 红色强调 (Cardinal Red)，极简主义，严格的网格系统。
    - **特点**: 强调行动和数据支撑，使用 "Kicker" 强调战略含义。

### 3. 高级生成工作流 (Advanced Workflow)
- **幽灵甲板 (Ghost Deck) 生成**: AI 首先生成纯文字的逻辑大纲，让你在生成视觉图之前先确认叙事结构。
- **分步构建 (Blueprint to Visual)**:
    - **Step 1 蓝图**: 生成幻灯片的文字内容、数据点和布局描述。
    - **Step 2 渲染**: 使用 `gemini-3-pro-image-preview` 模型将蓝图转化为像素级的 16:9 高清幻灯片图像。
- **实时控制**: 支持 **暂停/恢复** 生成过程，随时干预。

### 4. 深度编辑与细化 (Refinement & Editing)
- **全局重构 (Director's Cut)**: 用一句话指令重写整个大纲（例如：“把重点放在亚洲市场的风险上”）。
- **单页精修 (Slide Refine)**: 针对单张幻灯片进行逻辑重写。
- **视觉微调 (Visual Edit)**: 使用自然语言修改图片（例如：“把柱状图改成红色的”，“移除左下角的 Logo”）。
- **历史回溯 (Undo/History)**: 每张幻灯片都有独立的版本历史，可随时回退。

### 5. 输出与导出 (Output)
- **4K Upscaling**: 内置 AI 放大功能，将生成的幻灯片无损放大至 4K 超高清分辨率，消除文字模糊。
- **PDF 导出**: 一键合成高分辨率 PDF 文档，可直接用于演示或打印。

## 技术栈 (Tech Stack)

- **前端框架**: React 19, Vite, TypeScript
- **UI 组件**: Tailwind CSS, Lucide React (Icons)
- **AI 核心**:
    - Google Gemini API (`@google/genai`)
    - Models: `gemini-3-pro-preview` (Logic), `gemini-3-pro-image-preview` (Vision)
- **文档处理**: `jspdf` (PDF生成), `pdfjs-dist` (PDF解析)

## 快速开始 (Getting Started)

### 前置要求
- Node.js (v18+)
- 有效的 **Google Gemini API Key** (必须以 `AIza` 开头)。

### 本地运行

1.  **克隆项目**
    ```bash
    git clone https://github.com/xli2333/AI_Biz_Deck.git
    cd AI_Biz_Deck
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```

4.  **访问应用**
    打开浏览器访问 `http://localhost:3000` (或控制台显示的端口)。

### 部署 (Deployment)

本项目完全适配 **Vercel** 部署。

1.  Fork 本仓库。
2.  在 Vercel 中 Import Project。
3.  Build Command 保持默认 (`vite build`)。
4.  点击 Deploy。
5.  *注意*: API Key 是在前端 UI 中输入的，不需要在 Vercel 环境变量中配置，方便演示。

## 使用指南 (User Guide)

1.  **输入密钥**: 在首页输入你的 Google Gemini API Key。
2.  **提供上下文**:
    - 上传相关文档 (PDF/Word/Txt)，或者
    - 在文本框中简述你的 PPT 目的 (例如: "分析 Q3 营收下降原因并提出复苏计划")。
3.  **选择风格**: 点击选择 McKinsey, BCG 或 Bain 风格。
4.  **生成大纲**: 系统会分析并生成 5-10 页的大纲。你可以在此阶段删除不需要的页面或使用 "Refine Structure" 修改逻辑。
5.  **构建 Deck**: 点击 "Start Production"。AI 将逐页生成内容和视觉图。
6.  **微调**:
    - 点击任意幻灯片进入详情页。
    - 使用下方的输入框修改逻辑 (Regenerate Logic) 或修改图片 (Visual Edit)。
7.  **导出**: 生成完成后，点击 "Upscale (4K)" 提升画质，最后点击 "Export PDF" 下载。

## 常见问题 (FAQ)

- **Q: 为什么生成的图片文字有时候会乱码?**
  - A: 目前的 AI 图片生成模型在处理微小文字时仍有局限。建议使用 "Upscale" 功能，它会尝试修复文字清晰度。如果依然不清，建议使用 "Visual Edit" 指令让 AI "Make text larger and clearer"。

- **Q: 为什么需要 Gemini 3.0 Pro?**
  - A: 本项目依赖 3.0 Pro 强大的逻辑推理能力来生成咨询级的 SCQA 结构，以及其多模态能力来精确控制幻灯片的视觉布局。

## License

MIT License.
