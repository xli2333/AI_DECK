# Slide Layout: P&L Logic Chain (Driver Tree)

**Category:** Data Insights > Financial and PnL
**Use Case:** Explaining Financial Models, Business Logic, Key Driver Analysis
**Source:** BCGMOREMORE_Part11 (Page 50)

## 1. Context and Goal
This slide explains *how* a financial projection was calculated. Instead of just showing the numbers, it visualizes the **formula** or **logic flow**. It breaks down "Profitability" into its constituent drivers (Revenue, Costs, Investments) and lists the assumptions and data sources for each.

## 2. Visual Structure (Layout Description)
A left-to-right horizontal flow diagram divided into three main columns: **P&L Items (The Formula)**, **Rationale (The Why)**, and **Source (The Where)**.

### Detailed Element Breakdown

#### A. The P&L Formula Stack (Left Column)
*   **Visual Style:** A vertical stack of colored blocks representing the math.
*   **Top Block (Blue):** "Revenue".
    *   **Sub-drivers:** To the left of the "Revenue" block, attach three smaller input boxes feeding into it: "Volume", "Channel Mix", "Portfolio Mix". Use "X" (multiplication) symbols between them.
*   **Middle Blocks (Yellow/Green):** "Existing MACO" (Margin), "Trade Investment", "IT Cost/Admin", "FTE Expense".
*   **Operators:** Place circular badges with mathematical symbols ("-", "+", "=") vertically between these blocks to show the calculation logic (e.g., Revenue - MACO - Cost = Profit).
*   **Bottom Block (Gold):** "Profitability" (The result).

#### B. The Rationale Column (Middle)
*   **Alignment:** For each P&L block on the left, provide a corresponding text box in the middle.
*   **Content:** Bullet points explaining the assumptions (e.g., "Assumed 8% growth based on historic trend").
*   **Connectors:** Subtle horizontal dotted lines connecting the P&L block to its rationale text.

#### C. The Source Column (Right)
*   **Alignment:** Align with the Rationale column.
*   **Content:** Short text indicating where the data came from (e.g., "Expert Interview", "Internal Database", "Market Report").
*   **Formatting:** Use italicized text for the sources to differentiate them from the rationale.

## 3. Key Design Instructions (For AI Generation)
*   **Logic Visualization:** The left-hand "Formula Stack" is the key visual. It should look like a structural diagram, not just a list. Use brackets or connector lines to show how "Volume x Price = Revenue".
*   **Color Coding:**
    *   **Revenue Inputs:** Light Grey or Blue.
    *   **Costs:** Green or Red.
    *   **Profit:** Gold/Yellow.
*   **Alignment:** Perfect horizontal alignment across the three columns (Item -> Rationale -> Source) is crucial for readability.

## 4. Suggested Content (Placeholder)
*   **Item:** Revenue.
*   **Rationale:** Defined by channel mix based on RTM design at each stage.
*   **Source:** Expert Interview, Field Visit.
*   **Item:** FTE Expense.
*   **Rationale:** Cost to hire W1, W2 based on standard salary package.
*   **Source:** HR Database.
