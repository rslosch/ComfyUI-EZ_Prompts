# template_node.py
import json
import os
from server import PromptServer
from aiohttp import web

class EZPromptsNode:
    """
    A node that dynamically creates input parameters based on selected templates
    """
    
    def __init__(self):
        self.templates = self.load_templates()
        self.wildcards = self.load_wildcards()
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "template": (["none"], {"default": "none"}),
            },
            "optional": {
                # Dynamic inputs will be added by JavaScript
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO"
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
        
        # Load all .json template files
        for filename in os.listdir(templates_dir):
            if filename.endswith('.json'):
                template_name = filename[:-5]  # Remove .json extension
                template_path = os.path.join(templates_dir, filename)
                
                try:
                    with open(template_path, 'r', encoding='utf-8') as f:
                        template_data = json.load(f)
                    
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
                                "type": "select",
                                "label": var_name.replace('_', ' ').title(),
                                "defaultValue": "",
                                "wildcard_file": wildcard_name,  # Store reference to wildcard file
                                "options": {
                                    "choices": []  # Will be populated with wildcard values
                                }
                            }
                            converted_template["parameters"].append(param)
                        
                        templates[template_name] = converted_template
                        
                except Exception as e:
                    print(f"Error loading template {filename}: {e}")
        
        return templates
    
    def load_wildcards(self):
        """Load wildcard values from .txt files, only for those referenced in templates"""
        wildcards_dir = os.path.join(os.path.dirname(__file__), "wildcards")
        os.makedirs(wildcards_dir, exist_ok=True)
        
        wildcards = {}
        
        # Get all wildcard files referenced in templates
        referenced_wildcards = set()
        for template_data in self.templates.values():
            for param in template_data.get("parameters", []):
                if "wildcard_file" in param:
                    referenced_wildcards.add(param["wildcard_file"])
        
        # Load only referenced wildcard files
        for wildcard_name in referenced_wildcards:
            wildcard_path = os.path.join(wildcards_dir, f"{wildcard_name}.txt")
            
            if os.path.exists(wildcard_path):
                try:
                    with open(wildcard_path, 'r', encoding='utf-8') as f:
                        lines = f.readlines()
                    
                    # Clean up lines and remove empty ones
                    values = [line.strip() for line in lines if line.strip()]
                    wildcards[wildcard_name] = values
                    
                except Exception as e:
                    print(f"Error loading wildcard {wildcard_name}: {e}")
            else:
                print(f"Warning: Wildcard file {wildcard_name}.txt not found")
        
        return wildcards
    
    def populate_template_choices(self):
        """Populate template parameter choices with wildcard values"""
        for template_name, template_data in self.templates.items():
            for param in template_data.get("parameters", []):
                if "wildcard_file" in param:
                    wildcard_name = param["wildcard_file"]
                    wildcard_values = self.wildcards.get(wildcard_name, [])
                    
                    param["options"]["choices"] = wildcard_values
                    if wildcard_values:
                        param["defaultValue"] = wildcard_values[0]
    
    def generate_prompt(self, template, unique_id=None, extra_pnginfo=None, **kwargs):
        """Generate the final prompt by substituting template parameters"""
        
        if template == "none":
            return ("",)
        
        template_data = self.templates.get(template)
        if not template_data:
            return ("Template not found",)
        
        # Start with the base template text
        prompt_text = template_data["text"]
        
        # Replace placeholders with parameter values
        for param in template_data["parameters"]:
            param_name = param["name"]
            param_value = kwargs.get(param_name, param.get("defaultValue", ""))
            
            # Convert to string if needed
            if param_value is not None:
                param_value = str(param_value)
            else:
                param_value = ""
            
            # Replace the placeholder
            placeholder = "{" + param_name + "}"
            prompt_text = prompt_text.replace(placeholder, param_value)
        
        return (prompt_text,)

# Web route to serve template data to JavaScript
@PromptServer.instance.routes.get("/api/custom/templates/{template_name}")
async def get_template_data(request):
    template_name = request.match_info["template_name"]
    node = EZPromptsNode()
    
    # Populate choices before returning
    node.populate_template_choices()
    
    if template_name in node.templates:
        return web.json_response(node.templates[template_name])
    else:
        return web.json_response({"error": "Template not found"}, status=404)

@PromptServer.instance.routes.get("/api/custom/templates/list")
async def get_template_list(request):
    node = EZPromptsNode()
    templates = [{"name": name, "label": data["name"]} for name, data in node.templates.items()]
    return web.json_response(templates)

@PromptServer.instance.routes.get("/api/custom/wildcards/{wildcard_name}")
async def get_wildcard_data(request):
    wildcard_name = request.match_info["wildcard_name"]
    node = EZPromptsNode()
    
    if wildcard_name in node.wildcards:
        return web.json_response({
            "name": wildcard_name,
            "values": node.wildcards[wildcard_name]
        })
    else:
        return web.json_response({"error": "Wildcard not found"}, status=404)

@PromptServer.instance.routes.get("/api/custom/wildcards/list")
async def get_wildcard_list(request):
    node = EZPromptsNode()
    wildcards = [{"name": name, "values": values} for name, values in node.wildcards.items()]
    return web.json_response(wildcards)