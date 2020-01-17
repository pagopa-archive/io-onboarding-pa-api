export default {
  profileController: {
    editProfile: {
      notificationEmail: {
        content:
          "Ciao %s, la tua email di lavoro è stata modificata con successo, da questo momento riceverai le comunicazioni al nuovo indirizzo da te scelto.",
        subject: "Modifica dell'email di lavoro"
      }
    }
  },
  requestController: {
    registerOrganization: {
      contract:
        "Contratto di adesione tra \"IO - L'app per i servizi pubblici\" e %s per l'utilizzo dei servizi forniti dalla piattaforma.",
      delegation:
        "Io sottoscritto %legalRepresentative%, in qualità di responsabile legale dell'ente %organizationName%, delego a %delegate% la gestione dell'attività dell'ente sulla piattaforma IO."
    },
    sendEmailWithDocumentsToOrganizationPec: {
      registrationEmail: {
        content:
          "In allegato la documentazione necessaria per la registrazione di questo ente presso la piattaforma IO.",
        subject: "Registrazione presso la piattaforma IO"
      }
    }
  }
};
