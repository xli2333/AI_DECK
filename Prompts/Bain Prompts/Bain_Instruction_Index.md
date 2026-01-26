# Bain & Company Layout Index (Bain 风格布局索引)

This index is the **Master Control** for selecting the correct slide layout in the Bain & Company style.
**Role:** As a Bain Consultant, you must select the *exact* layout file that best fits the data and narrative logic of the current slide.

**Selection Logic:**
1.  **Analyze the Content:** Is it quantitative (Data), qualitative (Text/Structure), or abstract (Conceptual)?
2.  **Identify the Relationship:** Is it a comparison? A trend? A process? A ranking?
3.  **Choose the File:** Pick the file path below that perfectly matches the visual need.

---

## 📊 1. Data Charts (Quantitative Analysis)
*Use these for hard numbers, market sizing, trends, and financial performance.*

### 1.1 Bar Charts (Comparison & Ranking)
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/Bain Prompts/Data Charts/Bar Charts/Vertical_Ranking_Bar_Chart.md` | **Ranking Entities**. Comparing sales/size across countries, brands, or cities. | Vertical bars sorted high-to-low. Red highlight for the focus entity. Icons/Flags on axis. |
| `Prompts/Bain Prompts/Data Charts/Bar Charts/Vertical_Multi_Chart_Comparison.md` | **Comparing Segments**. Side-by-side trend analysis of two different categories (e.g., Shoes vs Bags). | Two stacked or separate charts. Red oval bubbles showing CAGR growth rates. |
| `Prompts/Bain Prompts/Data Charts/Bar Charts/Long_Term_Trend_Bar_Chart.md` | **Long History**. Showing 10-20 years of market evolution and distinct eras. | Very wide chart. Top brackets marking "Phases" (e.g., Crisis, Boom). Large Red Arrow for trend. |
| `Prompts/Bain Prompts/Data Charts/Bar Charts/Positive_Negative_Bar_Chart.md` | **Cash Flow / P&L**. Showing inflows vs outflows, or profits vs losses. | Bars extending up (positive) and down (negative) from a zero line. Red line overlay for "Net". |

### 1.2 Stacked Charts (Composition & Share)
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/Bain Prompts/Data Charts/Stacked Charts/Simple_Stacked_Column_Comparison.md` | **Structure Change**. Comparing market mix between two years (e.g., 2015 vs 2025). | Two thick columns. Connecting dashed lines between segments. Red highlight for key segment. |
| `Prompts/Bain Prompts/Data Charts/Stacked Charts/Hundred_Percent_Stacked_Chart.md` | **Ratio/Share Only**. Showing % split changes (e.g., Online vs Offline) without volume. | All bars same height (100%). Focus on the changing size of the Red segment. |
| `Prompts/Bain Prompts/Data Charts/Stacked Charts/Split_Trend_Stacked_Chart.md` | **Detailed Growth by Segment**. Showing exactly which sub-segment is growing or shrinking. | Traffic light icons (Arrows/Dots) placed *inside* or between the stack layers. |
| `Prompts/Bain Prompts/Data Charts/Stacked Charts/Segmentation_Matrix_Stacked.md` | **Brand Market Share**. Showing top players in each category. | Stacked bars where segments are actual Brand Logos. Yellow highlight for Top 5 sum. |

### 1.3 Line & Scatter (Trends & Correlation)
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/Bain Prompts/Data Charts/Line Charts/Diverging_Line_Chart.md` | **Divergence**. Showing how two trends are moving apart (e.g., Price up, Volume down). | "Jaws" opening between lines. Warm colors (Red) vs Cool colors (Blue/Grey). |
| `Prompts/Bain Prompts/Data Charts/Line Charts/Annotated_Line_Chart.md` | **Trend vs Events**. correlating data trends with specific historical events or tenures. | Line chart with horizontal bars floating above it indicating time periods (e.g., CEO Tenure). |
| `Prompts/Bain Prompts/Data Charts/Scatter and Matrix/Bubble_Scatter_Matrix.md` | **Portfolio Analysis**. Comparing items on Growth (X) vs Share (Y) vs Size (Bubble). | Standard BCG-style matrix but with Bain aesthetics. Red bubbles for focus products. |
| `Prompts/Bain Prompts/Data Charts/Scatter and Matrix/Disruption_Matrix_Zones.md` | **Risk Assessment**. Showing movement from "Safe" to "Disrupted" zones. | Background is colored in horizontal bands (Heatmap style). Arrows show movement of points. |

### 1.4 Waterfall & Others (Drivers & Flows)
| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/Bain Prompts/Data Charts/Waterfall Charts/Classic_Growth_Waterfall.md` | **Bridge Analysis**. Explaining the difference between Year A and Year B (Revenue Walk). | Floating steps. Red bubbles showing contribution % for each step. |
| `Prompts/Bain Prompts/Data Charts/Waterfall Charts/Icon_Step_Waterfall.md` | **Channel/Segment Add-up**. Showing total market built by distinct channels. | Steps rising up. Large Icons (e.g., Phone, Store) sitting on top of each bar. |
| `Prompts/Bain Prompts/Data Charts/Pie and Donut Charts/Donut_Chart_Comparison.md` | **Share Contrast**. Simple before/after of market share. | Two Donuts. One segment highlighted Red. |
| `Prompts/Bain Prompts/Data Charts/Maps and Geographies/World_Map_Bubble_Growth.md` | **Geographic Footprint**. Sales by region. | Grey World Map. Large Red Bubbles over China/US. |
| `Prompts/Bain Prompts/Data Charts/Tables and Heatmaps/Traffic_Light_Matrix_Table.md` | **Scorecard**. High-level summary of performance across many regions. | Table with Arrows (Up/Down) or Colored Dots instead of numbers. |
| `Prompts/Bain Prompts/Data Charts/Tables and Heatmaps/Ranking_Matrix_With_Logos.md` | **Competitive Landscape**. Who is #1, #2, #3? | Grid with Company Logos. "NEW" starbursts for new entrants. |

---

## 🧩 2. Conceptual Layouts (Logic & Metaphors)
*Use these for explaining strategy, methodology, or abstract concepts.*

| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/Bain Prompts/Conceptual Layouts/Visual Metaphors/Building_Block_Metaphor.md` | **Foundations/Components**. Explaining what a business is "built" on. | 3D Lego-like bricks stacked to form a wall or object. Labeled blocks. |
| `Prompts/Bain Prompts/Conceptual Layouts/Visual Metaphors/Pyramid_Layer_Concept.md` | **Hierarchy/Segmentation**. Customer tiers (e.g., VIP, Mass) or Price tiers. | Triangle divided horizontally. Red growth bubbles next to layers. Hand-drawn arrows. |
| `Prompts/Bain Prompts/Conceptual Layouts/Process and Flow/Funnel_Conversion_Process.md` | **Conversion/Pipeline**. Sales funnel or filtering process. | Vertical Funnel shape. Red highlight at the bottom (Output). |
| `Prompts/Bain Prompts/Conceptual Layouts/Process and Flow/Transformation_Arrow_Process.md` | **Transformation (From -> To)**. Shifting operating models or strategy. | "From" column and "To" column connected by a giant Red Chevron Arrow. |

---

## 📝 3. Text and Structure (Qualitative & Summary)
*Use these for executive summaries, agendas, or text-heavy arguments.*

| Layout File | Best For (Scenario) | Visual Signature |
| :--- | :--- | :--- |
| `Prompts/Bain Prompts/Text and Structure/Layouts/Four_Row_Strategic_Overview.md` | **Strategy on a Page**. Defining Who, What, Where, How. | 4 horizontal bands (Zebra striping). Bold headers on left. |
| `Prompts/Bain Prompts/Text and Structure/Layouts/Today_vs_Tomorrow_Comparison.md` | **Vision Statement**. High-level contrast of current vs future state. | Split screen. Left Grey (Today), Right Red (Tomorrow). Central separator icon. |
| `Prompts/Bain Prompts/Text and Structure/Layouts/Two_Column_Text_Contrast.md` | **Pros vs Cons**. Challenges vs Opportunities. | Two large panels/boxes. Red border/header for the positive side. |
| `Prompts/Bain Prompts/Text and Structure/Dashboards/Regional_Performance_Dashboard.md` | **Executive Summary (Regional)**. One-page health check of all regions. | Vertical columns per region. Top image/icon, big number bubble, bullet points below. |
