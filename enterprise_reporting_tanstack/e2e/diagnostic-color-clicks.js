// Diagnostic Script for Monaco Editor Issues
// Checks for color contrast and click blocking

console.log('=== Monaco Editor Diagnostic ===\n');

// Find all relevant elements
const monacoContainer = document.querySelector('.monaco-editor');
const textarea = document.querySelector('.monaco-editor textarea');
const viewLines = document.querySelector('.view-lines');

if (!monacoContainer) {
  console.error('✗ Monaco Editor container not found!');
} else {
  console.log('✓ Monaco Editor container found\n');

  // 1. Check Container Styles
  console.log('--- Container Styles ---');
  const containerStyle = window.getComputedStyle(monacoContainer);
  console.log('Background color:', containerStyle.backgroundColor);
  console.log('Color:', containerStyle.color);
  console.log('z-index:', containerStyle.zIndex);
  console.log('position:', containerStyle.position);
  console.log('pointer-events:', containerStyle.pointerEvents);
  console.log('user-select:', containerStyle.userSelect);

  // 2. Check Textarea
  if (textarea) {
    console.log('\n--- Textarea Styles ---');
    const textareaStyle = window.getComputedStyle(textarea);
    console.log('Background color:', textareaStyle.backgroundColor);
    console.log('Color:', textareaStyle.color);
    console.log('caret-color:', textareaStyle.caretColor);
    console.log('pointer-events:', textareaStyle.pointerEvents);
    console.log('readonly:', textarea.readOnly);
    console.log('disabled:', textarea.disabled);
    console.log('visible:', textareaStyle.display !== 'none' && textareaStyle.visibility !== 'visible');
  }

  // 3. Check View Lines (where text is displayed)
  if (viewLines) {
    console.log('\n--- View Lines Styles ---');
    const viewLinesStyle = window.getComputedStyle(viewLines);
    console.log('Background color:', viewLinesStyle.backgroundColor);
    console.log('Color:', viewLinesStyle.color);
    console.log('visible:', viewLinesStyle.display !== 'none');
  }

  // 4. Check for overlays blocking clicks
  console.log('\n--- Checking for Click Blockers ---');
  const containerRect = monacoContainer.getBoundingClientRect();

  const elementsAtPoint = document.elementsFromPoint(
    containerRect.left + containerRect.width / 2,
    containerRect.top + containerRect.height / 2
  );

  console.log('Elements at center of editor:');
  elementsAtPoint.forEach((el, i) => {
    const style = window.getComputedStyle(el);
    const zIndex = style.zIndex;
    const pointerEvents = style.pointerEvents;
    console.log(`  ${i + 1}. ${el.tagName}.${el.className} - z-index: ${zIndex}, pointer-events: ${pointerEvents}`);
  });

  // 5. Check if monaco wrapper has proper styles
  console.log('\n--- Parent/Wrapper Elements ---');
  let parent = monacoContainer.parentElement;
  let level = 0;
  while (parent && level < 5) {
    const style = window.getComputedStyle(parent);
    const rect = parent.getBoundingClientRect();

    console.log(`Parent ${level}:`, {
      tag: parent.tagName,
      class: parent.className,
      zIndex: style.zIndex,
      position: style.position,
      pointerEvents: style.pointerEvents,
      display: style.display,
      rect: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    });

    parent = parent.parentElement;
    level++;
  }

  // 6. Calculate color contrast
  console.log('\n--- Color Contrast Check ---');
  const bgColor = containerStyle.backgroundColor;
  const textColor = viewLines ? window.getComputedStyle(viewLines).color : containerStyle.color;

  // Helper to get RGB values
  const getRGB = (colorStr: string) => {
    const match = colorStr.match(/\d+/g);
    return match ? match.map(Number) : [0, 0, 0];
  };

  const bgRGB = getRGB(bgColor);
  const textRGB = getRGB(textColor);

  // Calculate luminance
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map(v => {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const bgLum = luminance(bgRGB);
  const textLum = luminance(textRGB);
  const contrast = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);

  console.log('Background RGB:', bgRGB);
  console.log('Text RGB:', textRGB);
  console.log('Contrast ratio:', contrast.toFixed(2));
  console.log('WCAG AA pass (large text):', contrast >= 3 ? '✓' : '✗');
  console.log('WCAG AA pass (normal text):', contrast >= 4.5 ? '✓' : '✗');
}

console.log('\n=== Recommendations ===');
console.log('If contrast is low: Check theme settings (light vs dark)');
console.log('If clicks blocked: Check for elements with higher z-index');
console.log('If pointer-events: none: Fix CSS to allow clicks');
