# SQL Editor Panel System - Technical Documentation

## How the Resizable Panels Work

The SQL Editor uses a **nested ResizablePanel system** from `react-resizable-panels` that allows users to resize different areas of the interface using drag handles.

### Panel Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    Outer Horizontal Panel                    │
│  ┌──────────────┐ ├──┐ ┌──────────────────────────────────┐│
│  │   Schema     │ █  │ │         Vertical Panel            ││
│  │   Browser    │ █  │ │  ┌──────────────────────────────┐ ││
│  │   (20%)      │ █  │ │  │     SQL Editor Panel         │ ││
│  │              │ █  │ │  │        (50%)                 │ ││
│  │              │ █  │ │  │                              │ ││
│  └──────────────┘ █  │ │  └──────────────────────────────┘ ││
│                   █  │ │  ═════════════════════════════════ ││
│                   █  │ │  ┌──────────────────────────────┐ ││
│                   █  │ │  │     Results Panel            │ ││
│                   █  │ │  │        (50%)                 │ ││
│                   █  │ │  │  (Results/Validation/...     │ ││
│                   █  │ │  │                              │ ││
│                   █  │ │  └──────────────────────────────┘ ││
│                   █  │ │                                    ││
│                   └──┘ └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Hierarchy

1. **Outer Horizontal PanelGroup** (direction: horizontal)
   - **Left Panel**: Schema Browser (10-40% range, default 20%)
   - **Resize Handle**: Vertical drag grip
   - **Right Panel**: Main content area (60% minimum, default 80%)
     - **Inner Vertical PanelGroup** (direction: vertical)
       - **Top Panel**: SQL Editor (20-80% range, default 50%)
       - **Resize Handle**: Horizontal drag grip
       - **Bottom Panel**: Results/Validation/Schema/Logs tabs (20-80% range, default 50%)

### How to Use

#### Horizontal Resize (Schema Browser ↔ SQL Editor)
1. Locate the **vertical bar** between the Schema Browser and the SQL Editor
2. Look for the **small handle with grip lines** in the middle of the bar
3. **Click and drag horizontally** to resize:
   - Drag right → Makes Schema Browser wider, SQL Editor narrower
   - Drag left → Makes Schema Browser narrower, SQL Editor wider
4. Release to set the new size

#### Vertical Resize (SQL Editor ↔ Results Panel)
1. Locate the **horizontal bar** between the SQL Editor and the Results panel
2. Look for the **small handle with grip lines** in the middle of the bar
3. **Click and drag vertically** to resize:
   - Drag down → Makes SQL Editor taller, Results panel shorter
   - Drag up → Makes SQL Editor shorter, Results panel taller
4. Release to set the new size

### Visual Feedback

- **Normal State**: Gray border with subtle handle
- **Hover State**: Border highlights with primary color tint
- **Dragging**: Handle becomes more prominent with shadow
- **Cursor Change**:
  - Horizontal resize: `col-resize` cursor
  - Vertical resize: `row-resize` cursor

### Technical Implementation

#### Panel Constraints

```typescript
// Schema Browser Panel
<ResizablePanel
  defaultSize={20}    // Start at 20% width
  minSize={10}        // Can shrink to 10%
  maxSize={40}        // Can grow to 40%
  className="overflow-hidden"
>

// SQL Editor Panel
<ResizablePanel
  defaultSize={50}    // Start at 50% height
  minSize={20}        // Can shrink to 20%
  maxSize={80}        // Can grow to 80%
  className="overflow-hidden"
>

// Results Panel
<ResizablePanel
  defaultSize={50}    // Start at 50% height
  minSize={20}        // Can shrink to 20%
  maxSize={80}        // Can grow to 80%
  className="overflow-hidden"
>
```

#### Resize Handle Styling

```typescript
<ResizableHandle withHandle />
```

The handle includes:
- **Visual grip**: Small icon with vertical lines indicating drag capability
- **Hover effects**: Background color change, border highlight
- **Hit area**: Expanded area for easier clicking
- **Z-index**: Ensures handle stays above content
- **Transitions**: Smooth color changes on hover

### Key Features

✅ **Smooth Resizing**: All panels resize in real-time as you drag
✅ **Constraints**: Panels can't be resized beyond min/max limits
✅ **No Content Overlap**: `overflow-hidden` prevents content from spilling
✅ **Responsive**: Panels adjust to window size changes
✅ **Persistence**: Panel sizes are maintained during the session
✅ **Visual Indicators**: Clear handles show where resizing is possible

### Troubleshooting

#### Handle Not Visible
- Ensure browser zoom is at 100%
- Check that panel is not at min/max size (handle may be hidden)
- Refresh the page if handle appears stuck

#### Panel Not Resizing
- Check if you've hit the min/max size limit
- Ensure you're clicking on the handle (grip icon), not the border
- Try refreshing the page

#### Content Overlapping
- This shouldn't happen with `overflow-hidden` classes
- If it occurs, it's likely a browser rendering issue
- Try hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

### Browser Compatibility

The resize system works on all modern browsers:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ All Chromium-based browsers

### Performance

- **Optimized**: Uses CSS transforms for smooth 60fps resizing
- **No Layout Thrashing**: Resize calculations are batched
- **Memory Efficient**: Cleanup on unmount prevents leaks
