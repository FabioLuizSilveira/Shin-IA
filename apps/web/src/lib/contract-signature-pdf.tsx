import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from "@react-pdf/renderer";

// Renders the frozen contract snapshot (tenant_contract_snapshots.rendered_content)
// as a PDF for the Signature Platform to upload to a provider — same
// discipline as inspection-pdf.tsx: this module lays out ALREADY-FROZEN
// data, it never re-renders live contract/template state. rendered_content
// is plain text, paragraphs already joined by "\n\n" by
// @shina/tenant-contract-engine's ContractTemplateEngine.render() — this
// module's only job is pagination/typography, not re-deriving content.

export interface ContractSignaturePdfInput {
  tenant: { name: string; logoUrl: string | null };
  contract: { number: string; renderedContent: string; contentHash: string };
  generatedAt: string;
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
  paragraph: { marginBottom: 10, lineHeight: 1.5, textAlign: "justify" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "1 solid #ddd",
    paddingTop: 8,
  },
  footerText: { fontSize: 7, color: "#888" },
});

function ContractSignatureDocument({ data }: { data: ContractSignaturePdfInput }) {
  const paragraphs = data.contract.renderedContent.split("\n\n").filter((p) => p.trim().length > 0);

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
            <Text style={styles.h1}>Contrato</Text>
            <Text style={styles.meta}>{data.contract.number}</Text>
          </View>
        </View>

        {paragraphs.map((paragraph, idx) => (
          // eslint-disable-next-line react/no-array-index-key
          <Text key={idx} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Documento gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")} · hash do
            conteúdo: {data.contract.contentHash.slice(0, 16)}…
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderContractSignaturePdf(data: ContractSignaturePdfInput): Promise<Buffer> {
  return renderToBuffer(<ContractSignatureDocument data={data} />);
}
