import { readFileSync } from "node:fs";
import { browser, PHONE } from "./lib.mjs";
const link = readFileSync(".walkthrough2/invite.txt","utf8").trim();
const b = await browser();
const ctx = await b.newContext({ viewport: PHONE });
const p = await ctx.newPage();
await p.goto(link, { waitUntil: "networkidle" });
console.log(await p.evaluate(()=>[...document.querySelectorAll("a")].map(a=>a.innerText.trim()+" -> "+a.getAttribute("href")).join("\n")));
await b.close();
