import type {
  ExternalInfraction,
  InfractionProvider,
  InfractionProviderCapabilities,
} from "./types.js";

const MANUAL_CAPABILITIES: InfractionProviderCapabilities = {
  supportsPull: false,
  supportsPush: false,
  supportsDriverIdentification: false,
  supportsPaymentStatus: false,
  supportsAppealSubmission: false,
};

// Item 6 — administrative manual entry. fetchInfractions() here just
// validates/normalizes the single record a staff member typed in; there's
// no external fetch, "pull" is false by design.
export class ManualInfractionProvider implements InfractionProvider {
  readonly source = "manual" as const;
  readonly capabilities = MANUAL_CAPABILITIES;

  async fetchInfractions(input: ExternalInfraction): Promise<ExternalInfraction[]> {
    return [input];
  }
}

const CSV_CAPABILITIES: InfractionProviderCapabilities = {
  supportsPull: false,
  supportsPush: false,
  supportsDriverIdentification: false,
  supportsPaymentStatus: false,
  supportsAppealSubmission: false,
};

// Item 6/34 — structured CSV import. Column mapping happens at the
// caller/API-route level (item 34: "não assumir um único layout
// universal"); by the time rows reach this provider they're already
// normalized ExternalInfraction records.
export class CsvInfractionProvider implements InfractionProvider {
  readonly source = "csv_import" as const;
  readonly capabilities = CSV_CAPABILITIES;

  async fetchInfractions(input: ExternalInfraction[]): Promise<ExternalInfraction[]> {
    return input;
  }
}

// Item 6/28 — explicit adapter for "official integration not configured
// yet", the exact same house pattern as
// packages/inspection-engine/src/media-comparison-provider.ts's
// NullMediaComparisonProvider: never silently fabricates data as if it
// came from a real official source (Senatran/RENAINF/SNE/Serpro). Any
// route that tries to sync from an official provider before one is wired
// gets an explicit, typed rejection, not empty success.
export class NullOfficialProviderError extends Error {}

export class NullOfficialProvider implements InfractionProvider {
  readonly source: InfractionProvider["source"];
  readonly capabilities: InfractionProviderCapabilities = {
    supportsPull: false,
    supportsPush: false,
    supportsDriverIdentification: false,
    supportsPaymentStatus: false,
    supportsAppealSubmission: false,
  };

  constructor(source: InfractionProvider["source"]) {
    this.source = source;
  }

  fetchInfractions(): Promise<ExternalInfraction[]> {
    return Promise.reject(
      new NullOfficialProviderError(
        `Integração oficial com "${this.source}" ainda não foi configurada. Nenhum dado foi simulado.`,
      ),
    );
  }
}
