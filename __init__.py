"""
EZ Prompts - ComfyUI Template-based Prompt Generation
"""

from .nodes.ez_prompt_node import EZPromptsNode
from .nodes.outpaint_by_aspect_ratio import PadImageForOutpaintByAspectRatio
from .nodes.sort_batch_image_loader import LoadImageSetFromFolderSortedNode

NODE_CLASS_MAPPINGS = {
    "EZPromptsNode": EZPromptsNode,
    "PadImageForOutpaintByAspectRatio": PadImageForOutpaintByAspectRatio,
    "LoadImageSetFromFolderSortedNode": LoadImageSetFromFolderSortedNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EZPromptsNode": "EZ Prompts",
    "PadImageForOutpaintByAspectRatio": "Pad Image for Outpaint by Aspect Ratio",
    "LoadImageSetFromFolderSortedNode": "Load Image Dataset from Folder (Sorted)"
}

WEB_DIRECTORY = "./js"

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']