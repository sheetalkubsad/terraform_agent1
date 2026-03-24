"""GitHub service for workflow triggering and module updates."""
import base64
import os
import time
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import requests

from src.shared.settings import get_settings


def _github_headers(token: str) -> Dict[str, str]:
    """Return GitHub API headers with authentication."""
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }


def _iso_to_epoch(iso_value: str) -> int:
    """Convert ISO timestamp to epoch."""
    return int(datetime.fromisoformat(iso_value.replace("Z", "+00:00")).timestamp())


def _find_dispatched_run(repo_name: str, token: str, dispatched_at: int, max_wait_seconds: int = 25):
    """Find workflow run triggered by dispatch event."""
    runs_url = f"https://api.github.com/repos/{repo_name}/actions/runs?event=repository_dispatch&per_page=30"
    deadline = time.time() + max_wait_seconds

    while time.time() < deadline:
        runs_resp = requests.get(runs_url, headers=_github_headers(token), timeout=30)
        if runs_resp.status_code == 200:
            runs = runs_resp.json().get("workflow_runs", [])
            for run in runs:
                created_at = run.get("created_at")
                if not created_at:
                    continue
                created_epoch = _iso_to_epoch(created_at)
                if created_epoch >= dispatched_at - 5:
                    return run
        time.sleep(2)

    return None


def trigger_infra_workflow(repo_name: str, file_content: str, action: str = "", description: str = "") -> Dict[str, Any]:
    """
    Trigger GitHub Actions workflow for infrastructure changes.
    
    Args:
        repo_name: GitHub repository name (owner/repo)
        file_content: Content of the Terraform file
        action: Operation type (append, update, etc.)
        description: Human-readable description of changes
    
    Returns:
        Dictionary with workflow trigger result
    """
    settings = get_settings()
    token = settings.github_token

    dispatched_at = int(time.time())
    url = f"https://api.github.com/repos/{repo_name}/dispatches"

    encoded = base64.b64encode(file_content.encode()).decode()
    payload = {
        "event_type": "create-infra-pr",
        "client_payload": {
            "timestamp": dispatched_at,
            "file_content": encoded,
            "operation": action,
            "description": description or f"Infrastructure {action or 'change'} via Platform AI"
        }
    }

    response = requests.post(url, json=payload, headers=_github_headers(token), timeout=30)

    if response.status_code == 204:
        run = _find_dispatched_run(repo_name, token, dispatched_at)
        return {
            "ok": True,
            "message": "Workflow triggered successfully.",
            "repo": repo_name,
            "dispatched_at": dispatched_at,
            "run_id": run.get("id") if run else None,
            "run_number": run.get("run_number") if run else None,
            "run_html_url": run.get("html_url") if run else None,
            "run_status": run.get("status") if run else None,
        }
    else:
        return {
            "ok": False,
            "message": "Failed to trigger workflow.",
            "repo": repo_name,
            "status_code": response.status_code,
            "error": response.text,
        }


def parse_module_attributes(block_text: str) -> Dict[str, Any]:
    """
    Parse simple key = value pairs inside module block.
    Assumes flat attributes (no nested blocks).
    """
    attributes = {}
    lines = block_text.split("\n")

    for line in lines:
        line = line.strip()

        # Skip module declaration and closing brace
        if line.startswith("module") or line == "}":
            continue

        if "=" in line:
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().rstrip(",")

            # Remove quotes if string
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            # Convert numeric
            elif value.isdigit():
                value = int(value)

            attributes[key] = value

    return attributes


def render_value(value: Any) -> str:
    """Render Python value as HCL value."""
    if isinstance(value, str):
        return f'"{value}"'
    elif isinstance(value, bool):
        return str(value).lower()
    elif isinstance(value, (int, float)):
        return str(value)
    elif isinstance(value, list):
        return "[" + ", ".join(render_value(v) for v in value) + "]"
    elif isinstance(value, dict):
        inner = []
        for k, v in value.items():
            inner.append(f'{k} = {render_value(v)}')
        return "{ " + ", ".join(inner) + " }"
    else:
        return str(value)


def render_module_block(module_name: str, config: Dict[str, Any]) -> str:
    """Render module block as HCL."""
    lines = [f'module "{module_name}" {{']

    for key, value in config.items():
        lines.append(f"  {key} = {render_value(value)}")

    lines.append("}\n")

    return "\n".join(lines)


def update_module_block(repo_name: str, module_name: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    """
    Safely update only one module block inside main.tf
    without touching terraform/provider blocks.
    
    Args:
        repo_name: GitHub repository name
        module_name: Name of the module to update
        updates: Dictionary of fields to update
    
    Returns:
        Dictionary with workflow trigger result
    """
    settings = get_settings()
    token = settings.github_token
    branch = "main"
    file_path = "main.tf"

    # Pull main.tf
    url = f"https://api.github.com/repos/{repo_name}/contents/{file_path}?ref={branch}"
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch main.tf: {response.text}")

    file_data = response.json()
    original_content = base64.b64decode(file_data["content"]).decode("utf-8")

    # Locate module block
    header_pattern = rf'module\s+"{module_name}"\s*{{'
    match = re.search(header_pattern, original_content)

    if not match:
        raise Exception(f"Module '{module_name}' not found")

    start_index = match.start()

    # Brace matching to find end
    depth = 0
    end_index = -1

    for i in range(start_index, len(original_content)):
        if original_content[i] == "{":
            depth += 1
        elif original_content[i] == "}":
            depth -= 1
            if depth == 0:
                end_index = i + 1
                break

    if end_index == -1:
        raise Exception("Failed to determine module block end")

    old_block = original_content[start_index:end_index]

    # Parse existing attributes
    existing_attrs = parse_module_attributes(old_block)

    # Merge updates
    for key, value in updates.items():
        existing_attrs[key] = value

    # Regenerate module block
    new_block = render_module_block(module_name, existing_attrs)

    # Replace only that block
    updated_content = (
        original_content[:start_index] +
        new_block +
        original_content[end_index:]
    )

    # Trigger workflow
    changes = ", ".join([f"{k}: {v}" for k, v in updates.items()])
    description = f"Updated module '{module_name}' - Changed: {changes}"
    
    return trigger_infra_workflow(repo_name, updated_content, "update", description)


__all__ = ["trigger_infra_workflow", "update_module_block"]
