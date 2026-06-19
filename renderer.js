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

// Markdown Rendering Configuration
marked.setOptions({
    highlight: function(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    breaks: true,
    gfm: true
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
            mermaidDiv.textContent = mermaidCode;
            
            pre.replaceWith(mermaidDiv);
        }

        // Trigger Mermaid rendering
        await mermaid.run();
        
    } catch (error) {
        console.error('Error rendering markdown:', error);
        alert('Failed to load the markdown file.');
    }
}

document.getElementById('btn-open').onclick = renderMarkdown;

// Initialize Mermaid
mermaid.initialize({ 
    startOnLoad: false, 
    theme: 'default',
    securityLevel: 'loose' 
});
