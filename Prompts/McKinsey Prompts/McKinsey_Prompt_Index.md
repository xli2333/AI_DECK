# McKinsey & Company Layout Index (McKinsey 风格布局索引)

This index is the **Master Control** for selecting the correct slide layout in the McKinsey & Company style.
**Role:** As a McKinsey Engagement Manager, you must select the *exact* layout file that best fits the logical structure and MECE principle of the current slide.

**Selection Logic:**
1.  **Analyze the Logic:** Is it a breakdown (Tree)? A process (Chevron)? A data proof (Chart)?
2.  **Determine the Message:** "Profit is driven by X", "We should filter options", "A vs B comparison".
3.  **Choose the File:** Pick the file path below that perfectly matches the structural need.

---

## 📊 1. Data Charts (Quantitative Evidence)
*Use these for rigorous data analysis, financial waterfalls, and market sizing.*

### 1.1 Bar & Column (Growth & Breakdown)
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/McKinsey Prompts/Data Charts/Bar & Column/Growth_Waterfall_Chart.md` | **Bridge Analysis**. Explaining revenue growth sources or cost reduction steps (Walk from A to B). | Floating bars. Grey bubbles at bottom showing % growth. "Critical unlocks" list on right. |
| `Prompts/McKinsey Prompts/Data Charts/Bar & Column/Floating_Bridge_Chart.md` | **Gap Analysis**. Explaining *why* one segment is higher/lower than another (e.g., Price difference). | Two-part chart. Top: Vertical bars. Bottom: Floating bridge showing the exact gap drivers. |
| `Prompts/McKinsey Prompts/Data Charts/Bar & Column/Grouped_Column_Chart.md` | **Multi-Variable Comparison**. Comparing two dimensions (e.g., History vs Forecast) across categories. | Paired bars (Dark Navy vs Cyan). Tightly grouped. Clean axis labels. |
| `Prompts/McKinsey Prompts/Data Charts/Bar & Column/Horizontal_Bar_Ranking.md` | **Ranking & Drivers**. Identifying top contributors when names are long (e.g., Category Spend). | Horizontal bars sorted descending. Top items emphasized in Dark Blue. |
| `Prompts/McKinsey Prompts/Data Charts/Bar & Column/Stacked_Column_Composition.md` | **Share Evolution**. Showing how the mix (100%) changes over time. | 100% stacked columns. *Series lines* connecting segments between columns. |

### 1.2 Trend, Line & Others
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/McKinsey Prompts/Data Charts/Trend & Line/Trend_Charts.md` | **Trends & Correlation**. Showing market growth or price/volume relationships. | Dual Axis (Bar + Line) or Scatter Plot with groupings and annotations. |
| `Prompts/McKinsey Prompts/Data Charts/Trend & Line/Trend_Charts.md` | **Trends & Correlation**. Showing market growth or price/volume relationships. | Dual Axis (Bar + Line) or Scatter Plot with groupings and annotations. |
| `Prompts/McKinsey Prompts/Data Charts/Part-to-Whole/Pie_Donut_Charts.md` | **80/20 Rule or Cycles**. Highlighting a binary split (80/20) or a circular process loop. | Simple Pie with high contrast (Dark vs Light) or Donut Loop with arrows. |
| `Prompts/McKinsey Prompts/Data Charts/Tables & Heatmaps/Tables_Heatmaps.md` | **Detailed Scorecards**. Evaluating many items (Rows) against many criteria (Columns). | Heatmap (Red/Green backgrounds), Harvey Balls (Full/Empty circles), or RAG status dots. |

---

## 🧩 2. Conceptual Models (Logic & Structure)
*Use these for frameworks, processes, and qualitative logical arguments.*

### 2.1 Structure & Trees (Decomposition)
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/McKinsey Prompts/Conceptual Models/Structure/Structure_Charts.md` | **Issue Trees / Logic Trees**. Breaking a problem down into MECE components (Profit -> Rev - Cost). | Horizontal tree flowing Left-to-Right. Square connectors. Venn Diagram (3 circles) for overlaps. |
| `Prompts/McKinsey Prompts/Conceptual Models/Matrices/Matrix_Charts.md` | **Prioritization**. 2x2 Matrix (Value vs Effort) or Permission Grids. | 4-Quadrant grid with colored backgrounds. Checkmark Matrix for feature lists. |

### 2.2 Process & Flow (Sequence)
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/McKinsey Prompts/Conceptual Models/Process & Flow/Process_Flow_Charts.md` | **Linear Process / Funnel**. Customer journeys, project timelines, or filtering options. | Chevron Arrows (Left-to-Right). Vertical Funnel (Market Sizing). Gantt Chart with arrow bars. |

---

## 📝 3. Text & Layouts (Narrative & Lists)
*Use these for agendas, comparisons, and team introductions.*

### 3.1 Agendas & Structure (目录与导航)
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/McKinsey Prompts/Text & Layouts/Lists/Lists_Checklists.md` | **Key Takeaways / Checklist**. Summarizing actions or verifying requirements. | Vertical list with Icons on the left. Boxed "Checklist" style. |
| `Prompts/McKinsey Prompts/Text & Layouts/Comparisons/Comparisons.md` | **Do's and Don'ts**. Contrasting two concepts (From vs To, Low vs High). | Two columns with "Check" and "Cross" icons. Spectrum table showing evolution. |
| `Prompts/McKinsey Prompts/Text & Layouts/Agendas/Agendas_Dividers_Team.md` | **Navigation / Team**. Chapter dividers, Table of Contents, Org overview. | Large numbers (1, 2, 3) for chapters. Clean grid for team photos/roles. |
