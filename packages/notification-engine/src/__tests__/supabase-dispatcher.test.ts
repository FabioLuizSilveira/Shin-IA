import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SupabaseEmailDispatcher } from "../dispatcher.js";
import type { DispatchPayload } from "../dispatcher.js";

describe("SupabaseEmailDispatcher", () => {
  const supabaseUrl = "https://example.supabase.co";
  const supabaseServiceKey = "secret-service-key";
  let dispatcher: SupabaseEmailDispatcher;

  beforeEach(() => {
    dispatcher = new SupabaseEmailDispatcher(supabaseUrl, supabaseServiceKey);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should successfully send an email using default template", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ id: "email-id-123" }),
    };
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchSpy);

    const payload: DispatchPayload = {
      channelType: "email",
      recipientAddress: "user@example.com",
      subject: "Welcome!",
      body: "Hello world",
      metadata: {},
    };

    const result = await dispatcher.dispatch(payload);

    expect(result).toEqual({ success: true, externalId: "email-id-123" });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.supabase.co/functions/v1/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret-service-key",
      },
      body: JSON.stringify({
        to: "user@example.com",
        template: "welcome",
        data: {
          subject: "Welcome!",
          body: "Hello world",
        },
      }),
    });
  });

  it("should send correct template and variables when specified in metadata", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ id: "email-id-456" }),
    };
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchSpy);

    const payload: DispatchPayload = {
      channelType: "email",
      recipientAddress: "invitee@example.com",
      subject: "Invitation",
      body: "Join us",
      metadata: {
        template: "invite",
        data: {
          inviter_name: "Bob",
          tenant_name: "Acme Corp",
          accept_url: "https://example.com/accept",
        },
      },
    };

    const result = await dispatcher.dispatch(payload);

    expect(result).toEqual({ success: true, externalId: "email-id-456" });
    expect(fetchSpy).toHaveBeenCalledWith("https://example.supabase.co/functions/v1/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer secret-service-key",
      },
      body: JSON.stringify({
        to: "invitee@example.com",
        template: "invite",
        data: {
          inviter_name: "Bob",
          tenant_name: "Acme Corp",
          accept_url: "https://example.com/accept",
        },
      }),
    });
  });

  it("should handle error response in json from edge function", async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ error: "Resend API key missing or invalid" }),
    };
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchSpy);

    const payload: DispatchPayload = {
      channelType: "email",
      recipientAddress: "test@example.com",
      subject: "Test",
      body: "Test body",
      metadata: {},
    };

    const result = await dispatcher.dispatch(payload);

    expect(result).toEqual({ success: false, error: "Resend API key missing or invalid" });
  });

  it("should handle HTTP error status from edge function", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    };
    const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal("fetch", fetchSpy);

    const payload: DispatchPayload = {
      channelType: "email",
      recipientAddress: "test@example.com",
      subject: "Test",
      body: "Test body",
      metadata: {},
    };

    const result = await dispatcher.dispatch(payload);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Supabase edge function HTTP error 500: Internal Server Error");
  });

  it("should handle fetch exceptions", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("Network connection failed"));
    vi.stubGlobal("fetch", fetchSpy);

    const payload: DispatchPayload = {
      channelType: "email",
      recipientAddress: "test@example.com",
      subject: "Test",
      body: "Test body",
      metadata: {},
    };

    const result = await dispatcher.dispatch(payload);

    expect(result).toEqual({ success: false, error: "Network connection failed" });
  });
});
