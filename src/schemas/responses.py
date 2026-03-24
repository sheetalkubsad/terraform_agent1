from typing import Any, Optional, List, Dict
from pydantic import BaseModel, Field


class ThoughtItem(BaseModel):
    """Represents a tool call or response thought."""
    id: str
    agent: str
    tool_name: str
    thought_type: str  # "tool_call" or "tool_response"
    args: Optional[Dict[str, Any]] = None
    response: Optional[Dict[str, Any]] = None
    timestamp: float


class AgentResponse(BaseModel):
    """Response from agent execution."""
    agent_name: str
    session_id: str
