import { describe, it, expect, beforeEach } from "vitest";
import { DocumentManager } from "../documents.js";
import { MobileRuntimeError } from "../offline-sync.js";
import type { MobileDocument, ContractSignature } from "../types.js";

function makeDoc(id = "d1"): MobileDocument {
  return {
    id,
    tenantId: "t1",
    type: "contract",
    title: "Rental Agreement",
    content: "...",
    status: "draft",
    createdAt: "2024-01-01T00:00:00Z",
  };
}

function makeSig(id = "s1", documentId = "d1"): ContractSignature {
  return {
    id,
    documentId,
    signerId: "u1",
    signerName: "Alice",
    status: "pending",
    requestedAt: "2024-01-01T00:00:00Z",
  };
}

describe("DocumentManager", () => {
  let mgr: DocumentManager;

  beforeEach(() => {
    mgr = new DocumentManager();
  });

  describe("createDocument / getDocument", () => {
    it("creates and retrieves a document", () => {
      mgr.createDocument(makeDoc());
      expect(mgr.getDocument("d1").title).toBe("Rental Agreement");
    });

    it("throws DUPLICATE_DOCUMENT on duplicate id", () => {
      mgr.createDocument(makeDoc());
      expect(() => mgr.createDocument(makeDoc())).toThrow(MobileRuntimeError);
    });

    it("throws DOCUMENT_NOT_FOUND for unknown id", () => {
      expect(() => mgr.getDocument("missing")).toThrow(MobileRuntimeError);
    });
  });

  describe("updateStatus", () => {
    it("updates document status", () => {
      mgr.createDocument(makeDoc());
      mgr.updateStatus("d1", "pending_signature");
      expect(mgr.getDocument("d1").status).toBe("pending_signature");
    });

    it("throws DOCUMENT_NOT_FOUND for unknown id", () => {
      expect(() => mgr.updateStatus("missing", "signed")).toThrow(MobileRuntimeError);
    });
  });

  describe("requestSignature", () => {
    it("creates a signature request", () => {
      mgr.createDocument(makeDoc());
      mgr.requestSignature(makeSig());
      expect(mgr.listSignaturesByStatus("pending")).toHaveLength(1);
    });

    it("throws DOCUMENT_NOT_FOUND for unknown document", () => {
      expect(() => mgr.requestSignature(makeSig("s1", "missing"))).toThrow(MobileRuntimeError);
    });

    it("throws DOCUMENT_EXPIRED for expired document", () => {
      mgr.createDocument({ ...makeDoc(), status: "expired" });
      expect(() => mgr.requestSignature(makeSig())).toThrow(MobileRuntimeError);
    });
  });

  describe("recordSignature", () => {
    it("marks signature as signed", () => {
      mgr.createDocument(makeDoc());
      mgr.requestSignature(makeSig());
      const result = mgr.recordSignature("s1");
      expect(result.status).toBe("signed");
      expect(result.signedAt).toBeTruthy();
    });

    it("throws SIGNATURE_NOT_FOUND for unknown id", () => {
      expect(() => mgr.recordSignature("missing")).toThrow(MobileRuntimeError);
    });

    it("throws INVALID_SIGNATURE_STATE when not pending", () => {
      mgr.createDocument(makeDoc());
      mgr.requestSignature(makeSig());
      mgr.recordSignature("s1");
      expect(() => mgr.recordSignature("s1")).toThrow(MobileRuntimeError);
    });
  });

  describe("declineSignature", () => {
    it("marks signature as declined", () => {
      mgr.createDocument(makeDoc());
      mgr.requestSignature(makeSig());
      mgr.declineSignature("s1");
      expect(mgr.listSignaturesByStatus("declined")).toHaveLength(1);
    });

    it("throws SIGNATURE_NOT_FOUND for unknown id", () => {
      expect(() => mgr.declineSignature("missing")).toThrow(MobileRuntimeError);
    });

    it("throws INVALID_SIGNATURE_STATE when not pending", () => {
      mgr.createDocument(makeDoc());
      mgr.requestSignature(makeSig());
      mgr.declineSignature("s1");
      expect(() => mgr.declineSignature("s1")).toThrow(MobileRuntimeError);
    });
  });

  describe("listDocumentsByStatus", () => {
    it("filters by status", () => {
      mgr.createDocument(makeDoc("d1"));
      mgr.createDocument({ ...makeDoc("d2"), status: "pending_signature" });
      expect(mgr.listDocumentsByStatus("draft")).toHaveLength(1);
      expect(mgr.listDocumentsByStatus("pending_signature")).toHaveLength(1);
    });
  });

  describe("isFullySigned", () => {
    it("returns false for document with no signatures", () => {
      mgr.createDocument(makeDoc());
      expect(mgr.isFullySigned("d1")).toBe(false);
    });

    it("returns true when all signatures are signed", () => {
      mgr.createDocument(makeDoc());
      mgr.requestSignature(makeSig());
      mgr.recordSignature("s1");
      expect(mgr.isFullySigned("d1")).toBe(true);
    });

    it("returns false when some signatures are pending", () => {
      mgr.createDocument(makeDoc());
      mgr.requestSignature(makeSig("s1"));
      mgr.requestSignature(makeSig("s2"));
      mgr.recordSignature("s1");
      expect(mgr.isFullySigned("d1")).toBe(false);
    });
  });
});
