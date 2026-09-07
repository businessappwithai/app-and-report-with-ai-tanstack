// Comprehensive Monaco Editor Typing Diagnostic
// Run this in browser console to understand why typing doesn't work

console.log('=== Comprehensive Typing Diagnostic ===\n');

// 1. Check if we can find and access the editor
const monacoContainer = document.querySelector('.monaco-editor');
const textarea = document.querySelector('.monaco-editor textarea');

if (!monacoContainer || !textarea) {
  console.error('✗ Monaco Editor elements not found!');
} else {
  console.log('✓ Monaco Editor elements found\n');

  // 2. Try to type using the textarea directly
  console.log('--- Test 1: Direct textarea manipulation ---');
  textarea.value = 'SELECT 1;';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  console.log('Set value to textarea:', textarea.value);

  // 3. Check if the value appears in the editor
  setTimeout(() => {
    const viewLines = document.querySelector('.view-lines');
    if (viewLines) {
      const textContent = viewLines.textContent;
      console.log('View-lines text content:', textContent);

      if (textContent && textContent.includes('SELECT')) {
        console.log('✓ SUCCESS: Text appears in editor!');
      } else {
        console.log('✗ FAILED: Text not visible in view-lines');
        console.log('This suggests Monaco is not syncing from textarea');
      }
    }
  }, 500);

  // 4. Try to trigger keyboard events
  console.log('\n--- Test 2: Simulate keyboard typing ---');
  textarea.focus();

  const keyEventInit = { bubbles: true, cancelable: true, key: 'S', code: 'KeyS' };
  const keydownEvent = new KeyboardEvent('keydown', keyEventInit);
  const keypressEvent = new KeyboardEvent('keypress', keyEventInit);
  const keyupEvent = new KeyboardEvent('keyup', keyEventInit);

  textarea.dispatchEvent(keydownEvent);
  textarea.dispatchEvent(keypressEvent);
  textarea.dispatchEvent(keyupEvent);

  console.log('Dispatched keyboard events for "S"');

  // 5. Check for any event listeners blocking input
  console.log('\n--- Test 3: Check for event blocking ---');
  const windowGetEventListeners = (window as any).getEventListeners ?
    (window as any).getEventListeners(textarea) : null;

  if (windowGetEventListeners) {
    console.log('Textarea event listeners:', windowGetEventListeners);
  }

  // 6. Check if there's a Monaco editor instance we can access
  console.log('\n--- Test 4: Try to access Monaco editor instance ---');

  // Try to find the editor through React internals
  const reactKey = Object.keys(monacoContainer).find(k =>
    k.includes('__reactFiber') || k.includes('__reactProps')
  );

  if (reactKey) {
    console.log('Found React key:', reactKey);

    // Try to traverse the React fiber tree
    const fiber = (monacoContainer as any)[reactKey];
    let editorInstance = null;
    let current = fiber;

    while (current && !editorInstance) {
      if (current.memoizedProps) {
        // Check for editor instance in various places
        if (current.memoizedProps.editor) {
          editorInstance = current.memoizedProps.editor;
          console.log('✓ Found editor instance via memoizedProps.editor');
        }
        if (current.memoizedState && current.memoizedState.editor) {
          editorInstance = current.memoizedState.editor;
          console.log('✓ Found editor instance via memoizedState.editor');
        }
      }
      if (current.return) {
        current = current.return;
      } else {
        break;
      }
    }

    if (editorInstance) {
      console.log('Editor instance found:', !!editorInstance);

      // Try to use Monaco's API to set value
      try {
        if (typeof editorInstance.setValue === 'function') {
          editorInstance.setValue('-- Test query from API\nSELECT 1;');
          console.log('✓ Set value via Monaco API');
        }
        if (typeof editorInstance.updateOptions === 'function') {
          editorInstance.updateOptions({ readOnly: false });
          console.log('✓ Updated options via Monaco API');
        }
        if (typeof editorInstance.focus === 'function') {
          editorInstance.focus();
          console.log('✓ Focused via Monaco API');
        }
      } catch (e) {
        console.error('Error using Monaco API:', e);
      }
    }
  }

  // 7. Check what's blocking pointer events
  console.log('\n--- Test 5: Pointer events check ---');
  const containerRect = monacoContainer.getBoundingClientRect();
  const elementsAtCenter = document.elementsFromPoint(
    containerRect.left + containerRect.width / 2,
    containerRect.top + containerRect.height / 2
  );

  console.log('Elements at center of editor (top 5):');
  elementsAtCenter.slice(0, 5).forEach((el, i) => {
    const style = window.getComputedStyle(el);
    console.log(`  ${i + 1}. ${el.tagName}.${el.className}`);
    console.log(`     pointer-events: ${style.pointerEvents}`);
    console.log(`     z-index: ${style.zIndex}`);
    console.log(`     user-select: ${style.userSelect}`);
  });
}

console.log('\n=== Instructions ===');
console.log('1. Check if "SUCCESS" message appears');
console.log('2. Try manually clicking in the editor and typing');
console.log('3. If still not working, check for browser extensions blocking input');
