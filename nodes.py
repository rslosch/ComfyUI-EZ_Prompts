import json
import os
import random
import re
from typing import Dict, List, Any, Tuple

class EZPromptsNode:
    """
    EZ Prompts - Template-based prompt generation with variable wildcards
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        # Get available templates
        templates = cls.get_available_templates()
        template_names = list(templates.keys()) if templates else ["No templates found"]
        
        # Only core inputs - variables will be handled dynamically in UI
        inputs = {
            "required": {
                "template": (template_names, {"default": template_names[0] if template_names else ""}),
                "mode": (["Random", "Sequential - Single Variable", "Sequential - All Combinations"], {"default": "Random"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
            },
            "optional": {},
            "hidden": {"unique_id": "UNIQUE_ID"}
        }
        
        return inputs
    
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("generated_prompt", "template_name")
    FUNCTION = "generate_prompt"
    CATEGORY = "EZ Prompts"
    
    @classmethod
    def get_templates_directory(cls):
        """Get the templates directory path"""
        current_dir = os.path.dirname(os.path.realpath(__file__))
        return os.path.join(current_dir, "templates")
    
    @classmethod
    def get_wildcards_directory(cls):
        """Get the wildcards directory path"""
        current_dir = os.path.dirname(os.path.realpath(__file__))
        return os.path.join(current_dir, "wildcards")
    
    @classmethod
    def get_available_templates(cls) -> Dict[str, Dict]:
        """Load all available templates"""
        templates = {}
        templates_dir = cls.get_templates_directory()
        
        if not os.path.exists(templates_dir):
            return templates
            
        for filename in os.listdir(templates_dir):
            if filename.endswith('.json'):
                template_path = os.path.join(templates_dir, filename)
                try:
                    with open(template_path, 'r', encoding='utf-8') as f:
                        template_data = json.load(f)
                        template_name = template_data.get('name', filename.replace('.json', ''))
                        templates[template_name] = template_data
                except Exception as e:
                    print(f"Error loading template {filename}: {e}")
                    
        return templates
    
    @classmethod
    def get_wildcard_options(cls, wildcard_file: str) -> List[str]:
        """Load options from a wildcard file"""
        wildcards_dir = cls.get_wildcards_directory()
        wildcard_path = os.path.join(wildcards_dir, wildcard_file)
        
        if not os.path.exists(wildcard_path):
            return []
            
        try:
            with open(wildcard_path, 'r', encoding='utf-8') as f:
                options = [line.strip() for line in f.readlines() if line.strip() and not line.startswith('#')]
                return options
        except Exception as e:
            print(f"Error loading wildcard file {wildcard_file}: {e}")
            return []
    
    def set_variable_overrides(self, overrides: Dict[str, str]):
        """Set variable overrides from the UI"""
        self._variable_overrides = overrides
    
    def get_variable_overrides(self) -> Dict[str, str]:
        """Get current variable overrides"""
        return getattr(self, '_variable_overrides', {})
    
    def generate_prompt(self, template: str, mode: str, seed: int, unique_id=None, **kwargs) -> Tuple[str, str]:
        """Generate a prompt using the selected template and parameters"""
        
        # Load template data
        templates = self.get_available_templates()
        if template not in templates:
            return f"Template '{template}' not found", template
            
        template_data = templates[template]
        template_text = template_data.get("template", "")
        variables = template_data.get("variables", {})
        
        # Set up random seed
        random.seed(seed)
        
        # Get variable overrides from the node's stored values
        # The UI will set these via the _variable_overrides attribute
        variable_overrides = getattr(self, '_variable_overrides', {})
        
        # Process variables and generate values
        variable_values = {}
        sequential_state = getattr(self, '_sequential_state', {})
        
        for var_name, wildcard_file in variables.items():
            override_value = variable_overrides.get(var_name, "🎲 Random")
            
            if override_value != "🎲 Random":
                # Use overridden value from UI
                variable_values[var_name] = override_value
            else:
                # Generate value based on mode
                options = self.get_wildcard_options(wildcard_file)
                if not options:
                    variable_values[var_name] = f"[{var_name}]"
                    continue
                
                if mode == "Random":
                    variable_values[var_name] = random.choice(options)
                elif mode == "Sequential - Single Variable":
                    # For MVP, just cycle through the first variable alphabetically
                    if var_name == sorted(variables.keys())[0]:
                        state_key = f"{template}_{var_name}_index"
                        current_index = sequential_state.get(state_key, 0)
                        variable_values[var_name] = options[current_index % len(options)]
                        sequential_state[state_key] = current_index + 1
                    else:
                        variable_values[var_name] = random.choice(options)
                elif mode == "Sequential - All Combinations":
                    # For MVP, implement basic sequential logic
                    state_key = f"{template}_combo_index"
                    combo_index = sequential_state.get(state_key, 0)
                    
                    # Simple sequential: cycle through each variable in turn
                    var_index = list(variables.keys()).index(var_name)
                    option_index = (combo_index + var_index) % len(options)
                    variable_values[var_name] = options[option_index]
                    
                    if var_name == list(variables.keys())[-1]:  # Last variable
                        sequential_state[state_key] = combo_index + 1
        
        # Store sequential state
        self._sequential_state = sequential_state
        
        # Replace variables in template
        generated_prompt = template_text
        for var_name, value in variable_values.items():
            generated_prompt = generated_prompt.replace(f"{{{var_name}}}", value)
        
        return generated_prompt, template