import { createStream } from "csv-stream";
import * as es from "event-stream";
import fetch from "node-fetch";
import { INDICEPA_URL } from "../config";
import {
  init as initIpaPublicAdministration,
  IpaPublicAdministration as IpaPublicAdministrationModel
} from "../models/IpaPublicAdministration";
import {
  IIpaPublicAdministrationRaw,
  IpaPublicAdministration
} from "../types/PublicAdministration";
import { log } from "../utils/logger";

export function upsertFromIpa(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const csvStream = createStream({
      delimiter: "\t"
    });
    try {
      const [indicepaResponse, notUpdatedEntries] = await Promise.all([
        fetch(INDICEPA_URL),
        IpaPublicAdministrationModel.findAll({
          attributes: ["cod_amm", "des_amm"]
        })
      ]);
      indicepaResponse.body
        .pipe(csvStream)
        .pipe(
          es.map((parsedRow: IIpaPublicAdministrationRaw, cb: () => void) => {
            IpaPublicAdministration.decode(
              Object.entries(parsedRow)
                .map(([key, val]) => [key, val.trim()])
                .reduce(
                  (prev, [cKey, cVal]) => {
                    return { ...prev, [cKey]: cVal };
                  },
                  {} as unknown
                )
            ).fold(
              () => cb(),
              newEntry => {
                const entryIndex = notUpdatedEntries.findIndex(
                  entryFromDb => entryFromDb.cod_amm === newEntry.cod_amm
                );
                notUpdatedEntries.splice(entryIndex, 1);
                IpaPublicAdministrationModel.upsert(newEntry)
                  .then(() => {
                    cb();
                  })
                  .catch(error => {
                    log.error(
                      "IpaPublicAdministration upsert failed for %s: %s",
                      newEntry.des_amm,
                      error
                    );
                    cb();
                  });
              }
            );
          })
        )
        .on("end", () => {
          // tslint:disable-next-line:no-floating-promises
          Promise.all(
            notUpdatedEntries.map(notUpdatedEntry =>
              notUpdatedEntry.destroy().catch(error => {
                log.error(
                  "An error occurred when deleting %s IpaPublicAdministration. %s",
                  notUpdatedEntry.des_amm,
                  error
                );
              })
            )
          ).then(() => resolve());
        });
    } catch (error) {
      log.error(
        "An error occurred during the IpaPublicAdministration table upsert process. %s",
        error
      );
      reject(error);
    }
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
      "An error occurred while populating entries in IpaPublicAdministration table."
    );
    return process.exit(1);
  }
}
