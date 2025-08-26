// js/prompt_templates.js
import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "comfyui.ezprompts.node",
    
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "EZPromptsNode") {
            
            // Store original methods
            const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
            const originalOnConfigure = nodeType.prototype.onConfigure;
            const originalSerialize = nodeType.prototype.serialize;
            
            // Override onNodeCreated
            nodeType.prototype.onNodeCreated = function() {
                const result = originalOnNodeCreated?.apply(this, arguments);
                
                // Initialize node state
                this.templateCache = new Map();
                this.populatedWidget = null;
                this.modeWidget = null;
                this.isUpdatingTemplate = false;
                
                // Setup initial widgets and load templates
                this.setupInitialWidgets();
                this.loadAvailableTemplates();
                
                return result;
            };
            
            // Setup initial widgets
            nodeType.prototype.setupInitialWidgets = function() {
                // Find the template widget (should already exist from Python INPUT_TYPES)
                const templateWidget = this.widgets.find(w => w.name === "template");
                if (templateWidget) {
                    // Override the template widget callback
                    const originalCallback = templateWidget.callback;
                    templateWidget.callback = (value) => {
                        originalCallback?.(value);
                        this.onTemplateChanged(value);
                    };
                }
                
                // Find the mode widget
                this.modeWidget = this.widgets.find(w => w.name === "mode");
                if (this.modeWidget) {
                    // Override the mode widget callback
                    const originalCallback = this.modeWidget.callback;
                    this.modeWidget.callback = (value) => {
                        originalCallback?.(value);
                        this.onModeChanged(value);
                    };
                }
                
                // Find the populated widget
                this.populatedWidget = this.widgets.find(w => w.name === "populated");
                
                // No need for template preview widget since we're using native INPUT_TYPES
                // this.addTemplateDisplayWidget();
            };
            
            // Handle template selection changes
            nodeType.prototype.onTemplateChanged = function(templateName) {
                if (this.isUpdatingTemplate) return;
                
                console.log("Template changed to:", templateName);
                
                if (templateName === "none") {
                    if (this.populatedWidget) {
                        this.populatedWidget.value = "";
                    }
                    this.setSize([500, 300]);
                    return;
                }
                
                // Load template data and update display
                this.loadTemplateData(templateName)
                    .then(templateData => {
                        if (templateData) {
                            this.applyTemplate(templateData);
                        }
                    })
                    .catch(error => {
                        console.error("Failed to load template:", error);
                        this.showError(`Failed to load template: ${error.message}`);
                    });
            };
            
            // Load template data from server
            nodeType.prototype.loadTemplateData = async function(templateName) {
                // Check cache first
                if (this.templateCache.has(templateName)) {
                    return this.templateCache.get(templateName);
                }
                
                try {
                    const response = await fetch(`/api/custom/templates/${templateName}`);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const templateData = await response.json();
                    
                    // Cache the data
                    this.templateCache.set(templateName, templateData);
                    
                    return templateData;
                } catch (error) {
                    console.error(`Failed to fetch template ${templateName}:`, error);
                    throw error;
                }
            };
            
            // Apply template to the node
            nodeType.prototype.applyTemplate = function(templateData) {
                console.log("Applying template:", templateData);
                
                const { name, text, parameters = [] } = templateData;
                
                // Refresh the populated field based on current mode
                this.refreshPopulatedField();
                
                // Set appropriate node size for template display
                this.setSize([500, 300]);
                
                console.log(`Template "${name}" applied with ${parameters.length} parameters`);
            };
            
            // Handle parameter value changes
            nodeType.prototype.onParameterChanged = function(parameterName, value) {
                console.log("Parameter changed:", parameterName, "=", value);
                
                // Immediately sync this widget value to the corresponding input
                this.syncSingleWidgetValue(parameterName, value);
                
                // Update template preview only in populate mode
                if (this.modeWidget && this.modeWidget.value) {
                this.updateTemplatePreview();
                }
                
                // Mark node as modified (but don't resize)
                this.setDirtyCanvas(true, true);
            };
            
            // Sync a single widget value to its corresponding input
            nodeType.prototype.syncSingleWidgetValue = function(paramName, value) {
                const widget = this.dynamicWidgets.get(paramName);
                if (widget && widget.inputIndex !== undefined && this.inputs && this.inputs[widget.inputIndex]) {
                    this.inputs[widget.inputIndex].value = value;
                    console.log(`Immediately synced ${paramName} = ${value} to input index ${widget.inputIndex}`);
                }
            };
            
            // Update template preview with current parameter values
            nodeType.prototype.updateTemplatePreview = function() {
                const templateWidget = this.widgets.find(w => w.name === "template");
                const templateName = templateWidget?.value;
                
                if (!templateName || templateName === "none") {
                    return;
                }
                
                const templateData = this.templateCache.get(templateName);
                if (!templateData) {
                    return;
                }
                
                let previewText = templateData.text;
                
                // Replace parameter placeholders with current values from native INPUT_TYPES
                this.widgets.forEach(widget => {
                    // Check if this is a wildcard parameter widget (not template, mode, seed, etc.)
                    if (widget.name !== "template" && widget.name !== "mode" && 
                        widget.name !== "seed" && widget.name !== "wildcard_index" && 
                        widget.name !== "populated") {
                        
                        const placeholder = `{${widget.name}}`;
                        let value = widget.value !== undefined ? String(widget.value) : '';
                        
                        // If value is "Random", show the wildcard variable name
                        if (value === "Random") {
                            value = `{${widget.name}}`; // Show the original placeholder
                        }
                        
                        // Replace all occurrences of the placeholder
                        previewText = previewText.replace(new RegExp(placeholder, 'g'), value);
                    }
                });
                
                // Update the populated widget if it exists and we're in populate mode
                if (this.populatedWidget && this.modeWidget && this.modeWidget.value) {
                    this.populatedWidget.value = previewText;
                }
            };
            
            // Load available templates from server
            nodeType.prototype.loadAvailableTemplates = async function() {
                try {
                    const response = await fetch('/api/custom/templates/list');
                    if (response.ok) {
                        const templates = await response.json();
                        
                        // Update template widget options
                        const templateWidget = this.widgets.find(w => w.name === "template");
                        if (templateWidget && templateWidget.options) {
                            const values = ["none", ...templates.map(t => t.name)];
                            templateWidget.options.values = values;
                            
                            console.log("Loaded templates:", values);
                            
                            // If template is not "none", load it automatically
                            if (templateWidget.value && templateWidget.value !== "none") {
                                this.onTemplateChanged(templateWidget.value);
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to load template list:", error);
                }
            };
            
            // Show error message
            nodeType.prototype.showError = function(message) {
                console.error(message);
                // You could add toast notification here if available
            };
            
            // Refresh populated field content based on current mode
            nodeType.prototype.refreshPopulatedField = function() {
                if (!this.populatedWidget || !this.modeWidget) return;
                
                const isPopulateMode = this.modeWidget.value;
                this.populatedWidget.disabled = isPopulateMode;
                
                if (isPopulateMode) {
                    // Populate mode: show resolved template
                    this.updateTemplatePreview();
                } else {
                    // Fixed mode: show template with current parameter values from native INPUT_TYPES
                    const templateWidget = this.widgets.find(w => w.name === "template");
                    if (templateWidget && templateWidget.value !== "none") {
                        const templateData = this.templateCache.get(templateWidget.value);
                        if (templateData) {
                            let templateText = templateData.text;
                            
                            // Get current values from native INPUT_TYPES widgets
                            this.widgets.forEach(widget => {
                                // Check if this is a wildcard parameter widget (not template, mode, seed, etc.)
                                if (widget.name !== "template" && widget.name !== "mode" && 
                                    widget.name !== "seed" && widget.name !== "wildcard_index" && 
                                    widget.name !== "populated") {
                                    
                                    const placeholder = `{${widget.name}}`;
                                    let value = widget.value !== undefined ? String(widget.value) : '';
                                    
                                    // If value is "Random", show the wildcard variable name
                                    if (value === "Random") {
                                        value = `{${widget.name}}`; // Show the original placeholder
                                    }
                                    
                                    // Replace all occurrences of the placeholder
                                    templateText = templateText.replace(new RegExp(placeholder, 'g'), value);
                                }
                            });
                            
                            this.populatedWidget.value = templateText;
                        }
                    }
                }
            };
            
            // Handle mode changes
            nodeType.prototype.onModeChanged = function(mode) {
                console.log("Mode changed to:", mode ? "Populate" : "Fixed");
                
                // Refresh the populated field based on the new mode
                this.refreshPopulatedField();
            };
            
            // Override serialize to save current state
            nodeType.prototype.serialize = function() {
                const data = originalSerialize ? originalSerialize.apply(this, arguments) : {};
                
                // Save current template
                const templateWidget = this.widgets.find(w => w.name === "template");
                if (templateWidget) {
                    data.current_template = templateWidget.value;
                }
                
                return data;
            };
            
            // Override configure to restore template state
            nodeType.prototype.onConfigure = function(data) {
                const result = originalOnConfigure?.apply(this, arguments);
                
                // Restore template if it exists
                if (data.current_template && data.current_template !== "none") {
                    this.isUpdatingTemplate = true;
                    
                    // Wait for template to load, then restore state
                    setTimeout(() => {
                        this.onTemplateChanged(data.current_template);
                        this.isUpdatingTemplate = false;
                    }, 100);
                }
                
                return result;
            };
        }
    }
});