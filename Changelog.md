<!-- #region 1.0.3 -->
## Gemini Better UI v1.0.3
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