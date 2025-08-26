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
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "template": (["none", "character", "scene", "style", "custom"], {"default": "none"}),
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
        """Load template definitions from JSON file"""
        templates_dir = os.path.join(os.path.dirname(__file__), "templates")
        os.makedirs(templates_dir, exist_ok=True)
        
        templates = {
            "character": {
                "name": "Character Template",
                "text": "A {character_type} character named {name}, {age} years old, with {appearance} appearance and {personality} personality. {special_abilities}",
                "parameters": [
                    {
                        "name": "character_type",
                        "type": "select",
                        "label": "Character Type",
                        "defaultValue": "warrior",
                        "options": {
                            "choices": ["warrior", "mage", "rogue", "cleric", "bard"]
                        }
                    },
                    {
                        "name": "name",
                        "type": "text",
                        "label": "Character Name",
                        "defaultValue": "Aragorn",
                        "options": {"multiline": False}
                    },
                    {
                        "name": "age",
                        "type": "integer",
                        "label": "Age",
                        "defaultValue": 25,
                        "options": {"min": 1, "max": 1000}
                    },
                    {
                        "name": "appearance",
                        "type": "text",
                        "label": "Appearance",
                        "defaultValue": "tall and strong",
                        "options": {"multiline": True}
                    },
                    {
                        "name": "personality",
                        "type": "select",
                        "label": "Personality",
                        "defaultValue": "brave",
                        "options": {
                            "choices": ["brave", "cunning", "wise", "charismatic", "mysterious"]
                        }
                    },
                    {
                        "name": "special_abilities",
                        "type": "text",
                        "label": "Special Abilities",
                        "defaultValue": "Expert swordsman",
                        "conditions": [
                            {
                                "parameter": "character_type",
                                "operator": "not_equals",
                                "value": "bard"
                            }
                        ]
                    }
                ]
            },
            "scene": {
                "name": "Scene Template", 
                "text": "A {scene_type} scene set in {location} during {time_of_day}. The atmosphere is {mood} with {lighting} lighting. {weather_condition} {additional_details}",
                "parameters": [
                    {
                        "name": "scene_type",
                        "type": "select",
                        "label": "Scene Type",
                        "defaultValue": "dramatic",
                        "options": {
                            "choices": ["dramatic", "peaceful", "action", "romantic", "mysterious"]
                        }
                    },
                    {
                        "name": "location",
                        "type": "text",
                        "label": "Location",
                        "defaultValue": "ancient forest"
                    },
                    {
                        "name": "time_of_day",
                        "type": "select",
                        "label": "Time of Day",
                        "defaultValue": "sunset",
                        "options": {
                            "choices": ["dawn", "morning", "noon", "afternoon", "sunset", "night", "midnight"]
                        }
                    },
                    {
                        "name": "mood",
                        "type": "select",
                        "label": "Mood",
                        "defaultValue": "serene",
                        "options": {
                            "choices": ["serene", "tense", "joyful", "melancholic", "ominous"]
                        }
                    },
                    {
                        "name": "lighting",
                        "type": "select",
                        "label": "Lighting",
                        "defaultValue": "soft",
                        "options": {
                            "choices": ["soft", "harsh", "dramatic", "natural", "artificial"]
                        }
                    },
                    {
                        "name": "weather_condition",
                        "type": "text",
                        "label": "Weather",
                        "defaultValue": "Clear skies"
                    },
                    {
                        "name": "additional_details",
                        "type": "text",
                        "label": "Additional Details",
                        "defaultValue": "",
                        "options": {"multiline": True}
                    }
                ]
            },
            "style": {
                "name": "Art Style Template",
                "text": "{art_style} style artwork with {color_palette} colors, {composition} composition, {technique} technique. Quality: {quality_level}",
                "parameters": [
                    {
                        "name": "art_style",
                        "type": "select",
                        "label": "Art Style",
                        "defaultValue": "photorealistic",
                        "options": {
                            "choices": ["photorealistic", "digital art", "oil painting", "watercolor", "sketch", "anime", "cartoon"]
                        }
                    },
                    {
                        "name": "color_palette",
                        "type": "select",
                        "label": "Color Palette",
                        "defaultValue": "vibrant",
                        "options": {
                            "choices": ["vibrant", "muted", "monochrome", "warm tones", "cool tones", "pastel"]
                        }
                    },
                    {
                        "name": "composition",
                        "type": "select",
                        "label": "Composition",
                        "defaultValue": "centered",
                        "options": {
                            "choices": ["centered", "rule of thirds", "golden ratio", "dynamic", "symmetrical"]
                        }
                    },
                    {
                        "name": "technique",
                        "type": "text",
                        "label": "Technique",
                        "defaultValue": "highly detailed"
                    },
                    {
                        "name": "quality_level",
                        "type": "select",
                        "label": "Quality",
                        "defaultValue": "masterpiece",
                        "options": {
                            "choices": ["draft", "good", "high quality", "masterpiece", "award winning"]
                        }
                    }
                ]
            },
            "custom": {
                "name": "Custom Template",
                "text": "{custom_prompt}",
                "parameters": [
                    {
                        "name": "custom_prompt",
                        "type": "text",
                        "label": "Custom Prompt",
                        "defaultValue": "Your custom prompt here...",
                        "options": {"multiline": True}
                    }
                ]
            }
        }
        
        return templates
    
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
    
    if template_name in node.templates:
        return web.json_response(node.templates[template_name])
    else:
        return web.json_response({"error": "Template not found"}, status=404)

@PromptServer.instance.routes.get("/api/custom/templates/list")
async def get_template_list(request):
    node = EZPromptsNode()
    templates = [{"name": name, "label": data["name"]} for name, data in node.templates.items()]
    return web.json_response(templates)

# import json
# import os
# import random
# import re
# from typing import Dict, List, Any, Tuple

# class EZPromptsNode:
#     """
#     EZ Prompts - Template-based prompt generation with variable wildcards
#     """
    
#     @classmethod
#     def INPUT_TYPES(cls):
#         # Get available templates
#         templates = cls.get_available_templates()
#         template_names = list(templates.keys()) if templates else ["No templates found"]
        
#         # Core inputs
#         inputs = {
#             "required": {
#                 "template": (template_names, {"default": template_names[0] if template_names else ""}),
#                 "mode": (["Random", "Sequential - Single Variable", "Sequential - All Combinations"], {"default": "Random"}),
#                 "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
#             },
#             "optional": {},
#             "hidden": {"unique_id": "UNIQUE_ID"}
#         }
        
#         return inputs
    
#     RETURN_TYPES = ("STRING", "STRING")
#     RETURN_NAMES = ("generated_prompt", "template_name")
#     FUNCTION = "generate_prompt"
#     CATEGORY = "EZ Prompts"
    
#     @classmethod
#     def get_templates_directory(cls):
#         """Get the templates directory path"""
#         current_dir = os.path.dirname(os.path.realpath(__file__))
#         return os.path.join(current_dir, "templates")
    
#     @classmethod
#     def get_wildcards_directory(cls):
#         """Get the wildcards directory path"""
#         current_dir = os.path.dirname(os.path.realpath(__file__))
#         return os.path.join(current_dir, "wildcards")
    
#     @classmethod
#     def get_available_templates(cls) -> Dict[str, Dict]:
#         """Load all available templates"""
#         templates = {}
#         templates_dir = cls.get_templates_directory()
        
#         if not os.path.exists(templates_dir):
#             return templates
            
#         for filename in os.listdir(templates_dir):
#             if filename.endswith('.json'):
#                 template_path = os.path.join(templates_dir, filename)
#                 try:
#                     with open(template_path, 'r', encoding='utf-8') as f:
#                         template_data = json.load(f)
#                         template_name = template_data.get('name', filename.replace('.json', ''))
#                         templates[template_name] = template_data
#                 except Exception as e:
#                     print(f"Error loading template {filename}: {e}")
                    
#         return templates
    
#     @classmethod
#     def get_wildcard_options(cls, wildcard_file: str) -> List[str]:
#         """Load options from a wildcard file"""
#         wildcards_dir = cls.get_wildcards_directory()
#         wildcard_path = os.path.join(wildcards_dir, wildcard_file)
        
#         if not os.path.exists(wildcard_path):
#             return []
            
#         try:
#             with open(wildcard_path, 'r', encoding='utf-8') as f:
#                 options = [line.strip() for line in f.readlines() if line.strip() and not line.startswith('#')]
#                 return options
#         except Exception as e:
#             print(f"Error loading wildcard file {wildcard_file}: {e}")
#             return []
    
#     @classmethod
#     def get_all_wildcard_data(cls) -> Dict[str, List[str]]:
#         """Get all wildcard data for API endpoint"""
#         wildcards_dir = cls.get_wildcards_directory()
#         wildcard_data = {}
        
#         if not os.path.exists(wildcards_dir):
#             return wildcard_data
            
#         for filename in os.listdir(wildcards_dir):
#             if filename.endswith('.txt'):
#                 wildcard_path = os.path.join(wildcards_dir, filename)
#                 try:
#                     with open(wildcard_path, 'r', encoding='utf-8') as f:
#                         options = [line.strip() for line in f.readlines() if line.strip() and not line.startswith('#')]
#                         wildcard_data[filename] = options
#                 except Exception as e:
#                     print(f"Error loading wildcard file {filename}: {e}")
                    
#         return wildcard_data
    
#     def set_variable_overrides(self, overrides: Dict[str, str]):
#         """Set variable overrides from the UI"""
#         self.variable_overrides = overrides
    
#     def get_variable_overrides(self) -> Dict[str, str]:
#         """Get current variable overrides"""
#         return getattr(self, 'variable_overrides', {})
    
#     def generate_prompt(self, template: str, mode: str, seed: int, unique_id=None, **kwargs) -> Tuple[str, str]:
#         """Generate a prompt using the selected template and parameters"""
        
#         # Load template data
#         templates = self.get_available_templates()
#         if template not in templates:
#             return f"Template '{template}' not found", template
            
#         template_data = templates[template]
#         template_text = template_data.get("template", "")
#         variables = template_data.get("variables", {})
        
#         # Set up random seed
#         random.seed(seed)
        
#         # Process variables and generate values
#         variable_values = {}
#         sequential_state = getattr(self, '_sequential_state', {})
        
#         for var_name, wildcard_file in variables.items():
#             # Check if there's a stored override from the UI
#             widget_value = getattr(self, 'variable_overrides', {}).get(var_name, None)
            
#             if widget_value and widget_value != "🎲 Random":
#                 # Use widget value (set by UI)
#                 variable_values[var_name] = widget_value
#             else:
#                 # Generate value based on mode
#                 options = self.get_wildcard_options(wildcard_file)
#                 if not options:
#                     variable_values[var_name] = f"[{var_name}]"
#                     continue
                
#                 if mode == "Random":
#                     variable_values[var_name] = random.choice(options)
#                 elif mode == "Sequential - Single Variable":
#                     # For MVP, just cycle through the first variable alphabetically
#                     if var_name == sorted(variables.keys())[0]:
#                         state_key = f"{template}_{var_name}_index"
#                         current_index = sequential_state.get(state_key, 0)
#                         variable_values[var_name] = options[current_index % len(options)]
#                         sequential_state[state_key] = current_index + 1
#                     else:
#                         variable_values[var_name] = random.choice(options)
#                 elif mode == "Sequential - All Combinations":
#                     # For MVP, implement basic sequential logic
#                     state_key = f"{template}_combo_index"
#                     combo_index = sequential_state.get(state_key, 0)
                    
#                     # Simple sequential: cycle through each variable in turn
#                     var_index = list(variables.keys()).index(var_name)
#                     option_index = (combo_index + var_index) % len(options)
#                     variable_values[var_name] = options[option_index]
                    
#                     if var_name == list(variables.keys())[-1]:  # Last variable
#                         sequential_state[state_key] = combo_index + 1
        
#         # Store sequential state
#         self._sequential_state = sequential_state
        
#         # Replace variables in template
#         generated_prompt = template_text
#         for var_name, value in variable_values.items():
#             generated_prompt = generated_prompt.replace(f"{{{var_name}}}", value)
        
#         return generated_prompt, template