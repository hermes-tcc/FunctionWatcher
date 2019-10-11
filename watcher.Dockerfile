ARG FN_LANGUAGE

# ================ COMMON ================

FROM hermeshub/watcher-base-${FN_LANGUAGE} as common 

RUN mkdir -p /app/server && \
  mkdir -p /app/function && \
  mkdir -p /app/io/in && \
  mkdir -p /app/io/all

WORKDIR /app/server

COPY package.json yarn.lock ./

# ================ DEVELOPMENT ================

FROM common as development

ENV NODE_ENV=development

RUN yarn && yarn cache clean

COPY . .

RUN yarn tsc

# ================ PRODUCTION ================

FROM common as production 

ENV NODE_ENV=production

RUN yarn --production --ignore-scripts && \
  yarn autoclean --init && \
  echo *.ts >> .yarnclean && \
  echo *.ts.map >> .yarnclean && \
  echo *.spec.* >> .yarnclean && \
  yarn autoclean --force && \
  yarn cache clean

COPY --from=development /app/server/build .