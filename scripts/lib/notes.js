const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const NOTES_DIR = path.join(ROOT, 'notes');
const WIKI_NOTES_DIR = path.join(ROOT, 'wiki', 'notes');
const DATA_DIR = path.join(ROOT, '_data');

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const WIKILINK_RE = /(!?)\[\[([^\]\n]+?)\]\]/g;
const HASHTAG_RE = /(^|[\s([{])#([\p{L}\p{N}_/-]+)/gu;

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function walk(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => parseScalar(item));
  }

  return trimmed;
}

function parseSimpleYaml(yaml) {
  const data = {};
  const lines = yaml.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;

    const key = match[1];
    const rest = match[2] == null ? '' : match[2];

    if (rest.trim() === '') {
      const values = [];
      let j = i + 1;

      for (; j < lines.length; j += 1) {
        const item = lines[j].match(/^\s*-\s+(.*)$/);
        if (!item) break;
        values.push(parseScalar(item[1]));
      }

      if (values.length > 0) {
        data[key] = values;
        i = j - 1;
      } else {
        data[key] = '';
      }
    } else {
      data[key] = parseScalar(rest);
    }
  }

  return data;
}

function parseFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { data: {}, body: raw };
  }

  return {
    data: parseSimpleYaml(match[1]),
    body: raw.slice(match[0].length),
  };
}

function yamlValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(String(item))).join(', ')}]`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value == null) return 'null';
  return JSON.stringify(String(value));
}

function stringifyFrontmatter(data) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    lines.push(`${key}: ${yamlValue(value)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function toArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value == null || value === '') return [];
  return [String(value)];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function titleFromFile(relPath) {
  const base = path.posix.basename(relPath, path.posix.extname(relPath));
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function firstHeading(body) {
  const match = body.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function stripMdExtension(value) {
  return value.replace(/\.md$/i, '');
}

function slugifySegment(segment) {
  const slug = segment
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'note';
}

function slugifyPath(value) {
  return stripMdExtension(toPosix(value))
    .split('/')
    .filter(Boolean)
    .map(slugifySegment)
    .join('/');
}

function tagSlug(tag) {
  return slugifySegment(String(tag).replace(/\//g, '-'));
}

function headingSlug(heading) {
  return String(heading)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-');
}

function normalizeKey(value) {
  return stripMdExtension(String(value))
    .normalize('NFKC')
    .replace(/\\/g, '/')
    .replace(/^notes\//, '')
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function liquidLink(permalink, anchor = '') {
  const href = anchor ? `${permalink}#${anchor}` : permalink;
  return `{{ '${href}' | relative_url }}`;
}

function replaceOutsideInlineCode(line, replacer) {
  return line
    .split(/(`[^`]*`)/g)
    .map((part) => (part.startsWith('`') ? part : replacer(part)))
    .join('');
}

function processOutsideFences(markdown, replacer) {
  let inFence = false;

  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const fence = line.match(/^\s*(```|~~~)/);
      if (fence) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return replaceOutsideInlineCode(line, replacer);
    })
    .join('\n');
}

function collectHashtags(body) {
  const tags = [];

  processOutsideFences(body, (text) => {
    text.replace(HASHTAG_RE, (_match, _prefix, tag) => {
      tags.push(tag);
      return _match;
    });
    return text;
  });

  return unique(tags);
}

function parseWikiLinks(body) {
  const links = [];

  processOutsideFences(body, (text) => {
    text.replace(WIKILINK_RE, (match, embedMarker, inner) => {
      const [targetPart, ...aliasParts] = inner.split('|');
      const target = targetPart.trim();
      const alias = aliasParts.join('|').trim();
      links.push({
        raw: match,
        embed: embedMarker === '!',
        target,
        alias,
      });
      return match;
    });
    return text;
  });

  return links;
}

function splitTarget(target) {
  const [pathPart, ...headingParts] = target.split('#');
  return {
    pathPart: pathPart.trim(),
    heading: headingParts.join('#').trim(),
  };
}

function isMarkdown(relPath) {
  return /\.md$/i.test(relPath);
}

function isTemplatePath(relPath) {
  return relPath === 'templates' || relPath.startsWith('templates/');
}

function loadWorkspace() {
  const allFiles = walk(NOTES_DIR);
  const markdownFiles = allFiles
    .map((filePath) => ({
      filePath,
      relPath: toPosix(path.relative(NOTES_DIR, filePath)),
    }))
    .filter(({ relPath }) => isMarkdown(relPath))
    .filter(({ relPath }) => !isTemplatePath(relPath));

  let indexSource = null;
  const notes = [];

  for (const source of markdownFiles) {
    const raw = fs.readFileSync(source.filePath, 'utf8');
    const parsed = parseFrontmatter(raw);

    if (source.relPath === 'index.md') {
      indexSource = {
        ...source,
        ...parsed,
        title: parsed.data.title || 'Study Notes',
      };
      continue;
    }

    if (parsed.data.draft === true || parsed.data.publish === false) continue;

    const relWithoutExt = stripMdExtension(source.relPath);
    const slugPath = parsed.data.slug
      ? slugifyPath(String(parsed.data.slug))
      : slugifyPath(relWithoutExt);
    const title = parsed.data.title || firstHeading(parsed.body) || titleFromFile(source.relPath);
    const aliases = toArray(parsed.data.aliases);
    const frontmatterTags = toArray(parsed.data.tags);
    const inlineTags = collectHashtags(parsed.body);
    const tags = unique([...frontmatterTags, ...inlineTags]);

    notes.push({
      ...source,
      data: parsed.data,
      body: parsed.body,
      title,
      aliases,
      tags,
      slugPath,
      outputRelPath: `${slugPath}.md`,
      permalink: `/notes/${slugPath}/`,
      links: parseWikiLinks(parsed.body),
    });
  }

  const assets = allFiles
    .map((filePath) => ({
      filePath,
      relPath: toPosix(path.relative(NOTES_DIR, filePath)),
    }))
    .filter(({ relPath }) => !isMarkdown(relPath))
    .filter(({ relPath }) => !isTemplatePath(relPath))
    .filter(({ relPath }) => !relPath.startsWith('.'));

  const workspace = {
    root: ROOT,
    notesDir: NOTES_DIR,
    wikiNotesDir: WIKI_NOTES_DIR,
    dataDir: DATA_DIR,
    indexSource,
    notes,
    assets,
  };

  buildLookups(workspace);
  buildGraph(workspace);

  return workspace;
}

function addLookup(map, key, value) {
  const normalized = normalizeKey(key);
  if (!normalized) return;
  if (!map.has(normalized)) map.set(normalized, []);
  map.get(normalized).push(value);
}

function buildLookups(workspace) {
  workspace.noteLookup = new Map();
  workspace.assetLookup = new Map();
  workspace.assetExactLookup = new Map();

  for (const note of workspace.notes) {
    addLookup(workspace.noteLookup, note.title, note);
    addLookup(workspace.noteLookup, stripMdExtension(note.relPath), note);
    addLookup(workspace.noteLookup, path.posix.basename(note.relPath, '.md'), note);
    addLookup(workspace.noteLookup, note.slugPath, note);
    for (const alias of note.aliases) addLookup(workspace.noteLookup, alias, note);
  }

  for (const asset of workspace.assets) {
    const exactKey = asset.relPath.toLowerCase();
    const basenameKey = path.posix.basename(asset.relPath).toLowerCase();

    if (!workspace.assetExactLookup.has(exactKey)) {
      workspace.assetExactLookup.set(exactKey, []);
    }
    workspace.assetExactLookup.get(exactKey).push(asset);

    if (!workspace.assetLookup.has(basenameKey)) {
      workspace.assetLookup.set(basenameKey, []);
    }
    workspace.assetLookup.get(basenameKey).push(asset);
  }
}

function resolveNoteTarget(workspace, target, currentNote = null) {
  const { pathPart, heading } = splitTarget(target);
  if (!pathPart && heading && currentNote) {
    return { type: 'note', note: currentNote, heading };
  }

  const key = normalizeKey(pathPart);
  const matches = [
    ...new Map((workspace.noteLookup.get(key) || []).map((note) => [note.slugPath, note])).values(),
  ];

  if (matches.length === 1) {
    return { type: 'note', note: matches[0], heading };
  }

  if (matches.length > 1) {
    return { type: 'ambiguous-note', matches, heading };
  }

  return null;
}

function resolveAssetTarget(workspace, target) {
  const { pathPart } = splitTarget(target);
  const normalizedPath = pathPart.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase();
  const exactMatches = workspace.assetExactLookup.get(normalizedPath) || [];
  if (exactMatches.length === 1) return { type: 'asset', asset: exactMatches[0] };
  if (exactMatches.length > 1) return { type: 'ambiguous-asset', matches: exactMatches };

  const basename = path.posix.basename(normalizedPath);
  const basenameMatches = workspace.assetLookup.get(basename) || [];
  if (basenameMatches.length === 1) return { type: 'asset', asset: basenameMatches[0] };
  if (basenameMatches.length > 1) return { type: 'ambiguous-asset', matches: basenameMatches };

  return null;
}

function resolveTarget(workspace, target, currentNote = null) {
  return (
    resolveNoteTarget(workspace, target, currentNote) ||
    resolveAssetTarget(workspace, target)
  );
}

function buildGraph(workspace) {
  const backlinks = new Map();
  const outgoing = new Map();

  for (const note of workspace.notes) {
    outgoing.set(note.slugPath, []);

    for (const link of note.links) {
      const resolved = resolveTarget(workspace, link.target, note);
      if (!resolved || resolved.type !== 'note') continue;
      if (resolved.note.slugPath === note.slugPath) continue;

      outgoing.get(note.slugPath).push(resolved.note);

      if (!backlinks.has(resolved.note.slugPath)) backlinks.set(resolved.note.slugPath, []);
      backlinks.get(resolved.note.slugPath).push(note);
    }
  }

  for (const [slugPath, refs] of backlinks) {
    backlinks.set(
      slugPath,
      [...new Map(refs.map((note) => [note.slugPath, note])).values()]
    );
  }

  workspace.backlinks = backlinks;
  workspace.outgoing = outgoing;
}

function markdownLink(title, permalink, anchor = '') {
  return `[${title}](${liquidLink(permalink, anchor)})`;
}

function transformWikiLinks(body, workspace, currentNote) {
  return processOutsideFences(body, (text) =>
    text.replace(WIKILINK_RE, (match, embedMarker, inner) => {
      const [targetPart, ...aliasParts] = inner.split('|');
      const target = targetPart.trim();
      const alias = aliasParts.join('|').trim();
      const resolved = resolveTarget(workspace, target, currentNote);

      if (!resolved) return match;

      if (resolved.type === 'note') {
        const { pathPart } = splitTarget(target);
        const display = alias || (pathPart ? resolved.note.title : resolved.heading) || resolved.note.title;
        const anchor = resolved.heading ? headingSlug(resolved.heading) : '';
        return markdownLink(display, resolved.note.permalink, anchor);
      }

      if (resolved.type === 'asset') {
        const assetUrl = `/notes/${resolved.asset.relPath}`;
        const display = alias || path.posix.basename(resolved.asset.relPath);

        if (embedMarker === '!') {
          return `![${display}](${liquidLink(assetUrl)})`;
        }

        return markdownLink(display, assetUrl);
      }

      return match;
    })
  );
}

function transformHashtags(body) {
  return processOutsideFences(body, (text) =>
    text.replace(HASHTAG_RE, (match, prefix, tag) => {
      const permalink = `/notes/tags/${tagSlug(tag)}/`;
      return `${prefix}[#${tag}](${liquidLink(permalink)})`;
    })
  );
}

function transformBody(body, workspace, currentNote) {
  return transformHashtags(transformWikiLinks(body, workspace, currentNote));
}

function validateWorkspace(workspace) {
  const errors = [];
  const warnings = [];
  const slugOwners = new Map();

  for (const note of workspace.notes) {
    if (!slugOwners.has(note.slugPath)) slugOwners.set(note.slugPath, []);
    slugOwners.get(note.slugPath).push(note);
  }

  for (const [slug, owners] of slugOwners) {
    if (owners.length > 1) {
      errors.push(
        `Duplicate note slug "${slug}": ${owners.map((note) => note.relPath).join(', ')}`
      );
    }
  }

  for (const [key, matches] of workspace.noteLookup) {
    const uniqueMatches = [...new Map(matches.map((note) => [note.slugPath, note])).values()];
    if (uniqueMatches.length > 1) {
      warnings.push(
        `Ambiguous note key "${key}" can refer to: ${uniqueMatches
          .map((note) => note.relPath)
          .join(', ')}`
      );
    }
  }

  for (const note of workspace.notes) {
    for (const link of note.links) {
      const resolved = resolveTarget(workspace, link.target, note);
      if (!resolved) {
        errors.push(`Broken wikilink in ${note.relPath}: [[${link.target}]]`);
      } else if (resolved.type === 'ambiguous-note') {
        errors.push(
          `Ambiguous wikilink in ${note.relPath}: [[${link.target}]] could mean ${resolved.matches
            .map((match) => match.relPath)
            .join(', ')}`
        );
      } else if (resolved.type === 'ambiguous-asset') {
        errors.push(
          `Ambiguous asset wikilink in ${note.relPath}: [[${link.target}]] could mean ${resolved.matches
            .map((match) => match.relPath)
            .join(', ')}`
        );
      }
    }
  }

  return { errors, warnings };
}

function sortedNotes(notes) {
  return [...notes].sort((a, b) => a.title.localeCompare(b.title));
}

function sortedTags(notes) {
  return unique(notes.flatMap((note) => note.tags)).sort((a, b) => a.localeCompare(b));
}

module.exports = {
  ROOT,
  NOTES_DIR,
  WIKI_NOTES_DIR,
  DATA_DIR,
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
};
