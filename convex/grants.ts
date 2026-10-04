"use node";
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';

function validateSnapshot(snapshot: any) {
  const schema = snapshot.call.data.schema || {
    type: 'object', additionalProperties: false,
    properties: Object.fromEntries((snapshot.call.data.fields || []).map((field: any) => [field.key, {
      type: field.type === 'number' ? 'number' : field.type === 'checkbox' ? 'boolean' : 'string',
      ...(field.required && field.type !== 'number' && field.type !== 'checkbox' ? { minLength: 1 } : {}),
      ...(field.required && field.type === 'checkbox' ? { const: true } : {}),
    }])),
    required: (snapshot.call.data.fields || []).filter((field: any) => field.required).map((field: any) => field.key),
  };
  if (JSON.stringify(schema).length > 64000) throw new Error('Schemat przekracza limit bezpiecznej walidacji.');
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const valid = validate(snapshot.application.data.values || {});
  const errors = (validate.errors || []).map(error => ({ field: error.instancePath || String(error.params.missingProperty || ''), message: error.message || 'Nieprawidłowa wartość', keyword: error.keyword }));
  return { valid: Boolean(valid), errors, schema };
}
export const validate = action({ args: { id: v.id('records') }, handler: async (ctx, args): Promise<any> => {
  const snapshot = await ctx.runQuery(internal.grantTransactions.validationInput, args);
  const result = validateSnapshot(snapshot);
  return { valid: result.valid, errors: result.errors, schemaVersion: snapshot.call.data.schemaVersion, applicationVersion: snapshot.application.version };
} });
export const submit = action({ args: { id: v.id('records'), idempotencyKey: v.string() }, handler: async (ctx, args): Promise<any> => {
  const snapshot = await ctx.runQuery(internal.grantTransactions.validationInput, { id: args.id });
  if (snapshot.application.status === 'submitted' && snapshot.application.data.idempotencyKey === args.idempotencyKey) return snapshot.application;
  const result = validateSnapshot(snapshot);
  if (!result.valid) throw new Error(`Sprawdź formularz: ${result.errors.map(error => `${error.field}: ${error.message}`).join('; ')}`);
  const applicationContent = JSON.stringify({ title: snapshot.application.title, data: snapshot.application.data });
  const callContent = JSON.stringify(snapshot.call.data);
  return ctx.runMutation(internal.grantTransactions.finalize, {
    ...args, applicationVersion: snapshot.application.version, callVersion: snapshot.call.version,
    applicationContent, callContent,
    contentHash: createHash('sha256').update(applicationContent).digest('hex'),
    schemaHash: createHash('sha256').update(JSON.stringify(result.schema)).digest('hex'),
  });
} });
