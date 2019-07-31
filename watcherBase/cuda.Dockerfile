FROM nvidia/cuda:10.1-runtime-ubuntu18.04

LABEL NODE_VERSION="12.x"

RUN apt-get update && \
  apt-get install -y curl && \
  curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
  echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
  curl -sL https://deb.nodesource.com/setup_12.x  | bash - && \
  apt-get purge -y curl && apt-get autoremove -y && \
  apt-get update && \
  apt-get install -y yarn nodejs && \
  rm -rf /var/lib/apt/lists/*