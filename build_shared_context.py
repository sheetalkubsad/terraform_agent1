import requests
import base64
import os

# ===============================
# CONFIG
# ===============================

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

if not GITHUB_TOKEN:
    raise ValueError("Please set GITHUB_TOKEN environment variable")

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json"
}

OWNER = "sheetalkubsad"

REPOS = [
    {
        "repo_name": "terraform-cloud-run-module",
        "display_name": "CLOUD RUN SERVICE",
        "source": "git::https://github.com/sheetalkubsad/terraform-cloud-run-module.git?ref=main"
    },
    {
        "repo_name": "terraform-cloud-run-iam-module",
        "display_name": "CLOUD RUN IAM POLICY",
        "source": "git::https://github.com/sheetalkubsad/terraform-cloud-run-iam-module.git?ref=main"
    },
    {
        "repo_name": "terraform-bigquery-module",
        "display_name": "BIGQUERY DATASET",
        "source": "git::https://github.com/sheetalkubsad/terraform-bigquery-module.git?ref=main"
    }
]

OUTPUT_FILE = "shared_modules_context.txt"


# ===============================
# FETCH FILE FROM GITHUB
# ===============================

def fetch_main_tf(repo_name):
    url = f"https://api.github.com/repos/{OWNER}/{repo_name}/contents/main.tf"

    response = requests.get(url)

    if response.status_code != 200:
        raise Exception(f"Failed to fetch main.tf from {repo_name}: {response.text}")

    content_json = response.json()
    encoded_content = content_json["content"]
    decoded_content = base64.b64decode(encoded_content).decode("utf-8")

    return decoded_content


# ===============================
# BUILD CONCATENATED CONTEXT
# ===============================

def build_context():

    with open(OUTPUT_FILE, "w") as f:

        f.write("====================================================================\n")
        f.write("GOVERNED SHARED TERRAFORM MODULES\n")
        f.write("====================================================================\n\n")

        for repo in REPOS:

            print(f"Fetching {repo['repo_name']}...")

            module_code = fetch_main_tf(repo["repo_name"])

            f.write("====================================================================\n")
            f.write(f"MODULE: {repo['display_name']}\n")
            f.write("====================================================================\n\n")

            f.write(f"REPOSITORY: {repo['repo_name']}\n")
            f.write(f"SOURCE: {repo['source']}\n\n")

            f.write("IMPLEMENTATION:\n")
            f.write("--------------------------------------------------------------------\n\n")

            f.write(module_code)
            f.write("\n\n--------------------------------------------------------------------\n\n")

        # Add strict generation rules for LLM
        f.write("====================================================================\n")
        f.write("LLM GENERATION RULES\n")
        f.write("====================================================================\n\n")
        f.write("1. These are IMPLEMENTATION MODULES.\n")
        f.write("2. You MUST NOT copy resource blocks.\n")
        f.write("3. You MUST generate Terraform using ONLY module blocks.\n")
        f.write("4. You MUST use the exact SOURCE URL provided.\n")
        f.write("5. You MUST preserve version pin (?ref=v1.0.0).\n")
        f.write("6. Output ONLY valid Terraform HCL.\n")

    print(f"\n✅ Context file generated: {OUTPUT_FILE}")


# ===============================
# RUN
# ===============================

if __name__ == "__main__":
    build_context()