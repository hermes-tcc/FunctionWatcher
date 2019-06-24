ARG FN_IMAGE 
ARG FN_LANGUAGE
FROM ${FN_IMAGE} as function

# ================ COMMON ================

FROM hermeshub/watcher-base-${FN_LANGUAGE} as common 

RUN mkdir -p /app/server && \
  mkdir -p /app/function && \
  mkdir -p /app/io/in && \
  mkdir -p /app/io/out && \
  mkdir -p /app/io/err && \
  mkdir -p /app/io/rep

WORKDIR /app/server

COPY package.json yarn.lock ./

# ================ DEVELOPMENT ================

FROM common as development 

ENV NODE_ENV=development

RUN yarn

COPY . .

COPY --from=function /function /app/function

CMD [ "yarn", "nodemon" ]

# ================ PRODUCTION-BASE ================

FROM common as production-base

ENV NODE_ENV=development

RUN yarn

COPY . .

RUN yarn tsc

# ================ PRODUCTION ================

FROM common as production 

ENV NODE_ENV=production

RUN yarn

COPY --from=production-base /app/server/build /app/server

COPY --from=function /function /app/function

CMD [ "yarn", "start:prod" ]