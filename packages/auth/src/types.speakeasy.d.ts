// Type declarations for speakeasy library
declare module "speakeasy" {
  interface GenerateSecretOptions {
    name?: string;
    issuer?: string;
    length?: number;
    symbols?: boolean;
  }

  interface GenerateSecretResult {
    ascii: string;
    hex: string;
    base32: string;
    qr_code_ascii: string;
    qr_code_html: string;
    qr_code_svg: string;
    otpauth_url: string;
  }

  interface TOTPVerifyOptions {
    secret: string;
    encoding: string;
    token: string;
    window?: number;
  }

  export const generateSecret: (options: GenerateSecretOptions) => GenerateSecretResult;

  export const totp: {
    verify(options: TOTPVerifyOptions): boolean;
  };
}
