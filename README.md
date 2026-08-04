# mcp-tankerkoenig

Tankerkoenig MCP — German real-time fuel prices (Benzinpreise) for all

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Tankerkoenig data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
