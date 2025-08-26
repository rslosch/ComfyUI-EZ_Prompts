# ComfyUI-EZ_Prompts

A ComfyUI custom node extension that provides easy-to-use prompt templates and wildcards for AI image generation.

## Features

- **Prompt Templates**: Pre-built templates for common image generation scenarios
- **Wildcards**: Dynamic prompt components that can be randomly selected
- **Custom Nodes**: Easy-to-use nodes for ComfyUI workflow integration
- **JavaScript Integration**: Frontend components for template management

## Installation

1. Clone this repository into your ComfyUI `custom_nodes` directory:
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/yourusername/ComfyUI-EZ_Prompts.git
```

2. Install the required dependencies:
```bash
pip install -r requirements.txt
```

3. Restart ComfyUI

## Usage

### Using the Nodes

1. In ComfyUI, look for the "EZ_Prompts" category in the node menu
2. Add the desired prompt template or wildcard nodes to your workflow
3. Connect them to your text generation or prompt nodes

### Templates

The `templates/` directory contains various prompt templates organized by category:
- Character templates
- Style templates
- Scene templates
- And more...

### Wildcards

The `wildcards/` directory contains text files with lists of options that can be randomly selected:
- Character names
- Art styles
- Locations
- Actions
- And more...

## Project Structure

```
ComfyUI-EZ_Prompts/
├── __init__.py          # Node registration
├── nodes.py            # Custom node implementations
├── prompt_templates.js # Frontend JavaScript components
├── requirements.txt    # Python dependencies
├── templates/         # Prompt template files
├── wildcards/         # Wildcard text files
└── README.md         # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Add your license here]

## Support

If you encounter any issues or have questions, please open an issue on GitHub. 