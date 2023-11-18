# ts-mixed-checking-sample

This repo illustrates a couple alternative approaches for incrementally migrating legacy source files
to adopt a stricter `tsconfig.json` configuration for TypeScript.

## How to build the demos

Each project folder (`demo1`, `demo2,` `demo3`) is built using the same shell commands:

```bash
# Step 1. Get PNPM from https://pnpm.io/

# Step 2. Enter the project folder
cd demo1

# Step 3. Install the dependencies
pnpm install

# Step 4. Compile the code
# NOTE: For "demo1" only, this step is expected to print compile errors; the output is still usable.
pnpm build

# Step 5. Run the compiled application.  It should print the string "123", with no error messages.
pnpm start
```

## demo1: Problem setup

The [demo1](./demo1/) folder has 4 files with different levels of TypeScript maturity:

- `A`: [a-best-practices.ts](./demo1/src/a-best-practices.ts) - The ideal good state; this file compiles without errors when `tsconfig.json` has `strict: true`
- `B`: [b-weak-typescript.ts](./demo1/src/b-weak-typescript.ts) - A "legacy" source file that compiles without errors only when using an older `tsconfig.json` that is missing the latest strict checks.
- `C`: [c-never-checked-typescript.ts](./demo1/src/c-never-checked-typescript.ts) - A source file that was shamefully developed without a CI pipeline enforcing type checking by invoking `tsc`. (For example, ESBuild [does not perform any type checking](https://esbuild.github.io/content-types/#typescript), leading to such shameful engineering practices if a compiler step is not introduced somehow.) As a result, this file produces `tsc` errors, although the resulting .js output runs correctly.
- `D`: [d-plain-javascript.js](./demo1/src/d-plain-javascript.js) - An ancient source file that was written using unsafe JavaScript, and has not been converted to TypeScript yet. We can import it using the [allowJs](https://www.typescriptlang.org/tsconfig#allowJs) setting in `tsconfig.json`.

### Dependency criteria

The `import` statements in these files meet the dependency criteria that better levels never import worse levels:

- `D` imports `C`
- `C` imports `B`
- `B` imports `A`

This criteria greatly simplifies the task of migrating everything to the ideal final state `A`. For example, if `a-best-practices.ts` were to import from `b-weak-typescript.ts`, that could cause problems: If `A` declares types that inherit/embed types from `B`, the resulting types may be messy.

### Problem statement

The `demo1` project fails to compile. `c-never-checked-typescript.ts` has compile errors, and strict settings for `a-best-practices.ts` cannot be enabled without breaking `b-weak-typescript.ts`.

Let's now consider two possible solutions.

## demo2: Possible solution using side-by-side tsconfig files

The [demo2](./demo2/) project illustrates an approach of using two configurations side by side:

- [demo2/tsconfig.json](./demo2/tsconfig.json) uses [noEmit: true](https://www.typescriptlang.org/tsconfig#noEmit) to perform type-checking **_without producing any build output files_**. It processes only the file `a-best-practices.ts`, ignoring the other files. `allowJs` is false.
- [demo2/tsconfig.legacy.json](./demo2/tsconfig.json) performs the full build, setting `noEmit: false` to produce the outputs, and using `allowJs` to accept `d-plain-javascript.js`.
- The `package.json` build command is `tsc && tsc --project tsconfig.legacy.json`, invoking the compiler twice.
- For this approach, the errors in `c-never-checked-typescript.ts` are suppressed using `// @ts-nocheck` at the top of that file. This comment should eventually be removed as files are migrated to a better state.

The engineering tradeoff for this approach is speed, since the files referenced by `tsconfig.json` must get type-checked twice.

## demo3: Possible solution using tsconfig references

The [demo3](./demo3/) project illustrates an approach using TypeScript's [project references](https://www.typescriptlang.org/docs/handbook/project-references.html) feature.

- [demo3/tsconfig.json](./demo3/tsconfig.json) compiles `a-best-practices.ts` with strict settings.
- [demo3/tsconfig.legacy.json](./demo3/tsconfig.json) compiles the remaining files using the lax settings. The `tsconfig.legacy.json` references `tsconfig.json` as a dependency.
- The `package.json` build command is `tsc --build tsconfig.legacy.json`, invoking the compiler once in multi-project [build mode](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript).
- This mode requires `"composite": true` in the referenced project `tsconfig.json`, which turns on the compiler's incremental build feature. Because incremental build logic can sometimes get confused, particularly when switching between Git branches, our CI build script must clear the cache using `rimraf -g *.tsbuildinfo` to guarantee a deterministic result.
- For this approach, the errors in `c-never-checked-typescript.ts` are suppressed using `// @ts-nocheck` at the top of that file. This comment should eventually be removed as files are migrated to a better state.

The engineering tradeoff for this approach is increased complexity. Also, many engineers are unfamiliar with project references, as it is a relatively new feature with somewhat limited usefulness. (On the surface, project references looks like a great solution for building monorepos, however it assumes that every project is using the same version of the TypeScript compiler, and it provides no story for invoking other build tasks such as preprocessors, postprocessors, bundlers, test runners, etc.)

## Further thoughts

In the above examples, the [include](https://www.typescriptlang.org/tsconfig#include) paths in `tsconfig.json` are explicitly listed for clarity. In a production solution, they should be based on globs, and some validation is required to avoid mistakes (and enforce the dependency criteria explained above).

For `demo3`, the project references feature requires the `outDir` to be different for `tsconfig.json` and `tsconfig.legacy.json`, which requires some thought to ensure `import`/`require()` paths are correctly remapped from `src/thing.ts` (in .ts files) to the corresponding `lib/thing.js` (in the emitted .js files). I have solved it using a subdirectory (`"outDir": "lib"` and `"outDir": "lib/legacy"`), so that legacy files can import new files using `../` paths which will resolve correctly under both the `src` and `lib` folders. This avoids clumsy path mappings in `tsconfig.legacy.json`, but it would require some validation to ensure that `tsconfig.json`'s `"includes"` globs do not accidentally include files from `src/legacy`.
