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

/**
 * Upserts the public administrations from IPA and deletes the outdated ones.
 * The public administrations info is read from a CSV file fetched from IPA web server,
 * the content of each row is checked and upserted.
 * At the end of the process, all the outdated entries in the db are deleted.
 */
export function upsertFromIpa(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const csvStream = createStream({
      delimiter: "\t"
    });
    try {
      // notUpdatedEntries contains the references to the db entries that have not been updated,
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
            // Check that the info from the current row is valid,
            // if it's not, then do nothing
            IpaPublicAdministration.decode(
              // Trim the property values of the parsed row
              Object.entries(parsedRow)
                .map(([key, val]) => [key, val.trim()])
                .reduce<{ [key: string]: string }>((prev, [cKey, cVal]) => {
                  return { ...prev, [cKey]: cVal };
                }, {})
            ).fold(
              () => cb(),
              newEntry => {
                IpaPublicAdministrationModel.upsert(newEntry)
                  .then(() => {
                    // Find the reference to the currently upserted info in the notUpdatedEntries array and remove it
                    const entryIndex = notUpdatedEntries.findIndex(
                      entryFromDb => entryFromDb.cod_amm === newEntry.cod_amm
                    );
                    if (entryIndex !== -1) {
                      notUpdatedEntries.splice(entryIndex, 1);
                    }
                    cb();
                  })
                  .catch(error => {
                    // Log the upsert error and do nothing
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
              // Delete the outdated public administration
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
      log.info("Populating IpaPublicAdministration table...");
      await upsertFromIpa();
      return true;
    } else {
      log.info("IpaPublicAdministration table already populated.");
      return false;
    }
  } catch (error) {
    log.error(
      "An error occurred while populating entries in IpaPublicAdministration table."
    );
    return process.exit(1);
  }
}
