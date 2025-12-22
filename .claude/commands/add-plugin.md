---
description: Add a new plugin to the marketplace configuration
arguments:
  - name: plugin_name
    description: Name of the plugin (e.g., "my-plugin")
    required: true
  - name: source_repo
    description: GitHub repo path (e.g., "gleanwork/repo-name")
    required: true
  - name: plugin_description
    description: Description of what the plugin provides
    required: true
---

Add a new plugin entry to the marketplace configuration file at `.claude-plugin/marketplace.json`.

## Plugin Details

- **Name:** $ARGUMENTS.plugin_name
- **Source:** $ARGUMENTS.source_repo
- **Description:** $ARGUMENTS.plugin_description

## Instructions

1. Read the current `.claude-plugin/marketplace.json` file
2. Add a new entry to the `plugins` array with:
   ```json
   {
     "name": "$ARGUMENTS.plugin_name",
     "source": {
       "source": "github",
       "repo": "$ARGUMENTS.source_repo"
     },
     "description": "$ARGUMENTS.plugin_description"
   }
   ```
3. Write the updated JSON back to the file, preserving formatting (2-space indentation)
4. Update the "Current Plugins" table in README.md to include the new plugin
5. Show the user the updated marketplace.json content
