import { Op, QueryTypes } from "sequelize";
import sequelize from "../database/db";
import { IpaPublicAdministration } from "../models/IpaPublicAdministration";
import { Organization } from "../models/Organization";
import { User } from "../models/User";
import {
  fromOrganizationModelToSearchedOrganization,
  fromPublicAdministrationToSearchedOrganization,
  ISearchedOrganization
} from "../types/organization";

/**
 * Retrieve from the db all the public administrations whose names match the provided value.
 * In order to match, the name of the public administration must include each word of the input value in the same order.
 * @param input The value to compare with the name of the public administration.
 */
export async function findPublicAdministrationsByName(
  input: string
): Promise<ReadonlyArray<ISearchedOrganization>> {
  const descriptionWords = input
    .split(" ")
    .reduce(
      (words: ReadonlyArray<string>, word: string) =>
        word ? words.concat(word) : words,
      []
    );
  const publicAdministrations: ReadonlyArray<
    IpaPublicAdministration
  > = await sequelize.query(
    `
      SELECT *
      FROM "${IpaPublicAdministration.tableName}"
      WHERE _search @@ plainto_tsquery('italian', :query);
    `,
    {
      mapToModel: true,
      model: IpaPublicAdministration,
      replacements: { query: `%${descriptionWords.join("%")}%` },
      type: QueryTypes.SELECT
    }
  );
  const organizations = await Organization.findAll({
    include: [
      {
        as: "legalRepresentative",
        model: User
      }
    ],
    where: {
      ipaCode: {
        [Op.in]: publicAdministrations.map(_ => _.cod_amm)
      }
    }
  });

  const parsedPublicAdministrations = publicAdministrations.map(
    fromPublicAdministrationToSearchedOrganization
  );
  const parsedOrganizations = organizations.map(
    fromOrganizationModelToSearchedOrganization
  );
  return mergePublicAdministrationsAndOrganizations(
    parsedPublicAdministrations,
    parsedOrganizations
  );
}

/**
 * Updates the public administrations from IPA with the information coming from their registrations to IO
 *
 * @param publicAdministrations The array of public administrations from IPA
 * @param organizations The array of already registered public administrations
 */
function mergePublicAdministrationsAndOrganizations(
  publicAdministrations: ReadonlyArray<ISearchedOrganization>,
  organizations: ReadonlyArray<ISearchedOrganization>
): ReadonlyArray<ISearchedOrganization> {
  return publicAdministrations.reduce(
    (
      results: ReadonlyArray<ISearchedOrganization>,
      currentPublicAdministration: ISearchedOrganization
    ) => {
      const organizationsHash = organizations.reduce(
        (hash, currentOrganization) => ({
          ...hash,
          [currentOrganization.ipaCode]: currentOrganization
        }),
        {} as { [key: string]: ISearchedOrganization }
      );
      if (organizationsHash[currentPublicAdministration.ipaCode]) {
        const currentOrganization =
          organizationsHash[currentPublicAdministration.ipaCode];

        return [
          ...results,
          {
            ...currentOrganization,
            selectedPecIndex: currentPublicAdministration.pecs.indexOf(
              currentOrganization.pecs[0]
            )
          }
        ];
      }
      return [...results, currentPublicAdministration];
    },
    [] as ReadonlyArray<ISearchedOrganization>
  );
}
