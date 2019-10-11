ARG FN_IMAGE 
ARG FN_LANGUAGE

FROM ${FN_IMAGE} as function

# ================ PRODUCTION ================

FROM hermeshub/watcher-${FN_LANGUAGE} as production 

COPY --from=function /function /app/function

CMD [ "yarn", "start:prod" ]

# ================ DEVELOPMENT ================

FROM hermeshub/watcher-dev-${FN_LANGUAGE} as development 

COPY --from=function /function /app/function

CMD [ "yarn", "nodemon" ]