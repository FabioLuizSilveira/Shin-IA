import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { appUrl } from "@/lib/domain";

// Renders the professional laudo (item 6 of the spec) from an already
// generated inspection_reports row — NEVER from live/mutable asset or
// customer data. rendered_content is the immutable snapshot; this module
// only lays it out as a PDF, it doesn't re-derive anything from the
// current state of the inspection.

export interface InspectionPdfInput {
  reportId: string;
  version: number;
  contentHash: string;
  generatedAt: string;
  verificationToken: string;
  tenant: { name: string; logoUrl: string | null };
  inspection: {
    id: string;
    type: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  asset: { name: string; category: string | null; identifier: string | null } | null;
  contract: { number: string; customerName: string | null; period: string | null } | null;
  operator: { fullName: string } | null;
  template: {
    sections: {
      title: string;
      items: {
        label: string;
        fieldType: string;
        response: string;
        notes: string | null;
      }[];
    }[];
  } | null;
  media: {
    id: string;
    itemLabel: string | null;
    capturedAt: string;
    signedUrl: string | null;
  }[];
  beforeAfter: {
    itemLabel: string;
    before: string | null;
    after: string | null;
    differs: boolean;
  }[];
  findings: {
    location: string | null;
    description: string;
    severity: string;
    status: string;
    preexisting: boolean;
  }[];
  signatures: {
    signerType: string;
    signerName: string;
    signedAt: string;
    method: string;
  }[];
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  logo: { width: 90, height: 32, objectFit: "contain" },
  tenantName: { fontSize: 14, fontWeight: 700 },
  h1: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#555" },
  section: { marginTop: 14, marginBottom: 6 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
    borderBottom: "1 solid #ddd",
    paddingBottom: 2,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottom: "0.5 solid #eee",
  },
  label: { flex: 2, color: "#333" },
  value: { flex: 1, textAlign: "right", color: "#111" },
  small: { fontSize: 8, color: "#666" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoBox: { width: 110, marginBottom: 8 },
  photo: { width: 110, height: 80, objectFit: "cover", borderRadius: 4 },
  baRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  baCol: { flex: 1 },
  baImg: { width: "100%", height: 90, objectFit: "cover", borderRadius: 4 },
  finding: { marginBottom: 6, padding: 6, backgroundColor: "#fff8f0", borderRadius: 4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1 solid #ddd",
    paddingTop: 8,
  },
  qr: { width: 56, height: 56 },
});

function InspectionReportDocument({
  data,
  qrDataUrl,
}: {
  data: InspectionPdfInput;
  qrDataUrl: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            {data.tenant.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={data.tenant.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.tenantName}>{data.tenant.name}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.h1}>Laudo de Vistoria Digital</Text>
            <Text style={styles.meta}>VIS-{data.inspection.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.meta}>
              {data.inspection.type} · {data.inspection.status}
            </Text>
          </View>
        </View>

        {data.asset && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ativo</Text>
            <View style={styles.row}>
              <Text style={styles.label}>{data.asset.name}</Text>
              <Text style={styles.value}>{data.asset.identifier ?? "—"}</Text>
            </View>
            {data.asset.category && (
              <View style={styles.row}>
                <Text style={styles.label}>Categoria</Text>
                <Text style={styles.value}>{data.asset.category}</Text>
              </View>
            )}
          </View>
        )}

        {data.contract && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contrato</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Número</Text>
              <Text style={styles.value}>{data.contract.number}</Text>
            </View>
            {data.contract.customerName && (
              <View style={styles.row}>
                <Text style={styles.label}>Cliente</Text>
                <Text style={styles.value}>{data.contract.customerName}</Text>
              </View>
            )}
            {data.contract.period && (
              <View style={styles.row}>
                <Text style={styles.label}>Período</Text>
                <Text style={styles.value}>{data.contract.period}</Text>
              </View>
            )}
            {data.operator && (
              <View style={styles.row}>
                <Text style={styles.label}>Operador</Text>
                <Text style={styles.value}>{data.operator.fullName}</Text>
              </View>
            )}
          </View>
        )}

        {(data.template?.sections ?? []).map((section, i) => (
          <View style={styles.section} key={i} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item, j) => (
              <View style={styles.row} key={j}>
                <Text style={styles.label}>
                  {item.label}
                  {item.notes ? ` — ${item.notes}` : ""}
                </Text>
                <Text style={styles.value}>{item.response}</Text>
              </View>
            ))}
          </View>
        ))}

        {data.media.length > 0 && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Evidências</Text>
            <View style={styles.photoGrid}>
              {data.media.slice(0, 24).map((m) => (
                <View style={styles.photoBox} key={m.id}>
                  {m.signedUrl && <Image src={m.signedUrl} style={styles.photo} />}
                  <Text style={styles.small}>{m.itemLabel ?? "—"}</Text>
                  <Text style={styles.small}>{new Date(m.capturedAt).toLocaleString("pt-BR")}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.beforeAfter.length > 0 && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Comparação — Check-in × Check-out</Text>
            {data.beforeAfter.map((ba, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, marginBottom: 3 }}>
                  {ba.itemLabel} {ba.differs ? "— DIVERGE" : ""}
                </Text>
                <View style={styles.baRow}>
                  <View style={styles.baCol}>
                    <Text style={styles.small}>CHECK-IN</Text>
                    <Text style={{ fontSize: 9 }}>{ba.before ?? "—"}</Text>
                  </View>
                  <View style={styles.baCol}>
                    <Text style={styles.small}>CHECK-OUT</Text>
                    <Text style={{ fontSize: 9 }}>{ba.after ?? "—"}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {data.findings.length > 0 && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Avarias / Constatações</Text>
            {data.findings.map((f, i) => (
              <View style={styles.finding} key={i}>
                <Text style={{ fontWeight: 700 }}>
                  {f.location ?? "Local não informado"} — {f.severity}
                  {f.preexisting ? " (pré-existente)" : ""}
                </Text>
                <Text>{f.description}</Text>
                <Text style={styles.small}>Status: {f.status}</Text>
              </View>
            ))}
          </View>
        )}

        {data.signatures.length > 0 && (
          <View style={styles.section} break>
            <Text style={styles.sectionTitle}>Aceites</Text>
            {data.signatures.map((s, i) => (
              <View style={styles.row} key={i}>
                <Text style={styles.label}>
                  {s.signerType} — {s.signerName}
                </Text>
                <Text style={styles.value}>{new Date(s.signedAt).toLocaleString("pt-BR")}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <View>
            <Text style={styles.small}>Inspection: {data.inspection.id}</Text>
            <Text style={styles.small}>
              Report: {data.reportId} · v{data.version}
            </Text>
            <Text style={styles.small}>Hash: {data.contentHash}</Text>
            <Text style={styles.small}>
              Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={qrDataUrl} style={styles.qr} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderInspectionReportPdf(data: InspectionPdfInput): Promise<Buffer> {
  const verifyUrl = appUrl(`/verify/inspection-report/${data.verificationToken}`);
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 200 });
  return renderToBuffer(<InspectionReportDocument data={data} qrDataUrl={qrDataUrl} />);
}
