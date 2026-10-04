import { Validator, type OutputUnit, type Schema } from '@cfworker/json-schema';
import { createErrorHandler, toErrorSchema, unwrapErrorHandler, validationDataMerge, type RJSFValidationError, type ValidatorType } from '@rjsf/utils';

// Dynamic grant schemas are interpreted in the browser. This adapter never
// compiles JavaScript, so the site's CSP can keep script-src free of unsafe-eval.
// The complete authoritative AJV validation still runs in grants.submit.
function draftOf(schema: any): '4' | '7' | '2019-09' | '2020-12' {
  const uri = String(schema?.$schema || '');
  return uri.includes('2020-12') ? '2020-12' : uri.includes('2019-09') ? '2019-09' : uri.includes('draft-04') ? '4' : '7';
}
function jsonData(value: any) { return JSON.parse(JSON.stringify(value ?? null)); }
function withAbsoluteRefs(value: any, rootId: string): any {
  if (Array.isArray(value)) return value.map(item => withAbsoluteRefs(item, rootId));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === '$ref' && typeof child === 'string' && child.startsWith('#') ? rootId + child : withAbsoluteRefs(child, rootId)]));
}
function evaluate(schema: any, data: any, rootSchema?: any) {
  if (!rootSchema || rootSchema === schema) return new Validator(structuredClone(schema) as Schema, draftOf(schema), false).validate(jsonData(data));
  const rootId = rootSchema.$id || 'https://splot.invalid/schema/root';
  const engine = new Validator(withAbsoluteRefs(schema, rootId), draftOf(rootSchema), false);
  engine.addSchema(structuredClone(rootSchema), rootId);
  return engine.validate(jsonData(data));
}
const decodePointer = (pointer: string) => pointer.replace(/^#\/?/, '').split('/').filter(Boolean).map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
function errorsForForm(raw: OutputUnit[]): RJSFValidationError[] {
  const wrappers = ['properties', 'items', '$ref', 'allOf', 'additionalProperties'];
  const leaves = raw.filter(error => !wrappers.includes(error.keyword)).filter(error => error.keyword !== 'false' || !raw.some(other => other !== error && other.instanceLocation === error.instanceLocation && other.keyword !== 'false' && !wrappers.includes(other.keyword)));
  return (leaves.length ? leaves : raw).map(error => {
    const keyword = error.keyword === 'false' && error.keywordLocation.endsWith('/additionalProperties') ? 'additionalProperties' : error.keyword;
    const path = decodePointer(error.instanceLocation);
    const missing = error.keyword === 'required' ? error.error.match(/required property "(.*)"\.$/)?.[1] : undefined;
    if (missing) path.push(missing);
    const property = path.map(key => /^[$\w]+$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`).join('');
    const message = ({ required: 'To pole jest wymagane.', minLength: 'Uzupełnij treść tego pola.', const: 'Potwierdź wymaganą wartość.', type: 'Sprawdź rodzaj wpisanej wartości.', minimum: 'Wartość jest mniejsza od dozwolonej.', maximum: 'Wartość przekracza dozwolony limit.', format: 'Sprawdź format wpisanej wartości.', enum: 'Wybierz jedną z dostępnych wartości.', additionalProperties: 'Formularz zawiera pole spoza aktualnej wersji.' } as Record<string, string>)[keyword] || 'Wartość nie spełnia warunków formularza.';
    return { name: keyword, property, message, params: missing ? { missingProperty: missing } : {}, schemaPath: error.keywordLocation, stack: `${property} ${message}`.trim() };
  });
}

const validator: ValidatorType = {
  rawValidation<Result = any>(schema: any, formData?: any) {
    try { return { errors: evaluate(schema, formData).errors as unknown as Result[] }; }
    catch (error) { return { validationError: error instanceof Error ? error : new Error(String(error)) }; }
  },
  isValid(schema, formData, rootSchema) { try { return evaluate(schema, formData, rootSchema).valid; } catch { return false; } },
  validateFormData(formData, schema, customValidate, transformErrors, uiSchema) {
    const raw = this.rawValidation<OutputUnit>(schema, formData);
    let errors: RJSFValidationError[] = raw.validationError ? [{ name: 'schema', property: '', message: 'Nie można sprawdzić formularza. Zapisz szkic i skontaktuj się z opiekunem.', stack: 'Nie można sprawdzić aktualnego formularza.' }] : errorsForForm(raw.errors || []);
    if (transformErrors) errors = transformErrors(errors, uiSchema);
    const result = { errors, errorSchema: toErrorSchema(errors) };
    if (!customValidate) return result;
    const custom = customValidate(formData, createErrorHandler(formData), uiSchema, result.errorSchema);
    return validationDataMerge(result, unwrapErrorHandler(custom));
  },
};
export default validator;
