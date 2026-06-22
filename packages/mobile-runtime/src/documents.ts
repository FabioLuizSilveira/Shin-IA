import type {
  MobileDocument,
  ContractSignature,
  DocumentStatus,
  SignatureStatus,
} from "./types.js";
import { MobileRuntimeError } from "./offline-sync.js";

export class DocumentManager {
  private readonly documents = new Map<string, MobileDocument>();
  private readonly signatures = new Map<string, ContractSignature>();

  createDocument(doc: MobileDocument): void {
    if (this.documents.has(doc.id)) {
      throw new MobileRuntimeError(`Document already exists: ${doc.id}`, "DUPLICATE_DOCUMENT");
    }
    this.documents.set(doc.id, { ...doc });
  }

  getDocument(id: string): MobileDocument {
    const doc = this.documents.get(id);
    if (!doc) throw new MobileRuntimeError(`Document not found: ${id}`, "DOCUMENT_NOT_FOUND");
    return { ...doc };
  }

  updateStatus(id: string, status: DocumentStatus): void {
    const doc = this.documents.get(id);
    if (!doc) throw new MobileRuntimeError(`Document not found: ${id}`, "DOCUMENT_NOT_FOUND");
    this.documents.set(id, { ...doc, status });
  }

  requestSignature(signature: ContractSignature): void {
    const doc = this.documents.get(signature.documentId);
    if (!doc)
      throw new MobileRuntimeError(
        `Document not found: ${signature.documentId}`,
        "DOCUMENT_NOT_FOUND",
      );
    if (doc.status === "expired") {
      throw new MobileRuntimeError(
        `Document is expired: ${signature.documentId}`,
        "DOCUMENT_EXPIRED",
      );
    }
    this.signatures.set(signature.id, { ...signature });
  }

  recordSignature(signatureId: string): ContractSignature {
    const sig = this.signatures.get(signatureId);
    if (!sig)
      throw new MobileRuntimeError(
        `Signature request not found: ${signatureId}`,
        "SIGNATURE_NOT_FOUND",
      );
    if (sig.status !== "pending") {
      throw new MobileRuntimeError(
        `Signature is not pending: ${signatureId}`,
        "INVALID_SIGNATURE_STATE",
      );
    }
    const signed: ContractSignature = {
      ...sig,
      status: "signed",
      signedAt: new Date().toISOString(),
    };
    this.signatures.set(signatureId, signed);
    return signed;
  }

  declineSignature(signatureId: string): void {
    const sig = this.signatures.get(signatureId);
    if (!sig)
      throw new MobileRuntimeError(
        `Signature request not found: ${signatureId}`,
        "SIGNATURE_NOT_FOUND",
      );
    if (sig.status !== "pending") {
      throw new MobileRuntimeError(
        `Signature is not pending: ${signatureId}`,
        "INVALID_SIGNATURE_STATE",
      );
    }
    this.signatures.set(signatureId, { ...sig, status: "declined" });
  }

  listDocumentsByStatus(status: DocumentStatus): MobileDocument[] {
    return [...this.documents.values()].filter((d) => d.status === status);
  }

  listSignaturesByStatus(status: SignatureStatus): ContractSignature[] {
    return [...this.signatures.values()].filter((s) => s.status === status);
  }

  isFullySigned(documentId: string): boolean {
    const sigs = [...this.signatures.values()].filter((s) => s.documentId === documentId);
    if (sigs.length === 0) return false;
    return sigs.every((s) => s.status === "signed");
  }
}
