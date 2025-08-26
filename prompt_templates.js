import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";

// CSS Styles for EZ Prompts
const style = document.createElement("style");
style.textContent = `
.ez-prompts-container {
    background: #2a2a2a;
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    border: 1px solid #404040;
}

.ez-prompts-preview {
    background: #1e1e1e;
    border: 1px solid #404040;
    border-radius: 6px;
    padding: 10px;
    margin: 8px 0;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.4;
    color: #e0e0e0;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 200px;
    overflow-y: auto;
}

.ez-prompts-variable {
    background: linear-gradient(135deg, #ffd700, #ffed4e);
    color: #1a1a1a;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
    display: inline-block;
    margin: 0 2px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.ez-prompts-override {
    background: linear-gradient(135deg, #10b981, #34d399) !important;
    color: white !important;
    border: 1px solid #059669 !important;
    border-radius: 6px !important;
    padding: 6px 12px !important;
    font-weight: 500 !important;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2) !important;
}

.ez-prompts-random {
    background: linear-gradient(135deg, #3b82f6, #60a5fa) !important;
    color: white !important;
    border: 1px solid #2563eb !important;
    border-radius: 6px !important;
    padding: 6px 12px !important;
    font-weight: 500 !important;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2) !important;
}

.ez-prompts-title {
    color: #10b981;
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.ez-prompts-title::before {
    content: "⚡";
    font-size: 16px;
}

.ez-prompts-live-preview {
    background: #0f172a;
    border: 2px solid #10b981;
    border-radius: 8px;
    padding: 12px;
    margin: 10px 0;
    font-family: 'Segoe UI', 'Arial', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #f1f5f9;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
}
`;
document.head.appendChild(style);

// Template data cache
let templateCache = {};

// Load template data from the backend
async function loadTemplateData() {
    try {
        const response = await fetch('/ez_prompts/templates');
        if (response.ok) {
            templateCache = await response.json();
        }
    } catch (error) {
        console.log('Could not load template data:', error);
        // Fallback template data for development
        templateCache = {
            "ai_ugc-iphone_selfie": {
                "name": "ai_ugc-iphone_selfie",
                "template": "An iphone selfie portrait of a beautiful {age} {ethnicity} {gender} captured {environment}. The {gender} has {hair_length} {hair_color} hair {hair_style}.",
                "variables": {
                    "age": "age.txt",
                    "ethnicity": "ethnicity.txt",
                    "gender": "gender.txt",
                    "environment": "environment.txt",
                    "hair_length": "hair_length.txt",
                    "hair_color": "hair_color.txt",
                    "hair_style": "hair_style.txt"
                }
            }
        };
    }
}

function highlightVariables(template) {
    if (!template) return "";
    
    return template.replace(/\{([^}]+)\}/g, (match, variable) => {
        return `<span class="ez-prompts-variable">{${variable}}</span>`;
    });
}

function generateLivePreview(template, overrides, seed = 0) {
    if (!template || !templateCache[template]) {
        return "Select a template to see preview";
    }
    
    const templateData = templateCache[template];
    let preview = templateData.template;
    
    // Simple preview generation - replace with sample values
    const sampleValues = {
        age: "25-year-old",
        ethnicity: "Asian",
        gender: "woman",
        environment: "in a cozy cafe",
        hair_length: "long",
        hair_color: "black",
        hair_style: "flowing straight",
        expression_type: "gentle smile",
        eye_description: "bright expressive eyes",
        lip_description: "natural pink lips",
        clothing_color: "navy blue",
        clothing_garment: "sweater",
        pose_description: "looking directly at camera"
    };
    
    // Apply overrides
    Object.keys(overrides).forEach(key => {
        if (key.startsWith('override_') && overrides[key] !== "🎲 Random") {
            const varName = key.replace('override_', '');
            sampleValues[varName] = overrides[key];
        }
    });
    
    // Replace variables with values
    Object.keys(sampleValues).forEach(variable => {
        const regex = new RegExp(`\\{${variable}\\}`, 'g');
        preview = preview.replace(regex, sampleValues[variable]);
    });
    
    return preview;
}

// Register the extension
app.registerExtension({
    name: "EZPrompts.TemplateSystem",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "EZPromptsNode") {
            // Load template data
            await loadTemplateData();
            
            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function() {
                const result = originalOnNodeCreated?.apply(this, arguments);
                
                // Create custom UI container
                const container = document.createElement("div");
                container.className = "ez-prompts-container";
                
                // Title
                const title = document.createElement("div");
                title.className = "ez-prompts-title";
                title.textContent = "Template Preview";
                container.appendChild(title);
                
                // Template preview area
                const templatePreview = document.createElement("div");
                templatePreview.className = "ez-prompts-preview";
                templatePreview.innerHTML = "Select a template to see preview";
                container.appendChild(templatePreview);
                
                // Live preview area
                const livePreview = document.createElement("div");
                livePreview.className = "ez-prompts-live-preview";
                livePreview.innerHTML = "Live preview will appear here";
                container.appendChild(livePreview);
                
                // Store references
                this.templatePreview = templatePreview;
                this.livePreview = livePreview;
                this.ezContainer = container;
                
                // Update preview function
                this.updatePreviews = () => {
                    const templateWidget = this.widgets.find(w => w.name === "template");
                    const currentTemplate = templateWidget?.value;
                    
                    if (currentTemplate && templateCache[currentTemplate]) {
                        const templateData = templateCache[currentTemplate];
                        this.templatePreview.innerHTML = highlightVariables(templateData.template);
                        
                        // Collect current override values
                        const overrides = {};
                        this.widgets.forEach(widget => {
                            if (widget.name.startsWith('override_')) {
                                overrides[widget.name] = widget.value;
                            }
                        });
                        
                        this.livePreview.innerHTML = generateLivePreview(currentTemplate, overrides);
                    }
                };
                
                // Initial preview update
                setTimeout(() => this.updatePreviews(), 100);
                
                return result;
            };
            
            // Hook into widget changes
            const originalOnWidget = nodeType.prototype.onWidget;
            nodeType.prototype.onWidget = function(widget, value) {
                const result = originalOnWidget?.apply(this, arguments);
                
                // Update previews when widgets change
                if (this.updatePreviews) {
                    setTimeout(() => this.updatePreviews(), 10);
                }
                
                // Style override widgets
                if (widget.name.startsWith('override_')) {
                    if (widget.element) {
                        if (value === "🎲 Random") {
                            widget.element.className = widget.element.className.replace(/ez-prompts-\w+/g, '');
                            widget.element.classList.add('ez-prompts-random');
                        } else {
                            widget.element.className = widget.element.className.replace(/ez-prompts-\w+/g, '');
                            widget.element.classList.add('ez-prompts-override');
                        }
                    }
                }
                
                return result;
            };
            
            // Add custom drawing
            const originalOnDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function(ctx) {
                const result = originalOnDrawForeground?.apply(this, arguments);
                
                // Add the custom UI container to the node if not already added
                if (this.ezContainer && !this.ezContainer.parentNode) {
                    // Find a good place to insert our container
                    const nodeElement = document.querySelector(`[data-id="${this.id}"]`) || 
                                      document.querySelector('.graphcanvas');
                    
                    if (nodeElement) {
                        // Create a wrapper div positioned relative to the node
                        const wrapper = document.createElement("div");
                        wrapper.style.position = "absolute";
                        wrapper.style.pointerEvents = "none";
                        wrapper.style.zIndex = "1000";
                        wrapper.appendChild(this.ezContainer);
                        
                        document.body.appendChild(wrapper);
                    }
                }
                
                return result;
            };
        }
    }
});