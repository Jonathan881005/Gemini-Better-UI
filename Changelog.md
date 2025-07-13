[Install from Greasy Fork](https://greasyfork.org/zh-TW/scripts/535508-gemini-better-ui)  (Recommended for automatic updates)
[Install directly from GitHub](https://github.com/Jonathan881005/Gemini-Better-UI/raw/refs/heads/main/Gemini-Better-UI.user.js)

### v1.0.5
- Improved Initial Title Loading: Enhanced the script to more reliably fetch the chat name on page load, even when the sidebar is initially hidden. This uses a more targeted approach to wait for the necessary elements to load.
- Version Update: Updated script version to v1.0.5.

### v1.0.4
- New Feature: Dynamic Tab Title
    - The browser tab title now automatically updates to the name of the currently selected conversation.
    - When no conversation is selected (e.g., on the homepage), the title reverts to the default "Gemini".
- Robust Initialization & Bug Fixes
    - Implemented a `waitForElement` mechanism to handle Gemini's dynamic loading. This resolves timing issues where the script would fail because UI elements had not yet loaded.
    - This fix makes the script significantly more reliable, ensuring that all features (layout toggle, title updates) activate correctly even on slower connections or complex page loads.
- Internal Code Refactoring
    - Restructured the initialization process to be more resilient and event-driven, waiting for components to be ready before attaching observers and functionality.

### v1.0.3
- Improved CSS injection method, updated button and alert styles.
    - Improved CSS Injection:
        - Replaced GM_addStyle with dynamic <style> element creation and injection into the document <head> for potentially better compatibility.
    - Dynamic Alerts & Titles:
        - Replaced static alert elements with dynamically generated temporary alerts for layout state ((1/5)), width percentage (50%), limits (Min!/Max!), and invalid actions (Nope!).
        - Calculated and applied precise horizontal positioning for alerts to align them correctly with their corresponding button groups.
        - Implemented dynamic title attributes (tooltips) for all control buttons, showing the current layout index or width percentage on hover.
    - CSS Adjustments:
        - Refined CSS rules for user/model message bubbles for better consistency with Gemini's native styling, especially regarding max-width. Removed the user-configurable bubble width constant.
        - Added specific CSS rules to handle the layout and appearance of the user query input when in edit mode.
    - Internal Refactoring: Minor code cleanup, adjusted global variable usage, and refined the initialization process.