// ==UserScript==
// @name         Gemini-Better-UI
// @name:zh-TW   Gemini 介面優化
// @namespace    http://tampermonkey.net/
// @version      1.0.4
// @description  Enhances Gemini UI: Dynamic Tab title, adjustable chat width, 5-state Canvas layout toggle.
// @description:zh-TW 增強 Gemini 介面：動態分頁標題、可調式聊天容器寬度、五段式 Canvas 佈局切換。
// @author       JonathanLU
// @match        *://gemini.google.com/*
// @icon         https://raw.githubusercontent.com/Jonathan881005/Gemini-Better-UI/refs/heads/main/Google-gemini-icon.svg
// @run-at       document-idle
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/535508/Gemini-Better-UI%20%28Gemini%20%E4%BB%8B%E9%9D%A2%E5%84%AA%E5%8C%96%29.user.js
// @updateURL https://update.greasyfork.org/scripts/535508/Gemini-Better-UI%20%28Gemini%20%E4%BB%8B%E9%9D%A2%E5%84%AA%E5%8C%96%29.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Script Information ---
    const SCRIPT_NAME = 'Gemini Better UI v1.0.4';
    console.log(`${SCRIPT_NAME}: Script started.`);

    // --- Constants ---
    const STORAGE_KEY_CONV_WIDTH = 'geminiConversationContainerWidth';
    const CSS_VAR_CONV_WIDTH = '--conversation-container-dynamic-width';
    const DEFAULT_CONV_WIDTH_PERCENTAGE = 90;
    const MIN_CONV_WIDTH_PERCENTAGE = 50;
    const MAX_CONV_WIDTH_PERCENTAGE = 100;
    const STEP_CONV_WIDTH_PERCENTAGE = 10;

    const BUTTON_INCREASE_ID = 'gm-conv-width-increase';
    const BUTTON_DECREASE_ID = 'gm-conv-width-decrease';
    const BUTTON_UI_CONTAINER_ID = 'gm-conv-width-ui-container';
    const BUTTON_ROW_CLASS = 'gm-conv-width-button-row';
    const GRID_LAYOUT_PREV_ID = 'gm-grid-layout-prev';
    const GRID_LAYOUT_NEXT_ID = 'gm-grid-layout-next';

    const STABLE_CHAT_ROOT_SELECTOR = 'chat-window-content > div.chat-history-scroll-container';
    const UNSTABLE_ID_CHAT_ROOT_SELECTOR = 'div#chat-history';
    const USER_QUERY_OUTER_SELECTOR = `user-query`;
    const USER_QUERY_BUBBLE_SPAN_SELECTOR = `span.user-query-bubble-with-background`;
    const MODEL_RESPONSE_MAIN_PANEL_SELECTOR = `.markdown.markdown-main-panel`;
    const USER_QUERY_TEXT_DIV_SELECTOR = `div.query-text`;
    const MODEL_RESPONSE_OUTER_SELECTOR = `model-response`;
    const CHAT_WINDOW_GRID_TARGET_SELECTOR = '#app-root > main > side-navigation-v2 > bard-sidenav-container > bard-sidenav-content > div.content-wrapper > div > div.content-container > chat-window';
    const IMMERSIVE_PANEL_SELECTOR = CHAT_WINDOW_GRID_TARGET_SELECTOR + ' > immersive-panel';

    const CHAT_LIST_CONTAINER_SELECTOR = 'recent-conversations-list';
    const SELECTED_CHAT_ITEM_SELECTOR = 'div[data-test-id="conversation"].selected .conversation-title';


    const GRID_LAYOUT_STATES = [
        "minmax(360px, 1fr) minmax(0px, 2fr)", "minmax(360px, 2fr) minmax(0px, 3fr)",
        "1fr 1fr", "minmax(0px, 3fr) minmax(360px, 2fr)", "minmax(0px, 2fr) minmax(360px, 1fr)"
    ];

    let currentGridLayoutIndex = 0;
    let prevLayoutButtonElement = null;
    let nextLayoutButtonElement = null;
    let decreaseConvWidthButtonElement = null;
    let increaseConvWidthButtonElement = null;

    let canvasObserver = null;
    let currentConvWidthPercentage = DEFAULT_CONV_WIDTH_PERCENTAGE;

    let originalDocTitle = 'Gemini';
    let titleObserver = null;
    let urlObserver = null;
    let titleUpdateTimeout = null;
    let lastUrl = location.href;

    const buttonWidth = 28;
    const buttonMargin = 4;

    const LAYOUT_ALERT_HORIZONTAL_SHIFT = -buttonWidth - buttonMargin;
    const WIDTH_ALERT_HORIZONTAL_SHIFT = buttonWidth + buttonMargin;

    // --- NEW: Robust Element Waiter ---
    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const targetNode = document.querySelector(selector);
            if (targetNode) {
                obs.disconnect();
                callback(targetNode);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            if (document.querySelector(selector)) return;
            observer.disconnect();
            console.warn(`${SCRIPT_NAME}: Timed out waiting for element "${selector}".`);
        }, 15000); // 15-second timeout
    }

    // --- CSS Rule Generation Function ---
    function getCssRules(initialConvWidthPercentage) {
        // (No changes in this function)
        const buttonRowHeight = 28;
        const promptGap = -8;
        let css = `
            :root { ${CSS_VAR_CONV_WIDTH}: ${initialConvWidthPercentage}%; }
            #${BUTTON_UI_CONTAINER_ID} { position: fixed !important; right: 15px !important; bottom: 15px !important; z-index: 200001 !important; display: flex !important; flex-direction: column-reverse !important; align-items: center !important; }
            .gm-temp-alert { padding: 3px 7px !important; font-size: 11px !important; font-weight: 500; border-radius: 3px !important; width: fit-content !important; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.25); display: block; opacity: 0; transition: opacity 0.15s ease-out, transform 0.15s cubic-bezier(0.25, 0.85, 0.45, 1.45); position: absolute; bottom: ${buttonRowHeight + promptGap}px; left: 50%; z-index: 200002 !important; white-space: nowrap; }
            .gm-alert-display { background-color: #303134 !important; color: #cacecf !important; }
            .gm-alert-nope, .gm-alert-limit { background-color: #e53935 !important; color: white !important; font-size: 10px !important; font-weight: bold; padding: 3px 6px !important; border-radius: 4px !important; }
            .${BUTTON_ROW_CLASS} { display: flex !important; justify-content: center !important; align-items: center !important; }
            .gm-conv-width-control-button { width: ${buttonWidth}px !important; height: ${buttonWidth}px !important; padding: 0 !important; background-color: #3c4043 !important; color: #e8eaed !important; border: 1px solid #5f6368 !important; border-radius: 6px !important; cursor: pointer !important; font-size: 16px !important; font-weight: bold; line-height: ${buttonWidth - 2}px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.2); opacity: 0.80 !important; transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out; }
            #${GRID_LAYOUT_PREV_ID}, #${GRID_LAYOUT_NEXT_ID} { font-size: 12px !important; }
            .gm-conv-width-control-button:hover:not([disabled]) { background-color: #4a4e51 !important; opacity: 1 !important; }
            .gm-conv-width-control-button[disabled] { opacity: 0.4 !important; cursor: not-allowed !important; background-color: #3c4043 !important; }
            #${GRID_LAYOUT_PREV_ID} { margin-left: 0px !important; }
            #${GRID_LAYOUT_NEXT_ID} { margin-left: ${buttonMargin}px !important; }
            #${BUTTON_DECREASE_ID} { margin-left: ${buttonMargin}px !important; }
            #${BUTTON_INCREASE_ID} { margin-left: ${buttonMargin}px !important; }
            ${STABLE_CHAT_ROOT_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} { width: 90% !important; max-width: 1700px !important; margin: auto !important; padding-top: 0px !important; padding-bottom: 20px !important; box-sizing: border-box !important; position: relative !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container { width: var(${CSS_VAR_CONV_WIDTH}) !important; max-width: 100% !important; margin: 10px auto !important; padding: 0 15px !important; box-sizing: border-box !important; overflow: hidden !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} { width: 100% !important; max-width: none !important; display: flex !important; justify-content: flex-end !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} { width: 100% !important; max-width: none !important; display: flex !important; justify-content: flex-start !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} > span.user-query-container.right-align-content, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} > span.user-query-container.right-align-content, ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child { max-width: 90% !important; margin: 0 !important; box-sizing: border-box !important; display: flex !important; justify-content: flex-end !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_TEXT_DIV_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_TEXT_DIV_SELECTOR} { text-align: left !important; width: 100% !important; white-space: normal !important; overflow-wrap: break-word !important; word-wrap: break-word !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_TEXT_DIV_SELECTOR} p.query-text-line, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_TEXT_DIV_SELECTOR} p.query-text-line { white-space: normal !important; margin: 0 !important; padding: 0 !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_BUBBLE_SPAN_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_BUBBLE_SPAN_SELECTOR}, ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} ${MODEL_RESPONSE_MAIN_PANEL_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} ${MODEL_RESPONSE_MAIN_PANEL_SELECTOR} { padding: 8px 12px !important; min-height: 1.5em !important; box-sizing: border-box !important; word-break: break-word !important; max-width: calc(1024px - var(--gem-sys-spacing--m)*2) !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} user-query-content, ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} user-query-content > div.user-query-bubble-container { width: 100% !important; box-sizing: border-box !important; margin: 0 !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child response-container, ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child .presented-response-container, ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child .response-container-content { width: 100% !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; }
            `;
        const uqOuter = `${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR}`;
        const actualBubbleDivEditMode = `> span.user-query-container.right-align-content > user-query-content.user-query-container.edit-mode > div.user-query-container.user-query-bubble-container.edit-mode`;
        const queryContentWrapperInBubbleEditMode = `${actualBubbleDivEditMode} > div.query-content.edit-mode`;
        const matFormFieldInEditMode = `${queryContentWrapperInBubbleEditMode} > div.edit-container > mat-form-field.edit-form`;
        const textareaElementInEditMode = `${matFormFieldInEditMode} textarea.mat-mdc-input-element.cdk-textarea-autosize`;
        css += `
            ${uqOuter} ${actualBubbleDivEditMode} { max-width: calc(1024px - var(--gem-sys-spacing--m)*2) !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; display: flex !important; flex-direction: column !important; }
            ${uqOuter} ${queryContentWrapperInBubbleEditMode} { width: 90% !important; margin-left: auto !important; margin-right: 0 !important; box-sizing: border-box !important; }
            ${uqOuter} ${matFormFieldInEditMode} { width: 100% !important; box-sizing: border-box !important; display: flex !important; flex-direction: column !important; }
            ${uqOuter} ${matFormFieldInEditMode} .mat-mdc-text-field-wrapper, ${uqOuter} ${matFormFieldInEditMode} .mat-mdc-form-field-flex, ${uqOuter} ${matFormFieldInEditMode} .mat-mdc-form-field-infix { width: 100% !important; max-height: 540px; box-sizing: border-box !important; flex-grow: 1 !important; }
            ${uqOuter} ${textareaElementInEditMode} { }
        `;
        return css;
    }

    // --- Title Management Functions ---
    function updateDocumentTitle() {
        clearTimeout(titleUpdateTimeout);
        titleUpdateTimeout = setTimeout(() => {
            const selectedTitleElement = document.querySelector(SELECTED_CHAT_ITEM_SELECTOR);
            if (selectedTitleElement && selectedTitleElement.textContent.trim()) {
                const chatTitle = selectedTitleElement.textContent.trim();
                const newTitle = `${chatTitle} - ${originalDocTitle}`;
                if (document.title !== newTitle) {
                    document.title = newTitle;
                }
            } else {
                if (document.title !== originalDocTitle) {
                    document.title = originalDocTitle;
                }
            }
        }, 150);
    }

    function setupTitleObserver(chatListContainer) {
        if (titleObserver) titleObserver.disconnect();
        titleObserver = new MutationObserver(updateDocumentTitle);
        titleObserver.observe(chatListContainer, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['class'], characterData: true
        });
        console.log(`${SCRIPT_NAME}: Title list observer attached.`);
        updateDocumentTitle();
    }

    function setupUrlObserverForTitle() {
        if (urlObserver) urlObserver.disconnect();
        urlObserver = new MutationObserver(() => {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                updateDocumentTitle();
            }
        });
        urlObserver.observe(document.body, { childList: true, subtree: true });
        console.log(`${SCRIPT_NAME}: URL observer for title attached.`);
    }

    // --- UI Control Functions ---
    function updateButtonTitles() {
        if (prevLayoutButtonElement) prevLayoutButtonElement.title = `Prev Canvas Layout / 上個 Canvas 佈局 (${currentGridLayoutIndex + 1}/${GRID_LAYOUT_STATES.length})`;
        if (nextLayoutButtonElement) nextLayoutButtonElement.title = `Next Layout / 下個 Canvas 佈局 (${currentGridLayoutIndex + 1}/${GRID_LAYOUT_STATES.length})`;
        if (decreaseConvWidthButtonElement) decreaseConvWidthButtonElement.title = `Width - / 寬度 - (${currentConvWidthPercentage}%)`;
        if (increaseConvWidthButtonElement) increaseConvWidthButtonElement.title = `Width + / 寬度 + (${currentConvWidthPercentage}%)`;
    }

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
        setTimeout(() => {
            alertElement.style.opacity = '0';
            alertElement.style.transform = `translateX(calc(-50% + ${horizontalShift}px)) translateY(-25px)`;
            setTimeout(() => {
                if (alertElement.parentNode) alertElement.parentNode.removeChild(alertElement);
            }, fadeOutAnimationDuration);
        }, visibleDuration);
    }

    function updateLayoutButtonStates() {
        const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR);
        const canvasIsVisible = immersivePanel && window.getComputedStyle(immersivePanel).display !== 'none';
        if (prevLayoutButtonElement) prevLayoutButtonElement.disabled = canvasIsVisible && (currentGridLayoutIndex === 0);
        if (nextLayoutButtonElement) nextLayoutButtonElement.disabled = canvasIsVisible && (currentGridLayoutIndex === GRID_LAYOUT_STATES.length - 1);
        updateButtonTitles();
    }

    function applyGridLayout(newIndex) {
        currentGridLayoutIndex = newIndex;
        const chatWindow = document.querySelector(CHAT_WINDOW_GRID_TARGET_SELECTOR);
        if (chatWindow) {
            const newLayout = GRID_LAYOUT_STATES[currentGridLayoutIndex];
            chatWindow.style.setProperty('grid-template-columns', newLayout, 'important');
            const immersivePanelElement = document.querySelector(IMMERSIVE_PANEL_SELECTOR);
            if (immersivePanelElement && window.getComputedStyle(immersivePanelElement).display === 'none' && currentGridLayoutIndex !== 0) {
                immersivePanelElement.style.setProperty('display', 'block', 'important');
            }
        }
        updateLayoutButtonStates();
        showDynamicTemporaryAlert(`(${currentGridLayoutIndex + 1}/${GRID_LAYOUT_STATES.length})`, 'gm-alert-display', LAYOUT_ALERT_HORIZONTAL_SHIFT);
    }

    function updateConversationContainerWidth(newPercentage, fromButton = true) {
        const oldPercentage = currentConvWidthPercentage;
        const clampedPercentage = Math.max(MIN_CONV_WIDTH_PERCENTAGE, Math.min(MAX_CONV_WIDTH_PERCENTAGE, newPercentage));
        if (fromButton) {
            if (newPercentage < MIN_CONV_WIDTH_PERCENTAGE && oldPercentage === MIN_CONV_WIDTH_PERCENTAGE) {
                showDynamicTemporaryAlert("Min!", 'gm-alert-limit', WIDTH_ALERT_HORIZONTAL_SHIFT); return;
            }
            if (newPercentage > MAX_CONV_WIDTH_PERCENTAGE && oldPercentage === MAX_CONV_WIDTH_PERCENTAGE) {
                showDynamicTemporaryAlert("Max!", 'gm-alert-limit', WIDTH_ALERT_HORIZONTAL_SHIFT); return;
            }
        }
        currentConvWidthPercentage = clampedPercentage;
        document.documentElement.style.setProperty(CSS_VAR_CONV_WIDTH, currentConvWidthPercentage + '%');
        localStorage.setItem(STORAGE_KEY_CONV_WIDTH, currentConvWidthPercentage);
        if (fromButton) showDynamicTemporaryAlert(`${currentConvWidthPercentage}%`, 'gm-alert-display', WIDTH_ALERT_HORIZONTAL_SHIFT);
        updateButtonTitles();
    }

    function createControlButtons() {
        if (document.getElementById(BUTTON_UI_CONTAINER_ID)) {
            updateButtonTitles(); return;
        }
        const uiContainer = document.createElement('div');
        uiContainer.id = BUTTON_UI_CONTAINER_ID;
        const buttonRow = document.createElement('div');
        buttonRow.classList.add(BUTTON_ROW_CLASS);
        prevLayoutButtonElement = document.createElement('button');
        prevLayoutButtonElement.id = GRID_LAYOUT_PREV_ID;
        prevLayoutButtonElement.classList.add('gm-conv-width-control-button');
        prevLayoutButtonElement.textContent = '|<';
        prevLayoutButtonElement.addEventListener('click', () => {
            const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR);
            if (!immersivePanel || window.getComputedStyle(immersivePanel).display === 'none') {
                showDynamicTemporaryAlert("Nope!", 'gm-alert-nope', LAYOUT_ALERT_HORIZONTAL_SHIFT); return;
            }
            if (currentGridLayoutIndex > 0) applyGridLayout(currentGridLayoutIndex - 1); else updateLayoutButtonStates();
        });
        nextLayoutButtonElement = document.createElement('button');
        nextLayoutButtonElement.id = GRID_LAYOUT_NEXT_ID;
        nextLayoutButtonElement.classList.add('gm-conv-width-control-button');
        nextLayoutButtonElement.textContent = '>|';
        nextLayoutButtonElement.addEventListener('click', () => {
            const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR);
            if (!immersivePanel || window.getComputedStyle(immersivePanel).display === 'none') {
                showDynamicTemporaryAlert("Nope!", 'gm-alert-nope', LAYOUT_ALERT_HORIZONTAL_SHIFT); return;
            }
            if (currentGridLayoutIndex < GRID_LAYOUT_STATES.length - 1) applyGridLayout(currentGridLayoutIndex + 1); else updateLayoutButtonStates();
        });
        decreaseConvWidthButtonElement = document.createElement('button');
        decreaseConvWidthButtonElement.id = BUTTON_DECREASE_ID;
        decreaseConvWidthButtonElement.classList.add('gm-conv-width-control-button');
        decreaseConvWidthButtonElement.textContent = '-';
        decreaseConvWidthButtonElement.addEventListener('click', () => updateConversationContainerWidth(currentConvWidthPercentage - STEP_CONV_WIDTH_PERCENTAGE, true));
        increaseConvWidthButtonElement = document.createElement('button');
        increaseConvWidthButtonElement.id = BUTTON_INCREASE_ID;
        increaseConvWidthButtonElement.classList.add('gm-conv-width-control-button');
        increaseConvWidthButtonElement.textContent = '+';
        increaseConvWidthButtonElement.addEventListener('click', () => updateConversationContainerWidth(currentConvWidthPercentage + STEP_CONV_WIDTH_PERCENTAGE, true));
        buttonRow.appendChild(prevLayoutButtonElement);
        buttonRow.appendChild(nextLayoutButtonElement);
        buttonRow.appendChild(decreaseConvWidthButtonElement);
        buttonRow.appendChild(increaseConvWidthButtonElement);
        uiContainer.appendChild(buttonRow);
        if (document.body) document.body.appendChild(uiContainer);
        updateLayoutButtonStates();
    }

    function setupCanvasObserver(chatWindowElement) {
        const observerCallback = () => updateLayoutButtonStates();
        if (canvasObserver) canvasObserver.disconnect();
        canvasObserver = new MutationObserver(observerCallback);
        canvasObserver.observe(chatWindowElement, {
            childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']
        });
        console.log(`${SCRIPT_NAME}: Canvas observer attached.`);
        updateLayoutButtonStates();
    }

    // --- Initialization ---
    function initialize() {
        originalDocTitle = document.title || 'Gemini';

        const savedPercentage = localStorage.getItem(STORAGE_KEY_CONV_WIDTH);
        currentConvWidthPercentage = savedPercentage ? parseInt(savedPercentage, 10) : DEFAULT_CONV_WIDTH_PERCENTAGE;
        if (isNaN(currentConvWidthPercentage) || currentConvWidthPercentage < MIN_CONV_WIDTH_PERCENTAGE || currentConvWidthPercentage > MAX_CONV_WIDTH_PERCENTAGE) {
            currentConvWidthPercentage = DEFAULT_CONV_WIDTH_PERCENTAGE;
        }
        document.documentElement.style.setProperty(CSS_VAR_CONV_WIDTH, currentConvWidthPercentage + '%');

        const cssToInject = getCssRules(currentConvWidthPercentage);
        try {
            const style = document.createElement('style');
            style.textContent = cssToInject;
            document.head.appendChild(style);
            console.log(`${SCRIPT_NAME}: Styles injected.`);
        } catch (e) {
            console.error(`${SCRIPT_NAME}: Error injecting styles:`, e);
        }

        const setupUI = () => {
            createControlButtons();
            updateButtonTitles();

            waitForElement(CHAT_LIST_CONTAINER_SELECTOR, (element) => {
                console.log(`${SCRIPT_NAME}: Found "${CHAT_LIST_CONTAINER_SELECTOR}". Attaching title observer.`);
                setupTitleObserver(element);
            });

            waitForElement(CHAT_WINDOW_GRID_TARGET_SELECTOR, (element) => {
                console.log(`${SCRIPT_NAME}: Found "${CHAT_WINDOW_GRID_TARGET_SELECTOR}". Attaching canvas observer.`);
                // Set initial grid index based on the element once it's found
                 try {
                    const currentLayout = window.getComputedStyle(element).gridTemplateColumns;
                    const normalized = currentLayout.replace(/\s+/g, ' ').trim();
                    const idx = GRID_LAYOUT_STATES.findIndex(s => s.replace(/\s+/g, ' ').trim() === normalized);
                    currentGridLayoutIndex = (idx !== -1) ? idx : 0;
                } catch (e) { currentGridLayoutIndex = 0; }
                console.log(`${SCRIPT_NAME}: Initial grid index detected: ${currentGridLayoutIndex + 1}/${GRID_LAYOUT_STATES.length}`);
                setupCanvasObserver(element);
            });

            setupUrlObserverForTitle(); // This depends only on document.body, safe to call here.
            console.log(`${SCRIPT_NAME}: UI setup initiated. Waiting for dynamic elements...`);
        };

        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', setupUI);
        } else {
            setupUI();
        }
    }

    initialize();
})();