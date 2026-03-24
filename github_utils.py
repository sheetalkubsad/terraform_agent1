import base64
import os
import time
from datetime import datetime, timezone

import requests


def _github_headers(token: str):
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }


def _iso_to_epoch(iso_value: str) -> int:
    return int(datetime.fromisoformat(iso_value.replace("Z", "+00:00")).timestamp())


def _find_dispatched_run(repo_name: str, token: str, dispatched_at: int, max_wait_seconds: int = 25):
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

def trigger_infra_workflow(repo_name, file_content , action="", description=""):
    token = "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"

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
        print(run.get("html_url"))
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
    

import re
import os
import requests
import base64

# def update_existing_module(module_name, updates):
#     """
#     1. Pulls main.tf from GitHub
#     2. Surgically updates specific fields
#     3. Triggers the CI/CD workflow
#     """
#     repo_name = "sheetalkubsad/terraform_agent1"
#     github_token = "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"
#     branch = "main"
#     file_path = "main.tf"
#     print(f"Updating {module_name} with {updates}")

#     # --- STEP 1: PULL THE MAIN FILE HERE ---
#     url = f"https://api.github.com/repos/{repo_name}/contents/{file_path}?ref={branch}"
#     headers = {"Authorization": f"Bearer {github_token}"}
    
#     response = requests.get(url, headers=headers)
#     if response.status_code != 200:
#         raise Exception(f"Failed to fetch main.tf: {response.text}")
    
#     file_data = response.json()
#     # Decode content from Base64
#     main_tf_content = base64.b64decode(file_data['content']).decode('utf-8')

#     # --- STEP 2: SURGICAL UPDATE LOGIC ---
#     # Find the start of the module block
#     header_pattern = rf'module\s+"{module_name}"\s+{{'
#     match = re.search(header_pattern, main_tf_content)
    
#     if not match:
#         return f"Error: Module {module_name} not found in main.tf"

#     start_index = match.start()
    
#     # Brace counting to find the true end of the block (handles nested blocks)
#     depth = 0
#     end_index = -1
#     for i in range(start_index, len(main_tf_content)):
#         if main_tf_content[i] == '{':
#             depth += 1
#         elif main_tf_content[i] == '}':
#             depth -= 1
#             if depth == 0:
#                 end_index = i + 1
#                 break
    
#     resource_block = main_tf_content[start_index:end_index]
#     updated_block = resource_block

#     for key, value in updates.items():
#         # Handle different HCL types
#         if isinstance(value, bool):
#             val_str = str(value).lower()
#         elif isinstance(value, (int, float)):
#             val_str = str(value)
#         else:
#             val_str = f'"{value}"'

#     # Regex to find the key and replace its value inside the block
#     # This matches: key = "old_value" or key = old_value
#         attr_pattern = rf'(^\s*{key}\s*=\s*)(.*)$'
#         new_line = rf'\g<1>{val_str}'
    
#     # Use re.MULTILINE to find the key at the start of lines inside the block
#         new_updated_block, count = re.subn(attr_pattern, new_line, updated_block, flags=re.MULTILINE)

#         if count > 0:
#             updated_block = new_updated_block
#         else:
#         # If key doesn't exist, insert it before the last closing brace
#             last_brace_idx = updated_block.rfind('}')
#             updated_block = updated_block[:last_brace_idx] + f'  {key} = {val_str}\n' + updated_block[last_brace_idx:]

#     # Reconstruct the whole file
#     updated_content = main_tf_content[:start_index] + updated_block + main_tf_content[end_index:]
       
#     # --- STEP 3: TRIGGER WORKFLOW ---
#     # Your existing function to send the updated content to GitHub Actions
#     workflow_result = trigger_infra_workflow(repo_name, updated_content , "update")
    
#     # Return the workflow trigger result so the frontend can poll for status
#     return workflow_result


import base64
import os
import requests
import re


def update_module_block(repo_name: str, module_name: str, updates: dict):
    """
    Safely updates only one module block inside main.tf
    without touching terraform/provider blocks.
    """
    github_token = "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"
    branch = "main"
    file_path = "main.tf"

    # --- Pull main.tf ---
    url = f"https://api.github.com/repos/{repo_name}/contents/{file_path}?ref={branch}"
    headers = {"Authorization": f"Bearer {github_token}"}

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Failed to fetch main.tf: {response.text}")

    file_data = response.json()
    original_content = base64.b64decode(file_data["content"]).decode("utf-8")

    # --- Locate module block ---
    header_pattern = rf'module\s+"{module_name}"\s*{{'
    match = re.search(header_pattern, original_content)

    if not match:
        raise Exception(f"Module '{module_name}' not found")

    start_index = match.start()

    # --- Brace matching to find end ---
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

    # --- Parse existing attributes ---
    existing_attrs = parse_module_attributes(old_block)

    # --- Merge updates ---
    for key, value in updates.items():
        existing_attrs[key] = value

    # --- Regenerate module block ---
    new_block = render_module_block(module_name, existing_attrs)

    # --- Replace only that block ---
    updated_content = (
        original_content[:start_index] +
        new_block +
        original_content[end_index:]
    )

    # --- Trigger workflow ---
    # Create description of changes
    changes = ", ".join([f"{k}: {v}" for k, v in updates.items()])
    description = f"Updated module '{module_name}' - Changed: {changes}"
    
    workflow_result = trigger_infra_workflow(repo_name, updated_content, "update", description)

    # Return the workflow trigger result so the frontend can poll for status
    return workflow_result

def parse_module_attributes(block_text: str) -> dict:
    """
    Parses simple key = value pairs inside module block.
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

def render_module_block(module_name: str, config: dict) -> str:
    lines = [f'module "{module_name}" {{']

    for key, value in config.items():
        lines.append(f"  {key} = {render_value(value)}")

    lines.append("}\n")

    return "\n".join(lines)

def render_value(value):
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