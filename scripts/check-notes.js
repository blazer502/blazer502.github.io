#!/usr/bin/env node

const {
  loadWorkspace,
  validateWorkspace,
} = require('./lib/notes');

const workspace = loadWorkspace();
const result = validateWorkspace(workspace);

for (const warning of result.warnings) {
  console.warn(`warning: ${warning}`);
}

if (result.errors.length > 0) {
  for (const error of result.errors) {
    console.error(`error: ${error}`);
  }
  process.exit(1);
}

console.log(`Checked ${workspace.notes.length} notes. No broken wikilinks found.`);
