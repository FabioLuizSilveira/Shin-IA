import { describe, it, expect, vi } from "vitest";
import { TemplateEngine } from "../template-engine.js";
import {
  DispatcherRegistry,
  NoOpEmailDispatcher,
  NoOpSmsDispatcher,
  NoOpPushDispatcher,
  NoOpInAppDispatcher,
  NoOpWebhookDispatcher,
  type ChannelDispatcher,
} from "../dispatcher.js";
import { NotificationRuntime } from "../notification-runtime.js";
import type {
  NotificationChannel,
  NotificationChannelRepository,
  NotificationChannelType,
  NotificationHistory,
  NotificationHistoryRepository,
  NotificationPreferences,
  NotificationPreferencesRepository,
  NotificationQueue,
  NotificationQueueRepository,
  NotificationTemplate,
  NotificationTemplateRepository,
} from "../types.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeChannel = (overrides: Partial<NotificationChannel> = {}): NotificationChannel => ({
  id: "channel-1",
  tenantId: "tenant-1",
  type: "email",
  name: "Default Email",
  config: { from: "noreply@example.com" },
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeTemplate = (overrides: Partial<NotificationTemplate> = {}): NotificationTemplate => ({
  id: "template-1",
  tenantId: "tenant-1",
  name: "welcome",
  channelType: "email",
  subject: "Welcome {{name}}!",
  body: "Hello {{name}}, welcome to {{platform}}.",
  variables: ["name", "platform"],
  locale: "en",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeQueueItem = (overrides: Partial<NotificationQueue> = {}): NotificationQueue => ({
  id: "queue-1",
  tenantId: "tenant-1",
  channelId: "channel-1",
  templateId: "template-1",
  recipientId: "user-1",
  recipientAddress: "user@example.com",
  subject: "Welcome!",
  body: "Hello, welcome to the platform.",
  metadata: {},
  status: "pending",
  attempts: 0,
  maxAttempts: 3,
  nextRetryAt: null,
  scheduledAt: null,
  sentAt: null,
  failedAt: null,
  error: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makePreferences = (
  overrides: Partial<NotificationPreferences> = {},
): NotificationPreferences => ({
  id: "prefs-1",
  tenantId: "tenant-1",
  recipientId: "user-1",
  channels: { email: true, sms: true, push: true, in_app: true, webhook: true },
  quiet: { enabled: false, startHour: 22, endHour: 8, timezone: "America/Sao_Paulo" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// ─── Repo mocks ───────────────────────────────────────────────────────────────

function makeChannelRepo(
  channel: NotificationChannel | null = makeChannel(),
): NotificationChannelRepository {
  return {
    findById: vi.fn().mockResolvedValue(channel),
    findByTenantId: vi.fn().mockResolvedValue(channel ? [channel] : []),
    findActiveByType: vi.fn().mockResolvedValue(channel ? [channel] : []),
    save: vi.fn().mockImplementation((c: NotificationChannel) => Promise.resolve(c)),
    update: vi.fn().mockImplementation((c: NotificationChannel) => Promise.resolve(c)),
  };
}

function makeTemplateRepo(
  template: NotificationTemplate | null = makeTemplate(),
): NotificationTemplateRepository {
  return {
    findById: vi.fn().mockResolvedValue(template),
    findByTenantId: vi.fn().mockResolvedValue(template ? [template] : []),
    findByName: vi.fn().mockResolvedValue(template),
    save: vi.fn().mockImplementation((t: NotificationTemplate) => Promise.resolve(t)),
    update: vi.fn().mockImplementation((t: NotificationTemplate) => Promise.resolve(t)),
  };
}

function makeQueueRepo(item: NotificationQueue | null = null): NotificationQueueRepository {
  return {
    findById: vi.fn().mockResolvedValue(item),
    findPending: vi.fn().mockResolvedValue(item ? [item] : []),
    findByRecipient: vi.fn().mockResolvedValue(item ? [item] : []),
    save: vi.fn().mockImplementation((q: NotificationQueue) => Promise.resolve(q)),
    update: vi.fn().mockImplementation((q: NotificationQueue) => Promise.resolve(q)),
  };
}

function makePrefsRepo(
  prefs: NotificationPreferences | null = null,
): NotificationPreferencesRepository {
  return {
    findByRecipient: vi.fn().mockResolvedValue(prefs),
    save: vi.fn().mockImplementation((p: NotificationPreferences) => Promise.resolve(p)),
    update: vi.fn().mockImplementation((p: NotificationPreferences) => Promise.resolve(p)),
  };
}

function makeHistoryRepo(): NotificationHistoryRepository {
  return {
    findByRecipient: vi.fn().mockResolvedValue([]),
    findByQueueId: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockImplementation((h: NotificationHistory) => Promise.resolve(h)),
  };
}

function makeRuntime(
  overrides: {
    channelRepo?: NotificationChannelRepository;
    templateRepo?: NotificationTemplateRepository;
    queueRepo?: NotificationQueueRepository;
    prefsRepo?: NotificationPreferencesRepository;
    historyRepo?: NotificationHistoryRepository;
    registry?: DispatcherRegistry;
  } = {},
) {
  const registry =
    overrides.registry ??
    (() => {
      const r = new DispatcherRegistry();
      r.register(new NoOpEmailDispatcher());
      r.register(new NoOpSmsDispatcher());
      r.register(new NoOpPushDispatcher());
      r.register(new NoOpInAppDispatcher());
      r.register(new NoOpWebhookDispatcher());
      return r;
    })();

  return new NotificationRuntime(
    overrides.channelRepo ?? makeChannelRepo(),
    overrides.templateRepo ?? makeTemplateRepo(),
    overrides.queueRepo ?? makeQueueRepo(),
    overrides.prefsRepo ?? makePrefsRepo(),
    overrides.historyRepo ?? makeHistoryRepo(),
    new TemplateEngine(),
    registry,
  );
}

// ─── TemplateEngine tests ─────────────────────────────────────────────────────

describe("TemplateEngine", () => {
  const engine = new TemplateEngine();

  it("interpolates variables in body", () => {
    const result = engine.interpolate("Hello {{name}}!", { name: "Alice" });
    expect(result).toBe("Hello Alice!");
  });

  it("leaves unknown variables intact", () => {
    const result = engine.interpolate("Hello {{name}}!", {});
    expect(result).toBe("Hello {{name}}!");
  });

  it("replaces multiple occurrences", () => {
    const result = engine.interpolate("{{a}} and {{a}} and {{b}}", { a: "X", b: "Y" });
    expect(result).toBe("X and X and Y");
  });

  it("extracts variables from text", () => {
    const vars = engine.extractVariables("Hello {{name}}, your code is {{code}}.");
    expect(vars).toContain("name");
    expect(vars).toContain("code");
    expect(vars).toHaveLength(2);
  });

  it("deduplicates extracted variables", () => {
    const vars = engine.extractVariables("{{x}} and {{x}}");
    expect(vars).toHaveLength(1);
  });

  it("returns empty array when no variables", () => {
    const vars = engine.extractVariables("No variables here.");
    expect(vars).toHaveLength(0);
  });

  it("renders template with subject and body", () => {
    const template = makeTemplate();
    const result = engine.render(template, { name: "Bob", platform: "Shinã" });
    expect(result.subject).toBe("Welcome Bob!");
    expect(result.body).toBe("Hello Bob, welcome to Shinã.");
  });

  it("renders template with null subject", () => {
    const template = makeTemplate({ subject: null });
    const result = engine.render(template, { name: "Bob", platform: "Shinã" });
    expect(result.subject).toBeNull();
  });
});

// ─── DispatcherRegistry tests ─────────────────────────────────────────────────

describe("DispatcherRegistry", () => {
  it("registers and retrieves dispatchers", () => {
    const registry = new DispatcherRegistry();
    registry.register(new NoOpEmailDispatcher());
    expect(registry.has("email")).toBe(true);
    expect(registry.get("email")).toBeDefined();
  });

  it("throws for unregistered channel type", () => {
    const registry = new DispatcherRegistry();
    expect(() => registry.get("email")).toThrow("no dispatcher registered");
  });

  it("lists registered channel types", () => {
    const registry = new DispatcherRegistry();
    registry.register(new NoOpEmailDispatcher());
    registry.register(new NoOpSmsDispatcher());
    expect(registry.list()).toContain("email");
    expect(registry.list()).toContain("sms");
  });

  it("all NoOp dispatchers return success", async () => {
    const dispatchers: ChannelDispatcher[] = [
      new NoOpEmailDispatcher(),
      new NoOpSmsDispatcher(),
      new NoOpPushDispatcher(),
      new NoOpInAppDispatcher(),
      new NoOpWebhookDispatcher(),
    ];
    for (const d of dispatchers) {
      const result = await d.dispatch({
        channelType: d.channelType,
        recipientAddress: "test",
        subject: null,
        body: "test",
        metadata: {},
      });
      expect(result.success).toBe(true);
    }
  });
});

// ─── NotificationRuntime.enqueue tests ───────────────────────────────────────

describe("NotificationRuntime.enqueue", () => {
  it("enqueues notification with raw body", async () => {
    const queueRepo = makeQueueRepo();
    const runtime = makeRuntime({ queueRepo });

    const result = await runtime.enqueue({
      tenantId: "tenant-1",
      channelType: "email",
      recipientId: "user-1",
      recipientAddress: "user@example.com",
      subject: "Hello",
      body: "World",
    });

    expect(result.status).toBe("pending");
    expect(result.queueId).toBeTruthy();
    expect(queueRepo.save).toHaveBeenCalledOnce();
  });

  it("enqueues notification using template", async () => {
    const queueRepo = makeQueueRepo();
    const runtime = makeRuntime({ queueRepo });

    const result = await runtime.enqueue({
      tenantId: "tenant-1",
      channelType: "email",
      recipientId: "user-1",
      recipientAddress: "user@example.com",
      templateName: "welcome",
      templateContext: { name: "Alice", platform: "Shinã" },
    });

    expect(result.status).toBe("pending");
    expect(queueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-1", body: "Hello Alice, welcome to Shinã." }),
    );
  });

  it("skips when recipient has disabled the channel", async () => {
    const prefs = makePreferences({ channels: { email: false } });
    const runtime = makeRuntime({ prefsRepo: makePrefsRepo(prefs) });

    const result = await runtime.enqueue({
      tenantId: "tenant-1",
      channelType: "email",
      recipientId: "user-1",
      recipientAddress: "user@example.com",
      body: "Test",
    });

    expect(result.status).toBe("skipped");
  });

  it("throws when no active channel found", async () => {
    const channelRepo = makeChannelRepo(null);
    const runtime = makeRuntime({ channelRepo });

    await expect(
      runtime.enqueue({
        tenantId: "tenant-1",
        channelType: "email",
        recipientId: "user-1",
        recipientAddress: "user@example.com",
        body: "Test",
      }),
    ).rejects.toThrow("no active channel");
  });

  it("throws when template not found", async () => {
    const templateRepo = makeTemplateRepo(null);
    const runtime = makeRuntime({ templateRepo });

    await expect(
      runtime.enqueue({
        tenantId: "tenant-1",
        channelType: "email",
        recipientId: "user-1",
        recipientAddress: "user@example.com",
        templateName: "missing-template",
      }),
    ).rejects.toThrow('template "missing-template" not found');
  });

  it("throws when neither body nor template provided", async () => {
    const runtime = makeRuntime();

    await expect(
      runtime.enqueue({
        tenantId: "tenant-1",
        channelType: "email",
        recipientId: "user-1",
        recipientAddress: "user@example.com",
      }),
    ).rejects.toThrow("either templateName or body must be provided");
  });

  it("respects scheduledAt and maxAttempts overrides", async () => {
    const queueRepo = makeQueueRepo();
    const runtime = makeRuntime({ queueRepo });

    await runtime.enqueue({
      tenantId: "tenant-1",
      channelType: "email",
      recipientId: "user-1",
      recipientAddress: "user@example.com",
      body: "Test",
      scheduledAt: "2026-12-01T09:00:00.000Z",
      maxAttempts: 5,
    });

    expect(queueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledAt: "2026-12-01T09:00:00.000Z", maxAttempts: 5 }),
    );
  });
});

// ─── NotificationRuntime.process tests ───────────────────────────────────────

describe("NotificationRuntime.process", () => {
  it("processes and marks item as sent", async () => {
    const item = makeQueueItem();
    const queueRepo = makeQueueRepo(item);
    const historyRepo = makeHistoryRepo();
    const runtime = makeRuntime({ queueRepo, historyRepo });

    const result = await runtime.process("queue-1");

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(queueRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent", sentAt: expect.any(String) }),
    );
    expect(historyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
  });

  it("throws when queue item not found", async () => {
    const runtime = makeRuntime();
    await expect(runtime.process("nonexistent")).rejects.toThrow("not found");
  });

  it("throws when channel not found", async () => {
    const item = makeQueueItem({ channelId: "missing-channel" });
    const queueRepo = makeQueueRepo(item);
    const channelRepo = makeChannelRepo(null);
    const runtime = makeRuntime({ queueRepo, channelRepo });

    await expect(runtime.process("queue-1")).rejects.toThrow("not found");
  });

  it("returns early when item is already sent", async () => {
    const item = makeQueueItem({ status: "sent" });
    const queueRepo = makeQueueRepo(item);
    const runtime = makeRuntime({ queueRepo });

    const result = await runtime.process("queue-1");
    expect(result.success).toBe(true);
    expect(queueRepo.update).not.toHaveBeenCalled();
  });

  it("retries on dispatch failure and keeps pending when attempts < max", async () => {
    const item = makeQueueItem({ attempts: 0, maxAttempts: 3 });
    const queueRepo = makeQueueRepo(item);

    const failingDispatcher: ChannelDispatcher = {
      channelType: "email",
      dispatch: vi.fn().mockRejectedValue(new Error("SMTP timeout")),
    };
    const registry = new DispatcherRegistry();
    registry.register(failingDispatcher);
    const runtime = makeRuntime({ queueRepo, registry });

    const result = await runtime.process("queue-1");

    expect(result.success).toBe(false);
    expect(result.error).toContain("SMTP timeout");
    expect(queueRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", nextRetryAt: expect.any(String) }),
    );
  });

  it("marks as failed and writes history after max attempts", async () => {
    const item = makeQueueItem({ attempts: 2, maxAttempts: 3 });
    const queueRepo = makeQueueRepo(item);
    const historyRepo = makeHistoryRepo();

    const failingDispatcher: ChannelDispatcher = {
      channelType: "email",
      dispatch: vi.fn().mockResolvedValue({ success: false, error: "blocked" }),
    };
    const registry = new DispatcherRegistry();
    registry.register(failingDispatcher);
    const runtime = makeRuntime({ queueRepo, historyRepo, registry });

    const result = await runtime.process("queue-1");

    expect(result.success).toBe(false);
    expect(queueRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failedAt: expect.any(String) }),
    );
    expect(historyRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
  });
});

// ─── NotificationRuntime.processBatch tests ──────────────────────────────────

describe("NotificationRuntime.processBatch", () => {
  it("processes all pending items", async () => {
    const item1 = makeQueueItem({ id: "queue-1" });
    const item2 = makeQueueItem({ id: "queue-2" });

    const queueRepo: NotificationQueueRepository = {
      findById: vi
        .fn()
        .mockImplementation((id: string) => Promise.resolve(id === "queue-1" ? item1 : item2)),
      findPending: vi.fn().mockResolvedValue([item1, item2]),
      findByRecipient: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockImplementation((q: NotificationQueue) => Promise.resolve(q)),
      update: vi.fn().mockImplementation((q: NotificationQueue) => Promise.resolve(q)),
    };

    const runtime = makeRuntime({ queueRepo });
    const results = await runtime.processBatch(10);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("returns empty array when no pending items", async () => {
    const queueRepo = makeQueueRepo();
    const runtime = makeRuntime({ queueRepo });
    const results = await runtime.processBatch();
    expect(results).toHaveLength(0);
  });
});

// ─── getDispatcherRegistry ────────────────────────────────────────────────────

describe("NotificationRuntime.getDispatcherRegistry", () => {
  it("returns the dispatcher registry", () => {
    const runtime = makeRuntime();
    const registry = runtime.getDispatcherRegistry();
    expect(registry.has("email")).toBe(true);
  });
});

// ─── Channel types coverage ───────────────────────────────────────────────────

describe("all channel types", () => {
  const channelTypes: NotificationChannelType[] = ["email", "sms", "push", "in_app", "webhook"];

  for (const type of channelTypes) {
    it(`enqueues ${type} notification`, async () => {
      const channel = makeChannel({ type });
      const channelRepo = makeChannelRepo(channel);
      const queueRepo = makeQueueRepo();
      const runtime = makeRuntime({ channelRepo, queueRepo });

      const result = await runtime.enqueue({
        tenantId: "tenant-1",
        channelType: type,
        recipientId: "user-1",
        recipientAddress: "addr",
        body: `Test ${type} body`,
      });

      expect(result.status).toBe("pending");
    });
  }
});
