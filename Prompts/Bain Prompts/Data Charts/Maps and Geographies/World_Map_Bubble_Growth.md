# Bain Style World Map Bubble Growth

## Visual Description
A geographical visualization using a world map as the background, with large data bubbles overlaid on key regions. The size of the bubble usually represents market size, while the text inside or color indicates growth rates.

## Element Breakdown
1.  **Background**: A simplified, light grey world map (silhouette style).
2.  **Bubbles**:
    *   Large circles overlaid on regions (North America, Europe, China, etc.).
    *   **Color**: Often Red for the primary focus region (e.g., China) and Grey for others.
    *   **Size**: Proportional to market volume (Revenue/Sales).
3.  **Data Labels**:
    *   Inside or next to the bubble: Region Name (Bold).
    *   Key Metrics: "Market Size" (e.g., €50B) and "Growth %" (e.g., +15%).
    *   Growth is often shown in a smaller colored circle or pill adjacent to the main bubble.
4.  **Global Summary**: A separate visual element (e.g., a semi-circle or box) in the corner showing the "Total World" growth.

## Usage Context
*   Global market size and growth distribution.
*   Geographical footprint analysis.
*   Identifying high-potential emerging markets vs. mature markets.

## Prompt
```markdown
Create a World Map Bubble Growth chart in Bain & Company style.

Visual Layout:
- **Background**: A clean, light grey silhouette map of the world.
- **Bubbles**: Place circular data bubbles over [List of Regions: N. America, Europe, China, Japan, etc.].
- **Bubble Logic**: 
  - Size of bubble = Market Size.
  - Color: Use Bain Red (#CC0000) for the fastest-growing region (e.g., China), Dark Grey for others.
- **Labels**: Inside or attached to each bubble, display:
  - Region Name
  - Value (e.g., $XX B)
  - Growth Rate (e.g., +Y%)
- **Global Metric**: In the bottom right corner, add a "Total World" summary with a global growth rate.
- **Title**: "[Title summarizing the geographic trend, e.g., Growth Driven Primarily by Asian Markets]".

Style Constraints:
- Map should be subtle; data is the hero.
- Use clear leaders if bubbles are crowded (e.g., Europe).
- Font: Arial or similar clean sans-serif.
```
