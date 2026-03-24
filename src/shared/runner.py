import asyncio
import json
import time
import logging
from typing import Any, Dict, Optional, List
from fastapi.responses import StreamingResponse
from google.adk.runners import Runner
from google.adk.agents import Agent
from google.adk.sessions import InMemorySessionService, Session
from google.genai.types import Content, Part

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

from src.shared.context_manager import (
    AGENT_NAME_VAR,
    SESSION_ID_VAR,
    USER_ID_VAR,
    STREAM_VAR,
    THOUGHTS_VAR,
    PARENT_QUEUE_VAR,
    THOUGHTS_LIST_VAR,
)


async def _get_or_create_session(
    app_name: str,
    user_id: str,
    session_service: InMemorySessionService,
    session_id: Optional[str] = None,
) -> Session:
    """Gets a session if it exists, otherwise creates a new one."""
    session = None
    if session_id:
        try:
            session = await session_service.get_session(
                app_name=app_name, user_id=user_id, session_id=session_id
            )
        except:
            pass

    if not session:
        session = await session_service.create_session(
            app_name=app_name,
            user_id=user_id,
        )
    return session


async def _extract_editable_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract editable JSON from agent response."""
    import re
    
    def _is_editable_payload(payload: Any) -> bool:
        has_resource_type = isinstance(payload, dict) and "resource_type" in payload
        has_module_name = isinstance(payload, dict) and "module_name" in payload
        logger.debug(f"   Payload check: is_dict={isinstance(payload, dict)}, has_resource_type={has_resource_type}, has_module_name={has_module_name}")
        return has_resource_type or has_module_name
    
    # Try direct JSON parse
    try:
        parsed = json.loads(text.strip())
        logger.debug(f"   Direct JSON parse succeeded: type={type(parsed)}")
        
        # Handle ADK AgentTool wrapper: `{"result": "{...}"}`
        if isinstance(parsed, dict) and "result" in parsed and isinstance(parsed["result"], str):
            logger.debug(f"   Found ADK tool wrapper, unwrapping 'result' field...")
            nested_parsed = json.loads(parsed["result"].strip())
            if _is_editable_payload(nested_parsed):
                logger.info(f"   ✅ Found editable payload inside ADK result wrapper")
                return nested_parsed
            if isinstance(nested_parsed, list) and len(nested_parsed) > 0:
                logger.info(f"   ✅ Found array of resources inside ADK result wrapper")
                return nested_parsed
                
        if _is_editable_payload(parsed):
            logger.info(f"   ✅ Found editable payload via direct parse")
            return parsed
        if isinstance(parsed, list) and len(parsed) > 0:
            logger.info(f"   ✅ Found array of resources via direct parse")
            return parsed  # Return array of resources
        logger.debug(f"   Direct parse succeeded but not editable payload")
    except Exception as e:
        logger.debug(f"   Direct JSON parse failed: {e}")
    
    # Try extracting from code fence
    fenced_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
    if fenced_match:
        logger.debug(f"   Found code fence, attempting to parse...")
        try:
            parsed = json.loads(fenced_match.group(1).strip())
            logger.debug(f"   Code fence JSON parse succeeded: type={type(parsed)}")
            if _is_editable_payload(parsed) or isinstance(parsed, list):
                logger.info(f"   ✅ Found editable payload via code fence")
                return parsed
            logger.debug(f"   Code fence parse succeeded but not editable payload")
        except Exception as e:
            logger.debug(f"   Code fence JSON parse failed: {e}")
    else:
        logger.debug(f"   No code fence found in text")
    
    logger.debug(f"   No editable JSON found")
    return None


async def dispatch_agent(
    agent: Agent,
    app_name: str,
    user_query: str,
    user_id: str,
    session_service: InMemorySessionService,
    session_id: Optional[str] = None,
    stream: bool = False,
    thoughts: bool = False,
) -> StreamingResponse:
    """
    Dispatches agent execution with streaming and thought support.
    
    Args:
        agent: The ADK agent to execute
        app_name: Application name for session management
        user_query: User's input query
        user_id: User identifier
        session_service: Session service for managing conversation state
        session_id: Optional existing session ID
        stream: Whether to stream responses
        thoughts: Whether to include tool call/response thoughts
    
    Returns:
        StreamingResponse with SSE events
    """
    # Get or create session
    session = await _get_or_create_session(app_name, user_id, session_service, session_id)
    
    # Set context variables
    AGENT_NAME_VAR.set(app_name)
    SESSION_ID_VAR.set(session.id)
    USER_ID_VAR.set(user_id)
    STREAM_VAR.set(stream)
    THOUGHTS_VAR.set(thoughts)
    
    # Create runner
    runner = Runner(
        app_name=app_name,
        agent=agent,
        session_service=session_service
    )
    
    # Ensure user_query is a string
    if not isinstance(user_query, str):
        # If it's a dict or list, convert to JSON string
        if isinstance(user_query, (dict, list)):
            user_query = json.dumps(user_query, ensure_ascii=False)
        else:
            user_query = str(user_query)
    
    # Create user message
    user_msg = Content(parts=[Part(text=user_query)], role="user")
    
    async def event_generator():
        """Generate SSE events from agent execution."""
        logger.info(f"🚀 Starting agent execution - Agent: {agent.name}, Session: {session.id}")
        logger.info(f"📝 User query: {user_query[:100]}..." if len(user_query) > 100 else f"📝 User query: {user_query}")
        
        try:
            event_count = 0
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session.id,
                new_message=user_msg
            ):
                event_count += 1
                agent_name = getattr(event, "author", "unknown")
                logger.debug(f"📦 Event #{event_count} from agent: {agent_name}")
                
                # Handle thought streaming (tool calls/responses)
                if thoughts and event.content and event.content.parts:
                    for part in event.content.parts:
                        # Tool call thought
                        if hasattr(part, 'function_call') and part.function_call:
                            tool_name = part.function_call.name
                            tool_args = dict(part.function_call.args) if part.function_call.args else {}
                            
                            logger.info(f"🔧 Tool call: {agent_name} → {tool_name}")
                            logger.debug(f"   Args: {json.dumps(tool_args, default=str)[:200]}")
                            
                            thought_data = {
                                'session_id': session.id,
                                'agent': agent_name,
                                'tool_name': tool_name,
                                'text': f"Calling {tool_name}",
                                'type': 'tool_call',
                                'args': tool_args,
                                'timestamp': time.time()
                            }
                            yield f"data: {json.dumps(thought_data)}\n\n"
                        
                        # Tool response thought
                        if hasattr(part, 'function_response') and part.function_response:
                            tool_name = part.function_response.name
                            tool_response = part.function_response.response
                            
                            if isinstance(tool_response, dict):
                                response_text = json.dumps(tool_response)
                            else:
                                response_text = str(tool_response) if tool_response else ""
                            
                            logger.info(f"✅ Tool response: {tool_name} returned {len(response_text)} chars")
                            logger.debug(f"   Response preview: {response_text[:200]}..." if len(response_text) > 200 else f"   Response: {response_text}")
                            
                            # Check if tool response contains editable JSON
                            logger.info(f"🔍 Checking if {tool_name} response contains editable JSON...")
                            editable_json = await _extract_editable_json(response_text)
                            
                            if editable_json:
                                # Tool returned editable JSON - send as editable_json event
                                logger.info(f"📋 Tool {tool_name} returned editable JSON!")
                                logger.info(f"   JSON type: {type(editable_json)}, is_list: {isinstance(editable_json, list)}")
                                thought_data = {
                                    'session_id': session.id,
                                    'agent': tool_name,
                                    'text': json.dumps(editable_json, ensure_ascii=False) if isinstance(editable_json, (dict, list)) else response_text,
                                    'type': 'editable_json',
                                    'editable': True,
                                    'timestamp': time.time()
                                }
                                yield f"data: {json.dumps(thought_data)}\n\n"
                                
                                # SHORT-CIRCUIT: UI has exactly what it needs.
                                # No need to waste time/tokens having root_agent summarize it!
                                logger.info("🛑 Short-circuiting! Form generated directly from tool. Ending stream.")
                                return
                            else:
                                # Regular tool response
                                logger.info(f"❌ No editable JSON detected in {tool_name} response")
                                logger.debug(f"   First 300 chars: {response_text[:300]}")
                                # Truncate very long responses for UI display
                                display_text = response_text[:500] + "..." if len(response_text) > 500 else response_text
                                
                                thought_data = {
                                    'session_id': session.id,
                                    'agent': tool_name,
                                    'text': display_text,
                                    'type': 'tool_response',
                                    'timestamp': time.time()
                                }
                            
                            yield f"data: {json.dumps(thought_data)}\n\n"
                
                # Handle text responses
                chunk_text = ""
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if getattr(part, "text", None):
                            chunk_text += part.text
                
                if chunk_text:
                    is_final = event.is_final_response()
                    
                    logger.info(f"💬 {agent_name} text response: {len(chunk_text)} chars, is_final={is_final}")
                    logger.debug(f"   Text preview: {chunk_text[:150]}..." if len(chunk_text) > 150 else f"   Text: {chunk_text}")
                    
                    # Try to extract editable JSON from final responses (for both tool and agent responses)
                    editable_json = None
                    if is_final:
                        logger.info(f"🔍 Attempting JSON extraction from {agent_name} (is_final=True)")
                        editable_json = await _extract_editable_json(chunk_text)
                        if editable_json:
                            logger.info(f"📋 Extracted editable JSON from {agent_name}")
                        else:
                            logger.info(f"❌ No editable JSON found in {agent_name} response")
                    
                    # Determine event type and prepare data
                    if editable_json is not None:
                        event_type = 'editable_json'
                        # For editable JSON events, send the extracted/parsed JSON, not the raw text
                        logger.info(f"📋 Sending extracted editable JSON from {agent_name}: type={type(editable_json)}, is_list={isinstance(editable_json, list)}")
                        data = {
                            'session_id': session.id,
                            'agent': agent_name,
                            'text': json.dumps(editable_json, ensure_ascii=False),  # Send parsed JSON as string
                            'is_final': is_final,
                            'type': event_type,
                            'editable': True
                        }
                    else:
                        event_type = 'response' if is_final else 'thinking'
                        data = {
                            'session_id': session.id,
                            'agent': agent_name,
                            'text': chunk_text,
                            'is_final': is_final,
                            'type': event_type,
                            'editable': False
                        }
                    
                    yield f"data: {json.dumps(data, default=str)}\n\n"
        
            logger.info(f"✅ Agent execution completed - Total events: {event_count}")
        
        except Exception as e:
            logger.error(f"❌ Agent execution error: {str(e)}", exc_info=True)
            err_data = {'error': str(e), 'session_id': session.id}
            yield f"data: {json.dumps(err_data)}\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
