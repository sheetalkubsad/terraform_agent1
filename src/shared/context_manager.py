import asyncio
from contextvars import ContextVar
from typing import List, Optional, Dict, Any

# ContextVars for managing state across async tasks
AGENT_NAME_VAR: ContextVar[Optional[str]] = ContextVar("agent_name", default=None)
SESSION_ID_VAR: ContextVar[Optional[str]] = ContextVar("session_id", default=None)
USER_ID_VAR: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
STREAM_VAR: ContextVar[bool] = ContextVar("stream", default=False)
THOUGHTS_VAR: ContextVar[bool] = ContextVar("thoughts", default=False)
PARENT_QUEUE_VAR: ContextVar[Optional[asyncio.Queue]] = ContextVar("parent_queue", default=None)
THOUGHTS_LIST_VAR: ContextVar[List[Dict[str, Any]]] = ContextVar("thoughts_list", default=None)
