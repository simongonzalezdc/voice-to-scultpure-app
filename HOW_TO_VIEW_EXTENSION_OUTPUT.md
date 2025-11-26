# How to View Extension Output

## Method 1: Output Panel (Recommended)

1. **Open the Output Panel:**
   - **Keyboard Shortcut:** `Cmd+Shift+U` (Mac) or `Ctrl+Shift+U` (Windows/Linux)
   - **Or via Menu:** View → Output
   - **Or via Command Palette:** `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Windows/Linux) → type "Output" → select "View: Toggle Output"

2. **Select the Extension's Output Channel:**
   - Look for a dropdown at the top-right of the Output panel
   - Click it to see all available output channels
   - Common names for code analyzer extensions:
     - "Code Analyzer"
     - "ESLint"
     - "TypeScript"
     - "[Extension Name]"
     - "Language Server"
     - "Diagnostics"

3. **Watch for Messages:**
   - Keep the Output panel open
   - Re-run your analysis
   - Watch for error messages, warnings, or status updates

## Method 2: Developer Tools Console

1. **Open Developer Tools:**
   - **Keyboard Shortcut:** `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
   - **Or via Menu:** Help → Toggle Developer Tools

2. **Check the Console Tab:**
   - Click the "Console" tab in Developer Tools
   - Look for errors (usually in red)
   - Filter by typing the extension name in the filter box

3. **Check Network Tab (if extension makes HTTP requests):**
   - Click "Network" tab
   - Re-run analysis
   - Look for failed requests (red entries)

## Method 3: Problems Panel

Some extensions show results in the Problems panel:

1. **Open Problems Panel:**
   - **Keyboard Shortcut:** `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows/Linux)
   - **Or via Menu:** View → Problems

2. **Check for Results:**
   - Results may appear here even if the extension's custom view is broken
   - Filter by source (e.g., "ESLint", "TypeScript")

## Method 4: Extension-Specific Logs

Some extensions write logs to files:

1. **Check Extension Logs Location:**
   - macOS: `~/Library/Application Support/Cursor/logs/`
   - Windows: `%APPDATA%\Cursor\logs\`
   - Linux: `~/.config/Cursor/logs/`

2. **Look for files with:**
   - Extension name in filename
   - Recent timestamps
   - `.log` extension

## Quick Visual Guide

```
┌─────────────────────────────────────────┐
│  VS Code/Cursor Window                 │
├─────────────────────────────────────────┤
│                                         │
│  [Your Code Editor]                    │
│                                         │
├─────────────────────────────────────────┤
│  OUTPUT PANEL (Bottom)                 │
│  ┌───────────────────────────────────┐ │
│  │ [Dropdown: Select Channel ▼]     │ │
│  │                                   │ │
│  │ Extension output messages...      │ │
│  │ Error: ...                        │ │
│  │ Warning: ...                      │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## What to Look For

When you find the extension's output, look for:

- ✅ **Success messages:** "Analysis complete", "Found X issues"
- ❌ **Error messages:** "Failed to parse", "Invalid format", "Cannot read property"
- ⚠️ **Warnings:** "No results found", "Empty response"
- 🔄 **Status updates:** "Analyzing...", "Processing files..."

## If You Can't Find the Output Channel

1. **List all channels:**
   - Open Output panel
   - Click the dropdown
   - Note all available channels

2. **Check extension documentation:**
   - Look at the extension's README
   - Search for "output" or "logs"

3. **Try common names:**
   - The extension's display name
   - The extension's ID (from `.vscode/extensions/` folder)
   - "Language Server" or "LSP"

## Pro Tip

If the extension uses a Language Server Protocol (LSP), the output channel is usually named after the language server (e.g., "ESLint", "TypeScript", "Pylance").


