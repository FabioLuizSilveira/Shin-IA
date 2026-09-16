// pdf-parse's own index.js has a module-load footgun under Next.js's
// webpack wrapping (see the import-site comment in lib/ai/attachments.ts),
// so that file imports the package's internal lib/pdf-parse.js directly
// instead — a subpath @types/pdf-parse doesn't cover. Re-export the same
// shape the public "pdf-parse" module declares.
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse = require("pdf-parse");
  export = PdfParse;
}
