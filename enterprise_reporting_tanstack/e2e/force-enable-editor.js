// Force-enable Monaco Editor - Run this in browser console

console.log('=== Force-Enable Monaco Editor ===\n');

// Find Monaco Editor instance
const monacoContainer = document.querySelector('.monaco-editor');

if (monacoContainer) {
  // Method 1: Try to access Monaco's internal editor instance
  // Monaco stores the instance in a specific way with @monaco-editor/react
  const reactKey = Object.keys(monacoContainer).find(key =>
    key.startsWith('__reactFiber') || key.startsWith('__reactProps')
  );

  console.log('React key found:', reactKey);

  // Try to get the editor instance from the wrapper
  let editorInstance = null;

  // The @monaco-editor/react library stores the editor instance
  // We can try to access it through the React fiber
  try {
    const fiberKey = Object.keys(monacoContainer).find(k => k.includes('__react'));
    if (fiberKey) {
      const fiber = (monacoContainer as any)[fiberKey];
      console.log('React fiber found, attempting to get editor...');

      // Try to find the editor in the component tree
      let current = fiber;
      while (current && !editorInstance) {
        if (current.memoizedProps && current.memoizedProps.editor) {
          editorInstance = current.memoizedProps.editor;
          console.log('✓ Found editor via memoizedProps!');
        }
        current = current.return;
      }
    }
  } catch (e) {
    console.log('Could not access React fiber:', e.message);
  }

  // Method 2: Access the textarea and remove readonly attribute
  const textarea = document.querySelector('.monaco-editor textarea');
  if (textarea) {
    console.log('\n--- Textarea Manipulation ---');
    console.log('Current readonly:', textarea.readOnly);
    console.log('Current disabled:', textarea.disabled);

    // Force remove readonly
    textarea.removeAttribute('readonly');
    textarea.readOnly = false;

    // Force enable
    textarea.disabled = false;

    // Force pointer events
    (textarea as any).style.pointerEvents = 'auto';
    (textarea as any).style.cursor = 'text';

    console.log('✓ Removed readonly attribute');
    console.log('New readonly:', textarea.readOnly);

    // Focus it
    textarea.focus();
    console.log('✓ Focused textarea');

    // Test if we can type
    console.log('\n--- Testing Editability ---');
    const testValue = 'SELECT * FROM test;';
    textarea.value = testValue;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    console.log('Set test value:', textarea.value);
    console.log('✓ You should now be able to type!');
  }

  // Method 3: Try to use Monaco's global editor instance
  // @monaco-editor/react sometimes stores a global reference
  if ((window as any).monaco) {
    console.log('\n✓ Monaco global found');
  }

  // Method 4: Check all textareas and enable them
  console.log('\n--- Enabling All Textareas ---');
  const allTextareas = document.querySelectorAll('textarea');
  console.log(`Found ${allTextareas.length} textarea(s)`);

  allTextareas.forEach((ta, i) => {
    const wasReadonly = ta.readOnly;
    ta.readOnly = false;
    ta.disabled = false;

    console.log(`Textarea ${i}: readonly was ${wasReadonly}, now ${ta.readOnly}`);
  });

  console.log('\n=== Next Steps ===');
  console.log('1. Try clicking in the editor');
  console.log('2. Try typing: SELECT 1');
  console.log('3. If it still doesn\'t work, refresh the page with Ctrl+Shift+R (hard refresh)');
  console.log('4. Check the Network tab to see if the updated JS file loaded');

} else {
  console.error('✗ Monaco Editor not found on page!');
}

// Check if the page loaded the updated code
console.log('\n=== Version Check ===');
const scriptTags = Array.from(document.querySelectorAll('script[src]'));
const editorScript = scriptTags.find(s => s.src.includes('monaco-editor'));
if (editorScript) {
  console.log('Monaco Editor script src:', (editorScript as HTMLScriptElement).src);
}
