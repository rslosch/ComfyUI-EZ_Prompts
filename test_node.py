#!/usr/bin/env python3
"""
Test script for EZ Prompts Node
"""

from nodes import EZPromptsNode

def test_node():
    print("Testing EZ Prompts Node...")
    
    # Test template loading
    templates = EZPromptsNode.get_available_templates()
    print(f"Available templates: {list(templates.keys())}")
    
    # Test wildcard loading
    wildcards = EZPromptsNode.get_all_wildcard_data()
    print(f"Available wildcards: {list(wildcards.keys())}")
    
    # Test node instantiation
    node = EZPromptsNode()
    print("Node instantiated successfully")
    
    # Test input types
    input_types = EZPromptsNode.INPUT_TYPES()
    print(f"Input types: {input_types}")
    
    # Test with a sample template
    if templates:
        template_name = list(templates.keys())[0]
        print(f"Testing with template: {template_name}")
        
        # Test prompt generation
        result = node.generate_prompt(
            template=template_name,
            mode="Random",
            seed=42
        )
        print(f"Generated prompt: {result[0]}")
        print(f"Template name: {result[1]}")
    
    print("Test completed successfully!")

if __name__ == "__main__":
    test_node() 