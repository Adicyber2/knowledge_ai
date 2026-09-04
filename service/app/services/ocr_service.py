from app.services.providers.provider_manager import get_provider_manager


def ocr_image(image_base64: str, mime_type: str = "image/jpeg") -> tuple[str, dict]:
    """
    Extract text or visual information from an image using AI Provider Manager.
    Returns tuple of (extracted_text, provider_metadata).
    """
    provider_mgr = get_provider_manager()
    text, metadata = provider_mgr.ocr_image(
        image_base64=image_base64,
        mime_type=mime_type,
    )
    return text, metadata
