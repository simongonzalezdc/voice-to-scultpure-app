# Code Analyzer Extension Debug Guide

## Issue
Extension shows "analysis completed" notification but results window remains stuck on spinner.

## Potential Causes

### 1. **Results Data Format Mismatch**
The extension may be expecting results in a different format than what ESLint/TypeScript provides.

**Debug Steps:**
- Open Developer Tools (Help → Toggle Developer Tools)
- Check Console for errors when analysis completes
- Look for messages about "invalid data format" or "parsing failed"

### 2. **UI State Not Updating**
The extension's React/Vue component may not be reacting to completion events.

**Debug Steps:**
- Check if the extension has a "Refresh" or "Reload Results" button
- Try manually triggering a re-analysis
- Check if closing and reopening the results panel helps

### 3. **Empty Results After Filtering**
After adding `ignorePatterns`, the extension might be filtering out ALL results, leaving an empty array that the UI doesn't handle.

**Debug Steps:**
- Temporarily remove `ignorePatterns` from `.eslintrc.cjs` and re-run analysis
- Check if results appear (this confirms the ignore patterns are working, but the extension UI doesn't handle empty results)

### 4. **Extension Configuration**
The extension may need explicit configuration to work with this project structure.

**Check Extension Settings:**
- Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
- Search for "[Extension Name] Settings"
- Look for:
  - `includePatterns` / `excludePatterns`
  - `maxResults`
  - `resultFormat`
  - `enableNotifications`

## Quick Fixes to Try

### Fix 1: Restart Extension Host
1. Open Command Palette
2. Run: `Developer: Restart Extension Host`
3. Re-run analysis

### Fix 2: Clear Extension Cache
1. Close VS Code/Cursor
2. Delete extension cache (location varies by OS):
   - macOS: `~/Library/Application Support/Cursor/User/workspaceStorage/`
   - Windows: `%APPDATA%\Cursor\User\workspaceStorage\`
   - Linux: `~/.config/Cursor/User/workspaceStorage/`
3. Reopen workspace and re-run analysis

### Fix 3: Check Extension Logs
1. Open Output Panel (View → Output)
2. Select the extension's output channel from dropdown
3. Look for errors or warnings during analysis

### Fix 4: Verify ESLint is Working
Run ESLint manually to confirm it's producing results:

```bash
npm run lint
```

If this works, the issue is in the extension's UI, not the analysis itself.

## Extension-Specific Debugging

### If Extension Uses Language Server Protocol (LSP)
- Check Output → "ESLint" or "[Extension Name]" channel
- Look for LSP initialization errors
- Verify the extension can communicate with ESLint server

### If Extension Uses WebView
- The WebView may be failing to load results
- Check for CORS errors in Developer Tools
- Verify the extension's WebView content security policy

### If Extension Uses Tree View
- The tree view may not be updating after analysis completes
- Try collapsing and expanding the tree
- Check if results appear in a different view (Problems panel, etc.)

## Workspace Configuration Added

I've updated `.vscode/settings.json` to:
- Exclude build directories from file watchers
- Exclude build directories from search
- This helps the extension focus on source files only

## Next Steps

1. **Check Extension Output**: Most important - look at the extension's output channel
2. **Check Browser Console**: If extension uses WebView, check its console
3. **Try Manual ESLint**: Run `npm run lint` to verify analysis works
4. **Check Extension Issues**: Look at the extension's GitHub/issues page for similar reports

## Reporting the Issue

If none of the above works, report to the extension author with:
- Extension name and version
- Console errors (from Developer Tools)
- Extension output channel logs
- Steps to reproduce
- Your `.eslintrc.cjs` configuration

