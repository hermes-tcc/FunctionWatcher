set -euxo pipefail

docker build  -t tiagonapoli/function-builder \
              -f ../../ProjectBuilderImages/cuda.Dockerfile \
              $1

docker build  -t tiagonapoli/function-watcher-cuda-base \
              -f ../../FunctionWatcher/baseImages/cuda.Dockerfile \
              ../../FunctionWatcher/

docker build  -t tiagonapoli/$2_watcher \
              --target=dev \
              --build-arg FUNCTION_BUILDER_IMAGE=tiagonapoli/function-builder \
              --build-arg FUNCTION_WATCHER_BASE=tiagonapoli/function-watcher-cuda-base \
              ../../FunctionWatcher/

docker run -it --rm -p 8888:8888 -e PORT=8888 -e DEBUG=true --name=$2-test-watcher tiagonapoli/$2_watcher 