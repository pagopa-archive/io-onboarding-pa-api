/**
 * Builds and configure a Passport strategy to authenticate the proxy to the
 * different SPID IDPs.
 */
import { distanceInWordsToNow, isAfter, subDays } from "date-fns";
import * as SpidStrategy from "spid-passport";
import * as x509 from "x509";
import { SpidUser } from "../types/spidUser";
import {
  fetchIdpMetadata,
  IDPOption,
  mapIpdMetadata,
  parseIdpMetadata
} from "../utils/idpLoader";
import { log } from "../utils/logger";

const IDP_IDS: { [key: string]: string | undefined } = {
  "https://id.lepida.it/idp/shibboleth": "lepidaid",
  "https://identity.infocert.it": "infocertid",
  "https://identity.sieltecloud.it": "sielteid",
  "https://idp.namirialtsp.com/idp": "namirialid",
  "https://login.id.tim.it/affwebservices/public/saml2sso": "timid",
  "https://loginspid.aruba.it": "arubaid",
  "https://posteid.poste.it": "posteid",
  "https://spid.intesa.it": "intesaid",
  "https://spid.register.it": "spiditalia"
};

/**
 * Load idp Metadata from a remote url, parse infomations and return a mapped and whitelisted idp options
 * for spidStrategy object.
 */
export async function loadFromRemote(
  idpMetadataUrl: string
): Promise<{ [key: string]: IDPOption | undefined }> {
  log.info("Fetching SPID metadata from [%s]...", idpMetadataUrl);
  const idpMetadataXML = await fetchIdpMetadata(idpMetadataUrl);
  log.info("Parsing SPID metadata...");
  const idpMetadata = parseIdpMetadata(idpMetadataXML);
  if (idpMetadata.length < Object.keys(IDP_IDS).length) {
    log.warn("Missing SPID metadata on [%s]", idpMetadataUrl);
  }
  log.info("Configuring IdPs...");
  return mapIpdMetadata(idpMetadata, IDP_IDS);
}

const spidStrategy = async (spidStrategyConfiguration: {
  samlKey: string;
  samlCert: string;
  samlCallbackUrl: string;
  samlIssuer: string;
  samlAcceptedClockSkewMs: number;
  samlAttributeConsumingServiceIndex: number;
  spidAutologin: string;
  spidTestEnvUrl: string;
  idpMetadataUrl: string;
}) => {
  const {
    samlKey,
    samlCert,
    samlCallbackUrl,
    samlIssuer,
    samlAcceptedClockSkewMs,
    samlAttributeConsumingServiceIndex,
    spidAutologin,
    spidTestEnvUrl,
    idpMetadataUrl
  } = spidStrategyConfiguration;
  const idpsMetadataOption = await loadFromRemote(idpMetadataUrl);

  logSamlCertExpiration(samlCert);

  const options: {
    idp: { [key: string]: IDPOption | undefined };
    // tslint:disable-next-line:no-any
    sp: any;
  } = {
    idp: {
      ...idpsMetadataOption,
      xx_testenv2: {
        cert: [
          "MIICljCCAX4CCQD95d+Rc57oJzANBgkqhkiG9w0BAQsFADANMQswCQYDVQQGEwJJ" +
            "VDAeFw0xOTA4MDExMDIzNDNaFw0xOTA4MzExMDIzNDNaMA0xCzAJBgNVBAYTAklU" +
            "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAt5FPNTrAaMbpxDMYJ0K3" +
            "7cF5EGgZMvKW+t+UyYjFQ/mcHllXr2d6qmUwz6fFqzvWOCmnc5AdsDDBLaaRrC19" +
            "Isz3jcZxSKCywoD5hTNPDTJYRxqjqRC5FvcIzMGkME86VtQoNDZDFlzrgQREBj1S" +
            "2Nkx+yPN573voCgEyf9JZofCiiNBWPPeX4qaxXjBdzBRmU5Nt1Ma5j7DNjD/VzLE" +
            "ISeB11XjFdSD+kWJkNzQsYB8sI20tkvtrkCz7uTTUQKoKHO6ut44711h76L0nbqI" +
            "hufiCctIZEHqwCd2vK5Cr5MRxcLFSwDsGp8aTh0EZVoBKQEBQthKAzOSEA5y0lBh" +
            "bwIDAQABMA0GCSqGSIb3DQEBCwUAA4IBAQBVYK+l6vuS3WTBtK2Znk02k23xgcyJ" +
            "fa4Y0YRj5iKN5Lx18cRYE8DsaZ+icZWRf7fzwspkBZLLvfl/GTXNN5k7XspptYGf" +
            "wY6ubX2iNpIhdP5vGzMQ4RnYN77ACpYAaVwR12rPciq+jsuvs3bawSe+hWRog/V2" +
            "1NyMYO9HytlZ+8Fqirf9VR+Mnfw4ptv1xGD0kmHBEMEErACYkV76jEccdENMuO9j" +
            "Bu3U0MY+rqthdEydoAVr6CvcwDmQ0T/GsYGMqZBQIQu19VlwQ4Lbc6B85tJjEDR3" +
            "9tCX2yNqSFD5oI8BAXaXk+mTAtZ+4cvYIbKxtBge6LIsnc5NMOlNVA22"
        ],
        entityID: "xx_testenv2",
        entryPoint: spidTestEnvUrl + "/sso",
        logoutUrl: spidTestEnvUrl + "/slo"
      }
    },
    sp: {
      acceptedClockSkewMs: samlAcceptedClockSkewMs,
      attributeConsumingServiceIndex: samlAttributeConsumingServiceIndex,
      attributes: {
        attributes: [
          "email",
          "familyName",
          "fiscalNumber",
          "name",
          "mobilePhone"
        ],
        name: "Required attributes"
      },
      callbackUrl: samlCallbackUrl,
      decryptionPvk: samlKey,
      identifierFormat: "urn:oasis:names:tc:SAML:2.0:nameid-format:transient",
      issuer: samlIssuer,
      organization: {
        URL: "https://io.italia.it",
        displayName: "IO - l'app dei servizi pubblici BETA",
        name:
          "Team per la Trasformazione Digitale - Presidenza Del Consiglio dei Ministri"
      },
      privateCert: samlKey,
      signatureAlgorithm: "sha256"
    }
  };

  const optionsWithAutoLoginInfo = {
    ...options,
    sp: {
      ...options.sp,
      additionalParams: {
        auto_login: spidAutologin
      }
    }
  };

  return new SpidStrategy(
    spidAutologin === "" ? options : optionsWithAutoLoginInfo,
    (
      profile: SpidUser,
      done: (err: Error | undefined, info: SpidUser) => void
    ) => {
      log.info(profile.getAssertionXml());
      done(undefined, profile);
    }
  );
};

/**
 * Reads dates information in x509 certificate and logs remaining time to its expiration date.
 * @param samlCert x509 certificate as string
 */
function logSamlCertExpiration(samlCert: string): void {
  try {
    const out = x509.parseCert(samlCert);
    if (out.notAfter) {
      const timeDiff = distanceInWordsToNow(out.notAfter);
      const warningDate = subDays(new Date(), 60);
      if (isAfter(out.notAfter, warningDate)) {
        log.info("samlCert expire in %s", timeDiff);
      } else if (isAfter(out.notAfter, new Date())) {
        log.warn("samlCert expire in %s", timeDiff);
      } else {
        log.error("samlCert expired from %s", timeDiff);
      }
    } else {
      log.error("Missing expiration date on saml certificate.");
    }
  } catch (e) {
    log.error("Error calculating saml cert expiration: %s", e);
  }
}

export default spidStrategy;
