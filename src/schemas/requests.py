from typing import Any, Optional, List, Dict
from pydantic import BaseModel, model_validator


class ChatRequest(BaseModel):
    """Request payload for chat endpoint."""
    session_id: Optional[str] = None
    message: str


class FormRequest(BaseModel):
    """Request payload for form/structured submission endpoint."""
    session_id: Optional[str] = None
    # Batch submission flag
    batch: Optional[bool] = False
    resources: Optional[List[Dict[str, Any]]] = None
    # Update fields
    module_name: Optional[str] = None
    updates: Optional[Dict[str, Any]] = None
    current_attributes: Optional[Dict[str, Any]] = None  # Alias for updates from UI
    # Create fields
    resource_type: Optional[str] = None
    resource_name: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def validate_payload(self):
        # Batch mode: validate resources array
        if self.batch and self.resources:
            if not isinstance(self.resources, list) or len(self.resources) == 0:
                raise ValueError("Batch mode requires non-empty resources array")
            return self
        
        # Map current_attributes to updates if present (from UPDATE flow)
        if self.current_attributes is not None and self.updates is None:
            self.updates = self.current_attributes
            self.current_attributes = None
        
        # Single resource mode
        is_update = self.module_name is not None and self.updates is not None
        is_create = (
            self.resource_type is not None
            and self.resource_name is not None
            and self.attributes is not None
        )
        if not is_update and not is_create:
            raise ValueError(
                "Payload must be either an update request "
                "({module_name, updates}) or a create request "
                "({resource_type, resource_name, attributes})."
            )
        if is_update and is_create:
            raise ValueError(
                "Payload must be one of update or create, not both."
            )
        return self


class AgentRequest(BaseModel):
    """Generic agent request payload."""
    user_id: str
    user_query: str
    session_id: Optional[str] = None
    stream: Optional[bool] = False
    thoughts: Optional[bool] = False
    metadata: Optional[Dict[str, Any]] = None
