declare module "x509" {
  function parseCert(path: string): ICertProperties;
}

declare interface ICertProperties {
  notBefore: Date;
  notAfter: Date;
}
