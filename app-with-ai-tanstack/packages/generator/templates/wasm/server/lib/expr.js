/**
 * The expression language rules and automations are written in.
 *
 * EML decision flowcharts carry their conditions as node and edge labels —
 * `amount > 1000`, `status == 'draft'`, `qty * price >= limit` — and the NestJS
 * stack hands those to zen-engine, a Rust library with a native binding. A
 * native binding cannot follow the application into a browser tab, so this is a
 * parser and evaluator for the subset of that syntax the generator actually
 * emits.
 *
 * It is a parser rather than `new Function(source)` deliberately. The
 * expressions come from a model file the user uploaded, and in the hosted
 * generator that file may not be their own — evaluating it as JavaScript would
 * make every uploaded model a script that runs with the page's privileges. A
 * parser can only ever produce the values below; there is no escape from it
 * into the host, however the input is spelled.
 *
 * Unsupported syntax raises at parse time. Silently treating an expression this
 * cannot read as `false` would turn a rule nobody can run into a rule that
 * looks like it ran and passed.
 */

const KEYWORDS = { true: true, false: false, null: null, nil: null };

const PUNCTUATION = [
  "===", "!==", "==", "!=", "<=", ">=", "&&", "||", "??",
  "(", ")", "[", "]", ",", ".", "+", "-", "*", "/", "%", "<", ">", "?", ":", "!",
];

/** Binding power per infix operator. Higher binds tighter. */
const BINARY_POWER = {
  "??": 1,
  "||": 2, or: 2,
  "&&": 3, and: 3,
  "==": 4, "===": 4, "!=": 4, "!==": 4, in: 4,
  "<": 5, "<=": 5, ">": 5, ">=": 5,
  "+": 6, "-": 6,
  "*": 7, "/": 7, "%": 7,
};

function tokenize(source) {
  const tokens = [];
  let index = 0;
  const text = String(source);

  while (index < text.length) {
    const char = text[index];

    if (/\s/.test(char)) { index += 1; continue; }

    if (char === "'" || char === '"') {
      let value = "";
      index += 1;
      while (index < text.length && text[index] !== char) {
        if (text[index] === "\\" && index + 1 < text.length) {
          const escaped = text[index + 1];
          value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
          index += 2;
          continue;
        }
        value += text[index];
        index += 1;
      }
      if (index >= text.length) throw new Error(`Unterminated string in: ${source}`);
      index += 1;
      tokens.push({ type: "string", value });
      continue;
    }

    if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(text[index + 1] || ""))) {
      let raw = "";
      while (index < text.length && /[0-9._]/.test(text[index])) {
        if (text[index] === "." && !/[0-9]/.test(text[index + 1] || "")) break;
        if (text[index] !== "_") raw += text[index];
        index += 1;
      }
      tokens.push({ type: "number", value: Number(raw) });
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      let raw = "";
      while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) {
        raw += text[index];
        index += 1;
      }
      tokens.push({ type: "name", value: raw });
      continue;
    }

    const punctuation = PUNCTUATION.find((candidate) => text.startsWith(candidate, index));
    if (!punctuation) throw new Error(`Unexpected character "${char}" in: ${source}`);
    index += punctuation.length;
    tokens.push({ type: "punct", value: punctuation });
  }

  tokens.push({ type: "end", value: null });
  return tokens;
}

class Parser {
  constructor(source) {
    this.source = source;
    this.tokens = tokenize(source);
    this.position = 0;
  }

  peek() { return this.tokens[this.position]; }
  next() { return this.tokens[this.position++]; }

  expect(value) {
    const token = this.next();
    if (token.value !== value) {
      throw new Error(`Expected "${value}" but found "${token.value}" in: ${this.source}`);
    }
    return token;
  }

  /** Infix operator at the cursor, or null. Word operators count. */
  infix() {
    const token = this.peek();
    if (token.type === "punct" && BINARY_POWER[token.value] !== undefined) return token.value;
    if (token.type === "name" && BINARY_POWER[token.value] !== undefined) return token.value;
    return null;
  }

  parse() {
    const node = this.expression(0);
    if (this.peek().type !== "end") {
      throw new Error(`Unexpected "${this.peek().value}" in: ${this.source}`);
    }
    return node;
  }

  expression(minimumPower) {
    let left = this.unary();

    for (;;) {
      const token = this.peek();

      if (token.type === "punct" && token.value === "?" && minimumPower <= 0) {
        this.next();
        const consequent = this.expression(0);
        this.expect(":");
        const alternate = this.expression(0);
        left = { kind: "conditional", test: left, consequent, alternate };
        continue;
      }

      const operator = this.infix();
      if (!operator) break;
      const power = BINARY_POWER[operator];
      if (power <= minimumPower) break;
      this.next();
      const right = this.expression(power);
      left = { kind: "binary", operator, left, right };
    }

    return left;
  }

  unary() {
    const token = this.peek();
    if (token.type === "punct" && (token.value === "!" || token.value === "-")) {
      this.next();
      return { kind: "unary", operator: token.value, argument: this.unary() };
    }
    if (token.type === "name" && token.value === "not") {
      this.next();
      return { kind: "unary", operator: "!", argument: this.unary() };
    }
    return this.postfix(this.primary());
  }

  postfix(node) {
    let current = node;
    for (;;) {
      const token = this.peek();
      if (token.type === "punct" && token.value === ".") {
        this.next();
        const name = this.next();
        if (name.type !== "name") throw new Error(`Expected a property name in: ${this.source}`);
        current = { kind: "member", object: current, property: { kind: "literal", value: name.value } };
        continue;
      }
      if (token.type === "punct" && token.value === "[") {
        this.next();
        const property = this.expression(0);
        this.expect("]");
        current = { kind: "member", object: current, property };
        continue;
      }
      if (token.type === "punct" && token.value === "(") {
        this.next();
        const args = [];
        if (!(this.peek().type === "punct" && this.peek().value === ")")) {
          args.push(this.expression(0));
          while (this.peek().type === "punct" && this.peek().value === ",") {
            this.next();
            args.push(this.expression(0));
          }
        }
        this.expect(")");
        current = { kind: "call", callee: current, args };
        continue;
      }
      return current;
    }
  }

  primary() {
    const token = this.next();

    if (token.type === "number" || token.type === "string") {
      return { kind: "literal", value: token.value };
    }

    if (token.type === "name") {
      if (Object.prototype.hasOwnProperty.call(KEYWORDS, token.value)) {
        return { kind: "literal", value: KEYWORDS[token.value] };
      }
      return { kind: "identifier", name: token.value };
    }

    if (token.type === "punct" && token.value === "(") {
      const node = this.expression(0);
      this.expect(")");
      return node;
    }

    if (token.type === "punct" && token.value === "[") {
      const elements = [];
      if (!(this.peek().type === "punct" && this.peek().value === "]")) {
        elements.push(this.expression(0));
        while (this.peek().type === "punct" && this.peek().value === ",") {
          this.next();
          elements.push(this.expression(0));
        }
      }
      this.expect("]");
      return { kind: "array", elements };
    }

    throw new Error(`Unexpected "${token.value}" in: ${this.source}`);
  }
}

/** Built-ins. Pure and total — none of them can reach the host. */
const FUNCTIONS = {
  len: (value) => (value == null ? 0 : Array.isArray(value) || typeof value === "string" ? value.length : Object.keys(value).length),
  upper: (value) => String(value ?? "").toUpperCase(),
  lower: (value) => String(value ?? "").toLowerCase(),
  trim: (value) => String(value ?? "").trim(),
  abs: (value) => Math.abs(Number(value) || 0),
  floor: (value) => Math.floor(Number(value) || 0),
  ceil: (value) => Math.ceil(Number(value) || 0),
  round: (value, digits = 0) => {
    const factor = 10 ** Number(digits);
    return Math.round((Number(value) || 0) * factor) / factor;
  },
  min: (...values) => Math.min(...values.map(Number)),
  max: (...values) => Math.max(...values.map(Number)),
  sum: (values) => (Array.isArray(values) ? values.reduce((total, value) => total + (Number(value) || 0), 0) : 0),
  number: (value) => (value === "" || value == null ? 0 : Number(value)),
  string: (value) => String(value ?? ""),
  bool: (value) => truthy(value),
  contains: (haystack, needle) =>
    Array.isArray(haystack)
      ? haystack.includes(needle)
      : String(haystack ?? "").includes(String(needle ?? "")),
  startsWith: (value, prefix) => String(value ?? "").startsWith(String(prefix ?? "")),
  endsWith: (value, suffix) => String(value ?? "").endsWith(String(suffix ?? "")),
  isEmpty: (value) =>
    value == null || value === "" || (Array.isArray(value) && value.length === 0),
  isNull: (value) => value == null,
  coalesce: (...values) => values.find((value) => value != null) ?? null,
  now: () => new Date().toISOString(),
  today: () => new Date().toISOString().slice(0, 10),
  year: (value) => new Date(value).getUTCFullYear(),
  date: (value) => new Date(value).toISOString(),
};

/** JavaScript's truthiness, minus the surprise that `"0"` and `[]` are true. */
export function truthy(value) {
  if (value == null || value === false) return false;
  if (value === true) return true;
  if (typeof value === "number") return value !== 0 && !Number.isNaN(value);
  if (typeof value === "string") return value !== "" && value !== "false" && value !== "0";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function compare(operator, left, right) {
  switch (operator) {
    case "==":
    case "===":
      return looseEquals(left, right);
    case "!=":
    case "!==":
      return !looseEquals(left, right);
    case "<": return numeric(left) < numeric(right);
    case "<=": return numeric(left) <= numeric(right);
    case ">": return numeric(left) > numeric(right);
    case ">=": return numeric(left) >= numeric(right);
    default: return false;
  }
}

/**
 * `status == 'draft'` has to be true when the column is a Postgres `varchar`
 * and when it is a JSON string, and `qty == 1` when the driver returned `"1"`.
 * Strict equality across a wire that has already changed the type twice reads
 * as a rule that does not fire for no visible reason.
 */
function looseEquals(left, right) {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (typeof left === "number" || typeof right === "number") {
    const a = Number(left);
    const b = Number(right);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return a === b;
  }
  if (left instanceof Date || right instanceof Date) {
    return new Date(left).getTime() === new Date(right).getTime();
  }
  return String(left) === String(right);
}

function numeric(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isNaN(Number(value)) && !Number.isNaN(parsed)) return parsed;
  }
  return Number(value);
}

function evaluateNode(node, scope) {
  switch (node.kind) {
    case "literal":
      return node.value;

    case "identifier": {
      if (Object.prototype.hasOwnProperty.call(FUNCTIONS, node.name) && !(node.name in scope)) {
        return FUNCTIONS[node.name];
      }
      return scope == null ? undefined : scope[node.name];
    }

    case "array":
      return node.elements.map((element) => evaluateNode(element, scope));

    case "member": {
      const object = evaluateNode(node.object, scope);
      if (object == null) return undefined;
      const property = evaluateNode(node.property, scope);
      // Prototype keys are never model data; reading one would leak the host.
      if (property === "__proto__" || property === "constructor" || property === "prototype") {
        return undefined;
      }
      return object[property];
    }

    case "call": {
      const callee = evaluateNode(node.callee, scope);
      if (typeof callee !== "function") {
        const name = node.callee.kind === "identifier" ? node.callee.name : "expression";
        throw new Error(`"${name}" is not a function available to expressions`);
      }
      return callee(...node.args.map((argument) => evaluateNode(argument, scope)));
    }

    case "unary": {
      const value = evaluateNode(node.argument, scope);
      return node.operator === "!" ? !truthy(value) : -Number(value);
    }

    case "conditional":
      return truthy(evaluateNode(node.test, scope))
        ? evaluateNode(node.consequent, scope)
        : evaluateNode(node.alternate, scope);

    case "binary": {
      const operator = node.operator;

      if (operator === "&&" || operator === "and") {
        return truthy(evaluateNode(node.left, scope)) && truthy(evaluateNode(node.right, scope));
      }
      if (operator === "||" || operator === "or") {
        return truthy(evaluateNode(node.left, scope)) || truthy(evaluateNode(node.right, scope));
      }
      if (operator === "??") {
        const left = evaluateNode(node.left, scope);
        return left == null ? evaluateNode(node.right, scope) : left;
      }

      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);

      if (operator === "in") {
        if (Array.isArray(right)) return right.some((item) => looseEquals(item, left));
        if (right && typeof right === "object") return Object.prototype.hasOwnProperty.call(right, left);
        return String(right ?? "").includes(String(left ?? ""));
      }
      if (operator === "+") {
        if (typeof left === "string" || typeof right === "string") {
          return `${left ?? ""}${right ?? ""}`;
        }
        return Number(left) + Number(right);
      }
      if (operator === "-") return Number(left) - Number(right);
      if (operator === "*") return Number(left) * Number(right);
      if (operator === "/") return Number(right) === 0 ? null : Number(left) / Number(right);
      if (operator === "%") return Number(right) === 0 ? null : Number(left) % Number(right);

      return compare(operator, left, right);
    }

    default:
      throw new Error(`Unknown expression node: ${node.kind}`);
  }
}

const cache = new Map();

/** Parse once, evaluate many — flowcharts re-evaluate the same labels per row. */
export function compileExpression(source) {
  const key = String(source);
  if (!cache.has(key)) cache.set(key, new Parser(key).parse());
  return cache.get(key);
}

export function evaluate(source, scope = {}) {
  return evaluateNode(compileExpression(source), scope);
}

/** Evaluate as a condition. An unparseable one is an error, not a `false`. */
export function test(source, scope = {}) {
  if (source == null || String(source).trim() === "") return true;
  return truthy(evaluate(source, scope));
}

export { FUNCTIONS };
