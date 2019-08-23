# io-onboarding-pa
This repository contains the code of the backend used by the onboarding portal for public administrations of the IO project.

## How to run the application

### Dependencies

* [Docker](https://www.docker.com/) and [Docker Compose](https://github.com/docker/compose)

To fully simulate the SPID authentication process we use the images provided by the
[spid-testenv2](https://github.com/italia/spid-testenv2) project.

A Linux/macOS environment is required at the moment.

### Installation steps

1. clone the project in a folder called `io-onboarding-backend`
2. go to the project's folder
3. run the command `yarn generate-test-certs` to create SAML (SPID) certificates
4. create a .env file and configure the values inside: `cp .env.example .env`
5. run `docker-compose up -d` to start the containers
6. edit your `/etc/hosts` file by adding:
    ```
    127.0.0.1    spid-testenv2
    127.0.0.1    io-onboarding-backend
    ```
7. point your browser to [http://io-onboarding-backend:3000/metadata](http://io-onboarding-backend:3000/metadata) and copy the source of the
    page to a new `testenv2/conf/sp_metadata.xml` file
8. in the `testenv2/conf/sp_metadata.xml` file:
  - remove the `<EncryptionMethod>` elements
  - between the elements `<KeyDescriptor>` and `<NameIDFormat>` add the following element:
     ```
     <SingleLogoutService 
         Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
         Location="http://io-onboarding-backend:3000/spid/logout" /> 
    ``` 
9. run `docker-compose restart` to restart the containers
10. point your browser to [http://io-onboarding-backend:3000](http://io-onboarding-backend:3000)

### Environment variables

The table below describes all the Environment variables needed by the application.

| Variable name                          | Description                                                                       | type   |
|----------------------------------------|-----------------------------------------------------------------------------------|--------|
| PGHOST                                 | The name of postgres server host to connect to                                    | string |
| PGPASSWORD                             | The password used to connect to postgres server                                   | string |
| PGUSER                                 | PostgreSQL user name to connect as                                                | string |
| PGDATABASE                             | The database name                                                                 | string |
| CLIENT_SPID_ERROR_REDIRECTION_URL      | The path where the user will be redirected when en error occurs during SPID login | string |
| CLIENT_SPID_SUCCESS_REDIRECTION_URL    | The path where the user will be redirected after a successful SPID login          | string |
| SAML_ACCEPTED_CLOCK_SKEW_MS            | The value of the accepted clock skew in milliseconds                              | number |
| SAML_ATTRIBUTE_CONSUMING_SERVICE_INDEX | The index in the attribute consumer list                                          | number |
| SAML_CALLBACK_URL                      | The absolute URL of the assertion consumer service endpoint                       | string |
| SAML_ISSUER                            | The issuer id for this Service Provider                                           | string |
| SPID_AUTOLOGIN                         | The user used in the autologin feature, omit this to disable autologin            | string |
| SPID_TESTENV_URL                       | The absolute URL of the test IDP server                                           | string |
| IDP_METADATA_URL                       | Url to download IDP metadata from                                                 | string |
| TOKEN_DURATION_IN_SECONDS              | The number of seconds a session token is considered valid                         | int    |
| API_BASE_PATH                          | The root path for the api endpoints                                               | string |
