import { describe, expect, it, vi } from "vitest";
import { onRequest } from "../../functions/api/[[path]]";

describe("production Pages API route", () => {
	it("forwards the original request to the bound Worker", async () => {
		const request = new Request(
			"https://placeshub-web.pages.dev/api/places?q=coffee",
			{
				method: "POST",
				headers: {
					Authorization: "Bearer sample",
					"Content-Type": "application/json",
				},
				body: '{"test":true}',
			},
		);
		const response = new Response('{"ok":true}', { status: 201 });
		const fetch = vi.fn().mockResolvedValue(response);

		expect(await onRequest({ request, env: { API: { fetch } } })).toBe(
			response,
		);
		expect(fetch).toHaveBeenCalledWith(request);
	});

	it("returns a clear error when the service binding is missing", async () => {
		const request = new Request(
			"https://preview.placeshub-web.pages.dev/api/health",
		);
		const response = await onRequest({ request, env: {} });
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			error: "API service binding is not configured",
		});
	});
});
