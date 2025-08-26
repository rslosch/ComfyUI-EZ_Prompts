import { app } from "../../scripts/app.js";

console.log("EZ Prompts: Extension loading...");

// CSS Styles for EZ Prompts
const style = document.createElement("style");
style.textContent = `
.ez-prompts-container {
    background: linear-gradient(145deg, #2a2a2a, #1f1f1f);
    border-radius: 12px;
    padding: 16px;
    margin: 12px 0;
    border: 2px solid #404040;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}

.ez-prompts-preview {
    background: #1e1e1e;
    border: 1px solid #404040;
    border-radius: 8px;
    padding: 12px;
    margin: 8px 0;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #e0e0e0;
    white-space: pre-wrap;
    word-wrap: break-word;
    max-height: 150px;
    overflow-y: auto;
}

.ez-prompts-variable {
    background: linear-gradient(135deg, #ffd700, #ffed4e);
    color: #1a1a1a;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: bold;
    display: inline-block;
    margin: 0 2px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    border: 1px solid #e6c200;
}

.ez-prompts-variables-section {
    background: #252525;
    border-radius: 10px;
    padding: 14px;
    margin: 10px 0;
    border: 1px solid #404040;
}

.ez-prompts-variables-header {
    color: #10b981;
    font-weight: bold;
    font-size: 14px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.ez-prompts-variables-header::before {
    content: "🎛️";
    font-size: 16px;
}

.ez-prompts-variable-control {
    display: flex;
    align-items: center;
    margin: 8px 0;
    gap: 12px;
    padding: 6px;
    background: #1a1a1a;
    border-radius: 8px;
    border: 1px solid #333;
}

.ez-prompts-variable-label {
    min-width: 120px;
    color: #ffd700;
    font-weight: 500;
    font-size: 13px;
}

.ez-prompts-variable-select {
    flex: 1;
    background: linear-gradient(135deg, #3b82f6, #60a5fa);
    color: white;
    border: 1px solid #2563eb;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
    transition: all 0.3s ease;
}

.ez-prompts-variable-select:hover {
    background: linear-gradient(135deg, #2563eb, #3b82f6);
    box-shadow: 0 3px 6px rgba(59, 130, 246, 0.3);
}

.ez-prompts-variable-select.overridden {
    background: linear-gradient(135deg, #10b981, #34d399);
    border-color: #059669;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
}

.ez-prompts-variable-select.overridden:hover {
    background: linear-gradient(135deg, #059669, #10b981);
    box-shadow: 0 3px 6px rgba(16, 185, 129, 0.3);
}

.ez-prompts-title {
    color: #10b981;
    font-weight: bold;
    font-size: 15px;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.ez-prompts-title::before {
    content: "⚡";
    font-size: 18px;
}

.ez-prompts-live-preview {
    background: linear-gradient(145deg, #0f172a, #1e293b);
    border: 2px solid #10b981;
    border-radius: 10px;
    padding: 14px;
    margin: 12px 0;
    font-family: 'Segoe UI', 'Arial', sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #f1f5f9;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.1);
    max-height: 200px;
    overflow-y: auto;
}

.ez-prompts-section-title {
    color: #60a5fa;
    font-weight: bold;
    font-size: 13px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.ez-prompts-section-title.template::before {
    content: "📝";
}

.ez-prompts-section-title.preview::before {
    content: "👁️";
}
`;
document.head.appendChild(style);
console.log("EZ Prompts: CSS styles added");

// Template data cache
let templateCache = {};

// Wildcard data cache
let wildcardData = {};

// Load wildcard data
async function loadWildcardData() {
    console.log("EZ Prompts: Loading wildcard data...");
    try {
        // Use hardcoded wildcard data for now
        wildcardData = {
            "age.txt": ["18-year-old", "25-year-old", "30-year-old", "35-year-old"],
            "ethnicity.txt": ["Asian", "Caucasian", "Hispanic", "African American"],
            "gender.txt": ["woman", "man"],
            "environment.txt": ["in a cozy cafe", "at home in natural light", "outdoors in golden hour"],
            "hair_length.txt": ["short", "medium-length", "long", "shoulder-length"],
            "hair_color.txt": ["black", "brown", "blonde", "auburn", "red"],
            "hair_style.txt": ["flowing straight", "loose waves", "tight curls", "sleek and straight"],
            "expression_type.txt": ["genuine smile", "soft smile", "confident look", "serene expression"],
            "eye_description.txt": ["bright blue eyes", "warm brown eyes", "sparkling green eyes"],
            "lip_description.txt": ["natural pink lips", "soft coral lips", "nude lips"],
            "clothing_color.txt": ["white", "black", "navy blue", "cream", "beige"],
            "clothing_garment.txt": ["t-shirt", "sweater", "blouse", "shirt", "tank top"],
            "pose_description.txt": ["looking directly at camera", "resting chin on hand", "arms crossed casually"],
            "studio_environment.txt": ["a professional photo studio", "an upscale photography studio"],
            "formal_clothing.txt": ["business suit", "blazer", "dress shirt", "formal blouse"],
            "studio_pose.txt": ["seated in director's chair", "standing with confident posture"],
            "studio_background.txt": ["seamless white", "textured gray", "solid black", "gradient backdrop"]
        };
        console.log("EZ Prompts: Wildcard data loaded:", Object.keys(wildcardData));
    } catch (error) {
        console.log('EZ Prompts: Error loading wildcard data:', error);
    }
}

// Load template data
async function loadTemplateData() {
    console.log("EZ Prompts: Loading template data...");
    try {
        // Use hardcoded template data for now
        templateCache = {
            "ai_ugc-iphone_selfie": {
                "name": "ai_ugc-iphone_selfie",
                "description": "iPhone selfie portrait template for UGC content",
                "template": "An iphone selfie portrait of a beautiful {age} {ethnicity} {gender} captured {environment}. The {gender} has {hair_length} {hair_color} hair {hair_style}. The subject has {lip_description} and a {expression_type} with {eye_description}. The subject is wearing {clothing_color} {clothing_garment} while {pose_description}. The selfie is photographed with natural lighting providing even front lighting. The composition is centered and captured in close-up frame, emphasizing the subject's facial features and expression. Close-up portrait photography with natural lighting and centered framing.",
                "variables": {
                    "age": "age.txt",
                    "ethnicity": "ethnicity.txt", 
                    "gender": "gender.txt",
                    "environment": "environment.txt",
                    "hair_length": "hair_length.txt",
                    "hair_color": "hair_color.txt",
                    "hair_style": "hair_style.txt",
                    "lip_description": "lip_description.txt",
                    "expression_type": "expression_type.txt",
                    "eye_description": "eye_description.txt",
                    "clothing_color": "clothing_color.txt",
                    "clothing_garment": "clothing_garment.txt",
                    "pose_description": "pose_description.txt"
                }
            },
            "ai_ugc-studio_portrait": {
                "name": "ai_ugc-studio_portrait", 
                "description": "Professional studio portrait template with overlapping variables",
                "template": "A professional studio portrait of an attractive {age} {ethnicity} {gender} photographed in {environment}. The subject has {hair_length} {hair_color} hair styled {hair_style}, {eye_description}, and {lip_description}. They're wearing {clothing_color} {clothing_garment} and displaying a {expression_type} while {pose_description}. Shot with professional studio lighting setup including key light, fill light, and hair light. The background features a {background_type} backdrop. High-end portrait photography with controlled lighting and sharp focus on facial details.",
                "variables": {
                    "age": "age.txt",
                    "ethnicity": "ethnicity.txt",
                    "gender": "gender.txt", 
                    "environment": "studio_environment.txt",
                    "hair_length": "hair_length.txt",
                    "hair_color": "hair_color.txt",
                    "hair_style": "hair_style.txt",
                    "eye_description": "eye_description.txt",
                    "lip_description": "lip_description.txt", 
                    "expression_type": "expression_type.txt",
                    "clothing_color": "clothing_color.txt",
                    "clothing_garment": "formal_clothing.txt",
                    "pose_description": "studio_pose.txt",
                    "background_type": "studio_background.txt"
                }
            }
        };
        console.log("EZ Prompts: Template data loaded:", Object.keys(templateCache));
    } catch (error) {
        console.log('EZ Prompts: Error loading template data:', error);
    }
}

function highlightVariables(template) {
    if (!template) return "";
    
    return template.replace(/\{([^}]+)\}/g, (match, variable) => {
        return `<span class="ez-prompts-variable">{${variable}}</span>`;
    });
}

function generateLivePreview(template, overrides = {}) {
    if (!template || !templateCache[template]) {
        return "Select a template to see preview";
    }
    
    const templateData = templateCache[template];
    let preview = templateData.template;
    
    // Sample values for variables not overridden
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
        pose_description: "looking directly at camera",
        background_type: "seamless white"
    };
    
    // Apply overrides and sample values
    const variables = templateData.variables || {};
    Object.keys(variables).forEach(varName => {
        let value = overrides[varName];
        if (!value || value === "🎲 Random") {
            value = sampleValues[varName] || `[${varName}]`;
        }
        const regex = new RegExp(`\\{${varName}\\}`, 'g');
        preview = preview.replace(regex, value);
    });
    
    return preview;
}

// Register the extension
app.registerExtension({
    name: "EZPrompts.TemplateSystem",
    
    async init() {
        console.log("EZ Prompts: Extension init called");
        await loadTemplateData();
        await loadWildcardData();
    },
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        console.log("EZ Prompts: beforeRegisterNodeDef called for:", nodeType.comfyClass);
        
        // Filter to only modify our specific node
        if (nodeType.comfyClass !== "EZPromptsNode") {
            return;
        }
        
        console.log("EZ Prompts: Processing EZPromptsNode");
        
        // Store original methods
        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
        const originalOnWidget = nodeType.prototype.onWidget;
        const originalOnRemoved = nodeType.prototype.onRemoved;
        
        // Override onNodeCreated to add custom UI
        nodeType.prototype.onNodeCreated = function() {
            console.log("EZ Prompts: onNodeCreated called");
            const result = originalOnNodeCreated?.apply(this, arguments);
            
            // Initialize custom UI after a short delay
            setTimeout(() => this.setupCustomUI(), 100);
            
            return result;
        };
        
        // Override onWidget to handle template changes
        nodeType.prototype.onWidget = function(widget, value) {
            console.log("EZ Prompts: onWidget called for:", widget.name, "with value:", value);
            const result = originalOnWidget?.apply(this, arguments);
            
            // If template changed, rebuild variable widgets
            if (widget.name === "template") {
                console.log("EZ Prompts: Template changed, rebuilding variable widgets");
                setTimeout(() => this.rebuildVariableWidgets(), 50);
            }
            
            return result;
        };
        
        // Override onRemoved to clean up
        nodeType.prototype.onRemoved = function() {
            console.log("EZ Prompts: onRemoved called");
            if (this.ezUIContainer) {
                this.ezUIContainer.remove();
            }
            return originalOnRemoved?.apply(this, arguments);
        };
        
        console.log("EZ Prompts: EZPromptsNode processing complete");
    },
    
    async nodeCreated(node) {
        console.log("EZ Prompts: nodeCreated called for:", node.comfyClass);
        
        if (node.comfyClass === "EZPromptsNode") {
            console.log("EZ Prompts: Processing EZPromptsNode instance");
            
            // Add custom methods to the node instance
            node.setupCustomUI = setupCustomUI;
            node.rebuildVariableWidgets = rebuildVariableWidgets;
            node.updateLivePreview = updateLivePreview;
            node.variableOverrides = {};
        }
    }
});

// Custom UI setup function
function setupCustomUI() {
    console.log("EZ Prompts: setupCustomUI called");
    
    // Remove existing UI if it exists
    if (this.ezUIContainer) {
        this.ezUIContainer.remove();
    }
    
    // Create UI container
    const container = document.createElement("div");
    container.className = "ez-prompts-container";
    this.ezUIContainer = container;
    
    // Title
    const title = document.createElement("div");
    title.className = "ez-prompts-title";
    title.textContent = "EZ Prompts";
    container.appendChild(title);
    
    // Template preview section
    const previewSection = document.createElement("div");
    const previewTitle = document.createElement("div");
    previewTitle.className = "ez-prompts-section-title template";
    previewTitle.textContent = "Template Structure";
    previewSection.appendChild(previewTitle);
    
    const templatePreview = document.createElement("div");
    templatePreview.className = "ez-prompts-preview";
    templatePreview.innerHTML = "Select a template to see preview";
    previewSection.appendChild(templatePreview);
    container.appendChild(previewSection);
    this.templatePreview = templatePreview;
    
    // Variables section
    const variablesSection = document.createElement("div");
    variablesSection.className = "ez-prompts-variables-section";
    
    const variablesHeader = document.createElement("div");
    variablesHeader.className = "ez-prompts-variables-header";
    variablesHeader.textContent = "Variable Controls";
    variablesSection.appendChild(variablesHeader);
    
    this.variablesContainer = document.createElement("div");
    variablesSection.appendChild(this.variablesContainer);
    container.appendChild(variablesSection);
    
    // Live preview section
    const liveSection = document.createElement("div");
    const liveTitle = document.createElement("div");
    liveTitle.className = "ez-prompts-section-title preview";
    liveTitle.textContent = "Live Preview";
    liveSection.appendChild(liveTitle);
    
    const livePreview = document.createElement("div");
    livePreview.className = "ez-prompts-live-preview";
    livePreview.innerHTML = "Live preview will appear here";
    liveSection.appendChild(livePreview);
    container.appendChild(liveSection);
    this.livePreview = livePreview;
    
    // Find the node's DOM element and attach our UI
    this.waitForNodeElement(container);
}

// Wait for node element to be available
function waitForNodeElement(container) {
    const checkElement = () => {
        if (this.element) {
            console.log("EZ Prompts: Node element found, attaching UI");
            this.attachCustomUI(container);
        } else {
            console.log("EZ Prompts: Node element not ready, retrying...");
            setTimeout(checkElement, 50);
        }
    };
    
    checkElement();
}

// Attach custom UI to node
function attachCustomUI(container) {
    console.log("EZ Prompts: attachCustomUI called");
    
    // Find the node's widget area and insert our UI
    const widgetArea = this.element.querySelector('.comfy-widgets');
    if (widgetArea) {
        console.log("EZ Prompts: Adding custom UI to widget area");
        widgetArea.appendChild(container);
        
        // Update content after UI is attached
        this.updateTemplateUI();
    } else {
        console.log("EZ Prompts: WARNING - Could not find widget area");
    }
}

// Update template UI
function updateTemplateUI() {
    console.log("EZ Prompts: updateTemplateUI called");
    
    const templateWidget = this.widgets.find(w => w.name === "template");
    const currentTemplate = templateWidget?.value;
    
    if (!currentTemplate || !templateCache[currentTemplate]) {
        console.log("EZ Prompts: No valid template found");
        if (this.templatePreview) {
            this.templatePreview.innerHTML = "Template not found";
        }
        if (this.variablesContainer) {
            this.variablesContainer.innerHTML = "";
        }
        if (this.livePreview) {
            this.livePreview.innerHTML = "No template selected";
        }
        return;
    }
    
    const templateData = templateCache[currentTemplate];
    console.log("EZ Prompts: Template data found:", templateData);
    
    // Update template preview
    if (this.templatePreview) {
        this.templatePreview.innerHTML = highlightVariables(templateData.template);
    }
    
    // Build variable widgets
    this.rebuildVariableWidgets();
}

// Rebuild variable widgets
function rebuildVariableWidgets() {
    console.log("EZ Prompts: rebuildVariableWidgets called");
    
    const templateWidget = this.widgets.find(w => w.name === "template");
    const currentTemplate = templateWidget?.value;
    
    if (!currentTemplate || !templateCache[currentTemplate]) {
        return;
    }
    
    const templateData = templateCache[currentTemplate];
    const variables = templateData.variables || {};
    
    // Remove existing variable widgets
    this.widgets = this.widgets.filter(w => !variables[w.name]);
    
    // Clear variables container
    if (this.variablesContainer) {
        this.variablesContainer.innerHTML = "";
    }
    
    console.log("EZ Prompts: Building variable widgets for:", Object.keys(variables));
    
    // Create widgets for each variable
    Object.entries(variables).forEach(([varName, wildcardFile]) => {
        // Create the widget
        const options = ["🎲 Random", ...(wildcardData[wildcardFile] || [])];
        const widget = this.addWidget("COMBO", varName, "🎲 Random", (value) => {
            console.log("EZ Prompts: Variable widget changed:", varName, value);
            this.variableOverrides[varName] = value;
            this.updateLivePreview();
            
            // Trigger node execution
            if (this.graph) {
                this.graph.change();
            }
        }, { values: options });
        
        // Create custom UI for this variable
        if (this.variablesContainer) {
            const control = document.createElement("div");
            control.className = "ez-prompts-variable-control";
            
            const label = document.createElement("div");
            label.className = "ez-prompts-variable-label";
            label.textContent = varName.replace(/_/g, ' ');
            control.appendChild(label);
            
            // Find the widget's select element and style it
            setTimeout(() => {
                const selectElement = widget.element?.querySelector('select');
                if (selectElement) {
                    selectElement.className = "ez-prompts-variable-select";
                    
                    // Update styling based on current value
                    if (widget.value !== "🎲 Random") {
                        selectElement.classList.add("overridden");
                    }
                    
                    // Listen for changes to update styling
                    selectElement.addEventListener('change', (e) => {
                        if (e.target.value === "🎲 Random") {
                            selectElement.classList.remove("overridden");
                        } else {
                            selectElement.classList.add("overridden");
                        }
                    });
                }
            }, 10);
            
            control.appendChild(widget.element || document.createElement('div'));
            this.variablesContainer.appendChild(control);
        }
    });
    
    // Update live preview
    this.updateLivePreview();
}

// Update live preview
function updateLivePreview() {
    console.log("EZ Prompts: updateLivePreview called");
    
    const templateWidget = this.widgets.find(w => w.name === "template");
    const currentTemplate = templateWidget?.value;
    
    if (currentTemplate && this.livePreview) {
        this.livePreview.innerHTML = generateLivePreview(currentTemplate, this.variableOverrides);
    }
}

console.log("EZ Prompts: Extension registration complete");