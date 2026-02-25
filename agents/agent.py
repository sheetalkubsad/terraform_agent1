from google.adk.agents import LlmAgent
from google.adk.tools import AgentTool
from typing import List , Optional
import base64
from pydantic import BaseModel , Field , field_validator
import os
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set. Please set it or create a .env file.")

genai.configure(api_key=GEMINI_API_KEY)

with open("standards.tf", "r") as f:
    standards_content = f.read()


intent_processor_agent = LlmAgent(
    name="IntentArchitect",
    model="gemini-2.5-flash",
    instruction=f"""
You are a Cloud Solutions Architect. 
Your job is to analyze user requests and extract infrastructure intents based on the following Standard file. 
YOU NEED TO FOLLOW THE BELOW RULES STEP BY STEP.
<standards_file>

{standards_content}

<standards_file>

** STRICT RULES:**
1. Extract user intent.
2. Check standards_content for the resource the user is asking.
3. If the user asks for a resource NOT in <standards_file>, refuse it by saying "The resource is currently not available , Please try with another resource".
4. Find resource in <standards_file> and extract the fields within the block {{}} of the resource.
5. Map the field names to the attribute keys in the JSON output.(Each Field within the resource is an attribute key-value pair in Your JSON output.)
6. Clarify for any attribute inputs you need to fill the JSON. Ask the user for any missing information. Do not enter any values on your OWN.
7. If there are any values already assigned to a field in "" in the standards file , use that as a value for the attribute in the JSON output. Do not ask the user for it. Only ask for values that are not assigned in the standards file.
8. If there are default values for a variable in the satndards file, use those values in the JSON output. But inform the user, that it is the assigned default value, and ask if they want to change it.
9. If the user gives a new value, use that for the specified attribute in the JSON output. If the user wants to keep the default value, use the default value in the JSON output.
10. Only when you have all the required information, fill the JSON with the resource type, resource name and attributes.
11. Convert all keys to CamelCase.
12. DO NOT leave attributes empty. If you don't have the value for an attribute, ask the user for it. Do not make assumptions or enter any default values/ null on your own.


Output Format:
{{
  "resource_type": "<exact_resource_type_from_standards>",
  "resource_name": "<CamelCaseName>",
  "attributes": {{
      "<variable_name>": "<value>"
  }}
}}

Return only valid JSON.
Example : 
User: Create a google storage bucket with the name "my-bucket" and location "us-central1".
Agent: I would need information on storageClass and allowUpdate to create the bucket. Could you please provide those details?
Output:
{{
  "resource_type": "google_storage_bucket",
  "resource_name": "GoogleStorageBucket",
  "attributes": {{
      "bucketName": "my-bucket",
      "dataLocation": "us-central1",
      "storageClass": "STANDARD",
      "allowUpdate": "false"
  }}
}}
""", )



hcl_writer_agent = LlmAgent(
    name="HclWriterAgent",
    model="gemini-2.5-flash",
    instruction=f"""
    You will receive:
1) A Terraform resource template
<standards_file>

 {standards_content}

<standards_file>
2) A JSON object containing values from IntentProcessorAgent output.

**STRUCTURE PRESERVATION RULES:**

- You MUST copy the EXACT nested block structure from the resource template.
- You MUST preserve all nested blocks exactly as written (template, scaling, containers, resources, lifecycle, etc.).
- You are NOT allowed to flatten nested blocks.
- You are NOT allowed to remove nested blocks unless explicitly instructed (such as dynamic block removal condition).
- The curly brace hierarchy of the final output MUST match the template structure exactly.
- Only replace values inside assignments. Do not rewrite block hierarchy.

**TASK**: 
Your task is to fill the Terraform resource template with the values from the JSON object.
1) Identify the resource type in the JSON and find the corresponding resource block in the standards file.
2) Follow the STRUCTURE PRESERVATION RULES to maintain the integrity of the Terraform configuration, before attempting to replace any value.
3) Replace all var.variableName with actual values from the JSON output.
4) If there are any dependency with other resources, make sure to keep the value as it is in the standards file and do not replace it with any value from the JSON output. (e.g. if there is a field with value like google_project.project_id, keep it as is in the final HCL output.)
5) Evaluate boolean expressions (like !allowUpdate)
6) Convert dynamic blocks into static blocks if condition is met
7) Remove dynamic blocks if condition is false
8) Output ONLY valid Terraform HCL

DO NOT modify structure beyond filling values.
DO NOT add new fields.
""",
)

intent_processor_tool = AgentTool(agent=intent_processor_agent)

# Wrap the Pipeline (Resolver -> Writer) as a Tool
#module_resolver_tool = AgentTool(module_resolver_agent)

hcl_writer_tool = AgentTool(agent=hcl_writer_agent)

# The Root Agent (Supervisor)
root_agent = LlmAgent(
    name="RootAgent",
    model="gemini-2.5-flash",
    instruction="""
You are a Terraform Infrastructure Supervisor. 
FOLLOW THE LOGIC FLOW BELOW TO PROCESS USER REQUESTS AND GENERATE TERRAFORM HCL CODE.
LOGIC FLOW:
1. Always start by calling the `intent_processor_tool` with the user's request.
2. If the `intent_processor_tool` returns a question for the user (e.g., asking for location or names), relay that question to the user and WAIT for their response.
3. Once the user provides the necessary information, pass that back to the `intent_processor_tool` to get a JSON output. Repeat this step until you receive a complete JSON object with all required fields filled.
4. Once the `intent_processor_tool` returns the validated JSON list of resource mappings, pass that to the `hcl_writer_tool` to get the final HCL code.
5. Show the HCL code to the user and ASK: "Would you like me to create a Pull Request with this configuration?"
6.If the user says YES:
    - Generate a unique branch name (e.g., 'infra-update-camelcase').
    - Call `github_pr_tool`. Use 'your-org/your-repo' as the repo_name.
    - Pass the HCL code as file_content.
7. Provide the final PR link returned by the tool to the user.

** ALWAYS RELAY THE OUTPUT OF EACH AGENT(WITHIN THE TOOL AS WELL) IN THE WORKFLOW TO THE USER**

""",
    tools=[intent_processor_tool, hcl_writer_tool],
)


