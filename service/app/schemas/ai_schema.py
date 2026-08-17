from pydantic import BaseModel, Field


class AIContentResult(BaseModel):

    summary: str = Field(
        description="Short summary of the content"
    )

    tags: list[str] = Field(
        description="Relevant tags for the content"
    )