import { Errors } from "io-ts";
import * as t from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessJson,
  ResponseErrorConflict,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessJson
} from "italia-ts-commons/lib/responses";
import { Op, QueryTypes, UniqueConstraintError } from "sequelize";
import sequelize from "../database/db";
import { FoundAdministration } from "../generated/FoundAdministration";
import { LegalRepresentative } from "../generated/LegalRepresentative";
import { Organization } from "../generated/Organization";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { UserRoleEnum } from "../generated/UserRole";
import {
  IpaPublicAdministration,
  IpaPublicAdministration as IpaPublicAdministrationModel
} from "../models/IpaPublicAdministration";
import { Organization as OrganizationModel } from "../models/Organization";
import { OrganizationUser as OrganizationUserModel } from "../models/OrganizationUser";
import { User } from "../models/User";
import {
  fromOrganizationModelToFoundAdministration,
  fromPublicAdministrationToFoundAdministration
} from "../types/organization";
import {
  IpaPublicAdministration as IpaPublicAdministrationType,
  isIpaPublicAdministrationProperty
} from "../types/PublicAdministration";
import { LoggedUser } from "../types/user";
import { log } from "../utils/logger";

/**
 * Retrieve from the db all the public administrations whose names match the provided value.
 * In order to match, the name of the public administration must include each word of the input value in the same order.
 * @param input The value to compare with the name of the public administration.
 */
export async function findPublicAdministrationsByName(
  input: string
): Promise<ReadonlyArray<FoundAdministration>> {
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
  const organizations = await OrganizationModel.findAll({
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
    fromPublicAdministrationToFoundAdministration
  );
  const parsedOrganizations = organizations.map(
    fromOrganizationModelToFoundAdministration
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
  publicAdministrations: ReadonlyArray<FoundAdministration>,
  organizations: ReadonlyArray<FoundAdministration>
): ReadonlyArray<FoundAdministration> {
  return publicAdministrations.reduce(
    (
      results: ReadonlyArray<FoundAdministration>,
      currentPublicAdministration: FoundAdministration
    ) => {
      const organizationsHash = organizations.reduce(
        (hash, currentOrganization) => ({
          ...hash,
          [currentOrganization.ipaCode]: currentOrganization
        }),
        {} as { [key: string]: FoundAdministration }
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
    [] as ReadonlyArray<FoundAdministration>
  );
}

/**
 * Creates a new organization associated with its legal representative
 * and returns it in a success response.
 * @param newOrganizationParams The parameters required to create the organization
 */
export async function registerOrganization(
  newOrganizationParams: OrganizationRegistrationParams,
  user: LoggedUser
): Promise<
  // tslint:disable-next-line:max-union-size
  | IResponseErrorInternal
  | IResponseErrorConflict
  | IResponseErrorNotFound
  | IResponseErrorValidation
  | IResponseSuccessJson<Organization>
> {
  const genericError = "Error creating the new organization";
  try {
    // Retrieve the public administration from the database
    const ipaPublicAdministrationModel = await IpaPublicAdministrationModel.findOne(
      {
        where: { cod_amm: newOrganizationParams.ipaCode }
      }
    );
    if (ipaPublicAdministrationModel === null) {
      return ResponseErrorNotFound(
        "Not found",
        "IPA public administration does not exist"
      );
    }
    const errorsOrIpaPublicAdministration = IpaPublicAdministrationType.decode(
      ipaPublicAdministrationModel.get({
        plain: true
      })
    );
    if (errorsOrIpaPublicAdministration.isLeft()) {
      return ResponseErrorInternal("Invalid IPA public administration data");
    }
    const ipaPublicAdministration = errorsOrIpaPublicAdministration.value;

    // Check that the selected pec index detects an existing email whose type is pec
    // tslint:disable-next-line:restrict-plus-operands
    const emailPropName = `mail${newOrganizationParams.selectedPecIndex + 1}`;
    // tslint:disable-next-line:restrict-plus-operands
    const emailTypePropName = `tipo_mail${newOrganizationParams.selectedPecIndex +
      1}`;

    if (
      !isIpaPublicAdministrationProperty(
        emailPropName,
        ipaPublicAdministration
      ) ||
      !isIpaPublicAdministrationProperty(
        emailTypePropName,
        ipaPublicAdministration
      ) ||
      ipaPublicAdministration[emailTypePropName] !== "pec"
    ) {
      return ResponseErrorValidation("Bad request", "Invalid selectedPecIndex");
    }

    // Transactionally save the entities into the database
    return sequelize
      .transaction(transaction =>
        // Create the new organization with its associated legal representative
        OrganizationModel.create(
          {
            fiscalCode: ipaPublicAdministration.Cf,
            ipaCode: ipaPublicAdministration.cod_amm,
            legalRepresentative: {
              ...newOrganizationParams.legalRepresentative,
              email: ipaPublicAdministration[emailPropName],
              role: UserRoleEnum.ORG_MANAGER
            },
            name: ipaPublicAdministration.des_amm,
            pec: ipaPublicAdministration[emailPropName],
            scope: newOrganizationParams.scope
          },
          {
            include: [
              {
                as: "legalRepresentative",
                model: User
              }
            ],
            transaction
          }
        ).then(createdOrganization => {
          const now = Date.now();
          // Associate the legal representative to the organization as a user
          return createdOrganization
            .addUser(createdOrganization.legalRepresentative, {
              through: {
                createdAt: now,
                organizationIpaCode: createdOrganization.ipaCode,
                updatedAt: now,
                userEmail: createdOrganization.legalRepresentative.email,
                userRole: UserRoleEnum.ORG_MANAGER
              },
              transaction
            })
            .then(() =>
              // Associate the delegate to the organization as a user
              OrganizationUserModel.create({
                createdAt: now,
                organizationIpaCode: createdOrganization.ipaCode,
                updatedAt: now,
                userEmail: user.email,
                userRole: UserRoleEnum.ORG_DELEGATE
              })
            )
            .then(() => {
              return new Promise<
                IResponseSuccessJson<Organization> | IResponseErrorInternal
              >(resolve => {
                const validationErrorsHandler = (errors: Errors) => {
                  resolve(
                    ResponseErrorInternal(
                      errorsToReadableMessages(errors).join("/")
                    )
                  );
                };
                t.exact(LegalRepresentative)
                  .decode(
                    createdOrganization.legalRepresentative.get({ plain: true })
                  )
                  .fold(validationErrorsHandler, legalRepresentative =>
                    t
                      .exact(Organization)
                      .decode(
                        createdOrganization.get({
                          plain: true
                        })
                      )
                      .fold(validationErrorsHandler, organization =>
                        resolve(
                          ResponseSuccessJson({
                            ...organization,
                            legalRepresentative,
                            links: [
                              {
                                href: `/organizations/${organization.ipaCode}`,
                                rel: "self"
                              },
                              {
                                href: `/organizations/${organization.ipaCode}`,
                                rel: "edit"
                              }
                            ]
                          })
                        )
                      )
                  );
              });
            });
        })
      )
      .catch(error => {
        log.error(`${genericError} %s`, error);
        if (error instanceof UniqueConstraintError) {
          return ResponseErrorConflict(
            "The organization is already registered"
          );
        }
        return ResponseErrorInternal(genericError);
      });
  } catch (error) {
    log.error(`${genericError} %s`, error);
    return ResponseErrorInternal(genericError);
  }
}
