#!/usr/bin/env node

import OpenAI from "openai";
import { Anthropic } from "@anthropic-ai/sdk";
import { Groq } from "groq-sdk";
import fs from "fs-extra";
import path from "path";
import ora from "ora";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const spinner = ora({
  text: "Philosopher Otter is reading your code...",
  spinner: "dots12"
}).start();

async function main() {
  const question = process.argv.slice(2).join(" ");
  if (!question) {
    spinner.fail("Usage: npx otter-ask \"your question here\"");
    process.exit(1);
  }

  const provider = process.env.OPENAI_API_KEY ? "openai" :
                   process.env.ANTHROPIC_API_KEY ? "anthropic" :
                   process.env.GROQ_API_KEY ? "groq" : null;

  if (!provider) {
    spinner.fail("No API key found! Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GROQ_API_KEY");
    process.exit(1);
  }

  spinner.text = "Otter is swimming through your files...";

  const files = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name.includes("dist") || entry.name.includes(".git")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        try {
          const content = await fs.readFile(fullPath, "utf-8");
          if (content.length < 50000) {
            files.push(`\n--- ${path.relative(process.cwd(), fullPath)} ---\n${content.substring(0, 12000)}`);
          }
        } catch (e) { /* skip unreadable files */ }
      }
    }
  }
  await walk(process.cwd());

  const context = files.join("\n\n").substring(0, 120000);

  spinner.text = "Philosopher Otter is having deep thoughts...";

  try {
    if (provider === "openai") {
      const openai = new OpenAI();
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        stream: true,
        temperature: 0.3,
        messages: [
          { role: "system", content: "You are an expert programmer. Answer concisely and clearly." },
          { role: "user", content: `Codebase context (files below):\n${context}\n\nQuestion: ${question}` }
        ]
      });
      spinner.stop();
      process.stdout.write("\n");
      for await (const chunk of stream) {
        process.stdout.write(chunk.choices[0]?.delta?.content || "");
      }
    }
    // Add Groq/Anthropic later if you want
  } catch (err) {
    spinner.fail("Otter drowned :(");
    console.error(err.message);
  }
  console.log("\n");
}

main().catch(console.error);
