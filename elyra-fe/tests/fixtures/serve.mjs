import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { resolve } from "node:path";

console.log("Bundling dashboard fixture");
const built = await Bun.build({
  entrypoints: ["./tests/fixtures/dashboard.tsx"],
  target: "browser",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.NEXT_PUBLIC_MAPS_EMBED_KEY": JSON.stringify(""),
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(""),
  },
  plugins: [
    {
      name: "test-session",
      setup(build) {
        build.onResolve({ filter: /^@clerk\/nextjs$/ }, () => ({
          path: "session",
          namespace: "fixture",
        }));
        build.onResolve({ filter: /^next\/image$/ }, () => ({
          path: "image",
          namespace: "fixture",
        }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          loader: "jsx",
          contents:
            path === "session"
              ? 'const token=async()=>"fixture"; export const useAuth=()=>({getToken:token})'
              : "export default function Image({unoptimized,...props}) {return <img {...props}/>}",
        }));
      },
    },
  ],
});
if (!built.success) throw new AggregateError(built.logs);
console.log("Compiling dashboard CSS");
const sheet = resolve("app/globals.css");
const { css } = await postcss([tailwind()]).process(await Bun.file(sheet).text(), { from: sheet });
console.log("Starting fixture server");
Bun.serve({
  hostname: "127.0.0.1",
  port: 3117,
  fetch(request) {
    switch (new URL(request.url).pathname) {
      case "/dashboard.js":
        return new Response(built.outputs[0], { headers: { "Content-Type": "text/javascript" } });
      case "/style.css":
        return new Response(css, { headers: { "Content-Type": "text/css" } });
      default:
        return new Response(
          '<meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/style.css"><main id="root"></main><script type="module" src="/dashboard.js"></script>',
          { headers: { "Content-Type": "text/html" } },
        );
    }
  },
});
