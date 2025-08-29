import torch
import torch.nn.functional as F
import comfy.utils

MAX_RESOLUTION = 8192

class PadImageForOutpaintByAspectRatio:
    """
    A ComfyUI node that prepares images for outpainting by resizing and padding them
    to match standard SDXL aspect ratios while preserving original image content.
    
    The node performs three main operations:
    1. Analyzes the input and target aspect ratios to determine optimal scaling
    2. Scales the image to fit within target dimensions while maintaining proportions
    3. Adds padding strategically to achieve exact target dimensions
    
    The mask output follows the convention:
    - 0 (black) indicates original image content to preserve
    - 1 (white) indicates areas that need to be generated
    - Gradient values indicate feathered transition zones
    """

    @classmethod
    def INPUT_TYPES(s):
        """
        Defines the input interface for the node with support for all standard SDXL 
        aspect ratios and padding options.
        """
        return {
            "required": {
                "image": ("IMAGE",),
                "target_ratio": (
                    [
                        "1:1", "2:3", "3:4", "5:8", "9:16", "9:19", "9:21",
                        "3:2", "4:3", "8:5", "16:9", "19:9", "21:9",
                    ],
                ),
                "padding_position": (
                    ["center", "top/left", "bottom/right"],
                    {"default": "center"}
                ),
                "interpolation": (
                    ["nearest-exact", "bilinear", "bicubic", "area", "lanczos"],
                    {"default": "lanczos"}
                ),
                "feathering": (
                    "INT", 
                    {"default": 0, "min": 0, "max": MAX_RESOLUTION, "step": 1}
                ),
                "multiple_of": (
                    "INT", 
                    {"default": 8, "min": 0, "max": 512, "step": 8}
                )
            }
        }

    RETURN_TYPES = ("IMAGE", "MASK", "INT", "INT")
    RETURN_NAMES = ("image", "mask", "width", "height")
    FUNCTION = "process_image"
    CATEGORY = "EZ Prompts"

    def get_target_dimensions(self, ratio):
        """
        Maps aspect ratio strings to their optimal SDXL pixel dimensions.
        These dimensions are carefully chosen to maintain consistency with SDXL standards.
        """
        ratio_dimensions = {
            "1:1": (1024, 1024),
            "2:3": (832, 1216),
            "3:4": (896, 1152),
            "5:8": (768, 1216),
            "9:16": (768, 1344),
            "9:19": (704, 1472),
            "9:21": (640, 1536),
            "3:2": (1216, 832),
            "4:3": (1152, 896),
            "8:5": (1216, 768),
            "16:9": (1344, 768),
            "19:9": (1472, 704),
            "21:9": (1536, 640)
        }
        return ratio_dimensions.get(ratio, (1024, 1024))

    def calculate_resize_dimensions(self, current_width, current_height, target_width, target_height):
        """
        Calculates optimal dimensions for resizing while maintaining aspect ratio.
        """
        current_ratio = current_width / current_height
        target_ratio = target_width / target_height
        
        # Calculate both possible dimensions
        width_based_height = int(round(target_width / current_ratio))
        height_based_width = int(round(target_height * current_ratio))
        
        # Choose the scaling that best fits within target dimensions
        if width_based_height <= target_height:
            return target_width, width_based_height
        else:
            return height_based_width, target_height

    def process_image(self, image, target_ratio, padding_position, interpolation, feathering, multiple_of):
        """
        Main processing function that handles the image transformation pipeline.
        Creates both a padded image and a mask indicating areas to be generated.
        """
        # Extract dimensions
        batch_size, current_height, current_width, channels = image.shape
        
        # Get target dimensions and adjust for multiple_of constraint
        target_width, target_height = self.get_target_dimensions(target_ratio)
        if multiple_of > 1:
            target_width = target_width - (target_width % multiple_of)
            target_height = target_height - (target_height % multiple_of)
        
        # Calculate resize dimensions
        new_width, new_height = self.calculate_resize_dimensions(
            current_width, current_height, target_width, target_height
        )
        
        # Perform image resize
        resized = image.permute(0, 3, 1, 2)  # BHWC to BCHW
        if interpolation == "lanczos":
            resized = comfy.utils.lanczos(resized, new_width, new_height)
        else:
            resized = F.interpolate(resized, size=(new_height, new_width), mode=interpolation)
        resized = resized.permute(0, 2, 3, 1)  # Back to BHWC
        
        # Create the initial mask for the resized image (zeros for original content)
        mask = torch.zeros((batch_size, 1, new_height, new_width), device=image.device)
        
        # Calculate required padding
        pad_width = target_width - new_width
        pad_height = target_height - new_height
        
        # Initialize padding values
        pad_left = pad_right = pad_top = pad_bottom = 0
        
        # Determine padding distribution based on position and orientation
        is_portrait = target_height > target_width
        
        # Apply padding based on orientation and user choice
        if padding_position == "center":
            pad_left = pad_width // 2
            pad_right = pad_width - pad_left
            pad_top = pad_height // 2
            pad_bottom = pad_height - pad_top
        elif padding_position == "top/left":
            pad_left = pad_width if not is_portrait else 0
            pad_top = pad_height if is_portrait else 0
        else:  # "bottom/right"
            pad_right = pad_width if not is_portrait else 0
            pad_bottom = pad_height if is_portrait else 0

        # Apply padding to image with gray (0.5) values
        padded_image = F.pad(
            resized.permute(0, 3, 1, 2),  # BHWC to BCHW
            (pad_left, pad_right, pad_top, pad_bottom),
            mode='constant',
            value=0.5
        )
        
        # Pad the mask with ones (indicating areas to be generated)
        padded_mask = F.pad(
            mask,
            (pad_left, pad_right, pad_top, pad_bottom),
            mode='constant',
            value=1.0  # White indicates areas to generate
        )
        
        # Apply feathering if requested
        if feathering > 0:
            # Creates a smooth transition from 0 to 1
            def create_feather(size):
                return torch.linspace(0, 1, min(feathering, size), device=image.device)
            
            # Apply feathering to mask edges
            if pad_left > 0:
                # Feather from where padding meets image
                start_idx = pad_left - min(feathering, pad_left)
                edge_feather = create_feather(min(feathering, pad_left)).flip(0)
                padded_mask[:, :, :, start_idx:pad_left] = edge_feather.view(1, 1, 1, -1)
                
            if pad_right > 0:
                # Feather from where padding meets image
                end_idx = padded_mask.shape[3] - pad_right
                edge_feather = create_feather(min(feathering, pad_right))
                padded_mask[:, :, :, end_idx:end_idx + min(feathering, pad_right)] = edge_feather.view(1, 1, 1, -1)
                
            if pad_top > 0:
                # Feather from where padding meets image
                start_idx = pad_top - min(feathering, pad_top)
                edge_feather = create_feather(min(feathering, pad_top)).flip(0)
                padded_mask[:, :, start_idx:pad_top, :] = edge_feather.view(1, 1, -1, 1)
                
            if pad_bottom > 0:
                # Feather from where padding meets image
                end_idx = padded_mask.shape[2] - pad_bottom
                edge_feather = create_feather(min(feathering, pad_bottom))
                padded_mask[:, :, end_idx:end_idx + min(feathering, pad_bottom), :] = edge_feather.view(1, 1, -1, 1)
            
            # Create separate feather mask for the image content
            image_feather_mask = 1 - padded_mask  # Inverse of the generation mask
            
            # Apply feathering to the image (fade to gray in padded areas)
            feathered_image = padded_image * image_feather_mask
            background = torch.ones_like(padded_image) * 0.5  # Gray background
            padded_image = feathered_image + (background * (1 - image_feather_mask))
        
        # Convert image back to BHWC format
        final_image = padded_image.permute(0, 2, 3, 1)
        
        # Prepare the mask for output (ComfyUI expects BHWC format for images and BHW for masks)
        final_mask = padded_mask.squeeze(1)  # Remove the channel dimension to get BHW format
        
        return (final_image, final_mask, final_image.shape[2], final_image.shape[1])