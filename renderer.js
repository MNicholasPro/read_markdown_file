const { ipcRenderer } = require('electron');

// Window Controls
document.getElementById('btn-minimize').onclick = () => ipcRenderer.send('window-control', 'minimize');
document.getElementById('btn-maximize').onclick = () => ipcRenderer.send('window-control', 'maximize');
document.getElementById('btn-close').onclick = () => ipcRenderer.send('window-control', 'close');

// Theme Toggle
const themeToggleBtn = document.getElementById('btn-toggle-theme');

// Font Size Management
const fontSizeSlider = document.getElementById('font-size-slider');
const fontSizeValue = document.getElementById('font-size-value');
const markdownBody = document.getElementById('markdown-body');

function updateFontSize(size, save = true) {
    const fontSizePx = `${size}px`;
    markdownBody.style.fontSize = fontSizePx;
    if (fontSizeValue) {
        fontSizeValue.textContent = fontSizePx;
    }
    if (save) {
        localStorage.setItem('fontSize', size);
    }
}

// Initialize font size
const savedFontSize = localStorage.getItem('fontSize') || '18';
updateFontSize(savedFontSize, false);
if (fontSizeSlider) {
    fontSizeSlider.value = savedFontSize;
    fontSizeSlider.oninput = (e) => {
        updateFontSize(e.target.value);
    };
}

// System theme detection
ipcRenderer.invoke('get-system-theme').then((theme) => {
    if (theme === 'system') {
        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleSystemThemeChange = (e) => {
            document.body.setAttribute('data-theme', e.matches ? 'github-dark' : 'github-light');
        };
        mediaQuery.addEventListener('change', handleSystemThemeChange);
        // Set initial theme based on system preference
        handleSystemThemeChange(mediaQuery);
    } else {
        // Use the specific theme (either github-light or github-dark)
        document.body.setAttribute('data-theme', theme);
    }
});

// History management - stores up to 10 recent files
let fileHistory = JSON.parse(localStorage.getItem('fileHistory') || '[]');
let collections = JSON.parse(localStorage.getItem('fileCollections') || '[]');
let activeView = 'history'; // 'history' or collectionId

function saveCollections() {
    localStorage.setItem('fileCollections', JSON.stringify(collections));
}

// Add a file to history
function addToHistory(filePath, fileName) {
    // Remove if already exists (to update position)
    const existingIndex = fileHistory.findIndex(item => item.path === filePath);
    if (existingIndex !== -1) {
        fileHistory.splice(existingIndex, 1);
    }

    // Add to beginning of history
    fileHistory.unshift({
        path: filePath,
        name: fileName,
        timestamp: Date.now()
    });

    // Keep only last 10 items
    if (fileHistory.length > 10) {
        fileHistory = fileHistory.slice(0, 10);
    }

    // Save to localStorage
    localStorage.setItem('fileHistory', JSON.stringify(fileHistory));

    // Update history display
    updateHistoryDisplay();
}

// Update the history display in UI
function updateHistoryDisplay() {
    const itemsToRender = activeView === 'history'
        ? fileHistory
        : collections.find(c => c.id === activeView)?.files || [];

    renderDocumentList(itemsToRender, activeView === 'history');
}

// Generic function to render a list of documents
function renderDocumentList(items, isHistoryView) {
    const historyContainer = document.getElementById('history-list');
    if (!historyContainer) return;

    // Clear current list
    historyContainer.innerHTML = '';

    // Add each item to the list
    items.forEach((item) => {
        const listItem = document.createElement('li');
        listItem.className = 'history-item';

        const container = document.createElement('div');
        container.className = 'history-item-container';

        const content = document.createElement('div');
        content.className = 'history-item-content';

        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = item.name;
        fileNameSpan.classList.add('file-name-tooltip');
        fileNameSpan.setAttribute('data-full-path', `${item.name}\n${item.path}`);

        content.appendChild(fileNameSpan);

        content.onclick = () => {
            openFileFromHistory(item.path);
        };

        container.appendChild(content);

        if (isHistoryView) {
            const collectBtn = document.createElement('button');
            collectBtn.className = 'btn-collect';
            collectBtn.textContent = 'Collect';
            collectBtn.onclick = (e) => {
                e.stopPropagation();
                showSelectCollectionDialog(item);
            };
            container.appendChild(collectBtn);
        }

        listItem.appendChild(container);
        historyContainer.appendChild(listItem);
    });
}

// Update the collection tabs in UI
function updateCollectionTabs() {
    const tabsContainer = document.getElementById('collection-tabs');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    collections.forEach(collection => {
        const tab = document.createElement('div');
        tab.className = `collection-tab ${activeView === collection.id ? 'active' : ''}`;
        tab.textContent = collection.name;
        tab.onclick = () => {
            activeView = collection.id;
            updateCollectionTabs();
            updateHistoryDisplay();
        };
        tabsContainer.appendChild(tab);
    });
}

// Handle switching back to History view
function switchToHistoryView() {
    activeView = 'history';
    updateCollectionTabs();
    updateHistoryDisplay();
}

// --- Collection Management Logic ---

function showNewCollectionDialog() {
    const dialog = document.getElementById('dialog-new-collection');
    const input = document.getElementById('input-collection-name');
    if (dialog && input) {
        input.value = '';
        dialog.showModal();
    }
}

function saveNewCollection() {
    const input = document.getElementById('input-collection-name');
    const name = input.value.trim();
    if (name) {
        const newCollection = {
            id: 'coll_' + Date.now(),
            name: name,
            files: []
        };
        collections.push(newCollection);
        saveCollections();
        updateCollectionTabs();
        document.getElementById('dialog-new-collection').close();
    }
}

function showSelectCollectionDialog(item) {
    const dialog = document.getElementById('dialog-select-collection');
    const listContainer = document.getElementById('collection-select-list');
    if (!dialog || !listContainer) return;

    listContainer.innerHTML = '';
    if (collections.length === 0) {
        listContainer.innerHTML = '<p class="empty-msg">No collections available. Please create one first.</p>';
    } else {
        collections.forEach(collection => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'collection-select-item';
            itemDiv.textContent = collection.name;
            itemDiv.onclick = () => {
                addToCollection(item, collection.id);
                dialog.close();
            };
            listContainer.appendChild(itemDiv);
        });
    }
    dialog.showModal();
}

function addToCollection(item, collectionId) {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;

    const existingIndex = collection.files.findIndex(f => f.path === item.path);
    if (existingIndex === -1) {
        collection.files.push(item);
        saveCollections();
        // If we are currently viewing this collection, refresh the list
        if (activeView === collectionId) {
            updateHistoryDisplay();
        }
    }
}


// Update the Table of Contents based on the rendered markdown headings
function updateTOC() {
    const tocList = document.getElementById('toc-list');
    const contentViewer = document.getElementById('markdown-body');
    if (!tocList || !contentViewer) return;

    tocList.innerHTML = '';

    const headings = contentViewer.querySelectorAll('h1, h2, h3');
    headings.forEach((heading, index) => {
        // Ensure heading has an ID for scrolling
        if (!heading.id) {
            heading.id = `heading-${index}`;
        }

        const li = document.createElement('li');
        li.className = `toc-item depth-${heading.tagName.substring(1)}`;
        li.textContent = heading.textContent;
        li.onclick = () => {
            heading.scrollIntoView({ behavior: 'smooth' });
        };

        tocList.appendChild(li);
    });
}

// Open a file from the history list
async function openFileFromHistory(filePath) {
    try {
        const rawContent = await ipcRenderer.invoke('read-file', filePath);
        let htmlContent = marked.parse(rawContent);
        const contentViewer = document.getElementById('markdown-body');
        contentViewer.innerHTML = htmlContent;

        // Update Table of Contents
        updateTOC();

        // Add to history (this will update the display)
        addToHistory(filePath, getFileNameFromPath(filePath));

        // Render mermaid diagrams
        await renderMermaidDiagrams();
    } catch (error) {
        console.error('Error opening file from history:', error);
    }
}

// Helper function to extract filename from path
function getFileNameFromPath(path) {
    return path.split('/').pop() || path;
}

// Markdown Rendering Configuration
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    breaks: true,
    gfm: true
});

// Render mermaid diagrams in the content
async function renderMermaidDiagrams() {
    try {
        const contentViewer = document.getElementById('markdown-body');
        const mermaidBlocks = contentViewer.querySelectorAll('pre code.language-mermaid');

        for (let block of mermaidBlocks) {
            const pre = block.parentElement;
            const mermaidCode = block.textContent;
            const codeId = getCodeId(mermaidCode);

            const wrapperDiv = document.createElement('div');
            wrapperDiv.className = 'mermaid-wrapper';

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'mermaid-controls';
            controlsDiv.innerHTML = `
                <button class="mermaid-btn btn-fullscreen" data-code-id="${codeId}">🔍 Fullscreen</button>
                <select class="mermaid-btn btn-export" data-code-id="${codeId}">
                    <option value="" disabled selected>💾 Export</option>
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                    <option value="svg">SVG</option>
                </select>
            `;

            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.textContent = mermaidCode;

            wrapperDiv.appendChild(controlsDiv);
            wrapperDiv.appendChild(mermaidDiv);
            pre.replaceWith(wrapperDiv);
        }

        await mermaid.run();
    } catch (error) {
        console.error('Error rendering mermaid diagrams:', error);
    }
}

// Fullscreen Dialog Elements
const fullscreenDialog = document.getElementById('mermaid-fullscreen');
const fullscreenContent = document.getElementById('fullscreen-content');
const closeFullscreenBtn = document.getElementById('btn-close-fullscreen');

// --- Zoom State Management ---
let currentScale = 1;

function applyZoom() {
    const svg = document.querySelector('#fullscreen-mermaid svg');
    if (svg) {
        svg.style.transform = `scale(${currentScale})`;
        svg.style.transformOrigin = 'center center';
        svg.style.transition = 'transform 0.2s ease';
    }
}

closeFullscreenBtn.onclick = () => {
    fullscreenDialog.close();
    // currentScale = 1; // Reset zoom when closing
};

window.addEventListener('resize', () => {
    if (fullscreenDialog.open) {
        const mermaidDiv = document.getElementById('fullscreen-mermaid');
        if (mermaidDiv) {
            const code = mermaidDiv.getAttribute('data-original-code');
            if (code) renderMermaidInFullscreen(code);
        }
    }
});

const mermaidCodeStore = new Map();
let codeCounter = 0;

function getCodeId(code) {
    const id = `mermaid-code-${codeCounter++}`;
    mermaidCodeStore.set(id, code);
    return id;
}

async function renderMarkdown() {
    const contentViewer = document.getElementById('markdown-body');

    try {
        const filePath = await ipcRenderer.invoke('open-file');
        if (!filePath) return;

        const rawContent = await ipcRenderer.invoke('read-file', filePath);
        let htmlContent = marked.parse(rawContent);
        contentViewer.innerHTML = htmlContent;

        // Update Table of Contents
        updateTOC();

        // Add to history
        addToHistory(filePath, getFileNameFromPath(filePath));

        // Render mermaid diagrams
        await renderMermaidDiagrams();
    } catch (error) {
        console.error('Error rendering markdown:', error);
    }
}

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-fullscreen')) {
        const codeId = e.target.getAttribute('data-code-id');
        const code = mermaidCodeStore.get(codeId);
        await viewInFullscreen(code);
    }
});

document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('btn-export')) {
        const format = e.target.value;
        if (!format) return;
        const codeId = e.target.getAttribute('data-code-id');
        // Find the specific mermaid div associated with this button
        const wrapper = e.target.closest('.mermaid-wrapper');
        const element = wrapper ? wrapper.querySelector('.mermaid') : null;

        if (element) {
            const timestamp = new Date().getTime();
            const fileName = `diagram_${timestamp}`;
            await exportDiagram(format, element, fileName);
            // Reset select to default
            e.target.value = "";
        } else {
            alert("Could not find the diagram to export.");
        }
    }
});

async function viewInFullscreen(mermaidCode) {
    try {
        fullscreenDialog.showModal();
        currentScale = 1; // Reset zoom scale for new diagram
        await renderMermaidInFullscreen(mermaidCode);
    } catch (error) {
        console.error('Error rendering in fullscreen:', error);
    }
}

async function renderMermaidInFullscreen(mermaidCode) {
    try {
        fullscreenContent.innerHTML = '';

        /* ---------------------------------------------
         * 1️⃣ 生成缩放控制按钮
         * --------------------------------------------- */
        const zoomControls = document.createElement('div');
        zoomControls.id = 'fullscreen-zoom-controls';
        zoomControls.style.cssText = 'position: absolute; bottom: 10px; right: 10px; display: flex; gap: 5px; background: rgba(255,255,255,0.8); border: 1px solid #ccc; padding: 5px; border-radius: 4px; z-index: 10;';

        zoomControls.innerHTML = `
            <button id="zoom-in">+</button>
            <button id="zoom-out">−</button>
            <button id="zoom-reset">Reset</button>
        `;

        /* ---------------------------------------------
         * 2️⃣ 创建容器 & Mermaid 代码块
         * --------------------------------------------- */
        const containerDiv = document.createElement('div');
        containerDiv.className = 'fullscreen-diagram-container';
        containerDiv.style.cssText = 'width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; overflow: hidden; position: relative;';

        const mermaidDiv = document.createElement('div');
        mermaidDiv.id = 'fullscreen-mermaid';
        mermaidDiv.className = 'mermaid';
        mermaidDiv.setAttribute('data-original-code', mermaidCode);
        mermaidDiv.textContent = mermaidCode;

        containerDiv.appendChild(mermaidDiv);
        fullscreenContent.appendChild(containerDiv);
        fullscreenContent.appendChild(zoomControls);

        /* ---------------------------------------------
         * 3️⃣ 渲染 Mermaid 并初始化 Pan-Zoom
         * --------------------------------------------- */
        await new Promise(resolve => setTimeout(resolve, 50));
        await mermaid.run({ querySelector: '#fullscreen-mermaid' });

        const svg = document.querySelector('#fullscreen-mermaid svg');
        if (svg) {
            // Ensure SVG fills the container for pan-zoom to work correctly
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.maxWidth = 'none';
            svg.style.maxHeight = 'none';

            // Initialize svg-pan-zoom
            const panZoomInstance = svgPanZoom('#fullscreen-mermaid svg', {
                zoomEnabled: true,
                controlPanelsEnabled: true,
                zoomScaleSensitivity: 0.3,
                lowerZoomLimit: 0.1,
                upperZoomLimit: 10,
                minZoomLevel: 0.1,
                maxZoomLevel: 10
            });

            // Bind the custom buttons to the pan-zoom instance
            zoomControls.querySelector('#zoom-in').onclick = () => {
                panZoomInstance.zoomIn();
            };
            zoomControls.querySelector('#zoom-out').onclick = () => {
                panZoomInstance.zoomOut();
            };
            zoomControls.querySelector('#zoom-reset').onclick = () => {
                panZoomInstance.resetZoom();
                panZoomInstance.center();
            };
        }
    } catch (error) {
        console.error('Error rendering in fullscreen:', error);
    }
}

/**
 * 导出函数：支持 SVG (原生), PNG, JPG
 * @param {string} format - 'svg', 'png', or 'jpg'
 * @param {HTMLElement} element - 要导出的 DOM 元素
 * @param {string} filename - 文件名
 */
async function exportDiagram(format, element, filename) {
    // --- 新增：检查 element 是否有效 ---
    if (!element) {
        console.error("Export Error: No element provided to exportDiagram.");
        alert("错误：未找到要导出的图表内容。");
        return;
    }
    try {
        if (format === 'svg') {
            // SVG 导出最简单，直接获取 SVG 节点的 XML
            const svgElement = element.querySelector('svg');
            if (!svgElement) throw new Error("No SVG element found");
            
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
        } else if (format === 'png' || format === 'jpg') {
            // PNG/JPG 导出需要使用 html2canvas 来捕捉渲染后的像素
            // scale: 2 实现了 2x 分辨率（Retina 级别清晰度）
            const canvas = await html2canvas(element, {
                scale: 2, 
                useCORS: true,
                backgroundColor: format === 'png' ? null : '#ffffff',
                logging: false
            });

            const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
            const dataUrl = canvas.toDataURL(mimeType, 0.9); // 0.9 是 jpg 的质量
            
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${filename}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error('Export failed:', error);
        alert(`导出 ${format.toUpperCase()} 失败: ${error.message}`);
    }
}

/**
 * 绑定到 UI 按钮的调用函数
 * 假设你的 HTML 按钮长这样: <button onclick="handleExport('png')">导出 PNG</button>
 */
window.handleExport = async function(format) {
    // 寻找页面中所有的 mermaid 容器 (通常是 .mermaid 或含有 svg 的 div)
    const diagrams = document.querySelectorAll('.mermaid, .mermaid svg, [data-processed="true"]');
    
    if (diagrams.length === 0) {
        alert("未检测到可导出的图表");
        return;
    }

    // 默认导出第一个找到的图表，或者你可以遍历所有
    // 这里演示导出第一个
    const target = diagrams[0];
    const timestamp = new Date().getTime();
    const fileName = `diagram_${timestamp}`;

    await exportDiagram(format, target, fileName);
};

document.getElementById('btn-open').onclick = renderMarkdown;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load history and collections from localStorage on startup
    updateHistoryDisplay();
    updateCollectionTabs();

    // Set up all event listeners
    initEventListeners();
});

// Toggle sidebar visibility with enhanced debugging
function toggleSidebar(event) {
    console.log('toggleSidebar called', event);

    const controlPanel = document.getElementById('control-panel');
    const contentViewer = document.getElementById('content-viewer');
    const mainContainer = document.getElementById('main-container');

    if (!controlPanel) {
        console.error('Control panel not found!');
        return;
    }

    try {
        // Check current state using a data attribute or CSS class for better reliability
        const isHidden = controlPanel.classList.contains('hidden');
        console.log('Current sidebar state:', isHidden ? 'hidden' : 'visible');

        if (isHidden) {
            // Show sidebar
            controlPanel.classList.remove('hidden');
            console.log('Sidebar shown successfully');
        } else {
            // Hide sidebar
            controlPanel.classList.add('hidden');
            contentViewer.style.marginLeft = '0px';   // Reset margin when hidden
            console.log('Sidebar hidden successfully');
        }
    } catch (error) {
        console.error('Error toggling sidebar:', error);
    }
}

// Initialize all event listeners with better error handling
function initEventListeners() {
    // Set up sidebar toggle button
    const sidebarToggleBtn = document.getElementById('btn-toggle-sidebar');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
        console.log('Sidebar toggle button initialized');
    } else {
        console.warn('Sidebar toggle button not found during init');

        // Try to initialize after a short delay
        setTimeout(() => {
            const retryBtn = document.getElementById('btn-toggle-sidebar');
            if (retryBtn) {
                retryBtn.addEventListener('click', toggleSidebar);
                console.log('Sidebar toggle button initialized with retry');
            }
        }, 1000);
    }

    // Set up other buttons
    const openBtn = document.getElementById('btn-open');
    if (openBtn) {
        openBtn.addEventListener('click', renderMarkdown);
    }

    const minimizeBtn = document.getElementById('btn-minimize');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => ipcRenderer.send('window-control', 'minimize'));
    }

    const maximizeBtn = document.getElementById('btn-maximize');
    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => ipcRenderer.send('window-control', 'maximize'));
    }

    const closeBtn = document.getElementById('btn-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => ipcRenderer.send('window-control', 'close'));
    }

    const themeToggleBtn = document.getElementById('btn-toggle-theme');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.getAttribute('data-theme') || 'github-light';
            let newTheme;

            // Cycle between GitHub light and dark themes only
            if (currentTheme === 'github-light') {
                newTheme = 'github-dark';
            } else {
                newTheme = 'github-light';
            }

            document.body.setAttribute('data-theme', newTheme);
            ipcRenderer.send('set-theme', newTheme);
        });
    }

    // History view toggle
    const viewHistoryBtn = document.getElementById('btn-view-history');
    if (viewHistoryBtn) {
        viewHistoryBtn.addEventListener('click', switchToHistoryView);
    }

    // Collection event listeners
    const addCollectionBtn = document.getElementById('btn-add-collection');
    if (addCollectionBtn) {
        addCollectionBtn.addEventListener('click', showNewCollectionDialog);
    }

    const saveCollectionBtn = document.getElementById('btn-save-collection');
    if (saveCollectionBtn) {
        saveCollectionBtn.addEventListener('click', saveNewCollection);
    }

    const cancelCollectionBtn = document.getElementById('btn-cancel-collection');
    if (cancelCollectionBtn) {
        cancelCollectionBtn.addEventListener('click', () => {
            document.getElementById('dialog-new-collection').close();
        });
    }

    const cancelSelectBtn = document.getElementById('btn-cancel-select');
    if (cancelSelectBtn) {
        cancelSelectBtn.addEventListener('click', () => {
            document.getElementById('dialog-select-collection').close();
        });
    }
}

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose'
});