import { array } from "fp-ts/lib/Array";
import { either, Either, left, right } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";
import {
  fromEither,
  fromPredicate,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import * as fs from "fs";
import * as t from "io-ts";
import { Errors } from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  IResponseSuccessRedirectToResource,
  ResponseErrorConflict,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation,
  ResponseSuccessRedirectToResource
} from "italia-ts-commons/lib/responses";
import { Op, QueryTypes, UniqueConstraintError } from "sequelize";
import { ADMINISTRATION_SEARCH_RESULTS_LIMIT } from "../config";
import sequelize from "../database/db";
import { FoundAdministration } from "../generated/FoundAdministration";
import { LegalRepresentative } from "../generated/LegalRepresentative";
import { Organization } from "../generated/Organization";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { OrganizationRegistrationStatusEnum } from "../generated/OrganizationRegistrationStatus";
import { UserRoleEnum } from "../generated/UserRole";
import { IpaPublicAdministration as IpaPublicAdministrationModel } from "../models/IpaPublicAdministration";
import { Organization as OrganizationModel } from "../models/Organization";
import { OrganizationUser as OrganizationUserModel } from "../models/OrganizationUser";
import { User } from "../models/User";
import {
  fromOrganizationModelToFoundAdministration,
  fromPublicAdministrationToFoundAdministration,
  toOrganizationObject
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
export async function findAllNotPreDraft(
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
    IpaPublicAdministrationModel
  > = await sequelize.query(
    `
      SELECT *
      FROM "${IpaPublicAdministrationModel.tableName}"
      WHERE _search @@ plainto_tsquery('italian', :query)
      ORDER BY des_amm ASC
      LIMIT ${ADMINISTRATION_SEARCH_RESULTS_LIMIT};
    `,
    {
      mapToModel: true,
      model: IpaPublicAdministrationModel,
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
      },
      registrationStatus: {
        [Op.ne]: OrganizationRegistrationStatusEnum.PRE_DRAFT
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
          [currentOrganization.ipa_code]: currentOrganization
        }),
        {} as { [key: string]: FoundAdministration }
      );
      if (organizationsHash[currentPublicAdministration.ipa_code]) {
        const currentOrganization =
          organizationsHash[currentPublicAdministration.ipa_code];

        return [
          ...results,
          {
            ...currentOrganization,
            pecs: currentPublicAdministration.pecs,
            selectedPecLabel: Object.keys(
              currentPublicAdministration.pecs
            ).find(
              labels =>
                currentPublicAdministration.pecs[labels] ===
                currentOrganization.pecs["1"]
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
 * Given an organization instance, forcefully deletes from the database
 * the organization, its legal representative and the related documents.
 *
 * NOTE: this method must be used only in order to cancel
 * a registration process in a `PRE_DRAFT` status. When in such status,
 * both the organization and its legal representative can be safely removed
 * because their existence has no value outside the context of their registration process.
 *
 * @todo: the current removal process must be refactored using a soft delete
 * @see https://www.pivotaltracker.com/story/show/169889085
 */
export async function deleteOrganization(
  organizationInstance: OrganizationModel
): Promise<Option<Error>> {
  try {
    await sequelize.transaction(transaction => {
      return OrganizationUserModel.destroy({
        force: true,
        transaction,
        where: { organizationIpaCode: organizationInstance.ipaCode }
      })
        .then(() => {
          return organizationInstance.destroy({ force: true, transaction });
        })
        .then(() => {
          return organizationInstance.legalRepresentative.destroy({
            force: true,
            transaction
          });
        });
    });
    // TODO:
    //  the documents must be stored on cloud (Azure Blob Storage).
    //  @see https://www.pivotaltracker.com/story/show/169644958
    const organizationDocumentsRoot = `./documents/${organizationInstance.ipaCode}`;
    await fs.promises
      .access(organizationDocumentsRoot)
      .then(() => fs.promises.readdir(organizationDocumentsRoot))
      .then(documentsArray =>
        Promise.all(
          documentsArray.map(documentName =>
            fs.promises.unlink(`${organizationDocumentsRoot}/${documentName}`)
          )
        )
      )
      .then(() => fs.promises.rmdir(organizationDocumentsRoot))
      .catch(error => {
        log.error(
          "An error occurred deleting the documents of a deleted organization. %s",
          error
        );
      });
    return none;
  } catch (error) {
    return some(error);
  }
}

/**
 * Checks if the registration process for a given administration has already started
 * and deletes it if it's still in a pre-draft status. Returns an optional error response
 * if the user can not start a new registration process for the given administration.
 * @param ipaCode The ipaCode of the administration to be checked
 */
async function checkAndDeletePreviousRegistration(
  ipaCode: string
): Promise<Option<IResponseErrorConflict | IResponseErrorInternal>> {
  try {
    const oldOrganizationInstance = await OrganizationModel.findOne({
      include: [
        {
          as: "users",
          model: User,
          required: true
        },
        {
          as: "legalRepresentative",
          model: User
        }
      ],
      where: { ipaCode }
    });
    if (oldOrganizationInstance !== null) {
      if (
        oldOrganizationInstance.registrationStatus !==
        OrganizationRegistrationStatusEnum.PRE_DRAFT
      ) {
        return some(
          ResponseErrorConflict("The organization is already registered")
        );
      }
      const maybeError = await deleteOrganization(oldOrganizationInstance);
      if (maybeError.isSome()) {
        log.error(
          "An error occurred while deleting a registration in pre-draft status. %s",
          maybeError.value
        );
        return some(
          ResponseErrorInternal(
            "The previous registration for this administration is in a pre-draft status and could not be deleted."
          )
        );
      }
    }
    return none;
  } catch (error) {
    log.error(
      "An error occurred while verifying that the organization was not already registered. %s",
      error
    );
    return some(
      ResponseErrorInternal(
        "Could not verify that the administration is available for registration"
      )
    );
  }
}

/**
 * Creates a new organization associated with its legal representative
 * and returns it in a success response.
 * @param newOrganizationParams The parameters required to create the organization
 * @param user The user who is performing the operation
 */
export async function registerOrganization(
  newOrganizationParams: OrganizationRegistrationParams,
  user: LoggedUser
): Promise<
  Either<
    // tslint:disable-next-line:max-union-size
    | IResponseErrorInternal
    | IResponseErrorConflict
    | IResponseErrorNotFound
    | IResponseErrorValidation,
    IResponseSuccessRedirectToResource<Organization, Organization>
  >
> {
  const genericError = "Error creating the new organization";
  try {
    // Retrieve the public administration from the database
    const ipaPublicAdministrationModel = await IpaPublicAdministrationModel.findOne(
      {
        where: { cod_amm: newOrganizationParams.ipa_code }
      }
    );
    if (ipaPublicAdministrationModel === null) {
      return left(
        ResponseErrorNotFound(
          "Not found",
          "IPA public administration does not exist"
        )
      );
    }
    const errorsOrIpaPublicAdministration = IpaPublicAdministrationType.decode(
      ipaPublicAdministrationModel.get({
        plain: true
      })
    );
    if (errorsOrIpaPublicAdministration.isLeft()) {
      return left(
        ResponseErrorInternal("Invalid IPA public administration data")
      );
    }
    const ipaPublicAdministration = errorsOrIpaPublicAdministration.value;

    // Check that the selected pec label detects an existing email whose type is pec
    const emailPropName = `mail${newOrganizationParams.selected_pec_label}`;
    const emailTypePropName = `tipo_mail${newOrganizationParams.selected_pec_label}`;

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
      return left(
        ResponseErrorValidation("Bad request", "Invalid selectedPecLabel")
      );
    }

    const maybeErrorResponse = await checkAndDeletePreviousRegistration(
      newOrganizationParams.ipa_code
    );
    if (maybeErrorResponse.isSome()) {
      return left(maybeErrorResponse.value);
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
              email: ipaPublicAdministration[emailPropName],
              familyName:
                newOrganizationParams.legal_representative.family_name,
              fiscalCode:
                newOrganizationParams.legal_representative.fiscal_code,
              givenName: newOrganizationParams.legal_representative.given_name,
              phoneNumber:
                newOrganizationParams.legal_representative.phone_number,
              role: UserRoleEnum.ORG_MANAGER
            },
            name: ipaPublicAdministration.des_amm,
            pec: ipaPublicAdministration[emailPropName],
            registrationStatus: OrganizationRegistrationStatusEnum.PRE_DRAFT,
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
              OrganizationUserModel.create(
                {
                  createdAt: now,
                  organizationIpaCode: createdOrganization.ipaCode,
                  updatedAt: now,
                  userEmail: user.email,
                  userRole: UserRoleEnum.ORG_DELEGATE
                },
                {
                  transaction
                }
              )
            )
            .then(() => {
              return new Promise<
                Either<
                  IResponseErrorInternal,
                  IResponseSuccessRedirectToResource<Organization, Organization>
                >
              >(resolve => {
                const validationErrorsHandler = (errors: Errors) => {
                  resolve(
                    left(
                      ResponseErrorInternal(
                        errorsToReadableMessages(errors).join("/")
                      )
                    )
                  );
                };
                t.exact(LegalRepresentative)
                  .decode({
                    email: createdOrganization.legalRepresentative.email,
                    family_name:
                      createdOrganization.legalRepresentative.familyName,
                    fiscal_code:
                      createdOrganization.legalRepresentative.fiscalCode,
                    given_name:
                      createdOrganization.legalRepresentative.givenName,
                    phone_number:
                      createdOrganization.legalRepresentative.phoneNumber,
                    role: createdOrganization.legalRepresentative.role
                  })
                  .fold(validationErrorsHandler, legalRepresentative => {
                    const resourceUrl = `/organizations/${createdOrganization.ipaCode}`;
                    return t
                      .exact(Organization)
                      .decode({
                        fiscal_code: createdOrganization.fiscalCode,
                        ipa_code: createdOrganization.ipaCode,
                        legal_representative: legalRepresentative,
                        links: [
                          {
                            href: resourceUrl,
                            rel: "self"
                          },
                          {
                            href: resourceUrl,
                            rel: "edit"
                          }
                        ],
                        name: createdOrganization.name,
                        pec: createdOrganization.pec,
                        registration_status:
                          createdOrganization.registrationStatus,
                        scope: createdOrganization.scope
                      })
                      .fold(validationErrorsHandler, organization => {
                        resolve(
                          right(
                            ResponseSuccessRedirectToResource(
                              organization,
                              resourceUrl,
                              organization
                            )
                          )
                        );
                      });
                  });
              });
            });
        })
      )
      .catch(error => {
        log.error(`${genericError} %s`, error);
        if (error instanceof UniqueConstraintError) {
          return left(
            ResponseErrorConflict("The organization is already registered")
          );
        }
        return left(ResponseErrorInternal(genericError));
      });
  } catch (error) {
    log.error(`${genericError} %s`, error);
    return left(ResponseErrorInternal(genericError));
  }
}

export function addDelegate(
  ipaCode: string,
  userEmail: string
): TaskEither<
  // tslint:disable-next-line:max-union-size
  IResponseErrorInternal | IResponseErrorNotFound | IResponseErrorConflict,
  IResponseSuccessRedirectToResource<Organization, Organization>
> {
  const genericErrorHandler = (error: unknown) => {
    log.error("An error occurred adding the delegate. %s", error);
    return ResponseErrorInternal("An error occurred adding the delegate.");
  };
  return tryCatch<
    IResponseErrorInternal | IResponseErrorNotFound | IResponseErrorConflict,
    OrganizationModel
  >(
    () =>
      OrganizationModel.findOne({
        where: { ipaCode }
      }),
    genericErrorHandler
  )
    .chain(
      fromPredicate<IResponseErrorNotFound, OrganizationModel>(
        _ => _ !== null,
        () =>
          ResponseErrorNotFound(
            "Not found",
            "Registered organization does not exists"
          )
      )
    )
    .chain(
      fromPredicate<
        IResponseErrorConflict | IResponseErrorInternal,
        OrganizationModel
      >(
        _ =>
          _.registrationStatus ===
          OrganizationRegistrationStatusEnum.REGISTERED,
        () =>
          ResponseErrorConflict(
            "The organization has not completed the registration process yet."
          )
      )
    )
    .chain(organizationModel =>
      tryCatch<IResponseErrorInternal, OrganizationModel>(
        () =>
          OrganizationUserModel.create({
            createdAt: Date.now(),
            organizationIpaCode: organizationModel.ipaCode,
            updatedAt: Date.now(),
            userEmail,
            userRole: UserRoleEnum.ORG_DELEGATE
          }).then(_ => organizationModel),
        genericErrorHandler
      )
    )
    .chain(organizationModel =>
      tryCatch(
        () =>
          organizationModel.reload({
            include: [
              {
                as: "users",
                model: User
              },
              {
                as: "legalRepresentative",
                model: User
              }
            ],
            order: [["users", "createdAt", "DESC"]]
          }),
        genericErrorHandler
      )
    )
    .chain(organizationModel =>
      fromEither(
        toOrganizationObject(organizationModel).map(organization => {
          const selfLink = organization.links.find(_ => _.rel === "self");
          return ResponseSuccessRedirectToResource(
            organization,
            selfLink ? selfLink.href : "",
            organization
          );
        })
      ).mapLeft(errors => {
        log.error(
          "Invalid organization data. " +
            errorsToReadableMessages(errors).join(" / ")
        );
        return ResponseErrorInternal("Invalid organization data.");
      })
    );
}

export async function getOrganizationInstanceFromDelegateEmail(
  userEmail: string,
  ipaCode?: string
): Promise<Either<Error, Option<OrganizationModel>>> {
  try {
    const organizationInstances = await OrganizationModel.findAll({
      include: [
        {
          as: "users",
          model: User,
          required: true,
          through: { where: { email: userEmail } }
        },
        {
          as: "legalRepresentative",
          model: User
        }
      ],
      where: ipaCode ? { ipaCode } : undefined
    });
    if (organizationInstances.length > 1) {
      return left(
        Error(
          `DB conflict error: multiple organizations associated to the user ${userEmail}`
        )
      );
    }
    return right(
      organizationInstances.length === 0 ? none : some(organizationInstances[0])
    );
  } catch (error) {
    return left(error);
  }
}

export async function getOrganizationFromUserEmail(
  userEmail: string
): Promise<Either<Error, Option<Organization>>> {
  try {
    const userInstance = await User.findOne({
      include: [
        {
          as: "organizations",
          include: [
            {
              as: "users",
              model: User
            },
            {
              as: "legalRepresentative",
              model: User
            }
          ],
          model: OrganizationModel,
          through: {
            where: {
              email: userEmail
            }
          },
          where: {
            registrationStatus: {
              [Op.ne]: OrganizationRegistrationStatusEnum.PRE_DRAFT
            }
          }
        }
      ],
      where: { email: userEmail }
    });
    if (userInstance === null || !userInstance.organizations) {
      return right(none);
    }
    if (userInstance.organizations.length > 1) {
      return left(
        new Error(
          `DB conflict error: multiple organizations associated to the user ${userEmail}`
        )
      );
    }
    if (userInstance.organizations.length === 0) {
      return right(none);
    }
    const errorsOrOrganization: Either<
      Errors,
      Organization
    > = toOrganizationObject(userInstance.organizations[0]);
    return errorsOrOrganization.fold(
      errors =>
        left(
          new Error(
            "Invalid organization data. " +
              errorsToReadableMessages(errors).join(" / ")
          )
        ),
      organization => right(some(organization))
    );
  } catch (error) {
    return left(error);
  }
}

export async function getAllOrganizations(): Promise<
  Either<Error, ReadonlyArray<Organization>>
> {
  const errorOrOrganizationInstances = await tryCatch(
    async () =>
      OrganizationModel.findAll({
        include: [
          {
            as: "legalRepresentative",
            model: User
          }
        ],
        where: {
          registrationStatus: {
            [Op.ne]: OrganizationRegistrationStatusEnum.PRE_DRAFT
          }
        }
      }),
    error => error as Error
  ).run();

  return errorOrOrganizationInstances.fold(
    error => left(error),
    organizationInstances =>
      array
        .traverse(either)(organizationInstances, toOrganizationObject)
        .mapLeft(
          errors => new Error(errorsToReadableMessages(errors).join(" / "))
        )
  );
}
