# The war server (game/server.js) and what it needs at runtime: the resolver's table, the simulator engine (battle
# replays re-fight battles with it) and the built site, whose data the engine reads. No dependencies to install.
FROM node:22-slim
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data TRUST_PROXY=1
WORKDIR /app
COPY game/ game/
COPY tools/resolver/ tools/resolver/
COPY tools/sim/load.js tools/sim/assemble.js tools/sim/
COPY tools/sim/engine/ tools/sim/engine/
COPY site/index.html site/index.html
# the war's data lives on a mounted volume at /data, owned by the unprivileged node user
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "game/server.js"]
