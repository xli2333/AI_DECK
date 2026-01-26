import pptxgen from "pptxgenjs";
import { RemasteredSlideData } from "../types";

export const generatePptx = async (slidesData: RemasteredSlideData[]) => {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9"; // Force 16:9 Aspect Ratio to match OCR logic

  slidesData.forEach((data, index) => {
      const slide = pptx.addSlide();

      // 1. Set Background (Clean image from Nanobanana)
      // data.cleanBackground usually comes as "data:image/png;base64,..."
      // pptxgenjs expects either path or data with base64 prefix
      slide.background = { data: data.cleanBackground };

      // 2. Add Text Elements
      data.elements.forEach((el) => {
        const [ymin, xmin, ymax, xmax] = el.box;
        
        // Map 0-1000 to percentages
        const x = (xmin / 10).toString() + "%";
        const y = (ymin / 10).toString() + "%";
        
        // BUFFER STRATEGY: 
        // We add 1% extra width to the text box to prevent "premature wrapping" 
        // where a word barely touches the edge and drops to the next line in PPT.
        // Since we use 'inset: 0', this extra width is purely a safety margin.
        let w_val = (xmax - xmin) / 10;
        w_val = w_val * 1.01; // +1% Safety Buffer
        const w = w_val.toString() + "%";
        
        const h = ((ymax - ymin) / 10).toString() + "%";

        slide.addText(el.content, {
          x: x,
          y: y,
          w: w,
          h: h,
          fontSize: el.style.fontSize || 12,
          color: (el.style.color || "#000000").replace("#", ""),
          align: el.style.align || "left",
          valign: "middle", 
          inset: 0,
          wrap: true,
          charSpacing: 0, 
          autoFit: false 
        });
      });
  });

  // 3. Save / Download
  await pptx.writeFile({ fileName: `Project_Iron_Remastered_${Date.now()}.pptx` });
};
