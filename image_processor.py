"""Image processing utilities for bingo card generation."""

from __future__ import annotations

import io
from typing import BinaryIO

from PIL import Image


def center_crop_to_square(image_bytes: bytes) -> bytes:
    """Center crop an image to a square format.
    
    Args:
        image_bytes: Raw image data as bytes
        
    Returns:
        Cropped square image as bytes
        
    Raises:
        PIL.UnidentifiedImageError: If image format is not supported
        OSError: If image data is corrupted
    """
    # Open the image from bytes
    with Image.open(io.BytesIO(image_bytes)) as img:
        # Convert to RGB if necessary (handles RGBA, P, etc.)
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Get dimensions
        width, height = img.size
        
        # Calculate crop dimensions for center square
        size = min(width, height)
        left = (width - size) // 2
        top = (height - size) // 2
        right = left + size
        bottom = top + size
        
        # Crop to square
        cropped = img.crop((left, top, right, bottom))
        
        # Convert back to bytes
        output = io.BytesIO()
        cropped.save(output, format='JPEG', quality=85, optimize=True)
        return output.getvalue()


def process_image_for_bingo(image_bytes: bytes) -> bytes:
    """Process an image for use in bingo cards.
    
    Currently just center crops to square, but can be extended
    for other processing like resizing, color adjustment, etc.
    
    Args:
        image_bytes: Raw image data as bytes
        
    Returns:
        Processed image as bytes
    """
    return center_crop_to_square(image_bytes)