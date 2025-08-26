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
                this.dynamicWidgets = new Map(); // Map of parameter name -> widget
                this.wildcardParamValues = {}; // Store current wildcard parameter values
                this.populatedWidget = null;
                this.modeWidget = null;
                this.hiddenWildcardWidget = null;
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
                
                // Find the hidden wildcard params widget
                this.hiddenWildcardWidget = this.widgets.find(w => w.name === "wildcard_params");
                
                // Setup parameter change listeners for existing widgets
                this.setupParameterListeners();
            };
            
            // Setup listeners for wildcard parameter widgets
            nodeType.prototype.setupParameterListeners = function() {
                // Listen for changes on any widget that might be a wildcard parameter
                this.widgets.forEach(widget => {
                    if (widget.name !== "template" && widget.name !== "mode" && 
                        widget.name !== "seed" && widget.name !== "wildcard_index" && 
                        widget.name !== "populated" && widget.name !== "wildcard_params") {
                        
                        const originalCallback = widget.callback;
                        widget.callback = (value) => {
                            originalCallback?.(value);
                            this.onWildcardParameterChanged(widget.name, value);
                        };
                    }
                });
            };
            
            // Handle wildcard parameter changes
            nodeType.prototype.onWildcardParameterChanged = function(paramName, value) {
                console.log(`Wildcard parameter ${paramName} changed to: ${value}`);
                
                // Update our internal state
                this.wildcardParamValues[paramName] = value;
                
                // Update the hidden JSON field
                this.updateHiddenWildcardParams();
                
                // Update the populated field preview
                this.updateTemplatePreview();
            };
            
            // Update the hidden wildcard params JSON field
            nodeType.prototype.updateHiddenWildcardParams = function() {
                if (this.hiddenWildcardWidget) {
                    this.hiddenWildcardWidget.value = JSON.stringify(this.wildcardParamValues);
                    console.log("Updated hidden wildcard params:", this.hiddenWildcardWidget.value);
                }
            };
            
            // Handle template selection changes
            nodeType.prototype.onTemplateChanged = function(templateName) {
                if (this.isUpdatingTemplate) return;
                
                console.log("Template changed to:", templateName);
                
                if (templateName === "none") {
                    this.clearDynamicWidgets();
                    if (this.populatedWidget) {
                        this.populatedWidget.value = "";
                    }
                    this.setSize([500, 300]);
                    return;
                }
                
                // Load template data and create dynamic widgets
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
                                param.options = wildcardData[param.name];
                                console.log(`Updated parameter ${param.name} with options:`, param.options);
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
                
                // Store current wildcard parameter values before clearing widgets
                const currentValues = { ...this.wildcardParamValues };
                
                // Clear existing dynamic widgets
                this.clearDynamicWidgets();
                
                // Create dynamic widgets for each parameter
                parameters.forEach(param => {
                    this.createWildcardParameterWidget(param);
                });
                
                // Restore any existing values that are still valid for this template
                parameters.forEach(param => {
                    if (currentValues[param.name] && currentValues[param.name] !== "Random") {
                        // Check if the value is still valid for this parameter
                        const widget = this.dynamicWidgets.get(param.name);
                        if (widget && widget.options && widget.options.values) {
                            if (widget.options.values.includes(currentValues[param.name])) {
                                // Restore the value
                                widget.value = currentValues[param.name];
                                this.wildcardParamValues[param.name] = currentValues[param.name];
                                console.log(`Restored value for ${param.name}: ${currentValues[param.name]}`);
                            }
                        }
                    }
                });
                
                // Update hidden field with current values
                this.updateHiddenWildcardParams();
                
                // Refresh the populated field based on current mode
                this.refreshPopulatedField();
                
                // Set appropriate node size for template display
                this.setSize([500, 300]);
                
                console.log(`Template "${name}" applied with ${parameters.length} parameters`);
            };
            
            // Create a wildcard parameter widget
            nodeType.prototype.createWildcardParameterWidget = function(paramData) {
                const { name, wildcard_file, options } = paramData;
                
                // Get wildcard choices - avoid duplicate "Random"
                let choices = [];
                if (options && options.choices) {
                    // Filter out any existing "Random" to avoid duplicates
                    choices = options.choices.filter(choice => choice !== "Random");
                }
                // Add "Random" as the first option
                choices = ["Random", ...choices];
                
                console.log(`Creating widget for ${name} with choices:`, choices);
                
                // Create combo widget
                const widget = this.addWidget("combo", name, "Random", (value) => {
                    this.onWildcardParameterChanged(name, value);
                }, {
                    values: choices,
                    serialize: true
                });
                
                // Store widget reference and metadata
                widget.parameterData = paramData;
                this.dynamicWidgets.set(name, widget);
                
                // Set initial value to "Random" and update our tracking
                this.wildcardParamValues[name] = "Random";
                
                console.log(`Created wildcard parameter widget: ${name}`);
            };
            
            // Clear all dynamic widgets
            nodeType.prototype.clearDynamicWidgets = function() {
                console.log("Clearing dynamic widgets");
                
                // Remove widgets from the node
                this.dynamicWidgets.forEach((widget, name) => {
                    this.removeWidget(widget);
                });
                
                // Clear our tracking
                this.dynamicWidgets.clear();
                this.wildcardParamValues = {};
                
                // Update hidden field
                this.updateHiddenWildcardParams();
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
                            
                            // Replace placeholders with current wildcard parameter values
                            Object.entries(this.wildcardParamValues).forEach(([paramName, value]) => {
                                const placeholder = `{${paramName}}`;
                                let displayValue = value !== undefined ? String(value) : '';
                                
                                // If value is "Random", show the wildcard variable name
                                if (displayValue === "Random") {
                                    displayValue = `{${paramName}}`; // Show the original placeholder
                                }
                                
                                // Replace all occurrences of the placeholder
                                templateText = templateText.replace(new RegExp(placeholder, 'g'), displayValue);
                            });
                            
                            this.populatedWidget.value = templateText;
                        }
                    }
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
                
                // Replace parameter placeholders with current wildcard parameter values
                Object.entries(this.wildcardParamValues).forEach(([paramName, value]) => {
                    const placeholder = `{${paramName}}`;
                    let displayValue = value !== undefined ? String(value) : '';
                    
                    // If value is "Random", show the wildcard variable name
                    if (displayValue === "Random") {
                        displayValue = `{${paramName}}`; // Show the original placeholder
                    }
                    
                    // Replace all occurrences of the placeholder
                    previewText = previewText.replace(new RegExp(placeholder, 'g'), displayValue);
                });
                
                // Update the populated widget if it exists and we're in populate mode
                if (this.populatedWidget && this.modeWidget && this.modeWidget.value) {
                    this.populatedWidget.value = previewText;
                }
            };
            
            // Handle mode changes
            nodeType.prototype.onModeChanged = function(mode) {
                console.log("Mode changed to:", mode ? "Populate" : "Fixed");
                this.refreshPopulatedField();
            };
            
            // Serialize node state
            nodeType.prototype.serialize = function() {
                const data = originalSerialize?.apply(this, arguments) || {};
                data.current_template = this.widgets.find(w => w.name === "template")?.value;
                data.wildcard_param_values = this.wildcardParamValues;
                return data;
            };
            
            // Configure node from saved state
            nodeType.prototype.onConfigure = function(data) {
                const result = originalOnConfigure?.apply(this, arguments) || {};
                
                if (data.current_template) {
                    this.current_template = data.current_template;
                    // Trigger template loading after a short delay to ensure widgets are ready
                    setTimeout(() => {
                        this.onTemplateChanged(data.current_template);
                        
                        // After template is loaded, restore wildcard parameter values
                        if (data.wildcard_param_values) {
                            setTimeout(() => {
                                this.restoreWildcardParameterValues(data.wildcard_param_values);
                            }, 200); // Wait for widgets to be fully created
                        }
                    }, 100);
                }
                
                return result;
            };
            
            // Restore wildcard parameter values to widgets
            nodeType.prototype.restoreWildcardParameterValues = function(values) {
                console.log("Restoring wildcard parameter values:", values);
                
                Object.entries(values).forEach(([paramName, value]) => {
                    const widget = this.dynamicWidgets.get(paramName);
                    if (widget && value !== "Random") {
                        // Check if the value is valid for this widget
                        if (widget.options && widget.options.values && widget.options.values.includes(value)) {
                            widget.value = value;
                            this.wildcardParamValues[paramName] = value;
                            console.log(`Restored ${paramName} = ${value}`);
                        }
                    }
                });
                
                // Update hidden field and refresh display
                this.updateHiddenWildcardParams();
                this.refreshPopulatedField();
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
        }
    }
});