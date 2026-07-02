const { ipcRenderer } = require('electron');

// Window Controls
document.getElementById('btn-minimize').onclick = () => ipcRenderer.send('window-control', 'minimize');
document.getElementById('btn-maximize').onclick = () => ipcRenderer.send('window-control', 'maximize');
document.getElementById('btn-close').onclick = () => ipcRenderer.send('window-control', 'close');

// Theme Toggle
const themeToggleBtn = document.getElementById('btn-toggle-theme');
themeToggleBtn.onclick = () => {
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
};

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
    const historyContainer = document.getElementById('history-list');
    if (!historyContainer) return;

    // Clear current list
    historyContainer.innerHTML = '';

    // Add each item to the list
    fileHistory.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'history-item';
        listItem.setAttribute('data-path', item.path);
        listItem.title = `${item.name}\n${item.path}`;

        // Create a tooltip with full path for hover display
        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = item.name;
        fileNameSpan.classList.add('file-name-tooltip');
        fileNameSpan.setAttribute('data-full-path', item.path);

        // Add click handler to open file
        listItem.onclick = () => {
            openFileFromHistory(item.path);
        };

        listItem.appendChild(fileNameSpan);
        historyContainer.appendChild(listItem);
    });
}

// Open a file from the history list
async function openFileFromHistory(filePath) {
    try {
        const rawContent = await ipcRenderer.invoke('read-file', filePath);
        let htmlContent = marked.parse(rawContent);
        const contentViewer = document.getElementById('markdown-body');
        contentViewer.innerHTML = htmlContent;

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
                <button class="mermaid-btn btn-export" data-code-id="${codeId}">💾 Export</button>
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
    } else if (e.target.classList.contains('btn-export')) {
        const codeId = e.target.getAttribute('data-code-id');
        const code = mermaidCodeStore.get(codeId);
        await exportDiagram(code);
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

async function exportDiagram(mermaidCode) {
    try {
        alert('Exporting diagram...\n\nFunctionality: Rendering to SVG and triggering system save dialog.');
        console.log('Exporting this code:', mermaidCode);
    } catch (error) {
        console.error('Error exporting diagram:', error);
    }
}

document.getElementById('btn-open').onclick = renderMarkdown;

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Load history from localStorage on startup
    updateHistoryDisplay();

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
}

mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose'
});