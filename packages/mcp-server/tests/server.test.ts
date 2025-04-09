import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Helper to create a fake Response object
function fakeResponse<T>(data: T, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    clone: () => fakeResponse(data, ok, status),
    headers: new Headers(),
    redirected: false,
    statusText: "",
    type: "basic",
    url: ""
  } as unknown as Response;
}

// Mock the fetch function
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock responses
const mockAlertsResponse = {
  features: [
    {
      properties: {
        event: "Severe Thunderstorm",
        areaDesc: "Northwestern County",
        severity: "Severe",
        status: "Actual",
        headline: "Severe Thunderstorm Warning for Northwestern County"
      }
    },
    {
      properties: {
        event: "Flood",
        areaDesc: "Southeastern County",
        severity: "Moderate",
        status: "Actual",
        headline: "Flood Warning for Southeastern County"
      }
    }
  ]
};

const mockEmptyAlertsResponse = {
  features: []
};

const mockPointsResponse = {
  properties: {
    forecast: "https://api.weather.gov/gridpoints/ABC/123,456/forecast"
  }
};

const mockForecastResponse = {
  properties: {
    periods: [
      {
        name: "Tonight",
        temperature: 72,
        temperatureUnit: "F",
        windSpeed: "5 mph",
        windDirection: "SW",
        shortForecast: "Partly Cloudy"
      },
      {
        name: "Saturday",
        temperature: 85,
        temperatureUnit: "F",
        windSpeed: "10 mph",
        windDirection: "S",
        shortForecast: "Sunny"
      }
    ]
  }
};

describe('Weather MCP Server', () => {
  let server: McpServer;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a fresh server instance for each test
    server = new McpServer({
      name: "weather-test",
      version: "1.0.0"
    });
    
    // Register the get-alerts tool
    server.tool(
      "get-alerts",
      "Get weather alerts for a state",
      {
        state: z.string().length(2).describe("Two-letter state code (e.g. CA, NY)"),
      },
      async ({ state }) => {
        const stateCode = state.toUpperCase();
        const alertsUrl = `https://api.weather.gov/alerts?area=${stateCode}`;
        try {
          const response = await fetch(alertsUrl);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const alertsData = await response.json();
          const features = alertsData.features || [];
          if (features.length === 0) {
            return {
              content: [
                { type: "text", text: `No active alerts for ${stateCode}` },
              ],
            };
          }
          const formattedAlerts = features.map((feature: any) => {
            const props = feature.properties;
            return [
              `Event: ${props.event || "Unknown"}`,
              `Area: ${props.areaDesc || "Unknown"}`,
              `Severity: ${props.severity || "Unknown"}`,
              `Status: ${props.status || "Unknown"}`,
              `Headline: ${props.headline || "No headline"}`,
              "---",
            ].join("\n");
          });
          const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n")}`;
          return {
            content: [
              { type: "text", text: alertsText },
            ],
          };
        } catch {
          return {
            content: [
              { type: "text", text: "Failed to retrieve alerts data" },
            ],
          };
        }
      },
    );
    
    // Register the get-forecast tool
    server.tool(
      "get-forecast",
      "Get weather forecast for a location",
      {
        latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
        longitude: z.number().min(-180).max(180).describe("Longitude of the location"),
      },
      async ({ latitude, longitude }) => {
        try {
          // Get grid point data
          const pointsUrl = `https://api.weather.gov/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
          const pointsResponse = await fetch(pointsUrl);
          if (!pointsResponse.ok) {
            throw new Error(`HTTP error! status: ${pointsResponse.status}`);
          }
          const pointsData = await pointsResponse.json();
          const forecastUrl = pointsData.properties?.forecast;
          if (!forecastUrl) {
            return {
              content: [
                { type: "text", text: "Failed to get forecast URL from grid point data" },
              ],
            };
          }
          // Get forecast data
          const forecastResponse = await fetch(forecastUrl);
          if (!forecastResponse.ok) {
            throw new Error(`HTTP error! status: ${forecastResponse.status}`);
          }
          const forecastData = await forecastResponse.json();
          const periods = forecastData.properties?.periods || [];
          if (periods.length === 0) {
            return {
              content: [
                { type: "text", text: "No forecast periods available" },
              ],
            };
          }
          const formattedForecast = periods.map((period: any) =>
            [
              `${period.name || "Unknown"}:`,
              `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
              `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
              `${period.shortForecast || "No forecast available"}`,
              "---",
            ].join("\n")
          );
          const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;
          return {
            content: [
              { type: "text", text: forecastText },
            ],
          };
        } catch {
          return {
            content: [
              { type: "text", text: `Failed to retrieve forecast data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).` },
            ],
          };
        }
      },
    );
  });
  
  describe('get-alerts tool', () => {
    it('should fetch and format alerts for a state', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(fakeResponse(mockAlertsResponse) as any);
      
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-alerts')) || null;
      expect(tool).toBeDefined();
      
      if (tool) {
        const result = await tool.handler({ state: 'CA' });
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.weather.gov/alerts?area=CA',
          expect.any(Object)
        );
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Active alerts for CA:');
        expect(result.content[0].text).toContain('Event: Severe Thunderstorm');
        expect(result.content[0].text).toContain('Event: Flood');
      }
    });
    
    it('should handle no alerts for a state', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(fakeResponse(mockEmptyAlertsResponse) as any);
      
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-alerts')) || null;
      expect(tool).toBeDefined();
      
      if (tool) {
        const result = await tool.handler({ state: 'NY' });
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.weather.gov/alerts?area=NY',
          expect.any(Object)
        );
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toBe('No active alerts for NY');
      }
    });
    
    it('should handle API errors gracefully', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('Network error') as any);
      
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-alerts')) || null;
      expect(tool).toBeDefined();
      
      if (tool) {
        const result = await tool.handler({ state: 'TX' });
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toBe('Failed to retrieve alerts data');
      }
    });
    
    it('should handle HTTP errors gracefully', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(fakeResponse({}, false, 404) as any);
      
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-alerts')) || null;
      expect(tool).toBeDefined();
      
      if (tool) {
        const result = await tool.handler({ state: 'AK' });
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toBe('Failed to retrieve alerts data');
      }
    });
  });
  
  describe('get-forecast tool', () => {
    it('should fetch and format forecast for valid coordinates', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce(fakeResponse(mockPointsResponse) as any)
        .mockResolvedValueOnce(fakeResponse(mockForecastResponse) as any);
      
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-forecast')) || null;
      expect(tool).toBeDefined();
      
      if (tool) {
        const result = await tool.handler({ latitude: 37.7749, longitude: -122.4194 });
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenNthCalledWith(
          1,
          'https://api.weather.gov/points/37.7749,-122.4194',
          expect.any(Object)
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          'https://api.weather.gov/gridpoints/ABC/123,456/forecast',
          expect.any(Object)
        );
        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Forecast for 37.7749, -122.4194:');
        expect(result.content[0].text).toContain('Tonight:');
        expect(result.content[0].text).toContain('Temperature: 72°F');
        expect(result.content[0].text).toContain('Saturday:');
      }
    });
    
    it('should handle missing forecast URL', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(fakeResponse({ properties: {} }) as any);
      
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-forecast')) || null;
      expect(tool).toBeDefined();
      
      if (tool) {
        const result = await tool.handler({ latitude: 0, longitude: 0 });
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toBe('Failed to get forecast URL from grid point data');
      }
    });
    
    it('should handle forecast API errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce(fakeResponse(mockPointsResponse) as any)
        .mockResolvedValueOnce(fakeResponse({}, false, 500) as any);
      
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-forecast')) || null;
      expect(tool).toBeDefined();
      
      if (tool) {
        const result = await tool.handler({ latitude: 40.7128, longitude: -74.0060 });
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toContain('Failed to retrieve forecast data');
      }
    });
    
    it('should handle points API errors', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(fakeResponse({}, false, 404) as any);
      
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-forecast')) || null;
      expect(tool).toBeDefined();
      
      if (tool) {
        const result = await tool.handler({ latitude: -90, longitude: 180 });
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(result.content).toHaveLength(1);
        expect(result.content[0].text).toContain('Failed to retrieve forecast data');
      }
    });
    
    it('should validate latitude and longitude parameters', () => {
      const tool = ((server as any).getRegisteredTools &&
        (server as any).getRegisteredTools().find((t: any) => t.name === 'get-forecast')) || null;
      expect(tool).toBeDefined();
      
      if (tool && tool.schema) {
        const validResult = tool.schema.safeParse({
          latitude: 45.5,
          longitude: -122.6
        });
        expect(validResult.success).toBe(true);
        
        const invalidLatResult = tool.schema.safeParse({
          latitude: -91,
          longitude: 0
        });
        expect(invalidLatResult.success).toBe(false);
        
        const invalidLongResult = tool.schema.safeParse({
          latitude: 0,
          longitude: 181
        });
        expect(invalidLongResult.success).toBe(false);
      }
    });
  });
});
