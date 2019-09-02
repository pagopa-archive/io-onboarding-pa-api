import { createStream } from "csv-stream";
import * as es from "event-stream";
import fetch from "node-fetch";
import { INDICEPA_URL } from "../config";
import { IpaPublicAdministration as IpaPublicAdministrationModel } from "../models/IpaPublicAdministration";
import { IIpaPublicAdministration } from "../types/PublicAdministration";
import { log } from "../utils/logger";

export function upsertFromIpa(): Promise<void> {
  return new Promise(async resolve => {
    const csvStream = createStream({
      delimiter: "\t"
    });
    const indicepaResponse = await fetch(INDICEPA_URL);
    indicepaResponse.body
      .pipe(csvStream)
      .pipe(
        es.map((entry: IIpaPublicAdministration, cb: () => void) => {
          if (entry.cf_validato !== "S") {
            // filter out entries without a validated CF
            return cb();
          }
          if (!entry.Cf || entry.Cf.length < 2 || !entry.Cf.match(/^\d+$/)) {
            // filter out entries with bogus CF
            return cb();
          }
          IpaPublicAdministrationModel.upsert(entry)
            .then(() => {
              cb();
            })
            .catch(error => {
              log.error(
                "IpaPublicAdministration upsert failed for %s: %s",
                entry.des_amm,
                error
              );
              cb();
            });
        })
      )
      .on("end", () => {
        resolve();
      });
  });
}
