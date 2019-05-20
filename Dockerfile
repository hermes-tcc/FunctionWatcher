ARG FUNCTION_BUILDER_IMAGE 
ARG FUNCTION_WATCHER_BASE
FROM ${FUNCTION_BUILDER_IMAGE} as build

###################################################

FROM ${FUNCTION_WATCHER_BASE} as dev 

ENV PORT 8080

EXPOSE ${PORT}

WORKDIR /app/server

ENV NODE_ENV=development

COPY package.json yarn.lock ./

RUN yarn

COPY . .

COPY --from=build /function /app/function

ARG FUNCTION_HANDLER

ENV FUNCTION_HANDLER ${FUNCTION_HANDLER}

RUN yarn tsc

CMD [ "yarn", "nodemon" ]

###################################################

FROM ${FUNCTION_WATCHER_BASE} as prod 

ENV PORT 8080

EXPOSE ${PORT}

WORKDIR /app/server

ENV NODE_ENV=production

COPY package.json yarn.lock ./

RUN yarn

COPY --from=dev /app/server/build /app/server

COPY --from=build /function /app/function

ARG FUNCTION_HANDLER

ENV FUNCTION_HANDLER ${FUNCTION_HANDLER}

CMD [ "yarn", "start:prod" ]