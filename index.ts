import {
    useArgs,
    useClock,
    useEnviron,
    useMemoryFS,
    useProc,
    useRandom,
    WASI,
    WASIProcExit,
} from "./wasi";
import { instantiate } from "./wasi/asyncify";
import { MemoryFileSystem } from "./wasi/features/fd";
import type { WASIOptions } from "./wasi/options";
import zeroperl from "./zeroperl.wasm";

export { MemoryFileSystem } from "./wasi/features/fd";

/**
 * @fileoverview zeroperl-ts.
 *
 * Provides a JavaScript interface to a Perl interpreter running in WebAssembly.
 * Supports Perl value manipulation, arrays, hashes, references, and bidirectional
 * function calls between JavaScript and Perl.
 * 
 * @example
 * Basic usage:
 * ```typescript
 * import { ZeroPerl } from "@6over3/zeroperl-ts";
 *
 * const perl = await ZeroPerl.create();
 * await perl.eval('print "Hello, World!\n"');
 * perl.dispose();
 * ```
 *
 * @example
 * Working with data structures:
 * ```typescript
 * const perl = await ZeroPerl.create();
 *
 * // Create hash
 * const hash = perl.createHash({
 *   name: 'Alice',
 *   age: 30,
 *   active: true
 * });
 *
 * // Create array
 * const arr = perl.createArray([1, 2, 3, "hello"]);
 *
 * // Convert to JavaScript
 * const obj = hash.project(); // { name: 'Alice', age: 30, active: true }
 * const jsArr = arr.project(); // [1, 2, 3, "hello"]
 *
 * hash.dispose();
 * arr.dispose();
 * perl.dispose();
 * ```
 *
 * @example
 * Calling JavaScript from Perl:
 * ```typescript
 * const perl = await ZeroPerl.create();
 *
 * perl.registerFunction('greet', (name) => {
 *   const nameStr = name.toString();
 *   console.log(`Hello, ${nameStr}!`);
 *   return perl.createString(`Greeted ${nameStr}`);
 * });
 *
 * await perl.eval('greet("Alice")');
 * perl.dispose();
 * ```
 */

/** Perl value types. */
export type PerlValueType =
    | "undef" | "true" | "false" | "int" | "double"
    | "string" | "array" | "hash" | "code" | "ref";

/** Perl calling context. */
export type PerlContext = "void" | "scalar" | "list";

/** JavaScript values that can be converted to Perl values. */
export type PerlConvertible =
    | PerlValue | string | number | boolean | null | undefined
    | PerlConvertible[] | { [key: string]: PerlConvertible };

/** JavaScript primitive types that Perl values can be converted to. */
export type JSPrimitive = string | number | boolean | null | undefined;

// Synchronous exports (don't trigger asyncjmp_rt_start)
interface ZeroPerlSyncExports {
    memory: WebAssembly.Memory;
    malloc: (size: number) => number;
    free: (ptr: number) => void;

    zeroperl_free_interpreter: () => void;
    zeroperl_shutdown: () => void;
    zeroperl_last_error: () => number;
    zeroperl_clear_error: () => void;
    zeroperl_is_initialized: () => number;
    zeroperl_can_evaluate: () => number;
    zeroperl_flush: () => number;

    zeroperl_new_int: (i: number) => number;
    zeroperl_new_uint: (u: number) => number;
    zeroperl_new_double: (d: number) => number;
    zeroperl_new_string: (ptr: number, len: number) => number;
    zeroperl_new_bool: (b: number) => number;
    zeroperl_new_undef: () => number;

    zeroperl_to_int: (val: number, out: number) => number;
    zeroperl_to_double: (val: number, out: number) => number;
    zeroperl_to_string: (val: number, len: number) => number;
    zeroperl_to_bool: (val: number) => number;
    zeroperl_is_undef: (val: number) => number;
    zeroperl_get_type: (val: number) => number;

    zeroperl_incref: (val: number) => void;
    zeroperl_decref: (val: number) => void;
    zeroperl_value_free: (val: number) => void;

    zeroperl_new_array: () => number;
    zeroperl_array_push: (arr: number, val: number) => void;
    zeroperl_array_pop: (arr: number) => number;
    zeroperl_array_get: (arr: number, idx: number) => number;
    zeroperl_array_set: (arr: number, idx: number, val: number) => number;
    zeroperl_array_length: (arr: number) => number;
    zeroperl_array_clear: (arr: number) => void;
    zeroperl_array_to_value: (arr: number) => number;
    zeroperl_value_to_array: (val: number) => number;
    zeroperl_array_free: (arr: number) => void;

    zeroperl_new_hash: () => number;
    zeroperl_hash_set: (h: number, k: number, v: number) => number;
    zeroperl_hash_get: (h: number, k: number) => number;
    zeroperl_hash_exists: (h: number, k: number) => number;
    zeroperl_hash_delete: (h: number, k: number) => number;
    zeroperl_hash_clear: (h: number) => void;
    zeroperl_hash_iter_new: (h: number) => number;
    zeroperl_hash_iter_next: (it: number, k: number, v: number) => number;
    zeroperl_hash_iter_free: (it: number) => void;
    zeroperl_hash_to_value: (h: number) => number;
    zeroperl_value_to_hash: (val: number) => number;
    zeroperl_hash_free: (h: number) => void;

    zeroperl_new_ref: (val: number) => number;
    zeroperl_deref: (ref: number) => number;
    zeroperl_is_ref: (val: number) => number;

    zeroperl_get_var: (name: number) => number;
    zeroperl_get_array_var: (name: number) => number;
    zeroperl_get_hash_var: (name: number) => number;
    zeroperl_set_var: (name: number, val: number) => number;

    zeroperl_register_function: (id: number, name: number) => void;
    zeroperl_register_method: (id: number, pkg: number, meth: number) => void;

    zeroperl_result_get: (res: number, idx: number) => number;
    zeroperl_result_free: (res: number) => void;

    zeroperl_set_host_error: (err: number) => void;
    zeroperl_get_host_error: () => number;
    zeroperl_clear_host_error: () => void;
}

// Async exports (trigger asyncjmp_rt_start)
interface ZeroPerlAsyncExports {
    zeroperl_init: () => Promise<number>;
    zeroperl_init_with_args: (argc: number, argv: number) => Promise<number>;
    zeroperl_reset: () => Promise<number>;
    zeroperl_eval: (code: number, ctx: number, argc: number, argv: number) => Promise<number>;
    zeroperl_run_file: (path: number, argc: number, argv: number) => Promise<number>;
    zeroperl_call: (name: number, ctx: number, argc: number, argv: number) => Promise<number>;
}

type ZeroPerlExports = ZeroPerlSyncExports & ZeroPerlAsyncExports & WebAssembly.Exports;

// Synchronous exports that should not be wrapped by asyncify
const SYNC_EXPORTS: string[] = [
    "zeroperl_free_interpreter", "zeroperl_shutdown", "zeroperl_last_error",
    "zeroperl_clear_error", "zeroperl_is_initialized", "zeroperl_can_evaluate",
    "zeroperl_flush", "zeroperl_new_int", "zeroperl_new_uint", "zeroperl_new_double",
    "zeroperl_new_string", "zeroperl_new_bool", "zeroperl_new_undef",
    "zeroperl_to_int", "zeroperl_to_double", "zeroperl_to_string", "zeroperl_to_bool",
    "zeroperl_is_undef", "zeroperl_get_type", "zeroperl_incref", "zeroperl_decref",
    "zeroperl_value_free", "zeroperl_new_array", "zeroperl_array_push",
    "zeroperl_array_pop", "zeroperl_array_get", "zeroperl_array_set",
    "zeroperl_array_length", "zeroperl_array_clear", "zeroperl_array_to_value",
    "zeroperl_value_to_array", "zeroperl_array_free", "zeroperl_new_hash",
    "zeroperl_hash_set", "zeroperl_hash_get", "zeroperl_hash_exists",
    "zeroperl_hash_delete", "zeroperl_hash_clear", "zeroperl_hash_iter_new",
    "zeroperl_hash_iter_next", "zeroperl_hash_iter_free", "zeroperl_hash_to_value",
    "zeroperl_value_to_hash", "zeroperl_hash_free", "zeroperl_new_ref",
    "zeroperl_deref", "zeroperl_is_ref", "zeroperl_get_var", "zeroperl_get_array_var",
    "zeroperl_get_hash_var", "zeroperl_set_var", "zeroperl_register_function",
    "zeroperl_register_method", "zeroperl_result_get", "zeroperl_result_free",
    "zeroperl_set_host_error", "zeroperl_get_host_error", "zeroperl_clear_host_error",
];

type FetchLike = (...args: unknown[]) => Promise<Response>;

/**
 * Function type that can be registered as a Perl function.
 * Receives Perl values as arguments and returns a Perl value or void.
 * Can be sync or async.
 */
export type HostFunction = (
    ...args: PerlValue[]
) => PerlValue | Promise<PerlValue> | void | Promise<void>;

/** Error class for ZeroPerl operations. */
export class ZeroPerlError extends Error {
    readonly exitCode?: number;
    readonly perlError?: string;

    constructor(message: string, exitCode?: number, perlError?: string) {
        super(message);
        this.name = "ZeroPerlError";
        this.exitCode = exitCode;
        this.perlError = perlError;
        if (Error.captureStackTrace) Error.captureStackTrace(this, ZeroPerlError);
    }
}

/** Options for creating a ZeroPerl instance. */
export interface ZeroPerlOptions {
    env?: Record<string, string>;
    fileSystem?: MemoryFileSystem;
    stdout?: (data: string | Uint8Array) => void;
    stderr?: (data: string | Uint8Array) => void;
    fetch?: FetchLike;
}

/** Result of a Perl evaluation or file execution. */
export interface ZeroPerlResult {
    success: boolean;
    error?: string;
    exitCode: number;
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

let wasmSourceCache: WeakRef<ArrayBuffer> | null = null;

function isBrowser(): boolean {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

async function loadWasmSource(fetchFn?: FetchLike): Promise<ArrayBuffer> {
    if (wasmSourceCache) {
        const cached = wasmSourceCache.deref();
        if (cached) return cached;
    }

    let moduleData: ArrayBuffer;

    if (isBrowser()) {
        const f = fetchFn ?? fetch;
        const response = await f(zeroperl);
        moduleData = await response.arrayBuffer();
    } else {
        const { fileURLToPath } = await import("node:url");
        const { readFile } = await import("node:fs/promises");
        let wasmPath: string;
        try {
            wasmPath = fileURLToPath(new URL(zeroperl, import.meta.url));
        } catch {
            // zeroperl is already an absolute file path (e.g. Bun asset resolution on Windows)
            wasmPath = zeroperl;
        }
        moduleData = (await readFile(wasmPath)).buffer;
    }

    wasmSourceCache = new WeakRef(moduleData);
    return moduleData;
}

function mapPerlType(typeCode: number): PerlValueType {
    const types: PerlValueType[] = [
        "undef", "true", "false", "int", "double",
        "string", "array", "hash", "code", "ref",
    ];
    return types[typeCode] || "undef";
}

function mapContext(context: PerlContext): number {
    return { void: 0, scalar: 1, list: 2 }[context];
}

/**
 * Wrapper for Perl scalar values.
 *
 * Represents any Perl scalar value (integers, floats, strings, references, etc).
 * All operations are synchronous.
 *
 * Memory must be explicitly freed by calling dispose().
 *
 * @example
 * ```typescript
 * const num = perl.createInt(42);
 * console.log(num.getType()); // 'int'
 * console.log(num.toInt()); // 42
 * console.log(num.toString()); // "42"
 * console.log(num.project()); // 42
 * num.dispose();
 * ```
 */
export class PerlValue {
    private ptr: number;
    private exports: ZeroPerlExports;
    private disposed = false;

    /** @internal */
    constructor(ptr: number, exports: ZeroPerlExports) {
        this.ptr = ptr;
        this.exports = exports;
    }

    /** @internal */
    getPtr(): number {
        this.checkDisposed();
        return this.ptr;
    }

    /**
     * Convert value to a 32-bit integer.
     * @throws {ZeroPerlError} If conversion fails
     */
    toInt(): number {
        this.checkDisposed();
        const outPtr = this.exports.malloc(4);
        try {
            if (!this.exports.zeroperl_to_int(this.ptr, outPtr)) {
                throw new ZeroPerlError("Failed to convert value to int");
            }
            return new DataView(this.exports.memory.buffer).getInt32(outPtr, true);
        } finally {
            this.exports.free(outPtr);
        }
    }

    /**
     * Convert value to a double-precision float.
     * @throws {ZeroPerlError} If conversion fails
     */
    toDouble(): number {
        this.checkDisposed();
        const outPtr = this.exports.malloc(8);
        try {
            if (!this.exports.zeroperl_to_double(this.ptr, outPtr)) {
                throw new ZeroPerlError("Failed to convert value to double");
            }
            return new DataView(this.exports.memory.buffer).getFloat64(outPtr, true);
        } finally {
            this.exports.free(outPtr);
        }
    }

    /** Convert value to a UTF-8 string. */
    toString(): string {
        this.checkDisposed();
        const lenPtr = this.exports.malloc(4);
        try {
            const strPtr = this.exports.zeroperl_to_string(this.ptr, lenPtr);
            if (strPtr === 0) return "";
            const len = new DataView(this.exports.memory.buffer).getUint32(lenPtr, true);
            return textDecoder.decode(new Uint8Array(this.exports.memory.buffer, strPtr, len));
        } finally {
            this.exports.free(lenPtr);
        }
    }

    /** Convert value to a boolean using Perl's truth test. */
    toBoolean(): boolean {
        this.checkDisposed();
        return this.exports.zeroperl_to_bool(this.ptr) !== 0;
    }

    /** Check if value is undefined. */
    isUndef(): boolean {
        this.checkDisposed();
        return this.exports.zeroperl_is_undef(this.ptr) !== 0;
    }

    /** Check if value is a reference. */
    isRef(): boolean {
        this.checkDisposed();
        return this.exports.zeroperl_is_ref(this.ptr) !== 0;
    }

    /** Get the type of this value. */
    getType(): PerlValueType {
        this.checkDisposed();
        return mapPerlType(this.exports.zeroperl_get_type(this.ptr));
    }

    /**
     * Convert this Perl value to a JavaScript primitive.
     *
     * Conversion rules:
     * - undef → null
     * - int/double → number
     * - string → string
     * - true/false → boolean
     * - Other types → string representation
     */
    project(): JSPrimitive {
        this.checkDisposed();
        if (this.isUndef()) return null;
        const type = this.getType();
        switch (type) {
            case 'true': return true;
            case 'false': return false;
            case "int":
            case "double": return this.toDouble();
            case "string": return this.toString();
            default: return this.toString();
        }
    }

    /**
     * Create a reference to this value.
     * @throws {ZeroPerlError} If reference creation fails
     */
    createRef(): PerlValue {
        this.checkDisposed();
        const refPtr = this.exports.zeroperl_new_ref(this.ptr);
        if (refPtr === 0) throw new ZeroPerlError("Failed to create reference");
        return new PerlValue(refPtr, this.exports);
    }

    /**
     * Dereference this value.
     * @throws {ZeroPerlError} If value is not a reference
     */
    deref(): PerlValue {
        this.checkDisposed();
        const derefPtr = this.exports.zeroperl_deref(this.ptr);
        if (derefPtr === 0) throw new ZeroPerlError("Failed to dereference value");
        return new PerlValue(derefPtr, this.exports);
    }

    /** Increment the reference count. */
    incref(): void {
        this.checkDisposed();
        this.exports.zeroperl_incref(this.ptr);
    }

    /** Decrement the reference count. */
    decref(): void {
        this.checkDisposed();
        this.exports.zeroperl_decref(this.ptr);
    }

    /** Free this value's memory. After calling, this value cannot be used. */
    dispose(): void {
        if (this.disposed) return;
        this.exports.zeroperl_value_free(this.ptr);
        this.disposed = true;
    }

    private checkDisposed(): void {
        if (this.disposed) throw new ZeroPerlError("PerlValue has been disposed");
    }
}

/**
 * Wrapper for Perl arrays.
 *
 * Provides push/pop operations, indexing, iteration, and conversion
 * to/from JavaScript arrays. All operations are synchronous.
 *
 * Memory must be explicitly freed by calling dispose().
 *
 * @example
 * ```typescript
 * const arr = perl.createArray([1, 2, 3, "hello", true]);
 * console.log(arr.getLength()); // 5
 * console.log(arr.get(0)?.toInt()); // 1
 * const jsArray = arr.project(); // [1, 2, 3, "hello", true]
 * arr.dispose();
 * ```
 */
export class PerlArray {
    private ptr: number;
    private exports: ZeroPerlExports;
    private perl: ZeroPerl;
    private disposed = false;

    /** @internal */
    constructor(ptr: number, exports: ZeroPerlExports, perl: ZeroPerl) {
        this.ptr = ptr;
        this.exports = exports;
        this.perl = perl;
    }

    /** @internal */
    getPtr(): number {
        this.checkDisposed();
        return this.ptr;
    }

    /** Push a value onto the end of the array. */
    push(value: PerlConvertible): void {
        this.checkDisposed();
        const perlValue = this.perl.toPerlValue(value);
        try {
            this.exports.zeroperl_array_push(this.ptr, perlValue.getPtr());
        } finally {
            if (!(value instanceof PerlValue)) perlValue.dispose();
        }
    }

    /** Pop a value from the end of the array. Returns null if empty. */
    pop(): PerlValue | null {
        this.checkDisposed();
        const valPtr = this.exports.zeroperl_array_pop(this.ptr);
        return valPtr === 0 ? null : new PerlValue(valPtr, this.exports);
    }

    /** Get a value at the specified index. Returns null if out of bounds. */
    get(index: number): PerlValue | null {
        this.checkDisposed();
        const valPtr = this.exports.zeroperl_array_get(this.ptr, index);
        return valPtr === 0 ? null : new PerlValue(valPtr, this.exports);
    }

    /**
     * Set a value at the specified index.
     * @throws {ZeroPerlError} If index is invalid
     */
    set(index: number, value: PerlConvertible): void {
        this.checkDisposed();
        const perlValue = this.perl.toPerlValue(value);
        try {
            if (!this.exports.zeroperl_array_set(this.ptr, index, perlValue.getPtr())) {
                throw new ZeroPerlError(`Failed to set array element at index ${index}`);
            }
        } finally {
            if (!(value instanceof PerlValue)) perlValue.dispose();
        }
    }

    /** Get the length of the array. */
    getLength(): number {
        this.checkDisposed();
        return this.exports.zeroperl_array_length(this.ptr);
    }

    /** Clear all elements from the array. */
    clear(): void {
        this.checkDisposed();
        this.exports.zeroperl_array_clear(this.ptr);
    }

    /**
     * Convert this array to a PerlValue (array reference).
     * @throws {ZeroPerlError} If conversion fails
     */
    toValue(): PerlValue {
        this.checkDisposed();
        const valPtr = this.exports.zeroperl_array_to_value(this.ptr);
        if (valPtr === 0) throw new ZeroPerlError("Failed to convert array to value");
        return new PerlValue(valPtr, this.exports);
    }

    /** Convert this Perl array to a JavaScript array of primitives. */
    project(): JSPrimitive[] {
        this.checkDisposed();
        const len = this.getLength();
        const result: JSPrimitive[] = [];
        for (let i = 0; i < len; i++) {
            const val = this.get(i);
            if (val) {
                result.push(val.project());
                val.dispose();
            } else {
                result.push(null);
            }
        }
        return result;
    }

    /** @internal */
    static fromValue(value: PerlValue, perl: ZeroPerl): PerlArray | null {
        const exports = (value as unknown as { exports: ZeroPerlExports }).exports;
        const arrPtr = exports.zeroperl_value_to_array(value.getPtr());
        return arrPtr === 0 ? null : new PerlArray(arrPtr, exports, perl);
    }

    /** Iterate over all values in the array. Remember to dispose yielded values. */
    *[Symbol.iterator](): Generator<PerlValue, void, undefined> {
        const len = this.getLength();
        for (let i = 0; i < len; i++) {
            const val = this.get(i);
            if (val) yield val;
        }
    }

    /** Free this array's memory. After calling, this array cannot be used. */
    dispose(): void {
        if (this.disposed) return;
        this.exports.zeroperl_array_free(this.ptr);
        this.disposed = true;
    }

    private checkDisposed(): void {
        if (this.disposed) throw new ZeroPerlError("PerlArray has been disposed");
    }
}

/**
 * Wrapper for Perl hashes.
 *
 * Provides a Map-like interface with iteration methods and conversion
 * to/from JavaScript objects. All operations are synchronous.
 *
 * Memory must be explicitly freed by calling dispose().
 *
 * @example
 * ```typescript
 * const hash = perl.createHash({ name: 'Alice', age: 30, active: true });
 * console.log(hash.get('name')?.toString()); // "Alice"
 * const obj = hash.project(); // { name: 'Alice', age: 30, active: true }
 * hash.dispose();
 * ```
 */
export class PerlHash {
    private ptr: number;
    private exports: ZeroPerlExports;
    private perl: ZeroPerl;
    private disposed = false;

    /** @internal */
    constructor(ptr: number, exports: ZeroPerlExports, perl: ZeroPerl) {
        this.ptr = ptr;
        this.exports = exports;
        this.perl = perl;
    }

    /** @internal */
    getPtr(): number {
        this.checkDisposed();
        return this.ptr;
    }

    /**
     * Set a key-value pair in the hash.
     * @throws {ZeroPerlError} If setting the key fails
     */
    set(key: string, value: PerlConvertible): void {
        this.checkDisposed();
        const perlValue = this.perl.toPerlValue(value);
        const keyPtr = this.writeCString(key);
        try {
            if (!this.exports.zeroperl_hash_set(this.ptr, keyPtr, perlValue.getPtr())) {
                throw new ZeroPerlError(`Failed to set hash key '${key}'`);
            }
        } finally {
            this.exports.free(keyPtr);
            if (!(value instanceof PerlValue)) perlValue.dispose();
        }
    }

    /** Get a value by key. Returns null if key doesn't exist. */
    get(key: string): PerlValue | null {
        this.checkDisposed();
        const keyPtr = this.writeCString(key);
        try {
            const valPtr = this.exports.zeroperl_hash_get(this.ptr, keyPtr);
            return valPtr === 0 ? null : new PerlValue(valPtr, this.exports);
        } finally {
            this.exports.free(keyPtr);
        }
    }

    /** Check if a key exists in the hash. */
    has(key: string): boolean {
        this.checkDisposed();
        const keyPtr = this.writeCString(key);
        try {
            return this.exports.zeroperl_hash_exists(this.ptr, keyPtr) !== 0;
        } finally {
            this.exports.free(keyPtr);
        }
    }

    /** Delete a key from the hash. Returns true if key was deleted. */
    delete(key: string): boolean {
        this.checkDisposed();
        const keyPtr = this.writeCString(key);
        try {
            return this.exports.zeroperl_hash_delete(this.ptr, keyPtr) !== 0;
        } finally {
            this.exports.free(keyPtr);
        }
    }

    /** Clear all entries from the hash. */
    clear(): void {
        this.checkDisposed();
        this.exports.zeroperl_hash_clear(this.ptr);
    }

    /**
     * Convert this hash to a PerlValue (hash reference).
     * @throws {ZeroPerlError} If conversion fails
     */
    toValue(): PerlValue {
        this.checkDisposed();
        const valPtr = this.exports.zeroperl_hash_to_value(this.ptr);
        if (valPtr === 0) throw new ZeroPerlError("Failed to convert hash to value");
        return new PerlValue(valPtr, this.exports);
    }

    /** Convert this Perl hash to a JavaScript object. */
    project(): Record<string, JSPrimitive> {
        this.checkDisposed();
        const result: Record<string, JSPrimitive> = {};
        for (const [key, val] of this.entries()) {
            result[key] = val.project();
            val.dispose();
        }
        return result;
    }

    /** @internal */
    static fromValue(value: PerlValue, perl: ZeroPerl): PerlHash | null {
        const exports = (value as unknown as { exports: ZeroPerlExports }).exports;
        const hashPtr = exports.zeroperl_value_to_hash(value.getPtr());
        return hashPtr === 0 ? null : new PerlHash(hashPtr, exports, perl);
    }

    /** Iterate over all key-value pairs. Remember to dispose yielded values. */
    *entries(): Generator<[string, PerlValue], void, undefined> {
        this.checkDisposed();
        const iterPtr = this.exports.zeroperl_hash_iter_new(this.ptr);
        if (iterPtr === 0) throw new ZeroPerlError("Failed to create hash iterator");

        const keyOutPtr = this.exports.malloc(4);
        const valOutPtr = this.exports.malloc(4);

        try {
            while (this.exports.zeroperl_hash_iter_next(iterPtr, keyOutPtr, valOutPtr)) {
                const view = new DataView(this.exports.memory.buffer);
                const keyPtr = view.getUint32(keyOutPtr, true);
                const valPtr = view.getUint32(valOutPtr, true);
                yield [this.readCString(keyPtr), new PerlValue(valPtr, this.exports)];
            }
        } finally {
            this.exports.free(keyOutPtr);
            this.exports.free(valOutPtr);
            this.exports.zeroperl_hash_iter_free(iterPtr);
        }
    }

    /** Iterate over all keys. */
    *keys(): Generator<string, void, undefined> {
        for (const [key, val] of this.entries()) {
            val.dispose();
            yield key;
        }
    }

    /** Iterate over all values. Remember to dispose yielded values. */
    *values(): Generator<PerlValue, void, undefined> {
        for (const [, val] of this.entries()) yield val;
    }

    /** Free this hash's memory. After calling, this hash cannot be used. */
    dispose(): void {
        if (this.disposed) return;
        this.exports.zeroperl_hash_free(this.ptr);
        this.disposed = true;
    }

    private writeCString(str: string): number {
        const bytes = textEncoder.encode(`${str}\0`);
        const ptr = this.exports.malloc(bytes.length);
        new Uint8Array(this.exports.memory.buffer).set(bytes, ptr);
        return ptr;
    }

    private readCString(ptr: number): string {
        if (ptr === 0) return "";
        const view = new Uint8Array(this.exports.memory.buffer);
        let len = 0;
        while (view[ptr + len] !== 0) len++;
        return textDecoder.decode(view.subarray(ptr, ptr + len));
    }

    private checkDisposed(): void {
        if (this.disposed) throw new ZeroPerlError("PerlHash has been disposed");
    }
}

/**
 * @example
 * ```typescript
 * const perl = await ZeroPerl.create();
 *
 * const user = perl.createHash({ name: 'Alice', age: 30 });
 * perl.setVariable('user', user.toValue());
 *
 * await perl.eval('print "User: $user->{name}\n"');
 *
 * user.dispose();
 * perl.dispose();
 * ```
 */
export class ZeroPerl {
    private wasi: WASI;
    private isDisposed = false;
    private hostFunctions: Map<number, HostFunction> = new Map();
    private nextFuncId = 1;


    private constructor(wasi: WASI) {
        this.wasi = wasi;
    }

    private get exports(): ZeroPerlExports {
        return this.wasi.exports as unknown as ZeroPerlExports;
    }

    /**
     * Create a new ZeroPerl instance.
     * @throws {ZeroPerlError} If initialization fails
     */
    static async create(options: ZeroPerlOptions = {}): Promise<ZeroPerl> {
        const source = await loadWasmSource(options.fetch);
        const fileSystem = options.fileSystem || new MemoryFileSystem({ "/": "" });

        const wasiOptions: WASIOptions = {
            env: options.env || {},
            args: ["zeroperl"],
            features: [
                useEnviron, useArgs, useRandom, useClock, useProc,
                useMemoryFS({
                    withFileSystem: fileSystem,
                    withStdIo: {
                        stdout: (data) => options.stdout?.(data),
                        stderr: (data) => options.stderr?.(data),
                    },
                }),
            ],
        };

        const wasi = new WASI(wasiOptions);
        const perl = new ZeroPerl(wasi);

        const hostCallFunction = async (
            funcId: number, argc: number, argvPtr: number,
        ): Promise<number> => perl.handleHostCall(funcId, argc, argvPtr);

        const { instance } = await instantiate(
            source,
            {
                wasi_snapshot_preview1: wasi.wasiImport,
                env: { call_host_function: hostCallFunction },
            },
            { unwrappedExports: SYNC_EXPORTS },
        );

        await wasi.initialize(instance);
        const result = await perl.exports.zeroperl_init();
        if (result !== 0) {
            throw new ZeroPerlError("Failed to initialize Perl interpreter", result, perl.getLastError());
        }

        return perl;
    }

    private async handleHostCall(funcId: number, argc: number, argvPtr: number): Promise<number> {
        const func = this.hostFunctions.get(funcId);
        if (!func) {
            this.setHostError(`Host function ${funcId} not found`);
            return 0;
        }

        try {

            const args: PerlValue[] = [];
            if (argc > 0) {
                const view = new DataView(this.exports.memory.buffer);
                for (let i = 0; i < argc; i++) {
                    const valPtr = view.getUint32(argvPtr + i * 4, true);
                    if (valPtr !== 0) {
                        args.push(new PerlValue(valPtr, this.exports));
                    }
                }
            }
            const result = await func(...args);
            if (result instanceof PerlValue) {
                return result.getPtr();
            }
            const undefPtr = this.exports.zeroperl_new_undef();
            if (undefPtr === 0) {
                this.setHostError("Failed to allocate return value");
                return 0;
            }
            return undefPtr;

        } catch (error) {
            this.setHostError(error instanceof Error ? error.message : String(error));
            return 0;
        }
    }

    private setHostError(message: string): void {
        const errorPtr = this.writeCString(message);
        if (errorPtr) {
            this.exports.zeroperl_set_host_error(errorPtr);
            this.exports.free(errorPtr);
        }
    }

    /**
     * Create a new integer value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createInt(value: number): PerlValue {
        this.checkDisposed();
        const ptr = this.exports.zeroperl_new_int(Math.floor(value));
        if (ptr === 0) throw new ZeroPerlError("Failed to create integer value");
        return new PerlValue(ptr, this.exports);
    }

    /**
     * Create a new unsigned integer value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createUInt(value: number): PerlValue {
        this.checkDisposed();
        const ptr = this.exports.zeroperl_new_uint(Math.floor(Math.abs(value)));
        if (ptr === 0) throw new ZeroPerlError("Failed to create unsigned integer value");
        return new PerlValue(ptr, this.exports);
    }

    /**
     * Create a new double-precision float value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createDouble(value: number): PerlValue {
        this.checkDisposed();
        const ptr = this.exports.zeroperl_new_double(value);
        if (ptr === 0) throw new ZeroPerlError("Failed to create double value");
        return new PerlValue(ptr, this.exports);
    }

    /**
     * Create a new string value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createString(value: string): PerlValue {
        this.checkDisposed();
        const bytes = textEncoder.encode(value);
        const strPtr = this.exports.malloc(bytes.length);
        new Uint8Array(this.exports.memory.buffer).set(bytes, strPtr);

        try {
            const valPtr = this.exports.zeroperl_new_string(strPtr, bytes.length);
            if (valPtr === 0) throw new ZeroPerlError("Failed to create string value");
            return new PerlValue(valPtr, this.exports);
        } finally {
            this.exports.free(strPtr);
        }
    }

    /**
     * Create a new boolean value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createBool(value: boolean): PerlValue {
        this.checkDisposed();
        const ptr = this.exports.zeroperl_new_bool(value ? 1 : 0);
        if (ptr === 0) throw new ZeroPerlError("Failed to create boolean value");
        return new PerlValue(ptr, this.exports);
    }

    /**
     * Create a new undefined value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createUndef(): PerlValue {
        this.checkDisposed();
        const ptr = this.exports.zeroperl_new_undef();
        if (ptr === 0) throw new ZeroPerlError("Failed to create undef value");
        return new PerlValue(ptr, this.exports);
    }

    /**
     * Create a new Perl array, optionally populated with values.
     * @throws {ZeroPerlError} If array creation fails
     */
    createArray(values?: PerlConvertible[]): PerlArray {
        this.checkDisposed();
        const ptr = this.exports.zeroperl_new_array();
        if (ptr === 0) throw new ZeroPerlError("Failed to create array");

        const perlArray = new PerlArray(ptr, this.exports, this);
        if (values) {
            for (const item of values) perlArray.push(item);
        }
        return perlArray;
    }

    /**
     * Create a new Perl hash, optionally populated with values.
     * @throws {ZeroPerlError} If hash creation fails
     */
    createHash(object?: Record<string, PerlConvertible>): PerlHash {
        this.checkDisposed();
        const ptr = this.exports.zeroperl_new_hash();
        if (ptr === 0) throw new ZeroPerlError("Failed to create hash");

        const perlHash = new PerlHash(ptr, this.exports, this);
        if (object) {
            for (const [key, value] of Object.entries(object)) perlHash.set(key, value);
        }
        return perlHash;
    }

    /**
     * Convert a JavaScript value to a PerlValue.
     *
     * Conversion rules:
     * - PerlValue → returned as-is
     * - null/undefined → undef
     * - boolean → Perl boolean
     * - integer → Perl int
     * - float → Perl double
     * - string → Perl string
     * - array → Perl array reference
     * - object → Perl hash reference
     *
     * @throws {ZeroPerlError} If conversion fails
     */
    toPerlValue(value: PerlConvertible): PerlValue {
        if (value instanceof PerlValue) return value;
        if (value === null || value === undefined) return this.createUndef();
        if (typeof value === 'boolean') return this.createBool(value);
        if (typeof value === 'number') {
            return Number.isInteger(value) ? this.createInt(value) : this.createDouble(value);
        }
        if (typeof value === 'string') return this.createString(value);
        if (Array.isArray(value)) {
            const arr = this.createArray(value);
            const val = arr.toValue();
            arr.dispose();
            return val;
        }
        if (typeof value === 'object') {
            const hash = this.createHash(value);
            const val = hash.toValue();
            hash.dispose();
            return val;
        }
        throw new ZeroPerlError(`Cannot convert value of type ${typeof value} to PerlValue`);
    }

    /** Get a global scalar variable. Returns null if variable doesn't exist. */
    getVariable(name: string): PerlValue | null {
        this.checkDisposed();
        const namePtr = this.writeCString(name);
        try {
            const valPtr = this.exports.zeroperl_get_var(namePtr);
            return valPtr === 0 ? null : new PerlValue(valPtr, this.exports);
        } finally {
            this.exports.free(namePtr);
        }
    }

    /** Get a global array variable. Returns null if variable doesn't exist. */
    getArrayVariable(name: string): PerlArray | null {
        this.checkDisposed();
        const namePtr = this.writeCString(name);
        try {
            const arrPtr = this.exports.zeroperl_get_array_var(namePtr);
            return arrPtr === 0 ? null : new PerlArray(arrPtr, this.exports, this);
        } finally {
            this.exports.free(namePtr);
        }
    }

    /** Get a global hash variable. Returns null if variable doesn't exist. */
    getHashVariable(name: string): PerlHash | null {
        this.checkDisposed();
        const namePtr = this.writeCString(name);
        try {
            const hashPtr = this.exports.zeroperl_get_hash_var(namePtr);
            return hashPtr === 0 ? null : new PerlHash(hashPtr, this.exports, this);
        } finally {
            this.exports.free(namePtr);
        }
    }

    /**
     * Set a global scalar variable.
     * @throws {ZeroPerlError} If setting the variable fails
     */
    setVariable(name: string, value: PerlConvertible): void {
        this.checkDisposed();
        const perlValue = this.toPerlValue(value);
        const namePtr = this.writeCString(name);
        try {
            if (!this.exports.zeroperl_set_var(namePtr, perlValue.getPtr())) {
                throw new ZeroPerlError(`Failed to set variable '${name}'`);
            }
        } finally {
            this.exports.free(namePtr);
            if (!(value instanceof PerlValue)) perlValue.dispose();
        }
    }

    /**
     * Register a JavaScript function that can be called from Perl.
     * The function receives Perl values as arguments and returns a Perl value or void.
     *
     * @example
     * ```typescript
     * perl.registerFunction('add', (a, b) => {
     *   return perl.createInt(a.toInt() + b.toInt());
     * });
     * await perl.eval('print add(10, 32), "\n"'); // prints: 42
     * ```
     */
    registerFunction(name: string, fn: HostFunction): void {
        this.checkDisposed();
        const funcId = this.nextFuncId++;
        this.hostFunctions.set(funcId, fn);

        const namePtr = this.writeCString(name);
        try {
            this.exports.zeroperl_register_function(funcId, namePtr);
        } finally {
            this.exports.free(namePtr);
        }
    }

    /**
     * Register a JavaScript method that can be called from Perl.
     *
     * @example
     * ```typescript
     * perl.registerMethod('Math', 'square', (x) => {
     *   const num = x.toInt();
     *   return perl.createInt(num * num);
     * });
     * await perl.eval('$result = Math::square(7)'); // $result = 49
     * ```
     */
    registerMethod(packageName: string, methodName: string, fn: HostFunction): void {
        this.checkDisposed();
        const funcId = this.nextFuncId++;
        this.hostFunctions.set(funcId, fn);

        const pkgPtr = this.writeCString(packageName);
        const methPtr = this.writeCString(methodName);
        try {
            this.exports.zeroperl_register_method(funcId, pkgPtr, methPtr);
        } finally {
            this.exports.free(pkgPtr);
            this.exports.free(methPtr);
        }
    }

    /** Call a Perl subroutine in void context. */
    call(name: string, args: PerlValue[], context: "void"): Promise<undefined>;
    /** Call a Perl subroutine in scalar context. */
    call(name: string, args: PerlValue[], context: "scalar"): Promise<PerlValue | null>;
    /** Call a Perl subroutine in list context. */
    call(name: string, args: PerlValue[], context: "list"): Promise<PerlValue[]>;
    /** Call a Perl subroutine (defaults to scalar context). */
    call(name: string, args?: PerlValue[], context?: PerlContext): Promise<PerlValue | null>;

    async call(
        name: string,
        args: PerlValue[] = [],
        context: PerlContext = "scalar",
    ): Promise<undefined | PerlValue | null | PerlValue[]> {
        this.checkDisposed();

        const namePtr = this.writeCString(name);
        const contextNum = mapContext(context);
        let argvPtr = 0;

        if (args.length > 0) {
            argvPtr = this.exports.malloc(args.length * 4);
            const view = new DataView(this.exports.memory.buffer);
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (!arg) throw new ZeroPerlError(`Argument at index ${i} is undefined`);
                view.setUint32(argvPtr + i * 4, arg.getPtr(), true);
            }
        }

        try {
            const resultPtr = await this.exports.zeroperl_call(namePtr, contextNum, args.length, argvPtr);

            if (resultPtr === 0) {
                if (context === "void") return;
                if (context === "scalar") return null;
                return [];
            }

            const view = new DataView(this.exports.memory.buffer);
            const count = view.getInt32(resultPtr, true);

            const results: PerlValue[] = [];
            for (let i = 0; i < count; i++) {
                const valPtr = this.exports.zeroperl_result_get(resultPtr, i);
                if (valPtr !== 0) results.push(new PerlValue(valPtr, this.exports));
            }

            const valuesArrayPtr = view.getUint32(resultPtr + 4, true);
            if (valuesArrayPtr !== 0) this.exports.free(valuesArrayPtr);
            this.exports.free(resultPtr);

            if (context === "void") {
                for (const val of results) val.dispose();
                return;
            }
            if (context === "scalar") return results[0] ?? null;
            return results;
        } catch (e) {
            if (e instanceof WASIProcExit) {
                if (context === "void") return;
                if (context === "scalar") return null;
                return [];
            }
            throw e;
        } finally {
            this.exports.free(namePtr);
            if (argvPtr !== 0) this.exports.free(argvPtr);
        }
    }

    /**
     * Evaluate a string of Perl code.
     * @param code Perl code to evaluate
     * @param args Arguments to pass as @ARGV
     */
    async eval(code: string, args: string[] = []): Promise<ZeroPerlResult> {
        this.checkDisposed();

        const codePtr = this.writeCString(code);
        let argv = 0;
        let buffers: number[] = [];

        if (args.length > 0) {
            const result = this.writeStringArray(args);
            argv = result.argv;
            buffers = result.buffers;
        }

        try {
            const exitCode = await this.exports.zeroperl_eval(codePtr, mapContext("scalar"), args.length, argv);
            if (exitCode !== 0) {
                return { success: false, error: this.getLastError(), exitCode };
            }
            return { success: true, exitCode: 0 };
        } catch (e) {
            if (e instanceof WASIProcExit) {
                if (e.code !== 0) {
                    return { success: false, error: this.getLastError(), exitCode: e.code };
                }
                return { success: true, exitCode: 0 };
            }
            throw e;
        } finally {
            this.exports.free(codePtr);
            if (buffers.length > 0) this.freeStringArray(argv, buffers);
        }
    }

    /**
     * Run a Perl script file.
     * @param scriptPath Path to the script file
     * @param args Arguments to pass as @ARGV
     */
    async runFile(scriptPath: string, args: string[] = []): Promise<ZeroPerlResult> {
        this.checkDisposed();

        const pathPtr = this.writeCString(scriptPath);
        let argv = 0;
        let buffers: number[] = [];

        if (args.length > 0) {
            const result = this.writeStringArray(args);
            argv = result.argv;
            buffers = result.buffers;
        }

        try {
            const exitCode = await this.exports.zeroperl_run_file(pathPtr, args.length, argv);
            if (exitCode !== 0) {
                return { success: false, error: this.getLastError(), exitCode };
            }
            return { success: true, exitCode: 0 };
        } catch (e) {
            if (e instanceof WASIProcExit) {
                if (e.code !== 0) {
                    return { success: false, error: this.getLastError(), exitCode: e.code };
                }
                return { success: true, exitCode: 0 };
            }
            throw e;
        } finally {
            this.exports.free(pathPtr);
            if (buffers.length > 0) this.freeStringArray(argv, buffers);
        }
    }

    /**
     * Reset the interpreter to a clean state.
     * Clears all variables and errors. Registered host functions remain.
     * @throws {ZeroPerlError} If reset fails
     */
    async reset(): Promise<void> {
        this.checkDisposed();
        const result = await this.exports.zeroperl_reset();
        if (result !== 0) {
            throw new ZeroPerlError("Failed to reset Perl interpreter", result, this.getLastError());
        }
    }

    /**
     * Flush STDOUT and STDERR buffers.
     * @throws {ZeroPerlError} If flush fails
     */
    flush(): void {
        this.checkDisposed();
        if (this.exports.zeroperl_flush() !== 0) {
            throw new ZeroPerlError("Failed to flush output buffers");
        }
    }

    /** Get the last error message from Perl ($@). */
    getLastError(): string {
        this.checkDisposed();
        return this.readCString(this.exports.zeroperl_last_error());
    }

    /** Clear the error state ($@). */
    clearError(): void {
        this.checkDisposed();
        this.exports.zeroperl_clear_error();
    }

    /** Check if the interpreter is initialized. */
    isInitialized(): boolean {
        this.checkDisposed();
        return this.exports.zeroperl_is_initialized() !== 0;
    }

    /** Check if the interpreter is ready to evaluate code. */
    canEvaluate(): boolean {
        this.checkDisposed();
        return this.exports.zeroperl_can_evaluate() !== 0;
    }

    /** Free the Perl interpreter's memory. After calling, this instance cannot be used. */
    dispose(): void {
        if (this.isDisposed) return;
        this.exports.zeroperl_free_interpreter();
        this.isDisposed = true;
        this.hostFunctions.clear();
    }

    /** Shut down the Perl system. After calling, this instance cannot be used. */
    shutdown(): void {
        if (this.isDisposed) return;
        this.exports.zeroperl_shutdown();
        this.isDisposed = true;
        this.hostFunctions.clear();
    }

    private writeCString(str: string): number {
        if (!str) {
            return 0;
        }
        const bytes = textEncoder.encode(`${str}\0`);
        const ptr = this.exports.malloc(bytes.length);
        new Uint8Array(this.exports.memory.buffer).set(bytes, ptr);
        return ptr;
    }

    private readCString(ptr: number): string {
        if (ptr === 0) return "";
        const view = new Uint8Array(this.exports.memory.buffer);
        let len = 0;
        while (view[ptr + len] !== 0) len++;
        return textDecoder.decode(view.subarray(ptr, ptr + len));
    }

    private writeStringArray(args: string[]): { argv: number; buffers: number[] } {
        const buffers: number[] = [];
        const argv = this.exports.malloc(args.length * 4);
        const argvView = new DataView(this.exports.memory.buffer);

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg === undefined) throw new ZeroPerlError(`Argument at index ${i} is undefined`);
            const strPtr = this.writeCString(arg);
            buffers.push(strPtr);
            argvView.setUint32(argv + i * 4, strPtr, true);
        }

        return { argv, buffers };
    }

    private freeStringArray(argv: number, buffers: number[]): void {
        for (const buf of buffers) this.exports.free(buf);
        this.exports.free(argv);
    }

    private checkDisposed(): void {
        if (this.isDisposed) throw new ZeroPerlError("ZeroPerl instance has been disposed");
    }
}