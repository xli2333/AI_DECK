# McKinsey 热力数据表 (Heatmap Table)

**适用场景：**
用于展示大量数据的性能表现，通过颜色深浅快速识别"好/坏"或"高/低"。常见于财务分析、产品利润率分析。

**视觉风格参考：**
McKinsey2.pdf, Slide 34 (Complex Grid), McKinsey3.pdf, Slide 39 (Discount Matrix)

**Prompt:**
请生成一个带有条件格式（热力图）效果的密集数据表格。

1.  **表格结构：**
    *   **行标题：** 左侧列出产品、类别或项目名称（如 Product A, B, C）。
    *   **列标题：** 顶部列出维度（如 Revenue, Margin %, Discount %）。
    *   **分组：** 可以将列分为几个大组（如 "Small quote", "Large quote"），使用顶部的横线（Overline）将相关列连接起来。

2.  **热力图样式（Conditional Formatting）：**
    *   **色块填充：** 不要只改变字体颜色，要填充单元格背景色。
    *   **红绿灯模式：**
        *   表现好（如高利润）：浅绿色背景。
        *   中等：浅黄色背景。
        *   表现差（如低利润）：浅红色/粉色背景。
    *   **单色模式：** 使用深蓝色到白色的渐变，深色代表高数值。

3.  **数据内容：**
    *   单元格内显示具体数值（百分比或货币）。
    *   字体颜色：深色背景上用白色文字，浅色背景上用黑色文字。

---

# McKinsey 勾选/功能对比表 (Feature Comparison Matrix)

**适用场景：**
用于竞品分析、功能覆盖率检查、或不同方案的优劣对比。

**视觉风格参考：**
McKinsey3.pdf, Slide 37 (EV KBFs), Slide 38 (Permissions)

**Prompt:**
请生成一个功能对比矩阵（Comparison Matrix）。

1.  **布局结构：**
    *   **行：** 列出功能、KPI或评估标准（如 "Durability", "Maintenance"）。每行前面可以加一个小图标。
    *   **列：** 列出对比对象（如 Competitor A, B, C 或 Option 1, 2）。

2.  **单元格标记（Harvey Balls style）：**
    *   使用视觉符号来表示状态，而非文字。
    *   **实心圆/深色块：** 代表"具备"、"强"或"基准"（Table-stake）。
    *   **亮色块（亮蓝）：** 代表"差异化优势"（Differentiator）。
    *   **空心圆/虚线圈：** 代表"不具备"或"N/A"。
    *   **对勾符号：** 也可以使用圆圈内的对勾（Checkmark）来表示通过。

3.  **样式细节：**
    *   行与行之间保留明显的白色间距，使每行看起来像一个独立的条状卡片。
    *   右侧可预留一栏用于放置"客户引言"或备注。

---

# McKinsey 红绿灯状态表 (RAG Status Table)

**适用场景：**
项目管理、风险评估、进度汇报。

**视觉风格参考：**
McKinsey2.pdf, Slide 25

**Prompt:**
请生成一个项目状态评估表（RAG Status Table）。

1.  **图例：**
    *   在顶部定义颜色含义：蓝色=Ready/Sustain，橙色=Risk，红色=High Risk/Gap。

2.  **表格内容：**
    *   **主要列：** "Success factors"（成功要素）和 "Details"（详细指标）。
    *   **状态点：** 在每个详细指标前，放置一个彩色的实心圆点（蓝、橙、红），指示当前状态。

3.  **排版：**
    *   使用黑色的粗体字表示大类别（如 People, Governance）。
    *   使用黑色的圆圈数字（A, B, C）作为行号或注释索引。
    *   表格线应极简，仅保留行之间的细灰线，去除垂直分割线。
