const fs = require('fs');
const { marked } = require('marked');

// 1. Read the Markdown file
const mdContent = fs.readFileSync('USER_MANUAL_PDF_READY.md', 'utf8');

// 2. Configure marked (optional)
marked.setOptions({
  breaks: true, // Enable line breaks
});

// 3. Convert to HTML
const htmlContent = marked.parse(mdContent);

// 4. Wrap in a full HTML template with print-friendly CSS
const finalHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Strategy.AI 用户手册</title>
    <style>
        body {
            font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #333;
        }
        h1 { font-size: 2.5em; color: #051C2C; border-bottom: 2px solid #051C2C; padding-bottom: 10px; margin-top: 0; }
        h2 { font-size: 1.8em; color: #051C2C; margin-top: 40px; border-bottom: 1px solid #ddd; padding-bottom: 5px; page-break-after: avoid; }
        h3 { font-size: 1.4em; color: #163E93; margin-top: 30px; page-break-after: avoid; }
        p { margin-bottom: 15px; }
        ul, ol { margin-bottom: 20px; }
        li { margin-bottom: 8px; }
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 20px auto;
            border: 1px solid #ddd;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            page-break-inside: avoid; /* Prevent images from being split */
        }
        blockquote {
            border-left: 4px solid #163E93;
            background-color: #f8f9fa;
            padding: 10px 20px;
            margin: 20px 0;
            color: #555;
            page-break-inside: avoid;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: Consolas, monospace;
        }
        
        /* Print-specific styles */
        @media print {
            body { 
                max-width: 100%; 
                padding: 0; 
                margin: 20mm;
            }
            a { text-decoration: none; color: #000; }
            h1, h2 { page-break-before: auto; }
            h2 { page-break-before: always; } /* Start new sections on new pages */
            h1 { page-break-before: avoid; } /* Title doesn't need new page */
        }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>
`;

// 5. Write to HTML file
fs.writeFileSync('user_manual.html', finalHtml);
console.log('Successfully generated user_manual.html');
