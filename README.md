# gleanwork-claude-plugins

Central configuration repository for managing Claude Code plugins across the gleanwork organization.

## Purpose

This private repository serves as the central marketplace for deploying and managing Claude Code plugins used throughout gleanwork. The `.claude-plugin/marketplace.json` file defines which plugins are available and where they are sourced from.

## Plugin Classifications

### 1. General (Org-wide) Plugins

Plugins intended for use across the entire gleanwork organization. These provide shared commands, agents, and skills that benefit all repositories.

- **Location:** `gleanwork/.github`
- **Scope:** Available to all repos in the gleanwork org
- **Use cases:** Common workflows, org-wide conventions, shared tooling

### 2. Repo-specific Plugins

Plugins that live directly inside individual repositories. These provide commands, agents, and skills tailored to the specific needs of that repository.

- **Location:** Within each repo (e.g., `.claude/` or `.claude-plugin/` directory)
- **Scope:** Specific to the containing repository
- **Use cases:** Repo-specific build commands, custom testing workflows, project-specific agents

## Marketplace Configuration

The marketplace is configured in `.claude-plugin/marketplace.json`. To add a new plugin:

```json
{
  "plugins": [
    {
      "name": "plugin-name",
      "source": {
        "source": "github",
        "repo": "gleanwork/repo-name"
      },
      "description": "Description of what the plugin provides"
    }
  ]
}
```

## Available Commands

This repo includes a local plugin with commands for managing the marketplace:

### `/add-plugin`

Add a new plugin to the marketplace configuration.

**Arguments:**
- `plugin_name` - Name of the plugin
- `source_repo` - GitHub repo path (e.g., `gleanwork/repo-name`)
- `plugin_description` - Description of what the plugin provides

**Example:**
```
/add-plugin my-plugin gleanwork/my-repo "My custom plugin for X"
```

## Current Plugins

| Plugin | Source | Description |
|--------|--------|-------------|
| gleanwork-org | gleanwork/.github | Gleanwork org-wide tools |
