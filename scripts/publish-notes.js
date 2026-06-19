#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const {
  DATA_DIR,
  WIKI_NOTES_DIR,
  ensureDir,
  liquidLink,
  loadWorkspace,
  markdownLink,
  sortedNotes,
  sortedTags,
  stringifyFrontmatter,
  tagSlug,
  transformBody,
  validateWorkspace,
} = require('./lib/notes');

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${content.replace(/\s+$/u, '')}\n`, 'utf8');
}

function copyAssets(workspace) {
  for (const asset of workspace.assets) {
    const outputPath = path.join(WIKI_NOTES_DIR, asset.relPath);
    ensureDir(path.dirname(outputPath));
    fs.copyFileSync(asset.filePath, outputPath);
  }
}

function noteFrontmatter(note) {
  return stringifyFrontmatter({
    title: note.title,
    permalink: note.permalink,
    tags: note.tags,
    aliases: note.aliases,
    status: note.data.status,
    note_source: `notes/${note.relPath}`,
  });
}

function backlinksSection(workspace, note) {
  const backlinks = workspace.backlinks.get(note.slugPath) || [];
  if (backlinks.length === 0) return '';

  const items = sortedNotes(backlinks)
    .map((source) => `- ${markdownLink(source.title, source.permalink)}`)
    .join('\n');

  return `\n\n---\n\n## Backlinks\n\n${items}`;
}

function renderNote(workspace, note) {
  const body = transformBody(note.body, workspace, note);
  return [
    noteFrontmatter(note),
    '<!-- Generated from notes/. Edit the source note, then run `npm run notes:publish`. -->',
    '',
    body,
    backlinksSection(workspace, note),
  ].join('\n');
}

function renderIndex(workspace) {
  const index = workspace.indexSource;
  const title = index ? index.title : 'Study Notes';
  const intro = index ? transformBody(index.body, workspace, null) : '# Study Notes\n';
  const notes = sortedNotes(workspace.notes);
  const tags = sortedTags(workspace.notes);

  const noteItems = notes
    .map((note) => {
      const tagText = note.tags.map((tag) => `[#${tag}](${liquidLink(`/notes/tags/${tagSlug(tag)}/`)})`).join(' ');
      return `- ${markdownLink(note.title, note.permalink)}${tagText ? ` ${tagText}` : ''}`;
    })
    .join('\n');

  const tagItems = tags
    .map((tag) => `- [#${tag}](${liquidLink(`/notes/tags/${tagSlug(tag)}/`)})`)
    .join('\n');

  return [
    stringifyFrontmatter({
      title,
      permalink: '/notes/',
      note_source: 'notes/index.md',
    }),
    '<!-- Generated from notes/. Edit the source note, then run `npm run notes:publish`. -->',
    '',
    intro,
    '',
    '## All Notes',
    '',
    noteItems || 'No notes yet.',
    '',
    '## Tags',
    '',
    tagItems || 'No tags yet.',
  ].join('\n');
}

function renderTagPage(tag, notes) {
  const permalink = `/notes/tags/${tagSlug(tag)}/`;
  const items = sortedNotes(notes)
    .map((note) => `- ${markdownLink(note.title, note.permalink)}`)
    .join('\n');

  return [
    stringifyFrontmatter({
      title: `#${tag}`,
      permalink,
      is_wiki_page: false,
    }),
    `# #${tag}`,
    '',
    items || 'No notes yet.',
  ].join('\n');
}

function writeData(workspace) {
  ensureDir(DATA_DIR);
  const data = sortedNotes(workspace.notes).map((note) => ({
    title: note.title,
    aliases: note.aliases,
    tags: note.tags,
    status: note.data.status || null,
    source: `notes/${note.relPath}`,
    url: note.permalink,
    backlinks: sortedNotes(workspace.backlinks.get(note.slugPath) || []).map((source) => source.title),
  }));

  fs.writeFileSync(path.join(DATA_DIR, 'notes.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function publish() {
  const workspace = loadWorkspace();
  const validation = validateWorkspace(workspace);

  for (const warning of validation.warnings) {
    console.warn(`warning: ${warning}`);
  }

  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      console.error(`error: ${error}`);
    }
    process.exit(1);
  }

  fs.rmSync(WIKI_NOTES_DIR, { recursive: true, force: true });
  ensureDir(WIKI_NOTES_DIR);

  copyAssets(workspace);

  for (const note of workspace.notes) {
    writeFile(path.join(WIKI_NOTES_DIR, note.outputRelPath), renderNote(workspace, note));
  }

  writeFile(path.join(WIKI_NOTES_DIR, 'index.md'), renderIndex(workspace));

  const tags = sortedTags(workspace.notes);
  for (const tag of tags) {
    const taggedNotes = workspace.notes.filter((note) => note.tags.includes(tag));
    writeFile(path.join(WIKI_NOTES_DIR, 'tags', `${tagSlug(tag)}.md`), renderTagPage(tag, taggedNotes));
  }

  writeData(workspace);

  console.log(`Published ${workspace.notes.length} notes to wiki/notes/.`);
}

publish();
