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

closeFullscreenBtn.onclick = () => {
    fullscreenDialog.close();
};

window.addEventListener('resize', () => {
    if (fullscreenDialog.open) {
        // 此时我们需要从 DOM 中找回原始代码重新渲染
        const mermaidDiv = document.getElementById('fullscreen-mermaid');
        if (mermaidDiv) {
            // 注意：mermaid 渲染后会把文本替换成 SVG，
            // 所以我们需要在渲染前把原始文本存起来，或者从 data 属性读
            const code = mermaidDiv.getAttribute('data-original-code');
            if (code) renderMermaidInFullscreen(code);
        }
    }
});

// 辅助函数：将代码存入临时存储，避免 HTML 属性导致的转义问题
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
            
            // 关键点 1: 不把代码直接放在 data-code 属性里，而是存入 Map
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

// 事件委托
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
        // 1. 立即显示对话框 (关键！先让元素进入 DOM 且可见，以便 Mermaid 计算尺寸)
        fullscreenDialog.showModal();

        // 2. 彻底清空内容
        fullscreenContent.innerHTML = ''; 
        
        // 3. 创建纯净的容器
        const containerDiv = document.createElement('div');
        containerDiv.className = 'fullscreen-diagram-container';
        containerDiv.style.display = 'flex';
        containerDiv.style.justifyContent = 'center';
        containerDiv.style.alignItems = 'center';
        containerDiv.style.width = '100%';
        containerDiv.style.height = '100%';

        const mermaidDiv = document.createElement('div');
        mermaidDiv.id = 'fullscreen-mermaid';
        mermaidDiv.className = 'mermaid';
        // 确保是纯文本
        mermaidDiv.textContent = mermaidCode;
        
        containerDiv.appendChild(mermaidDiv);
        fullscreenContent.appendChild(containerDiv);
        
        // 4. 稍微延迟一点点，确保浏览器已经完成了 Dialog 的显示渲染
        await new Promise(resolve => setTimeout(resolve, 50));

        // 5. 执行渲染
        await mermaid.run({
            querySelector: '#fullscreen-mermaid'
        });

        console.log('Fullscreen render complete');
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

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

async function renderMermaidInFullscreen(mermaidCode) {
    try {
        // 1. 彻底清空容器
        fullscreenContent.innerHTML = '';
        
        // 2. 创建容器
        const containerDiv = document.createElement('div');
        containerDiv.className = 'fullscreen-diagram-container';
        containerDiv.style.width = '100%';
        
        // 3. 创建 mermaid 元素
        const mermaidDiv = document.createElement('div');
        mermaidDiv.id = 'fullscreen-mermaid';
        mermaidDiv.className = 'mermaid';
        // 关键点：保存原始代码在 data 属性中，用于 resize 重新渲染
        mermaidDiv.setAttribute('data-original-code', mermaidCode);
        mermaidDiv.textContent = mermaidCode;
        
        containerDiv.appendChild(mermaidDiv);
        fullscreenContent.appendChild(containerDiv);
        
        // 4. 强制 Mermaid 重新渲染该元素
        await mermaid.run({
            querySelector: '#fullscreen-mermaid'
        });
    } catch (error) {
        console.error('Error rendering in fullscreen:', error);
    }
}

document.getElementById('btn-open').onclick = renderMarkdown;

// 在 renderer.js 中添加
function createZoomButtons() {
    const container = document.createElement('div');
    container.id = 'mermaid-zoom-controls';
    container.innerHTML = `
        <button id="zoom-in">+</button>
        <button id="zoom-out">−</button>
        <button id="zoom-reset">Reset</button>
    `;
    document.body.appendChild(container);

    // 绑定事件
    document.getElementById('zoom-in').onclick = () => zoomElement(1.2);
    document.getElementById('zoom-out').onclick = () => zoomElement(0.8);
    document.getElementById('zoom-reset').onclick = () => zoomElement(1, true);
}

function zoomElement(scale, reset = false) {
    // 寻找当前可见/激活的 svg
    const svg = document.querySelector('.mermaid svg');
    if (!svg) return;

    if (reset) {
        svg.style.transform = 'scale(1)';
        svg.style.transformOrigin = 'center';
        return;
    }

    // 获取当前缩放倍数并计算
    const currentScale = parseFloat(svg.style.transform.replace('scale(', '').replace(')', '')) || 1;
    svg.style.transform = `scale(${currentScale * scale})`;
    svg.style.transformOrigin = 'center';
    svg.style.transition = 'transform 0.2s ease';
}

// 页面加载完成后立即创建按钮（虽然初始是隐藏的）
window.addEventListener('DOMContentLoaded', createZoomButtons);

mermaid.initialize({ 
    startOnLoad: false, 
    theme: 'default',
    securityLevel: 'loose' 
});

// 在你的点击 Fullscreen 按钮的事件处理器中
function openFullscreen(svgElement) {
    // 创建一个全屏遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'fullscreen-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: ${document.body.classList.contains('dark') ? '#1a1a1a' : '#f5f5f5'};
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: zoom-out;
    `;

    // 创建容器以支持缩放和居中
    const container = document.createElement('div');
    container.className = 'fullscreen-container';
    
    // 克隆 SVG 以免从原页面移除
    const clonedSvg = svgElement.cloneNode(true);
    clonedSvg.style.width = 'auto';
    clonedSvg.style.height = 'auto';
    clonedSvg.style.maxWidth = '90vw';
    clonedSvg.style.maxHeight = '90vh';
    
    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕ Close';
    closeBtn.id = 'fullscreen-close-btn';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #ff4d4f;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;

    container.appendChild(clonedSvg);
    overlay.appendChild(container);
    overlay.appendChild(closeBtn);

    // 关闭逻辑
    const close = () => document.body.removeChild(overlay);
    closeBtn.onclick = close;
    overlay.onclick = (e) => { if(e.target === overlay || e.target === container) close(); };

    document.body.appendChild(overlay);
}

// --- 缩放状态管理 ---
let currentScale = 1;
const zoomControls = document.getElementById('zoom-controls');

function updateZoom() {
    // 针对所有 mermaid 图表进行缩放
    const diagrams = document.querySelectorAll('.mermaid svg');
    diagrams.forEach(svg => {
        svg.style.transform = `scale(${currentScale})`;
        svg.style.transformOrigin = 'center center';
        svg.style.transition = 'transform 0.2s ease';
    });
}

document.getElementById('zoom-in').addEventListener('click', () => {
    currentScale += 0.2;
    updateZoom();
});

document.getElementById('zoom-out').addEventListener('click', () => {
    currentScale = Math.max(0.2, currentScale - 0.2);
    updateZoom();
});

document.getElementById('zoom-reset').addEventListener('click', () => {
    currentScale = 1;
    updateZoom();
});

// --- 修改 Fullscreen 逻辑 ---
// 假设你有一个触发 Fullscreen 的函数或按钮
function toggleFullscreen() {
    // 这里是你的全屏逻辑 (例如进入某个 modal 或使用 requestFullscreen)
    // 关键点：控制缩放按钮的显示/隐藏
    const isFull = !zoomControls.style.display || zoomControls.style.display === 'flex';
    
    if (isFull) {
        // 退出全屏
        zoomControls.style.display = 'none';
        currentScale = 1; // 重置缩放
        updateZoom();
    } else {
        // 进入全屏
        zoomControls.style.display = 'flex';
    }
}

// 如果你是通过某个按钮进入全屏的，请绑定它
document.getElementById('btn-fullscreen').addEventListener('click', toggleFullscreen);