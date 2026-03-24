"""Infrastructure agent service."""
from typing import Any, Dict
import json
import asyncio
from fastapi.responses import StreamingResponse
from google.adk.sessions import InMemorySessionService
from google.generativeai import GenerativeModel

from src.agents.infrastructure_agent.agent import root_agent, hcl_writer_agent, module_updater_agent
from src.shared.runner import dispatch_agent
from src.shared.settings import get_settings


# Create a session service instance (reused across requests)
session_service = InMemorySessionService()


async def handle_chat(
    user_query: str,
    user_id: str = "user_123",
    session_id: str = None,
    stream: bool = True,
    thoughts: bool = True,
) -> StreamingResponse:
    """
    Handle conversational chat with the infrastructure agent.
    
    Args:
        user_query: User's input message
        user_id: User identifier
        session_id: Optional session ID for conversation continuity
        stream: Enable SSE streaming
        thoughts: Include tool call/response events
    
    Returns:
        StreamingResponse with SSE events
    """
    settings = get_settings()
    
    return await dispatch_agent(
        agent=root_agent,
        app_name=settings.app_name,
        user_query=user_query,
        user_id=user_id,
        session_service=session_service,
        session_id=session_id,
        stream=stream,
        thoughts=thoughts,
    )


async def handle_form(
    user_query: str,
    user_id: str = "user_123",
    session_id: str = None,
    stream=True,
    thoughts=True,
) -> StreamingResponse:
    """
    Handle structured form submission.
    Routes to specific execution agents based on payload structure.
    """
    settings = get_settings()
    
    # Determine which execution agent to use based on the payload containing module_name
    agent = hcl_writer_agent
    try:
        payload = json.loads(user_query)
        # Check if the payload is an update (dict with "module_name")
        if isinstance(payload, dict) and "module_name" in payload:
            agent = module_updater_agent
    except Exception:
        pass
        
    return await dispatch_agent(
        agent=agent,
        app_name=settings.app_name,
        user_query=user_query,
        user_id=user_id,
        session_service=session_service,
        session_id=session_id,
        stream=True,
        thoughts=True,
    )


__all__ = ["handle_chat", "handle_form", "session_service"]
