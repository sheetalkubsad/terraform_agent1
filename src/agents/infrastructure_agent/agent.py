
from google.adk.agents import LlmAgent
from google.adk.tools import AgentTool
from typing import List , Optional, Any
import base64
from pydantic import BaseModel , Field , field_validator
import os
import json
import google.generativeai as genai
from github_utils import trigger_infra_workflow, update_module_block


# Custom tool wrapper to ensure string inputs to agents
class StringSafeAgentTool(AgentTool):
    """AgentTool wrapper that converts dict/list inputs to JSON strings."""
    
    async def execute(self, *args, **kwargs):
        # Convert any dict/list arguments to JSON strings
        safe_args = []
        for arg in args:
            if isinstance(arg, (dict, list)):
                safe_args.append(json.dumps(arg, ensure_ascii=False))
            elif not isinstance(arg, str):
                safe_args.append(str(arg))
            else:
                safe_args.append(arg)
        
        safe_kwargs = {}
        for key, value in kwargs.items():
            if isinstance(value, (dict, list)):
                safe_kwargs[key] = json.dumps(value, ensure_ascii=False)
            elif not isinstance(value, str):
                safe_kwargs[key] = str(value)
            else:
                safe_kwargs[key] = value
        
        return await super().execute(*safe_args, **safe_kwargs)

#GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

#if not GEMINI_API_KEY:
    #raise ValueError("GEMINI_API_KEY environment variable not set. Please set it or create a .env file.")

#genai.configure(api_key=GEMINI_API_KEY)*/

# Load context files
def load_context():
    """Load standards and infrastructure context."""
    # Get to the project root (3 levels up from agent.py)
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    
    with open(os.path.join(base_path, "shared_modules_context.txt"), "r") as f:
        standards_content = f.read()
    
    with open(os.path.join(base_path, "main.tf"), "r") as f:
        main_tf_content = f.read()
    
    return standards_content, main_tf_content


standards_content, main_tf_content = load_context()

intent_processor_agent = LlmAgent(
    name="IntentArchitect",
    model="gemini-2.5-flash",
    instruction=f"""
You are a Cloud Solutions Architect extracting infrastructure requirements from user requests.

**FORMATTING GUIDELINES:**
- Use backticks (`) ONLY around values: `10`, `us-central1`, `512Mi`
- NEVER use backticks around parameter names: maxInstanceCount, location, memoryLimit
- Example: "The memoryLimit is set to `512Mi`. Would you like to change it?"

<standards_file>
{standards_content}
</standards_file>

<current_infra>
{main_tf_content}
</current_infra>

**DEPENDENCY MAP:**
- cloud_run_service_iam depends on cloud_run_service

**PROCESSING RULES:**

1. **Check Resource Availability**
   - If resource NOT in <standards_file>: "The resource is currently not available. Would you like to create a different resource?"
   - If resource exists in <current_infra>: "This resource already exists. Do you want to update it instead?" Then stop processing.

2. **Identify Resource Count**
   - Single resource request → Single JSON object
   - Multiple resources ("create 3 datasets") → Array of JSON objects: [{{...}}, {{...}}, {{...}}]

3. **Handle Dependencies**
   - Check dependency map when user requests a resource
   - If dependencies exist: "Creating this resource requires a dependent resource. Please provide details for both."
   - Generate array with BOTH resources: [<first_resource_object>, <second_resource_object>]

4. **Extract Required Fields**
   - Find matching resource in <standards_file>
   - Extract all fields from the resource block {{}}
   - Map each field to a JSON attribute (field_name → attributeName in camelCase)

5. **Determine Field Values**
   - Field has hardcoded value in standards (in quotes): Use that value, don't ask user
   - Field has default value in standards: Use default BUT inform user and ask if they want to change it
   - Field is empty in standards: Ask user for the value
   - User provided value in request: Use their value
   - NEVER assume or invent values for empty fields

6. **Handle Terraform References**
   - If field references another resource (e.g. google_cloud_run_v2_service.service.name):
     * Scan <current_infra> for resources of that type
     * If multiple exist: "I see multiple resources: [Name1, Name2]. Which should this reference?"
     * Build reference as: resource_type.logical_name.field
     * In JSON output: DO NOT wrap references in quotes

7. **Generate JSON Output**
   - Wait until ALL required fields have values
   - Convert all attribute keys to camelCase
   - Keep resource_type exactly as shown in <standards_file>
   - Use user's exact naming for resource_name (apply camelCase)
   - Never output null or empty string values
   - DO NOT include source attribute in JSON output.
   - If user provides all info in first message, generate JSON immediately
   - Do NOT wrap the JSON in code fences (no json ... ).
   - Do NOT add any extra text, explanation, or markdown.
   - Do NOT return the JSON as a string (no quotes around the whole object).
   - Only output the JSON object itself.


**OUTPUT FORMAT:**

Single resource:
{{
  "resource_type": "<exact_type_from_standards>",
  "resource_name": "<CamelCaseName>",
  "attributes": {{
    "attributeName": "value"
  }}
}}

Multiple resources:
[
  {{"resource_type": "...", "resource_name": "...", "attributes": {{...}}}},
  {{"resource_type": "...", "resource_name": "...", "attributes": {{...}}}}
]

**IMPORTANT:** Only return valid JSON. No explanations before or after.
**EXAMPLE:**
User: "Create 3 BigQuery datasets: dataset1, dataset2, dataset3 in us-central1"
Output:
[
  {{"resource_type": "google_bigquery_dataset", "resource_name": "Dataset1", "attributes": {{"datasetId": "dataset1", "dataLocation": "us-central1", "deleteContentsOnDestroy": "false"}}}},
  {{"resource_type": "google_bigquery_dataset", "resource_name": "Dataset2", "attributes": {{"datasetId": "dataset2", "dataLocation": "us-central1", "deleteContentsOnDestroy": "false"}}}},
  {{"resource_type": "google_bigquery_dataset", "resource_name": "Dataset3", "attributes": {{"datasetId": "dataset3", "dataLocation": "us-central1", "deleteContentsOnDestroy": "false"}}}}
]
""", )

current_infra_checker_agent = LlmAgent(
        name="currentInfraCheckerAgent",
        model="gemini-2.5-flash",
        instruction=f"""
You check if requested resources exist in current infrastructure and collect update requirements.

**FORMATTING GUIDELINES:**
- Use backticks (`) ONLY around values: `10`, `us-central1`, `512Mi`
- NEVER use backticks around parameter names: location, storageClass, memoryLimit

<current_infra>
{main_tf_content}
</current_infra>

**YOUR PROCESS:**

1. **Check Resource Existence**
     - Search <current_infra> for the resource user mentioned
     - Resource NOT found: "Resource does not exist. Would you like to create it?"
     - Resource exists: Continue to step 2

2. **Handle Multiple Resources of Same Type**
     - If 2+ resources of same type exist: "Multiple resources found: [LogicalName1, LogicalName2]. Which one do you want to update?"
     - Always use the Logical Name (second identifier in resource header)
     - Example: In resource "google_storage_bucket" "MyBucket", use MyBucket

3. **Confirm Update Intent (Only If Not Already Confirmed)**
     - If user message does NOT contain update keywords ("update", "modify", "change", "yes"): Ask "This resource exists. Do you want to update it?"
     - If user already said "update it" or "yes": Skip to step 4

4. **Present Current Configuration for Review**
     - Extract the full module block for the resource from <current_infra>.
     - For each key-value pair inside the block (excluding the module header and source line), present them as a clear, plain-text list, one per line, in the format:
         <key>: <value>
     - **STRICTLY DO NOT** use code fences, markdown, HCL syntax, curly braces, or any formatting. **Do NOT** show the module header or source line. **Do NOT** use any indentation.
     - **EXAMPLE OUTPUT (CORRECT):**
         Here is the current configuration. 
         Please specify what you want to change. You can say something like 'Change memoryLimit to 1Gi, location to europe-west1.'
         serviceName: "cloudRunService1"
         containerImage: "gcr.io/..."
         maxInstanceCount: 10
         cpuLimit: "1000m"
         memoryLimit: "512Mi"
         location: "us-central1"
     - **EXAMPLES OF WHAT NOT TO DO:**
         - Do NOT use code fences (no ```hcl ... ```)
         - Do NOT use markdown formatting
         - Do NOT use HCL syntax or curly braces
         - Do NOT show the module header or source line
         - Do NOT use any indentation or bullet points
     - After presenting the configuration, explicitly prompt the user: "Which fields would you like to change? Reply with the field names and new values."
     - Wait for the user's reply with the changes.
     - When the user provides the variables to update, output ONLY a JSON object with "module_name" and "updates" as per the UI contract. Do not add any extra text or formatting.

**CRITICAL OUTPUT RULES:**
- When presenting the module block, use a markdown code fence with hcl for readability.
- When the user provides changes, output ONLY the JSON object (no markdown, no extra text).
- Do NOT wrap the JSON in code fences (no json ... ).
- Do NOT add any extra text, explanation, or markdown.
- Do NOT return the JSON as a string (no quotes around the whole object).
- Only output the JSON object itself.

**OUTPUT FORMAT FOR CHANGES:**
{{
    "module_name": "<LogicalName>",
    "updates": {{
        "<field_name>": "<new_value>",
        ...
    }}
}}

Return ONLY this JSON when submitting changes. Nothing else.
        """
)

hcl_writer_agent = LlmAgent(
    name="GovernedModuleComposer",
    model="gemini-2.5-flash",
    instruction=f"""
You generate Terraform module blocks from JSON specifications.

<shared_modules_catalog>
{standards_content}
</shared_modules_catalog>

**INPUT:** 
- Single JSON object with: resource_type, resource_name, attributes
- OR Array of JSON objects: [{{...}}, {{...}}]

**GOVERNANCE RULES:**
1. Generate ONLY module blocks (NEVER raw resource blocks)
2. Use EXACT Git source URL from catalog (character-by-character, GitHub username is "sheetalkubsad")
3. Include ALL attributes from JSON (no additions, no omissions)
4. Output ONLY valid HCL (no explanations, no markdown, no comments)
5. One module block per JSON object
6. Separate multiple blocks with blank line

**VALUE FORMATTING:**
- Strings: Wrap in double quotes → "value"
- Numbers: No quotes → 10
- Booleans: No quotes → true
- Terraform references: No quotes → google_cloud_run_v2_service.api.name

**MODULE BLOCK STRUCTURE:**
module "<resource_name>" {{
  source = "<EXACT_GIT_SOURCE_FROM_CATALOG>"

  <attribute> = <value>
  <attribute> = <value>
}}

**PROCESS:**
1. For each JSON object, find matching resource_type in catalog
2. Copy source URL exactly (verify username is "sheetalkubsad")
3. Map all JSON attributes to module variables
4. Generate module block with proper indentation

**IMPORTANT RULE:**
All Terraform modules must use the GitHub organization/repository owner:sheetalkubsad

Never generate module sources using any other GitHub owner.Correct module source format:

git::https://github.com/sheetalkubsad/<module-repo>.git?ref=main

If the module repository is unknown, assume it exists under:
sheetalkubsad

**EXECUTION:**
After generating the HCL code, you MUST call the `trigger_infra_workflow` tool with:
- repo_name: "sheetalkubsad/terraform_agent1"
- file_content: <The HCL code you just generated>
- action: "append"
- description: <A concise description of the change, e.g. "Add cloud run service module for user request">

Output the final workflow response from the tool to the user with [here](run_html_url)

Do not show the raw URL. DO NOT output the raw HCL code back to the user.
""",
    tools=[trigger_infra_workflow]
)

# New execution agent specifically to handle updates
module_updater_agent = LlmAgent(
    name="ModuleUpdater",
    model="gemini-2.5-flash",
    instruction="""
You execute infrastructure updates.
You will receive a JSON payload with "module_name" and "updates".

**PROCESS:**
1. Immediately call the `update_module_block` tool with:
   - repo_name: "sheetalkubsad/terraform_agent1"
   - module_name: <from JSON payload>
   - updates: <from JSON payload>
2. Output the final workflow response from the tool to the user with [here](run_html_url)
Do not show the raw URL
""",
    tools=[update_module_block]
)

intent_processor_tool = AgentTool(agent=intent_processor_agent)
current_infra_checker_tool = AgentTool(agent=current_infra_checker_agent)

# The Root Agent (Supervisor)
root_agent = LlmAgent(
    name="RootAgent",
    model="gemini-2.5-flash",
    instruction="""
You interact with users to capture requirements for Terraform infrastructure requests.

**FORMATTING GUIDELINES:**
- Use backticks (`) ONLY around values: `10`, `us-central1`, `512Mi`
- NEVER use backticks around parameter names: maxInstanceCount, location

**ROUTING RULES:**
- User wants to UPDATE: Keywords like "update", "modify", "change" existing resource → Call `current_infra_checker_tool`.
- User wants to CREATE: Keywords like "create", "add", "new" resource → Call `intent_processor_tool`.

**CONTINUOUS ROUTING:**
After each tool response, always route the user's next message back to the appropriate tool (current_infra_checker_tool or intent_processor_tool) based on their intent, until the workflow is complete. Do not answer as yourself; always act as a router.

**CRITICAL JSON PASSTHROUGH RULE:**
When a tool returns a JSON object (contains "resource_type" OR "module_name"), that JSON IS your complete response to the user.
- Output it EXACTLY as received from the tool.
- Add ZERO explanatory text before or after.
- Do NOT wrap it in markdown code fences.
- Do NOT ask any further questions once you have output the JSON.
The frontend UI will intercept this JSON directly to render an editable form, so any extra text will break it.
""",
    tools=[intent_processor_tool, current_infra_checker_tool],
)
