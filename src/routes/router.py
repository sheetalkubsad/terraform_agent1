"""API routes for Terraform Agent."""
import os
import re
import json
import requests
from typing import Optional
from fastapi import APIRouter, HTTPException
from google.genai import types

from src.schemas import ChatRequest, FormRequest
from src.services import handle_chat, handle_form, session_service
from src.services.github_service import _github_headers
from src.shared.settings import get_settings

router = APIRouter()

# Default workflow step explanations
DEFAULT_WORKFLOW_EXPLANATIONS = {
    "Checkout repository": "Cloning the infrastructure repository to workspace",
    "Process Terraform File": "Parsing and validating Terraform configuration files",
    "Setup Terraform": "Installing Terraform CLI and required providers",
    "Set up GCP credentials": "Configuring authentication for GCP resource access",
    "Configure Git for Private Modules": "Setting up SSH keys for private Terraform modules",
    "Terraform Init": "Initializing working directory and downloading providers",
    "Terraform Validate": "Validating configuration syntax and references",
    "Terraform Format Check": "Checking code formatting and style compliance",
    "Terraform Plan": "Creating execution plan and showing resource changes",
    "Create Pull Request": "Opening PR with infrastructure changes for review",
}


def _map_run_step_status(step: dict) -> str:
    """Map GitHub workflow step status to simplified status."""
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


def _find_run_by_dispatch(repo_name: str, token: str, dispatched_at: int):
    """Find workflow run by dispatch timestamp."""
    runs_url = f"https://api.github.com/repos/{repo_name}/actions/runs?event=repository_dispatch&per_page=30"
    runs_resp = requests.get(runs_url, headers=_github_headers(token), timeout=30)
    if runs_resp.status_code != 200:
        return None

    runs = runs_resp.json().get("workflow_runs", [])
    from datetime import datetime
    
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
    """Find the latest dispatch workflow run."""
    runs_url = f"https://api.github.com/repos/{repo_name}/actions/runs?event=repository_dispatch&per_page=1"
    runs_resp = requests.get(runs_url, headers=_github_headers(token), timeout=30)
    if runs_resp.status_code != 200:
        return None
    runs = runs_resp.json().get("workflow_runs", [])
    return runs[0] if runs else None


@router.post("/session")
async def create_session():
    """Create a new conversation session."""
    settings = get_settings()
    session = await session_service.create_session(
        app_name=settings.app_name,
        user_id="user_123"
    )
    return {"session_id": session.id}


@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Conversational chat endpoint with agent thought streaming.
    Streams SSE events with tool calls, tool responses, and agent messages.
    """
    return await handle_chat(
        user_query=request.message,
        user_id="user_123",
        session_id=request.session_id,
        stream=True,
        thoughts=True,
    )


@router.post("/form")
async def form(request: FormRequest):
    """
    Structured form submission endpoint.
    Handles JSON payloads for resource creation/updates.
    """
    print("Received form request:", request)  # Debug log for incoming request
    print("Request resources type:", type(request.resources))
    print("Request resources is list:", isinstance(request.resources, list))
    if hasattr(request.resources, '__dict__'):
        print("Request resources dict:", request.resources.__dict__)
    if hasattr(request.resources, 'keys') and not isinstance(request.resources, list):
        print("Request resources keys:", list(request.resources.keys()))
    # Build the canonical JSON payload
    if request.batch and request.resources:
        # Batch mode: send array of resources
        payload = request.resources
    elif request.module_name is not None:
        # Single update
        payload = {
            "module_name": request.module_name,
            "updates": request.updates,
        }
    else:
        # Single create
        payload = {
            "resource_type": request.resource_type,
            "resource_name": request.resource_name,
            "attributes": request.attributes,
        }
    
    # Ensure payload is converted to JSON string
    message_text = json.dumps(payload, ensure_ascii=False)
    
    # Validate it's a string
    if not isinstance(message_text, str):
        raise ValueError(f"Failed to serialize payload to JSON string: {type(message_text)}")

    return await handle_form(
        user_query=message_text,
        user_id="user_123",
        session_id=request.session_id,
        stream=True,
        thoughts=True,
    )


@router.get("/api/terraform-modules")
async def get_terraform_modules():
    """
    Read main.tf and return available modules with their types.
    """
    try:
        # Get base path
        base_path = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        main_tf_path = os.path.join(base_path, "main.tf")
        
        if not os.path.exists(main_tf_path):
            return {"modules": [], "debug": "main.tf not found"}
        
        with open(main_tf_path, "r") as f:
            content = f.read()
        
        # Parse module blocks
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


@router.get("/api/workflow-status")
async def get_workflow_status(
    repo_name: Optional[str] = None,
    run_id: Optional[int] = None,
    dispatched_at: Optional[int] = None,
):
    """
    Get GitHub Actions workflow status.
    
    Query params:
        repo_name: GitHub repository (defaults to settings)
        run_id: Specific run ID to check
        dispatched_at: Epoch timestamp to find run by dispatch time
    """
    settings = get_settings()
    token = settings.github_token
    repo_name = repo_name or settings.github_repo_name
    print(token, repo_name, run_id, dispatched_at)  # Debug log for input parameters
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

    jobs_url = run_data.get("jobs_url")
    jobs_resp = requests.get(jobs_url, headers=_github_headers(token), timeout=30)
    if jobs_resp.status_code != 200:
        raise HTTPException(status_code=jobs_resp.status_code, detail=jobs_resp.text)

    jobs_data = jobs_resp.json().get("jobs", [])
    steps = []

    for job in jobs_data:
        for step in job.get("steps", []):
            step_name = step.get("name", "Unknown")
            step_status = _map_run_step_status(step)
            step_explanation = DEFAULT_WORKFLOW_EXPLANATIONS.get(step_name, "")

            steps.append({
                "name": step_name,
                "status": step_status,
                "explanation": step_explanation,
            })

    return {
        "ok": True,
        "run_id": resolved_run_id,
        "run_status": run_data.get("status"),
        "run_conclusion": run_data.get("conclusion"),
        "html_url": run_data.get("html_url"),
        "steps": steps,
    }


__all__ = ["router"]
