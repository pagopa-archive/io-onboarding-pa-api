FROM circleci/node:10.14.1 as builder

RUN sudo apt-get update
RUN sudo apt-get --yes install ghostscript
RUN sudo apt-get --yes install libgs-dev

WORKDIR /usr/src/app

COPY /src /usr/src/app/src
COPY /package.json /usr/src/app/package.json
COPY /tsconfig.json /usr/src/app/tsconfig.json
COPY /yarn.lock /usr/src/app/yarn.lock
COPY /openapi.yml /usr/src/app/openapi.yml

RUN sudo chmod -R 777 /usr/src/app \
  && yarn install \
  && yarn build

FROM node:10.14.1-alpine
LABEL maintainer="https://teamdigitale.governo.it"

# Install major CA certificates to cover
# https://github.com/SparebankenVest/azure-key-vault-to-kubernetes integration
RUN apk update && \
  apk add ca-certificates ghostscript ghostscript-dev

WORKDIR /usr/src/app
COPY /package.json /usr/src/app/package.json
COPY --from=builder /usr/src/app/dist /usr/src/app/dist
COPY --from=builder /usr/src/app/node_modules /usr/src/app/node_modules

EXPOSE 3000

CMD ["yarn", "start"]
