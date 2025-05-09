// ==UserScript==
// @name         Gemini-Better-UI (Gemini 介面優化)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Enhances Gemini UI: Adjustable chat width, 5-state canvas layout toggle
// @description:zh-TW 增強 Gemini 介面：可調式聊天容器寬度、五段式畫布佈局切換
// @author       JonathanLU
// @match        *://gemini.google.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- Script Information ---
    const SCRIPT_NAME = 'Gemini Better UI v1.0'; // Version updated
    console.log(`${SCRIPT_NAME}: Script started.`);

    // --- User Configurable Constants ---
    // Modify this value to set the maximum width of their own message bubbles.
    // 修改此值以設定使用者對話框最大寬度
    const USER_BUBBLE_MAX_WIDTH_PX = 800; // Default: 800px

    // --- Constants ---
    const STORAGE_KEY_CONV_WIDTH = 'geminiConversationContainerWidth';
    const CSS_VAR_CONV_WIDTH = '--conversation-container-dynamic-width';
    const DEFAULT_CONV_WIDTH_PERCENTAGE = 80;
    const MIN_CONV_WIDTH_PERCENTAGE = 50;
    const MAX_CONV_WIDTH_PERCENTAGE = 100;
    const STEP_CONV_WIDTH_PERCENTAGE = 10;

    const BUTTON_INCREASE_ID = 'gm-conv-width-increase';
    const BUTTON_DECREASE_ID = 'gm-conv-width-decrease';
    const DISPLAY_ID = 'gm-conv-width-display';
    const BUTTON_UI_CONTAINER_ID = 'gm-conv-width-ui-container';
    const BUTTON_ROW_CLASS = 'gm-conv-width-button-row';
    const GRID_LAYOUT_PREV_ID = 'gm-grid-layout-prev';
    const GRID_LAYOUT_NEXT_ID = 'gm-grid-layout-next';
    const NOPE_ALERT_ID = 'gm-nope-alert';
    const LIMIT_ALERT_ID = 'gm-limit-alert';

    const STABLE_CHAT_ROOT_SELECTOR = 'chat-window-content > div.chat-history-scroll-container';
    const UNSTABLE_ID_CHAT_ROOT_SELECTOR = 'div#chat-history';
    const USER_QUERY_OUTER_SELECTOR = `user-query`;
    const USER_QUERY_BUBBLE_SPAN_SELECTOR = `span.user-query-bubble-with-background`;
    const MODEL_RESPONSE_MAIN_PANEL_SELECTOR = `.markdown.markdown-main-panel`;
    const USER_QUERY_TEXT_DIV_SELECTOR = `div.query-text`;
    const MODEL_RESPONSE_OUTER_SELECTOR = `model-response`;
    const CHAT_WINDOW_GRID_TARGET_SELECTOR = '#app-root > main > side-navigation-v2 > bard-sidenav-container > bard-sidenav-content > div.content-wrapper > div > div.content-container > chat-window';
    const IMMERSIVE_PANEL_SELECTOR = CHAT_WINDOW_GRID_TARGET_SELECTOR + ' > immersive-panel';

    const GRID_LAYOUT_STATES = [
        "minmax(360px, 1fr) minmax(0px, 2fr)", "minmax(360px, 2fr) minmax(0px, 3fr)",
        "1fr 1fr", "minmax(0px, 3fr) minmax(360px, 2fr)", "minmax(0px, 2fr) minmax(360px, 1fr)"
    ];
    let currentGridLayoutIndex = 0;

    let prevLayoutButtonElement = null;
    let nextLayoutButtonElement = null;
    // Alert elements are now created dynamically, no need for global references to them.
    let nopeTimeoutId = null;
    let limitTimeoutId = null;
    let canvasObserver = null;
    // convWidthDisplayElement will also be created dynamically by showDynamicTemporaryAlert
    let currentConvWidthPercentage = DEFAULT_CONV_WIDTH_PERCENTAGE;

    const buttonWidth = 28; // px
    const buttonMargin = 4; // px
    const nopeAlertHorizontalShift = -31; // px
    const displayWidthHorizontalShift = 32; // px


    // --- CSS Rule Generation Function ---
    function getCssRules(initialConvWidthPercentage) {
        const buttonRowHeight = 28; // px
        const promptGap = -8; // px

        let css = `
            :root { ${CSS_VAR_CONV_WIDTH}: ${initialConvWidthPercentage}%; }
            #${BUTTON_UI_CONTAINER_ID} {
                position: fixed !important; right: 15px !important; bottom: 15px !important;
                z-index: 200001 !important; display: flex !important; flex-direction: column-reverse !important;
                align-items: center !important;
            }
            /* Common style for temporary alerts (Display, Nope, Limit) */
            .gm-temp-alert {
                padding: 3px 7px !important;
                font-size: 11px !important; font-weight: 500; border-radius: 3px !important;
                width: fit-content !important;
                text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.25);
                display: block; opacity: 0; /* Initially invisible but block for layout */
                transition: opacity 0.15s ease-out, transform 0.15s cubic-bezier(0.25, 0.85, 0.45, 1.45);
                position: absolute;
                bottom: ${buttonRowHeight + promptGap}px;
                left: 50%;
                z-index: 200002 !important;
                white-space: nowrap;
            }
            .gm-alert-display { /* Style for width percentage display */
                background-color: #303134 !important; color: #cacecf !important;
            }
            .gm-alert-nope, .gm-alert-limit { /* Style for Nope and Min/Max alerts */
                background-color: #e53935 !important; color: white !important;
                font-size: 10px !important; font-weight: bold;
                padding: 3px 6px !important; border-radius: 4px !important;
            }
            .${BUTTON_ROW_CLASS} {
                display: flex !important; justify-content: center !important; align-items: center !important;
            }
            .gm-conv-width-control-button {
                width: ${buttonWidth}px !important; height: ${buttonWidth}px !important; padding: 0 !important;
                background-color: #3c4043 !important; color: #e8eaed !important;
                border: 1px solid #5f6368 !important; border-radius: 6px !important;
                cursor: pointer !important; font-size: 16px !important; font-weight: bold;
                line-height: ${buttonWidth - 2}px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                opacity: 0.80 !important; transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out;
            }
            .gm-conv-width-control-button:hover:not([disabled]) {
                background-color: #4a4e51 !important; opacity: 1 !important;
            }
            .gm-conv-width-control-button[disabled] {
                opacity: 0.4 !important; cursor: not-allowed !important; background-color: #3c4043 !important;
            }
            #${GRID_LAYOUT_PREV_ID} { margin-left: 0px !important; }
            #${GRID_LAYOUT_NEXT_ID} { margin-left: ${buttonMargin}px !important; }
            #${BUTTON_DECREASE_ID} { margin-left: ${buttonMargin}px !important; }
            #${BUTTON_INCREASE_ID} { margin-left: ${buttonMargin}px !important; }

            ${STABLE_CHAT_ROOT_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} {
                width: 90% !important; max-width: 1700px !important; margin: auto !important;
                padding-top: 0px !important; padding-bottom: 20px !important;
                box-sizing: border-box !important; position: relative !important;
            }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container,
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container {
                width: var(${CSS_VAR_CONV_WIDTH}) !important; max-width: 100% !important;
                margin: 10px auto !important; padding: 0 15px !important;
                box-sizing: border-box !important; overflow: hidden !important;
            }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR},
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} {
                width: 100% !important; max-width: none !important; display: flex !important;
                justify-content: flex-end !important;
            }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR},
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} {
                width: 100% !important; max-width: none !important; display: flex !important;
                justify-content: flex-start !important;
            }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} > span.user-query-container.right-align-content,
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} > span.user-query-container.right-align-content,
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child {
                width: auto !important; max-width: 90% !important; margin: 0 !important; box-sizing: border-box !important;
            }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_TEXT_DIV_SELECTOR},
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_TEXT_DIV_SELECTOR} {
                text-align: left !important; width: 100% !important; white-space: normal !important;
                overflow-wrap: break-word !important; word-wrap: break-word !important;
            }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_TEXT_DIV_SELECTOR} p.query-text-line,
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_TEXT_DIV_SELECTOR} p.query-text-line {
                white-space: normal !important; margin: 0 !important; padding: 0 !important;
            }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_BUBBLE_SPAN_SELECTOR},
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_BUBBLE_SPAN_SELECTOR},
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} ${MODEL_RESPONSE_MAIN_PANEL_SELECTOR},
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} ${MODEL_RESPONSE_MAIN_PANEL_SELECTOR} {
                padding: 8px 12px !important; min-height: 1.5em !important;
                box-sizing: border-box !important; width: 100% !important;
                display: inline-block !important; word-break: break-word !important;
            }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} user-query-content,
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} user-query-content > div.user-query-bubble-container,
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child response-container,
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child .presented-response-container,
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child .response-container-content {
                width: 100% !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important;
            }
        `;
        // MODIFIED: Use the USER_BUBBLE_MAX_WIDTH_PX constant
        css += `
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_BUBBLE_SPAN_SELECTOR},
            ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_BUBBLE_SPAN_SELECTOR} {
                box-sizing: content-box !important;
                max-width: ${USER_BUBBLE_MAX_WIDTH_PX}px !important;
            }
        `;
        return css;
    }

    // --- Dynamic Temporary Alert Function ---
    function showDynamicTemporaryAlert(text, alertTypeClass, horizontalShift) {
        const uiContainer = document.getElementById(BUTTON_UI_CONTAINER_ID);
        if (!uiContainer) return;

        const alertElement = document.createElement('div');
        alertElement.classList.add('gm-temp-alert', alertTypeClass);
        alertElement.textContent = text;
        alertElement.style.transform = `translateX(calc(-50% + ${horizontalShift}px)) translateY(5px)`;

        uiContainer.appendChild(alertElement);

        requestAnimationFrame(() => {
            alertElement.style.opacity = (alertTypeClass === 'gm-alert-nope' || alertTypeClass === 'gm-alert-limit') ? '0.7' : '0.8';
            alertElement.style.transform = `translateX(calc(-50% + ${horizontalShift}px)) translateY(-10px)`;
        });

        const visibleDuration = (alertTypeClass === 'gm-alert-display') ? 350 : 250;
        const fadeOutAnimationDuration = 150;

        // Store timer IDs on the element itself to manage them
        alertElement.primaryTimeoutId = setTimeout(() => {
            alertElement.style.opacity = '0';
            alertElement.style.transform = `translateX(calc(-50% + ${horizontalShift}px)) translateY(-25px)`;
            alertElement.secondaryTimeoutId = setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.parentNode.removeChild(alertElement);
                }
            }, fadeOutAnimationDuration);
        }, visibleDuration);
    }

    // --- Update Layout Button States ---
    function updateLayoutButtonStates() {
        const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR);
        const canvasIsVisible = immersivePanel && window.getComputedStyle(immersivePanel).display !== 'none';
        if (prevLayoutButtonElement) prevLayoutButtonElement.disabled = canvasIsVisible && (currentGridLayoutIndex === 0);
        if (nextLayoutButtonElement) nextLayoutButtonElement.disabled = canvasIsVisible && (currentGridLayoutIndex === GRID_LAYOUT_STATES.length - 1);
    }

    // --- Apply Grid Layout ---
    function applyGridLayout(newIndex) {
        currentGridLayoutIndex = newIndex;
        const chatWindow = document.querySelector(CHAT_WINDOW_GRID_TARGET_SELECTOR);
        if (chatWindow) {
            const newLayout = GRID_LAYOUT_STATES[currentGridLayoutIndex];
            chatWindow.style.setProperty('grid-template-columns', newLayout, 'important');
            console.log(`${SCRIPT_NAME}: Grid layout set to: ${newLayout}`);
            const immersivePanelElement = document.querySelector(IMMERSIVE_PANEL_SELECTOR);
            if (immersivePanelElement && window.getComputedStyle(immersivePanelElement).display === 'none' && currentGridLayoutIndex !== 0) {
                immersivePanelElement.style.setProperty('display', 'block', 'important');
            }
        }
        updateLayoutButtonStates();
    }

    // --- Update Conversation Container Width ---
    function updateConversationContainerWidth(newPercentage, fromButton = true) {
        const oldPercentage = currentConvWidthPercentage;
        const intendedPercentage = newPercentage;
        const clampedPercentage = Math.max(MIN_CONV_WIDTH_PERCENTAGE, Math.min(MAX_CONV_WIDTH_PERCENTAGE, intendedPercentage));

        if (fromButton) {
            if (intendedPercentage < MIN_CONV_WIDTH_PERCENTAGE && oldPercentage === MIN_CONV_WIDTH_PERCENTAGE) {
                showDynamicTemporaryAlert("Min!", 'gm-alert-limit', displayWidthHorizontalShift); return;
            }
            if (intendedPercentage > MAX_CONV_WIDTH_PERCENTAGE && oldPercentage === MAX_CONV_WIDTH_PERCENTAGE) {
                showDynamicTemporaryAlert("Max!", 'gm-alert-limit', displayWidthHorizontalShift); return;
            }
        }
        currentConvWidthPercentage = clampedPercentage;
        document.documentElement.style.setProperty(CSS_VAR_CONV_WIDTH, currentConvWidthPercentage + '%');
        localStorage.setItem(STORAGE_KEY_CONV_WIDTH, currentConvWidthPercentage);
        if (fromButton) {
            showDynamicTemporaryAlert(`${currentConvWidthPercentage}%`, 'gm-alert-display', displayWidthHorizontalShift);
        }
        console.log(`${SCRIPT_NAME}: Conversation width set to ${currentConvWidthPercentage}%.`);
    }

    // --- Create Control Buttons ---
    function createControlButtons() {
        if (document.getElementById(BUTTON_UI_CONTAINER_ID)) return;
        const uiContainer = document.getElementById(BUTTON_UI_CONTAINER_ID) || document.createElement('div');
        if (!uiContainer.id) {
            uiContainer.id = BUTTON_UI_CONTAINER_ID;
        }

        const buttonRow = document.createElement('div');
        buttonRow.classList.add(BUTTON_ROW_CLASS);

        prevLayoutButtonElement = document.createElement('button');
        prevLayoutButtonElement.id = GRID_LAYOUT_PREV_ID;
        prevLayoutButtonElement.classList.add('gm-conv-width-control-button');
        prevLayoutButtonElement.textContent = '|<-';
        prevLayoutButtonElement.title = '上一個畫布佈局';
        prevLayoutButtonElement.addEventListener('click', () => {
            const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR);
            if (!immersivePanel || window.getComputedStyle(immersivePanel).display === 'none') {
                showDynamicTemporaryAlert("Nope!", 'gm-alert-nope', nopeAlertHorizontalShift); return;
            }
            if (currentGridLayoutIndex > 0) applyGridLayout(currentGridLayoutIndex - 1);
            else updateLayoutButtonStates();
        });

        nextLayoutButtonElement = document.createElement('button');
        nextLayoutButtonElement.id = GRID_LAYOUT_NEXT_ID;
        nextLayoutButtonElement.classList.add('gm-conv-width-control-button');
        nextLayoutButtonElement.textContent = '->|';
        nextLayoutButtonElement.title = '下一個畫布佈局';
        nextLayoutButtonElement.addEventListener('click', () => {
            const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR);
            if (!immersivePanel || window.getComputedStyle(immersivePanel).display === 'none') {
                showDynamicTemporaryAlert("Nope!", 'gm-alert-nope', nopeAlertHorizontalShift); return;
            }
            if (currentGridLayoutIndex < GRID_LAYOUT_STATES.length - 1) applyGridLayout(currentGridLayoutIndex + 1);
            else updateLayoutButtonStates();
        });

        const decreaseConvWidthButton = document.createElement('button');
        decreaseConvWidthButton.id = BUTTON_DECREASE_ID;
        decreaseConvWidthButton.classList.add('gm-conv-width-control-button');
        decreaseConvWidthButton.textContent = '-';
        decreaseConvWidthButton.title = `減少對話容器寬度 (${STEP_CONV_WIDTH_PERCENTAGE}%)`;
        decreaseConvWidthButton.addEventListener('click', () => updateConversationContainerWidth(currentConvWidthPercentage - STEP_CONV_WIDTH_PERCENTAGE, true));

        const increaseConvWidthButton = document.createElement('button');
        increaseConvWidthButton.id = BUTTON_INCREASE_ID;
        increaseConvWidthButton.classList.add('gm-conv-width-control-button');
        increaseConvWidthButton.textContent = '+';
        increaseConvWidthButton.title = `增加對話容器寬度 (${STEP_CONV_WIDTH_PERCENTAGE}%)`;
        increaseConvWidthButton.addEventListener('click', () => updateConversationContainerWidth(currentConvWidthPercentage + STEP_CONV_WIDTH_PERCENTAGE, true));

        buttonRow.appendChild(prevLayoutButtonElement);
        buttonRow.appendChild(nextLayoutButtonElement);
        buttonRow.appendChild(decreaseConvWidthButton);
        buttonRow.appendChild(increaseConvWidthButton);

        uiContainer.appendChild(buttonRow);
        // Dynamic alerts are appended directly to uiContainer by showDynamicTemporaryAlert

        if (!document.getElementById(BUTTON_UI_CONTAINER_ID) && document.body) {
            document.body.appendChild(uiContainer);
        }
        updateLayoutButtonStates();
    }

   // --- Canvas Visibility Observer ---
   function setupCanvasObserver() {
        const chatWindowElement = document.querySelector(CHAT_WINDOW_GRID_TARGET_SELECTOR);
        if (!chatWindowElement) {
            console.warn(`${SCRIPT_NAME}: Chat window for observer not found.`);
            updateLayoutButtonStates(); return;
        }
        const observerCallback = () => updateLayoutButtonStates();
        if (canvasObserver) canvasObserver.disconnect();
        canvasObserver = new MutationObserver(observerCallback);
        canvasObserver.observe(chatWindowElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        console.log(`${SCRIPT_NAME}: Canvas observer set up.`);
        updateLayoutButtonStates();
    }

    // --- Initialization ---
    function initialize() {
        const savedPercentage = localStorage.getItem(STORAGE_KEY_CONV_WIDTH);
        currentConvWidthPercentage = savedPercentage ? parseInt(savedPercentage, 10) : DEFAULT_CONV_WIDTH_PERCENTAGE;
        if (isNaN(currentConvWidthPercentage) || currentConvWidthPercentage < MIN_CONV_WIDTH_PERCENTAGE || currentConvWidthPercentage > MAX_CONV_WIDTH_PERCENTAGE) {
            currentConvWidthPercentage = DEFAULT_CONV_WIDTH_PERCENTAGE;
        }
        updateConversationContainerWidth(currentConvWidthPercentage, false);

        const chatWindow = document.querySelector(CHAT_WINDOW_GRID_TARGET_SELECTOR);
        if (chatWindow) {
            try {
                const currentLayout = window.getComputedStyle(chatWindow).gridTemplateColumns;
                const normalized = currentLayout.replace(/\s+/g, ' ').trim();
                const idx = GRID_LAYOUT_STATES.findIndex(s => s.replace(/\s+/g, ' ').trim() === normalized);
                currentGridLayoutIndex = (idx !== -1) ? idx : 0;
            } catch (e) { currentGridLayoutIndex = 0; }
        } else { currentGridLayoutIndex = 0; }
        console.log(`${SCRIPT_NAME}: Initial grid index: ${currentGridLayoutIndex}`);

        const cssToInject = getCssRules(currentConvWidthPercentage);
        try { GM_addStyle(cssToInject); console.log(`${SCRIPT_NAME}: Styles injected.`); }
        catch (e) { console.error(`${SCRIPT_NAME}: Error injecting styles:`, e); }

        const setupUI = () => {
            createControlButtons();
            setupCanvasObserver();
            console.log(`${SCRIPT_NAME}: UI setup complete.`);
        };

        if (document.body) setupUI();
        else window.addEventListener('DOMContentLoaded', setupUI);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
    else initialize();
})();
