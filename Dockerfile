# Build the static bundle, then serve it from nginx.
#
# The Supabase URL and anon key are compiled into the bundle, so they are build
# arguments rather than runtime environment variables — setting them as Fly
# secrets would have no effect, because by then the JavaScript is already
# written.
#
# Only the anon key belongs here. It is public by design and every request it
# makes is still subject to row level security. The service role key bypasses
# RLS entirely and must never reach a browser or an image layer.

FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Dependencies first, so a source-only change does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Fails the build rather than shipping a bundle that throws on load, which is
# what happens when these are missing: src/lib/supabase.ts refuses to start.
RUN test -n "$VITE_SUPABASE_URL" || (echo "VITE_SUPABASE_URL build arg is required" && exit 1)
RUN test -n "$VITE_SUPABASE_ANON_KEY" || (echo "VITE_SUPABASE_ANON_KEY build arg is required" && exit 1)
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
