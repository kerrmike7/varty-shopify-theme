#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const templatePaths = process.argv.slice(2);
const targets = templatePaths.length ? templatePaths : ['templates/index.json'];

const STRING_SETTING_TYPES = new Set([
  'text',
  'textarea',
  'richtext',
  'url',
  'image_picker',
  'video',
  'video_url',
  'color',
  'font_picker',
  'html',
  'liquid'
]);

const OPTION_SETTING_TYPES = new Set(['select', 'radio']);
const schemaCache = new Map();
const errors = [];
const warnings = [];

function readJsonWithOptionalShopifyComment(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(source.replace(/^\/\*[\s\S]*?\*\/\s*/, ''));
}

function readSectionSchema(sectionType) {
  if (schemaCache.has(sectionType)) return schemaCache.get(sectionType);

  const filePath = path.join(root, 'sections', `${sectionType}.liquid`);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing section file for type '${sectionType}' at ${filePath}`);
    schemaCache.set(sectionType, null);
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/);
  if (!match) {
    errors.push(`Missing {% schema %} block in ${filePath}`);
    schemaCache.set(sectionType, null);
    return null;
  }

  try {
    const schema = JSON.parse(match[1]);
    schemaCache.set(sectionType, schema);
    return schema;
  } catch (error) {
    errors.push(`Invalid schema JSON in ${filePath}: ${error.message}`);
    schemaCache.set(sectionType, null);
    return null;
  }
}

function settingMap(settings = []) {
  return new Map(settings.filter((setting) => setting.id).map((setting) => [setting.id, setting]));
}

function optionValues(definition) {
  return (definition.options || []).map((option) => (typeof option === 'object' ? option.value : option));
}

function validateRichtext(label, value) {
  if (value.includes('<!--')) {
    errors.push(`${label} contains an HTML comment; Shopify richtext rejects comments.`);
  }

  const withoutTopLevel = value
    .replace(/<(p|ul|ol|h[1-6])\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .trim();

  if (value.trim() && withoutTopLevel) {
    errors.push(
      `${label} has invalid richtext top-level HTML. Use only <p>, <ul>, <ol>, or <h1>-<h6> top-level nodes.`
    );
  }
}

function validateSetting(label, definition, value) {
  if (!definition) {
    warnings.push(`${label} is not declared in the section schema; Shopify may ignore it.`);
    return;
  }

  if (STRING_SETTING_TYPES.has(definition.type)) {
    if (typeof value !== 'string') {
      errors.push(`${label} must be a string for ${definition.type}; got ${typeof value}.`);
      return;
    }
    if (definition.type === 'richtext') validateRichtext(label, value);
  }

  if (definition.type === 'checkbox' && typeof value !== 'boolean') {
    errors.push(`${label} must be a boolean; got ${typeof value}.`);
  }

  if (definition.type === 'range') {
    if (typeof value !== 'number') {
      errors.push(`${label} must be a number for range; got ${typeof value}.`);
      return;
    }
    const min = definition.min;
    const max = definition.max;
    const step = definition.step || 1;
    if (value < min || value > max || ((value - min) / step) % 1 !== 0) {
      errors.push(`${label}=${value} must be between ${min}-${max} in steps of ${step}.`);
    }
  }

  if (OPTION_SETTING_TYPES.has(definition.type)) {
    if (typeof value !== 'string') {
      errors.push(`${label} must be a string for ${definition.type}; got ${typeof value}.`);
      return;
    }
    const values = optionValues(definition);
    if (values.length && !values.includes(value)) {
      errors.push(`${label}=${JSON.stringify(value)} is not one of: ${values.join(', ')}.`);
    }
  }
}

function validateSection(templatePath, sectionId, section) {
  const schema = readSectionSchema(section.type);
  if (!schema) return;

  const sectionSettings = settingMap(schema.settings);
  for (const [settingId, value] of Object.entries(section.settings || {})) {
    validateSetting(`${templatePath}:${sectionId}.${settingId}`, sectionSettings.get(settingId), value);
  }

  const blockDefinitions = new Map((schema.blocks || []).map((block) => [block.type, block]));
  for (const [blockId, block] of Object.entries(section.blocks || {})) {
    const blockDefinition = blockDefinitions.get(block.type);
    if (!blockDefinition) {
      errors.push(`${templatePath}:${sectionId}.${blockId} uses unknown block type '${block.type}'.`);
      continue;
    }

    const blockSettings = settingMap(blockDefinition.settings);
    for (const [settingId, value] of Object.entries(block.settings || {})) {
      validateSetting(`${templatePath}:${sectionId}.${blockId}.${settingId}`, blockSettings.get(settingId), value);
    }
  }
}

for (const templatePath of targets) {
  const template = readJsonWithOptionalShopifyComment(path.join(root, templatePath));
  if (!template.sections || !template.order) {
    errors.push(`${templatePath} must include top-level sections and order keys.`);
    continue;
  }

  for (const sectionId of template.order) {
    if (!template.sections[sectionId]) {
      errors.push(`${templatePath}: order includes missing section '${sectionId}'.`);
    }
  }

  for (const sectionId of Object.keys(template.sections)) {
    if (!template.order.includes(sectionId)) {
      warnings.push(`${templatePath}: section '${sectionId}' is not present in order.`);
    }
    validateSection(templatePath, sectionId, template.sections[sectionId]);
  }
}

if (warnings.length) {
  console.warn('Warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error('Shopify template validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Shopify template validation passed for ${targets.join(', ')}`);
