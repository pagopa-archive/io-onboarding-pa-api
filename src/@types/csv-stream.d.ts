declare module "csv-stream" {
  import stream = require("stream");

  export function createStream(options?: {
    delimiter?: string;
    endLine?: string;
    columns?: ReadonlyArray<string>;
    columnOffset?: number;
    escapeChar?: string;
    enclosedChar?: string;
  }): stream.Writable;
}
