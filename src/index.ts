interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Tankerkoenig MCP — German real-time fuel prices (Benzinpreise) for all
 * German gas stations, sourced from the official MTS-K (Markttransparenzstelle
 * fuer Kraftstoffe) via creativecommons.tankerkoenig.de.
 *
 * Tools:
 * - tankerkoenig_stations_nearby: fuel prices at gas stations near a lat/lng
 * - tankerkoenig_station_details: full detail for one station incl. opening times
 * - tankerkoenig_prices: bulk current prices for up to 10 station ids
 *
 * BYO key via _apiKey (free at creativecommons.tankerkoenig.de); the gateway
 * may inject a platform key. Data covers Germany only. CC BY 4.0 licensed.
 */


const BASE_URL = 'https://creativecommons.tankerkoenig.de/json';

const API_KEY_DESC =
  'Optional: your own free Tankerkoenig API key (creativecommons.tankerkoenig.de)';

const tools: McpToolExport['tools'] = [
  {
    name: 'tankerkoenig_stations_nearby',
    description:
      'German gas station fuel prices near a location — Benzinpreise Germany, real-time from the official MTS-K feed. Find the cheapest diesel, E5, or E10 near a point in Germany with price in EUR per liter, brand, address, distance, and open status. Coordinates are required: geocode a German city or address first (e.g. via a geocoding tool) — Berlin is lat 52.52, lng 13.40. Data covers Germany only. Example: tankerkoenig_stations_nearby({ latitude: 52.52, longitude: 13.40, radius_km: 5, fuel: "diesel", sort: "price" })',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          description: 'Latitude of the search center (Germany), e.g. 52.52 for Berlin',
        },
        longitude: {
          type: 'number',
          description: 'Longitude of the search center (Germany), e.g. 13.40 for Berlin',
        },
        radius_km: {
          type: 'number',
          description: 'Search radius in kilometers (default 5, maximum 25 — larger values are clamped)',
        },
        fuel: {
          type: 'string',
          enum: ['e5', 'e10', 'diesel', 'all'],
          description:
            'Fuel type: "e5" (Super 95), "e10" (Super E10), "diesel", or "all" for all three prices per station (default "all")',
        },
        sort: {
          type: 'string',
          enum: ['distance', 'price'],
          description:
            'Sort order: "distance" (default) or "price" (cheapest first). Sorting by price requires a single fuel type (e5, e10, or diesel), the API rejects sort by price when fuel is "all"',
        },
        open_only: {
          type: 'boolean',
          description: 'Return only stations that are currently open (default false)',
        },
        _apiKey: {
          type: 'string',
          description: API_KEY_DESC,
        },
      },
      required: ['latitude', 'longitude'],
    },
  },
  {
    name: 'tankerkoenig_station_details',
    description:
      'Full detail for one German gas station by its Tankerkoenig station id (UUID from tankerkoenig_stations_nearby): opening times, current E5 / E10 / diesel prices in EUR per liter, brand, address, state, and open status. MTS-K real-time data, Germany only. Example: tankerkoenig_station_details({ station_id: "94e70fc4-b22f-4e5a-877f-bc1082cdae81" })',
    inputSchema: {
      type: 'object',
      properties: {
        station_id: {
          type: 'string',
          description: 'Station UUID, e.g. "94e70fc4-b22f-4e5a-877f-bc1082cdae81" (from tankerkoenig_stations_nearby)',
        },
        _apiKey: {
          type: 'string',
          description: API_KEY_DESC,
        },
      },
      required: ['station_id'],
    },
  },
  {
    name: 'tankerkoenig_prices',
    description:
      'Bulk current fuel prices (E5, E10, diesel in EUR per liter) for up to 10 German gas stations by station id — the efficient refresh call for price-watch and price-alert flows once station ids are known. MTS-K real-time Benzinpreise, Germany only. Example: tankerkoenig_prices({ station_ids: ["94e70fc4-b22f-4e5a-877f-bc1082cdae81", "278130b1-e062-4a0f-80cc-19e486b4c024"] })',
    inputSchema: {
      type: 'object',
      properties: {
        station_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of station UUIDs (1 to 10) from tankerkoenig_stations_nearby',
        },
        _apiKey: {
          type: 'string',
          description: API_KEY_DESC,
        },
      },
      required: ['station_ids'],
    },
  },
];

const KEY_HINT =
  'Get a free personal API key at https://creativecommons.tankerkoenig.de (instant email signup). Pass it via _apiKey. The public demo key (00000000-0000-0000-0000-000000000002) is for interactive testing only and returns dummy prices, so it is deliberately unsupported here.';

function requireKey(args: Record<string, unknown>): string {
  const key = args._apiKey as string | undefined;
  delete args._apiKey;
  if (!key) {
    throw new Error(`Tankerkoenig: no API key available. ${KEY_HINT}`);
  }
  return key;
}

// The API returns HTTP 200 with { ok: false, status: "error", message } on
// bad input or a bad key (messages are in German, e.g. "apikey nicht
// angegeben, falsch, oder im falschen Format").
function checkApiError(data: { ok?: boolean; message?: string }, tool: string): void {
  if (data.ok === false) {
    const msg = data.message ?? 'unknown error';
    if (/apikey/i.test(msg)) {
      throw new Error(`Tankerkoenig ${tool}: API key rejected ("${msg}"). ${KEY_HINT}`);
    }
    throw new Error(`Tankerkoenig ${tool} error: ${msg}`);
  }
}

async function fetchJson(path: string, params: URLSearchParams, tool: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BASE_URL}/${path}?${params}`, { signal: controller.signal });
    if (res.status === 503) {
      throw new Error(
        `Tankerkoenig ${tool}: service unavailable (HTTP 503) — the upstream is rate-limiting or briefly down. Retry in a minute, or pass a personal key. ${KEY_HINT}`,
      );
    }
    if (!res.ok) {
      throw new Error(`Tankerkoenig ${tool} error: HTTP ${res.status}`);
    }
    const data = (await res.json()) as Record<string, unknown>;
    checkApiError(data as { ok?: boolean; message?: string }, tool);
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Tankerkoenig ${tool}: request timed out after 8s. Retry shortly.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = requireKey(args);

  switch (name) {
    case 'tankerkoenig_stations_nearby':
      return stationsNearby(args, apiKey);
    case 'tankerkoenig_station_details':
      return stationDetails(args.station_id as string, apiKey);
    case 'tankerkoenig_prices':
      return bulkPrices(args.station_ids as string[], apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

interface ListStation {
  id: string;
  name: string;
  brand: string;
  street: string;
  houseNumber: string;
  postCode: number;
  place: string;
  lat: number;
  lng: number;
  dist: number;
  isOpen: boolean;
  // type=all → three price fields; single fuel type → one `price` field
  e5?: number | false;
  e10?: number | false;
  diesel?: number | false;
  price?: number;
}

async function stationsNearby(args: Record<string, unknown>, apiKey: string) {
  const latitude = args.latitude as number;
  const longitude = args.longitude as number;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error(
      'Tankerkoenig tankerkoenig_stations_nearby requires numeric latitude and longitude (Germany). Geocode the city or address first — e.g. Berlin is latitude 52.52, longitude 13.40.',
    );
  }

  let radiusKm = (args.radius_km as number | undefined) ?? 5;
  let radiusNote: string | undefined;
  if (radiusKm > 25) {
    radiusNote = `radius_km clamped from ${radiusKm} to 25 (API maximum)`;
    radiusKm = 25;
  }
  if (radiusKm <= 0) radiusKm = 5;

  const fuel = ((args.fuel as string | undefined) ?? 'all').toLowerCase();
  if (!['e5', 'e10', 'diesel', 'all'].includes(fuel)) {
    throw new Error(`Tankerkoenig: fuel must be one of "e5", "e10", "diesel", "all" — got "${fuel}".`);
  }

  const sortArg = ((args.sort as string | undefined) ?? 'distance').toLowerCase();
  const sort = sortArg === 'price' ? 'price' : 'dist';
  if (sort === 'price' && fuel === 'all') {
    throw new Error(
      'Tankerkoenig: sorting by price requires a single fuel type. Set fuel to "e5", "e10", or "diesel" when using sort: "price" (the upstream API only supports price sort for one fuel at a time).',
    );
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
    rad: String(radiusKm),
    sort,
    type: fuel,
    apikey: apiKey,
  });

  const data = (await fetchJson('list.php', params, 'stations_nearby')) as unknown as {
    stations: ListStation[];
  };

  let stations = data.stations ?? [];
  if (args.open_only === true) {
    stations = stations.filter((s) => s.isOpen);
  }

  return {
    source: 'Tankerkoenig / MTS-K (official German fuel price transparency unit)',
    license: 'CC BY 4.0 — https://creativecommons.tankerkoenig.de',
    center: { latitude, longitude },
    radius_km: radiusKm,
    fuel,
    sorted_by: sort === 'dist' ? 'distance' : 'price',
    ...(radiusNote ? { note: radiusNote } : {}),
    count: stations.length,
    stations: stations.slice(0, 50).map((s) => ({
      id: s.id,
      name: s.name,
      brand: s.brand,
      address: `${s.street} ${s.houseNumber}, ${s.postCode} ${s.place}`.trim(),
      latitude: s.lat,
      longitude: s.lng,
      distance_km: s.dist,
      is_open: s.isOpen,
      // Single-fuel queries return one price; type=all returns all three.
      // false / 0 from the API means the station reports no price for that fuel.
      ...(fuel === 'all'
        ? {
            prices_eur_per_liter: {
              e5: s.e5 || null,
              e10: s.e10 || null,
              diesel: s.diesel || null,
            },
          }
        : { price_eur_per_liter: s.price ?? null }),
    })),
  };
}

async function stationDetails(stationId: string, apiKey: string) {
  if (!stationId) {
    throw new Error(
      'Tankerkoenig tankerkoenig_station_details requires station_id (a UUID from tankerkoenig_stations_nearby).',
    );
  }

  const params = new URLSearchParams({ id: stationId, apikey: apiKey });
  const data = (await fetchJson('detail.php', params, 'station_details')) as unknown as {
    station: {
      id: string;
      name: string;
      brand: string;
      street: string;
      houseNumber: string;
      postCode: number;
      place: string;
      lat: number;
      lng: number;
      isOpen: boolean;
      wholeDay: boolean;
      openingTimes: Array<{ text: string; start: string; end: string }>;
      overrides: string[];
      e5: number | false;
      e10: number | false;
      diesel: number | false;
      state: string | null;
    };
  };

  const s = data.station;
  return {
    source: 'Tankerkoenig / MTS-K (official German fuel price transparency unit)',
    license: 'CC BY 4.0 — https://creativecommons.tankerkoenig.de',
    station: {
      id: s.id,
      name: s.name,
      brand: s.brand,
      // detail.php pads street with a trailing space — collapse doubles
      address: `${s.street} ${s.houseNumber}, ${s.postCode} ${s.place}`.replace(/\s+/g, ' ').trim(),
      latitude: s.lat,
      longitude: s.lng,
      state: s.state,
      is_open: s.isOpen,
      open_24_7: s.wholeDay,
      opening_times: s.openingTimes ?? [],
      opening_time_overrides: s.overrides ?? [],
      prices_eur_per_liter: {
        e5: s.e5 || null,
        e10: s.e10 || null,
        diesel: s.diesel || null,
      },
    },
  };
}

async function bulkPrices(stationIds: string[], apiKey: string) {
  if (!Array.isArray(stationIds) || stationIds.length === 0) {
    throw new Error(
      'Tankerkoenig tankerkoenig_prices requires station_ids: a list of 1 to 10 station UUIDs (from tankerkoenig_stations_nearby).',
    );
  }
  if (stationIds.length > 10) {
    throw new Error(
      `Tankerkoenig tankerkoenig_prices accepts at most 10 station ids per call (got ${stationIds.length}). Split into batches of 10.`,
    );
  }

  const params = new URLSearchParams({ ids: stationIds.join(','), apikey: apiKey });
  const data = (await fetchJson('prices.php', params, 'prices')) as unknown as {
    prices: Record<string, { status: string; e5?: number | false; e10?: number | false; diesel?: number | false }>;
  };

  const prices = data.prices ?? {};
  return {
    source: 'Tankerkoenig / MTS-K (official German fuel price transparency unit)',
    license: 'CC BY 4.0 — https://creativecommons.tankerkoenig.de',
    count: Object.keys(prices).length,
    stations: Object.entries(prices).map(([id, p]) => ({
      id,
      // status: "open" | "closed" | "no prices" (unknown/unreported station)
      status: p.status,
      prices_eur_per_liter: {
        e5: p.e5 || null,
        e10: p.e10 || null,
        diesel: p.diesel || null,
      },
    })),
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
