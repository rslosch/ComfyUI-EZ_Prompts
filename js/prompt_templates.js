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
            const originalOnExecuted = nodeType.prototype.onExecuted;
            
            // Override onNodeCreated
            nodeType.prototype.onNodeCreated = function() {
                const result = originalOnNodeCreated?.apply(this, arguments);
                
                // Initialize node state
                this.templateCache = new Map();
                this.dynamicWidgets = new Map();
                this.templateTextWidget = null;
                this.populatedWidget = null;
                this.isUpdatingTemplate = false;
                
                // Setup initial widgets and load templates
                this.setupInitialWidgets();
                this.loadAvailableTemplates();
                
                // Set up periodic check to ensure wildcard widgets stay hidden
                this.setupWidgetHidingCheck();
                
                return result;
            };
            
            // Set up periodic check to ensure wildcard widgets stay hidden
            nodeType.prototype.setupWidgetHidingCheck = function() {
                // Check every 2 seconds to ensure widgets stay hidden
                setInterval(() => {
                    this.ensureWildcardWidgetsHidden();
                }, 2000);
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
                
                // Hide all wildcard parameter widgets from INPUT_TYPES (they're handled by JavaScript)
                this.hideWildcardParameterWidgets();
                
                // Add template text display widget
                this.addTemplateDisplayWidget();
            };
            
            // Hide wildcard parameter widgets from INPUT_TYPES to avoid UI clutter
            nodeType.prototype.hideWildcardParameterWidgets = function() {
                console.log("Hiding INPUT_TYPES wildcard parameter widgets...");
                
                // Get the list of wildcard parameters from the current template
                const templateWidget = this.widgets.find(w => w.name === "template");
                if (templateWidget && templateWidget.value !== "none") {
                    const templateData = this.templateCache.get(templateWidget.value);
                    if (templateData) {
                        templateData.parameters.forEach(param => {
                            // Find and hide the corresponding INPUT_TYPES widget
                            const wildcardWidget = this.widgets.find(w => w.name === param.name);
                            if (wildcardWidget) {
                                // Hide the widget by setting it to not display
                                wildcardWidget.hidden = true;
                                wildcardWidget.visible = false;
                                
                                // Also try to remove it from the DOM if possible
                                if (wildcardWidget.inputEl && wildcardWidget.inputEl.parentNode) {
                                    wildcardWidget.inputEl.parentNode.style.display = 'none';
                                }
                                
                                console.log(`Hidden INPUT_TYPES widget: ${param.name}`);
                            }
                        });
                    }
                }
                
                // Also hide any other widgets that look like wildcard parameters
                this.widgets.forEach(widget => {
                    // Check if this is a wildcard parameter widget (not our main widgets)
                    if (widget.name !== "template" && 
                        widget.name !== "mode" && 
                        widget.name !== "seed" && 
                        widget.name !== "wildcard_index" && 
                        widget.name !== "populated" &&
                        widget.name !== "template_preview") {
                        
                        // This is likely a wildcard parameter widget, hide it
                        widget.hidden = true;
                        widget.visible = false;
                        
                        if (widget.inputEl && widget.inputEl.parentNode) {
                            widget.inputEl.parentNode.style.display = 'none';
                        }
                        
                        console.log(`Hidden potential wildcard widget: ${widget.name}`);
                    }
                });
            };
            
            // Ensure widgets stay hidden by periodically checking and re-hiding them
            nodeType.prototype.ensureWildcardWidgetsHidden = function() {
                // Use a more aggressive approach to hide widgets
                this.widgets.forEach(widget => {
                    // Check if this is a wildcard parameter widget (not our main widgets)
                    if (widget.name !== "template" && 
                        widget.name !== "mode" && 
                        widget.name !== "seed" && 
                        widget.name !== "wildcard_index" && 
                        widget.name !== "populated" &&
                        widget.name !== "template_preview") {
                        
                        // This is likely a wildcard parameter widget, hide it aggressively
                        widget.hidden = true;
                        widget.visible = false;
                        
                        // Try multiple DOM hiding approaches
                        if (widget.inputEl) {
                            if (widget.inputEl.parentNode) {
                                widget.inputEl.parentNode.style.display = 'none';
                                widget.inputEl.parentNode.style.visibility = 'hidden';
                            }
                            widget.inputEl.style.display = 'none';
                            widget.inputEl.style.visibility = 'hidden';
                        }
                        
                        // Also try to hide the widget container
                        if (widget.container) {
                            widget.container.style.display = 'none';
                            widget.container.style.visibility = 'hidden';
                        }
                    }
                });
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
                        const height = Math.max(150, Math.min(lines * 20 + 80, 400));
                        return [0, height];
                    };
                }
                
                // Set initial node size to be wider and taller
                this.setSize([500, 300]);
            };
            
            // Handle template selection changes
            nodeType.prototype.onTemplateChanged = function(templateName) {
                if (this.isUpdatingTemplate) return;
                
                console.log("Template changed to:", templateName);
                
                // Clear existing dynamic widgets
                this.clearDynamicWidgets();
                
                if (templateName === "none") {
                    this.templateTextWidget.value = "";
                    if (this.populatedWidget) {
                        this.populatedWidget.value = "";
                    }
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
                    const response = await fetch(`/api/custom/templates/${templateName}`);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    
                    const templateData = await response.json();
                    
                    // Load wildcard data for this template
                    const wildcardResponse = await fetch(`/api/custom/templates/${templateName}/wildcards`);
                    if (wildcardResponse.ok) {
                        const wildcardData = await wildcardResponse.json();
                        
                        // Update template parameters with wildcard choices
                        templateData.parameters.forEach(param => {
                            if (wildcardData[param.name]) {
                                param.options.choices = wildcardData[param.name].choices;
                                console.log(`Updated parameter ${param.name} with choices:`, param.options.choices);
                            }
                        });
                    }
                    
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
                
                // Update template text display with the raw template (with placeholders)
                this.templateTextWidget.value = text;
                
                // Create parameter widgets
                parameters.forEach(param => {
                    this.createParameterWidget(param);
                });
                
                // Hide INPUT_TYPES wildcard parameter widgets to avoid UI clutter
                this.hideWildcardParameterWidgets();
                
                // Refresh the populated field based on current mode
                this.refreshPopulatedField();
                
                // Always update the template preview to show current state
                this.updateTemplatePreview();
                
                // Resize node to fit new content with better dimensions
                const baseHeight = 300;
                const paramHeight = parameters.length * 35;
                const finalHeight = Math.max(baseHeight, baseHeight + paramHeight);
                this.setSize([500, finalHeight]);
                
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
                    case "select":
                        // Ensure we have choices for select widgets
                        const choices = options.choices || [];
                        console.log(`Creating select widget for ${name} with ${choices.length} choices:`, choices);
                        
                        if (choices.length === 0 && wildcard_file) {
                            console.warn(`No choices available for wildcard: ${wildcard_file}`);
                        }
                        
                        // Set default to "Random" if available, otherwise first choice
                        const defaultVal = choices.includes("Random") ? "Random" : (choices[0] || "");
                        
                        // Create the combo widget (dropdown)
                        widget = this.addWidget("combo", name, defaultVal,
                            (value) => this.onParameterChanged(name, value),
                            {
                                values: choices,
                                ...widgetOptions
                            }
                        );
                        
                        // Ensure the widget is properly configured as a dropdown
                        if (widget && widget.options) {
                            widget.options.values = choices;
                            console.log(`Widget ${name} configured with values:`, widget.options.values);
                        }
                        
                        // Connect widget to the node's input system
                        if (this.inputs) {
                            const inputIndex = this.inputs.findIndex(input => input.name === name);
                            if (inputIndex >= 0) {
                                widget.inputIndex = inputIndex;
                                console.log(`Connected widget ${name} to input index ${inputIndex}`);
                            }
                        }
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
                    
                    console.log("Created widget:", name, widget, "choices:", options.choices?.length || 0);
                    console.log("Widget values:", widget.options?.values);
                }
                
                return widget;
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
                
                // Replace parameter placeholders with current values
                this.dynamicWidgets.forEach((widget, paramName) => {
                    const placeholder = `{${paramName}}`;
                    let value = widget.value !== undefined ? String(widget.value) : '';
                    
                    // If value is "Random", show the wildcard variable name
                    if (value === "Random") {
                        value = `{${paramName}}`; // Show the original placeholder
                    }
                    
                    // Replace all occurrences of the placeholder
                    previewText = previewText.replace(new RegExp(placeholder, 'g'), value);
                });
                
                // Update the populated widget if it exists and we're in populate mode
                if (this.populatedWidget && this.modeWidget && this.modeWidget.value) {
                    this.populatedWidget.value = previewText;
                }
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
                
                // Save current template
                const templateWidget = this.widgets.find(w => w.name === "template");
                if (templateWidget) {
                    data.current_template = templateWidget.value;
                }
                
                return data;
            };
            
            // Override configure to restore dynamic widget values
            nodeType.prototype.onConfigure = function(data) {
                const result = originalOnConfigure?.apply(this, arguments);
                
                // Restore template if it exists
                if (data.current_template && data.current_template !== "none") {
                    this.isUpdatingTemplate = true;
                    
                    // Wait for template to load, then restore values
                    setTimeout(() => {
                        this.onTemplateChanged(data.current_template);
                        
                        // Restore dynamic widget states if they exist
                        if (data.dynamic_widget_states) {
                            Object.entries(data.dynamic_widget_states).forEach(([name, value]) => {
                                const widget = this.dynamicWidgets.get(name);
                                if (widget) {
                                    widget.value = value;
                                }
                            });
                            
                            this.updateTemplatePreview();
                        }
                        
                        this.isUpdatingTemplate = false;
                    }, 100);
                }
                
                return result;
            };

            // Get current widget values for execution
            nodeType.prototype.getWidgetValues = function() {
                const values = {};
                this.dynamicWidgets.forEach((widget, name) => {
                    values[name] = widget.value;
                });
                console.log("Current widget values:", values);
                return values;
            };
            
            // Synchronize widget values with node inputs before execution
            nodeType.prototype.syncWidgetValuesToInputs = function() {
                console.log("Synchronizing widget values to inputs...");
                
                this.dynamicWidgets.forEach((widget, name) => {
                    if (widget.inputIndex !== undefined && this.inputs && this.inputs[widget.inputIndex]) {
                        // Update the input value with the widget value
                        this.inputs[widget.inputIndex].value = widget.value;
                        console.log(`Synced ${name} = ${widget.value} to input index ${widget.inputIndex}`);
                    }
                });
            };
            
            // Override the node's execution method to ensure widget values are synced
            nodeType.prototype.onExecuted = function(message) {
                // Sync widget values before execution
                this.syncWidgetValuesToInputs();
                
                // Call original method if it exists
                if (originalOnExecuted) {
                    return originalOnExecuted.apply(this, arguments);
                }
            };
            
            // Also sync values when the node is about to be queued for execution
            nodeType.prototype.onBeforeExecuted = function() {
                console.log("Node about to be executed, syncing widget values...");
                this.syncWidgetValuesToInputs();
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
                    // Fixed mode: show template with current parameter values
                    const templateWidget = this.widgets.find(w => w.name === "template");
                    if (templateWidget && templateWidget.value !== "none") {
                        const templateData = this.templateCache.get(templateWidget.value);
                        if (templateData) {
                            let templateText = templateData.text;
                            
                            // Replace placeholders with current values
                            this.dynamicWidgets.forEach((widget, paramName) => {
                                const placeholder = `{${paramName}}`;
                                let value = widget.value !== undefined ? String(widget.value) : '';
                                
                                // If value is "Random", show the wildcard variable name
                                if (value === "Random") {
                                    value = `{${paramName}}`; // Show the original placeholder
                                }
                                
                                // Replace all occurrences of the placeholder
                                templateText = templateText.replace(new RegExp(placeholder, 'g'), value);
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
            
            // Get current widget values for execution
        }
    }
});