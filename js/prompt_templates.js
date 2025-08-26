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
                this.dynamicWidgets = new Map();
                this.templateTextWidget = null;
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
                
                // Add template text display widget
                this.addTemplateDisplayWidget();
            };
            
            // Add template display widget
            nodeType.prototype.addTemplateDisplayWidget = function() {
                this.templateTextWidget = this.addWidget("text", "template_preview", "", null, {
                    multiline: true,
                    readonly: true,
                    serialize: false
                });
                
                // Style the widget
                if (this.templateTextWidget) {
                    this.templateTextWidget.inputEl = null; // Will be created on first draw
                    this.templateTextWidget.computeSize = () => {
                        const lines = this.templateTextWidget.value.split('\n').length;
                        const height = Math.max(60, Math.min(lines * 20 + 40, 200));
                        return [0, height];
                    };
                }
            };
            
            // Handle template selection changes
            nodeType.prototype.onTemplateChanged = function(templateName) {
                if (this.isUpdatingTemplate) return;
                
                console.log("Template changed to:", templateName);
                
                // Clear existing dynamic widgets
                this.clearDynamicWidgets();
                
                if (templateName === "none") {
                    this.templateTextWidget.value = "";
                    this.setSize(this.computeSize());
                    return;
                }
                
                // Load template data and create widgets
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
                    console.log(`Fetching template data for: ${templateName}`);
                    const response = await fetch(`/api/custom/templates/${templateName}`);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const templateData = await response.json();
                    console.log(`Received template data:`, templateData);
                    
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
                console.log("Template parameters:", templateData.parameters);
                
                const { name, text, parameters = [] } = templateData;
                
                // Update template text display with the raw template (with placeholders)
                this.templateTextWidget.value = text;
                console.log("Set template text widget to:", text);
                
                // Create parameter widgets
                parameters.forEach((param, index) => {
                    console.log(`Creating parameter ${index + 1}/${parameters.length}:`, param);
                    this.createParameterWidget(param);
                });
                
                // Update template text with current parameter values
                this.updateTemplatePreview();
                
                // Resize node to fit new content
                this.setSize(this.computeSize());
                
                console.log(`Template "${name}" applied with ${parameters.length} parameters`);
            };
            
            // Create a parameter widget
            nodeType.prototype.createParameterWidget = function(param) {
                const { name, type, label, defaultValue, options = {}, wildcard_file } = param;
                
                console.log("Creating parameter widget:", name, type, "wildcard:", wildcard_file);
                console.log("Parameter options:", options);
                console.log("Available choices:", options.choices);
                
                let widget;
                const widgetOptions = { serialize: true };
                
                // Create appropriate widget based on type
                switch (type) {
                    case "text":
                        widget = this.addWidget("string", name, defaultValue || "", 
                            (value) => this.onParameterChanged(name, value),
                            { 
                                multiline: options.multiline || false,
                                ...widgetOptions 
                            }
                        );
                        break;
                        
                    case "number":
                        widget = this.addWidget("number", name, defaultValue || 0,
                            (value) => this.onParameterChanged(name, value),
                            { 
                                min: options.min || 0,
                                max: options.max || 100,
                                step: options.step || 0.1,
                                precision: 2,
                                ...widgetOptions 
                            }
                        );
                        break;
                        
                    case "integer":
                        widget = this.addWidget("number", name, defaultValue || 0,
                            (value) => this.onParameterChanged(name, Math.round(value)),
                            {
                                min: options.min || 0,
                                max: options.max || 100,
                                step: 1,
                                precision: 0,
                                ...widgetOptions
                            }
                        );
                        break;
                        
                    case "select":
                        // Ensure we have choices for select widgets
                        const choices = options.choices || [];
                        console.log(`Creating select widget for ${name} with ${choices.length} choices:`, choices);
                        
                        if (choices.length === 0 && wildcard_file) {
                            console.warn(`No choices available for wildcard: ${wildcard_file}`);
                        }
                        
                        // Set default to "Random" if available, otherwise first choice
                        const defaultVal = choices.includes("Random") ? "Random" : (choices[0] || "");
                        
                        widget = this.addWidget("combo", name, defaultVal,
                            (value) => this.onParameterChanged(name, value),
                            {
                                values: choices,
                                ...widgetOptions
                            }
                        );
                        break;
                        
                    case "boolean":
                        widget = this.addWidget("toggle", name, defaultValue || false,
                            (value) => this.onParameterChanged(name, value),
                            widgetOptions
                        );
                        break;
                        
                    default:
                        console.warn("Unknown parameter type:", type);
                        return null;
                }
                
                if (widget) {
                    // Store widget reference
                    this.dynamicWidgets.set(name, widget);
                    
                    // Set display label if different from name
                    if (label && label !== name) {
                        widget.label = label;
                    }
                    
                    // Store wildcard reference for debugging
                    if (wildcard_file) {
                        widget.wildcardFile = wildcard_file;
                    }
                    
                    console.log("Created widget:", name, widget);
                    console.log("Widget values:", widget.options?.values);
                    console.log("Widget current value:", widget.value);
                    console.log("Widget choices:", options.choices?.length || 0);
                    
                    // Verify the widget has the correct values
                    if (widget.options && widget.options.values) {
                        console.log(`Widget ${name} final values:`, widget.options.values);
                    } else {
                        console.warn(`Widget ${name} missing values in options`);
                    }
                }
                
                return widget;
            };
            
            // Handle parameter value changes
            nodeType.prototype.onParameterChanged = function(parameterName, value) {
                console.log("Parameter changed:", parameterName, "=", value);
                
                // Update template preview
                this.updateTemplatePreview();
                
                // Handle conditional widget display
                this.updateConditionalWidgets();
                
                // Mark node as modified
                this.setDirtyCanvas(true, true);
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
                console.log("Updating template preview. Original text:", previewText);
                console.log("Dynamic widgets:", this.dynamicWidgets.size);
                
                // Replace parameter placeholders with current values
                this.dynamicWidgets.forEach((widget, paramName) => {
                    const placeholder = `{${paramName}}`;
                    let value = widget.value !== undefined ? String(widget.value) : '';
                    
                    console.log(`Processing parameter ${paramName}: placeholder="${placeholder}", value="${value}"`);
                    
                    // If value is "Random", show a placeholder or random selection
                    if (value === "Random") {
                        const choices = widget.options?.values || [];
                        const availableChoices = choices.filter(choice => choice !== "Random");
                        if (availableChoices.length > 0) {
                            value = `[Random: ${availableChoices.join(', ')}]`;
                        } else {
                            value = "[Random]";
                        }
                        console.log(`Random value expanded to: "${value}"`);
                    }
                    
                    // Replace all occurrences of the placeholder
                    const beforeReplace = previewText;
                    previewText = previewText.replace(new RegExp(placeholder, 'g'), value);
                    console.log(`Replaced "${placeholder}" with "${value}". Before: "${beforeReplace}", After: "${previewText}"`);
                });
                
                // Update the preview widget
                this.templateTextWidget.value = previewText;
                console.log("Final preview text:", previewText);
                
                // Force a redraw to update the display
                this.setSize(this.computeSize());
            };
            
            // Update conditional widget display
            nodeType.prototype.updateConditionalWidgets = function() {
                // This would handle conditional display based on parameter values
                // For now, we'll keep all widgets visible
                console.log("Updating conditional widgets");
            };
            
            // Clear all dynamic widgets
            nodeType.prototype.clearDynamicWidgets = function() {
                console.log("Clearing dynamic widgets");
                
                // Remove widgets from the node
                this.dynamicWidgets.forEach((widget, name) => {
                    const index = this.widgets.indexOf(widget);
                    if (index >= 0) {
                        this.widgets.splice(index, 1);
                    }
                });
                
                // Clear the map
                this.dynamicWidgets.clear();
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
            
            // Override serialize to save dynamic widget values
            nodeType.prototype.serialize = function() {
                const data = originalSerialize ? originalSerialize.apply(this, arguments) : {};
                
                // Save dynamic widget states
                const dynamicStates = {};
                this.dynamicWidgets.forEach((widget, name) => {
                    dynamicStates[name] = widget.value;
                });
                
                if (Object.keys(dynamicStates).length > 0) {
                    data.dynamic_widget_states = dynamicStates;
                }
                
                return data;
            };
            
            // Override configure to restore dynamic widget values
            nodeType.prototype.onConfigure = function(data) {
                const result = originalOnConfigure?.apply(this, arguments);
                
                // Restore dynamic widget states if they exist
                if (data.dynamic_widget_states) {
                    this.isUpdatingTemplate = true;
                    
                    // Wait for template to load, then restore values
                    setTimeout(() => {
                        Object.entries(data.dynamic_widget_states).forEach(([name, value]) => {
                            const widget = this.dynamicWidgets.get(name);
                            if (widget) {
                                widget.value = value;
                            }
                        });
                        
                        this.updateTemplatePreview();
                        this.isUpdatingTemplate = false;
                    }, 100);
                }
                
                return result;
            };
        }
    }
});