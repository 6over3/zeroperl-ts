export declare class WASIAbi {
    /**
     * No error occurred. System call completed successfully.
     */
    static readonly WASI_ESUCCESS = 0;
    /**
     * Bad file descriptor.
     */
    static readonly WASI_ERRNO_BADF = 8;
    /**
     * Function not supported.
     */
    static readonly WASI_ENOSYS = 52;
    /**
     * The clock measuring real time. Time value zero corresponds with 1970-01-01T00:00:00Z.
     */
    static readonly WASI_CLOCK_REALTIME = 0;
    /**
     * The store-wide monotonic clock, which is defined as a clock measuring real time,
     * whose value cannot be adjusted and which cannot have negative clock jumps.
     * The epoch of this clock is undefined. The absolute time value of this clock therefore has no meaning.
     */
    static readonly WASI_CLOCK_MONOTONIC = 1;
    /**
     * The file descriptor or file refers to a directory.
     */
    static readonly WASI_ERRNO_ISDIR = 31;
    /**
     * Invalid argument.
     */
    static readonly WASI_ERRNO_INVAL = 28;
    /**
     * Not a directory or a symbolic link to a directory.
     */
    static readonly WASI_ERRNO_NOTDIR = 54;
    /**
     * No such file or directory.
     */
    static readonly WASI_ERRNO_NOENT = 44;
    /**
     * File exists.
     */
    static readonly WASI_ERRNO_EXIST = 20;
    /**
     * I/O error.
     */
    static readonly WASI_ERRNO_IO = 29;
    /**
     * The file descriptor or file refers to a character device inode.
     */
    static readonly WASI_FILETYPE_CHARACTER_DEVICE = 2;
    /**
     * The file descriptor or file refers to a directory inode.
     */
    static readonly WASI_FILETYPE_DIRECTORY = 3;
    /**
     * The file descriptor or file refers to a regular file inode.
     */
    static readonly WASI_FILETYPE_REGULAR_FILE = 4;
    static readonly IMPORT_FUNCTIONS: string[];
    private encoder;
    private decoder;
    constructor();
    stringArraySize(strings: string[]): {
        pointerArraySize: number;
        bufferSize: number;
        totalSize: number;
    };
    writeStringArray(memory: DataView, strings: string[], arrayOffset: number, bufferOffset: number): number;
    writeString(memory: DataView, value: string, offset: number): number;
    readString(memory: DataView, ptr: number, len: number): string;
    byteLength(value: string): number;
    private static readonly iovec_t;
    iovViews(memory: DataView, iovs: number, iovsLen: number): Uint8Array[];
    writeFilestat(memory: DataView, ptr: number, filetype: number, size?: bigint, atim?: bigint, mtim?: bigint, ctim?: bigint): void;
    writeFdstat(memory: DataView, ptr: number, filetype: number, fdflags: number, rightsBase: bigint, rightsInheriting: bigint): void;
}
/**
 * An exception that is thrown when the process exits.
 **/
export declare class WASIProcExit {
    readonly code: number;
    constructor(code: number);
    /** @deprecated Use 'code' instead.
     *  Has been renamed to have loose compatibility
     *  with other implementations **/
    get exitCode(): number;
}
