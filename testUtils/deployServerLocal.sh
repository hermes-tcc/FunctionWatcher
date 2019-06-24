display_usage() { 
  echo -e "\nUsage: ./deployServerLocal FN_PATH\n" 
} 

if [  $# -le 0 ] 
then 
  display_usage
  exit 1
fi 

set -euo pipefail

HERMES_CONFIG_PATH="$1/hermes.config.json"
FN_NAME=$( cat $HERMES_CONFIG_PATH | python -c "import json,sys;obj=json.load(sys.stdin);print obj['functionName'];")
LANGUAGE=$( cat $HERMES_CONFIG_PATH | python -c "import json,sys;obj=json.load(sys.stdin);print obj['language'];")
FN_BUILDER_DOCKERFILE=$( curl https://raw.githubusercontent.com/hermes-tcc/project-building-base-images/master/$LANGUAGE.Dockerfile )

echo "======== BUILDING FUNCTION ========"
echo "$FN_BUILDER_DOCKERFILE" | \
  docker build  -t tiagonapoli/build-$FN_NAME \
                -f - \
                $1
echo ""
echo ""

echo "======== BUILDING WATCHER ========"
docker build  -t tiagonapoli/watcher-$FN_NAME \
              --target=development \
              --build-arg FN_IMAGE=tiagonapoli/build-$FN_NAME \
              --build-arg FN_LANGUAGE=$LANGUAGE \
              ../
echo ""
echo ""


cd ../
SRC_PATH="$(pwd)"
cd testUtils

docker run -it --rm \
  -p 8888:8888 \
  -e PORT=8888 \
  -e DEBUG=true \
  -e REDIS_CHANNEL=debug-channel \
  --name=$FN_NAME-test-watcher \
  --mount type=bind,source=$SRC_PATH,target=/app/server \
  tiagonapoli/watcher-$FN_NAME