Markdown

# Role: 高级 AI 工程师 & 图像处理专家

**任务**: 在 `ai_biz_deck` 项目中实现 "Project Iron" (智能 PPT 重构模块)。
**核心逻辑**:
1.  **智能去字**: 调用 "Nanobanana Pro" 服务，利用其内置的语义识别能力，直接生成一张去除打印字体但保留手写痕迹的纯净背景图。
2.  **OCR 提取**: 识别原图中的打印体文字及其精确坐标。
3.  **PPT 组装**: 将“纯净背景”与“可编辑文本框”合并，生成 PPTX 文件。

**现有文件上下文**:
请读取: `types.ts`, `App.tsx`, `services/geminiService.ts`。

---

## 🛠️ 执行指令 (Implementation Steps)

请按顺序生成以下代码模块。每一步完成后，输出该文件的完整代码。

### 第一步：定义核心数据结构 (`types.ts`)
修改 `types.ts`，定义清晰的输入输出结构：
```typescript
// 文字元素定义
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

// 最终处理结果
export interface RemasteredSlideData {
  originalImage: string;   // Base64 原图
  cleanBackground: string; // Base64 (Nanobanana 输出的无打印字背景)
  elements: SlideElement[]; // OCR 提取的文字
}
第二步：智能重绘服务 (services/nanobananaService.ts)
新建文件。 功能: removePrintedText(base64Image: string): Promise<string> 逻辑:

模拟调用 Nanobanana Pro 的 API。

Prompt 逻辑: 假设 API 只需要一个指令。

Instruction: "Strictly remove all printed typography. Preserve all handwritten notes, sketches, and background textures. DO NOT CHANGE ANYTHING EXCEPT PRINTED TYPOGRAPHY. High quality output in 4k."

Mock 实现:

由于没有真实 Key，请写一个 Mock：

console.log("Calling Nanobanana Pro: Smart Text Removal...");

await new Promise(r => setTimeout(r, 3000));

暂时返回 base64Image (原图) 作为占位，但在注释中明确指出此处应返回处理后的干净图片。

第三步：OCR 布局分析服务 (services/ocrService.ts)
新建文件。 功能: extractTextLayout(base64Image: string): Promise<SlideElement[]> 逻辑:

调用 Gemini Vision API (参考 geminiService.ts)。

System Prompt:

"分析图片布局。

提取所有【打印体文本】(Printed Text)。忽略手写字。

返回 JSON elements 数组。

包含 text, box_2d (0-1000), font_size (估算 pt), color, align。 注意：坐标必须精确，用于后续覆盖回原位置。"

第四步：PPT 生成引擎 (services/pptGenService.ts)
新建文件。引入 pptxgenjs。 功能: generatePptx(data: RemasteredSlideData) 逻辑:

初始化 PPT。

设置背景: 使用 data.cleanBackground (来自 Nanobanana)。

放置文字: 遍历 data.elements (来自 OCR)。

将 0-1000 坐标映射为百分比字符串 (e.g., x: "10%", y: "20%").

添加可编辑文本框 slide.addText(...)。

下载: 保存文件。

第五步：UI 组件 (components/RemasterTool.tsx)
新建组件，风格维持 stone-900 黑金风。 交互流程:

UI: 上传区域 + 状态步进条。

逻辑控制器:

用户上传图片 img。

并行执行 (Promise.all):

Task A: nanobananaService.removePrintedText(img) -> 获取 cleanBg。

Task B: ocrService.extractTextLayout(img) -> 获取 elements。

组装: 当 A 和 B 都完成，启用 "Download PPT" 按钮。

点击按钮 -> 调用 pptGenService.generatePptx({ cleanBackground: cleanBg, elements: elements })。

第六步：入口集成 (App.tsx)
修改 App.tsx，在页面显眼位置添加 <RemasterTool />。

开始执行: 请先生成 第一步 (types.ts)，第二步 (services/nanobananaService.ts) 和 第三步 (services/ocrService.ts) 的代码。