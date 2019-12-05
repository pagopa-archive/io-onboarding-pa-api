# IMAP AND VERIFY SIGNATURE DRAFT with fp-ts

This is an external process who is responsible for polling every minutes an imap server with the purpose of downloading attachments from email messages using [imap-simple](https://github.com/chadxz/imap-simple) library and for verifying the signature of attachments using at the moment the aruba demo soap webservice. The project uses
[fp-ts](https://github.com/gcanti/fp-ts) as core library.

# RUN

```bash
    // still draft not monorepo setup yet
    git clone https://github.com/teamdigitale/io-onboarding-pa-api
    cd io-onboarding-pa-api
    yarn install
    cd attachments-verify
    // TODO this will change only one global install maybe?
    yarn install
    // export imap env variables
    export IMAP_PASSWORD=XXXXXXXXXXXXX
    export IMAP_MAIL=XXXXXXXXXXXXXX
    export IMAP_HOST=XXXXXXXXXXXXX
    export IMAP_PORT=XXXXXXXXXXXXX
    yarn run dev // for development
    or
    yarn run start  // for production
```

# TODO

Change from all messages to UNSEEN and flag as SEEN
Write working tests.
Deal with all return cases from wsdl aruba
Change organization status via an API
Create a coherent monorepo with only one install or two indipendent
installation?

# CODE SAMPLES

The main problem that i tried to solve was to port this algorithms taken from imap-simple into a more functional oriented design using fp-ts.

```js
var imaps = require("imap-simple");

var config = {
  imap: {
    user: "your@email.address",
    password: "yourpassword",
    host: "imap.gmail.com",
    port: 993,
    tls: true,
    authTimeout: 3000
  }
};

imaps.connect(config).then(function(connection) {
  connection
    .openBox("INBOX")
    .then(function() {
      // Fetch emails from the last 24h
      var delay = 24 * 3600 * 1000;
      var yesterday = new Date();
      yesterday.setTime(Date.now() - delay);
      yesterday = yesterday.toISOString();
      var searchCriteria = ["UNSEEN", ["SINCE", yesterday]];
      var fetchOptions = {
        bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)"],
        struct: true
      };

      // retrieve only the headers of the messages
      return connection.search(searchCriteria, fetchOptions);
    })
    .then(function(messages) {
      var attachments = [];

      messages.forEach(function(message) {
        var parts = imaps.getParts(message.attributes.struct);
        attachments = attachments.concat(
          parts
            .filter(function(part) {
              return (
                part.disposition &&
                part.disposition.type.toUpperCase() === "ATTACHMENT"
              );
            })
            .map(function(part) {
              // retrieve the attachments only of the messages with attachments
              return connection
                .getPartData(message, part)
                .then(function(partData) {
                  return {
                    filename: part.disposition.params.filename,
                    data: partData
                  };
                });
            })
        );
      });

      return Promise.all(attachments);
    })
    .then(function(attachments) {
      console.log(attachments);
      // =>
      //    [ { filename: 'cats.jpg', data: Buffer() },
      //      { filename: 'pay-stub.pdf', data: Buffer() } ]
    });
});
```

Some solution example:

Deal with a simple promise

```ts
export const openInbox = (imap: Imap.ImapSimple): TaskEither<Error, string> => {
  return tryCatch(
    () => imap.openBox("INBOX"),
    reason => new Error(String(reason))
  );
};
```

Retrieve all attachments from messages retrieved on INBOX

```ts
export const getAttachemts = (
  imapServer: Imap.ImapSimple,
  messages: readonly Message[]
  // tslint:disable-next-line: readonly-array
): Array<TaskEither<Error, IMessageAttachmet>> => {
  return messages
    .map(message => {
      const parts = Imap.getParts(
        // tslint:disable-next-line: no-any
        // tslint:disable-next-line: readonly-array
        message.attributes.struct as any[]
      );
      // tslint:disable-next-line: readonly-array
      return parts
        .filter(
          part =>
            part.disposition &&
            part.disposition.type.toUpperCase() === "ATTACHMENT"
        )
        .map(attach => extractAttachment(imapServer, message, attach));

      //return partsAttachments;
    })
    .reduce((accumulator, value) => accumulator.concat(value), []);
};
```

Create a pipeline of lazy transformations that mimic imap-simple sample algorithm.

```ts
const connectionImapSequence = ImapFunctions.imap(imapOption).chain(imap =>
  ImapFunctions.openInbox(imap)
    .chain(() => ImapFunctions.searchMails(imap, searchCriteria, fetchOptions))
    .map(messages =>
      array.sequence(taskEither)(ImapFunctions.getAttachemts(imap, messages))
    )
);
```

The results mainly with few behaviours change is the code released.
