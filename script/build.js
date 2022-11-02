import { walk } from "fs";
import postcss from "postcss";
import atimport from "npm:postcss-import";
import assignvars from "./assignvars.js";

const processor = postcss([atimport(), assignvars()]);

await Promise.all([fetchResetCSS(), cleanDist()]);

for await (const entry of walk("./src")) {
  if (
    entry.isFile && entry.name.endsWith(".css") && !entry.name.startsWith("_")
  ) {
    build(entry);
  }
}

// fetch https://github.com/elad2412/the-new-css-reset
async function fetchResetCSS() {
  const dir = "./src/_the-new-css-reset.css";
  const shouldFetch = await Deno.lstat(dir)
    .then((f) => {
      if (!f.isFile) throw Deno.errors.NotFound();
      return false;
    })
    .catch((err) => {
      if (err instanceof Deno.errors.NotFound) {
        return true;
      } else {
        throw err;
      }
    });
  if (shouldFetch) {
    const res = await fetch(
      "https://esm.sh/the-new-css-reset@1.7.3/css/reset.css",
    );
    if (!res.ok) throw Error(res.body);
    const text = await res.text();
    await Deno.writeTextFile(dir, text);
  }
}

// clen dist directry
async function cleanDist() {
  await Deno.remove("./dist", { recursive: true }).catch((err) => {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  });
  await Deno.mkdir("./dist");
}

async function build(entry) {
  const css = await Deno.readTextFile(entry.path);
  const to = "./dist/" + entry.name;
  const output = await processor.process(css, { from: entry.path, to });
  await Deno.writeTextFile(to, output);
}
