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

// Close fullscreen dialog
closeFullscreenBtn.onclick = () => {
    fullscreenDialog.close();
};

// Handle window resize for fullscreen
window.addEventListener('resize', () => {
    if (fullscreenDialog.open) {
        // Re-render diagram in fullscreen when window is resized
        const currentDiagram = fullscreenContent.querySelector('.mermaid');
        if (currentDiagram) {
            const mermaidCode = currentDiagram.textContent;
            renderMermaidInFullscreen(mermaidCode);
        }
    }
});

async function renderMarkdown() {
    const contentViewer = document.getElementById('markdown-body');
    
    try {
        // 1. Open File Dialog
        const filePath = await ipcRenderer.invoke('open-file');
        if (!filePath) return;

        // 2. Read File Content
        const rawContent = await ipcRenderer.invoke('read-file', filePath);
        
        // 3. Convert Markdown to HTML
        let htmlContent = marked.parse(rawContent);
        contentViewer.innerHTML = htmlContent;

        // 4. Process Mermaid Diagrams
        // We look for <pre><code class="language-mermaid">...</code></pre> blocks
        const mermaidBlocks = contentViewer.querySelectorAll('pre code.language-mermaid');
        
        for (let block of mermaidBlocks) {
            const pre = block.parentElement;
            const mermaidCode = block.textContent;
            
            // Create a div for mermaid to render into
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid';
            mermaidDiv.innerHTML = `<div class="mermaid-controls">
                <button class="mermaid-btn" onclick="viewInFullscreen('${escapeHtml(mermaidCode)}')">🔍 Fullscreen</button>
                <button class="mermaid-btn" onclick="exportDiagram('${escapeHtml(mermaidCode)}')">💾 Export</button>
            </div>`;
            
            // Create a container to hold the diagram
            const diagramContainer = document.createElement('div');
            diagramContainer.className = 'diagram-container';
            diagramContainer.appendChild(mermaidDiv);
            
            pre.replaceWith(diagramContainer);
        }

        // Trigger Mermaid rendering
        await mermaid.run();
        
    } catch (error) {
        console.error('Error rendering markdown:', error);
        alert('Failed to load the markdown file.');
    }
}

// Helper function to escape HTML in strings
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Function to view mermaid diagram in fullscreen
window.viewInFullscreen = async function(mermaidCode) {
    try {
        // Create a temporary container for the diagram
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `<div class="mermaid">${mermaidCode}</div>`;
        
        // Render into fullscreen
        await renderMermaidInFullscreen(mermaidCode);
        
        // Show dialog
        fullscreenDialog.showModal();
    } catch (error) {
        console.error('Error rendering full screen diagram:', error);
    }
};

// Function to export mermaid diagram as image
window.exportDiagram = async function(mermaidCode) {
    try {
        const { save } = require('@electron/remote');
        
        // We'll create a temporary SVG from the mermaid code using a canvas approach
        // For simplicity, this will render a static preview in a new window for now
        
        alert('Diagram export functionality would open an image saving dialog here.\n\nIn a full implementation, it would generate and save an image file.');
        
    } catch (error) {
        console.error('Error exporting diagram:', error);
    }
};

// Function to render mermaid in fullscreen
async function renderMermaidInFullscreen(mermaidCode) {
    try {
        // Clear previous content
        fullscreenContent.innerHTML = '';
        
        // Create a container for the full screen diagram
        const containerDiv = document.createElement('div');
        containerDiv.style.width = '100%';
        containerDiv.style.height = '100%';
        containerDiv.className = 'fullscreen-diagram-container';
        
        // Add mermaid div with proper styling
        const mermaidDiv = document.createElement('div');
        mermaidDiv.id = 'fullscreen-mermaid';
        mermaidDiv.className = 'mermaid';
        mermaidDiv.textContent = mermaidCode;
        
        containerDiv.appendChild(mermaidDiv);
        fullscreenContent.appendChild(containerDiv);
        
        // Run mermaid rendering for the fullscreen view
        await mermaid.run({
            querySelector: '#fullscreen-mermaid'
        });
    } catch (error) {
        console.error('Error rendering in fullscreen:', error);
    }
}

document.getElementById('btn-open').onclick = renderMarkdown;

// Initialize Mermaid
mermaid.initialize({ 
    startOnLoad: false, 
    theme: 'default',
    securityLevel: 'loose' 
});
