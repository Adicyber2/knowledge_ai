from pydantic import BaseModel, Field


class AIContentResult(BaseModel):

    title: str = Field(
        description=(
            "AI-generated concise knowledge title. Must be 3-8 words. "
            "Capture the actual subject matter. Avoid generic names like "
            "'Article', 'Web Page', 'Google Search', 'Untitled'. "
            "Do NOT simply copy the webpage title."
        )
    )

    summary: str = Field(
        description="Concise 1-3 sentence summary of the actual content"
    )

    category: str = Field(
        default="General",
        description=(
            "Single primary category for this knowledge item. "
            "Examples: 'Frontend Development', 'Backend Development', "
            "'AI & Machine Learning', 'Database', 'DevOps', 'Security', "
            "'Mobile Development', 'General'. Pick the most fitting category."
        )
    )

    tags: list[str] = Field(
        description=(
            "3-8 relevant, normalized tags. Prefer technical concepts. "
            "Each tag should be short (1-3 words). Avoid duplicates."
        )
    )

    topics: list[str] = Field(
        default=[],
        description="2-5 main topics/concepts covered in the content"
    )

    entities: list[str] = Field(
        default=[],
        description=(
            "Key named entities: libraries, frameworks, tools, people, "
            "concepts mentioned in the content"
        )
    )


class RelationshipResult(BaseModel):
    target_knowledge_id: str = Field(description="ID of the related knowledge item")
    relationship_type: str = Field(
        description=(
            "Type of relationship. One of: RELATED_TO, PART_OF, EXTENDS, "
            "SIMILAR_TO, PREREQUISITE_OF, EXPLAINS, USES, ABOUT, DEPENDS_ON, "
            "BUILT_WITH, USED_FOR"
        )
    )
    confidence: float = Field(
        description="Confidence score between 0.0 and 1.0"
    )
    reason: str = Field(
        description="Brief explanation of why this relationship exists"
    )


class RelationshipsResult(BaseModel):
    relationships: list[RelationshipResult] = Field(
        default=[],
        description="List of meaningful relationships found"
    )