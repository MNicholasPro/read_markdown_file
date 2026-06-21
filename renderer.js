const { ipcRenderer } = require('electron');

// Window Controls
document.getElementById('btn-minimize').onclick = () => ipcRenderer.send('window-control', 'minimize');
document.getElementById('btn-maximize').onclick = () => ipcRenderer.send('window-control', 'maximize');
document.getElementById('btn-close').onclick = () => ipcRenderer.send('window-control', 'close');

// Background Hue Control
const hueSlider = document.getElementById('bg-hue');
hueSlider.oninput = (e) => {
    document.documentElement.style.setProperty('--primary-hue', e.target.value);
};

document.getElementById('btn-random-bg').onclick = () => {
    const randomHue = Math.floor(Math.random() * 360);
    hueSlider.value = randomHue;
    document.documentElement.style.setProperty('--primary-hue', randomHue);
};

// Theme Toggle
const themeToggleBtn = document.getElementById('btn-toggle-theme');
themeToggleBtn.onclick = () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
};

// Markdown Rendering Configuration
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    breaks: true,
    gfm: true
});

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

mermaid.initialize({ 
    startOnLoad: false, 
    theme: 'default',
    securityLevel: 'loose' 
});