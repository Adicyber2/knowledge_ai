import os
import base64

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)


def ocr_image(image_base64: str, mime_type: str = "image/jpeg") -> str:
    """
    Use Gemini Vision to extract text from an image (OCR).
    If minimal or no text is found, fallback to describing the visual content/diagram/document.
    Returns the extracted text or description string.
    """

    image_bytes = base64.b64decode(image_base64)

    # 1. Attempt OCR text extraction
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            types.Part.from_bytes(
                data=image_bytes,
                mime_type=mime_type,
            ),
            "Extract all text from this image. Return only the raw extracted text. If no text is present, respond exactly with 'NO_TEXT_FOUND'."
        ]
    )

    text = (response.text or "").strip()

    # 2. Fallback to image description if no raw text was found
    if not text or text == "NO_TEXT_FOUND" or len(text) < 5:
        fallback_response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type,
                ),
                "Describe the contents, visual information, diagrams, or key details in this image so it can be saved as a knowledge entry in a knowledge vault."
            ]
        )
        text = (fallback_response.text or "Visual content from uploaded image.").strip()

    return text
