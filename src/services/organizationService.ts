import { Op } from "sequelize";
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
  const organizations = await Organization.findAll({
    include: [
      {
        as: "legalRepresentative",
        model: User
      }
    ],
    where: {
      name: {
        [Op.iLike]: `%${descriptionWords.join("%")}%`
      }
    }
  });
  const publicAdministrations = await IpaPublicAdministration.findAll({
    where: {
      des_amm: {
        [Op.iLike]: `%${descriptionWords.join("%")}%`
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
  // tslint:disable-next-line:readonly-array
  organizations: ISearchedOrganization[]
): ReadonlyArray<ISearchedOrganization> {
  return publicAdministrations.reduce(
    (
      results: ReadonlyArray<ISearchedOrganization>,
      currentPublicAdministration: ISearchedOrganization
    ) => {
      const organizationIndex = organizations.findIndex(
        organization =>
          organization.ipaCode === currentPublicAdministration.ipaCode
      );
      if (organizationIndex !== -1) {
        return [...results, ...organizations.splice(organizationIndex, 1)];
      }
      return [...results, currentPublicAdministration];
    },
    [] as ReadonlyArray<ISearchedOrganization>
  );
}
