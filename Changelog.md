[Install from Greasy Fork](https://greasyfork.org/zh-TW/scripts/535508-gemini-better-ui)  (Recommended for automatic updates)
[Install directly from GitHub](https://github.com/Jonathan881005/Gemini-Better-UI/raw/refs/heads/main/Gemini-Better-UI.user.js)

### v1.0.7
- **Bug Fixes & Improvements**
    -   Fixed an issue where the chat name was not captured correctly for the browser tab title.
    -   Fixed an issue where the chat title was missing from the delete confirmation dialog.
    -   Expanded the maximum width limit for markdown tables (up to 1600px) to prevent layout cramping.

### v1.0.6
- **New Feature: Enhanced Delete Confirmation**
    -   The chat title is now displayed directly within the delete confirmation dialog, preventing accidental deletions.
    -   This is implemented using a flicker-free "Computed Style Restoration" method, ensuring a seamless user experience.
- **Complete Overhaul of Dynamic Title Logic**
    -   Replaced the old, unstable `MutationObserver` approach with a robust, event-driven model that hooks into the `history` API (`pushState`, `replaceState`, `popstate`).
    -   Implemented a two-state system to correctly handle initial page loads vs. subsequent navigations.
    -   The title update poll is now persistent for a set duration to correctly capture titles that are generated in two stages (e.g., temporary title from user prompt -> final title from Gemini).
- **Bug Fixes & Stability**
    -   Expanded the `@match` URL to `*://gemini.google.com/*` to ensure the script loads correctly on all Gemini sub-pages (like `/apps`, `/sharing`, etc.), fixing issues where functionality would fail if the user didn't start on the main `/app` page.

### v1.0.5
- Improved Initial Title Loading: 
    -   Enhanced the script to more reliably fetch the chat name on page load, even when the sidebar is initially hidden. 
    -   This uses a more targeted approach to wait for the necessary elements to load.
- Version Update: 
    -   Updated script version to v1.0.5.

### v1.0.4
- New Feature: Dynamic Tab Title
    -   The browser tab title now automatically updates to the name of the currently selected conversation.
    -   When no conversation is selected (e.g., on the homepage), the title reverts to the default "Google Gemini".
- Robust Initialization & Bug Fixes
    -   Implemented a `waitForElement` mechanism to handle Gemini's dynamic loading. 
        -   This resolves timing issues where the script would fail because UI elements had not yet loaded.
    -   This fix makes the script significantly more reliable, ensuring that all features (layout toggle, title updates) activate correctly even on slower connections or complex page loads.
- Internal Code Refactoring
    -   Restructured the initialization process to be more resilient and event-driven, waiting for components to be ready before attaching observers and functionality.

### v1.0.3
- Improved CSS injection method, updated button and alert styles.
    -   Improved CSS Injection:
        -   Replaced GM_addStyle with dynamic <style> element creation and injection into the document <head> for potentially better compatibility.
    -   Dynamic Alerts & Titles:
        -   Replaced static alert elements with dynamically generated temporary alerts for layout state ((1/5)), width percentage (50%), limits (Min!/Max!), and invalid actions (Nope!).
        -   Calculated and applied precise horizontal positioning for alerts to align them correctly with their corresponding button groups.
        -   Implemented dynamic title attributes (tooltips) for all control buttons, showing the current layout index or width percentage on hover.
    -   CSS Adjustments:
        -   Refined CSS rules for user/model message bubbles for better consistency with Gemini's native styling, especially regarding max-width. Removed the user-configurable bubble width constant.
        -   Added specific CSS rules to handle the layout and appearance of the user query input when in edit mode.
    -   Internal Refactoring: Minor code cleanup, adjusted global variable usage, and refined the initialization process.