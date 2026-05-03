import { MemoryFileSystem } from "./wasi/features/fd";
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
export type PerlValueType = "undef" | "true" | "false" | "int" | "double" | "string" | "array" | "hash" | "code" | "ref";
/** Perl calling context. */
export type PerlContext = "void" | "scalar" | "list";
/** JavaScript values that can be converted to Perl values. */
export type PerlConvertible = PerlValue | string | number | boolean | null | undefined | PerlConvertible[] | {
    [key: string]: PerlConvertible;
};
/** JavaScript primitive types that Perl values can be converted to. */
export type JSPrimitive = string | number | boolean | null | undefined;
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
interface ZeroPerlAsyncExports {
    zeroperl_init: () => Promise<number>;
    zeroperl_init_with_args: (argc: number, argv: number) => Promise<number>;
    zeroperl_reset: () => Promise<number>;
    zeroperl_eval: (code: number, ctx: number, argc: number, argv: number) => Promise<number>;
    zeroperl_run_file: (path: number, argc: number, argv: number) => Promise<number>;
    zeroperl_call: (name: number, ctx: number, argc: number, argv: number) => Promise<number>;
}
type ZeroPerlExports = ZeroPerlSyncExports & ZeroPerlAsyncExports & WebAssembly.Exports;
type FetchLike = (...args: unknown[]) => Promise<Response>;
/**
 * Function type that can be registered as a Perl function.
 * Receives Perl values as arguments and returns a Perl value or void.
 * Can be sync or async.
 */
export type HostFunction = (...args: PerlValue[]) => PerlValue | Promise<PerlValue> | void | Promise<void>;
/** Error class for ZeroPerl operations. */
export declare class ZeroPerlError extends Error {
    readonly exitCode?: number;
    readonly perlError?: string;
    constructor(message: string, exitCode?: number, perlError?: string);
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
export declare class PerlValue {
    private ptr;
    private exports;
    private disposed;
    /** @internal */
    constructor(ptr: number, exports: ZeroPerlExports);
    /** @internal */
    getPtr(): number;
    /**
     * Convert value to a 32-bit integer.
     * @throws {ZeroPerlError} If conversion fails
     */
    toInt(): number;
    /**
     * Convert value to a double-precision float.
     * @throws {ZeroPerlError} If conversion fails
     */
    toDouble(): number;
    /** Convert value to a UTF-8 string. */
    toString(): string;
    /** Convert value to a boolean using Perl's truth test. */
    toBoolean(): boolean;
    /** Check if value is undefined. */
    isUndef(): boolean;
    /** Check if value is a reference. */
    isRef(): boolean;
    /** Get the type of this value. */
    getType(): PerlValueType;
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
    project(): JSPrimitive;
    /**
     * Create a reference to this value.
     * @throws {ZeroPerlError} If reference creation fails
     */
    createRef(): PerlValue;
    /**
     * Dereference this value.
     * @throws {ZeroPerlError} If value is not a reference
     */
    deref(): PerlValue;
    /** Increment the reference count. */
    incref(): void;
    /** Decrement the reference count. */
    decref(): void;
    /** Free this value's memory. After calling, this value cannot be used. */
    dispose(): void;
    private checkDisposed;
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
export declare class PerlArray {
    private ptr;
    private exports;
    private perl;
    private disposed;
    /** @internal */
    constructor(ptr: number, exports: ZeroPerlExports, perl: ZeroPerl);
    /** @internal */
    getPtr(): number;
    /** Push a value onto the end of the array. */
    push(value: PerlConvertible): void;
    /** Pop a value from the end of the array. Returns null if empty. */
    pop(): PerlValue | null;
    /** Get a value at the specified index. Returns null if out of bounds. */
    get(index: number): PerlValue | null;
    /**
     * Set a value at the specified index.
     * @throws {ZeroPerlError} If index is invalid
     */
    set(index: number, value: PerlConvertible): void;
    /** Get the length of the array. */
    getLength(): number;
    /** Clear all elements from the array. */
    clear(): void;
    /**
     * Convert this array to a PerlValue (array reference).
     * @throws {ZeroPerlError} If conversion fails
     */
    toValue(): PerlValue;
    /** Convert this Perl array to a JavaScript array of primitives. */
    project(): JSPrimitive[];
    /** @internal */
    static fromValue(value: PerlValue, perl: ZeroPerl): PerlArray | null;
    /** Iterate over all values in the array. Remember to dispose yielded values. */
    [Symbol.iterator](): Generator<PerlValue, void, undefined>;
    /** Free this array's memory. After calling, this array cannot be used. */
    dispose(): void;
    private checkDisposed;
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
export declare class PerlHash {
    private ptr;
    private exports;
    private perl;
    private disposed;
    /** @internal */
    constructor(ptr: number, exports: ZeroPerlExports, perl: ZeroPerl);
    /** @internal */
    getPtr(): number;
    /**
     * Set a key-value pair in the hash.
     * @throws {ZeroPerlError} If setting the key fails
     */
    set(key: string, value: PerlConvertible): void;
    /** Get a value by key. Returns null if key doesn't exist. */
    get(key: string): PerlValue | null;
    /** Check if a key exists in the hash. */
    has(key: string): boolean;
    /** Delete a key from the hash. Returns true if key was deleted. */
    delete(key: string): boolean;
    /** Clear all entries from the hash. */
    clear(): void;
    /**
     * Convert this hash to a PerlValue (hash reference).
     * @throws {ZeroPerlError} If conversion fails
     */
    toValue(): PerlValue;
    /** Convert this Perl hash to a JavaScript object. */
    project(): Record<string, JSPrimitive>;
    /** @internal */
    static fromValue(value: PerlValue, perl: ZeroPerl): PerlHash | null;
    /** Iterate over all key-value pairs. Remember to dispose yielded values. */
    entries(): Generator<[string, PerlValue], void, undefined>;
    /** Iterate over all keys. */
    keys(): Generator<string, void, undefined>;
    /** Iterate over all values. Remember to dispose yielded values. */
    values(): Generator<PerlValue, void, undefined>;
    /** Free this hash's memory. After calling, this hash cannot be used. */
    dispose(): void;
    private writeCString;
    private readCString;
    private checkDisposed;
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
export declare class ZeroPerl {
    private wasi;
    private isDisposed;
    private hostFunctions;
    private nextFuncId;
    private constructor();
    private get exports();
    /**
     * Create a new ZeroPerl instance.
     * @throws {ZeroPerlError} If initialization fails
     */
    static create(options?: ZeroPerlOptions): Promise<ZeroPerl>;
    private handleHostCall;
    private setHostError;
    /**
     * Create a new integer value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createInt(value: number): PerlValue;
    /**
     * Create a new unsigned integer value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createUInt(value: number): PerlValue;
    /**
     * Create a new double-precision float value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createDouble(value: number): PerlValue;
    /**
     * Create a new string value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createString(value: string): PerlValue;
    /**
     * Create a new boolean value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createBool(value: boolean): PerlValue;
    /**
     * Create a new undefined value.
     * @throws {ZeroPerlError} If value creation fails
     */
    createUndef(): PerlValue;
    /**
     * Create a new Perl array, optionally populated with values.
     * @throws {ZeroPerlError} If array creation fails
     */
    createArray(values?: PerlConvertible[]): PerlArray;
    /**
     * Create a new Perl hash, optionally populated with values.
     * @throws {ZeroPerlError} If hash creation fails
     */
    createHash(object?: Record<string, PerlConvertible>): PerlHash;
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
    toPerlValue(value: PerlConvertible): PerlValue;
    /** Get a global scalar variable. Returns null if variable doesn't exist. */
    getVariable(name: string): PerlValue | null;
    /** Get a global array variable. Returns null if variable doesn't exist. */
    getArrayVariable(name: string): PerlArray | null;
    /** Get a global hash variable. Returns null if variable doesn't exist. */
    getHashVariable(name: string): PerlHash | null;
    /**
     * Set a global scalar variable.
     * @throws {ZeroPerlError} If setting the variable fails
     */
    setVariable(name: string, value: PerlConvertible): void;
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
    registerFunction(name: string, fn: HostFunction): void;
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
    registerMethod(packageName: string, methodName: string, fn: HostFunction): void;
    /** Call a Perl subroutine in void context. */
    call(name: string, args: PerlValue[], context: "void"): Promise<undefined>;
    /** Call a Perl subroutine in scalar context. */
    call(name: string, args: PerlValue[], context: "scalar"): Promise<PerlValue | null>;
    /** Call a Perl subroutine in list context. */
    call(name: string, args: PerlValue[], context: "list"): Promise<PerlValue[]>;
    /** Call a Perl subroutine (defaults to scalar context). */
    call(name: string, args?: PerlValue[], context?: PerlContext): Promise<PerlValue | null>;
    /**
     * Evaluate a string of Perl code.
     * @param code Perl code to evaluate
     * @param args Arguments to pass as @ARGV
     */
    eval(code: string, args?: string[]): Promise<ZeroPerlResult>;
    /**
     * Run a Perl script file.
     * @param scriptPath Path to the script file
     * @param args Arguments to pass as @ARGV
     */
    runFile(scriptPath: string, args?: string[]): Promise<ZeroPerlResult>;
    /**
     * Reset the interpreter to a clean state.
     * Clears all variables and errors. Registered host functions remain.
     * @throws {ZeroPerlError} If reset fails
     */
    reset(): Promise<void>;
    /**
     * Flush STDOUT and STDERR buffers.
     * @throws {ZeroPerlError} If flush fails
     */
    flush(): void;
    /** Get the last error message from Perl ($@). */
    getLastError(): string;
    /** Clear the error state ($@). */
    clearError(): void;
    /** Check if the interpreter is initialized. */
    isInitialized(): boolean;
    /** Check if the interpreter is ready to evaluate code. */
    canEvaluate(): boolean;
    /** Free the Perl interpreter's memory. After calling, this instance cannot be used. */
    dispose(): void;
    /** Shut down the Perl system. After calling, this instance cannot be used. */
    shutdown(): void;
    private writeCString;
    private readCString;
    private writeStringArray;
    private freeStringArray;
    private checkDisposed;
}
export declare function getPerlVersion(options?: ZeroPerlOptions): Promise<string>;
