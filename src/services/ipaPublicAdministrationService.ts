import { createStream } from "csv-stream";
import * as es from "event-stream";
import fetch from "node-fetch";
import { INDICEPA_URL } from "../config";
import {
  init as initIpaPublicAdministration,
  IpaPublicAdministration as IpaPublicAdministrationModel
} from "../models/IpaPublicAdministration";
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
          if (!entry.Cf || !entry.Cf.match(/^\d{2,}$/)) {
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

/**
 * Populates the table of Public Administrations from IPA if it's still empty
 */
export async function populateIpaPublicAdministrationTable():
  | Promise<boolean>
  | never {
  try {
    initIpaPublicAdministration();
    const IpaPublicAdministrationCount = await IpaPublicAdministrationModel.count();
    if (IpaPublicAdministrationCount === 0) {
      log.debug("Populating IpaPublicAdministration table...");
      await upsertFromIpa();
      return true;
    } else {
      log.debug("IpaPublicAdministration table already populated.");
      return false;
    }
  } catch (error) {
    log.error(
      "An error occurred counting entries in IpaPublicAdministration table."
    );
    return process.exit(1);
  }
}
