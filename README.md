# IO Onboarding portal backend

This repository contains the code of the backend application of the IO Public
Administrations onboarding portal.

## What is IO?

More informations can be found on the [IO project website](https://io.italia.it).

## Prerequisites

- [Bash](https://www.gnu.org/software/bash/) or [GitBash](https://gitforwindows.org/)
- [Docker](https://www.docker.com/)
- [Docker Compose](https://github.com/docker/compose)

### Dependencies

In order to test the backend locally, aside the backend NodeJS process,
some services must be up and running:

- [SPID test environment](https://github.com/italia/spid-testenv2)
- [PostgreSQL](https://postgresql.org) for data persistence
- [MailHog] smtp server (to test emails)

All these services starts automatically running docker-compose.

## Environment variables

#### Required environment variables

The table lists the environment variables needed by the application;
they may be customized as needed.

| Variable name                          | Description                                                                       | type    |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------- |
| BACKEND_PORT                           | Port of express web server                                                        | number  |
| POSTGRESQL_HOST                        | The name of postgres server host to connect to                                    | string  |
| POSTGRESQL_PASSWORD                    | The password used to connect to postgres server                                   | string  |
| POSTGRESQL_USERNAME                    | PostgreSQL user name to connect as                                                | string  |
| POSTGRESQL_DATABASE                    | The database name                                                                 | string  |
| CLIENT_DOMAIN                          | The client domain, which will be CORS-enabled                                     | string  |
| COOKIE_DOMAIN                          | The allowed hosts to receive the cookie containing the session token              | string  |
| CLIENT_SPID_LOGIN_REDIRECTION_URL      | The path where the user will be redirected to perform a SPID login                | string  |
| CLIENT_SPID_ERROR_REDIRECTION_URL      | The path where the user will be redirected when en error occurs during SPID login | string  |
| CLIENT_SPID_SUCCESS_REDIRECTION_URL    | The path where the user will be redirected after a successful SPID login          | string  |
| SAML_ACCEPTED_CLOCK_SKEW_MS            | The value of the accepted clock skew in milliseconds                              | number  |
| SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX | The index in the attribute consumer list                                          | number  |
| SAML_CALLBACK_URL                      | The absolute URL of the assertion consumer service endpoint                       | string  |
| SAML_ISSUER                            | The issuer id for this Service Provider                                           | string  |
| SAML_CERT_PATH                         | The path of the public certificate used in SAML authentication to a SPID IdP.     | string  |
| SAML_KEY_PATH                          | The path of the private key used in SAML authentication to a SPID IdP.            | string  |
| SPID_AUTOLOGIN                         | The user used in the autologin feature, omit this to disable autologin            | string  |
| SPID_TESTENV_URL                       | The absolute URL of the test IDP server                                           | string  |
| IDP_METADATA_URL                       | Url to download IDP metadata from                                                 | string  |
| TOKEN_DURATION_IN_SECONDS              | The number of seconds a session token is considered valid                         | int     |
| EMAIL_PASSWORD                         | The password used to connect to the email server                                  | string  |
| EMAIL_USER                             | The user to connect to the email server                                           | string  |
| EMAIL_SMTP_HOST                        | The hostname or IP address of the SMTP server                                     | string  |
| EMAIL_SMTP_PORT                        | The port of the SMTP server                                                       | int     |
| EMAIL_SMTP_SECURE                      | If set to true, uses TLS in SMTP connection                                       | boolean |
| EMAIL_SENDER                           | The email address of the sender                                                   | string  |
| INDICEPA_ADMINISTRATIONS_URL           | The URL to download the public administrations info from                          | string  |
| ARSS_WSDL_URL                          | The WSDL URL of Aruba Remote Sign Service                                         | string  |
| ARSS_IDENTITY_OTP_PWD                  | The valid user OTP for the ARSS signature transaction                             | string  |
| ARSS_IDENTITY_TYPE_OTP_AUTH            | The authentication domain of the ARSS user                                        | string  |
| ARSS_IDENTITY_USER                     | The username of the ARSS user                                                     | string  |
| ARSS_IDENTITY_USER_PWD                 | The password of the ARSS user                                                     | string  |

#### Optional environment variables

The table lists the optional environment variables: if any of them is not set,
the application will use its default value instead.

| Variable name                       | Description                                                             | type   | default |
| ----------------------------------- | ----------------------------------------------------------------------- | ------ | ------- |
| ADMINISTRATION_SEARCH_RESULTS_LIMIT | The maximum number of administrations returned when performing a search | number | 30      |

## Production deployments

An Azure pipeline is configured by the IO adminstrators
to run on each push on the master branch.

Each time a change is merged, a corresponding Docker image is automatically created on
[DockerHub](https://cloud.docker.com/u/teamdigitale/repository/docker/teamdigitale/io-onboarding-pa-api).

The image is then deployed on Kubernetes clusters using a dedicated helm-chart;
see the [production deployment repository](https://github.com/teamdigitale/io-infrastructure-post-config).

The deployed backend is reachable at
[https://api.pa-onboarding.dev.io.italia.it/]https://api.pa-onboarding.dev.io.italia.it/).

## Test the application locally

To build the application and starts the services, run from the project root:

```shell
cp env.example .env
# edit .env
docker-compose up -d database
docker-compose up
```

> The _docker-compose.yaml_ file sources variables from a _.env_ file that must be
> placed in the root folder of this repository. An example file _env.example_ is
> distributed with the code.

The backend REST APIs can be now accessed at
[http://localhost:3000](http://localhost:3000).

To rebuild the software and see changes:

```shell
docker-compose up --build
```

### Skip docker

If you run a suitable environment (ie. a Linux machine with NodeJS and yarn installed),
you can avoid using docker and run the backend application directly.

First, install [nvm](https://github.com/nvm-sh/nvm),
NodeJS and [Yarn](https://yarnpkg.com/lang/en/).

In this setup you must connect the application
to a running PostgreSQL instance and a configured SPID test environment.

You may try with a hybrid setup starting these services using docker-compose
before running the backend since ports are exposed by default:

```shell
# change .env *_HOST settings to point to localhost then run
docker-compose up -d database spid-testenv2 mailhog
```

Finally, run the backend locally:

```shell
nvm install $(< .node-version)
nvm use $(< .node-version)
yarn install
yarn watch
```

### Modify SPID Service Provider certificates

To create new certificates, run the command

```shell
rm certs/*
yarn generate-test-certs
```

Then, start the containers using _docker-compose_ and point your browser to
[http://localhost:3000/metadata](http://localhost:3000/metadata). You should now
manually replace the content of the _testenv2/conf/sp_metadata.xml_ file with
the output of this page.

To complete the configuration, remove from the _testenv2/conf/sp_metadata.xml_
file the `<EncryptionMethod>` elements, and add between the elements
`<KeyDescriptor>` and `<NameIDFormat>` the following tag:

```xml
<SingleLogoutService
   Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
   Location="http://localhost:3000/spid/logout" />
```

Finally, run `docker-compose restart` and start using the backend application
with the new certificates.

## Test the login with SPID

SPID test users attributes and credentials are listed
in the page [http://localhost:8088/users](http://localhost:8088/users).

Two users are created by default:

- _pippo_ / _test_
- _pinco_ / _test_

To validate SPID login functionalities, point your browser to
[http://localhost:3000/login?entityID=xx_testenv2&authLevel=SpidL2](http://localhost:3000/login?entityID=xx_testenv2&authLevel=SpidL2)
and use the login credentials of one of the SPID test users configured.
