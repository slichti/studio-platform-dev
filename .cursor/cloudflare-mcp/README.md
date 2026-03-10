# Cloudflare MCP Servers

Reference info from [cloudflare/mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare).

## Configured in Cursor

The project's `.cursor/mcp.json` enables these Cloudflare MCP servers:

| Server | Description |
|--------|-------------|
| **cloudflare-docs** | Get up-to-date Cloudflare reference documentation |
| **cloudflare-observability** | Debug and get insight into logs and analytics |
| **cloudflare-bindings** | Build Workers apps with storage, AI, and compute primitives |
| **cloudflare-builds** | Get insights and manage Cloudflare Workers Builds |

## Authentication

For servers that require it (observability, bindings, builds), add your Cloudflare API token in Cursor's MCP settings when prompted. Create tokens at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).

## Adding More Servers

To add more Cloudflare MCP servers, add entries to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cloudflare-radar": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://radar.mcp.cloudflare.com/mcp"]
    }
  }
}
```

See `server.json` for the full list of available remote URLs.
