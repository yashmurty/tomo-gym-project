// Empty in local dev: requests stay same-origin and Vite proxies /api to the
// backend (vite.config.ts). Production builds set VITE_API_BASE_URL.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

// Where external MCP clients connect: the same /mcp our own agent uses.
export function mcpServerUrl(): string {
  return `${API_BASE_URL || window.location.origin}/api/v1/mcp`;
}
