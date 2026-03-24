"""
import re
import os
import vertexai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from agents.agent import root_agent
from google.genai import types
from typing import List, Optional, Dict, Any, Union
import base64
import json
import requests
from datetime import datetime
from fastapi.responses import StreamingResponse


load_dotenv()
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
print(PROJECT_ID)
LOCATION = "us-central1"

import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not os.getenv('GITHUB_TOKEN'):
    print("WARNING: GITHUB_TOKEN not found in environment!")
else:
    print(f"✓ GITHUB_TOKEN loaded (length: {len(os.getenv('GITHUB_TOKEN'))})")


if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set. Please set it or create a .env file.")

genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

APP_NAME="PlatformAI"
vertexai.init(project=PROJECT_ID, location=LOCATION)
userid = "user_123"  # This can be dynamic based on your authentication system
session_service = InMemorySessionService()

from pydantic import BaseModel, model_validator

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str

class FormRequest(BaseModel):
    session_id: Optional[str] = None
    # Batch submission flag
    batch: Optional[bool] = False
    resources: Optional[List[Dict[str, Any]]] = None
    # Update fields
    module_name: Optional[str] = None
    updates: Optional[Dict[str, Any]] = None
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

runner = Runner(app_name = APP_NAME ,agent=root_agent ,  session_service=session_service)


def _github_headers(token: str):
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }


def _find_run_by_dispatch(repo_name: str, token: str, dispatched_at: int):
    runs_url = f"https://api.github.com/repos/{repo_name}/actions/runs?event=repository_dispatch&per_page=30"
    runs_resp = requests.get(runs_url, headers=_github_headers(token), timeout=30)
    if runs_resp.status_code != 200:
        return None

    runs = runs_resp.json().get("workflow_runs", [])
    for run in runs:
        created_at = run.get("created_at")
        if not created_at:
            continue
        created_epoch = int(
            datetime.fromisoformat(created_at.replace("Z", "+00:00")).timestamp()
        )
        if created_epoch >= dispatched_at - 10:
            return run
    return None


def _find_latest_dispatch_run(repo_name: str, token: str):
    runs_url = f"https://api.github.com/repos/{repo_name}/actions/runs?event=repository_dispatch&per_page=1"
    runs_resp = requests.get(runs_url, headers=_github_headers(token), timeout=30)
    print(runs_resp.json())
    if runs_resp.status_code != 200:
        return None
    runs = runs_resp.json().get("workflow_runs", [])
    return runs[0] if runs else None


def _map_run_step_status(step: dict):
    status = step.get("status")
    conclusion = step.get("conclusion")
    if status == "completed":
        if conclusion == "success":
            return "completed"
        if conclusion in {"failure", "timed_out", "cancelled", "action_required"}:
            return "failed"
        return "completed"
    if status in {"in_progress", "queued", "pending", "waiting"}:
        return "running"
    return "pending"


def _extract_editable_json_candidate(value: Any) -> Optional[Dict[str, Any]]:
    def _is_editable_payload(payload: Any) -> bool:
        return isinstance(payload, dict) and (
            "resource_type" in payload or "module_name" in payload
        )

    def _extract_balanced_json_object(text: str) -> Optional[Dict[str, Any]]:
        if not text:
            return None

        start_indices = [i for i, char in enumerate(text) if char == "{"]
        for start in start_indices:
            depth = 0
            in_string = False
            escaped = False
            for index in range(start, len(text)):
                char = text[index]
                if in_string:
                    if escaped:
                        escaped = False
                    elif char == "\\":
                        escaped = True
                    elif char == '"':
                        in_string = False
                    continue

                if char == '"':
                    in_string = True
                elif char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        candidate = text[start:index + 1]
                        try:
                            parsed = json.loads(candidate)
                            if _is_editable_payload(parsed):
                                return parsed
                        except (json.JSONDecodeError, ValueError, TypeError):
                            break
        return None

    def _extract_from_string(text: str) -> Optional[Dict[str, Any]]:
        raw = text.strip()
        if not raw:
            return None

        try:
            parsed = json.loads(raw)
            if _is_editable_payload(parsed):
                return parsed
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

        fenced_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, flags=re.IGNORECASE)
        if fenced_match:
            fenced_payload = _extract_from_string(fenced_match.group(1))
            if fenced_payload is not None:
                return fenced_payload

        return _extract_balanced_json_object(raw)

    if _is_editable_payload(value):
        return value

    if isinstance(value, str):
        return _extract_from_string(value)

    if isinstance(value, dict):
        for key in ("result", "output", "data", "response", "text"):
            nested = value.get(key)
            if nested is None:
                continue
            nested_payload = _extract_editable_json_candidate(nested)
            if nested_payload is not None:
                return nested_payload

        for nested_value in value.values():
            nested_payload = _extract_editable_json_candidate(nested_value)
            if nested_payload is not None:
                return nested_payload

    if isinstance(value, list):
        for item in value:
            nested_payload = _extract_editable_json_candidate(item)
            if nested_payload is not None:
                return nested_payload

    return None


def _extract_all_editable_jsons(value: Any) -> List[Dict[str, Any]]:
    
    def _is_editable_payload(payload: Any) -> bool:
        return isinstance(payload, dict) and (
            "resource_type" in payload or "module_name" in payload
        )
    
    results = []
    
    # If value is a string, try to parse it
    if isinstance(value, str):
        text = value.strip()
        
        # Try parsing as JSON first
        try:
            parsed = json.loads(text)
            # Check if it's an array of resources
            if isinstance(parsed, list):
                for item in parsed:
                    if _is_editable_payload(item):
                        results.append(item)
                if results:
                    return results
            # Check if it's a single resource
            elif _is_editable_payload(parsed):
                return [parsed]
        except (json.JSONDecodeError, ValueError, TypeError):
            pass
        
        # Try extracting from code fence
        fenced_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, flags=re.IGNORECASE)
        if fenced_match:
            extracted = _extract_all_editable_jsons(fenced_match.group(1))
            if extracted:
                return extracted
        
        # Try finding all balanced JSON objects in the text
        start_indices = [i for i, char in enumerate(text) if char == "{" or char == "["]
        for start in start_indices:
            if text[start] == "[":
                # Try to extract array
                depth = 0
                in_string = False
                escaped = False
                for index in range(start, len(text)):
                    char = text[index]
                    if in_string:
                        if escaped:
                            escaped = False
                        elif char == "\\":
                            escaped = True
                        elif char == '"':
                            in_string = False
                        continue
                    if char == '"':
                        in_string = True
                    elif char in "[{":
                        depth += 1
                    elif char in "]}":
                        depth -= 1
                        if depth == 0:
                            try:
                                parsed = json.loads(text[start:index + 1])
                                if isinstance(parsed, list):
                                    for item in parsed:
                                        if _is_editable_payload(item):
                                            results.append(item)
                                    if results:
                                        return results
                            except (json.JSONDecodeError, ValueError, TypeError):
                                break
            elif text[start] == "{":
                # Try to extract single object
                depth = 0
                in_string = False
                escaped = False
                for index in range(start, len(text)):
                    char = text[index]
                    if in_string:
                        if escaped:
                            escaped = False
                        elif char == "\\":
                            escaped = True
                        elif char == '"':
                            in_string = False
                        continue
                    if char == '"':
                        in_string = True
                    elif char == "{":
                        depth += 1
                    elif char == "}":
                        depth -= 1
                        if depth == 0:
                            try:
                                parsed = json.loads(text[start:index + 1])
                                if _is_editable_payload(parsed):
                                    results.append(parsed)
                            except (json.JSONDecodeError, ValueError, TypeError):
                                break
    
    # If value is already a list, check each item
    elif isinstance(value, list):
        for item in value:
            if _is_editable_payload(item):
                results.append(item)
            else:
                # Recursively extract from nested structures
                nested = _extract_all_editable_jsons(item)
                results.extend(nested)
    
    # If value is a dict, check if it's editable or search nested values
    elif isinstance(value, dict):
        if _is_editable_payload(value):
            return [value]
        
        for key in ("result", "output", "data", "response", "text"):
            nested = value.get(key)
            if nested is not None:
                extracted = _extract_all_editable_jsons(nested)
                if extracted:
                    results.extend(extracted)
        
        if not results:
            for nested_value in value.values():
                extracted = _extract_all_editable_jsons(nested_value)
                results.extend(extracted)
    
    return results

@app.post("/session")
async def create_session():
    session = await session_service.create_session(
        app_name=APP_NAME,
        user_id=userid
    )
    return {"session_id": session.id}

@app.post("/chat")
async def chat(request: ChatRequest):

    user = userid

    # Create session if not provided
    if not request.session_id:
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=user
        )
        session_id = session.id
    else:
        session_id = request.session_id

    new_message = types.Content(
        role="user",
        parts=[types.Part(text=request.message)]
    )

    async def event_generator():
        try:
            async for event in runner.run_async(
                user_id=user,
                new_message=new_message,
                session_id=session_id
            ):

                agent_name = getattr(event, "author", "unknown")
                
                # Debug: Print event details
                print(f"Event from: {agent_name}, is_final: {event.is_final_response()}")
                print(f"  Event type: {type(event).__name__}")
                print(f"  Has content: {bool(event.content)}")
                if event.content:
                    print(f"  Parts count: {len(event.content.parts) if event.content.parts else 0}")

                # Check if this is a tool call event
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        # Check for function call (tool invocation)
                        if hasattr(part, 'function_call') and part.function_call:
                            tool_name = part.function_call.name
                            print(f"Tool call detected: {tool_name}")
                            yield f"data: {json.dumps({
                                'session_id': session_id,
                                'agent': agent_name,
                                'text': f'Calling tool: {tool_name}',
                                'is_final': False,
                                'type': 'tool_call'
                            })}\n\n"
                        
                        # Check for function response (tool result)
                        if hasattr(part, 'function_response') and part.function_response:
                            tool_name = part.function_response.name
                            tool_response = part.function_response.response
                            print(f"Tool response from: {tool_name}")
                            
                            if isinstance(tool_response, dict):
                                response_text = json.dumps(tool_response)
                            else:
                                response_text = str(tool_response) if tool_response else ""
                            
                            # Detect editable JSON(s) from intent/infra checker tools
                            editable_payloads = _extract_all_editable_jsons(tool_response)
                            
                            if editable_payloads:
                                # Send each editable JSON separately
                                for editable_payload in editable_payloads:
                                    yield f"data: {json.dumps({
                                        'session_id': session_id,
                                        'agent': tool_name,
                                        'text': json.dumps(editable_payload),
                                        'is_final': False,
                                        'type': 'editable_json',
                                        'editable': True
                                    })}\n\n"
                            else:
                                # Normal tool response
                                yield f"data: {json.dumps({
                                    'session_id': session_id,
                                    'agent': tool_name,
                                    'text': response_text,
                                    'is_final': False,
                                    'type': 'tool_response',
                                    'editable': False
                                })}\n\n"

                chunk_text = ""
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if getattr(part, "text", None):
                            chunk_text += part.text

                if chunk_text:
                    is_final = event.is_final_response()
                    print(f"Sending text from {agent_name}: {chunk_text[:50]}...")
                    
                    # Detect editable JSON(s) from specific agents
                    editable_payloads = _extract_all_editable_jsons(chunk_text)
                    
                    if editable_payloads:
                        # Send each editable JSON separately
                        for editable_payload in editable_payloads:
                            data = {
                                'session_id': session_id,
                                'agent': agent_name,
                                'text': json.dumps(editable_payload),
                                'is_final': is_final,
                                'type': 'editable_json',
                                'editable': True
                            }
                            yield f"data: {json.dumps(data)}\n\n"
                    else:
                        # Normal response text
                        event_type = 'response' if is_final else 'thinking'
                        data = {
                            'session_id': session_id,
                            'agent': agent_name,
                            'text': chunk_text,
                            'is_final': is_final,
                            'type': event_type,
                            'editable': False
                        }
                        yield f"data: {json.dumps(data)}\n\n"

        except Exception as e:
            err_data = {'error': str(e), 'session_id': session_id}
            yield f"data: {json.dumps(err_data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/terraform-modules")
async def get_terraform_modules():
    
    try:
        main_tf_path = os.path.join(os.path.dirname(__file__), "main.tf")
        
        if not os.path.exists(main_tf_path):
            return {"modules": [], "debug": "main.tf not found"}
        
        with open(main_tf_path, "r") as f:
            content = f.read()
        
        # Parse module blocks more robustly
        # Pattern: module "name" { ... }
        module_pattern = r'module\s+"([^"]+)"\s*\{([\s\S]*?)(?=\n\}|\})'
        modules = []
        
        for match in re.finditer(module_pattern, content):
            module_name = match.group(1)
            module_body = match.group(2)
            
            # Detect module type from source or variable references
            module_type = "unknown"
            body_lower = module_body.lower()
            
            if "cloud-run" in body_lower or "cloud_run_service" in body_lower:
                module_type = "cloud_run_service"
            elif "bigquery" in body_lower:
                module_type = "bigquery_dataset"
            elif "iam" in body_lower:
                module_type = "cloud_run_service_iam"
            
            modules.append({
                "name": module_name,
                "type": module_type
            })
        
        return {"modules": modules, "debug": f"Found {len(modules)} modules"}
    
    except Exception as e:
        return {"modules": [], "error": str(e), "debug": "Exception occurred"}


@app.post("/form")
async def form(request: FormRequest):

    user = userid

    if not request.session_id:
        session = await session_service.create_session(
            app_name=APP_NAME,
            user_id=user
        )
        session_id = session.id
    else:
        session_id = request.session_id

    # Build the canonical JSON payload
    if request.batch and request.resources:
        # Batch mode: send array of resources
        payload = request.resources
        message_text = json.dumps(payload)
    elif request.module_name is not None:
        # Single update
        payload = {
            "module_name": request.module_name,
            "updates": request.updates,
        }
        message_text = json.dumps(payload)
    else:
        # Single create
        payload = {
            "resource_type": request.resource_type,
            "resource_name": request.resource_name,
            "attributes": request.attributes,
        }
        message_text = json.dumps(payload)

    new_message = types.Content(
        role="user",
        parts=[types.Part(text=message_text)]
    )

    async def event_generator():
        try:
            async for event in runner.run_async(
                user_id=user,
                new_message=new_message,
                session_id=session_id
            ):

                agent_name = getattr(event, "author", "unknown")

                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, 'function_call') and part.function_call:
                            tool_name = part.function_call.name
                            yield f"data: {json.dumps({
                                'session_id': session_id,
                                'agent': agent_name,
                                'text': f'Calling tool: {tool_name}',
                                'is_final': False,
                                'type': 'tool_call'
                            })}\n\n"

                        if hasattr(part, 'function_response') and part.function_response:
                            tool_name = part.function_response.name
                            tool_response = part.function_response.response
                            if isinstance(tool_response, dict):
                                response_text = json.dumps(tool_response)
                            else:
                                response_text = str(tool_response) if tool_response else ""

                            yield f"data: {json.dumps({
                                'session_id': session_id,
                                'agent': tool_name,
                                'text': response_text,
                                'is_final': False,
                                'type': 'tool_response'
                            })}\n\n"

                chunk_text = ""
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if getattr(part, "text", None):
                            chunk_text += part.text

                if chunk_text:
                    is_final = event.is_final_response()
                    data = {
                        'session_id': session_id,
                        'agent': agent_name,
                        'text': chunk_text,
                        'is_final': is_final,
                        'type': 'response' if is_final else 'thinking'
                    }
                    yield f"data: {json.dumps(data)}\n\n"

        except Exception as e:
            err_data = {'error': str(e), 'session_id': session_id}
            yield f"data: {json.dumps(err_data)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/workflow-status")
async def get_workflow_status(
    repo_name: str = "sheetalkubsad/terraform_agent1",
    run_id: Optional[int] = None,
    dispatched_at: Optional[int] = None,
):
    
     # ADD THIS:
    print(f"🔍 Getting workflow status for repo: {repo_name}, run_id: {run_id}, dispatched_at: {dispatched_at}")
   
    
    token = "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"
    if not token:
        raise HTTPException(status_code=500, detail="GITHUB_TOKEN not configured")

    resolved_run_id = run_id
    if resolved_run_id is None and dispatched_at is not None:
        run = _find_run_by_dispatch(repo_name, token, dispatched_at)
        if run:
            resolved_run_id = run.get("id")

    if resolved_run_id is None:
        latest_run = _find_latest_dispatch_run(repo_name, token)
        if latest_run:
            resolved_run_id = latest_run.get("id")

    if resolved_run_id is None:
        return {
            "ok": True,
            "run_id": None,
            "run_status": "pending",
            "run_conclusion": None,
            "steps": [],
        }

    run_url = f"https://api.github.com/repos/{repo_name}/actions/runs/{resolved_run_id}"
    run_resp = requests.get(run_url, headers=_github_headers(token), timeout=30)
    if run_resp.status_code != 200:
        raise HTTPException(status_code=run_resp.status_code, detail=run_resp.text)
    run_data = run_resp.json()

    jobs_url = f"https://api.github.com/repos/{repo_name}/actions/runs/{resolved_run_id}/jobs?per_page=100"
    jobs_resp = requests.get(jobs_url, headers=_github_headers(token), timeout=30)
    if jobs_resp.status_code != 200:
        raise HTTPException(status_code=jobs_resp.status_code, detail=jobs_resp.text)
    jobs_data = jobs_resp.json().get("jobs", [])

    steps = []
    for job in jobs_data:
        for step in job.get("steps", []):
            steps.append(
                {
                    "name": step.get("name", "Unnamed step"),
                    "status": _map_run_step_status(step),
                    "raw_status": step.get("status"),
                    "conclusion": step.get("conclusion"),
                    "number": step.get("number"),
                }
            )

    print(f"📊 Returning workflow status: run_id={resolved_run_id}, status={run_data.get('status')}, {len(steps)} steps")
    print(f"📊 First 3 steps: {steps[:3] if len(steps) > 0 else 'no steps'}")
    
    return {
        "ok": True,
        "repo": repo_name,
        "run_id": resolved_run_id,
        "run_status": run_data.get("status"),
        "run_conclusion": run_data.get("conclusion"),
        "run_html_url": run_data.get("html_url"),
        "steps": steps,
    }

"""