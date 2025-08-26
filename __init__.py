"""
EZ Prompts - ComfyUI Template-based Prompt Generation
"""

from .nodes import EZPromptsNode

NODE_CLASS_MAPPINGS = {
    "EZPromptsNode": EZPromptsNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EZPromptsNode": "EZ Prompts"
}

WEB_DIRECTORY = "./js"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']