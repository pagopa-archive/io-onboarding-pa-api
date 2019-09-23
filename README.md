# IO PA Onboarding backend (API)

This repository contains the code of the backend application of the IO Public Administrations onboarding portal.

## What is IO?

More informations about the IO can be found on the [Digital Transformation Team website](https://teamdigitale.governo.it/en/projects/digital-citizenship.htm).

## Test environment

The application can be either tested on the developer host machine (using development tools on the developer machine, such as *yarn*) or using Docker.

Following paragraphs describe how to build and test the application locally, using *Docker*.

### Tools

For reference, the following tools are used to locally build and test the application:

* [Docker](https://www.docker.com/)

* [Docker Compose](https://github.com/docker/compose)

### Dependencies

A local SPID test environment is needed to fully test the application features. [spid-testenv2](https://github.com/italia/spid-testenv2) has been selected to achieve this goal.

### Build steps

The *Dockerfile* and the `docker-compose.yaml` files used to build the application, are in the root of this repository.

To build the application, run from the project root:

```shell
docker-compose up -d
```

>NOTE: the *docker-compose.yaml* file sets some environment variables that could be used to adapt the application features to specific needs. Variable values can be modified editing the *.env.example* file in this repository. More info about variables can be found in the dedicated paragraph, below in the readme.

Backend REST APIs can be now accessed at [http://localhost:3000](http://localhost:3000).

To bring down the test environment and remove the containers use

```shell
docker-compose down
```

Sometimes, you may need to rebuild the software. To do so, make sure you re-build the backend container, typing:

```shell
docker-compose up --build
```

### Modify SPID Service Provider certificates

It may be sometimes needed to modify the default SPID Service Provider certificates that come with the application.

To create new certificates, run the command 

```shell
yarn generate-test-certs
```

Then, start the containers using *docker-compose* and point your browser to [http://localhost:3000/metadata](http://localhost:3000/metadata).
You should now manually replace the content of the *testenv2/conf/sp_metadata.xml* file with the output of this page.

To complete the configuration, remove from the *testenv2/conf/sp_metadata.xml* file the `<EncryptionMethod>` elements, and add between the elements `<KeyDescriptor>` and `<NameIDFormat>` the following tag:

```xml
<SingleLogoutService 
   Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
   Location="http://localhost:3000/spid/logout" /> 
```

Finally, run `docker-compose restart` and start using the backend application with the new certificates.

## Test the login with SPID

The SPID test users available, their attributes and their credentials are listed in the page [http://localhost:8088/users](http://localhost:8088/users). If necessary, more users can be add as needed. 

Two users are created by default:

* *pippo* / *test*

* *pinco* / *test*

To validate SPID login functionalities, point your browser to [http://localhost:3000/login?entityID=xx_testenv2&authLevel=SpidL2](http://localhost:3000/login?entityID=xx_testenv2&authLevel=SpidL2) and use the login credentials of one of the SPID test users configured.

## Environment variables

The table lists the environment variables needed by the application, that may be further customized as needed.

| Variable name                          | Description                                                                       | type   |
|----------------------------------------|-----------------------------------------------------------------------------------|--------|
| POSTGRES_HOST                          | The name of postgres server host to connect to                                    | string |
| POSTGRES_PASSWORD                      | The password used to connect to postgres server                                   | string |
| POSTGRES_USER                          | PostgreSQL user name to connect as                                                | string |
| POSTGRES_DB                            | The database name                                                                 | string |
| CLIENT_DOMAIN                          | The client domain, which will be CORS-enabled                                     | string |
| CLIENT_SPID_LOGIN_REDIRECTION_URL      | The path where the user will be redirected to perform a SPID login                | string |
| CLIENT_SPID_ERROR_REDIRECTION_URL      | The path where the user will be redirected when en error occurs during SPID login | string |
| CLIENT_SPID_SUCCESS_REDIRECTION_URL    | The path where the user will be redirected after a successful SPID login          | string |
| SAML_ACCEPTED_CLOCK_SKEW_MS            | The value of the accepted clock skew in milliseconds                              | number |
| SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX | The index in the attribute consumer list                                          | number |
| SAML_CALLBACK_URL                      | The absolute URL of the assertion consumer service endpoint                       | string |
| SAML_ISSUER                            | The issuer id for this Service Provider                                           | string |
| SAML_CERT_PATH                         | The path of the public certificate used in SAML authentication to a SPID IdP.     | string |
| SAML_KEY_PATH                          | The path of the private key used in SAML authentication to a SPID IdP.            | string |
| SPID_AUTOLOGIN                         | The user used in the autologin feature, omit this to disable autologin            | string |
| SPID_TESTENV_URL                       | The absolute URL of the test IDP server                                           | string |
| IDP_METADATA_URL                       | Url to download IDP metadata from                                                 | string |
| TOKEN_DURATION_IN_SECONDS              | The number of seconds a session token is considered valid                         | int    |
| API_BASE_PATH                          | The root path for the api endpoints                                               | string |

## Production deployments

Each time a modification is merged in the repository, a corresponding Docker image is automatically created on [DockerHub](https://cloud.docker.com/u/teamdigitale/repository/docker/teamdigitale/io-onboarding-pa-api).

The image is deployed on Kubernetes clusters using a dedicated helm-chart. More info about production deployments can be found [here](https://github.com/teamdigitale/io-infrastructure-post-config).
