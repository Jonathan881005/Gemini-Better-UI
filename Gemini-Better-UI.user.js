// ==UserScript==
// @name         Gemini-Better-UI
// @name:zh-TW   Gemini 介面優化
// @namespace    http://tampermonkey.net/
// @version      1.0.5
// @description  Dynamic tab title, adjustable chat width, and 5-state Canvas layout toggle
// @description:zh-TW 動態分頁標題、可調式聊天容器寬度、五段式 Canvas 佈局
// @author       JonathanLU
// @match        *://gemini.google.com/app*
// @icon         https://upload.wikimedia.org/wikipedia/commons/1/1d/Google_Gemini_icon_2025.svg
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/535508/Gemini-Better-UI%20%28Gemini%20%E4%BB%8B%E9%9D%A2%E5%84%AA%E5%8C%96%29.user.js
// @updateURL    https://update.greasyfork.org/scripts/535508/Gemini-Better-UI%20%28Gemini%20%E4%BB%8B%E9%9D%A2%E5%84%AA%E5%8C%96%29.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // --- Script Information ---
    const SCRIPT_NAME = 'Gemini Better UI';
    const SCRIPT_VERSION = 'v1.0.5';
    const logPrefix = `[${SCRIPT_NAME}]`;
    console.log(`${logPrefix} ${SCRIPT_VERSION}: Script started.`);

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
    const CHAT_LIST_CONTAINER_SELECTOR = 'conversations-list[data-test-id="all-conversations"]';
    const SELECTED_CHAT_ITEM_SELECTOR = 'div[data-test-id="conversation"].selected .conversation-title';
    const SNACKBAR_CONTAINER_SELECTOR = 'div.cdk-overlay-container';
    const SNACKBAR_POPUP_SELECTOR = 'mat-snack-bar-container';

    // --- Globals ---
    const GRID_LAYOUT_STATES = ["minmax(360px, 1fr) minmax(0px, 2fr)", "minmax(360px, 2fr) minmax(0px, 3fr)", "1fr 1fr", "minmax(0px, 3fr) minmax(360px, 2fr)", "minmax(0px, 2fr) minmax(360px, 1fr)"];
    let currentGridLayoutIndex = 0, prevLayoutButtonElement = null, nextLayoutButtonElement = null, decreaseConvWidthButtonElement = null, increaseConvWidthButtonElement = null, canvasObserver = null, currentConvWidthPercentage = DEFAULT_CONV_WIDTH_PERCENTAGE;
    let originalDocTitle = 'Gemini', titleListObserver = null, urlObserver = null, snackbarObserver = null, lastUrl = location.href, titleUpdatePollInterval = null;
    const buttonWidth = 28, buttonMargin = 4;
    const LAYOUT_ALERT_HORIZONTAL_SHIFT = -buttonWidth - buttonMargin;
    const WIDTH_ALERT_HORIZONTAL_SHIFT = buttonWidth + buttonMargin;

    function waitForElement(selector, callback, timeout = 20000) {
        const pollInterval = 200; let elapsedTime = 0;
        const intervalId = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) { clearInterval(intervalId); callback(element); }
            else {
                elapsedTime += pollInterval;
                if (elapsedTime >= timeout) { clearInterval(intervalId); console.warn(`${logPrefix} Timed out waiting for element: "${selector}"`); }
            }
        }, pollInterval);
    }

    // --- Title Management ---
    function isChatPage() { return location.pathname.includes('/app/c_'); }
    function performTitleUpdate() {
        const selectedTitleElement = document.querySelector(SELECTED_CHAT_ITEM_SELECTOR);
        if (selectedTitleElement && selectedTitleElement.textContent.trim()) {
            const chatTitle = selectedTitleElement.textContent.trim();
            const newTitle = `${chatTitle} - ${originalDocTitle}`;
            if (document.title !== newTitle) document.title = newTitle;
            return true;
        } else {
            if (!isChatPage()) {
                if (document.title !== originalDocTitle) document.title = originalDocTitle;
                return true;
            }
        }
        return false;
    }
    function scheduleTitleUpdate() {
        clearInterval(titleUpdatePollInterval);
        if (performTitleUpdate()) { return; }
        if (isChatPage()) {
            let pollAttempts = 0; const maxPollAttempts = 150;
            titleUpdatePollInterval = setInterval(() => {
                pollAttempts++;
                if (performTitleUpdate() || pollAttempts >= maxPollAttempts) {
                    clearInterval(titleUpdatePollInterval);
                    if (pollAttempts >= maxPollAttempts) { console.warn(`${logPrefix} Persistent title poll timed out.`); }
                }
            }, 200);
        }
    }
    function setupTitleObservers(chatListEl, snackbarEl) {
        if (titleListObserver) titleListObserver.disconnect();
        titleListObserver = new MutationObserver(scheduleTitleUpdate);
        titleListObserver.observe(chatListEl, { childList: true, subtree: true, attributes: true });
        console.log(`${logPrefix} Chat list observer attached.`);
        if (snackbarObserver) snackbarObserver.disconnect();
        snackbarObserver = new MutationObserver(scheduleTitleUpdate);
        snackbarObserver.observe(snackbarEl, { childList: true });
        console.log(`${logPrefix} Snackbar observer attached.`);
        scheduleTitleUpdate();
    }
    function setupUrlObserverForTitle() {
        if (urlObserver) urlObserver.disconnect();
        urlObserver = new MutationObserver(() => {
            if (location.href !== lastUrl) { lastUrl = location.href; scheduleTitleUpdate(); }
        });
        urlObserver.observe(document.body, { childList: true, subtree: true });
        console.log(`${logPrefix} URL observer attached.`);
    }

    // --- UI Control Functions ---
    function getCssRules(initialConvWidthPercentage) {
        const buttonRowHeight = 28; const promptGap = -8;
        let css = `
            :root { ${CSS_VAR_CONV_WIDTH}: ${initialConvWidthPercentage}%; }
            #${BUTTON_UI_CONTAINER_ID} { position: fixed !important; right: 15px !important; bottom: 15px !important; z-index: 200001 !important; display: flex !important; flex-direction: column-reverse !important; align-items: center !important; }
            .gm-temp-alert { padding: 3px 7px !important; font-size: 11px !important; font-weight: 500; border-radius: 3px !important; width: fit-content !important; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.25); display: block; opacity: 0; transition: opacity 0.15s ease-out, transform 0.15s cubic-bezier(0.25, 0.85, 0.45, 1.45); position: absolute; bottom: ${buttonRowHeight + promptGap}px; left: 50%; z-index: 200002 !important; white-space: nowrap; }
            .gm-alert-display { background-color: #303134 !important; color: #cacecf !important; } .gm-alert-nope, .gm-alert-limit { background-color: #e53935 !important; color: white !important; font-size: 10px !important; font-weight: bold; padding: 3px 6px !important; border-radius: 4px !important; }
            .${BUTTON_ROW_CLASS} { display: flex !important; justify-content: center !important; align-items: center !important; }
            .gm-conv-width-control-button { width: ${buttonWidth}px !important; height: ${buttonWidth}px !important; padding: 0 !important; background-color: #3c4043 !important; color: #e8eaed !important; border: 1px solid #5f6368 !important; border-radius: 6px !important; cursor: pointer !important; font-size: 16px !important; font-weight: bold; line-height: ${buttonWidth - 2}px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.2); opacity: 0.80 !important; transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out; }
            #${GRID_LAYOUT_PREV_ID}, #${GRID_LAYOUT_NEXT_ID} { font-size: 12px !important; }
            .gm-conv-width-control-button:hover:not([disabled]) { background-color: #4a4e51 !important; opacity: 1 !important; }
            .gm-conv-width-control-button[disabled] { opacity: 0.4 !important; cursor: not-allowed !important; background-color: #3c4043 !important; }
            #${GRID_LAYOUT_PREV_ID} { margin-left: 0px !important; } #${GRID_LAYOUT_NEXT_ID} { margin-left: ${buttonMargin}px !important; } #${BUTTON_DECREASE_ID} { margin-left: ${buttonMargin}px !important; } #${BUTTON_INCREASE_ID} { margin-left: ${buttonMargin}px !important; }
            ${STABLE_CHAT_ROOT_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} { width: 90% !important; max-width: 1700px !important; margin: auto !important; padding-top: 0px !important; padding-bottom: 20px !important; box-sizing: border-box !important; position: relative !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container { width: var(${CSS_VAR_CONV_WIDTH}) !important; max-width: 100% !important; margin: 10px auto !important; padding: 0 15px !important; box-sizing: border-box !important; overflow: hidden !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} { width: 100% !important; max-width: none !important; display: flex !important; justify-content: flex-end !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR}, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} { width: 100% !important; max-width: none !important; display: flex !important; justify-content: flex-start !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} > span.user-query-container.right-align-content, ${UNSTABLE_ID_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} > span.user-query-container.right-align-content, ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} > div:first-child { max-width: 90% !important; margin: 0 !important; box-sizing: border-box !important; display: flex !important; justify-content: flex-end !important; }
            ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${USER_QUERY_OUTER_SELECTOR} ${USER_QUERY_BUBBLE_SPAN_SELECTOR}, ${STABLE_CHAT_ROOT_SELECTOR} .conversation-container ${MODEL_RESPONSE_OUTER_SELECTOR} ${MODEL_RESPONSE_MAIN_PANEL_SELECTOR} { max-width: calc(1024px - var(--gem-sys-spacing--m)*2) !important; }
        `;
        return css;
    }
    function updateButtonTitles() { if (prevLayoutButtonElement) prevLayoutButtonElement.title = `Prev Canvas Layout / 上個 Canvas 佈局 (${currentGridLayoutIndex + 1}/${GRID_LAYOUT_STATES.length})`; if (nextLayoutButtonElement) nextLayoutButtonElement.title = `Next Layout / 下個 Canvas 佈局 (${currentGridLayoutIndex + 1}/${GRID_LAYOUT_STATES.length})`; if (decreaseConvWidthButtonElement) decreaseConvWidthButtonElement.title = `Width - / 寬度 - (${currentConvWidthPercentage}%)`; if (increaseConvWidthButtonElement) increaseConvWidthButtonElement.title = `Width + / 寬度 + (${currentConvWidthPercentage}%)`; }
    function showDynamicTemporaryAlert(text, alertTypeClass, horizontalShift) { const uiContainer = document.getElementById(BUTTON_UI_CONTAINER_ID); if (!uiContainer) return; const alertElement = document.createElement('div'); alertElement.classList.add('gm-temp-alert', alertTypeClass); alertElement.textContent = text; alertElement.style.transform = `translateX(calc(-50% + ${horizontalShift}px)) translateY(5px)`; uiContainer.appendChild(alertElement); requestAnimationFrame(() => { alertElement.style.opacity = (alertTypeClass === 'gm-alert-nope' || alertTypeClass === 'gm-alert-limit') ? '0.7' : '0.8'; alertElement.style.transform = `translateX(calc(-50% + ${horizontalShift}px)) translateY(-10px)`; }); const visibleDuration = (alertTypeClass === 'gm-alert-display') ? 350 : 250; setTimeout(() => { alertElement.style.opacity = '0'; alertElement.style.transform = `translateX(calc(-50% + ${horizontalShift}px)) translateY(-25px)`; setTimeout(() => { if (alertElement.parentNode) alertElement.parentNode.removeChild(alertElement); }, 150); }, visibleDuration); }
    function updateLayoutButtonStates() { const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR); const canvasIsVisible = immersivePanel && window.getComputedStyle(immersivePanel).display !== 'none'; if (prevLayoutButtonElement) prevLayoutButtonElement.disabled = !canvasIsVisible || (currentGridLayoutIndex === 0); if (nextLayoutButtonElement) nextLayoutButtonElement.disabled = !canvasIsVisible || (currentGridLayoutIndex === GRID_LAYOUT_STATES.length - 1); updateButtonTitles(); }
    function applyGridLayout(newIndex) { currentGridLayoutIndex = newIndex; const chatWindow = document.querySelector(CHAT_WINDOW_GRID_TARGET_SELECTOR); if (chatWindow) { chatWindow.style.setProperty('grid-template-columns', GRID_LAYOUT_STATES[currentGridLayoutIndex], 'important'); const immersivePanelElement = document.querySelector(IMMERSIVE_PANEL_SELECTOR); if (immersivePanelElement && window.getComputedStyle(immersivePanelElement).display === 'none' && currentGridLayoutIndex !== 0) { immersivePanelElement.style.setProperty('display', 'block', 'important'); } } updateLayoutButtonStates(); showDynamicTemporaryAlert(`(${currentGridLayoutIndex + 1}/${GRID_LAYOUT_STATES.length})`, 'gm-alert-display', LAYOUT_ALERT_HORIZONTAL_SHIFT); }
    function updateConversationContainerWidth(newPercentage, fromButton = true) { const oldPercentage = currentConvWidthPercentage; const clampedPercentage = Math.max(MIN_CONV_WIDTH_PERCENTAGE, Math.min(MAX_CONV_WIDTH_PERCENTAGE, newPercentage)); if (fromButton) { if (newPercentage < MIN_CONV_WIDTH_PERCENTAGE && oldPercentage === MIN_CONV_WIDTH_PERCENTAGE) { showDynamicTemporaryAlert("Min!", 'gm-alert-limit', WIDTH_ALERT_HORIZONTAL_SHIFT); return; } if (newPercentage > MAX_CONV_WIDTH_PERCENTAGE && oldPercentage === MAX_CONV_WIDTH_PERCENTAGE) { showDynamicTemporaryAlert("Max!", 'gm-alert-limit', WIDTH_ALERT_HORIZONTAL_SHIFT); return; } } currentConvWidthPercentage = clampedPercentage; document.documentElement.style.setProperty(CSS_VAR_CONV_WIDTH, currentConvWidthPercentage + '%'); localStorage.setItem(STORAGE_KEY_CONV_WIDTH, currentConvWidthPercentage); if (fromButton) showDynamicTemporaryAlert(`${currentConvWidthPercentage}%`, 'gm-alert-display', WIDTH_ALERT_HORIZONTAL_SHIFT); updateButtonTitles(); }
    function createControlButtons() { if (document.getElementById(BUTTON_UI_CONTAINER_ID)) return; const uiContainer = document.createElement('div'); uiContainer.id = BUTTON_UI_CONTAINER_ID; const buttonRow = document.createElement('div'); buttonRow.classList.add(BUTTON_ROW_CLASS); prevLayoutButtonElement = document.createElement('button'); prevLayoutButtonElement.id = GRID_LAYOUT_PREV_ID; prevLayoutButtonElement.textContent = '|<'; prevLayoutButtonElement.classList.add('gm-conv-width-control-button'); prevLayoutButtonElement.addEventListener('click', () => { const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR); if (!immersivePanel || window.getComputedStyle(immersivePanel).display === 'none') { showDynamicTemporaryAlert("Nope!", 'gm-alert-nope', LAYOUT_ALERT_HORIZONTAL_SHIFT); return; } if (currentGridLayoutIndex > 0) applyGridLayout(currentGridLayoutIndex - 1); else updateLayoutButtonStates(); }); nextLayoutButtonElement = document.createElement('button'); nextLayoutButtonElement.id = GRID_LAYOUT_NEXT_ID; nextLayoutButtonElement.textContent = '>|'; nextLayoutButtonElement.classList.add('gm-conv-width-control-button'); nextLayoutButtonElement.addEventListener('click', () => { const immersivePanel = document.querySelector(IMMERSIVE_PANEL_SELECTOR); if (!immersivePanel || window.getComputedStyle(immersivePanel).display === 'none') { showDynamicTemporaryAlert("Nope!", 'gm-alert-nope', LAYOUT_ALERT_HORIZONTAL_SHIFT); return; } if (currentGridLayoutIndex < GRID_LAYOUT_STATES.length - 1) applyGridLayout(currentGridLayoutIndex + 1); else updateLayoutButtonStates(); }); decreaseConvWidthButtonElement = document.createElement('button'); decreaseConvWidthButtonElement.id = BUTTON_DECREASE_ID; decreaseConvWidthButtonElement.textContent = '-'; decreaseConvWidthButtonElement.classList.add('gm-conv-width-control-button'); decreaseConvWidthButtonElement.addEventListener('click', () => updateConversationContainerWidth(currentConvWidthPercentage - STEP_CONV_WIDTH_PERCENTAGE, true)); increaseConvWidthButtonElement = document.createElement('button'); increaseConvWidthButtonElement.id = BUTTON_INCREASE_ID; increaseConvWidthButtonElement.textContent = '+'; increaseConvWidthButtonElement.classList.add('gm-conv-width-control-button'); increaseConvWidthButtonElement.addEventListener('click', () => updateConversationContainerWidth(currentConvWidthPercentage + STEP_CONV_WIDTH_PERCENTAGE, true)); buttonRow.appendChild(prevLayoutButtonElement); buttonRow.appendChild(nextLayoutButtonElement); buttonRow.appendChild(decreaseConvWidthButtonElement); buttonRow.appendChild(increaseConvWidthButtonElement); uiContainer.appendChild(buttonRow); document.body.appendChild(uiContainer); }
    function setupCanvasObserver(chatWindowElement) { if (canvasObserver) canvasObserver.disconnect(); canvasObserver = new MutationObserver(updateLayoutButtonStates); canvasObserver.observe(chatWindowElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] }); updateLayoutButtonStates(); }


    // --- Initialization ---
    function initialize() {
        originalDocTitle = document.title || 'Gemini';
        currentConvWidthPercentage = parseInt(localStorage.getItem(STORAGE_KEY_CONV_WIDTH), 10) || DEFAULT_CONV_WIDTH_PERCENTAGE;
        document.documentElement.style.setProperty(CSS_VAR_CONV_WIDTH, currentConvWidthPercentage + '%');
        const style = document.createElement('style');
        style.textContent = getCssRules(currentConvWidthPercentage);
        document.head.appendChild(style);

        const setupUI = () => {
            createControlButtons();
            updateButtonTitles();
            console.log(`${logPrefix} Waiting for essential components...`);

            const waitForChatListAndTitle = (chatListEl) => {
                console.log(`${logPrefix} Found '${CHAT_LIST_CONTAINER_SELECTOR}'.`);
                waitForElement(SELECTED_CHAT_ITEM_SELECTOR, (selectedTitleElement) => {
                    console.log(`${logPrefix} Found selected chat title:`, selectedTitleElement.textContent.trim());
                    scheduleTitleUpdate(); // 初始標題可能已經存在，直接觸發更新
                    waitForElement(SNACKBAR_CONTAINER_SELECTOR, (snackbarEl) => {
                        console.log(`${logPrefix} Found '${SNACKBAR_CONTAINER_SELECTOR}'. Attaching all title observers.`);
                        setupTitleObservers(chatListEl, snackbarEl);
                    });
                }, 10000); // 初始等待選中聊天標題的時間，可以調整
            };

            waitForElement(CHAT_LIST_CONTAINER_SELECTOR, waitForChatListAndTitle);

            waitForElement(CHAT_WINDOW_GRID_TARGET_SELECTOR, (chatWindow) => {
                try {
                    const currentLayout = window.getComputedStyle(chatWindow).gridTemplateColumns;
                    const normalized = currentLayout.replace(/\s+/g, ' ').trim();
                    const idx = GRID_LAYOUT_STATES.findIndex(s => s.replace(/\s+/g, ' ').trim() === normalized);
                    currentGridLayoutIndex = (idx !== -1) ? idx : 0;
                } catch(e) { currentGridLayoutIndex = 0; }
                setupCanvasObserver(chatWindow);
            });
            setupUrlObserverForTitle();
        };

        if (document.readyState === 'loading') { window.addEventListener('DOMContentLoaded', setupUI); }
        else { setupUI(); }
    }

    initialize();
})();