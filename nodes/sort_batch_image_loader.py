import os
import re
from typing import List, Any, Iterable, Tuple

import torch
import numpy as np
from PIL import Image

import folder_paths
import node_helpers
from comfy.comfy_types.node_typing import IO

# Reuse the existing image processing helper from the training nodes
from comfy_extras.nodes_train import load_and_process_images


def _natural_key(s: str, case_sensitive: bool) -> Tuple[Any, ...]:
    """Key function for natural sorting: splits numbers and text parts."""
    if not case_sensitive:
        s = s.lower()
    return tuple(int(text) if text.isdigit() else text for text in re.split(r"(\d+)", s))


class LoadImageSetNodeSorted:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": (
                    [
                        f
                        for f in os.listdir(folder_paths.get_input_directory())
                        if f.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".jpe", ".apng", ".tif", ".tiff"))
                    ],
                    {"image_upload": True, "allow_batch": True, "tooltip": "Select images to batch load."},
                ),
            },
            "optional": {
                "resize_method": (
                    ["None", "Stretch", "Crop", "Pad"],
                    {"default": "None", "tooltip": "How to handle size differences between selected images."},
                ),
                "sort_order": (
                    ["None", "Ascending", "Descending"],
                    {"default": "Ascending", "tooltip": "Sort images by filename before loading."},
                ),
                "natural_sort": (
                    IO.BOOLEAN,
                    {"default": True, "tooltip": "Use natural sort so img2.png comes before img10.png."},
                ),
                "case_sensitive": (
                    IO.BOOLEAN,
                    {"default": False, "tooltip": "Case-sensitive filename sorting."},
                ),
            },
        }

    # Keep behavior similar to the original node
    INPUT_IS_LIST = True
    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "load_images"
    CATEGORY = "loaders"
    EXPERIMENTAL = True
    DESCRIPTION = "Loads a batch of images, with optional sorting by filename."

    @classmethod
    def VALIDATE_INPUTS(cls, images, resize_method, sort_order="Ascending", natural_sort=True, case_sensitive=False):
        filenames = images[0] if isinstance(images[0], list) else images
        for image in filenames:
            if not folder_paths.exists_annotated_filepath(image):
                return f"Invalid image file: {image}"
        return True

    def load_images(self, input_files, resize_method, sort_order="Ascending", natural_sort=True, case_sensitive=False):
        input_dir = folder_paths.get_input_directory()
        valid_extensions = [".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".jpe", ".apng", ".tif", ".tiff"]

        # Filter valid images
        image_files: List[str] = [
            f for f in input_files
            if any(f.lower().endswith(ext) for ext in valid_extensions)
        ]

        # Apply sorting
        if sort_order != "None":
            reverse = sort_order == "Descending"
            if natural_sort:
                image_files.sort(key=lambda s: _natural_key(s, case_sensitive), reverse=reverse)
            else:
                image_files.sort(key=(None if case_sensitive else str.lower), reverse=reverse)

        # Load and process
        output_tensor = load_and_process_images(image_files, input_dir, resize_method)
        return (output_tensor,)


# Register node
NODE_CLASS_MAPPINGS = {
    "LoadImageSetNodeSorted": LoadImageSetNodeSorted,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LoadImageSetNodeSorted": "Load Image Dataset (Sorted by Filename)",
}