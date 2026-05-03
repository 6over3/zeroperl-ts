import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { getPerlVersion, MemoryFileSystem, ZeroPerl } from "./index";

function expectSuccess(result: { success: boolean; error?: string; exitCode: number }) {
	if (!result.success) {
		throw new Error(`Perl failed (exit ${result.exitCode}): ${result.error}`);
	}
}

function expectFailure(result: { success: boolean; error?: string; exitCode: number }) {
	if (result.success) {
		throw new Error(`Expected Perl to fail but it succeeded`);
	}
}

const BUNDLED_PERL_VERSION = "v5.42.0";

describe("Basic Operations", () => {
	it("should create and dispose ZeroPerl instance", async () => {
		const perl = await ZeroPerl.create();
		expect(perl.isInitialized()).toBe(true);
		expect(perl.canEvaluate()).toBe(true);
		perl.dispose();
	});

	it("should evaluate basic Perl code", async () => {
		const perl = await ZeroPerl.create();
		const result = await perl.eval("$x = 42");
		expectSuccess(result);
		expect(result.exitCode).toBe(0);
		perl.dispose();
	});

	it("should handle errors gracefully", async () => {
		const perl = await ZeroPerl.create();
		const result = await perl.eval('die "test error"');
		expectFailure(result);
		expect(result.error).toContain("test error");
		perl.dispose();
	});

	it("should get and clear last error", async () => {
		const perl = await ZeroPerl.create();
		await perl.eval('die "custom error"');

		const error = perl.getLastError();
		expect(error).toContain("custom error");

		perl.clearError();
		const clearedError = perl.getLastError();
		expect(clearedError).toBe("");

		perl.dispose();
	});

	it("should reset to clean state", async () => {
		const perl = await ZeroPerl.create();

		perl.setVariable("x", 42);
		let value = perl.getVariable("x");
		expect(value?.toInt()).toBe(42);

		await perl.reset();

		value = perl.getVariable("x");
		expect(value).toBeNull();

		perl.dispose();
	});

	it("should flush output buffers", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		await perl.eval('print "test"');
		expect(output).toBe("");

		perl.flush();
		expect(output).toBe("test");

		perl.dispose();
	});

	it("should shutdown completely", async () => {
		const perl = await ZeroPerl.create();
		await perl.eval("$x = 42");
		perl.shutdown();

		expect(async () => {
			await perl.eval("$y = 10");
		}).toThrow();
	});

	it("should throw error when using disposed instance", async () => {
		const perl = await ZeroPerl.create();
		perl.dispose();

		expect(async () => {
			await perl.eval("$x = 1");
		}).toThrow("ZeroPerl instance has been disposed");
	});
});

describe("Value Creation", () => {
	it("should create integer values", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createInt(42);

		expect(val.getType()).toBe("int");
		expect(val.toInt()).toBe(42);
		expect(val.project()).toBe(42);

		val.dispose();
		perl.dispose();
	});

	it("should create unsigned integer values", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createUInt(100);

		expect(val.toInt()).toBe(100);

		val.dispose();
		perl.dispose();
	});

	it("should create double values", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createDouble(Math.PI);

		expect(val.getType()).toBe("double");
		const result = val.toDouble();
		expect(Math.abs(result - Math.PI)).toBeLessThan(0.0001);

		val.dispose();
		perl.dispose();
	});

	it("should create string values", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createString("hello world");

		expect(val.getType()).toBe("string");
		expect(val.toString()).toBe("hello world");
		expect(val.project()).toBe("hello world");

		val.dispose();
		perl.dispose();
	});

	it("should create boolean values", async () => {
		const perl = await ZeroPerl.create();
		const valTrue = perl.createBool(true);
		const valFalse = perl.createBool(false);

		expect(valTrue.toBoolean()).toBe(true);
		expect(valFalse.toBoolean()).toBe(false);
		expect(valTrue.project()).toBe(true);
		expect(valFalse.project()).toBe(false);

		valTrue.dispose();
		valFalse.dispose();
		perl.dispose();
	});

	it("should create undef values", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createUndef();

		expect(val.isUndef()).toBe(true);
		expect(val.project()).toBeNull();

		val.dispose();
		perl.dispose();
	});

	it("should convert JavaScript primitives to Perl", async () => {
		const perl = await ZeroPerl.create();

		const num = perl.toPerlValue(42);
		expect(num.toInt()).toBe(42);

		const str = perl.toPerlValue("test");
		expect(str.toString()).toBe("test");

		const bool = perl.toPerlValue(true);
		expect(bool.toBoolean()).toBe(true);

		const undef = perl.toPerlValue(null);
		expect(undef.isUndef()).toBe(true);

		num.dispose();
		str.dispose();
		bool.dispose();
		undef.dispose();
		perl.dispose();
	});

	it("should convert JavaScript arrays to Perl", async () => {
		const perl = await ZeroPerl.create();

		const arrVal = perl.toPerlValue([1, 2, 3]);
		expect(arrVal.isRef()).toBe(true);

		arrVal.dispose();
		perl.dispose();
	});

	it("should convert JavaScript objects to Perl", async () => {
		const perl = await ZeroPerl.create();

		const objVal = perl.toPerlValue({ a: 1, b: 2 });
		expect(objVal.isRef()).toBe(true);

		objVal.dispose();
		perl.dispose();
	});

	it("should convert nested JavaScript structures to Perl", async () => {
		const perl = await ZeroPerl.create();

		const nested = perl.toPerlValue({
			name: "Alice",
			scores: [95, 87, 92],
			metadata: {
				age: 30,
				active: true,
			},
		});

		expect(nested.isRef()).toBe(true);

		nested.dispose();
		perl.dispose();
	});
});

describe("PerlValue Operations", () => {
	it("should convert values to different types", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createInt(42);

		expect(val.toInt()).toBe(42);
		expect(val.toDouble()).toBe(42.0);
		expect(val.toString()).toBe("42");
		expect(val.toBoolean()).toBe(true);

		val.dispose();
		perl.dispose();
	});

	it("should check value types", async () => {
		const perl = await ZeroPerl.create();

		const intVal = perl.createInt(42);
		expect(intVal.getType()).toBe("int");

		const strVal = perl.createString("hello");
		expect(strVal.getType()).toBe("string");

		const undefVal = perl.createUndef();
		expect(undefVal.isUndef()).toBe(true);

		intVal.dispose();
		strVal.dispose();
		undefVal.dispose();
		perl.dispose();
	});

	it("should create and dereference references", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createInt(42);

		const ref = val.createRef();
		expect(ref.isRef()).toBe(true);

		const deref = ref.deref();
		expect(deref.toInt()).toBe(42);

		val.dispose();
		ref.dispose();
		deref.dispose();
		perl.dispose();
	});

	it("should handle reference counting", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createInt(42);

		val.incref();
		val.decref();

		expect(val.toInt()).toBe(42);

		val.dispose();
		perl.dispose();
	});

	it("should convert to JavaScript primitives via project()", async () => {
		const perl = await ZeroPerl.create();

		const num = perl.createInt(42);
		expect(num.project()).toBe(42);

		const str = perl.createString("hello");
		expect(str.project()).toBe("hello");

		const undef = perl.createUndef();
		expect(undef.project()).toBeNull();

		const boolTrue = perl.createBool(true);
		expect(boolTrue.project()).toBe(true);

		const boolFalse = perl.createBool(false);
		expect(boolFalse.project()).toBe(false);

		num.dispose();
		str.dispose();
		undef.dispose();
		boolTrue.dispose();
		boolFalse.dispose();
		perl.dispose();
	});

	it("should throw error when using disposed PerlValue", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createInt(42);
		val.dispose();

		expect(() => {
			val.toInt();
		}).toThrow("PerlValue has been disposed");

		perl.dispose();
	});
});

describe("Arrays", () => {
	it("should create empty arrays", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray();

		expect(arr.getLength()).toBe(0);

		arr.dispose();
		perl.dispose();
	});

	it("should create arrays from JavaScript arrays", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray([1, 2, 3, "hello", true, null]);

		expect(arr.getLength()).toBe(6);

		const val0 = arr.get(0);
		expect(val0?.toInt()).toBe(1);

		const val3 = arr.get(3);
		expect(val3?.toString()).toBe("hello");

		const val4 = arr.get(4);
		expect(val4?.toBoolean()).toBe(true);

		const val5 = arr.get(5);
		expect(val5?.isUndef()).toBe(true);

		val0?.dispose();
		val3?.dispose();
		val4?.dispose();
		val5?.dispose();
		arr.dispose();
		perl.dispose();
	});

	it("should push and pop values", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray();

		arr.push(42);
		arr.push("hello");
		arr.push(true);

		expect(arr.getLength()).toBe(3);

		const val = arr.pop();
		expect(val?.toBoolean()).toBe(true);

		expect(arr.getLength()).toBe(2);

		val?.dispose();
		arr.dispose();
		perl.dispose();
	});

	it("should get and set values by index", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray();

		arr.push(1);
		arr.push(2);
		arr.push(3);

		const val = arr.get(1);
		expect(val?.toInt()).toBe(2);

		arr.set(1, 99);
		const newVal = arr.get(1);
		expect(newVal?.toInt()).toBe(99);

		val?.dispose();
		newVal?.dispose();
		arr.dispose();
		perl.dispose();
	});

	it("should clear arrays", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray();

		arr.push(1);
		arr.push(2);
		arr.push(3);

		expect(arr.getLength()).toBe(3);

		arr.clear();
		expect(arr.getLength()).toBe(0);

		arr.dispose();
		perl.dispose();
	});

	it("should iterate over array values", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray();

		arr.push(1);
		arr.push(2);
		arr.push(3);

		const values: number[] = [];
		for (const val of arr) {
			values.push(val.toInt());
			val.dispose();
		}

		expect(values).toEqual([1, 2, 3]);

		arr.dispose();
		perl.dispose();
	});

	it("should convert array to PerlValue", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray();

		arr.push(1);
		arr.push(2);

		const val = arr.toValue();
		expect(val.isRef()).toBe(true);

		val.dispose();
		arr.dispose();
		perl.dispose();
	});

	it("should convert array to JavaScript array via project()", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray();

		arr.push(42);
		arr.push("hello");
		arr.push(true);

		const jsArr = arr.project();
		expect(jsArr).toEqual([42, "hello", true]);

		arr.dispose();
		perl.dispose();
	});

	it("should round-trip JavaScript arrays", async () => {
		const perl = await ZeroPerl.create();
		const original = [1, 2, 3, "test", true, null];

		const arr = perl.createArray(original);
		const result = arr.project();

		expect(result).toEqual(original);

		arr.dispose();
		perl.dispose();
	});

	it("should handle nested arrays", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray([1, [2, 3], [4, [5, 6]]]);

		expect(arr.getLength()).toBe(3);

		const val0 = arr.get(0);
		expect(val0?.toInt()).toBe(1);

		const val1 = arr.get(1);
		expect(val1?.isRef()).toBe(true);

		val0?.dispose();
		val1?.dispose();
		arr.dispose();
		perl.dispose();
	});

	it("should throw error when using disposed PerlArray", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray();
		arr.dispose();

		expect(() => {
			arr.getLength();
		}).toThrow("PerlArray has been disposed");

		perl.dispose();
	});
});

describe("Hashes", () => {
	it("should create empty hashes", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		expect(hash.has("key")).toBe(false);

		hash.dispose();
		perl.dispose();
	});

	it("should create hashes from JavaScript objects", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash({
			name: "Alice",
			age: 30,
			active: true,
			score: 95.5,
		});

		const name = hash.get("name");
		expect(name?.toString()).toBe("Alice");

		const age = hash.get("age");
		expect(age?.toInt()).toBe(30);

		const active = hash.get("active");
		expect(active?.toBoolean()).toBe(true);

		name?.dispose();
		age?.dispose();
		active?.dispose();
		hash.dispose();
		perl.dispose();
	});

	it("should set and get values", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("name", "Alice");
		hash.set("age", 30);

		const name = hash.get("name");
		expect(name?.toString()).toBe("Alice");

		const age = hash.get("age");
		expect(age?.toInt()).toBe(30);

		name?.dispose();
		age?.dispose();
		hash.dispose();
		perl.dispose();
	});

	it("should check if keys exist", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("key1", "value1");

		expect(hash.has("key1")).toBe(true);
		expect(hash.has("key2")).toBe(false);

		hash.dispose();
		perl.dispose();
	});

	it("should delete keys", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("key", "value");
		expect(hash.has("key")).toBe(true);

		const deleted = hash.delete("key");
		expect(deleted).toBe(true);
		expect(hash.has("key")).toBe(false);

		const notDeleted = hash.delete("nonexistent");
		expect(notDeleted).toBe(false);

		hash.dispose();
		perl.dispose();
	});

	it("should clear hashes", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("key1", "value1");
		hash.set("key2", "value2");

		hash.clear();

		expect(hash.has("key1")).toBe(false);
		expect(hash.has("key2")).toBe(false);

		hash.dispose();
		perl.dispose();
	});

	it("should iterate over entries", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("a", 1);
		hash.set("b", 2);
		hash.set("c", 3);

		const entries: Record<string, number> = {};
		for (const [key, val] of hash.entries()) {
			entries[key] = val.toInt();
			val.dispose();
		}

		expect(entries).toEqual({ a: 1, b: 2, c: 3 });

		hash.dispose();
		perl.dispose();
	});

	it("should iterate over keys", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("key1", "value1");
		hash.set("key2", "value2");

		const keys: string[] = [];
		for (const key of hash.keys()) {
			keys.push(key);
		}

		expect(keys.sort()).toEqual(["key1", "key2"]);

		hash.dispose();
		perl.dispose();
	});

	it("should iterate over values", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("a", 1);
		hash.set("b", 2);

		const values: number[] = [];
		for (const val of hash.values()) {
			values.push(val.toInt());
			val.dispose();
		}

		expect(values.sort()).toEqual([1, 2]);

		hash.dispose();
		perl.dispose();
	});

	it("should convert hash to PerlValue", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("key", "value");

		const val = hash.toValue();
		expect(val.isRef()).toBe(true);

		val.dispose();
		hash.dispose();
		perl.dispose();
	});

	it("should convert hash to JavaScript object via project()", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();

		hash.set("name", "Bob");
		hash.set("age", 25);
		hash.set("active", true);

		const obj = hash.project();
		expect(obj).toEqual({
			name: "Bob",
			age: 25,
			active: true,
		});

		hash.dispose();
		perl.dispose();
	});

	it("should round-trip JavaScript objects", async () => {
		const perl = await ZeroPerl.create();
		const original = {
			str: "hello",
			num: 42,
			bool: true,
			nil: null,
		};

		const hash = perl.createHash(original);
		const result = hash.project();

		expect(result).toEqual(original);

		hash.dispose();
		perl.dispose();
	});

	it("should handle nested objects", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash({
			name: "Alice",
			data: {
				age: 30,
				city: "NYC",
			},
		});

		const name = hash.get("name");
		expect(name?.toString()).toBe("Alice");

		const data = hash.get("data");
		expect(data?.isRef()).toBe(true);

		name?.dispose();
		data?.dispose();
		hash.dispose();
		perl.dispose();
	});

	it("should throw error when using disposed PerlHash", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash();
		hash.dispose();

		expect(() => {
			hash.has("key");
		}).toThrow("PerlHash has been disposed");

		perl.dispose();
	});
});

describe("Variables", () => {
	it("should set and get scalar variables with primitives", async () => {
		const perl = await ZeroPerl.create();

		perl.setVariable("name", "Alice");
		perl.setVariable("age", 30);
		perl.setVariable("active", true);

		const name = perl.getVariable("name");
		expect(name?.toString()).toBe("Alice");

		const age = perl.getVariable("age");
		expect(age?.toInt()).toBe(30);

		const active = perl.getVariable("active");
		expect(active?.toBoolean()).toBe(true);

		name?.dispose();
		age?.dispose();
		active?.dispose();
		perl.dispose();
	});

	it("should set variables with PerlValue", async () => {
		const perl = await ZeroPerl.create();

		const val = perl.createString("test");
		perl.setVariable("myvar", val);

		const retrieved = perl.getVariable("myvar");
		expect(retrieved?.toString()).toBe("test");

		val.dispose();
		retrieved?.dispose();
		perl.dispose();
	});

	it("should set variables with arrays", async () => {
		const perl = await ZeroPerl.create();

		perl.setVariable("numbers", [1, 2, 3, 4, 5]);

		const val = perl.getVariable("numbers");
		expect(val?.isRef()).toBe(true);

		val?.dispose();
		perl.dispose();
	});

	it("should set variables with objects", async () => {
		const perl = await ZeroPerl.create();

		perl.setVariable("user", {
			name: "Alice",
			age: 30,
		});

		const val = perl.getVariable("user");
		expect(val?.isRef()).toBe(true);

		val?.dispose();
		perl.dispose();
	});

	it("should return null for non-existent variables", async () => {
		const perl = await ZeroPerl.create();

		const value = perl.getVariable("nonexistent");
		expect(value).toBeNull();

		perl.dispose();
	});

	it("should get and set array variables", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval("@myarray = (1, 2, 3)");
		expectSuccess(result);

		const arr = perl.getArrayVariable("myarray");
		expect(arr?.getLength()).toBe(3);

		arr?.dispose();
		perl.dispose();
	});

	it("should get and set hash variables", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval("%myhash = (a => 1, b => 2)");
		expectSuccess(result);

		const hash = perl.getHashVariable("myhash");
		expect(hash?.has("a")).toBe(true);
		expect(hash?.has("b")).toBe(true);

		hash?.dispose();
		perl.dispose();
	});

	it("should overwrite existing variables", async () => {
		const perl = await ZeroPerl.create();

		perl.setVariable("var", "first");
		let val = perl.getVariable("var");
		expect(val?.toString()).toBe("first");

		perl.setVariable("var", "second");
		val = perl.getVariable("var");
		expect(val?.toString()).toBe("second");

		val?.dispose();
		perl.dispose();
	});
});

describe("Host Functions", () => {
	it("should register and call host functions", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stderr: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		perl.registerFunction("double", (x) => {
			const num = x.toInt();
			return perl.createInt(num * 2);
		});

		const result = await perl.eval("print double(21)");
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("42");

		perl.dispose();
	});

	it("should register host methods", async () => {
		const perl = await ZeroPerl.create();

		perl.registerMethod("Math", "square", (x) => {
			const num = x.toInt();
			return perl.createInt(num * num);
		});

		const result = await perl.eval("$result = Math::square(7)");
		expectSuccess(result);

		const perlResult = perl.getVariable("result");
		expect(perlResult?.toInt()).toBe(49);

		perlResult?.dispose();
		perl.dispose();
	});

	it("should handle async host functions", async () => {
		const perl = await ZeroPerl.create();

		perl.registerFunction("async_func", async (x) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			const num = x.toInt();
			return perl.createInt(num + 1);
		});

		const result = await perl.eval("$result = async_func(41)");
		expectSuccess(result);

		const perlResult = perl.getVariable("result");
		expect(perlResult?.toInt()).toBe(42);

		perlResult?.dispose();
		perl.dispose();
	});

	it("should handle host functions with multiple arguments", async () => {
		const perl = await ZeroPerl.create();

		perl.registerFunction("add", (a, b) => {
			const x = a.toInt();
			const y = b.toInt();
			return perl.createInt(x + y);
		});

		const result = await perl.eval("$sum = add(10, 32)");
		expectSuccess(result);

		const sum = perl.getVariable("sum");
		expect(sum?.toInt()).toBe(42);

		sum?.dispose();
		perl.dispose();
	});

	it("should handle host functions returning different types", async () => {
		const perl = await ZeroPerl.create();

		perl.registerFunction("get_string", () => {
			return perl.createString("hello");
		});

		perl.registerFunction("get_array", () => {
			const arr = perl.createArray();
			arr.push(1);
			arr.push(2);
			return arr.toValue();
		});

		const result = await perl.eval("$str = get_string()");
		expectSuccess(result);

		const str = perl.getVariable("str");
		expect(str?.toString()).toBe("hello");

		str?.dispose();
		perl.dispose();
	});

	it("should handle void host functions", async () => {
		const perl = await ZeroPerl.create();
		let called = false;

		perl.registerFunction("set_flag", () => {
			called = true;
		});

		const result = await perl.eval("set_flag()");
		expectSuccess(result);
		expect(called).toBe(true);

		perl.dispose();
	});

	it("should handle host function errors", async () => {
		const perl = await ZeroPerl.create();

		perl.registerFunction("divide", (a, b) => {
			const x = a.toInt();
			const y = b.toInt();
			if (y === 0) {
				throw new Error("Division by zero");
			}
			return perl.createInt(x / y);
		});

		const result = await perl.eval(`
			eval { $result = divide(10, 0) };
			$error = $@;
		`);
		expectSuccess(result);

		const error = perl.getVariable("error");
		expect(error?.toString()).toContain("Division by zero");

		error?.dispose();
		perl.dispose();
	});

	it("should propagate host function errors", async () => {
		const perl = await ZeroPerl.create();

		perl.registerFunction("fail", () => {
			throw new Error("Host function failed");
		});

		const result = await perl.eval("$x = fail()");
		expectFailure(result);
		expect(result.error).toContain("Host function failed");

		perl.dispose();
	});

	it("should handle host function errors with custom messages", async () => {
		const perl = await ZeroPerl.create();

		perl.registerFunction("validate", (x) => {
			const num = x.toInt();
			if (num < 0) {
				throw new Error("Value must be positive");
			}
			if (num > 100) {
				throw new Error("Value must be less than 100");
			}
			return perl.createInt(num);
		});

		let result = await perl.eval(`
			eval { $result = validate(-5) };
			$error1 = $@;
		`);
		expectSuccess(result);

		let error = perl.getVariable("error1");
		expect(error?.toString()).toContain("Value must be positive");
		error?.dispose();

		result = await perl.eval(`
			eval { $result = validate(150) };
			$error2 = $@;
		`);
		expectSuccess(result);

		error = perl.getVariable("error2");
		expect(error?.toString()).toContain("Value must be less than 100");
		error?.dispose();

		perl.dispose();
	});
});

describe("Calling Perl from JavaScript", () => {
	it("should call Perl subroutines in scalar context", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval('sub greet { my ($name) = @_; return "Hello, $name!"; }');
		expectSuccess(result);

		const arg = perl.createString("Alice");
		const callResult = await perl.call("greet", [arg], "scalar");

		expect(callResult?.toString()).toBe("Hello, Alice!");

		arg.dispose();
		callResult?.dispose();
		perl.dispose();
	});

	it("should call Perl subroutines with default scalar context", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval('sub greet { my ($name) = @_; return "Hello, $name!"; }');
		expectSuccess(result);

		const arg = perl.createString("Alice");
		const callResult = await perl.call("greet", [arg]);

		expect(callResult?.toString()).toBe("Hello, Alice!");

		arg.dispose();
		callResult?.dispose();
		perl.dispose();
	});

	it("should call Perl subroutines with multiple arguments", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval("sub add { my ($a, $b) = @_; return $a + $b; }");
		expectSuccess(result);

		const arg1 = perl.createInt(10);
		const arg2 = perl.createInt(32);
		const callResult = await perl.call("add", [arg1, arg2], "scalar");

		expect(callResult?.toInt()).toBe(42);

		arg1.dispose();
		arg2.dispose();
		callResult?.dispose();
		perl.dispose();
	});

	it("should call Perl subroutines in list context", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval("sub get_values { return (1, 2, 3); }");
		expectSuccess(result);

		const results = await perl.call("get_values", [], "list");

		expect(results.length).toBe(3);
		expect(results[0].toInt()).toBe(1);
		expect(results[1].toInt()).toBe(2);
		expect(results[2].toInt()).toBe(3);

		for (const r of results) {
			r.dispose();
		}
		perl.dispose();
	});

	it("should call Perl subroutines in void context", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval("sub set_global { $::global = 42; }");
		expectSuccess(result);

		const callResult = await perl.call("set_global", [], "void");

		expect(callResult).toBeUndefined();

		const global = perl.getVariable("global");
		expect(global?.toInt()).toBe(42);

		global?.dispose();
		perl.dispose();
	});

	it("should call Perl subroutines without arguments", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval("sub get_pi { return 3.14159; }");
		expectSuccess(result);

		const callResult = await perl.call("get_pi");

		expect(callResult?.toDouble()).toBeCloseTo(Math.PI, 5);

		callResult?.dispose();
		perl.dispose();
	});

	it("should handle Perl subroutine errors", async () => {
		const perl = await ZeroPerl.create();
		const result = await perl.eval('sub fail_sub { die "Subroutine failed"; }');
		expectSuccess(result);

		const callResult = await perl.call("fail_sub");
		expect(callResult).toBeNull();

		const error = perl.getLastError();
		expect(error).toContain("Subroutine failed");

		perl.dispose();
	});
});

describe("File System", () => {
	it("should run script files", async () => {
		const fs = new MemoryFileSystem({ "/": "/" });
		fs.addFile("/test.pl", 'print "Hello from file!"');

		let output = "";
		const perl = await ZeroPerl.create({
			fileSystem: fs,
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.runFile("/test.pl");
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("Hello from file!");

		perl.dispose();
	});

	it("should run script files with arguments", async () => {
		const fs = new MemoryFileSystem({ "/": "" });
		fs.addFile("/script.pl", 'print "Args: @ARGV"');

		let output = "";
		const perl = await ZeroPerl.create({
			fileSystem: fs,
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.runFile("/script.pl", ["one", "two"]);
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("Args: one two");

		perl.dispose();
	});

	it("should read data files", async () => {
		const fs = new MemoryFileSystem({ "/": "" });
		fs.addFile("/data.txt", "Hello from file system!");

		let output = "";
		const perl = await ZeroPerl.create({
			fileSystem: fs,
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			open my $fh, '<', '/data.txt' or die $!;
			my $content = <$fh>;
			print $content;
			close $fh;
		`);
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("Hello from file system!");

		perl.dispose();
	});

	it("should handle file not found errors", async () => {
		const fs = new MemoryFileSystem({ "/": "" });
		const perl = await ZeroPerl.create({ fileSystem: fs });

		const result = await perl.runFile("/nonexistent.pl");
		expectFailure(result);
		expect(result.error).toContain("No such file or directory");

		perl.dispose();
	});

	it("should handle File and Blob objects", async () => {
		const fs = new MemoryFileSystem({ "/": "" });

		const file = new File(["File content"], "test.txt");
		const blob = new Blob(["Blob content"]);

		fs.addFile("/file.txt", file);
		fs.addFile("/blob.txt", blob);

		let output = "";
		const perl = await ZeroPerl.create({
			fileSystem: fs,
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			open my $fh, '<', '/file.txt';
			print <$fh>;
			close $fh;
			print " ";
			open $fh, '<', '/blob.txt';
			print <$fh>;
			close $fh;
		`);
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("File content Blob content");

		perl.dispose();
	});
});

describe("Output Handling", () => {
	it("should capture stdout", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval('print "hello"');
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("hello");

		perl.dispose();
	});

	it("should capture stderr separately", async () => {
		let stdout = "";
		let stderr = "";

		const perl = await ZeroPerl.create({
			stdout: (data) => {
				stdout += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
			stderr: (data) => {
				stderr += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval('print "to stdout"; warn "to stderr"');
		expectSuccess(result);
		perl.flush();

		expect(stdout).toBe("to stdout");
		expect(stderr).toContain("to stderr");

		perl.dispose();
	});

	it("should handle multiple eval calls with output", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		let result = await perl.eval('print "first "');
		expectSuccess(result);
		perl.flush();

		result = await perl.eval('print "second"');
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("first second");

		perl.dispose();
	});

	it("should handle binary data output", async () => {
		let output = new Uint8Array();
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				const bytes = typeof data === "string"
					? new TextEncoder().encode(data)
					: data;
				const combined = new Uint8Array(output.length + bytes.length);
				combined.set(output);
				combined.set(bytes, output.length);
				output = combined;
			},
		});

		const result = await perl.eval('print "test"');
		expectSuccess(result);
		perl.flush();

		expect(new TextDecoder().decode(output)).toBe("test");

		perl.dispose();
	});
});

describe("Environment", () => {
	it("should pass environment variables", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			env: { MY_VAR: "test_value", ANOTHER: "value2" },
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval('print $ENV{MY_VAR} . " " . $ENV{ANOTHER}');
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("test_value value2");

		perl.dispose();
	});

	it("should handle missing environment variables", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			env: {},
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval('print defined($ENV{NONEXISTENT}) ? "defined" : "undefined"');
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("undefined");

		perl.dispose();
	});
});

describe("Complex Scenarios", () => {
	it("should handle complex nested data structures", async () => {
		const perl = await ZeroPerl.create();

		perl.setVariable("config", {
			server: {
				host: "localhost",
				port: 8080,
				ssl: true,
			},
			databases: [
				{ name: "main", host: "db1.example.com" },
				{ name: "cache", host: "db2.example.com" },
			],
			features: ["auth", "logging", "metrics"],
		});

		const val = perl.getVariable("config");
		expect(val?.isRef()).toBe(true);

		val?.dispose();
		perl.dispose();
	});

	it("should maintain state across operations", async () => {
		const perl = await ZeroPerl.create();

		let result = await perl.eval("$counter = 0");
		expectSuccess(result);

		result = await perl.eval("$counter++");
		expectSuccess(result);

		result = await perl.eval("$counter++");
		expectSuccess(result);

		const counter = perl.getVariable("counter");
		expect(counter?.toInt()).toBe(2);

		counter?.dispose();
		perl.dispose();
	});

	it("should handle errors without losing state", async () => {
		const perl = await ZeroPerl.create();

		perl.setVariable("x", 42);

		const result = await perl.eval('die "error"');
		expectFailure(result);

		const x = perl.getVariable("x");
		expect(x?.toInt()).toBe(42);

		x?.dispose();
		perl.dispose();
	});

	it("should handle loops and complex logic", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval(`
			@array = (1, 2, 3, 4, 5);
			$sum = 0;
			foreach my $num (@array) {
				$sum += $num;
			}
		`);
		expectSuccess(result);

		const sum = perl.getVariable("sum");
		expect(sum?.toInt()).toBe(15);

		sum?.dispose();
		perl.dispose();
	});

	it("should work with JavaScript data in Perl code", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		perl.setVariable("user", {
			name: "Alice",
			age: 30,
			scores: [95, 87, 92],
		});

		const result = await perl.eval('print "$user->{name} is $user->{age} years old"');
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("Alice is 30 years old");

		perl.dispose();
	});

	it("should handle large data structures", async () => {
		const perl = await ZeroPerl.create();

		const largeArray = Array.from({ length: 1000 }, (_, i) => i);
		perl.setVariable("numbers", largeArray);

		const result = await perl.eval(`
			$sum = 0;
			foreach my $num (@$numbers) {
				$sum += $num;
			}
		`);
		expectSuccess(result);

		const sum = perl.getVariable("sum");
		expect(sum?.toInt()).toBe(499500);

		sum?.dispose();
		perl.dispose();
	});

	it("should handle deeply nested structures", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const nested = {
			level1: {
				level2: {
					level3: {
						level4: {
							value: "deep",
						},
					},
				},
			},
		};

		perl.setVariable("nested", nested);

		const result = await perl.eval('use Data::Dumper; print Dumper($nested);');
		expectSuccess(result);
		perl.flush();

		expect(output).toContain("'value' => 'deep'");
		perl.dispose();
	});
});

describe("Edge Cases", () => {
	it("should handle empty strings", async () => {
		const perl = await ZeroPerl.create();
		const val = perl.createString("");

		expect(val.toString()).toBe("");
		expect(val.project()).toBe("");

		val.dispose();
		perl.dispose();
	});

	it("should handle special characters in strings", async () => {
		const perl = await ZeroPerl.create();
		const special = "Hello\nWorld\t!\0End";
		const val = perl.createString(special);

		expect(val.toString()).toBe(special);

		val.dispose();
		perl.dispose();
	});

	it("should handle Unicode strings", async () => {
		const perl = await ZeroPerl.create();
		const unicode = "Hello 世界 🌍";
		const val = perl.createString(unicode);

		expect(val.toString()).toBe(unicode);

		val.dispose();
		perl.dispose();
	});

	it("should handle zero values", async () => {
		const perl = await ZeroPerl.create();
		const zero = perl.createInt(0);

		expect(zero.toInt()).toBe(0);
		expect(zero.toBoolean()).toBe(false);

		zero.dispose();
		perl.dispose();
	});

	it("should handle negative numbers", async () => {
		const perl = await ZeroPerl.create();
		const neg = perl.createInt(-42);

		expect(neg.toInt()).toBe(-42);

		neg.dispose();
		perl.dispose();
	});

	it("should handle very large numbers", async () => {
		const perl = await ZeroPerl.create();
		const large = perl.createDouble(Number.MAX_SAFE_INTEGER);

		expect(large.toDouble()).toBe(Number.MAX_SAFE_INTEGER);

		large.dispose();
		perl.dispose();
	});

	it("should handle empty arrays", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray([]);

		expect(arr.getLength()).toBe(0);
		expect(arr.project()).toEqual([]);

		arr.dispose();
		perl.dispose();
	});

	it("should handle empty hashes", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash({});

		expect(hash.project()).toEqual({});

		hash.dispose();
		perl.dispose();
	});

	it("should handle null in arrays", async () => {
		const perl = await ZeroPerl.create();
		const arr = perl.createArray([1, null, 3]);

		const val = arr.get(1);
		expect(val?.isUndef()).toBe(true);

		val?.dispose();
		arr.dispose();
		perl.dispose();
	});

	it("should handle null in hashes", async () => {
		const perl = await ZeroPerl.create();
		const hash = perl.createHash({ key: null });

		const val = hash.get("key");
		expect(val?.isUndef()).toBe(true);

		val?.dispose();
		hash.dispose();
		perl.dispose();
	});
});

describe("Error Handling", () => {
	it("should handle syntax errors", async () => {
		const perl = await ZeroPerl.create();
		const result = await perl.eval("$x = ;");

		expectFailure(result);
		expect(result.error).toBeTruthy();

		perl.dispose();
	});

	it("should handle runtime errors", async () => {
		const perl = await ZeroPerl.create();
		const result = await perl.eval("$x = 1 / 0");

		expectFailure(result);
		expect(result.error).toContain("Illegal division by zero");

		perl.dispose();
	});

	it("should handle undefined variable access", async () => {
		let stderr = "";
		const perl = await ZeroPerl.create({
			stderr: (data) => {
				stderr += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval("use warnings; print $undefined_var");
		expectSuccess(result);
		perl.flush();

		expect(stderr).toContain("uninitialized");

		perl.dispose();
	});

	it("should recover from errors", async () => {
		const perl = await ZeroPerl.create();

		const failResult = await perl.eval('die "error"');
		expectFailure(failResult);

		perl.clearError();

		const result = await perl.eval("$x = 42");
		expectSuccess(result);

		perl.dispose();
	});
});

describe("Creation Options", () => {
	it("should create with custom environment", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			env: { CUSTOM: "value" },
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval('print $ENV{CUSTOM}');
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("value");

		perl.dispose();
	});

	it("should create with custom file system", async () => {
		const fs = new MemoryFileSystem({ "/": "" });
		fs.addFile("/test.txt", "content");

		let output = "";
		const perl = await ZeroPerl.create({
			fileSystem: fs,
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			open my $fh, '<', '/test.txt';
			print <$fh>;
			close $fh;
		`);
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("content");

		perl.dispose();
	});

	it("should create with output handlers", async () => {
		let stdout = "";
		let stderr = "";

		const perl = await ZeroPerl.create({
			stdout: (data) => {
				stdout += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
			stderr: (data) => {
				stderr += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval('print "out"; warn "err"');
		expectSuccess(result);
		perl.flush();

		expect(stdout).toBe("out");
		expect(stderr).toContain("err");

		perl.dispose();
	});
});

describe("Unicode Character Handling", () => {
	describe("Korean (한국어) Characters", () => {
		it("should create and retrieve Korean strings", async () => {
			const perl = await ZeroPerl.create();
			const koreanText = "안녕하세요";
			const val = perl.createString(koreanText);

			expect(val.toString()).toBe(koreanText);
			expect(val.project()).toBe(koreanText);
			expect(val.toString().length).toBe(5);

			val.dispose();
			perl.dispose();
		});

		it("should handle Korean text in variables", async () => {
			const perl = await ZeroPerl.create();
			const koreanText = "김철수";

			perl.setVariable("name", koreanText);
			const retrieved = perl.getVariable("name");

			expect(retrieved?.toString()).toBe(koreanText);
			expect(retrieved?.toString()).not.toMatch(/[�]/);

			retrieved?.dispose();
			perl.dispose();
		});

		it("should handle Korean text with special characters", async () => {
			const perl = await ZeroPerl.create();
			const koreanText = "안녕하세요! 반갑습니다? (한국어)";

			perl.setVariable("greeting", koreanText);
			const retrieved = perl.getVariable("greeting");

			expect(retrieved?.toString()).toBe(koreanText);

			retrieved?.dispose();
			perl.dispose();
		});

		it("should output Korean text correctly", async () => {
			let output = "";
			const perl = await ZeroPerl.create({
				stdout: (data) => {
					output += typeof data === "string" ? data : new TextDecoder().decode(data);
				},
			});

			const koreanText = "안녕하세요";
			perl.setVariable("msg", koreanText);

			const result = await perl.eval('print $msg');
			expectSuccess(result);
			perl.flush();

			expect(output).toBe(koreanText);
			expect(output).not.toMatch(/[�]/);

			perl.dispose();
		});
	});

	describe("Japanese (日本語) Characters", () => {
		it("should create and retrieve Japanese strings", async () => {
			const perl = await ZeroPerl.create();
			const japaneseText = "こんにちは世界";
			const val = perl.createString(japaneseText);

			expect(val.toString()).toBe(japaneseText);
			expect(val.project()).toBe(japaneseText);

			val.dispose();
			perl.dispose();
		});

		it("should handle mixed Hiragana, Katakana, and Kanji", async () => {
			const perl = await ZeroPerl.create();
			const japaneseText = "ひらがな カタカナ 漢字";

			perl.setVariable("text", japaneseText);
			const retrieved = perl.getVariable("text");

			expect(retrieved?.toString()).toBe(japaneseText);

			retrieved?.dispose();
			perl.dispose();
		});

		it("should handle Japanese text in arrays", async () => {
			const perl = await ZeroPerl.create();
			const items = ["東京", "大阪", "京都"];
			const arr = perl.createArray(items);

			expect(arr.getLength()).toBe(3);

			const val0 = arr.get(0);
			expect(val0?.toString()).toBe("東京");

			const val1 = arr.get(1);
			expect(val1?.toString()).toBe("大阪");

			const projected = arr.project();
			expect(projected).toEqual(items);

			val0?.dispose();
			val1?.dispose();
			arr.dispose();
			perl.dispose();
		});
	});

	describe("Chinese (中文) Characters", () => {
		it("should handle Simplified Chinese text", async () => {
			const perl = await ZeroPerl.create();
			const chineseText = "你好世界";
			const val = perl.createString(chineseText);

			expect(val.toString()).toBe(chineseText);
			expect(val.toString()).not.toMatch(/[�]/);

			val.dispose();
			perl.dispose();
		});

		it("should handle Traditional Chinese text", async () => {
			const perl = await ZeroPerl.create();
			const chineseText = "繁體中文測試";

			perl.setVariable("text", chineseText);
			const retrieved = perl.getVariable("text");

			expect(retrieved?.toString()).toBe(chineseText);

			retrieved?.dispose();
			perl.dispose();
		});

		it("should handle Chinese text in hashes", async () => {
			const perl = await ZeroPerl.create();
			const data = {
				城市: "北京",
				国家: "中国",
			};
			const hash = perl.createHash(data);

			const city = hash.get("城市");
			expect(city?.toString()).toBe("北京");

			const country = hash.get("国家");
			expect(country?.toString()).toBe("中国");

			city?.dispose();
			country?.dispose();
			hash.dispose();
			perl.dispose();
		});
	});

	describe("Mixed Unicode and Multilingual", () => {
		it("should handle mixed language text", async () => {
			const perl = await ZeroPerl.create();
			const mixedText = "Hello 안녕하세요 こんにちは 你好";
			const val = perl.createString(mixedText);

			expect(val.toString()).toBe(mixedText);

			val.dispose();
			perl.dispose();
		});

		it("should handle emoji and extended Unicode", async () => {
			const perl = await ZeroPerl.create();
			const emojiText = "📷 Photo by 김철수 🌸";
			const val = perl.createString(emojiText);

			expect(val.toString()).toBe(emojiText);

			val.dispose();
			perl.dispose();
		});

		it("should handle Unicode in nested structures", async () => {
			const perl = await ZeroPerl.create();
			const nested = {
				user: {
					name: "田中太郎",
					city: "東京",
				},
				tags: ["写真", "旅行", "食べ物"],
			};

			perl.setVariable("data", nested);
			const retrieved = perl.getVariable("data");

			expect(retrieved?.isRef()).toBe(true);

			retrieved?.dispose();
			perl.dispose();
		});

		it("should round-trip Unicode arrays", async () => {
			const perl = await ZeroPerl.create();
			const original = ["Hello", "안녕", "こんにちは", "你好", "🌍"];
			const arr = perl.createArray(original);
			const result = arr.project();

			expect(result).toEqual(original);

			arr.dispose();
			perl.dispose();
		});

		it("should round-trip Unicode hashes", async () => {
			const perl = await ZeroPerl.create();
			const original = {
				english: "Hello",
				korean: "안녕하세요",
				japanese: "こんにちは",
				chinese: "你好",
				emoji: "🎉",
			};
			const hash = perl.createHash(original);
			const result = hash.project();

			expect(result).toEqual(original);

			hash.dispose();
			perl.dispose();
		});
	});

	describe("Unicode in Perl Operations", () => {
		it("should handle Unicode in eval code with 'use utf8' pragma", async () => {
			const perl = await ZeroPerl.create();
			const result = await perl.eval('use utf8; $greeting = "안녕하세요"');
			expectSuccess(result);

			const greeting = perl.getVariable("greeting");
			expect(greeting?.toString()).toBe("안녕하세요");

			greeting?.dispose();
			perl.dispose();
		});

		it("should handle Unicode in Perl string operations with 'use utf8' pragma", async () => {
			let output = "";
			const perl = await ZeroPerl.create({
				stdout: (data) => {
					output += typeof data === "string" ? data : new TextDecoder().decode(data);
				},
			});

			perl.setVariable("name", "김철수");

			const result = await perl.eval('use utf8; $msg = "안녕하세요, $name!"; print $msg');
			expectSuccess(result);
			perl.flush();

			expect(output).toBe("안녕하세요, 김철수!");

			perl.dispose();
		});

		it("should handle Unicode passed via setVariable without pragma", async () => {
			let output = "";
			const perl = await ZeroPerl.create({
				stdout: (data) => {
					output += typeof data === "string" ? data : new TextDecoder().decode(data);
				},
			});

			perl.setVariable("greeting", "안녕하세요");
			perl.setVariable("name", "김철수");

			const result = await perl.eval('print "$greeting, $name!"');
			expectSuccess(result);
			perl.flush();

			expect(output).toBe("안녕하세요, 김철수!");

			perl.dispose();
		});

		it("should handle Unicode in host functions with pragma", async () => {
			const perl = await ZeroPerl.create();

			perl.registerFunction("greet", (name) => {
				const n = name.toString();
				return perl.createString(`안녕하세요, ${n}!`);
			});

			const result = await perl.eval('use utf8; $result = greet("田中")');
			expectSuccess(result);

			const perlResult = perl.getVariable("result");
			expect(perlResult?.toString()).toBe("안녕하세요, 田中!");

			perlResult?.dispose();
			perl.dispose();
		});

		it("should handle Unicode in host functions via setVariable", async () => {
			const perl = await ZeroPerl.create();

			perl.registerFunction("greet", (name) => {
				const n = name.toString();
				return perl.createString(`안녕하세요, ${n}!`);
			});

			perl.setVariable("name_arg", "田中");

			const result = await perl.eval('$result = greet($name_arg)');
			expectSuccess(result);

			const perlResult = perl.getVariable("result");
			expect(perlResult?.toString()).toBe("안녕하세요, 田中!");

			perlResult?.dispose();
			perl.dispose();
		});

		it("should handle Unicode in Perl subroutine calls", async () => {
			const perl = await ZeroPerl.create();

			const result = await perl.eval('sub echo { return $_[0]; }');
			expectSuccess(result);

			const arg = perl.createString("こんにちは世界");
			const callResult = await perl.call("echo", [arg], "scalar");

			expect(callResult?.toString()).toBe("こんにちは世界");

			arg.dispose();
			callResult?.dispose();
			perl.dispose();
		});

		it("should corrupt Unicode in source code without 'use utf8' pragma", async () => {
			const perl = await ZeroPerl.create();
			const result = await perl.eval('$greeting = "안녕하세요"');
			expectSuccess(result);

			const greeting = perl.getVariable("greeting");
			const retrieved = greeting?.toString();

			expect(retrieved).not.toBe("안녕하세요");
			expect(retrieved?.length).toBeGreaterThan(5);

			greeting?.dispose();
			perl.dispose();
		});
	});

	describe("Unicode Byte Length Validation", () => {
		it("should preserve correct byte length for Korean text", async () => {
			const perl = await ZeroPerl.create();
			const koreanText = "안녕하세요";
			const expectedByteLength = new TextEncoder().encode(koreanText).length;

			const val = perl.createString(koreanText);
			const retrieved = val.toString();
			const actualByteLength = new TextEncoder().encode(retrieved).length;

			expect(actualByteLength).toBe(expectedByteLength);
			expect(retrieved.length).toBe(koreanText.length);

			val.dispose();
			perl.dispose();
		});

		it("should preserve correct byte length for emoji", async () => {
			const perl = await ZeroPerl.create();
			const emojiText = "🎉🌸📷";
			const expectedByteLength = new TextEncoder().encode(emojiText).length;

			const val = perl.createString(emojiText);
			const retrieved = val.toString();
			const actualByteLength = new TextEncoder().encode(retrieved).length;

			expect(actualByteLength).toBe(expectedByteLength);

			val.dispose();
			perl.dispose();
		});
	});

	describe("Unicode Edge Cases", () => {
		it("should handle very long Unicode text", async () => {
			const perl = await ZeroPerl.create();
			const longText = "안녕하세요".repeat(100);

			const val = perl.createString(longText);
			const retrieved = val.toString();

			expect(retrieved).toBe(longText);
			expect(retrieved.length).toBe(500);

			val.dispose();
			perl.dispose();
		});

		it("should handle Unicode with null bytes", async () => {
			const perl = await ZeroPerl.create();
			const text = "안녕\0하세요";

			const val = perl.createString(text);
			const retrieved = val.toString();

			expect(retrieved).toBe(text);

			val.dispose();
			perl.dispose();
		});

		it("should handle Unicode newlines and whitespace", async () => {
			const perl = await ZeroPerl.create();
			const text = "こんにちは\n世界\t日本";

			const val = perl.createString(text);
			const retrieved = val.toString();

			expect(retrieved).toBe(text);

			val.dispose();
			perl.dispose();
		});

		it("should detect corruption via replacement characters", async () => {
			const perl = await ZeroPerl.create();
			const koreanText = "안녕하세요";

			perl.setVariable("text", koreanText);
			const retrieved = perl.getVariable("text");
			const result = retrieved?.toString();

			expect(result).not.toContain("�");
			expect(result).not.toContain("HUX8");
			expect(result).toMatch(/[\u3131-\uD79D]/);

			retrieved?.dispose();
			perl.dispose();
		});

		it("should handle combining characters", async () => {
			const perl = await ZeroPerl.create();
			const text = "가나다라마";

			const val = perl.createString(text);
			const retrieved = val.toString();

			expect(retrieved).toBe(text);

			val.dispose();
			perl.dispose();
		});
	});
});

describe("Perl Build Configuration", () => {
	it("should have consistent integer type sizes between runtime and config", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval(`
			use Config;
			my @errors;
			
			my $iv_pack = length(pack("j", 0));
			my $uv_pack = length(pack("J", 0));
			my $ptr_pack = length(pack("P", 0));
			my $long_pack = length(pack("l!", 0));
			my $longlong_pack = length(pack("q", 0));
			
			push @errors, "IV: pack=$iv_pack config=$Config{ivsize}" if $iv_pack != $Config{ivsize};
			push @errors, "UV: pack=$uv_pack config=$Config{uvsize}" if $uv_pack != $Config{uvsize};
			push @errors, "Pointer: pack=$ptr_pack config=$Config{ptrsize}" if $ptr_pack != $Config{ptrsize};
			push @errors, "long: pack=$long_pack config=$Config{longsize}" if $long_pack != $Config{longsize};
			push @errors, "long long: pack=$longlong_pack config=$Config{longlongsize}" if $longlong_pack != $Config{longlongsize};
			
			die "Type size mismatches: " . join(", ", @errors) if @errors;
		`);
		expectSuccess(result);

		perl.dispose();
	});

	it("should have correct WASM32 type sizes", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			use Config;
			print "$Config{ptrsize},$Config{longsize},$Config{longlongsize},$Config{ivsize},$Config{lseeksize}";
		`);
		expectSuccess(result);
		perl.flush();

		const [ptrsize, longsize, longlongsize, ivsize, lseeksize] = output.split(",").map(Number);

		expect(ptrsize).toBe(4);
		expect(longsize).toBe(4);
		expect(longlongsize).toBe(8);
		expect(ivsize).toBe(8);
		expect(lseeksize).toBe(8);

		perl.dispose();
	});

	it("should have 64-bit integer support for large files", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			use Config;
			my $ok = $Config{ivsize} >= $Config{lseeksize} ? 1 : 0;
			print "$ok,$Config{ivsize},$Config{lseeksize}";
		`);
		expectSuccess(result);
		perl.flush();

		const [ok, ivsize, lseeksize] = output.split(",").map(Number);

		expect(ok).toBe(1);
		expect(ivsize).toBeGreaterThanOrEqual(lseeksize);

		perl.dispose();
	});

	it("should use long long for 64-bit types", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			use Config;
			print "$Config{ivtype}|$Config{uvtype}|$Config{i64type}|$Config{u64type}";
		`);
		expectSuccess(result);
		perl.flush();

		const [ivtype, uvtype, i64type, u64type] = output.split("|");

		expect(ivtype).toBe("long long");
		expect(uvtype).toBe("unsigned long long");
		expect(i64type).toBe("long long");
		expect(u64type).toBe("unsigned long long");

		perl.dispose();
	});
});

describe("Perl I/O Operations", () => {
	it("should handle binary read-seek-read pattern", async () => {
		const fs = new MemoryFileSystem({ "/": "/" });

		const encoder = new TextEncoder();
		const parts: Uint8Array[] = [];

		parts.push(encoder.encode("channels\0chlist\0"));
		parts.push(new Uint8Array([20, 0, 0, 0]));
		parts.push(new Uint8Array(20).fill(0xAA));

		parts.push(encoder.encode("compression\0compression\0"));
		parts.push(new Uint8Array([1, 0, 0, 0]));
		parts.push(new Uint8Array([3]));

		parts.push(new Uint8Array([0]));

		const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
		const fileData = new Uint8Array(totalLength);
		let offset = 0;
		for (const part of parts) {
			fileData.set(part, offset);
			offset += part.length;
		}

		fs.addFile("/test.bin", fileData);

		let output = "";
		const perl = await ZeroPerl.create({
			fileSystem: fs,
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			open my $fh, '<:raw', '/test.bin' or die "Cannot open: $!";
			my @attributes;
			
			while (1) {
				my $bytes = sysread($fh, my $buff, 69);
				die "Read failed" unless defined $bytes;
				last if $bytes == 0;
				last if $buff =~ /^\\0/;
				
				unless ($buff =~ /^([^\\0]+)\\0([^\\0]+)\\0(.{4})/s) {
					die "Pattern match failed";
				}
				
				my ($name, $type, $size_bytes) = ($1, $2, $3);
				my $size = unpack('V', $size_bytes);
				
				my $match_end = length($name) + 1 + length($type) + 1 + 4;
				my $seek_offset = $match_end - length($buff);
				sysseek($fh, $seek_offset, 1) or die "Seek failed: $!";
				
				my $data_read = sysread($fh, my $data, $size);
				die "Data read failed" unless $data_read == $size;
				
				push @attributes, "$name:$type:$size";
			}
			
			close $fh;
			print join(",", @attributes);
		`);
		expectSuccess(result);
		perl.flush();

		expect(output).toContain("channels:chlist:20");
		expect(output).toContain("compression:compression:1");

		perl.dispose();
	});

	it("should correctly pack and unpack 64-bit integers", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			my $big = 0x123456789ABCDEF0;
			my $packed = pack("q", $big);
			my $unpacked = unpack("q", $packed);
			
			if ($unpacked == $big) {
				print "OK";
			} else {
				print "FAIL:expected=$big,got=$unpacked";
			}
		`);
		expectSuccess(result);
		perl.flush();

		expect(output).toBe("OK");

		perl.dispose();
	});
});

describe("Time::HiRes", () => {
	it("should load Time::HiRes module", async () => {
		const perl = await ZeroPerl.create();

		const result = await perl.eval(`use Time::HiRes; 1;`);
		expectSuccess(result);

		perl.dispose();
	});

	it("should get high-resolution time", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			use Time::HiRes qw(gettimeofday);
			my ($sec, $usec) = gettimeofday();
			print "$sec,$usec";
		`);
		expectSuccess(result);
		perl.flush();

		const [sec, usec] = output.split(",").map(Number);
		expect(sec).toBeGreaterThan(1577836800);
		expect(usec).toBeGreaterThanOrEqual(0);
		expect(usec).toBeLessThan(1000000);

		perl.dispose();
	});

	it("should get time as float", async () => {
		let output = "";
		const perl = await ZeroPerl.create({
			stdout: (data) => {
				output += typeof data === "string" ? data : new TextDecoder().decode(data);
			},
		});

		const result = await perl.eval(`
			use Time::HiRes qw(time);
			my $t = time();
			print $t;
		`);
		expectSuccess(result);
		perl.flush();

		const t = parseFloat(output);
		expect(t).toBeGreaterThan(1577836800);
		expect(output).toContain(".");

		perl.dispose();
	});
});

describe("Custom fetch in Node.js", () => {
	it("should call custom fetch instead of loading bundled WASM", async () => {
		let fetchCalled = false;
		const customFetch = async () => {
			fetchCalled = true;
			const wasm = await readFile("./zeroperl.wasm");
			return new Response(wasm, { headers: { "content-type": "application/wasm" } });
		};

		const perl = await ZeroPerl.create({ fetch: customFetch });
		expect(fetchCalled).toBe(true);
		expect(perl.isInitialized()).toBe(true);
		perl.dispose();
	});
});

describe("getPerlVersion", () => {
	it("should return the bundled Perl version", async () => {
		const version = await getPerlVersion();
		expect(version).toBe(BUNDLED_PERL_VERSION);
	});
});

describe("getPerlVersion with custom fetch", () => {
	it("should call custom fetch and return version", async () => {
		let fetchCalled = false;
		const customFetch = async () => {
			fetchCalled = true;
			const wasm = await readFile("./zeroperl.wasm");
			return new Response(wasm, { headers: { "content-type": "application/wasm" } });
		};

		const version = await getPerlVersion({ fetch: customFetch });
		expect(fetchCalled).toBe(true);
		expect(version).toBe(BUNDLED_PERL_VERSION);
	});
});
