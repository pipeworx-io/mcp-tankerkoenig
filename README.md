# mcp-tankerkoenig

Tankerkoenig MCP — German real-time fuel prices (Benzinpreise) for all German gas stations, sourced from the official MTS-K (Markttransparenzstelle fuer Kraftstoffe) via creativecommons.tankerkoenig.de.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1857+ live data sources. This is an independent, unofficial integration — not affiliated with, endorsed by, or published by the upstream provider.

## Tools

| Tool | Description |
|------|-------------|
| `tankerkoenig_stations_nearby` | German gas station fuel prices near a location — Benzinpreise Germany, real-time from the official MTS-K feed. Find the cheapest diesel, E5, or E10 near a point in Germany with price in EUR per liter, brand, address, distance, and open status. Coordinates are required: geocode a German city or address first (e.g. via a geocoding tool) — Berlin is lat 52.52, lng 13.40. Data covers Germany only. Example: tankerkoenig_stations_nearby({ latitude: 52.52, longitude: 13.40, radius_km: 5, fuel: "diesel", sort: "price" }) |
| `tankerkoenig_station_details` | Full detail for one German gas station by its Tankerkoenig station id (UUID from tankerkoenig_stations_nearby): opening times, current E5 / E10 / diesel prices in EUR per liter, brand, address, state, and open status. MTS-K real-time data, Germany only. Example: tankerkoenig_station_details({ station_id: "94e70fc4-b22f-4e5a-877f-bc1082cdae81" }) |
| `tankerkoenig_prices` | Bulk current fuel prices (E5, E10, diesel in EUR per liter) for up to 10 German gas stations by station id — the efficient refresh call for price-watch and price-alert flows once station ids are known. MTS-K real-time Benzinpreise, Germany only. Example: tankerkoenig_prices({ station_ids: ["94e70fc4-b22f-4e5a-877f-bc1082cdae81", "278130b1-e062-4a0f-80cc-19e486b4c024"] }) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "tankerkoenig": {
      "url": "https://gateway.pipeworx.io/tankerkoenig/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/tankerkoenig/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1857+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/tankerkoenig_stations_nearby \
  -H 'Content-Type: application/json' \
  -d '{"latitude":52.52,"longitude":13.4,"radius_km":5,"fuel":"diesel","sort":"price"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/tankerkoenig_stations_nearby`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.

## Run it from npm

`@pipeworx/mcp-tankerkoenig` is a local stdio bridge to the Pipeworx gateway: your MCP client
starts it with `npx`, and it forwards every call to the same
`https://gateway.pipeworx.io/tankerkoenig/mcp` endpoint shown above. It needs network access;
there is no offline mode.

```json
{
  "mcpServers": {
    "tankerkoenig": {
      "command": "npx",
      "args": ["-y", "@pipeworx/mcp-tankerkoenig"]
    }
  }
}
```

Without a key it calls anonymously, capped at 50 calls a day. A free account
raises that to 200 a day: get a key at https://pipeworx.io/signup and add
`"env": { "PIPEWORX_API_KEY": "<your key>" }` to the server entry.
The key is sent as a Bearer token, the same way a hosted connection sends it,
so calls are metered and billed exactly as they are there.

It lists **only** this pack's tools by default. Set `PIPEWORX_META_TOOLS=1` to
also list `ask_pipeworx` and the other gateway-wide tools.

Behind an HTTPS proxy: Node's built-in `fetch` does not read `HTTPS_PROXY` by
default. Newer Node releases honour it when `NODE_USE_ENV_PROXY=1` is set; check
your Node version's documentation.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Tankerkoenig data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
