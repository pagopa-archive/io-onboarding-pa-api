import { SpidLevelEnum } from "io-spid-commons";
import {
  EmailString,
  FiscalCode,
  NonEmptyString
} from "italia-ts-commons/lib/strings";
import mockReq from "../../__mocks__/mockRequest";

import { UserRoleEnum } from "../../generated/UserRole";
import { SessionToken } from "../token";
import { LoggedUser, SpidUser, validateSpidUser } from "../user";

const tokenDurationInSeconds = 300;

const aValidFiscalNumber = "GRBGPP87L04L741X" as FiscalCode;
const aValidEmailAddress = "x@example.com" as EmailString;
const anIssuer = { _: "onelogin_saml" };

const aValidSpidLevel = SpidLevelEnum["https://www.spid.gov.it/SpidL2"];

const getMockedAssertionXml = (
  isSpidLevelValid: boolean
): (() => string) => () => `<saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="2.0" IssueInstant="2019-09-20T08:16:30Z" ID="id_6f05c85f1a543fb1cf23be7bd691a5e6146e9349">
    <saml:Issuer NameQualifier="http://spid-testenv2:8088" Format="urn:oasis:names:tc:SAML:2.0:nameid-format:entity">http://spid-testenv2:8088</saml:Issuer><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI="#id_6f05c85f1a543fb1cf23be7bd691a5e6146e9349"><ds:Transforms><ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/><ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/></ds:Transforms><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>whUlliSzDo9VJnSP3av1nBhSPAyhD/2e4wxDh82Ozzg=</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>jaucJX/QximvgwfIFR3NBU0rLiLYbhqiJDSjvIBikusCLl5qE9t10Ckn7yQ2xttY/3AV/Bi9hNASRYQtrRTuA+qZHltP7q9XSeVRFHtkzhzC+1P3wuMm3nIg9PqfjPAspPrYGkfAGvFUBq+eC3Jia6JTYYkaULe8CEeI8dHVvBmWB0PVskB0CaycVXOoxUQwCIuivTtRxy854rDriED3JCvHSdr0OtAyAe6Gz+3wmPPK0bMBROEm/BClJvJ2zFq+7Wvv9DpFxu09UlwMAUFc2Uux0UQ/fZLwplcBusJUf7e9hPJ+eL4xzYBqr4fGXPywIbNi68+34G/b8G20D2yreQ==</ds:SignatureValue><ds:KeyInfo><ds:X509Data><ds:X509Certificate>MIIC7TCCAdWgAwIBAgIJAMbxPOoBth1LMA0GCSqGSIb3DQEBCwUAMA0xCzAJBgNV
BAYTAklUMB4XDTE4MDkwNDE0MDAxM1oXDTE4MTAwNDE0MDAxM1owDTELMAkGA1UE
BhMCSVQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJrW3y8Zd2jESP
XGMRY04cHC4Qfo3302HEY1C6x1aDfW7aR/tXzNplfdw8ZtZugSSmHZBxVrR8aA08
dUVbbtUw5qD0uAWKIeREqGfhM+J1STAMSI2/ZxA6t2fLmv8l1eRd1QGeRDm7yF9E
EKGY9iUZD3LJf2mWdVBAzzYlG23M769k+9JuGZxuviNWMjojgYRiQFgzypUJJQz+
Ihh3q7LMjjiQiiULVb9vnJg7UdU9Wf3xGRkxk6uiGP9SzWigSObUekYYQ4ZAI/sp
ILywgDxVMMtv/eVniUFKLABtljn5cE9zltECahPbm7wIuMJpDDu5GYHGdYO0j+K7
fhjvF2mzAgMBAAGjUDBOMB0GA1UdDgQWBBQEVmzA/L1/fd70ok+6xtDRF8A3HjAf
BgNVHSMEGDAWgBQEVmzA/L1/fd70ok+6xtDRF8A3HjAMBgNVHRMEBTADAQH/MA0G
CSqGSIb3DQEBCwUAA4IBAQCRMo4M4PqS0iLTTRWfikMF4hYMapcpmuna6p8aee7C
wTjS5y7y18RLvKTi9l8OI0dVkgokH8fq8/o13vMw4feGxro1hMeUilRtH52funrW
C+FgPrqk3o/8cZOnq+CqnFFDfILLiEb/PVJMddvTXgv2f9O6u17f8GmMLzde1yvY
Da1fG/Pi0fG2F0yw/CmtP8OTLSvxjPtJ+ZckGzZa9GotwHsoVJ+Od21OU2lOeCnO
jJOAbewHgqwkCB4O4AT5RM4ThAQtoU8QibjD1XDk/ZbEHdKcofnziDyl0V8gglP2
SxpzDaPX0hm4wgHk9BOtSikb72tfOw+pNfeSrZEr6ItQ
</ds:X509Certificate></ds:X509Data></ds:KeyInfo></ds:Signature>
    <saml:Subject>
      <saml:NameID NameQualifier="http://spid-testenv2:8088" Format="urn:oasis:names:tc:SAML:2.0:nameid-format:transient">id_8fcd88d99fec25c2c4cf45f5c91ccc233016d371</saml:NameID>
      <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
        <saml:SubjectConfirmationData NotOnOrAfter="2019-09-20T08:18:30Z" Recipient="http://io-onboarding-backend:3000/assertion-consumer-service" InResponseTo="_6f63a00a624e7fd5cb19"/>
      </saml:SubjectConfirmation>
    </saml:Subject>
    <saml:Conditions NotOnOrAfter="2019-09-20T08:18:30Z" NotBefore="2019-09-20T08:14:30Z">
      <saml:AudienceRestriction>
        <saml:Audience>https://spid.agid.gov.it/cd</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement AuthnInstant="2019-09-20T08:16:30Z" SessionIndex="id_9cabbe7f79a5d3ad66dfb7f09955b2d9e7e9f009">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>${
          isSpidLevelValid
            ? SpidLevelEnum["https://www.spid.gov.it/SpidL2"]
            : SpidLevelEnum["https://www.spid.gov.it/SpidL1"]
        }</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="name">
        <saml:AttributeValue xsi:type="xs:string">Giuseppe Maria</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="familyName">
        <saml:AttributeValue xsi:type="xs:string">Garibaldi</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="email">
        <saml:AttributeValue xsi:type="xs:string">x@example.com</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="fiscalNumber">
        <saml:AttributeValue xsi:type="xs:string">TINIT-GRBGPP87L04L741X</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>`;

// mock for a valid SpidUser
const mockedSpidUser: SpidUser = {
  authnContextClassRef: aValidSpidLevel,
  email: aValidEmailAddress,
  familyName: "Garibaldi",
  fiscalNumber: aValidFiscalNumber,
  getAssertionXml: getMockedAssertionXml(true),
  issuer: anIssuer,
  name: "Giuseppe Maria"
};

// mock for an invalid SpidUser
const mockedInvalidSpidUser = {
  aKey: "aValue"
};

const mockedSpidUserWithInvalidLevel = {
  ...mockedSpidUser,
  getAssertionXml: getMockedAssertionXml(false)
};

// mock for a valid logged user
const mockedUser: LoggedUser = {
  createdAt: new Date(),
  email: aValidEmailAddress,
  familyName: "Garibaldi" as NonEmptyString,
  fiscalCode: aValidFiscalNumber,
  givenName: "Giuseppe Maria" as NonEmptyString,
  role: UserRoleEnum.ORG_DELEGATE,
  session: {
    createdAt: new Date(),
    deletedAt: null,
    email: aValidEmailAddress,
    expirationTime: new Date(Date.now() + tokenDurationInSeconds * 1000),
    token: "HexToKen" as SessionToken
  }
};

describe("user type", () => {
  /* test case: extract user info from Express request */
  it("should get a user from Express request", done => {
    // Express request mock
    const req = mockReq();

    // populate mock request with User
    req.user = mockedUser;

    // extract the user data from Express request
    const userData = LoggedUser.decode(req.user);

    expect(userData.isRight()).toBeTruthy();
    if (userData.isRight()) {
      expect(userData._tag).toBe("Right");
      expect(userData.value).toBe(req.user);
    }
    done();
  });

  it("should correctly validate Spid user info with validateSpidUser", done => {
    // Validate correct SpidUser. Return right.
    const userDataOK = validateSpidUser(mockedSpidUser);

    expect(userDataOK.isRight()).toBeTruthy();
    if (userDataOK.isRight()) {
      expect(userDataOK._tag).toBe("Right");
    }

    // Validate incorrect SpidUser(User). Return left.
    const userDataKO = validateSpidUser(mockedInvalidSpidUser);

    expect(userDataKO.isLeft()).toBeTruthy();
    if (userDataKO.isLeft()) {
      expect(userDataKO._tag).toBe("Left");
    }

    // Validate SpidUser with insufficient authentication level. Return left.
    const userAuthLevelKO = validateSpidUser(mockedSpidUserWithInvalidLevel);

    expect(userAuthLevelKO.isLeft()).toBeTruthy();
    if (userAuthLevelKO.isLeft()) {
      expect(userAuthLevelKO._tag).toBe("Left");
    }

    done();
  });
});
