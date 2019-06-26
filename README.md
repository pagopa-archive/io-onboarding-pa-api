# io-onboarding-pa
IO onboarding portal webapp for public administrations


### Environment variables

The application uses some Environment variables; if they are not set, the app falls back to default values.
The table below describes all the Environment variables.

| Variable name       | Description                                       | type   | default value |
|---------------------|---------------------------------------------------|--------|---------------|
| POSTGRES_HOST       | The host name used in postgres connection string  | string | `localhost`   |
| POSTGRES_PASSWORD   | The password used in postgres connection string   | string | `password`    |
| POSTGRES_USER       | The user used in postgres connection string       | string | `postgres`    |