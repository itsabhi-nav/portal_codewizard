import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearLicenseEdgeCache, createLicenseMiddleware } from "../packages/codewizard-license/src/middleware";

describe("client website license middleware", () => {
  afterEach(() => {
    clearLicenseEdgeCache();
    vi.unstubAllGlobals();
  });

  it("redirects suspended websites to the renewal page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ success: true, data: { payload: { license_valid: false } } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const middleware = createLicenseMiddleware({
      apiUrl: "https://codewizard.example",
      websiteId: "cw_test123",
      websiteSecret: "test-secret",
    });
    const response = await middleware(new NextRequest("https://client.example/private"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://client.example/renew");
  });

  it("leaves the renewal route accessible while the license is suspended", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const middleware = createLicenseMiddleware({
      apiUrl: "https://codewizard.example",
      websiteId: "cw_test123",
      websiteSecret: "test-secret",
    });
    const response = await middleware(new NextRequest("https://client.example/renew"));

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechecks the license on each request by default", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { payload: { license_valid: false } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { payload: { license_valid: true } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);
    const middleware = createLicenseMiddleware({
      apiUrl: "https://codewizard.example",
      websiteId: "cw_test123",
      websiteSecret: "test-secret",
    });

    const suspended = await middleware(new NextRequest("https://client.example/private"));
    const active = await middleware(new NextRequest("https://client.example/private"));

    expect(suspended.status).toBe(307);
    expect(active.headers.get("x-middleware-next")).toBe("1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
