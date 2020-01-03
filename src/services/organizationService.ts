import { array } from "fp-ts/lib/Array";
import { either, Either, left, right } from "fp-ts/lib/Either";
import { none, Option, some } from "fp-ts/lib/Option";
import {
  fromEither,
  fromPredicate,
  TaskEither,
  tryCatch
} from "fp-ts/lib/TaskEither";
import { Errors } from "io-ts";
import { errorsToReadableMessages } from "italia-ts-commons/lib/reporters";
import {
  IResponseErrorConflict,
  IResponseErrorInternal,
  IResponseErrorNotFound,
  IResponseErrorValidation,
  ResponseErrorConflict,
  ResponseErrorInternal,
  ResponseErrorNotFound,
  ResponseErrorValidation
} from "italia-ts-commons/lib/responses";
import { Op, QueryTypes } from "sequelize";
import { ADMINISTRATION_SEARCH_RESULTS_LIMIT } from "../config";
import sequelize from "../database/db";
import { FoundAdministration } from "../generated/FoundAdministration";
import { Organization as OrganizationResult } from "../generated/Organization";
import { OrganizationRegistrationParams } from "../generated/OrganizationRegistrationParams";
import { OrganizationRegistrationRequest } from "../generated/OrganizationRegistrationRequest";
import { Request } from "../generated/Request";
import { RequestStatusEnum } from "../generated/RequestStatus";
import { UserDelegationRequest } from "../generated/UserDelegationRequest";
import { UserRoleEnum } from "../generated/UserRole";
import { IpaPublicAdministration as IpaPublicAdministrationModel } from "../models/IpaPublicAdministration";
import { Organization as OrganizationModel } from "../models/Organization";
import { Request as RequestModel, RequestScope } from "../models/Request";
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
import {
  genericInternalUnknownErrorHandler,
  genericInternalValidationErrorsHandler
} from "../utils/errorHandlers";
import {
  IResponseSuccessCreation,
  ResponseSuccessCreation
} from "../utils/responses";

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

function checkOnboardingCapability(
  ipaCode: string
): TaskEither<IResponseErrorConflict | IResponseErrorInternal, null> {
  return tryCatch<IResponseErrorConflict | IResponseErrorInternal, null>(
    () =>
      RequestModel.scope(RequestScope.ORGANIZATION_REGISTRATION).findOne({
        where: {
          organizationIpaCode: ipaCode,
          status: RequestStatusEnum.ACCEPTED
        }
      }),
    (error: unknown) =>
      genericInternalUnknownErrorHandler(
        error,
        "organizationService#checkOnboardingCapability | Error querying the database.",
        "An error occurred checking the onboarding capability for the administration"
      )
  ).chain(
    fromPredicate(
      _ => _ === null,
      () => ResponseErrorConflict("The administration is already registered")
    )
  );
}

/**
 * Creates a request needed for the onboarding of an administration,
 * i.e. the registration request for the administration or the delegation request for the user performing the action,
 * and returns it in a success creation response.
 * @param newOrganizationParams The parameters required to create the request
 * @param user The user who is performing the operation
 */
export function createOnboardingRequest(
  newOrganizationParams: OrganizationRegistrationParams,
  user: LoggedUser
): TaskEither<
  // tslint:disable-next-line:max-union-size
  | IResponseErrorInternal
  | IResponseErrorConflict
  | IResponseErrorNotFound
  | IResponseErrorValidation,
  IResponseSuccessCreation<
    OrganizationRegistrationRequest | UserDelegationRequest
  >
> {
  const internalErrorHandler = (error: unknown) =>
    genericInternalUnknownErrorHandler(
      error,
      "organizationService#createOnboardingRequest | Error creating the onboarding requests.",
      "An error occurred creating the onboarding requests."
    );
  const verifyPecLabel = (
    ipaPublicAdministration: IpaPublicAdministrationType
  ): Either<IResponseErrorValidation, IpaPublicAdministrationType> => {
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
      return left<IResponseErrorValidation, IpaPublicAdministrationType>(
        ResponseErrorValidation("Bad request", "Invalid selectedPecLabel")
      );
    }
    return right<IResponseErrorValidation, IpaPublicAdministrationType>(
      ipaPublicAdministration
    );
  };
  const loadRequester = (requestModel: RequestModel) =>
    tryCatch(
      () =>
        requestModel.reload({
          include: [
            {
              as: "requester",
              model: User
            }
          ]
        }),
      internalErrorHandler
    );
  return tryCatch<
    // tslint:disable-next-line:max-union-size
    | IResponseErrorInternal
    | IResponseErrorNotFound
    | IResponseErrorValidation
    | IResponseErrorConflict,
    IpaPublicAdministrationModel
  >(
    () =>
      IpaPublicAdministrationModel.findOne({
        where: { cod_amm: newOrganizationParams.ipa_code }
      }),
    internalErrorHandler
  )
    .chain(
      fromPredicate(
        _ => _ !== null,
        () =>
          ResponseErrorNotFound(
            "Not found",
            "Registered organization does not exists"
          )
      )
    )
    .chain(ipaPublicAdministrationModel =>
      fromEither(
        IpaPublicAdministrationType.decode(
          ipaPublicAdministrationModel.get({
            plain: true
          })
        )
      ).mapLeft(() =>
        ResponseErrorInternal("Invalid IPA public administration data")
      )
    )
    .chain(ipaPublicAdministration =>
      fromEither(verifyPecLabel(ipaPublicAdministration))
    )
    .chainFirst(checkOnboardingCapability(newOrganizationParams.ipa_code))
    .chain(ipaPublicAdministration => {
      const pecLabel = `mail${newOrganizationParams.selected_pec_label}`;
      const organizationPec = isIpaPublicAdministrationProperty(
        pecLabel,
        ipaPublicAdministration
      )
        ? ipaPublicAdministration[pecLabel]
        : null;
      const requestParams = {
        legalRepresentativeFamilyName:
          newOrganizationParams.legal_representative.family_name,
        legalRepresentativeFiscalCode:
          newOrganizationParams.legal_representative.fiscal_code,
        legalRepresentativeGivenName:
          newOrganizationParams.legal_representative.given_name,
        legalRepresentativePhoneNumber:
          newOrganizationParams.legal_representative.phone_number,
        organizationFiscalCode: ipaPublicAdministration.Cf,
        organizationIpaCode: ipaPublicAdministration.cod_amm,
        organizationName: ipaPublicAdministration.des_amm,
        organizationPec,
        organizationScope: newOrganizationParams.scope,
        status: RequestStatusEnum.CREATED,
        type: newOrganizationParams.request_type,
        userEmail: user.email
      };
      return tryCatch(
        () => RequestModel.create(requestParams),
        internalErrorHandler
      )
        .chain(loadRequester)
        .chain(requestModel =>
          fromEither(
            Request.decode({
              id: requestModel.id,
              organization: {
                fiscal_code: requestModel.organizationFiscalCode,
                ipa_code: requestModel.organizationIpaCode,
                legal_representative: {
                  email: requestModel.organizationPec,
                  family_name: requestModel.legalRepresentativeFamilyName,
                  fiscal_code: requestModel.legalRepresentativeFiscalCode,
                  given_name: requestModel.legalRepresentativeGivenName,
                  phone_number: requestModel.legalRepresentativePhoneNumber,
                  role: UserRoleEnum.ORG_MANAGER
                },
                name: requestModel.organizationName,
                pec: requestModel.organizationPec,
                scope: requestModel.organizationScope
              },
              requester: requestModel.requester && {
                email: requestModel.requester.email,
                family_name: requestModel.requester.familyName,
                fiscal_code: requestModel.requester.fiscalCode,
                given_name: requestModel.requester.givenName,
                role: UserRoleEnum.ORG_DELEGATE
              },
              status: requestModel.status,
              type: requestModel.type
            })
          ).mapLeft(errors =>
            genericInternalValidationErrorsHandler(
              errors,
              "organizationService#createOnboardingRequest | Invalid data.",
              "Invalid data"
            )
          )
        )
        .map(request => ResponseSuccessCreation(request));
    });
}

export function getOrganizationInstanceFromDelegateEmail(
  userEmail: string,
  ipaCode?: string
): TaskEither<Error, ReadonlyArray<OrganizationModel>> {
  return tryCatch(
    () =>
      OrganizationModel.findAll({
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
      }),
    error => error as Error
  ).chain(
    fromPredicate(
      _ => !ipaCode || _.length <= 1,
      () =>
        Error(
          `DB conflict error: multiple organizations associated to the user ${userEmail}`
        )
    )
  );
}

export async function getOrganizationFromUserEmail(
  userEmail: string
): Promise<Either<Error, Option<OrganizationResult>>> {
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
      OrganizationResult
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
  Either<Error, ReadonlyArray<OrganizationResult>>
> {
  const errorOrOrganizationInstances = await tryCatch(
    async () =>
      OrganizationModel.findAll({
        include: [
          {
            as: "legalRepresentative",
            model: User
          }
        ]
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
