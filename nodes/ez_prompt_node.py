# template_node.py
import json
import os
import random
from server import PromptServer
from aiohttp import web

class EZPromptsNode:
    """
    A node that dynamically creates input parameters based on selected templates
    """
    
    def __init__(self):
        self.templates = self.load_templates()
        self.wildcards = self.load_wildcards()
        # Populate template choices immediately
        self.populate_template_choices()
    
    @classmethod
    def INPUT_TYPES(cls):
        # Load templates to get available choices
        templates_dir = os.path.join(os.path.dirname(__file__), "templates")
        
        template_choices = []
        if os.path.exists(templates_dir):
            for filename in os.listdir(templates_dir):
                if filename.endswith('.json'):
                    template_name = filename[:-5]  # Remove .json extension
                    template_choices.append(template_name)
        
        # If no templates found, add "none", otherwise use first template as default
        if not template_choices:
            template_choices = ["none"]
            default_template = "none"
        else:
            default_template = template_choices[0]  # Use first template as default
        
        print(f"INPUT_TYPES - Template choices: {template_choices}")
        print(f"INPUT_TYPES - Default template: {default_template}")
        
        return {
            "required": {
                "template": (template_choices, {"default": default_template}),
            },
            "optional": {
                "mode": ("BOOLEAN", {"default": True, "label_on": "Populate", "label_off": "Fixed"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "wildcard_index": ("INT", {"default": 0, "min": 0, "max": 99999}),
                "populated": ("STRING", {"multiline": True, "default": ""}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "wildcard_params": ("STRING", {"default": "{}"})  # JSON string for wildcard parameter values
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("prompt",)
    FUNCTION = "generate_prompt"
    CATEGORY = "text/templates"
    
    def load_templates(self):
        """Load template definitions from .json files"""
        templates_dir = os.path.join(os.path.dirname(__file__), "templates")
        os.makedirs(templates_dir, exist_ok=True)
        
        templates = {}
        
        print(f"Loading templates from: {templates_dir}")
        print(f"Directory exists: {os.path.exists(templates_dir)}")
        if os.path.exists(templates_dir):
            print(f"Directory contents: {os.listdir(templates_dir)}")
        
        # Load all .json template files
        for filename in os.listdir(templates_dir):
            if filename.endswith('.json'):
                template_name = filename[:-5]  # Remove .json extension
                template_path = os.path.join(templates_dir, filename)
                
                print(f"Processing template file: {filename}")
                
                try:
                    with open(template_path, 'r', encoding='utf-8') as f:
                        template_data = json.load(f)
                    
                    print(f"  Template data: {template_data}")
                    
                    # Validate required fields
                    if all(key in template_data for key in ["name", "description", "template", "variables"]):
                        # Convert to the expected format for the node
                        converted_template = {
                            "name": template_data["name"],
                            "description": template_data["description"],
                            "text": template_data["template"],
                            "parameters": []
                        }
                        
                        # Convert variables to parameters
                        for var_name, wildcard_file in template_data["variables"].items():
                            # Remove .txt extension if present
                            wildcard_name = wildcard_file.replace('.txt', '')
                            
                            param = {
                                "name": var_name,
                                "type": "select",  # Ensure type is select for dropdown
                                "label": var_name.replace('_', ' ').title(),
                                "defaultValue": "Random",
                                "wildcard_file": wildcard_name,  # Store reference to wildcard file
                        "options": {
                                    "choices": []  # Will be populated with wildcard values
                                }
                            }
                            converted_template["parameters"].append(param)
                            print(f"    Created parameter: {param}")
                        
                        templates[template_name] = converted_template
                        print(f"  Converted template: {converted_template}")
                        
                except Exception as e:
                    print(f"Error loading template {filename}: {e}")
        
        print(f"Total templates loaded: {len(templates)}")
        return templates
    
    def load_wildcards(self):
        """Load wildcard values from .txt files, only for those referenced in templates"""
        wildcards_dir = os.path.join(os.path.dirname(__file__), "wildcards")
        os.makedirs(wildcards_dir, exist_ok=True)
        
        print(f"Wildcards directory: {wildcards_dir}")
        print(f"Directory exists: {os.path.exists(wildcards_dir)}")
        if os.path.exists(wildcards_dir):
            print(f"Directory contents: {os.listdir(wildcards_dir)}")
        
        wildcards = {}
        
        # Get all wildcard files referenced in templates
        referenced_wildcards = set()
        for template_data in self.templates.values():
            for param in template_data.get("parameters", []):
                if "wildcard_file" in param:
                    referenced_wildcards.add(param["wildcard_file"])
        
        print(f"Referenced wildcards: {referenced_wildcards}")
        
        # Load only referenced wildcard files
        for wildcard_name in referenced_wildcards:
            wildcard_path = os.path.join(wildcards_dir, f"{wildcard_name}.txt")
            print(f"Looking for wildcard file: {wildcard_path}")
            
            if os.path.exists(wildcard_path):
                try:
                    with open(wildcard_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    
                    # Clean up lines and remove empty ones
                    values = [line.strip() for line in lines if line.strip()]
                    wildcards[wildcard_name] = values
                    print(f"Loaded wildcard {wildcard_name}: {values}")
                    
                except Exception as e:
                    print(f"Error loading wildcard {wildcard_name}: {e}")
            else:
                print(f"Warning: Wildcard file {wildcard_name}.txt not found")
        
        print(f"Total wildcards loaded: {len(wildcards)}")
        print(f"Wildcard contents: {wildcards}")
        return wildcards
    
    def populate_template_choices(self):
        """Populate template parameter choices with wildcard values"""
        print("Populating template choices...")
        print(f"Available wildcards: {list(self.wildcards.keys())}")
        
        for template_name, template_data in self.templates.items():
            print(f"Processing template: {template_name}")
            for param in template_data.get("parameters", []):
                if "wildcard_file" in param:
                    wildcard_name = param["wildcard_file"]
                    wildcard_values = self.wildcards.get(wildcard_name, [])
                    
                    print(f"  Parameter: {param['name']}, Wildcard: {wildcard_name}, Values: {wildcard_values}")
                    
                    # Add "Random" as the first choice and set as default
                    choices = ["Random"] + wildcard_values
                    param["options"]["choices"] = choices
                    param["defaultValue"] = "Random"
                    
                    print(f"  Final choices: {choices}")
                    print(f"  Parameter options after population: {param['options']}")
        
        print("Template choices populated.")
    
    def get_node_info(self):
        """Get information about the current node state for debugging"""
        info = {
            "templates": list(self.templates.keys()),
            "wildcards": list(self.wildcards.keys()),
            "template_params": {}
        }
        
        for template_name, template_data in self.templates.items():
            info["template_params"][template_name] = {
                "parameters": [param["name"] for param in template_data.get("parameters", [])],
                "wildcard_files": [param.get("wildcard_file") for param in template_data.get("parameters", [])]
            }
        
        return info

    def generate_prompt(self, template, mode=True, seed=0, wildcard_index=0, populated="", unique_id=None, extra_pnginfo=None, wildcard_params="{}"):
        """Generate the final prompt by substituting template parameters"""
        
        print("=" * 60)
        print("EZPromptsNode.generate_prompt() called")
        print(f"Template: {template}")
        print(f"Mode: {mode}")
        print(f"Seed: {seed}")
        print(f"Wildcard Index: {wildcard_index}")
        print(f"Populated: {populated}")
        print(f"Unique ID: {unique_id}")
        print(f"Extra PNG Info: {extra_pnginfo}")
        print(f"Wildcard Params (raw): '{wildcard_params}'")
        print(f"Wildcard Params type: {type(wildcard_params)}")
        print("=" * 60)
        
        if template == "none":
            return ("",)
        
        # Ensure seed and wildcard_index are valid numbers
        try:
            seed = int(seed) if seed is not None else 0
            wildcard_index = int(wildcard_index) if wildcard_index is not None else 0
        except (ValueError, TypeError):
            print(f"Warning: Invalid seed '{seed}' or wildcard_index '{wildcard_index}', using defaults")
            seed = 0
            wildcard_index = 0
        
        print(f"Using seed: {seed}, wildcard_index: {wildcard_index}")
        print(f"Mode: {'Populate' if mode else 'Fixed'}")
        
        # Fixed mode: use populated field directly, bypass template processing
        if not mode:
            if populated and populated.strip():
                print(f"Fixed mode: using populated field content directly")
                return (populated,)
            else:
                print(f"Fixed mode: populated field is empty, returning empty string")
                return ("",)
        
        # Populate mode: process template with seed-based randomization
        print(f"Populate mode: processing template '{template}' with seed {seed}, index {wildcard_index}")
        
        # Try to get wildcard parameters from populated field first (more reliable)
        wildcard_values = {}
        if populated and populated.strip():
            try:
                # Check if populated field contains JSON with wildcard data
                populated_data = json.loads(populated)
                if isinstance(populated_data, dict) and "wildcard_params" in populated_data:
                    wildcard_values = populated_data["wildcard_params"]
                    print(f"Found wildcard params in populated field: {wildcard_values}")
                else:
                    print("Populated field is not JSON or doesn't contain wildcard_params")
            except json.JSONDecodeError:
                print("Populated field is not valid JSON, treating as regular text")
        
        # Fallback to hidden wildcard_params field if populated field didn't work
        if not wildcard_values:
            try:
                wildcard_values = json.loads(wildcard_params) if wildcard_params else {}
                print(f"Fallback: Parsed wildcard parameters from hidden field: {wildcard_values}")
                print(f"Fallback: Wildcard params JSON string: '{wildcard_params}'")
            except json.JSONDecodeError as e:
                print(f"Warning: Failed to parse wildcard_params JSON: {e}")
                wildcard_values = {}
        
        print(f"Final wildcard values to use: {wildcard_values}")
        print(f"Wildcard values type: {type(wildcard_values)}")
        print(f"Wildcard values keys: {list(wildcard_values.keys()) if isinstance(wildcard_values, dict) else 'Not a dict'}")
        
        template_data = self.templates.get(template)
        if not template_data:
            return ("Template not found",)
        
        # Start with the base template text
        prompt_text = template_data["text"]
        
        print(f"Template text: {prompt_text}")
        print(f"Template parameters: {[param['name'] for param in template_data.get('parameters', [])]}")
        
        # Set seed for deterministic randomization
        random.seed(seed)
        
        # Replace placeholders with parameter values from wildcard_values
        for i, param in enumerate(template_data["parameters"]):
            param_name = param["name"]
            # Get value from wildcard_values (which comes from JavaScript widgets)
            param_value = wildcard_values.get(param_name, "Random")
            
            print(f"Processing parameter: {param_name} = {param_value}")
            print(f"  Available in wildcard_values: {param_name in wildcard_values}")
            print(f"  Wildcard_values content: {wildcard_values}")
            
            # Handle "Random" values by selecting from available choices
            if param_value == "Random":
                # Get the choices from the wildcard file
                wildcard_name = param.get("wildcard_file", "")
                if wildcard_name:
                    wildcard_path = os.path.join(os.path.dirname(__file__), "wildcards", f"{wildcard_name}.txt")
                    if os.path.exists(wildcard_path):
                        try:
                            with open(wildcard_path, 'r', encoding='utf-8') as wf:
                                lines = wf.readlines()
                                # Clean up lines and remove empty ones
                                available_choices = [line.strip() for line in lines if line.strip()]
                            
                            if available_choices:
                                # Use derived seed for each wildcard to ensure consistency
                                derived_seed = seed + i
                                random.seed(derived_seed)
                                param_value = random.choice(available_choices)
                                print(f"  Random selection for {param_name}: {param_value} (seed: {derived_seed})")
                            else:
                                param_value = ""
                        except Exception as e:
                            print(f"Error reading wildcard file {wildcard_name}: {e}")
                            param_value = ""
                    else:
                        print(f"Wildcard file {wildcard_name}.txt not found")
                        param_value = ""
                else:
                    param_value = ""
            
            # Convert to string if needed
            if param_value is not None:
                param_value = str(param_value)
            else:
                param_value = ""
            
            # Replace the placeholder
            placeholder = "{" + param_name + "}"
            old_text = prompt_text
            prompt_text = prompt_text.replace(placeholder, param_value)
            
            if old_text != prompt_text:
                print(f"  Replaced {placeholder} with '{param_value}'")
        
        print(f"Final prompt: {prompt_text}")
        print("=" * 60)
        return (prompt_text,)

@PromptServer.instance.routes.get("/api/custom/templates/{template_name}/wildcards")
async def get_template_wildcards(request):
    template_name = request.match_info["template_name"]
    node = EZPromptsNode()
    
    if template_name in node.templates:
        template_data = node.templates[template_name]
        wildcard_data = {}
        
        for param in template_data.get("parameters", []):
            if "wildcard_file" in param:
                wildcard_name = param["wildcard_file"]
                wildcard_values = node.wildcards.get(wildcard_name, [])
                wildcard_data[param["name"]] = {
                    "choices": wildcard_values,  # Don't add "Random" here, JavaScript will add it
                    "wildcard_file": wildcard_name
                }
        
        print(f"Returning wildcard data for template {template_name}: {wildcard_data}")
        return web.json_response(wildcard_data)
    else:
        return web.json_response({"error": "Template not found"}, status=404)

@PromptServer.instance.routes.get("/api/custom/debug/node_info")
async def get_node_debug_info(request):
    node = EZPromptsNode()
    info = node.get_node_info()
    print(f"Debug info requested: {info}")
    return web.json_response(info)

# Web route to serve template data to JavaScript
@PromptServer.instance.routes.get("/api/custom/templates/{template_name}")
async def get_template_data(request):
    template_name = request.match_info["template_name"]
    node = EZPromptsNode()
    
    # Populate choices before returning
    node.populate_template_choices()
    
    if template_name in node.templates:
        template_data = node.templates[template_name]
        print(f"Returning template data for {template_name}: {template_data}")
        return web.json_response(template_data)
    else:
        return web.json_response({"error": "Template not found"}, status=404)

@PromptServer.instance.routes.get("/api/custom/templates/list")
async def get_template_list(request):
    node = EZPromptsNode()
    templates = [{"name": name, "label": data["name"]} for name, data in node.templates.items()]
    print(f"Returning template list: {templates}")
    return web.json_response(templates)

@PromptServer.instance.routes.get("/api/custom/wildcards/{wildcard_name}")
async def get_wildcard_data(request):
    wildcard_name = request.match_info["wildcard_name"]
    node = EZPromptsNode()
    
    if wildcard_name in node.wildcards:
        wildcard_data = {
            "name": wildcard_name,
            "values": node.wildcards[wildcard_name]
        }
        print(f"Returning wildcard data for {wildcard_name}: {wildcard_data}")
        return web.json_response(wildcard_data)
    else:
        print(f"Wildcard {wildcard_name} not found")
        return web.json_response({"error": "Wildcard not found"}, status=404)

@PromptServer.instance.routes.get("/api/custom/wildcards/list")
async def get_wildcard_list(request):
    node = EZPromptsNode()
    wildcards = [{"name": name, "values": values} for name, values in node.wildcards.items()]
    print(f"Returning wildcard list: {wildcards}")
    return web.json_response(wildcards)